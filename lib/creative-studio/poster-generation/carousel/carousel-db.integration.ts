/**
 * Carousel ↔ Postgres integration: real Drizzle repositories, row locks, credit
 * wallet + credit_history, session service. Provider/storage/QC/LLM are mocked
 * (no paid calls). Creates a throwaway auth user and deletes it afterwards.
 *
 * Requires the 20261014160000_poster_carousel_campaigns migration.
 * Run: node --env-file=.env.local --import tsx lib/creative-studio/poster-generation/carousel/carousel-db.integration.ts
 */

import { randomUUID } from "crypto";
import { sql } from "drizzle-orm";
import { db } from "@/database/client";
import { CreditsDAO } from "@/database/models/Credits.dao";
import { PosterGenerationSessionService } from "../session";
import { DrizzlePosterGenerationSessionRepository } from "../session/repository";
import { DrizzleCarouselRepository, CAROUSEL_CREDIT_SOURCE } from "./repository";
import { PosterCarouselService } from "./service";
import {
  assert,
  expectReject,
  makeBrief,
  makeConcept,
  makeDna,
  makePlanRaw,
  makeStrategy,
  MockCarouselProvider,
  passingQc,
  tinyPng,
} from "./test-fixtures";

const userId = randomUUID();
const otherUserId = randomUUID();
const sessionId = randomUUID();

async function rows<T = Record<string, unknown>>(q: ReturnType<typeof sql>): Promise<T[]> {
  const r: any = await db.execute(q);
  return (r.rows ?? r) as T[];
}

async function setBalance(n: number) {
  await db.execute(sql`UPDATE user_credits SET image_credits_subscription = ${n}, image_credits_addon = 0 WHERE id = ${userId}`);
}

async function balance(): Promise<number> {
  const b = await CreditsDAO.getFullBalance(userId);
  return b?.imageCredits.total ?? 0;
}

async function setup() {
  for (const [id, label] of [[userId, "a"], [otherUserId, "b"]] as const) {
    await db.execute(sql`
      INSERT INTO auth.users (id, instance_id, aud, role, email, created_at, updated_at)
      VALUES (${id}, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', ${`carousel-it-${label}-${id.slice(0, 8)}@example.test`}, now(), now())`);
    await db.execute(sql`
      INSERT INTO user_credits (id, credits, image_credits_subscription, image_credits_addon)
      VALUES (${id}, 0, 0, 0)
      ON CONFLICT (id) DO UPDATE SET image_credits_subscription = 0, image_credits_addon = 0`);
  }
}

async function cleanup() {
  await db.execute(sql`DELETE FROM poster_carousel_campaigns WHERE user_id IN (${userId}, ${otherUserId})`);
  await db.execute(sql`DELETE FROM poster_generation_sessions WHERE id = ${sessionId}`);
  await db.execute(sql`DELETE FROM auth.users WHERE id IN (${userId}, ${otherUserId})`);
}

async function run() {
  console.log("carousel DB integration (local Postgres; mocked provider/storage/QC/LLM)");
  await setup();
  try {
    const sessions = new PosterGenerationSessionService(new DrizzlePosterGenerationSessionRepository());
    await sessions.createSession({ userId, id: sessionId });
    await sessions.updateBrief(sessionId, userId, makeBrief());
    await sessions.updateStrategy(sessionId, userId, makeStrategy());
    const concept = makeConcept();
    await sessions.setConcepts(sessionId, userId, [concept], { [concept.id]: makeDna(concept.id) });
    await sessions.selectConcept(sessionId, userId, [concept.id]);

    const png = await tinyPng();
    const provider = new MockCarouselProvider(png, () => ({ delayMs: 20 }));
    const stored = new Map<string, Buffer>();
    const repo = new DrizzleCarouselRepository();
    const service = new PosterCarouselService({
      repo,
      sessions,
      provider,
      generator: {
        modelId: "scripted",
        async generateJson<T>(req: { userPrompt: string }) {
          const n = Number(req.userPrompt.match(/EXACTLY (\d+)/)?.[1] || 3);
          const data = makePlanRaw(n);
          return { data: data as T, model: "scripted", rawText: JSON.stringify(data) };
        },
      },
      runQc: async (input) => passingQc(input),
      storeImage: async ({ userId: u, sessionId: s, generationId, buffer }) => {
        const storagePath = `${u}/poster/${s}/${generationId}.png`;
        stored.set(storagePath, buffer);
        return { publicUrl: `https://storage.test/${storagePath}`, storagePath };
      },
      loadImage: async (asset) => (asset.storagePath ? stored.get(asset.storagePath) ?? null : null),
      getBalance: async (u) => (await CreditsDAO.getFullBalance(u))?.imageCredits.total ?? 0,
      concurrency: 2,
    });

    // 1. Plan persists rows; 0 credits
    const { data: planned } = await service.plan({ sessionId, userId, slideCount: 3 });
    const campaignId = planned.campaign.id;
    const slideRows = await rows<{ id: string; slide_index: number; status: string }>(
      sql`SELECT id, slide_index, status FROM poster_carousel_slides WHERE campaign_id = ${campaignId} ORDER BY slide_index`
    );
    assert(slideRows.length === 3 && slideRows.every((r, i) => r.slide_index === i && r.status === "planned"), "3 planned rows persisted in order");
    console.log("  ✓ plan persisted campaign + 3 ordered slide rows");

    // 2. Insufficient balance rejected before provider
    await setBalance(2);
    await expectReject(() => service.generate({ campaignId, userId }), "INSUFFICIENT_CREDITS", "pre-check");
    const providerCalls = (): number => provider.calls.length;
    assert(providerCalls() === 0, "no provider calls");
    console.log("  ✓ insufficient balance rejected before any provider call");

    // 3. Concurrent generate requests with real row locks + atomic charges
    await setBalance(5);
    const results = await Promise.all([
      service.generate({ campaignId, userId }),
      service.generate({ campaignId, userId }),
      service.generate({ campaignId, userId }),
    ]);
    const charged = results.reduce((n, r) => n + r.creditsCharged, 0);
    assert(providerCalls() === 3, `3 provider calls (got ${providerCalls()})`);
    assert(charged === 3 && (await balance()) === 2, `3 credits charged (got ${charged}, balance ${await balance()})`);
    console.log("  ✓ 3 concurrent generate requests → 3 provider calls, 3 credits (row-locked claims)");

    // 4. Ledger reconciles with persisted assets
    const ledger = await rows<{ metadata: any; source: string }>(
      sql`SELECT metadata, source FROM credit_history WHERE user_id = ${userId} AND source = ${CAROUSEL_CREDIT_SOURCE}`
    );
    const final = await service.get(campaignId, userId);
    const genIds = new Set(final.slides.map((s) => s.generationId));
    assert(ledger.length === 3 && ledger.every((l) => genIds.has(l.metadata?.generationId)), "credit_history rows map to slide generations");
    assert(final.slides.every((s) => s.status === "ready" && s.creditsCharged === 1), "all slides ready, charged once");
    assert(final.campaign.status === "completed", "campaign completed");
    const colCheck = await rows<{ n: number }>(
      sql`SELECT count(*)::int AS n FROM poster_carousel_slides WHERE campaign_id = ${campaignId} AND credits_charged = 1 AND status = 'ready' AND lease_token IS NULL`
    );
    assert(colCheck[0].n === 3, "mirrored columns consistent with JSON");
    console.log("  ✓ credit_history reconciles 1:1 with persisted slide generations");

    // 5. Replay → no charge
    const replay = await service.generate({ campaignId, userId });
    assert(replay.creditsCharged === 0 && providerCalls() === 3 && (await balance()) === 2, "replay is free");
    console.log("  ✓ replayed generate → 0 provider calls, 0 credits");

    // 6. Wallet race: charge at commit fails → unbilled (no free image), settle later
    const { data: p2 } = await service.plan({ sessionId, userId, slideCount: 2, force: true });
    assert(p2.campaign.id !== campaignId, "started campaign kept immutable; new campaign created");
    await setBalance(2);
    const orig = provider.generate.bind(provider);
    let drained = false;
    provider.generate = async (req) => {
      const res = await orig(req);
      if (!drained) {
        drained = true;
        await setBalance(0);
      }
      return res;
    };
    const race = await service.generate({ campaignId: p2.campaign.id, userId });
    provider.generate = orig;
    const unbilled = race.data.slides.filter((s) => s.status === "unbilled");
    assert(race.creditsCharged === 0 && unbilled.length === 2 && (await balance()) === 0, "commit-time charge failure → unbilled, 0 charged");
    await setBalance(1);
    const settled = await service.retrySlide({ campaignId: p2.campaign.id, slideId: unbilled[0].slideId, userId });
    assert(settled.creditsCharged === 1 && settled.slide.status === "ready" && (await balance()) === 0, "settled with exactly 1 credit");
    console.log("  ✓ wallet drained mid-run → unbilled (not free); settle charges exactly once, no regeneration");

    // 7. Ownership
    await expectReject(() => service.get(campaignId, otherUserId), "NOT_FOUND", "other user get");
    await expectReject(() => service.export({ campaignId, userId: otherUserId }), "NOT_FOUND", "other user export");
    console.log("  ✓ other user cannot read or export");

    // 8. DB constraints reject invalid data
    let rejected = false;
    try {
      await db.execute(sql`UPDATE poster_carousel_slides SET status = 'bogus' WHERE campaign_id = ${campaignId}`);
    } catch {
      rejected = true;
    }
    assert(rejected, "status CHECK constraint");
    console.log("  ✓ CHECK constraints enforced");

    // 9. Export from persisted rows
    const exp = await service.export({ campaignId, userId });
    assert(exp.manifest.complete && exp.manifest.includedCount === 3, "complete export");
    console.log("  ✓ export built from persisted rows");

    console.log("\ncarousel DB integration: PASS");
  } finally {
    await cleanup();
  }
}

run()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
