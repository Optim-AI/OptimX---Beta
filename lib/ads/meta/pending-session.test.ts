/**
 * Pending Meta OAuth session summary shape (no live DB required for pure checks).
 * Run: npx --yes tsx lib/ads/meta/pending-session.test.ts
 */
import assert from "assert";
import { deriveMetaUiState } from "@/lib/ads/meta/ui-state";

// Status API payloads must never require tokens for UI decisions
const safePendingPayload = {
  connected: false,
  pendingSelection: {
    sessionId: "oauth_meta_user_1",
    pagesCount: 1,
    adAccountsCount: 2,
    expiresAt: "2099-01-01T00:00:00.000Z",
  },
  syncStatus: "idle",
  hasMetrics: false,
  selectedAccountCount: 0,
};

assert.ok(!("accessToken" in safePendingPayload));
assert.ok(!("userAccessToken" in (safePendingPayload.pendingSelection as object)));

const ui = deriveMetaUiState(safePendingPayload);
assert.strictEqual(ui.phase, "pending_selection");
assert.strictEqual(ui.primaryAction, "select_accounts");
assert.strictEqual(ui.isConnected, false);

// After finalize: connected + sync failed still "connected" for connection status
const afterSyncFail = deriveMetaUiState({
  connected: true,
  selectedAccountCount: 1,
  adAccountId: "999",
  syncStatus: "failed",
  syncErrorMessage: "insights unavailable",
  hasMetrics: false,
});
assert.strictEqual(afterSyncFail.isConnected, true);
assert.strictEqual(afterSyncFail.phase, "sync_failed");
assert.notStrictEqual(afterSyncFail.phase, "disconnected");

console.log("meta pending-session.test: PASS");
