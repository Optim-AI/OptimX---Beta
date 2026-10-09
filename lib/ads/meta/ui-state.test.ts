/**
 * Meta Ads UI state derivation tests.
 * Run: npx --yes tsx lib/ads/meta/ui-state.test.ts
 */
import assert from "assert";
import { deriveMetaUiState } from "@/lib/ads/meta/ui-state";

// Disconnected
{
  const s = deriveMetaUiState({ connected: false });
  assert.strictEqual(s.phase, "disconnected");
  assert.strictEqual(s.primaryAction, "connect");
  assert.strictEqual(s.isConnected, false);
}

// Pending account selection after OAuth (no integration row yet)
{
  const s = deriveMetaUiState({
    connected: false,
    pendingSelection: {
      sessionId: "oauth_meta_abc",
      pagesCount: 2,
      adAccountsCount: 1,
      expiresAt: new Date(Date.now() + 60000).toISOString(),
    },
  });
  assert.strictEqual(s.phase, "pending_selection");
  assert.strictEqual(s.awaitingAccountSelection, true);
  assert.strictEqual(s.primaryAction, "select_accounts");
  assert.strictEqual(s.sessionId, "oauth_meta_abc");
  assert.strictEqual(s.isConnected, false);
}

// Connected with selected account
{
  const s = deriveMetaUiState({
    connected: true,
    adAccountId: "123",
    selectedAccount: { id: "123", name: "Acme Ads" },
    selectedAccountCount: 1,
    syncStatus: "idle",
    hasMetrics: false,
  });
  assert.strictEqual(s.phase, "connected");
  assert.strictEqual(s.primaryAction, "manage_accounts");
  assert.strictEqual(s.selectedAccountCount, 1);
  assert.strictEqual(s.hasMetrics, false);
}

// Syncing (separate from connection)
{
  const s = deriveMetaUiState({
    connected: true,
    adAccountId: "123",
    selectedAccountCount: 1,
    syncStatus: "running",
  });
  assert.strictEqual(s.phase, "syncing");
  assert.strictEqual(s.isConnected, true);
  assert.strictEqual(s.primaryAction, "none");
}

// Sync failed while still connected
{
  const s = deriveMetaUiState({
    connected: true,
    adAccountId: "123",
    selectedAccountCount: 1,
    syncStatus: "failed",
    syncErrorMessage: "Graph rate limit",
  });
  assert.strictEqual(s.phase, "sync_failed");
  assert.strictEqual(s.primaryAction, "retry_sync");
  assert.strictEqual(s.isConnected, true);
  assert.ok(s.syncErrorMessage?.includes("rate limit"));
}

// Needs reconnect
{
  const s = deriveMetaUiState({
    connected: false,
    needsReconnect: true,
    healthStatus: "revoked",
    adAccountId: "123",
  });
  assert.strictEqual(s.phase, "needs_reconnect");
  assert.strictEqual(s.primaryAction, "reconnect");
}

// OAuth success query should not invent connected without payload
{
  const s = deriveMetaUiState(null);
  assert.strictEqual(s.phase, "disconnected");
}

console.log("meta ui-state.test: PASS");
