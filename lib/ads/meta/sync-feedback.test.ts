/**
 * Ads sync feedback + duplicate-click semantics (PR I).
 * Run: npx --yes tsx lib/ads/meta/sync-feedback.test.ts
 */
import assert from "assert";
import {
  formatLastSyncedAt,
  interpretAdsSyncResponse,
  normalizeSyncStatus,
  sanitizeSyncErrorMessage,
} from "@/lib/ads/meta/sync-feedback";

assert.strictEqual(normalizeSyncStatus("syncing"), "running");
assert.strictEqual(normalizeSyncStatus("running"), "running");
assert.strictEqual(normalizeSyncStatus("partial"), "partial");
assert.strictEqual(normalizeSyncStatus("failed"), "error");
assert.strictEqual(normalizeSyncStatus("error"), "error");
assert.strictEqual(normalizeSyncStatus("success"), "success");

{
  const ok = interpretAdsSyncResponse(true, {
    ok: true,
    status: "success",
    metricsUpserted: 3,
  });
  assert.strictEqual(ok.tone, "success");
  assert.ok(ok.message.toLowerCase().includes("succeeded"));
}

{
  const partial = interpretAdsSyncResponse(true, {
    ok: true,
    status: "partial",
    metricsUpserted: 2,
    errorMessage: "campaign insights unavailable",
  });
  assert.strictEqual(partial.tone, "warning");
  assert.ok(partial.message.toLowerCase().includes("partial"));
  assert.ok(!partial.message.toLowerCase().includes("succeeded"));
}

{
  const failed = interpretAdsSyncResponse(false, {
    ok: false,
    status: "error",
    errorMessage: "token expired",
  });
  assert.strictEqual(failed.tone, "error");
  assert.ok(failed.message.toLowerCase().includes("token"));
}

{
  const httpOkButErrorBody = interpretAdsSyncResponse(true, {
    ok: false,
    status: "error",
    error: "boom",
  });
  assert.strictEqual(httpOkButErrorBody.tone, "error");
}

assert.ok(
  sanitizeSyncErrorMessage("Bearer eyJhbGciOi.secret.token leak").includes(
    "[REDACTED]"
  )
);
assert.ok(formatLastSyncedAt("2026-04-01T12:00:00.000Z"));
assert.strictEqual(formatLastSyncedAt("not-a-date"), null);

// Duplicate-click prevention contract (mirrors IntegrationsConnectPanel guard)
function canStartSync(opts: {
  inFlight: boolean;
  syncBusy: boolean;
  phase: string;
}) {
  if (opts.inFlight || opts.syncBusy || opts.phase === "syncing") return false;
  return true;
}
assert.strictEqual(
  canStartSync({ inFlight: false, syncBusy: false, phase: "connected" }),
  true
);
assert.strictEqual(
  canStartSync({ inFlight: true, syncBusy: false, phase: "connected" }),
  false
);
assert.strictEqual(
  canStartSync({ inFlight: false, syncBusy: true, phase: "connected" }),
  false
);
assert.strictEqual(
  canStartSync({ inFlight: false, syncBusy: false, phase: "syncing" }),
  false
);

console.log("meta sync-feedback.test: PASS");
