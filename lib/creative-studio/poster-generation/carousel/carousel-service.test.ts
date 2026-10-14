/**
 * Carousel service tests: generation, credits/idempotency, concurrency & leases,
 * QC + recovery, slide iteration, export, security + API handlers.
 * Mocked provider/storage/QC; real session service, transitions and in-memory repo.
 * Run: node --import tsx lib/creative-studio/poster-generation/carousel/carousel-service.test.ts
 */

import type { NextApiRequest, NextApiResponse } from "next";
import {
  createCarouselExportHandler,
  createCarouselGenerateHandler,
  createCarouselGetHandler,
  createCarouselIterateHandler,
  createCarouselPlanHandler,
  createCarouselSlideImageHandler,
} from "./api";
import { serializeCarouselCampaign } from "./serialize";
import { claimSlide } from "./transitions";
import { readStoredZip } from "./zip";
import {
  assert,
  expectReject,
  makeHarness,
  makePlanRaw,
  makeStrategy,
  MockCarouselProvider,
  OTHER_USER,
  passingQc,
  ScriptedGenerator,
  SESSION_ID,
  tinyPng,
  USER,
} from "./test-fixtures";

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

let passed = 0;
async function test(name: string, fn: () => Promise<void> | void) {
  try {
    await fn();
  } catch (e) {
    console.error(`  ✗ ${name}`);
    throw e;
  }
  passed += 1;
  console.log(`  ✓ ${name}`);
}

function ledgerFor(h: Awaited<ReturnType<typeof makeHarness>>) {
  return h.repo.wallet.ledger.filter((l) => l.userId === USER);
}

async function planAndGenerate(n: number, opts: Parameters<typeof makeHarness>[0] = {}) {
  const h = await makeHarness({ slideCountForPlan: n, ...opts });
  const { data } = await h.service.plan({ sessionId: SESSION_ID, userId: USER, slideCount: n });
  return { h, campaignId: data.campaign.id };
}

// ── Minimal Next API req/res doubles ───────────────────────────────────

type MockRes = NextApiResponse & { statusCode: number; body: any; headers: Record<string, string> };
function mockRes(): MockRes {
  const res: any = { statusCode: 200, body: undefined, headers: {} };
  res.status = (c: number) => ((res.statusCode = c), res);
  res.json = (b: unknown) => ((res.body = b), res);
  res.send = (b: unknown) => ((res.body = b), res);
  res.setHeader = (k: string, v: string) => ((res.headers[k.toLowerCase()] = v), res);
  return res;
}
function mockReq(method: string, body: unknown = {}, query: Record<string, string> = {}): NextApiRequest {
  return { method, body, query, headers: {} } as unknown as NextApiRequest;
}

async function run() {
  console.log("carousel service");

  // ── Planning via service ──────────────────────────────────────────────
  await test("plan persists campaign; same params reuse; regenerate replans same id before generation", async () => {
    const gen = new ScriptedGenerator([makePlanRaw(3)]);
    const h = await makeHarness({ generator: gen });
    const a = await h.service.plan({ sessionId: SESSION_ID, userId: USER, slideCount: 3 });
    assert(!a.reused && a.data.slides.length === 3, "created");
    assert(a.data.campaign.status === "ready", "ready");
    assert(h.repo.balanceOf(USER) === 20, "planning costs 0 credits");
    const b = await h.service.plan({ sessionId: SESSION_ID, userId: USER, slideCount: 3 });
    assert(b.reused && b.data.campaign.id === a.data.campaign.id, "reused");
    assert(gen.calls.length === 1, "no extra LLM call on reuse");
    const c = await h.service.plan({ sessionId: SESSION_ID, userId: USER, slideCount: 3, force: true });
    assert(!c.reused && c.data.campaign.id === a.data.campaign.id, "regenerate replaces plan in place");
    assert(c.data.campaign.version > a.data.campaign.version, "version bumped");
  });

  await test("plan with unknown or stale concept is rejected", async () => {
    const h = await makeHarness();
    await expectReject(() => h.service.plan({ sessionId: SESSION_ID, userId: USER, slideCount: 3, conceptId: "concept_nope" }), "MISSING_CONCEPT", "unknown concept");
    await h.sessions.updateStrategy(SESSION_ID, USER, makeStrategy({ id: "strat_2" }));
    // A new strategy invalidates the session's concepts, so the old direction is gone.
    await expectReject(() => h.service.plan({ sessionId: SESSION_ID, userId: USER, slideCount: 3, conceptId: "concept_1" }), "MISSING_CONCEPT", "concept from old strategy");
  });

  // ── Generation + credits ──────────────────────────────────────────────
  await test("generates every slide once, charges 1 credit per successful slide, runs QC per slide", async () => {
    const { h, campaignId } = await planAndGenerate(3);
    const r = await h.service.generate({ campaignId, userId: USER });
    assert(r.creditsCharged === 3 && h.repo.balanceOf(USER) === 17, "3 credits");
    assert(h.provider.calls.length === 3, "3 provider calls");
    assert(h.qcCalls.length === 3, "QC per slide");
    assert(r.data.campaign.status === "completed", `completed (got ${r.data.campaign.status})`);
    assert(r.data.slides.every((s) => s.status === "ready" && s.asset?.creditsConsumed === 1 && s.creditsCharged === 1), "slides ready+charged");
    assert(new Set(r.data.slides.map((s) => s.generationId)).size === 3, "distinct generation ids");
    assert(new Set(h.provider.calls.map((c) => c.prompt)).size === 3, "distinct prompts per slide");
    const ledger = ledgerFor(h);
    assert(ledger.length === 3 && ledger.every((l) => l.metadata.campaignId === campaignId && l.metadata.generationId), "ledger reconciles to slides");
    const ids = new Set(r.data.slides.map((s) => s.generationId));
    assert(ledger.every((l) => ids.has(l.metadata.generationId as string)), "every charge maps to a persisted asset");
    assert(r.data.campaign.campaignChecks.some((c) => c.code === "assets_present" && c.status === "pass"), "post-generation campaign checks");
  });

  await test("replaying generate after completion makes no provider calls and charges nothing", async () => {
    const { h, campaignId } = await planAndGenerate(3);
    await h.service.generate({ campaignId, userId: USER });
    const again = await h.service.generate({ campaignId, userId: USER });
    assert(again.creditsCharged === 0 && h.provider.calls.length === 3, "idempotent replay");
    assert(h.repo.balanceOf(USER) === 17, "no double charge");
  });

  await test("10-slide carousel (mocked) generates in order with 10 credits", async () => {
    const { h, campaignId } = await planAndGenerate(10);
    const r = await h.service.generate({ campaignId, userId: USER });
    assert(r.creditsCharged === 10 && r.data.slides.length === 10, "10 slides, 10 credits");
    assert(r.data.slides.every((s, i) => s.index === i), "order");
  });

  await test("insufficient balance is rejected before any provider call", async () => {
    const { h, campaignId } = await planAndGenerate(3, { balance: 2 });
    await expectReject(() => h.service.generate({ campaignId, userId: USER }), "INSUFFICIENT_CREDITS", "pre-check");
    assert(h.provider.calls.length === 0, "no provider calls");
    assert(h.repo.balanceOf(USER) === 2, "balance untouched");
  });

  await test("provider unavailable → PROVIDER_UNAVAILABLE, no calls, no charge", async () => {
    const { h, campaignId } = await planAndGenerate(2);
    h.provider.available = false;
    await expectReject(() => h.service.generate({ campaignId, userId: USER }), "PROVIDER_UNAVAILABLE", "availability");
    assert(h.provider.calls.length === 0, "no calls");
  });

  await test("partial failure: failed slide costs 0, campaign partial, retry succeeds and keeps history", async () => {
    const png = await tinyPng();
    let failSlide2 = true;
    const provider = new MockCarouselProvider(png, (_n, req) =>
      failSlide2 && /SLIDE 2 OF 3/.test(req.prompt) ? "fail" : "ok"
    );
    const { h, campaignId } = await planAndGenerate(3, { provider });
    const r = await h.service.generate({ campaignId, userId: USER });
    assert(r.creditsCharged === 2, "only successes charged");
    const s2 = r.data.slides[1];
    assert(s2.status === "failed" && s2.asset?.status === "failed" && s2.asset.creditsConsumed === 0, "slide 2 failed, 0 credits");
    assert(s2.error?.retryable === true, "retryable");
    assert(r.data.campaign.status === "partial", "partial campaign");
    assert(r.remainingSlides === 0, "failed slides are not auto-regenerated by resume");
    const callsBefore = h.provider.calls.length;
    await h.service.generate({ campaignId, userId: USER });
    assert(h.provider.calls.length === callsBefore, "no automatic regeneration loop");

    failSlide2 = false;
    const retry = await h.service.retrySlide({ campaignId, slideId: s2.slideId, userId: USER, requestId: "retry-abc-123" });
    assert(retry.creditsCharged === 1 && retry.slide.status === "ready", "retry charged once");
    assert(retry.slide.history.some((v) => v.status === "failed"), "failed attempt kept in history");
    assert(retry.data.campaign.status === "completed", "campaign completes");
    const replay = await h.service.retrySlide({ campaignId, slideId: s2.slideId, userId: USER, requestId: "retry-abc-123" });
    assert(replay.replayed && replay.creditsCharged === 0, "retry replay is idempotent");
    assert(h.repo.balanceOf(USER) === 17, "total 3 credits");
  });

  await test("rate-limited provider is not retried in a tight loop", async () => {
    const png = await tinyPng();
    const provider = new MockCarouselProvider(png, () => "rate_limited");
    const { h, campaignId } = await planAndGenerate(2, { provider });
    const r = await h.service.generate({ campaignId, userId: USER });
    assert(h.provider.calls.length === 2, "one call per slide");
    assert(r.data.slides.every((s) => s.error?.code === "RATE_LIMITED"), "rate limited recorded");
    assert(r.data.campaign.status === "failed" && r.creditsCharged === 0, "failed, 0 credits");
  });

  await test("wallet drained mid-run → slide unbilled (not free, not exported); settle charges without regenerating", async () => {
    const { h, campaignId } = await planAndGenerate(3, { balance: 3 });
    // A concurrent spend elsewhere after the pre-check
    const origGenerate = h.provider.generate.bind(h.provider);
    let drained = false;
    h.provider.generate = async (req) => {
      if (!drained) {
        drained = true;
        h.repo.wallet.balances.set(USER, 1);
      }
      return origGenerate(req);
    };
    const r = await h.service.generate({ campaignId, userId: USER });
    const unbilled = r.data.slides.filter((s) => s.status === "unbilled");
    assert(r.creditsCharged === 1 && unbilled.length === 2, "1 charged, 2 unbilled");
    assert(unbilled.every((s) => s.asset?.creditsConsumed === 0), "unbilled assets not counted");
    assert(r.data.campaign.status === "partial", "partial");
    await expectReject(() => h.service.retrySlide({ campaignId, slideId: unbilled[0].slideId, userId: USER }), "INSUFFICIENT_CREDITS", "settle requires credits");
    const exp = await h.service.export({ campaignId, userId: USER });
    assert(exp.manifest.includedCount === 1 && !exp.manifest.complete, "unbilled excluded from export");
    h.repo.wallet.balances.set(USER, 5);
    const calls = h.provider.calls.length;
    const settled = await h.service.retrySlide({ campaignId, slideId: unbilled[0].slideId, userId: USER });
    assert(settled.creditsCharged === 1 && settled.slide.status === "ready", "settled");
    assert(h.provider.calls.length === calls, "settle makes no provider call");
    assert(h.repo.balanceOf(USER) === 4, "charged exactly once");
  });

  // ── Concurrency, leases, resume ───────────────────────────────────────
  await test("concurrent generate requests never double-generate or double-charge", async () => {
    const png = await tinyPng();
    const provider = new MockCarouselProvider(png, () => ({ delayMs: 15 }));
    const { h, campaignId } = await planAndGenerate(4, { provider });
    const [a, b, c] = await Promise.all([
      h.service.generate({ campaignId, userId: USER }),
      h.service.generate({ campaignId, userId: USER }),
      h.service.generate({ campaignId, userId: USER }),
    ]);
    assert(a.creditsCharged + b.creditsCharged + c.creditsCharged === 4, "4 credits total");
    assert(h.provider.calls.length === 4, "4 provider calls total");
    assert(h.repo.balanceOf(USER) === 16, "balance");
  });

  await test("provider concurrency is bounded", async () => {
    const png = await tinyPng();
    const provider = new MockCarouselProvider(png, () => ({ delayMs: 10 }));
    const { h, campaignId } = await planAndGenerate(6, { provider, deps: { concurrency: 2 } });
    await h.service.generate({ campaignId, userId: USER });
    assert(provider.maxInFlight <= 2 && provider.maxInFlight >= 1, `max in flight ${provider.maxInFlight}`);
  });

  await test("time budget stops new work; next request resumes without duplication", async () => {
    const { h, campaignId } = await planAndGenerate(3, { deps: { timeBudgetMs: -1 } });
    const first = await h.service.generate({ campaignId, userId: USER });
    assert(first.attemptedSlides === 0 && first.remainingSlides === 3, "nothing started");
    assert(first.data.campaign.status === "generating", "campaign marked generating");
    const { PosterCarouselService } = await import("./service");
    const resumed = new PosterCarouselService({ ...(h.service as any).deps, timeBudgetMs: 200_000 });
    const second = await resumed.generate({ campaignId, userId: USER });
    assert(second.creditsCharged === 3 && second.remainingSlides === 0, "resumed and completed");
  });

  await test("expired lease from a crashed request is reclaimed; live lease is respected", async () => {
    const { h, campaignId } = await planAndGenerate(2);
    const data = await h.service.get(campaignId, USER);
    const s0 = data.slides[0];
    const spec = { id: "spec_x", generationId: "gen_crashed" } as any;
    await h.repo.mutateSlide({
      campaignId,
      slideId: s0.slideId,
      userId: USER,
      mutate: (s) => ({ next: claimSlide(s, { allowedStatuses: ["planned"], kind: "generate", token: "dead", leaseMs: 1000, generationId: "gen_crashed", specification: spec, nowMs: Date.now() - 60_000 })! }),
    });
    const s1 = data.slides[1];
    await h.repo.mutateSlide({
      campaignId,
      slideId: s1.slideId,
      userId: USER,
      mutate: (s) => ({ next: claimSlide(s, { allowedStatuses: ["planned"], kind: "generate", token: "alive", leaseMs: 600_000, generationId: "gen_live", specification: spec, nowMs: Date.now() })! }),
    });
    const r = await h.service.generate({ campaignId, userId: USER });
    assert(r.data.slides[0].status === "ready", "expired lease reclaimed");
    assert(r.data.slides[1].status === "generating" && r.inFlightSlides === 1, "live lease untouched");
    assert(r.creditsCharged === 1, "charged only for generated slide");
    assert(r.data.campaign.status === "generating", "campaign still generating");
  });

  await test("lease lost before commit → no charge (stale worker cannot overwrite)", async () => {
    const png = await tinyPng();
    let hRef: Awaited<ReturnType<typeof makeHarness>> | null = null;
    let campaignRef = "";
    const provider = new MockCarouselProvider(png, () => "ok");
    const orig = provider.generate.bind(provider);
    provider.generate = async (req) => {
      const res = await orig(req);
      // Another worker steals the lease while this one is in flight.
      const data = await hRef!.repo.findCampaign(campaignRef, USER);
      const slide = data!.slides.find((s) => s.status === "generating" && s.lease?.token !== "thief")!;
      await hRef!.repo.mutateSlide({
        campaignId: campaignRef,
        slideId: slide.slideId,
        userId: USER,
        mutate: (s) => ({ next: { ...s, lease: { ...s.lease!, token: "thief" } } }),
      });
      return res;
    };
    const { h, campaignId } = await planAndGenerate(2, { provider, deps: { concurrency: 1 } });
    hRef = h;
    campaignRef = campaignId;
    const r = await h.service.generate({ campaignId, userId: USER });
    assert(r.creditsCharged === 0 && ledgerFor(h).length === 0, "no charge without owning the lease");
  });

  await test("database failure during charged commit → no charge, slide recorded as failed", async () => {
    const { h, campaignId } = await planAndGenerate(2, { deps: { concurrency: 1 } });
    h.repo.failNextChargedCommit = true;
    const r = await h.service.generate({ campaignId, userId: USER });
    assert(r.creditsCharged === 1, "only the second slide charged");
    assert(r.data.slides[0].status === "failed" && r.data.slides[0].error?.code === "INTERNAL", "first slide failed, retryable");
    assert(ledgerFor(h).length === 1, "ledger matches persisted assets");
  });

  await test("storage failure → slide failed, 0 credits (never a charged image we cannot serve)", async () => {
    const { h, campaignId } = await planAndGenerate(2, { failStorage: () => true });
    const r = await h.service.generate({ campaignId, userId: USER });
    assert(r.creditsCharged === 0 && r.data.slides.every((s) => s.error?.code === "STORAGE_FAILED"), "storage failure");
  });

  await test("stale strategy after planning blocks generation before provider calls", async () => {
    const { h, campaignId } = await planAndGenerate(2);
    await h.sessions.updateStrategy(SESSION_ID, USER, makeStrategy({ id: "strat_2" }));
    await expectReject(() => h.service.generate({ campaignId, userId: USER }), "STALE_STRATEGY", "stale");
    assert(h.provider.calls.length === 0, "no calls");
  });

  // ── QC ────────────────────────────────────────────────────────────────
  await test("QC failure → needs_review (still a delivered, charged image); QC error → QC_INCOMPLETE; no auto-regeneration", async () => {
    let n = 0;
    const { h, campaignId } = await planAndGenerate(3, {
      qc: async (input) => {
        n += 1;
        if (n === 2) return passingQc(input, false);
        if (n === 3) throw new Error("vision model timeout");
        return passingQc(input);
      },
      deps: { concurrency: 1 },
    });
    const r = await h.service.generate({ campaignId, userId: USER });
    const statuses = r.data.slides.map((s) => s.status);
    assert(statuses[0] === "ready" && statuses[1] === "needs_review" && statuses[2] === "needs_review", `statuses ${statuses}`);
    assert(r.data.slides[2].error?.code === "QC_INCOMPLETE", "QC incomplete flagged");
    assert(h.provider.calls.length === 3, "QC never triggers regeneration");
    assert(r.creditsCharged === 3, "charged for delivered images");
    assert(r.data.campaign.status === "completed", "campaign completed with review flags");
    assert(r.data.campaign.campaignChecks.find((c) => c.code === "slide_qc")?.status !== "pass", "campaign-level QC warning");
    const pub = serializeCarouselCampaign(r.data);
    assert(pub.slides[1].qc?.issues[0]?.message === "Product label is distorted", "QC issues exposed for expansion");
  });

  await test("QC input uses the slide's own concept/DNA/spec and slide-scoped strategy", async () => {
    const { h, campaignId } = await planAndGenerate(2);
    const r = await h.service.generate({ campaignId, userId: USER });
    for (const input of h.qcCalls) {
      const slide = r.data.slides.find((s) => s.generationId === input.asset.generationId)!;
      assert(input.concept.id === slide.concept.id && input.dna.id === slide.dna.id, "slide concept/dna");
      assert(input.specification.id === slide.specification!.id, "slide spec");
      assert(input.productReferenceUrls.includes("https://cdn.example.com/oats.png"), "product refs");
    }
  });

  await test("slide committed but QC never ran (crash) → resume runs QC only, no provider call or charge", async () => {
    // Request A: commits slide 1 then its QC never returns (simulated crash).
    const { h, campaignId } = await planAndGenerate(2, {
      deps: { concurrency: 1, runQc: () => new Promise(() => {}) },
    });
    void h.service.generate({ campaignId, userId: USER });
    for (let i = 0; i < 100; i++) {
      const d = await h.repo.findCampaign(campaignId, USER);
      if (d!.slides[0].status === "qc_pending") break;
      await new Promise((r) => setTimeout(r, 5));
    }
    const mid = await h.repo.findCampaign(campaignId, USER);
    assert(mid!.slides[0].status === "qc_pending" && mid!.slides[1].status === "planned", "slide 1 committed, QC pending");
    assert(h.repo.balanceOf(USER) === 19, "slide 1 charged at commit");

    // Request B (fresh instance): QC recovery + remaining slide only.
    const { PosterCarouselService } = await import("./service");
    const b = new PosterCarouselService({ ...(h.service as any).deps, runQc: async (input: any) => passingQc(input) });
    const r = await b.generate({ campaignId, userId: USER });
    assert(r.data.slides[0].status === "ready", "QC recovered");
    assert(h.provider.calls.length === 2, "slide 1 not regenerated");
    assert(r.creditsCharged === 1 && h.repo.balanceOf(USER) === 18, "no charge for QC recovery");
  });

  // ── Slide iteration (Phase 8 engine) ──────────────────────────────────
  await test("iterate a slide: new immutable version with lineage, 1 credit, replay-safe", async () => {
    const { h, campaignId } = await planAndGenerate(3);
    const r = await h.service.generate({ campaignId, userId: USER });
    const target = r.data.slides[1];
    const parentGen = target.generationId!;
    const it = await h.service.iterateSlide({ campaignId, slideId: target.slideId, userId: USER, request: "make the background darker", requestId: "iter-req-0001" });
    assert(it.creditsCharged === 1 && !it.replayed, "charged once");
    assert(it.slide.versionNumber === 2, "version 2");
    assert(it.slide.asset?.parentGenerationId === parentGen, "parent lineage");
    assert(it.slide.asset?.iterationId === "iter_iter-req-0001", "iteration id");
    assert(it.slide.history.some((v) => v.generationId === parentGen && v.asset?.status === "generated"), "parent version preserved");
    assert(it.slide.iteration?.status === "completed", "iteration completed");
    const lastReq = h.provider.calls[h.provider.calls.length - 1];
    assert(JSON.stringify(lastReq).includes(target.asset!.imageUrl), "parent image passed as base reference");
    const others = it.data.slides.filter((s) => s.slideId !== target.slideId);
    assert(others.every((s) => s.versionNumber === 1), "other slides untouched");
    const replay = await h.service.iterateSlide({ campaignId, slideId: target.slideId, userId: USER, request: "make the background darker", requestId: "iter-req-0001" });
    assert(replay.replayed && replay.creditsCharged === 0, "replay is free");
    assert(h.repo.balanceOf(USER) === 16, "3 + 1 credits total");
  });

  await test("iteration provider failure keeps the previous version and charges 0", async () => {
    const png = await tinyPng();
    let fail = false;
    const provider = new MockCarouselProvider(png, () => (fail ? "fail" : "ok"));
    const { h, campaignId } = await planAndGenerate(2, { provider });
    const r = await h.service.generate({ campaignId, userId: USER });
    const target = r.data.slides[0];
    fail = true;
    const it = await h.service.iterateSlide({ campaignId, slideId: target.slideId, userId: USER, request: "make the product bigger" });
    assert(it.creditsCharged === 0, "0 credits");
    assert(it.slide.status === "ready" && it.slide.generationId === target.generationId, "previous version still current");
    assert(it.slide.history.some((v) => v.status === "failed"), "failed attempt recorded");
    assert(it.slide.error?.code === "PROVIDER_FAILED", "error surfaced");
  });

  await test("iteration copy edits cannot introduce unsupported claims; failed slides are not editable", async () => {
    const png = await tinyPng();
    const provider = new MockCarouselProvider(png, (_n, req) => (/SLIDE 2 OF 2/.test(req.prompt) ? "fail" : "ok"));
    const { h, campaignId } = await planAndGenerate(2, { provider });
    const r = await h.service.generate({ campaignId, userId: USER });
    const calls = h.provider.calls.length;
    await expectReject(
      () => h.service.iterateSlide({ campaignId, slideId: r.data.slides[0].slideId, userId: USER, request: 'change the headline to "Clinically proven 90% results"' }),
      "VALIDATION",
      "unsupported claim rejected"
    );
    assert(h.provider.calls.length === calls, "no provider call");
    await expectReject(() => h.service.iterateSlide({ campaignId, slideId: r.data.slides[1].slideId, userId: USER, request: "make it brighter" }), "NOT_ELIGIBLE", "failed slide");
  });

  // ── Export ────────────────────────────────────────────────────────────
  await test("complete export: ordered PNGs + manifest, deterministic names", async () => {
    const { h, campaignId } = await planAndGenerate(3);
    await h.service.generate({ campaignId, userId: USER });
    const exp = await h.service.export({ campaignId, userId: USER });
    const entries = readStoredZip(exp.zip);
    const names = entries.map((e) => e.name);
    assert(names.length === 4 && names[3] === "manifest.json", `entries ${names}`);
    assert(names.slice(0, 3).every((n, i) => n.startsWith(String(i + 1).padStart(2, "0") + "-") && n.endsWith(".png")), "ordered names");
    assert(entries.slice(0, 3).every((e) => e.data.subarray(0, 4).equals(PNG_MAGIC)), "real PNGs");
    const manifest = JSON.parse(entries[3].data.toString());
    assert(manifest.complete === true && manifest.partial === false && manifest.includedCount === 3, "complete manifest");
    assert(!/storage\.test|storagePath|prompt/i.test(entries[3].data.toString()), "manifest has no URLs or prompts");
    assert(!exp.fileName.includes("partial"), "complete filename");
    const camp = await h.service.get(campaignId, USER);
    assert(camp.campaign.lastExport?.complete === true, "export recorded");
  });

  await test("partial export is clearly marked; empty export rejected", async () => {
    const png = await tinyPng();
    const provider = new MockCarouselProvider(png, (_n, req) => (/SLIDE 1 OF 3/.test(req.prompt) ? "fail" : "ok"));
    const { h, campaignId } = await planAndGenerate(3, { provider });
    await h.service.generate({ campaignId, userId: USER });
    const exp = await h.service.export({ campaignId, userId: USER });
    assert(exp.fileName.includes("partial-2-of-3"), `partial filename ${exp.fileName}`);
    assert(exp.manifest.partial && exp.manifest.missingSlideNumbers.join() === "1", "missing slide listed");
    assert(exp.manifest.slides[0].missingReason === "generation failed", "missing reason");

    const empty = await planAndGenerate(2, { provider: new MockCarouselProvider(png, () => "fail") });
    await empty.h.service.generate({ campaignId: empty.campaignId, userId: USER });
    await expectReject(() => empty.h.service.export({ campaignId: empty.campaignId, userId: USER }), "EXPORT_EMPTY", "empty export");
  });

  // ── Security ──────────────────────────────────────────────────────────
  await test("another user cannot read, generate, retry, iterate, export or download", async () => {
    const { h, campaignId } = await planAndGenerate(2);
    const r = await h.service.generate({ campaignId, userId: USER });
    const slideId = r.data.slides[0].slideId;
    await expectReject(() => h.service.get(campaignId, OTHER_USER), "NOT_FOUND", "get");
    await expectReject(() => h.service.generate({ campaignId, userId: OTHER_USER }), "NOT_FOUND", "generate");
    await expectReject(() => h.service.retrySlide({ campaignId, slideId, userId: OTHER_USER }), "NOT_FOUND", "retry");
    await expectReject(() => h.service.iterateSlide({ campaignId, slideId, userId: OTHER_USER, request: "darker" }), "NOT_FOUND", "iterate");
    await expectReject(() => h.service.export({ campaignId, userId: OTHER_USER }), "NOT_FOUND", "export");
    await expectReject(() => h.service.loadSlideImage({ campaignId, slideId, userId: OTHER_USER }), "NOT_FOUND", "image");
    assert(h.repo.balanceOf(OTHER_USER) === 20, "other user never charged");
    await expectReject(() => h.service.plan({ sessionId: SESSION_ID, userId: OTHER_USER, slideCount: 2 }), "NOT_FOUND", "plan on someone else's session");
  });

  await test("public payload exposes no prompts, specs, URLs, storage paths, leases, user ids or raw provider errors", async () => {
    const png = await tinyPng();
    const provider = new MockCarouselProvider(png, (_n, req) => (/SLIDE 2 OF 3/.test(req.prompt) ? "throw" : /SLIDE 3 OF 3/.test(req.prompt) ? "fail" : "ok"));
    const { h, campaignId } = await planAndGenerate(3, { provider });
    const r = await h.service.generate({ campaignId, userId: USER });
    const prev = process.env.NODE_ENV;
    (process.env as any).NODE_ENV = "production";
    const json = JSON.stringify(serializeCarouselCampaign(r.data));
    (process.env as any).NODE_ENV = prev;
    for (const banned of ["storage.test", '"storagePath"', '"compiledPrompt"', '"specification"', '"lease"', '"imageUrl"', '"userId"', USER, "sk-test", "project-xyz", "mock-model", "outputRequirements"]) {
      assert(!json.includes(banned), `payload leaks ${banned}`);
    }
    assert(json.includes('"hasImage":true'), "image availability exposed as a flag");
  });

  await test("API: method, auth, artifact rejection, slide-count validation, ownership, sanitized output", async () => {
    const { h, campaignId } = await planAndGenerate(2);
    const deps = (uid: string | null) => ({ getUserId: async () => uid, service: () => h.service });

    let res = mockRes();
    await createCarouselPlanHandler(deps(USER))(mockReq("GET"), res);
    assert(res.statusCode === 405, "405");
    res = mockRes();
    await createCarouselPlanHandler(deps(null))(mockReq("POST", { sessionId: SESSION_ID, slideCount: 2 }), res);
    assert(res.statusCode === 401, "401");
    for (const field of ["strategy", "story", "slides", "dna", "concept", "creditsCharged", "userId", "product"]) {
      res = mockRes();
      await createCarouselPlanHandler(deps(USER))(mockReq("POST", { sessionId: SESSION_ID, slideCount: 2, [field]: { x: 1 } }), res);
      assert(res.statusCode === 400, `rejects browser ${field}`);
    }
    for (const bad of [1, 11, "3", 2.5]) {
      res = mockRes();
      await createCarouselPlanHandler(deps(USER))(mockReq("POST", { sessionId: SESSION_ID, slideCount: bad }), res);
      assert(res.statusCode === 400, `rejects slideCount ${bad}`);
    }
    res = mockRes();
    await createCarouselPlanHandler(deps(USER))(mockReq("POST", { sessionId: SESSION_ID, slideCount: 2 }), res);
    assert(res.statusCode === 200 && res.body.campaign.slides.length === 2 && res.body.creditsCharged === 0, "plan ok");

    res = mockRes();
    await createCarouselGenerateHandler(deps(USER))(mockReq("POST", { campaignId }), res);
    assert(res.statusCode === 200 && res.body.done === true && res.body.creditsCharged === 2, "generate ok");

    res = mockRes();
    await createCarouselGetHandler(deps(OTHER_USER))(mockReq("GET", {}, { id: campaignId }), res);
    assert(res.statusCode === 404, "other user 404");

    const slideId = res.body && (await h.service.get(campaignId, USER)).slides[0].slideId;
    res = mockRes();
    await createCarouselSlideImageHandler(deps(USER))(mockReq("GET", {}, { id: campaignId, slideId, download: "1" }), res);
    assert(res.statusCode === 200 && res.headers["content-type"] === "image/png", "image route");
    assert(res.headers["content-disposition"].startsWith("attachment;"), "download disposition");
    assert(Buffer.isBuffer(res.body) && res.body.subarray(0, 4).equals(PNG_MAGIC), "png bytes");

    res = mockRes();
    await createCarouselExportHandler(deps(USER))(mockReq("GET", {}, { id: campaignId }), res);
    assert(res.statusCode === 200 && res.headers["content-type"] === "application/zip", "zip route");
    assert(res.headers["x-carousel-complete"] === "true", "complete header");

    res = mockRes();
    await createCarouselIterateHandler(deps(USER))(mockReq("POST", { request: "darker", requestId: "x" }, { id: campaignId, slideId }), res);
    assert(res.statusCode === 400, "bad idempotency key rejected");

    res = mockRes();
    await createCarouselGetHandler(deps(USER))(mockReq("GET", {}, { id: "../../etc" }), res);
    assert(res.statusCode === 400, "path-like id rejected");
  });

  console.log(`\n${passed} carousel service tests passed`);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
