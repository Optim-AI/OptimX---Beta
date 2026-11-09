// Client-side mirror of lib/meta/status.ts MetaStatusView (no server imports in the browser).
export type MetaAssetView = {
  kind: 'ad_account' | 'page' | 'ig_account' | string;
  metaId: string;
  name: string | null;
  parentMetaId: string | null;
  currency: string | null;
  timezoneName: string | null;
  accountStatus: number | null;
  selected: boolean;
  metadata: Record<string, unknown>;
};

export type MetaStatus = {
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
  assets: MetaAssetView[];
};

export function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export type SyncRunView = {
  id: string;
  status: 'queued' | 'running' | 'succeeded' | 'partial' | 'failed' | string;
  kind: string;
  trigger: string;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  counts: Record<string, number>;
  errorCount: number;
  rangeSince: string | null;
  rangeUntil: string | null;
};
