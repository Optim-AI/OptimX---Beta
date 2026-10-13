/**
 * Run: npx --yes tsx lib/ads/meta/create-paused-resolve-image.test.ts
 */
import assert from "assert";
import { resolveMetaAdsUncertainImageHash } from "@/lib/ads/meta/create-paused-resolve-image";
import type { MetaAdsDraftRow } from "@/database/models/MetaAdsDraft.dao";
import type { ResolvedMetaAdsWriteContext } from "@/lib/ads/providers/meta/write-context";
import type { MetaCreatePausedGraphAdapter } from "@/lib/ads/meta/create-paused-graph";

const USER = "11111111-1111-4111-8111-111111111111";
const DRAFT = "33333333-3333-4333-8333-333333333333";
const ATTEMPT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const HASH = "abcdef0123456789abcdef01";

function row(overrides: Partial<MetaAdsDraftRow> = {}): MetaAdsDraftRow {
  return {
    id: DRAFT,
    userId: USER,
    integrationId: "int-1",
    adAccountId: "acct-1",
    status: "partial_failure",
    name: "T",
    objective: "OUTCOME_TRAFFIC",
    dailyBudgetMajor: "10",
    currency: "USD",
    scheduleStart: null,
    scheduleEnd: null,
    targeting: {},
    placements: {},
    sourceImageId: "img",
    sourceImageUrl: "https://x/y.jpg",
    primaryText: "p",
    headline: "h",
    destinationUrl: "https://example.com",
    callToAction: "LEARN_MORE",
    metaCampaignId: "c1",
    metaAdsetId: "s1",
    metaCreativeId: null,
    metaAdId: null,
    idempotencyKey: null,
    createAttemptId: ATTEMPT,
    lastErrorCode: "outcome_uncertain",
    lastErrorMessage: "timed out",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdOnMetaAt: null,
    metadata: {
      createPaused: {
        outcomeUncertain: true,
        uncertainStep: "image",
      },
    },
    ...overrides,
  } as MetaAdsDraftRow;
}

function ctx(): ResolvedMetaAdsWriteContext {
  return {
    provider: "meta",
    userId: USER,
    integrationId: "int-1",
    userAccessToken: "EAATokenResolveImageTests_xxxxxxxxxxxxxxxxxxxx",
    accessToken: "EAATokenResolveImageTests_xxxxxxxxxxxxxxxxxxxx",
    pageId: "p1",
    pageAccessToken: null,
    adAccountRowId: "acct-1",
    accountExternalId: "9",
    actId: "act_9",
    currency: "USD",
    currencyOffset: 100,
    currencyExponent: 2,
  };
}

const env = {
  META_ADS_CREATE_ENABLED: "true",
  META_ADS_ADIMAGES_CONTRACT_APPROVED: "true",
  META_ADS_CREATE_PAUSED_GRAPH_WRITES: "true",
};

async function main() {
  // Reject wrong attempt
  {
    let stored = row();
    const result = await resolveMetaAdsUncertainImageHash({
      authenticatedUserId: USER,
      draftId: DRAFT,
      imageHash: HASH,
      createAttemptId: "wrong",
      deps: {
        env,
        findDraft: async () => stored,
        persistResolution: async () => stored,
        loadWriteContext: async () => ctx(),
        graph: {
          verifyAdImageHash: async () => true,
        } as unknown as MetaCreatePausedGraphAdapter,
      },
    });
    assert.strictEqual(result.code, "attempt_conflict");
  }

  // Reject unverified hash (not on account)
  {
    const stored = row();
    const result = await resolveMetaAdsUncertainImageHash({
      authenticatedUserId: USER,
      draftId: DRAFT,
      imageHash: HASH,
      createAttemptId: ATTEMPT,
      deps: {
        env,
        findDraft: async () => stored,
        persistResolution: async () => {
          throw new Error("must not persist");
        },
        loadWriteContext: async () => ctx(),
        graph: {
          verifyAdImageHash: async () => false,
        } as unknown as MetaCreatePausedGraphAdapter,
      },
    });
    assert.strictEqual(result.code, "hash_not_on_account");
  }

  // Success — audit metadata + clear uncertain
  {
    let stored = row();
    const result = await resolveMetaAdsUncertainImageHash({
      authenticatedUserId: USER,
      draftId: DRAFT,
      imageHash: HASH,
      createAttemptId: ATTEMPT,
      deps: {
        env,
        findDraft: async () => stored,
        persistResolution: async (_id, _uid, patch) => {
          stored = {
            ...stored,
            ...patch,
            metadata: patch.metadata ?? stored.metadata,
          } as MetaAdsDraftRow;
          return stored;
        },
        loadWriteContext: async () => ctx(),
        graph: {
          verifyAdImageHash: async (o) => {
            assert.strictEqual(o.imageHash, HASH);
            assert.strictEqual(o.actId, "act_9");
            return true;
          },
        } as unknown as MetaCreatePausedGraphAdapter,
      },
    });
    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.code, "image_resolved");
    const cp = (stored.metadata as any).createPaused;
    assert.strictEqual(cp.metaImageHash, HASH);
    assert.strictEqual(cp.outcomeUncertain, false);
    assert.strictEqual(cp.operatorImageResolution.imageHash, HASH);
    assert.strictEqual(cp.operatorImageResolution.resolvedByUserId, USER);
  }

  // Fail closed when gates off
  {
    const result = await resolveMetaAdsUncertainImageHash({
      authenticatedUserId: USER,
      draftId: DRAFT,
      imageHash: HASH,
      createAttemptId: ATTEMPT,
      deps: {
        env: { META_ADS_CREATE_ENABLED: "false" },
        findDraft: async () => row(),
        persistResolution: async () => row(),
        loadWriteContext: async () => ctx(),
        graph: { verifyAdImageHash: async () => true } as any,
      },
    });
    assert.strictEqual(result.ok, false);
    assert.ok(
      result.code === "not_entitled" || result.code === "adimages_contract_unapproved"
    );
  }

  console.log("create-paused-resolve-image.test.ts: ok");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
