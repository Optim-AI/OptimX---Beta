/**
 * Poster eval — stress-test poster generation as real ad work.
 *
 * For each case: live strategist → concept director (3 concepts) → a poster per
 * concept through the production generator, plus a baseline poster for concept 1
 * using the previous (pre-art-director) prompt. Every poster gets the in-app QC
 * and an independent ad-effectiveness judge; new vs baseline is judged blind.
 *
 * Usage (from the repo root; costs real Gemini calls, roughly $0.4–0.8 per case):
 *   NODE_PATH=$PWD/node_modules npx tsx --env-file=.env.local --tsconfig tsconfig.json \
 *     scripts/poster-eval/run.ts <outDir> [caseId,caseId...]
 * Then: npx tsx --tsconfig tsconfig.json scripts/poster-eval/report.ts <outDir>
 *
 * EVAL_MODE=templates: the concept posters use the template path (text-free
 * scene + product cut-out + code-rendered type) and the baseline is the current
 * full-AI poster. Needs a cut-out provider (PHOTOROOM_API_KEY, REMOVE_BG_API_KEY,
 * or CUTOUT_PROVIDER=local for clean studio packshots).
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import axios from "axios";
import { EVAL_CASES, type EvalCase } from "./cases";
import { judgePair, judgePoster, textMismatches, JUDGE_MODEL, type JudgeResult, type PairwiseResult } from "./judge";
import { strategistInputFromBrief } from "@/lib/creative-studio/poster-generation/strategy/from-brief";
import { generateMarketingStrategy } from "@/lib/creative-studio/poster-generation/strategy/strategist";
import { generateCreativeConcepts } from "@/lib/creative-studio/poster-generation/concept/director";
import { directorInputFromSession } from "@/lib/creative-studio/poster-generation/concept/from-session";
import { buildGenerationSpecification } from "@/lib/creative-studio/poster-generation/generation/specification-builder";
import { assertValidGenerationSpecification } from "@/lib/creative-studio/poster-generation/generation/specification-validation";
import { buildImageGenerationRequest } from "@/lib/creative-studio/poster-generation/generation/nano-banana-prompt";
import { NanoBananaImageProvider } from "@/lib/creative-studio/poster-generation/generation/nano-banana-provider";
import { runPosterQc } from "@/lib/creative-studio/poster-generation/qc/qc-engine";
import { getNanoBananaApiKey, detectImageMimeType } from "@/lib/creative-studio/nano-banana";
import { getProductCutout, type CutoutCacheRow } from "@/lib/creative-studio/product-cutouts";
import { generateTemplatePoster, loadBrandAssets, selectTemplate } from "@/lib/creative-studio/poster-templates";
import { resolveAdFormat } from "@/lib/creative-studio/poster-generation/generation/ad-format";
import type {
  CreativeBrief,
  CreativeConcept,
  CreativeDNA,
  GenerationSpecification,
  MarketingStrategy,
  PosterGeneratedAsset,
} from "@/lib/creative-studio/poster-generation/types";

const OUT = process.argv[2];
if (!OUT) {
  console.error("usage: run.ts <outDir> [caseIds]");
  process.exit(1);
}
const ONLY = (process.argv[3] || "").split(",").filter(Boolean);
const CASE_CONCURRENCY = 2;
const TEMPLATE_MODE = process.env.EVAL_MODE === "templates";

export type PosterRecord = {
  label: string;
  variant: "new" | "baseline";
  conceptIndex: number;
  conceptName: string;
  territory: string;
  file: string;
  /** Template id when the poster was composed from a template */
  template?: string | null;
  prompt: string;
  promptWords: number;
  approvedText: string[];
  genMs: number;
  qc: { status: string; summary: string; issues: string[] } | { error: string };
  judge: (JudgeResult & { missingText: string[]; extraText: string[] }) | { error: string };
};

export type CaseRecord = {
  case: EvalCase;
  ok: boolean;
  error?: string;
  timings: Record<string, number>;
  strategy?: Pick<MarketingStrategy, "objective" | "primaryMessage" | "communicationAngle" | "copy" | "audience">;
  concepts?: Array<{ name: string; territory: string; description: string }>;
  posters: PosterRecord[];
  pairwise?: (PairwiseResult & { newWasLabel: "A" | "B"; newWon: boolean | null }) | { error: string };
};

async function timed<T>(timings: Record<string, number>, key: string, fn: () => Promise<T>): Promise<T> {
  const t = Date.now();
  try {
    return await fn();
  } finally {
    timings[key] = Date.now() - t;
  }
}

async function packshot(c: EvalCase, dir: string): Promise<Buffer | null> {
  if (!c.packshotPrompt) return null;
  const path = join(dir, "product.png");
  if (existsSync(path)) return readFileSync(path);
  const res = await axios.post(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image:generateContent",
    {
      contents: [{ parts: [{ text: c.packshotPrompt }] }],
      generationConfig: { responseModalities: ["Image"], imageConfig: { aspectRatio: "1:1", imageSize: "1K" } },
    },
    { headers: { "x-goog-api-key": getNanoBananaApiKey()!, "content-type": "application/json" }, timeout: 180_000 }
  );
  const part = res.data?.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData || p.inline_data);
  const data = (part?.inlineData || part?.inline_data)?.data;
  if (!data) throw new Error("packshot generation returned no image");
  const buf = Buffer.from(data, "base64");
  writeFileSync(path, buf);
  return buf;
}

function buildBrief(c: EvalCase, productDataUrl: string | null): CreativeBrief {
  return {
    id: `brief_${c.id}`,
    createdAt: new Date().toISOString(),
    brand: {
      snapshot: null,
      name: c.brandName,
      primaryColors: c.brandColors,
      aestheticTags: [],
      values: [],
      guidelinesApplied: false,
      logo: null,
    },
    product: {
      source: "catalog",
      name: c.product.name,
      description: c.product.description,
      shortBenefit: c.product.shortBenefit,
      category: c.product.category,
      benefits: c.product.benefits,
      factualClaims: c.product.factualClaims,
      features: [],
      emotionalAngles: [],
      useCases: [],
      images: productDataUrl ? [{ url: productDataUrl }] : [],
      brandName: c.brandName,
    },
    userInstruction: c.userInstruction,
    visualDirection: c.visualDirection,
    aspectRatio: c.aspectRatio,
    variantCount: 3,
    objectiveHint: c.objectiveHint ?? null,
    offerHint: c.offerHint ?? null,
    constraints: [],
    productReferences: productDataUrl
      ? [{ id: "pref_1", role: "product_packshot", image: { url: productDataUrl } }]
      : [],
    designReferences: [],
    supportingReferences: [],
  } as CreativeBrief;
}

async function runCase(c: EvalCase): Promise<CaseRecord> {
  const dir = join(OUT, c.id);
  mkdirSync(dir, { recursive: true });
  const timings: Record<string, number> = {};
  const record: CaseRecord = { case: c, ok: false, timings, posters: [] };
  const log = (m: string) => console.log(`[${c.id}] ${m}`);

  try {
    const product = await timed(timings, "packshot", () => packshot(c, dir));
    const productMime = product ? detectImageMimeType(product) : null;
    const productDataUrl = product ? `data:${productMime};base64,${product.toString("base64")}` : null;
    const brief = buildBrief(c, productDataUrl);
    const contexts = strategistInputFromBrief(brief);

    const strategy = await timed(timings, "strategy", () => generateMarketingStrategy(contexts));
    record.strategy = {
      objective: strategy.objective,
      primaryMessage: strategy.primaryMessage,
      communicationAngle: strategy.communicationAngle,
      audience: strategy.audience,
      copy: strategy.copy,
    };
    log(`strategy: ${strategy.objective} — "${strategy.copy.headline}"`);

    const { concepts, dnaByConceptId } = await timed(timings, "concepts", () =>
      generateCreativeConcepts(directorInputFromSession({ brief, strategy, conceptCount: 3 }))
    );
    record.concepts = concepts.map((k) => ({ name: k.name, territory: k.territory, description: k.description }));
    log(`concepts: ${concepts.map((k) => `${k.name} (${k.territory})`).join(" | ")}`);

    const provider = new NanoBananaImageProvider();
    let cutoutPng: Buffer | null = null;
    if (TEMPLATE_MODE && productDataUrl) {
      const memo = new Map<string, CutoutCacheRow>();
      const cut = await timed(timings, "cutout", () =>
        getProductCutout(
          { userId: "eval", source: productDataUrl },
          {
            cache: { get: async (_u, h) => memo.get(h) ?? null, put: async (_u, r) => void memo.set(r.sourceHash, r) },
            store: async () => {
              throw new Error("eval keeps cut-outs local");
            },
          }
        )
      );
      cutoutPng = cut.ok ? cut.png : null;
      if (cut.png) writeFileSync(join(dir, "cutout.png"), cut.png);
      log(cut.ok ? `cut-out ok (${cut.provider})` : `cut-out unavailable: ${cut.error} — full-AI posters`);
    }
    const jobs: Array<{ concept: CreativeConcept; dna: CreativeDNA; index: number; variant: "new" | "baseline" }> = [
      ...concepts.map((concept, index) => ({ concept, dna: dnaByConceptId[concept.id], index, variant: "new" as const })),
      { concept: concepts[0], dna: dnaByConceptId[concepts[0].id], index: 0, variant: "baseline" as const },
    ];

    // Pick templates in variant order (as production does) so each concept gets a different one.
    const templatePicks: Array<ReturnType<typeof selectTemplate>> = [];
    if (TEMPLATE_MODE && cutoutPng) {
      for (const [index, concept] of concepts.entries()) {
        const kind = resolveAdFormat({ brief, strategy, concept }).kind;
        templatePicks.push(
          selectTemplate({
            kind,
            aspect: c.aspectRatio,
            variantIndex: index,
            hasCutout: true,
            concept,
            used: templatePicks.filter((t) => !!t).map((t) => t!.id),
          })
        );
      }
      log(`templates: ${templatePicks.map((t, i) => `${i + 1}=${t?.id ?? "full-AI"}`).join(" ")}`);
    }
    const genStart = Date.now();
    record.posters = await Promise.all(
      jobs.map(async (job): Promise<PosterRecord> => {
        const label = job.variant === "new" ? `concept${job.index + 1}` : "baseline";
        let spec: GenerationSpecification = buildGenerationSpecification({
          sessionId: `eval_${c.id}`,
          brief,
          strategy,
          concept: job.concept,
          dna: job.dna,
          product: contexts.product,
          brand: contexts.brand,
          references: contexts.references,
          variantIndex: job.index,
          brandKit: c.brandKit ?? null,
        });
        assertValidGenerationSpecification(spec, strategy);
        // Baseline = the previous prompt compiler (specs without artDirection fall back to it)
        // Template mode compares against today's production poster; otherwise the old prompt.
        if (job.variant === "baseline" && !TEMPLATE_MODE) spec = { ...spec, artDirection: null };
        const template = job.variant === "new" ? templatePicks[job.index] : null;
        const req = buildImageGenerationRequest({ specification: spec, userId: "eval" });
        const t = Date.now();
        let res: { ok: boolean; imageBuffer?: Buffer | null; mimeType?: string | null; provider: string; model: string; errorMessage?: string | null };
        let promptUsed = req.prompt;
        let templateInfo: PosterGeneratedAsset["template"] = null;
        if (template && cutoutPng) {
          const brand = await loadBrandAssets(c.brandKit ?? null, spec);
          const out = await generateTemplatePoster({ spec, template, cutout: cutoutPng, brand, provider, userId: "eval" });
          promptUsed = out.scenePrompt ?? "(no AI call — brand colour background)";
          res = out.ok
            ? { ok: true, imageBuffer: out.imageBuffer, mimeType: out.mimeType, provider: out.provider, model: out.model }
            : { ok: false, provider: "template", model: "template", errorMessage: out.errorMessage };
          if (out.ok && out.sceneBuffer) writeFileSync(join(dir, `${label}.scene.jpg`), out.sceneBuffer);
          if (out.ok) {
            writeFileSync(join(dir, `${label}.manifest.json`), JSON.stringify(out.manifest, null, 2));
            templateInfo = { id: template.id, version: template.version, sceneUrl: null, cutoutUrl: null, manifest: out.manifest };
          }
        } else {
          res = await provider.generate(req);
        }
        const genMs = Date.now() - t;
        const approvedText = spec.copyHierarchy.map((s) => s.text);
        const base: Omit<PosterRecord, "qc" | "judge"> = {
          label,
          variant: job.variant,
          conceptIndex: job.index,
          conceptName: job.concept.name,
          territory: job.concept.territory,
          file: "",
          template: template?.id ?? null,
          prompt: promptUsed,
          promptWords: promptUsed.split(/\s+/).length,
          approvedText,
          genMs,
        };
        if (!res.ok || !res.imageBuffer) {
          return { ...base, qc: { error: "generation failed" }, judge: { error: res.errorMessage || "generation failed" } };
        }
        const mime = res.mimeType || detectImageMimeType(res.imageBuffer);
        const file = `${label}.${mime === "image/jpeg" ? "jpg" : "png"}`;
        writeFileSync(join(dir, file), res.imageBuffer);
        writeFileSync(join(dir, `${label}.prompt.txt`), promptUsed);
        log(`generated ${label} in ${Math.round(genMs / 1000)}s`);

        const imageDataUrl = `data:${mime};base64,${res.imageBuffer.toString("base64")}`;
        const asset = {
          id: spec.generationId,
          sessionId: spec.sessionId,
          generationId: spec.generationId,
          variantId: spec.variantId,
          variantIndex: job.index,
          conceptId: job.concept.id,
          dnaId: job.dna.id,
          specificationId: spec.id,
          imageUrl: imageDataUrl,
          provider: res.provider,
          model: res.model,
          creditsConsumed: 1,
          status: "generated",
          attemptCount: 1,
          durationMs: genMs,
          createdAt: new Date().toISOString(),
          template: templateInfo,
        } as PosterGeneratedAsset;

        const [qc, judge] = await Promise.all([
          runPosterQc({
            sessionId: spec.sessionId,
            brief,
            strategy,
            concept: job.concept,
            dna: job.dna,
            specification: spec,
            asset,
            product: contexts.product,
            brand: contexts.brand,
            references: contexts.references,
            imageUrl: imageDataUrl,
            productReferenceUrls: productDataUrl ? [productDataUrl] : [],
          })
            .then((q) => ({ status: q.status, summary: q.summary, issues: q.issues.map((i) => `${i.severity}: ${i.message}`) }))
            .catch((e) => ({ error: String(e?.message || e) })),
          judgePoster({
            poster: res.imageBuffer,
            posterMime: mime,
            productPhoto: product ? { buf: product, mime: productMime! } : null,
            context: {
              brand: c.brandName,
              product: c.product.name,
              objective: strategy.objective,
              userInstruction: c.userInstruction,
              aspectRatio: c.aspectRatio,
              approvedText,
              brandKit: c.brandKit
                ? `colours ${c.brandKit.colors.map((k) => `${k.role} ${k.hex}`).join(", ")}; headline font ${c.brandKit.fonts.heading?.family}; body font ${c.brandKit.fonts.body?.family}`
                : null,
            },
          })
            .then((j) => ({ ...j, ...(() => { const m = textMismatches(approvedText, j.textSeen); return { missingText: m.missing, extraText: m.extra }; })() }))
            .catch((e) => ({ error: String(e?.message || e) })),
        ]);
        return { ...base, file, qc, judge };
      })
    );
    timings.generateAndJudge = Date.now() - genStart;

    const fresh = record.posters.find((p) => p.label === "concept1" && p.file);
    const baseline = record.posters.find((p) => p.label === "baseline" && p.file);
    if (fresh && baseline) {
      const newIsA = Math.random() < 0.5;
      const load = (p: PosterRecord) => {
        const buf = readFileSync(join(dir, p.file));
        return { buf, mime: detectImageMimeType(buf) };
      };
      record.pairwise = await judgePair({
        a: load(newIsA ? fresh : baseline),
        b: load(newIsA ? baseline : fresh),
        brief: `${c.brandName} — ${c.product.name}. ${c.userInstruction} Objective: ${strategy.objective}.`,
      })
        .then((p) => ({
          ...p,
          newWasLabel: (newIsA ? "A" : "B") as "A" | "B",
          newWon: p.winner === "tie" ? null : p.winner === (newIsA ? "A" : "B"),
        }))
        .catch((e) => ({ error: String(e?.message || e) }));
    }
    record.ok = true;
  } catch (e: any) {
    record.error = String(e?.message || e);
    log(`FAILED: ${record.error}`);
  }
  writeFileSync(join(dir, "result.json"), JSON.stringify(record, null, 2));
  return record;
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const cases = EVAL_CASES.filter((c) => !ONLY.length || ONLY.includes(c.id));
  console.log(`Running ${cases.length} case(s); judge = ${JUDGE_MODEL}`);
  const results: CaseRecord[] = [];
  const queue = [...cases];
  await Promise.all(
    Array.from({ length: CASE_CONCURRENCY }, async () => {
      while (queue.length) {
        const c = queue.shift()!;
        results.push(await runCase(c));
      }
    })
  );
  writeFileSync(
    join(OUT, "summary.json"),
    JSON.stringify({ judgeModel: JUDGE_MODEL, ranAt: new Date().toISOString(), results }, null, 2)
  );
  console.log("done");
  process.exit(0);
}

void main();
