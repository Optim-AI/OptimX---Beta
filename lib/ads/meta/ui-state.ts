/**
 * Pure Meta Ads card UI state derivation (no I/O).
 * Connection status is separate from Insights sync status.
 */

import {
  formatLastSyncedAt,
  normalizeSyncStatus,
  sanitizeSyncErrorMessage,
} from "@/lib/ads/meta/sync-feedback";

export type MetaUiPhase =
  | "disconnected"
  | "pending_selection"
  | "connected"
  | "syncing"
  | "sync_partial"
  | "sync_failed"
  | "needs_reconnect";

export type MetaStatusPayload = {
  connected?: boolean;
  needsReconnect?: boolean;
  healthStatus?: string | null;
  syncStatus?: string | null;
  syncErrorMessage?: string | null;
  lastSyncedAt?: string | null;
  adAccountId?: string | null;
  selectedAccount?: { id: string; name?: string | null } | null;
  selectedAccountCount?: number;
  hasMetrics?: boolean;
  pendingSelection?: {
    sessionId: string;
    pagesCount: number;
    adAccountsCount: number;
    expiresAt: string;
  } | null;
};

export type MetaUiState = {
  phase: MetaUiPhase;
  /** True only when an integration row exists and is usable (not revoked). */
  isConnected: boolean;
  /** OAuth succeeded but finalize (page + ad account) not done. */
  awaitingAccountSelection: boolean;
  selectedAccountCount: number;
  selectedAccountId: string | null;
  selectedAccountName: string | null;
  sessionId: string | null;
  syncStatus: string;
  syncErrorMessage: string | null;
  lastSyncedAt: string | null;
  /** Locale-friendly last sync time, or null */
  lastSyncedLabel: string | null;
  hasMetrics: boolean;
  primaryAction:
    | "connect"
    | "select_accounts"
    | "manage_accounts"
    | "retry_sync"
    | "reconnect"
    | "none";
  statusLabel: string;
};

export function deriveMetaUiState(input: MetaStatusPayload | null | undefined): MetaUiState {
  const p = input || {};
  const pending = p.pendingSelection || null;
  const needsReconnect =
    !!p.needsReconnect ||
    ["expired", "revoked", "invalid", "unhealthy"].includes(
      String(p.healthStatus || "").toLowerCase()
    );

  const selectedAccountId =
    p.selectedAccount?.id ||
    (p.adAccountId ? String(p.adAccountId).replace(/^act_/, "") : null) ||
    null;

  const selectedAccountCount =
    typeof p.selectedAccountCount === "number"
      ? p.selectedAccountCount
      : selectedAccountId
        ? 1
        : 0;

  const syncStatus = normalizeSyncStatus(p.syncStatus);
  const isConnected = !!p.connected && !needsReconnect;
  const awaitingAccountSelection = !isConnected && !!pending?.sessionId;
  const lastSyncedAt = p.lastSyncedAt ?? null;
  const lastSyncedLabel = formatLastSyncedAt(lastSyncedAt);
  const syncErrorMessage = p.syncErrorMessage
    ? sanitizeSyncErrorMessage(p.syncErrorMessage)
    : null;

  let phase: MetaUiPhase = "disconnected";
  let primaryAction: MetaUiState["primaryAction"] = "connect";
  let statusLabel = "Not connected";

  if (needsReconnect && (p.connected || selectedAccountId)) {
    phase = "needs_reconnect";
    primaryAction = "reconnect";
    statusLabel = "Authorization revoked or expired";
  } else if (awaitingAccountSelection) {
    phase = "pending_selection";
    primaryAction = "select_accounts";
    statusLabel = "Authorized — select Page & Ad Account";
  } else if (isConnected && syncStatus === "running") {
    phase = "syncing";
    primaryAction = "none";
    statusLabel = "Syncing performance…";
  } else if (isConnected && syncStatus === "error") {
    phase = "sync_failed";
    primaryAction = "retry_sync";
    statusLabel = "Connected — last sync failed";
  } else if (isConnected && syncStatus === "partial") {
    phase = "sync_partial";
    primaryAction = "retry_sync";
    statusLabel = "Connected — last sync was partial";
  } else if (isConnected) {
    phase = "connected";
    primaryAction = "manage_accounts";
    statusLabel =
      selectedAccountCount > 0
        ? `Connected · ${selectedAccountCount} ad account selected`
        : "Connected — select an ad account";
    if (syncStatus === "success" && lastSyncedLabel) {
      statusLabel = `Connected — last sync succeeded ${lastSyncedLabel}`;
    } else if (lastSyncedLabel) {
      statusLabel = `${statusLabel} · last synced ${lastSyncedLabel}`;
    }
    if (!selectedAccountId) {
      primaryAction = "select_accounts";
    }
  } else {
    phase = "disconnected";
    primaryAction = "connect";
    statusLabel = "Not connected";
  }

  return {
    phase,
    isConnected,
    awaitingAccountSelection,
    selectedAccountCount,
    selectedAccountId,
    selectedAccountName: p.selectedAccount?.name ?? null,
    sessionId: pending?.sessionId ?? null,
    syncStatus,
    syncErrorMessage,
    lastSyncedAt,
    lastSyncedLabel,
    hasMetrics: !!p.hasMetrics,
    primaryAction,
    statusLabel,
  };
}
