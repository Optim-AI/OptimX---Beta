/**
 * Poster QC vision evaluator abstraction + Gemini adapter — Phase 7.
 * Reuses Gemini REST + retry; does NOT call image generation APIs.
 */

import {
  GEMINI_REST_BASE,
  getGeminiApiKey,
} from "@/lib/gemini-config";
import { fetchWithGeminiRateLimitRetry } from "@/lib/gemini-retry";
import {
  extractJsonObject,
  StructuredGenerationError,
} from "@/lib/creative-studio/commercial-production/commercial-director/llm";
import { fetchUrlToDataUrl } from "@/lib/creative-studio/nano-banana";
import type { PosterQcCheck, PosterQcIssue, QcFailureType } from "../types";
import {
  formatQcContextForEvaluator,
  type PosterQcInput,
} from "./qc-input";
import { PosterQcError } from "./qc-errors";

export type PosterQcVisionEvaluation = {
  available: boolean;
  failureType: QcFailureType;
  summary: string;
  confidence: number;
  checks: Partial<{
    productFidelity: PosterQcCheck;
    copyAccuracy: PosterQcCheck;
    visualHierarchy: PosterQcCheck;
    composition: PosterQcCheck;
    conceptExecution: PosterQcCheck;
    strategyAlignment: PosterQcCheck;
    brandCompliance: PosterQcCheck;
    referenceCompliance: PosterQcCheck;
    artifactDetection: PosterQcCheck;
    claimSafety: PosterQcCheck;
  }>;
  issues: PosterQcIssue[];
  warnings: PosterQcIssue[];
  error?: string;
};

export interface PosterQcEvaluator {
  readonly id: string;
  evaluate(input: PosterQcInput): Promise<PosterQcVisionEvaluation>;
}

const SYSTEM_PROMPT = `You are a Poster QC evaluator for an advertising production system.

Your job: compare the GENERATED IMAGE against the approved GenerationSpecification and creative chain.

You must NOT redesign the poster, invent a new concept, or rewrite strategy.

Return JSON only with this shape:
{
  "failureType": "none|generation_execution|specification|technical",
  "summary": "1-2 sentence expected vs observed",
  "confidence": 0.0-1.0,
  "checks": {
    "productFidelity": { "status": "pass|warn|fail", "severity": "none|low|medium|high|critical", "summary": "", "expected": "", "observed": "", "evidence": [] },
    "copyAccuracy": { ... },
    "visualHierarchy": { ... },
    "composition": { ... },
    "conceptExecution": { ... },
    "strategyAlignment": { ... },
    "brandCompliance": { ... },
    "referenceCompliance": { ... },
    "artifactDetection": { ... },
    "claimSafety": { ... }
  },
  "issues": [
    {
      "id": "unique",
      "category": "product|copy|composition|concept|strategy|brand|reference|technical|artifact|claim|text|design|marketing",
      "severity": "low|medium|high|critical",
      "code": "SHORT_CODE",
      "message": "why it failed",
      "expected": "",
      "observed": "",
      "actionable": true,
      "recommendedFix": ""
    }
  ],
  "warnings": []
}

Rules:
- Product fidelity is first-class: wrong packaging/product/logo mutation = fail.
- Exact copy/numbers matter (26g vs 25g is a fail).
- Concept execution: lifestyle DNA must not become generic centered gradient hero.
- Design references are inspiration — do not fail for originality; DO fail if reference product replaced user product.
- Distinguish specification failure (image followed a bad plan) vs generation_execution (plan good, image diverged).
- Do not invent unsupported medical claims as acceptable.`;

function toInlinePart(dataUrl: string): { inline_data: { mime_type: string; data: string } } | null {
  const m = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  if (!m) return null;
  return { inline_data: { mime_type: m[1] || "image/png", data: m[2] } };
}

export class GeminiPosterQcEvaluator implements PosterQcEvaluator {
  readonly id = "gemini_poster_qc";
  readonly modelId: string;
  private readonly apiKey: string | undefined;

  constructor(options: { modelId?: string; apiKey?: string } = {}) {
    this.modelId =
      options.modelId ||
      process.env.POSTER_QC_VISION_MODEL ||
      process.env.COMMERCIAL_QC_VISION_MODEL ||
      process.env.COMMERCIAL_DIRECTOR_MODEL ||
      "gemini-2.5-flash";
    this.apiKey = options.apiKey ?? getGeminiApiKey();
  }

  async evaluate(input: PosterQcInput): Promise<PosterQcVisionEvaluation> {
    if (!this.apiKey) {
      return {
        available: false,
        failureType: "technical",
        summary: "Vision QC unavailable — missing Gemini API key",
        confidence: 0,
        checks: {},
        issues: [],
        warnings: [],
        error: "GEMINI_API_KEY / NANO_API_KEY required for visual QC",
      };
    }

    let imageDataUrl = input.imageUrl;
    if (imageDataUrl.startsWith("http://") || imageDataUrl.startsWith("https://")) {
      const fetched = await fetchUrlToDataUrl(imageDataUrl);
      if (!fetched) {
        return {
          available: false,
          failureType: "technical",
          summary: "Could not load generated image for vision QC",
          confidence: 0,
          checks: {},
          issues: [
            {
              id: "vision_load",
              category: "technical",
              severity: "critical",
              code: "IMAGE_FETCH_FAILED",
              message: "Failed to fetch generated image for QC",
              actionable: true,
            },
          ],
          warnings: [],
          error: "image fetch failed",
        };
      }
      imageDataUrl = fetched;
    }

    const imagePart = toInlinePart(imageDataUrl);
    if (!imagePart) {
      return {
        available: false,
        failureType: "technical",
        summary: "Generated image is not a usable data URL",
        confidence: 0,
        checks: {},
        issues: [],
        warnings: [],
        error: "invalid image data",
      };
    }

    const parts: Array<Record<string, unknown>> = [
      { text: formatQcContextForEvaluator(input) },
      { text: "GENERATED POSTER IMAGE:" },
      imagePart,
    ];

    // Attach up to 2 product references for fidelity comparison
    for (const url of input.productReferenceUrls.slice(0, 2)) {
      let ref = url;
      if (ref.startsWith("http")) {
        const fetched = await fetchUrlToDataUrl(ref);
        if (!fetched) continue;
        ref = fetched;
      }
      const part = toInlinePart(ref);
      if (!part) continue;
      parts.push({ text: "PRODUCT REFERENCE (authoritative product appearance):" });
      parts.push(part);
    }

    parts.push({
      text: "Evaluate expected vs observed. Return JSON only.",
    });

    const payload = {
      contents: [{ parts }],
      system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
      generation_config: {
        temperature: 0.2,
        max_output_tokens: 8192,
        response_mime_type: "application/json",
      },
    };

    try {
      const url = `${GEMINI_REST_BASE}/models/${encodeURIComponent(this.modelId)}:generateContent`;
      const resp = await fetchWithGeminiRateLimitRetry(
        url,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-goog-api-key": this.apiKey!,
          },
          body: JSON.stringify(payload),
        },
        { maxRetries: 3, operationLabel: "poster-qc-vision" }
      );

      if (!resp.ok) {
        const errText = await resp.text();
        throw new PosterQcError({
          code: "PROVIDER",
          message: `Vision QC HTTP ${resp.status}: ${errText.slice(0, 200)}`,
          stage: "vision",
          retryable: resp.status === 429,
        });
      }

      const json = await resp.json();
      const text =
        json?.candidates?.[0]?.content?.parts
          ?.map((p: { text?: string }) => p.text || "")
          .join("") || "";
      if (!text.trim()) {
        throw new PosterQcError({
          code: "MALFORMED_MODEL_OUTPUT",
          message: "Vision QC returned empty response",
          stage: "vision",
          retryable: true,
        });
      }

      const parsed = extractJsonObject(text) as Record<string, any>;
      return normalizeVisionPayload(parsed);
    } catch (e) {
      if (e instanceof PosterQcError) throw e;
      if (e instanceof StructuredGenerationError) {
        throw new PosterQcError({
          code: "MALFORMED_MODEL_OUTPUT",
          message: e.message,
          stage: "vision",
          retryable: true,
        });
      }
      throw e;
    }
  }
}

function normalizeCheck(raw: any, fallbackSummary: string): PosterQcCheck {
  const status =
    raw?.status === "fail" || raw?.status === "warn" || raw?.status === "pass"
      ? raw.status
      : "warn";
  const severity =
    ["none", "low", "medium", "high", "critical"].includes(raw?.severity)
      ? raw.severity
      : status === "fail"
        ? "high"
        : status === "warn"
          ? "medium"
          : "none";
  return {
    status,
    severity,
    summary: String(raw?.summary || fallbackSummary).trim() || fallbackSummary,
    evidence: Array.isArray(raw?.evidence)
      ? raw.evidence.map(String).slice(0, 6)
      : undefined,
    expected: raw?.expected != null ? String(raw.expected) : undefined,
    observed: raw?.observed != null ? String(raw.observed) : undefined,
  };
}

function normalizeIssue(raw: any, idx: number): PosterQcIssue {
  const cats = [
    "product",
    "text",
    "copy",
    "design",
    "marketing",
    "brand",
    "technical",
    "composition",
    "concept",
    "strategy",
    "reference",
    "artifact",
    "claim",
  ];
  const category = cats.includes(raw?.category) ? raw.category : "design";
  const severity = ["low", "medium", "high", "critical"].includes(raw?.severity)
    ? raw.severity
    : "medium";
  return {
    id: String(raw?.id || `issue_${idx + 1}`),
    category,
    severity,
    code: String(raw?.code || "QC_ISSUE"),
    message: String(raw?.message || "Issue detected").trim(),
    expected: raw?.expected != null ? String(raw.expected) : null,
    observed: raw?.observed != null ? String(raw.observed) : null,
    actionable: raw?.actionable !== false,
    recommendedFix:
      raw?.recommendedFix != null ? String(raw.recommendedFix) : null,
  };
}

function normalizeVisionPayload(raw: Record<string, any>): PosterQcVisionEvaluation {
  const failureTypeRaw = String(raw.failureType || "none");
  const failureType: QcFailureType = [
    "none",
    "generation_execution",
    "specification",
    "technical",
  ].includes(failureTypeRaw)
    ? (failureTypeRaw as QcFailureType)
    : "generation_execution";

  const checksRaw = raw.checks && typeof raw.checks === "object" ? raw.checks : {};

  return {
    available: true,
    failureType,
    summary: String(raw.summary || "QC evaluation complete").trim(),
    confidence: Math.max(0, Math.min(1, Number(raw.confidence) || 0.7)),
    checks: {
      productFidelity: normalizeCheck(checksRaw.productFidelity, "Product fidelity"),
      copyAccuracy: normalizeCheck(checksRaw.copyAccuracy, "Copy accuracy"),
      visualHierarchy: normalizeCheck(checksRaw.visualHierarchy, "Visual hierarchy"),
      composition: normalizeCheck(checksRaw.composition, "Composition"),
      conceptExecution: normalizeCheck(checksRaw.conceptExecution, "Concept execution"),
      strategyAlignment: normalizeCheck(checksRaw.strategyAlignment, "Strategy alignment"),
      brandCompliance: normalizeCheck(checksRaw.brandCompliance, "Brand compliance"),
      referenceCompliance: normalizeCheck(
        checksRaw.referenceCompliance,
        "Reference compliance"
      ),
      artifactDetection: normalizeCheck(
        checksRaw.artifactDetection,
        "Artifact detection"
      ),
      claimSafety: normalizeCheck(checksRaw.claimSafety, "Claim safety"),
    },
    issues: Array.isArray(raw.issues)
      ? raw.issues.map(normalizeIssue).slice(0, 20)
      : [],
    warnings: Array.isArray(raw.warnings)
      ? raw.warnings.map(normalizeIssue).slice(0, 20)
      : [],
  };
}

export function createGeminiPosterQcEvaluator(): PosterQcEvaluator {
  return new GeminiPosterQcEvaluator();
}
