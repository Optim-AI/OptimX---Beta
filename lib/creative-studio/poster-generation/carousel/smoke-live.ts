/**
 * Carousel LIVE smoke — real Gemini story planner, real Nano Banana provider,
 * real campaign-assets storage, real Poster QC. Credits use a local wallet
 * (same atomic commit+charge path as production; no real user balance).
 *
 * Default 2 slides (2 image generations). Larger runs need CAROUSEL_SMOKE_ALLOW_LARGE=1.
 * Run: node --env-file=.env.local --import tsx lib/creative-studio/poster-generation/carousel/smoke-live.ts
 */

import { randomUUID } from "crypto";
import fs from "fs";
import { createNanoBananaImageProvider } from "../generation/nano-banana-provider";
import { storePosterGeneratedImage } from "../generation/storage";
import { PosterGenerationSessionService } from "../session";
import { defaultSlideImageLoader } from "./export";
import { InMemoryCarouselRepository } from "./repository";
import { serializeCarouselCampaign } from "./serialize";
import { PosterCarouselService } from "./service";
import { runPosterQc } from "../qc/qc-engine";
import { readStoredZip } from "./zip";
import { makeBrief, makeConcept, makeDna, makeStrategy } from "./test-fixtures";

const PRODUCT_URL = "https://placehold.co/600x800/png?text=Protein+Oats";

async function main() {
  const slideCount = Number(process.env.CAROUSEL_SMOKE_SLIDES || 2);
  if (slideCount > 3 && process.env.CAROUSEL_SMOKE_ALLOW_LARGE !== "1") {
    throw new Error("Refusing >3 live slides without CAROUSEL_SMOKE_ALLOW_LARGE=1");
  }
  const userId = randomUUID();
  const sessionId = randomUUID();

  const sessionStore = new Map<string, any>();
  const sessions = new PosterGenerationSessionService({
    async insert(s) { sessionStore.set(s.id, structuredClone(s)); return structuredClone(s); },
    async findById(id) { const s = sessionStore.get(id); return s ? structuredClone(s) : null; },
    async findByIdAndUserId(id, uid) { const s = sessionStore.get(id); return s && s.userId === uid ? structuredClone(s) : null; },
    async findByStudioSessionId() { return null; },
    async updateOptimistic(s, v) {
      const cur = sessionStore.get(s.id);
      if (!cur || cur.version !== v) throw new Error("conflict");
      const next = { ...structuredClone(s), version: v + 1, updatedAt: new Date().toISOString() };
      sessionStore.set(s.id, next);
      return structuredClone(next);
    },
  });
  const brief = makeBrief({
    product: { ...makeBrief().product!, images: [{ url: PRODUCT_URL }] },
    productReferences: [{ id: "pref_1", role: "product_packshot", image: { url: PRODUCT_URL } }],
  });
  await sessions.createSession({ userId, id: sessionId });
  await sessions.updateBrief(sessionId, userId, brief);
  await sessions.updateStrategy(sessionId, userId, makeStrategy());
  const concept = makeConcept();
  await sessions.setConcepts(sessionId, userId, [concept], { [concept.id]: makeDna(concept.id) });
  await sessions.selectConcept(sessionId, userId, [concept.id]);

  const repo = new InMemoryCarouselRepository({ [userId]: slideCount });
  const provider = createNanoBananaImageProvider();
  const service = new PosterCarouselService({
    repo,
    sessions,
    provider,
    runQc: (input) => runPosterQc(input),
    storeImage: storePosterGeneratedImage,
    loadImage: defaultSlideImageLoader,
    getBalance: async (u) => repo.balanceOf(u),
    concurrency: 2,
  });

  const t0 = Date.now();
  const { data: planned } = await service.plan({ sessionId, userId, slideCount });
  console.log(`[smoke] planned ${planned.slides.length} slides in ${Date.now() - t0}ms`);
  console.log(`[smoke] narrative: ${planned.campaign.story.narrativeStructure}`);
  for (const s of planned.slides) console.log(`  ${s.index + 1}. ${s.roleLabel} — "${s.copy.headline}"${s.copy.cta ? ` [CTA: ${s.copy.cta}]` : ""}`);

  const t1 = Date.now();
  let result = await service.generate({ campaignId: planned.campaign.id, userId });
  for (let i = 0; i < 5 && result.remainingSlides > 0; i++) {
    result = await service.generate({ campaignId: planned.campaign.id, userId });
  }
  console.log(`[smoke] generation finished in ${Date.now() - t1}ms; campaign=${result.data.campaign.status}`);
  for (const s of result.data.slides) {
    console.log(`  ${s.index + 1}. status=${s.status} credits=${s.creditsCharged} qc=${s.qc ? (s.qc.passed ? "pass" : s.qc.status) : "none"}${s.error ? ` error=${s.error.code}` : ""}`);
  }
  const charged = repo.wallet.ledger.reduce((n, l) => n - l.amount, 0);
  const successes = result.data.slides.filter((s) => s.asset?.status === "generated" && s.asset.creditsConsumed === 1).length;
  console.log(`[smoke] credits charged=${charged} successful slides=${successes} provider=${result.data.slides.find((s) => s.asset)?.asset?.model ?? "n/a"}`);
  if (charged !== successes) throw new Error("credit/asset mismatch");

  const checks = result.data.campaign.campaignChecks.map((c) => `${c.code}:${c.status}`).join(" ");
  console.log(`[smoke] campaign checks: ${checks}`);

  if (successes > 0) {
    const exp = await service.export({ campaignId: planned.campaign.id, userId });
    const out = `/tmp/${exp.fileName}`;
    fs.writeFileSync(out, exp.zip);
    const names = readStoredZip(exp.zip).map((e) => e.name);
    console.log(`[smoke] export ${out} (${exp.zip.length} bytes) entries=${names.join(",")} complete=${exp.manifest.complete}`);
  }
  const pub = JSON.stringify(serializeCarouselCampaign(result.data));
  if (/compiledPrompt|storagePath|"imageUrl"/.test(pub)) throw new Error("public payload leaked internals");
  console.log("[smoke] public payload sanitized: ok");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("[smoke] FAILED:", e?.code || "", e?.message || e);
    process.exit(1);
  });
