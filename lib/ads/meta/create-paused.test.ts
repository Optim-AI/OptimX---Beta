/**
 * Create-paused orchestrator W2.5.1 — mocked Graph/DAO only.
 * Run: npx --yes tsx lib/ads/meta/create-paused.test.ts
 */
import assert from "assert";
import { decideMetaAdsCreatePausedWriteAccess } from "@/lib/ads/meta/create-paused-gates";
import {
  countPausedNameMatches,
  pickUniquePausedMatch,
  type MetaCreatePausedGraphAdapter,
  type MetaReconcileProbeResult,
} from "@/lib/ads/meta/create-paused-graph";
import {
  runMetaAdsCreatePaused,
  type CreatePausedDeps,
} from "@/lib/ads/meta/create-paused";
import type { MetaAdsDraftRow } from "@/database/models/MetaAdsDraft.dao";
import type { ResolvedMetaAdsWriteContext } from "@/lib/ads/providers/meta/write-context";
import type { MetaAdsAdImageUploadSuccess } from "@/lib/ads/meta/upload-ad-image";
import { leaseExpiresAtFromNow } from "@/lib/ads/meta/create-paused-lease";

const USER = "11111111-1111-4111-8111-111111111111";
const DRAFT_ID = "33333333-3333-4333-8333-333333333333";
const SECRET = "EAACreatePausedOrchestratorToken_abcdefghijklmnopqrstuvwxyz";

function baseDraft(overrides: Partial<MetaAdsDraftRow> = {}): MetaAdsDraftRow {
  return {
    id: DRAFT_ID,
    userId: USER,
    integrationId: "int-1",
    adAccountId: "acct-row-1",
    status: "draft",
    name: "Traffic Launch",
    objective: "OUTCOME_TRAFFIC",
    dailyBudgetMajor: "25",
    currency: "USD",
    scheduleStart: null,
    scheduleEnd: null,
    targeting: { geoCountries: ["US"], ageMin: 18, ageMax: 55 },
    placements: { mode: "automatic" },
    sourceImageId: "22222222-2222-4222-8222-222222222222",
    sourceImageUrl:
      "https://proj.supabase.co/storage/v1/object/public/campaign-assets/a.jpg",
    primaryText: "Primary",
    headline: "Headline",
    destinationUrl: "https://example.com/x",
    callToAction: "LEARN_MORE",
    metaCampaignId: null,
    metaAdsetId: null,
    metaCreativeId: null,
    metaAdId: null,
    idempotencyKey: null,
    createAttemptId: null,
    lastErrorCode: null,
    lastErrorMessage: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdOnMetaAt: null,
    metadata: {},
    ...overrides,
  } as MetaAdsDraftRow;
}

function writeCtx(): ResolvedMetaAdsWriteContext {
  return {
    provider: "meta",
    userId: USER,
    integrationId: "int-1",
    userAccessToken: SECRET,
    accessToken: SECRET,
    pageId: "page_99",
    pageAccessToken: "EAAPageTokenNotForAccountWrites_xxxxxxxxxxxxxxxx",
    adAccountRowId: "acct-row-1",
    accountExternalId: "999",
    actId: "act_999",
    currency: "USD",
    currencyOffset: 100,
    currencyExponent: 2,
  };
}

function gateEnv(extra: Record<string, string> = {}) {
  return {
    META_ADS_CREATE_ENABLED: "true",
    META_ADS_ADIMAGES_CONTRACT_APPROVED: "true",
    META_ADS_CREATE_PAUSED_GRAPH_WRITES: "true",
    ...extra,
  };
}

function mockGraph(opts?: {
  failAt?: "campaign" | "adset" | "image" | "creative" | "ad";
  uncertainAt?: "campaign" | "adset" | "image" | "creative" | "ad";
  probe?: MetaReconcileProbeResult;
}): {
  adapter: MetaCreatePausedGraphAdapter;
  postCounts: Record<string, number>;
  probeCalls: number;
} {
  const postCounts: Record<string, number> = {
    campaign: 0,
    adset: 0,
    image: 0,
    creative: 0,
    ad: 0,
  };
  let probeCalls = 0;

  const maybe = async (step: keyof typeof postCounts, id: string): Promise<any> => {
    postCounts[step] += 1;
    if (opts?.uncertainAt === step) {
      return {
        kind: "uncertain",
        code: "outcome_uncertain",
        message: `${step} timed out`,
        step,
      };
    }
    if (opts?.failAt === step) {
      return {
        kind: "rejected",
        code: "meta_graph_error",
        message: `${step} rejected`,
      };
    }
    if (step === "image") {
      const result: MetaAdsAdImageUploadSuccess = {
        imageHash: "hash_ok",
        uploadFilename: "skalx-file.jpg",
        sourceImageId: "22222222-2222-4222-8222-222222222222",
        actId: "act_999",
        accountExternalId: "999",
        mimeType: "image/jpeg",
        byteLength: 12,
        contentSha256: "a".repeat(64),
      };
      return { kind: "confirmed", result };
    }
    return { kind: "confirmed", id };
  };

  const adapter: MetaCreatePausedGraphAdapter = {
    createCampaign: async () => maybe("campaign", "camp_1"),
    createAdSet: async () => maybe("adset", "adset_1"),
    uploadImage: async () => maybe("image", "n/a"),
    createCreative: async () => maybe("creative", "cr_1"),
    createAd: async () => maybe("ad", "ad_1"),
    reconcileUncertain: async () => {
      probeCalls += 1;
      return (
        opts?.probe ?? {
          acceptedId: null,
          matchCount: 0,
          reason: "auto_accept_disabled",
        }
      );
    },
  };
  return {
    adapter,
    postCounts,
    get probeCalls() {
      return probeCalls;
    },
  };
}

function makeStore(initial: MetaAdsDraftRow) {
  let row: MetaAdsDraftRow | null = { ...initial };
  let claimCount = 0;

  const deps: Partial<CreatePausedDeps> = {
    env: gateEnv(),
    decideWriteAccess: decideMetaAdsCreatePausedWriteAccess,
    findDraft: async () => (row ? { ...row } : null),
    claimDraft: async (_id, _uid, attemptId) => {
      claimCount += 1;
      if (!row) return null;
      if (!["draft", "failed", "partial_failure"].includes(row.status)) {
        return null;
      }
      row = {
        ...row,
        status: "creating",
        createAttemptId: attemptId,
        lastErrorCode: null,
        lastErrorMessage: null,
        updatedAt: new Date().toISOString(),
      };
      return { ...row };
    },
    reclaimStale: async (_id, _uid, prev, next, metadata) => {
      if (!row) return null;
      if (row.status !== "creating") return null;
      if (String(row.createAttemptId || "") !== prev) return null;
      row = {
        ...row,
        status: "creating",
        createAttemptId: next,
        metadata,
        lastErrorCode: null,
        lastErrorMessage: null,
        updatedAt: new Date().toISOString(),
      };
      return { ...row };
    },
    persistProgress: async (_id, _uid, patch) => {
      if (!row) return null;
      if (row.status !== "creating") return null;
      if (String(row.createAttemptId || "") !== patch.createAttemptId) {
        return null;
      }
      row = {
        ...row,
        ...(patch.status !== undefined ? { status: patch.status } : {}),
        createAttemptId: patch.createAttemptId,
        ...(patch.lastErrorCode !== undefined
          ? { lastErrorCode: patch.lastErrorCode }
          : {}),
        ...(patch.lastErrorMessage !== undefined
          ? { lastErrorMessage: patch.lastErrorMessage }
          : {}),
        ...(patch.metaCampaignId !== undefined
          ? { metaCampaignId: patch.metaCampaignId }
          : {}),
        ...(patch.metaAdsetId !== undefined
          ? { metaAdsetId: patch.metaAdsetId }
          : {}),
        ...(patch.metaCreativeId !== undefined
          ? { metaCreativeId: patch.metaCreativeId }
          : {}),
        ...(patch.metaAdId !== undefined ? { metaAdId: patch.metaAdId } : {}),
        ...(patch.createdOnMetaAt !== undefined
          ? { createdOnMetaAt: patch.createdOnMetaAt }
          : {}),
        ...(patch.metadata !== undefined ? { metadata: patch.metadata } : {}),
        updatedAt: new Date().toISOString(),
      };
      return { ...row };
    },
    loadWriteContext: async () => writeCtx(),
  };

  return {
    deps,
    get row() {
      return row;
    },
    set row(v: MetaAdsDraftRow | null) {
      row = v;
    },
    get claimCount() {
      return claimCount;
    },
  };
}

async function main() {
  // Diagnostic match helpers — never sufficient for accept
  {
    assert.deepStrictEqual(
      pickUniquePausedMatch(
        [{ id: "1", name: "A", status: "PAUSED" }],
        { objectName: "A", attemptStartedAt: new Date().toISOString() }
      ),
      { id: "1" }
    );
    assert.strictEqual(
      countPausedNameMatches(
        [
          { id: "1", name: "A", status: "PAUSED" },
          { id: "2", name: "A", status: "PAUSED" },
        ],
        { objectName: "A", attemptStartedAt: new Date().toISOString() }
      ),
      2
    );
  }

  // Happy path
  {
    const store = makeStore(baseDraft());
    const { adapter, postCounts } = mockGraph();
    const result = await runMetaAdsCreatePaused({
      authenticatedUserId: USER,
      draftId: DRAFT_ID,
      deps: { ...store.deps, graph: adapter },
    });
    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.code, "created_paused");
    assert.strictEqual(store.row?.metaCampaignId, "camp_1");
    assert.strictEqual(postCounts.ad, 1);
    assert.ok(!JSON.stringify(result).includes(SECRET));
  }

  // Gate refusal before claim
  {
    const store = makeStore(baseDraft());
    const { adapter, postCounts } = mockGraph();
    const result = await runMetaAdsCreatePaused({
      authenticatedUserId: USER,
      draftId: DRAFT_ID,
      deps: {
        ...store.deps,
        env: gateEnv({ META_ADS_CREATE_PAUSED_GRAPH_WRITES: "false" }),
        graph: adapter,
      },
    });
    assert.strictEqual(result.code, "not_allowed");
    assert.strictEqual(store.claimCount, 0);
    assert.strictEqual(postCounts.campaign, 0);
  }

  // Active lease conflict
  {
    const store = makeStore(
      baseDraft({
        status: "creating",
        createAttemptId: "live-attempt",
        metadata: {
          createPaused: { leaseExpiresAt: leaseExpiresAtFromNow(Date.now()) },
        },
      })
    );
    const { adapter, postCounts } = mockGraph();
    const result = await runMetaAdsCreatePaused({
      authenticatedUserId: USER,
      draftId: DRAFT_ID,
      deps: { ...store.deps, graph: adapter },
    });
    assert.strictEqual(result.code, "conflict_creating");
    assert.strictEqual(postCounts.campaign, 0);
  }

  // Expired lease reclaim → resume without duplicate campaign POST
  {
    const store = makeStore(
      baseDraft({
        status: "creating",
        createAttemptId: "old-attempt",
        metaCampaignId: "camp_existing",
        metaAdsetId: "adset_existing",
        metadata: {
          createPaused: {
            leaseExpiresAt: new Date(Date.now() - 60_000).toISOString(),
            metaImageHash: "hash_existing",
            outcomeUncertain: false,
          },
        },
        updatedAt: new Date(Date.now() - 120_000).toISOString(),
      })
    );
    const { adapter, postCounts } = mockGraph();
    const result = await runMetaAdsCreatePaused({
      authenticatedUserId: USER,
      draftId: DRAFT_ID,
      deps: { ...store.deps, graph: adapter, nowMs: () => Date.now() },
    });
    assert.strictEqual(result.ok, true);
    assert.strictEqual(postCounts.campaign, 0);
    assert.strictEqual(postCounts.adset, 0);
    assert.strictEqual(postCounts.image, 0);
    assert.strictEqual(postCounts.creative, 1);
    assert.notStrictEqual(store.row?.createAttemptId, "old-attempt");
  }

  // Uncertain expired creating cannot reclaim
  {
    const store = makeStore(
      baseDraft({
        status: "creating",
        createAttemptId: "old-u",
        lastErrorCode: "outcome_uncertain",
        metadata: {
          createPaused: {
            leaseExpiresAt: new Date(Date.now() - 60_000).toISOString(),
            outcomeUncertain: true,
            uncertainStep: "campaign",
          },
        },
        updatedAt: new Date(Date.now() - 120_000).toISOString(),
      })
    );
    const { adapter, postCounts } = mockGraph();
    const result = await runMetaAdsCreatePaused({
      authenticatedUserId: USER,
      draftId: DRAFT_ID,
      deps: { ...store.deps, graph: adapter },
    });
    assert.strictEqual(result.code, "blocked_uncertain");
    assert.strictEqual(postCounts.campaign, 0);
  }

  // Stale worker loses ownership mid-flow
  {
    const store = makeStore(baseDraft());
    const { adapter } = mockGraph();
    let persistN = 0;
    const origPersist = store.deps.persistProgress!;
    store.deps.persistProgress = async (id, uid, patch) => {
      persistN += 1;
      // After claim metadata write (#1) and first ownership touch before campaign (#2),
      // fail the persist of campaign id (#3) as if another attempt took over.
      if (persistN >= 3) return null;
      return origPersist(id, uid, patch);
    };
    // Need campaign POST to succeed then persist fail — actually ownership touch
    // is persist #2, campaign confirmed persist is #3. So campaign POST happens,
    // then persist returns null → attempt_conflict. Campaign may have been created
    // on Meta (documented crash window) but worker stops.
    const result = await runMetaAdsCreatePaused({
      authenticatedUserId: USER,
      draftId: DRAFT_ID,
      deps: { ...store.deps, graph: adapter },
    });
    assert.strictEqual(result.code, "attempt_conflict");
  }

  // Uncertain campaign — probe called, no second POST, no auto-accept even if matchCount=1
  {
    const store = makeStore(baseDraft());
    const g = mockGraph({
      uncertainAt: "campaign",
      probe: {
        acceptedId: null,
        matchCount: 1,
        reason: "auto_accept_disabled",
      },
    });
    const result = await runMetaAdsCreatePaused({
      authenticatedUserId: USER,
      draftId: DRAFT_ID,
      deps: { ...store.deps, graph: g.adapter },
    });
    assert.strictEqual(result.code, "outcome_uncertain");
    assert.strictEqual(g.postCounts.campaign, 1);
    assert.strictEqual(g.probeCalls, 1);
    assert.strictEqual(store.row?.metaCampaignId, null);
    assert.strictEqual(store.row?.status, "partial_failure");
  }

  // Zero matches still uncertain (not treated as failed POST)
  {
    const store = makeStore(baseDraft());
    const g = mockGraph({
      uncertainAt: "adset",
      probe: { acceptedId: null, matchCount: 0, reason: "zero_matches" },
    });
    const result = await runMetaAdsCreatePaused({
      authenticatedUserId: USER,
      draftId: DRAFT_ID,
      deps: { ...store.deps, graph: g.adapter },
    });
    assert.strictEqual(result.code, "outcome_uncertain");
    assert.strictEqual(store.row?.metaCampaignId, "camp_1");
    assert.strictEqual(g.postCounts.adset, 1);
  }

  // Image uncertain — no creative POST
  {
    const store = makeStore(baseDraft());
    const g = mockGraph({ uncertainAt: "image" });
    const result = await runMetaAdsCreatePaused({
      authenticatedUserId: USER,
      draftId: DRAFT_ID,
      deps: { ...store.deps, graph: g.adapter },
    });
    assert.strictEqual(result.code, "outcome_uncertain");
    assert.strictEqual(g.postCounts.creative, 0);
  }

  // Resume partial progress (no uncertain)
  {
    const store = makeStore(
      baseDraft({
        status: "partial_failure",
        metaCampaignId: "camp_existing",
        metaAdsetId: "adset_existing",
        metadata: { createPaused: { metaImageHash: "hash_existing" } },
      })
    );
    const { adapter, postCounts } = mockGraph();
    const result = await runMetaAdsCreatePaused({
      authenticatedUserId: USER,
      draftId: DRAFT_ID,
      deps: { ...store.deps, graph: adapter },
    });
    assert.strictEqual(result.ok, true);
    assert.strictEqual(postCounts.campaign, 0);
    assert.strictEqual(postCounts.image, 0);
    assert.strictEqual(postCounts.creative, 1);
  }

  // Blocked uncertain partial_failure
  {
    const store = makeStore(
      baseDraft({
        status: "partial_failure",
        lastErrorCode: "outcome_uncertain",
        createAttemptId: "att-x",
        metadata: {
          createPaused: {
            outcomeUncertain: true,
            uncertainStep: "image",
          },
        },
      })
    );
    const { adapter, postCounts } = mockGraph();
    const result = await runMetaAdsCreatePaused({
      authenticatedUserId: USER,
      draftId: DRAFT_ID,
      deps: { ...store.deps, graph: adapter },
    });
    assert.strictEqual(result.code, "blocked_uncertain");
    assert.strictEqual(postCounts.campaign, 0);
  }

  console.log("create-paused.test.ts: ok");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
