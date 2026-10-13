/**
 * Run: npx --yes tsx lib/ads/meta/create-paused-lease.test.ts
 */
import assert from "assert";
import {
  canReclaimStaleCreating,
  hasUnresolvedUncertainStep,
  isCreatePausedLeaseActive,
  nextCreatePausedStep,
  readCreatePausedState,
} from "@/lib/ads/meta/create-paused-lease";
import type { MetaAdsDraftRow } from "@/database/models/MetaAdsDraft.dao";

function draft(overrides: Partial<MetaAdsDraftRow> = {}): MetaAdsDraftRow {
  return {
    id: "d1",
    userId: "u1",
    integrationId: "i1",
    adAccountId: "a1",
    status: "creating",
    name: "n",
    objective: "OUTCOME_TRAFFIC",
    dailyBudgetMajor: "10",
    currency: "USD",
    scheduleStart: null,
    scheduleEnd: null,
    targeting: {},
    placements: {},
    sourceImageId: null,
    sourceImageUrl: null,
    primaryText: null,
    headline: null,
    destinationUrl: null,
    callToAction: null,
    metaCampaignId: null,
    metaAdsetId: null,
    metaCreativeId: null,
    metaAdId: null,
    idempotencyKey: null,
    createAttemptId: "att-1",
    lastErrorCode: null,
    lastErrorMessage: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    createdOnMetaAt: null,
    metadata: {
      createPaused: {
        leaseExpiresAt: new Date(Date.now() + 60_000).toISOString(),
      },
    },
    ...overrides,
  } as MetaAdsDraftRow;
}

{
  const d = draft();
  assert.strictEqual(isCreatePausedLeaseActive(d, Date.now()), true);
  assert.deepStrictEqual(canReclaimStaleCreating(d), {
    ok: false,
    reason: "lease_active",
  });
}

{
  const d = draft({
    metadata: {
      createPaused: {
        leaseExpiresAt: new Date(Date.now() - 1000).toISOString(),
      },
    },
    updatedAt: new Date(Date.now() - 120_000).toISOString(),
  });
  assert.strictEqual(isCreatePausedLeaseActive(d, Date.now()), false);
  assert.deepStrictEqual(canReclaimStaleCreating(d), { ok: true });
}

{
  const d = draft({
    metadata: {
      createPaused: {
        leaseExpiresAt: new Date(Date.now() - 1000).toISOString(),
        outcomeUncertain: true,
        uncertainStep: "campaign",
      },
    },
    lastErrorCode: "outcome_uncertain",
    updatedAt: new Date(Date.now() - 120_000).toISOString(),
  });
  assert.ok(hasUnresolvedUncertainStep(d));
  assert.deepStrictEqual(canReclaimStaleCreating(d), {
    ok: false,
    reason: "uncertain_step_blocks_reclaim",
  });
  assert.strictEqual(nextCreatePausedStep(d).step, "blocked_uncertain");
}

{
  const d = draft({
    metaCampaignId: "c1",
    metaAdsetId: "s1",
    metadata: { createPaused: { metaImageHash: "h1" } },
  });
  assert.strictEqual(nextCreatePausedStep(d).step, "creative");
  assert.ok(readCreatePausedState(d).metaImageHash === "h1");
}

console.log("create-paused-lease.test.ts: ok");
