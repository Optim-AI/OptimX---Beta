/**
 * Phase 8 — Iteration Classifier
 *
 * Classifies ONLY. Does not write image prompts.
 * Selects the highest necessary scope when signals conflict.
 */

import type {
  EditClassification,
  IterationClassificationDetail,
  IterationMode,
} from "../types";
import {
  editClassificationToMode,
  modeToEditClassification,
} from "../types";
import type { IterationClassifierInput } from "./classifier-input";
import { PosterIterationError } from "./iteration-errors";

export type ClassificationResult = {
  mode: IterationMode;
  classification: EditClassification;
  target: string;
  rationale: string;
  confidence: number;
  detail: IterationClassificationDetail;
  /** Detected intents used for planning */
  signals: {
    wantsFullRestart: boolean;
    wantsCreativeShift: boolean;
    wantsDesignShift: boolean;
    wantsLocalChange: boolean;
    wantsCopyChange: boolean;
    wantsProductScale: boolean;
    wantsProductReplace: boolean;
    copyHeadline?: string | null;
  };
};

function normalize(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

const FULL_PATTERNS = [
  /\bcompletely different\b/,
  /\bentirely different\b/,
  /\bstart over\b/,
  /\bstart from scratch\b/,
  /\bforget (this|the) (concept|poster|ad|design)\b/,
  /\bnew advertisement\b/,
  /\bcompletely new (ad|poster|creative|direction)\b/,
  /\bgive me a (totally|completely) different\b/,
  /\bdifferent ad\b/,
  /\bdifferent advertisement\b/,
];

const CREATIVE_PATTERNS = [
  /\bshow (a |someone |somebody )?(person|people|someone|somebody|athlete|model)\b/,
  /\binstead of\b/,
  /\busing (the |this )?product\b/,
  /\bdrinking\b/,
  /\bafter (a )?workout\b/,
  /\bat the gym\b/,
  /\bmore (playful|energetic|dynamic|lifestyle)\b/,
  /\bcompletely different visual idea\b/,
  /\bdifferent visual idea\b/,
  /\bnew creative (direction|idea|concept)\b/,
  /\bhuman[- ]led\b/,
  /\blifestyle (moment|scene|shot)\b/,
  /\bproduct hero\b/,
  /\bsomeone (using|holding|drinking|wearing)\b/,
];

const DESIGN_PATTERNS = [
  /\bmore premium\b/,
  /\blook (more )?premium\b/,
  /\bfeel more premium\b/,
  /\bmake (it |this )?(more )?premium\b/,
  /\bdark luxury\b/,
  /\bluxury\b/,
  /\bminimal( composition)?\b/,
  /\bmore minimal\b/,
  /\bcleaner typography\b/,
  /\btypography cleaner\b/,
  /\bhigh[- ]end\b/,
  /\bskincare advertisement\b/,
  /\bchange (the )?background\b/,
  /\bdarker\b/,
  /\bbrighter\b/,
  /\bmore (moody|cinematic|editorial)\b/,
  /\bvisual treatment\b/,
];

const LOCAL_PATTERNS = [
  /\b(make|scale|resize).{0,40}(product|pack|bottle|can).{0,20}(bigger|larger|smaller|huge)\b/,
  /\b(product|pack|bottle).{0,20}(bigger|larger|smaller|20%|30%)\b/,
  /\b(bigger|larger|smaller).{0,20}(product|pack)\b/,
  /\bmove (the )?(cta|button|headline|logo|product)\b/,
  /\b(cta|button).{0,20}(lower|higher|left|right)\b/,
  /\bremove (the )?(lemon|person|people|human|model|badge)\b/,
  /\b(logo|headline|cta).{0,30}(smaller|larger|bigger|font size)\b/,
  /\bfont size\b/,
  /\bslightly (to the )?(left|right|up|down)\b/,
];

const COPY_PATTERNS = [
  /\bchange (the )?headline\b/,
  /\bheadline to\b/,
  /\brewrite (the )?(headline|cta|copy)\b/,
  /\bchange (the )?cta\b/,
  /\bcta to\b/,
  /\bsay ["“](.+?)["”]/,
  /\bheadline[:\s]+["“]?(.+?)["”]?$/,
];

const PRODUCT_REPLACE_PATTERNS = [
  /\breplace (this|the product|it) with\b/,
  /\bchocolate version\b/,
  /\bdifferent (flavor|sku|variant|product)\b/,
  /\bswap (the )?product\b/,
];

function extractQuotedHeadline(request: string): string | null {
  const m =
    request.match(
      /headline\s*(?:to|:)\s*["“](.+?)["”]/i
    ) ||
    request.match(
      /change\s+(?:the\s+)?headline\s+to\s+["“]?(.+?)["”]?$/i
    ) ||
    request.match(/say\s+["“](.+?)["”]/i);
  return m?.[1]?.trim() || null;
}

function detectSignals(request: string): ClassificationResult["signals"] {
  const n = normalize(request);
  const wantsFullRestart = FULL_PATTERNS.some((p) => p.test(n));
  const wantsCreativeShift = CREATIVE_PATTERNS.some((p) => p.test(n));
  const wantsDesignShift = DESIGN_PATTERNS.some((p) => p.test(n));
  const wantsLocalChange = LOCAL_PATTERNS.some((p) => p.test(n));
  const wantsCopyChange = COPY_PATTERNS.some((p) => p.test(n));
  const wantsProductScale =
    /\b(product|pack|bottle).{0,40}(bigger|larger|smaller)\b/.test(n) ||
    /\b(bigger|larger|smaller).{0,40}(product|pack|bottle)\b/.test(n) ||
    /\b20%\s*(bigger|larger)\b/.test(n);
  const wantsProductReplace = PRODUCT_REPLACE_PATTERNS.some((p) => p.test(n));
  const copyHeadline = wantsCopyChange ? extractQuotedHeadline(request) : null;

  return {
    wantsFullRestart,
    wantsCreativeShift,
    wantsDesignShift,
    wantsLocalChange,
    wantsCopyChange,
    wantsProductScale,
    wantsProductReplace,
    copyHeadline,
  };
}

function pickHighestScope(
  signals: ClassificationResult["signals"]
): { mode: IterationMode; target: string; rationale: string; confidence: number } {
  // Highest necessary scope wins
  if (signals.wantsFullRestart) {
    return {
      mode: "FULL",
      target: "creative direction",
      rationale:
        "The request asks for a completely new advertisement while keeping campaign context.",
      confidence: 0.94,
    };
  }

  if (signals.wantsProductReplace) {
    // Product identity change is out of LOCAL — treat as CREATIVE with product note
    return {
      mode: "CREATIVE",
      target: "product variant",
      rationale:
        "Replacing the product variant requires more than a local presentation edit.",
      confidence: 0.88,
    };
  }

  if (signals.wantsCreativeShift) {
    return {
      mode: "CREATIVE",
      target: "creative expression",
      rationale:
        "The request changes the creative idea (subject / story) while marketing strategy can stay locked.",
      confidence: 0.92,
    };
  }

  // Mixed: design + creative language already handled; design alone:
  if (signals.wantsDesignShift && !signals.wantsLocalChange) {
    return {
      mode: "DESIGN",
      target: "visual treatment",
      rationale:
        "The request changes visual treatment while preserving the marketing idea and copy.",
      confidence: 0.93,
    };
  }

  if (signals.wantsDesignShift && signals.wantsCreativeShift) {
    return {
      mode: "CREATIVE",
      target: "creative expression",
      rationale:
        "Mixed request includes a creative shift; selecting the higher CREATIVE scope.",
      confidence: 0.9,
    };
  }

  if (signals.wantsCopyChange && !signals.wantsCreativeShift && !signals.wantsDesignShift) {
    return {
      mode: "LOCAL",
      target: "copy",
      rationale:
        "The request changes specific copy while preserving the existing creative.",
      confidence: 0.95,
    };
  }

  if (signals.wantsProductScale || signals.wantsLocalChange) {
    return {
      mode: "LOCAL",
      target: signals.wantsProductScale ? "product scale" : "local element",
      rationale:
        "The request changes a specific element while preserving the overall creative.",
      confidence: 0.96,
    };
  }

  if (signals.wantsDesignShift) {
    return {
      mode: "DESIGN",
      target: "visual treatment",
      rationale:
        "The request changes visual treatment while preserving the marketing idea.",
      confidence: 0.9,
    };
  }

  // Default: LOCAL with lower confidence — safer than FULL
  return {
    mode: "LOCAL",
    target: "requested change",
    rationale:
      "Treating as a local controlled edit to preserve the approved creative unless a broader scope is clear.",
    confidence: 0.55,
  };
}

/**
 * Deterministic classifier — no image prompt generation.
 */
export function classifyIterationRequest(
  input: IterationClassifierInput
): ClassificationResult {
  const request = (input.userRequest || "").trim();
  if (!request) {
    throw new PosterIterationError({
      code: "VALIDATION",
      message: "Edit request is required",
      stage: "classify",
    });
  }

  // Touch authoritative artifacts so callers can't skip loading them
  if (!input.specification?.id || !input.strategy?.id || !input.concept?.id) {
    throw new PosterIterationError({
      code: "VALIDATION",
      message: "Classifier requires specification, strategy, and concept from session",
      stage: "classify",
    });
  }

  const signals = detectSignals(request);

  // Explicit mixed: premium + person drinking → CREATIVE (highest)
  const n = normalize(request);
  if (
    (signals.wantsDesignShift || /\bpremium\b/.test(n)) &&
    (signals.wantsCreativeShift || /\bdrinking\b/.test(n) || /\bsomeone\b/.test(n))
  ) {
    signals.wantsCreativeShift = true;
  }

  const picked = pickHighestScope(signals);
  const classification = modeToEditClassification(picked.mode);

  return {
    mode: picked.mode,
    classification,
    target: picked.target,
    rationale: picked.rationale,
    confidence: picked.confidence,
    detail: {
      target: picked.target,
      rationale: picked.rationale,
      confidence: picked.confidence,
    },
    signals,
  };
}

export function assertModeMatchesClassification(
  mode: IterationMode,
  classification: EditClassification
): void {
  if (editClassificationToMode(classification) !== mode) {
    throw new PosterIterationError({
      code: "CLASSIFICATION_FAILED",
      message: "Mode and classification mismatch",
      stage: "classify",
    });
  }
}
