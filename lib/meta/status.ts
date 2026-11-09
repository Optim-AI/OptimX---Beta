/**
 * Connection status for the UI (no tokens), plus a cheap token health check
 * (debug_token at most once every 12 hours).
 */
import { MetaConnectionDAO, type MetaAssetRow, type MetaConnectionRow } from '@/database/models/MetaConnection.dao';
import { decryptToken } from './crypto';
import { inspectToken } from './connect';
import { getMetaConnectConfig } from './config';
import { META_INTEL_SCOPES } from './config';
import { metaLog } from './log';

export const EXPIRY_WARNING_DAYS = 7;
const HEALTH_CHECK_INTERVAL_MS = 12 * 60 * 60 * 1000;

export type PublicMetaAsset = {
  kind: MetaAssetRow['kind'];
  metaId: string;
  name: string | null;
  parentMetaId: string | null;
  currency: string | null;
  timezoneName: string | null;
  accountStatus: number | null;
  selected: boolean;
  metadata: Record<string, unknown>;
};

export type MetaStatusView = {
  connected: boolean;
  state: 'not_connected' | 'needs_selection' | 'active' | 'expiring' | 'expired' | 'revoked' | 'error';
  tokenType: 'system_user' | 'user' | null;
  metaUserName: string | null;
  businessName: string | null;
  tokenExpiresAt: string | null;
  lastSyncAt: string | null;
  connectedAt: string | null;
  missingScopes: string[];
  message: string | null;
  assets: PublicMetaAsset[];
};

export function toPublicAsset(a: MetaAssetRow): PublicMetaAsset {
  return {
    kind: a.kind,
    metaId: a.metaId,
    name: a.name,
    parentMetaId: a.parentMetaId,
    currency: a.currency,
    timezoneName: a.timezoneName,
    accountStatus: a.accountStatus,
    selected: a.selected,
    metadata: (a.metadata ?? {}) as Record<string, unknown>,
  };
}

export function deriveState(conn: MetaConnectionRow | null, nowMs = Date.now()): MetaStatusView['state'] {
  if (!conn) return 'not_connected';
  if (conn.status === 'revoked') return 'revoked';
  if (conn.status === 'error') return 'error';
  if (conn.status === 'expired') return 'expired';
  if (conn.tokenExpiresAt) {
    const exp = Date.parse(conn.tokenExpiresAt);
    if (exp <= nowMs) return 'expired';
    if (conn.status === 'pending') return 'needs_selection';
    if (exp - nowMs < EXPIRY_WARNING_DAYS * 86_400_000) return 'expiring';
  }
  if (conn.status === 'pending') return 'needs_selection';
  return 'active';
}

const MESSAGES: Record<MetaStatusView['state'], string | null> = {
  not_connected: null,
  needs_selection: 'Choose which ad account, Page and Instagram account to use.',
  active: null,
  expiring: 'Your Meta access expires soon. Reconnect to keep data syncing.',
  expired: 'Your Meta access has expired. Reconnect to resume syncing.',
  revoked: 'Access was removed in Facebook. Reconnect to resume syncing.',
  error: 'We could not reach your Meta account. Try reconnecting.',
};

/** Re-check the token with Meta if it hasn't been checked recently. Never throws. */
async function maybeCheckHealth(conn: MetaConnectionRow): Promise<MetaConnectionRow> {
  if (!conn.tokenEnc || conn.status === 'revoked') return conn;
  const last = conn.lastCheckedAt ? Date.parse(conn.lastCheckedAt) : 0;
  if (Date.now() - last < HEALTH_CHECK_INTERVAL_MS) return conn;
  try {
    getMetaConnectConfig();
    const info = await inspectToken(decryptToken(conn.tokenEnc));
    const patch = {
      status: info.isValid ? (conn.status === 'pending' ? 'pending' : 'active') : 'expired',
      lastError: info.isValid ? null : 'Token is no longer valid',
      tokenExpiresAt: info.expiresAt,
      dataAccessExpiresAt: info.dataAccessExpiresAt,
      scopes: info.scopes,
    } as const;
    await MetaConnectionDAO.updateHealth(conn.id, patch);
    return { ...conn, ...patch, lastCheckedAt: new Date().toISOString() };
  } catch (err) {
    metaLog.warn('health_check_failed', { connectionId: conn.id, message: (err as Error).message });
    return conn;
  }
}

export async function getMetaStatus(userId: string, opts: { checkHealth?: boolean } = {}): Promise<MetaStatusView> {
  let conn = await MetaConnectionDAO.getByUser(userId);
  if (conn && opts.checkHealth) conn = await maybeCheckHealth(conn);
  const state = deriveState(conn);
  if (!conn) {
    return {
      connected: false, state, tokenType: null, metaUserName: null, businessName: null,
      tokenExpiresAt: null, lastSyncAt: null, connectedAt: null, missingScopes: [], message: null, assets: [],
    };
  }
  const assets = (await MetaConnectionDAO.listAssets(userId)).map(toPublicAsset);
  const granted = new Set(conn.scopes ?? []);
  return {
    connected: true,
    state,
    tokenType: conn.tokenType as 'system_user' | 'user',
    metaUserName: conn.metaUserName,
    businessName: conn.businessName,
    tokenExpiresAt: conn.tokenExpiresAt,
    lastSyncAt: conn.lastSyncAt,
    connectedAt: conn.connectedAt,
    missingScopes: granted.size ? META_INTEL_SCOPES.filter((s) => !granted.has(s)) : [],
    message: MESSAGES[state],
    assets,
  };
}
