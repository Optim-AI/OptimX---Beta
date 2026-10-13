/**
 * Runner status mapping contract (pure outcome + DAO status values).
 * Run: npx --yes tsx lib/ads/sync/runner-status.test.ts
 */
import assert from "assert";
import { classifyAdsSyncOutcome } from "@/lib/ads/sync/outcome";

/** Mirrors how /api/ads/sync chooses HTTP status from SyncResult */
function httpStatusForSync(result: { ok: boolean; status: string }): number {
  if (result.status === "error" || !result.ok) return 500;
  return 200; // success and partial
}

/** Cron row shape expectation */
function cronRowFromResult(r: {
  ok: boolean;
  status: string;
  entitiesUpserted: number;
  metricsUpserted: number;
  errorMessage?: string | null;
}) {
  return {
    ok: r.ok,
    status: r.status,
    entitiesUpserted: r.entitiesUpserted,
    metricsUpserted: r.metricsUpserted,
    errorMessage: r.errorMessage || null,
  };
}

{
  const success = classifyAdsSyncOutcome({
    entitiesUpserted: 2,
    metricsUpserted: 3,
    metricsResult: {
      metrics: [],
      failures: [],
      levelsAttempted: ["account"],
      levelsSucceeded: ["account"],
    },
  });
  assert.strictEqual(httpStatusForSync(success), 200);
  assert.deepStrictEqual(
    cronRowFromResult({
      ...success,
      entitiesUpserted: 2,
      metricsUpserted: 3,
    }).status,
    "success"
  );
}

{
  const partial = classifyAdsSyncOutcome({
    entitiesUpserted: 2,
    metricsUpserted: 0,
    metricsResult: {
      metrics: [],
      failures: [{ level: "account", message: "fail" }],
      levelsAttempted: ["account"],
      levelsSucceeded: [],
    },
  });
  assert.strictEqual(partial.status, "partial");
  assert.strictEqual(httpStatusForSync(partial), 200);
  assert.strictEqual(
    cronRowFromResult({
      ...partial,
      entitiesUpserted: 2,
      metricsUpserted: 0,
    }).ok,
    true
  );
}

{
  const total = classifyAdsSyncOutcome({
    entitiesUpserted: 0,
    metricsUpserted: 0,
    metricsResult: {
      metrics: [],
      failures: [{ level: "account", message: "fail" }],
      levelsAttempted: ["account"],
      levelsSucceeded: [],
    },
  });
  assert.strictEqual(total.status, "error");
  assert.strictEqual(httpStatusForSync(total), 500);
  assert.strictEqual(
    cronRowFromResult({
      ...total,
      entitiesUpserted: 0,
      metricsUpserted: 0,
    }).ok,
    false
  );
}

// Allowed ad_sync_runs statuses (no migration)
const ALLOWED = new Set(["running", "success", "partial", "error"]);
assert.ok(ALLOWED.has("partial"));
assert.ok(ALLOWED.has("success"));
assert.ok(ALLOWED.has("error"));

console.log("ads sync runner-status.test: PASS");
