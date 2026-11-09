// Settings → Integrations: Meta (Facebook & Instagram) connection card.
import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { Facebook, Instagram, Megaphone, RefreshCw, Unplug, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import colors from '@/lib/ui/colors';
import { authFetch } from '@/lib/utils';
import { showConfirm, showError } from '@/app/web/src/components/ui/alert-modal-api';
import { SettingsCard, SettingsSectionHeader, SettingsDivider } from '@/app/web/src/components/settings/SettingsUI';
import { startMetaConnect } from './startMetaConnect';
import { formatDate, type MetaStatus, type MetaAssetView, type SyncRunView } from './types';

const RETURN_MESSAGES: Record<string, string> = {
  cancelled: 'Connection cancelled. Nothing was changed.',
  error: 'Meta did not finish connecting. Please try again.',
};

function StatusPill({ status }: { status: MetaStatus }) {
  const map: Record<MetaStatus['state'], { label: string; bg: string; fg: string }> = {
    not_connected: { label: 'Not connected', bg: colors.muted, fg: colors.mutedForeground },
    needs_selection: { label: 'Finish setup', bg: 'hsl(38 92% 50% / 0.15)', fg: 'hsl(38 92% 60%)' },
    active: { label: 'Connected', bg: colors.green100, fg: colors.green600 },
    expiring: { label: 'Expires soon', bg: 'hsl(38 92% 50% / 0.15)', fg: 'hsl(38 92% 60%)' },
    expired: { label: 'Expired', bg: 'hsl(0 84% 55% / 0.15)', fg: colors.destructive },
    revoked: { label: 'Access removed', bg: 'hsl(0 84% 55% / 0.15)', fg: colors.destructive },
    error: { label: 'Needs attention', bg: 'hsl(0 84% 55% / 0.15)', fg: colors.destructive },
  };
  const s = map[status.state];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold" style={{ background: s.bg, color: s.fg }}>
      {status.state === 'active' ? <CheckCircle2 size={14} /> : status.state === 'not_connected' ? null : <AlertTriangle size={14} />}
      {s.label}
    </span>
  );
}

function AssetLine({ icon, label, assets }: { icon: React.ReactNode; label: string; assets: MetaAssetView[] }) {
  return (
    <div className="flex items-start gap-3 py-2">
      <div className="mt-0.5 shrink-0" style={{ color: colors.mutedForeground }}>{icon}</div>
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide" style={{ color: colors.mutedForeground }}>{label}</p>
        {assets.length ? (
          assets.map((a) => (
            <p key={a.metaId} className="truncate text-sm" style={{ color: colors.foreground }}>
              {a.name || a.metaId}
              {a.currency ? <span style={{ color: colors.mutedForeground }}> · {a.currency}{a.timezoneName ? ` · ${a.timezoneName}` : ''}</span> : null}
            </p>
          ))
        ) : (
          <p className="text-sm" style={{ color: colors.mutedForeground }}>None linked</p>
        )}
      </div>
    </div>
  );
}

export default function MetaIntegrationCard() {
  const router = useRouter();
  const [status, setStatus] = useState<MetaStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<'connect' | 'disconnect' | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [run, setRun] = useState<SyncRunView | null>(null);
  const [syncStarting, setSyncStarting] = useState(false);
  const [briefEmail, setBriefEmail] = useState<boolean | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await authFetch('/api/meta-intel/status');
      if (!res.ok) throw new Error(String(res.status));
      setStatus((await res.json()) as MetaStatus);
    } catch {
      setLoadError('Could not load your Meta connection. Refresh the page to try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const loadRun = useCallback(async () => {
    try {
      const res = await authFetch('/api/meta-intel/sync');
      if (!res.ok) return;
      const data = (await res.json()) as { run: SyncRunView | null };
      setRun(data.run);
    } catch {
      /* status line just stays as it was */
    }
  }, []);

  const isActive = status?.state === 'active' || status?.state === 'expiring';

  useEffect(() => {
    if (!isActive) return;
    authFetch('/api/meta-intel/brief').then(async (r) => {
      if (r.ok) setBriefEmail(((await r.json()) as { emailEnabled: boolean }).emailEnabled);
    }).catch(() => {});
  }, [isActive]);

  async function toggleBriefEmail(next: boolean) {
    setBriefEmail(next);
    const res = await authFetch('/api/meta-intel/brief', { method: 'PATCH', body: JSON.stringify({ emailEnabled: next }) }).catch(() => null);
    if (!res?.ok) {
      setBriefEmail(!next);
      showError('Could not save that setting. Please try again.');
    }
  }
  const syncing = run?.status === 'queued' || run?.status === 'running';

  useEffect(() => {
    if (isActive) void loadRun();
  }, [isActive, loadRun]);

  // Poll while a sync is in progress, then refresh "Last sync".
  useEffect(() => {
    if (!syncing) return;
    const t = setInterval(async () => {
      await loadRun();
    }, 5000);
    return () => clearInterval(t);
  }, [syncing, loadRun]);

  const prevSyncing = React.useRef(false);
  useEffect(() => {
    if (prevSyncing.current && !syncing) void load();
    prevSyncing.current = syncing;
  }, [syncing, load]);

  async function syncNow() {
    setSyncStarting(true);
    try {
      const res = await authFetch('/api/meta-intel/sync', { method: 'POST' });
      const data = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok && res.status !== 409) throw new Error(data.message || 'Could not start a sync. Please try again.');
      await loadRun();
    } catch (e) {
      showError((e as Error).message);
    } finally {
      setSyncStarting(false);
    }
  }

  const returnFlag = typeof router.query.meta === 'string' ? router.query.meta : null;

  async function connect() {
    setBusy('connect');
    const err = await startMetaConnect();
    if (err) {
      setBusy(null);
      showError(err);
    }
  }

  async function disconnect() {
    const ok = await showConfirm(
      'This removes SkalX’s access to your Meta ad accounts, Page and Instagram, and permanently deletes all Meta data SkalX has stored for you. You can connect again later.',
      { title: 'Disconnect Meta?', confirmLabel: 'Disconnect and delete', cancelLabel: 'Keep connected' },
    );
    if (!ok) return;
    setBusy('disconnect');
    try {
      const res = await authFetch('/api/meta-intel/disconnect', { method: 'POST' });
      if (!res.ok) throw new Error();
      await load();
    } catch {
      showError('Could not disconnect right now. Please try again.');
    } finally {
      setBusy(null);
    }
  }

  const selected = (kind: string) => (status?.assets ?? []).filter((a) => a.kind === kind && a.selected);
  const needsReconnect = status && ['expiring', 'expired', 'revoked', 'error'].includes(status.state);

  return (
    <SettingsCard>
      <SettingsSectionHeader
        title="Meta (Facebook & Instagram)"
        description="Connect your ad account, Facebook Page and Instagram so SkalX can show what’s working and suggest new ads. Read-only: SkalX never changes or posts anything."
        action={status ? <StatusPill status={status} /> : null}
      />

      {returnFlag && RETURN_MESSAGES[returnFlag] && status?.state !== 'active' ? (
        <p className="mb-4 rounded-lg px-3 py-2 text-sm" style={{ background: colors.muted, color: colors.foreground }}>
          {RETURN_MESSAGES[returnFlag]}
        </p>
      ) : null}

      {loading ? (
        <div className="flex items-center gap-2 text-sm" style={{ color: colors.mutedForeground }}>
          <Loader2 size={16} className="animate-spin" /> Checking your connection…
        </div>
      ) : loadError ? (
        <p className="text-sm" style={{ color: colors.destructive }}>{loadError}</p>
      ) : !status?.connected ? (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <ul className="space-y-1 text-sm" style={{ color: colors.mutedForeground }}>
            <li>• See your real spend, sales and best ads in one place</li>
            <li>• Takes about 2 minutes — you choose which accounts to share</li>
          </ul>
          <button
            type="button"
            onClick={connect}
            disabled={busy !== null}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-xl px-6 text-base font-semibold disabled:opacity-60"
            style={{ background: '#0866FF', color: '#fff' }}
          >
            {busy === 'connect' ? <Loader2 size={18} className="animate-spin" /> : <Facebook size={18} />}
            Connect with Facebook
          </button>
        </div>
      ) : (
        <>
          {status.message ? (
            <p className="mb-4 rounded-lg px-3 py-2 text-sm" style={{ background: colors.muted, color: colors.foreground }}>
              {status.message}
            </p>
          ) : null}

          <div className="grid gap-1 sm:grid-cols-3">
            <AssetLine icon={<Megaphone size={18} />} label="Ad account" assets={selected('ad_account')} />
            <AssetLine icon={<Facebook size={18} />} label="Facebook Page" assets={selected('page')} />
            <AssetLine icon={<Instagram size={18} />} label="Instagram" assets={selected('ig_account')} />
          </div>

          <SettingsDivider className="my-4" />

          <dl className="grid gap-2 text-sm sm:grid-cols-3">
            <div>
              <dt style={{ color: colors.mutedForeground }}>Connected by</dt>
              <dd style={{ color: colors.foreground }}>{status.metaUserName || status.businessName || '—'}</dd>
            </div>
            <div>
              <dt style={{ color: colors.mutedForeground }}>Last sync</dt>
              <dd style={{ color: colors.foreground }}>{status.lastSyncAt ? formatDate(status.lastSyncAt) : 'Not synced yet'}</dd>
            </div>
            <div>
              <dt style={{ color: colors.mutedForeground }}>Access</dt>
              <dd style={{ color: colors.foreground }}>
                {status.tokenType === 'system_user' || !status.tokenExpiresAt ? 'Does not expire' : `Until ${formatDate(status.tokenExpiresAt)}`}
              </dd>
            </div>
          </dl>

          {isActive ? (
            <div className="mt-4 flex flex-col gap-3 rounded-xl px-4 py-3 sm:flex-row sm:items-center sm:justify-between" style={{ background: colors.muted }}>
              <p className="flex items-center gap-2 text-sm" style={{ color: colors.foreground }}>
                {syncing ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    {run?.kind === 'full' ? 'Getting your last 90 days of ads and posts… this can take a few minutes.' : 'Syncing your latest results…'}
                  </>
                ) : run?.status === 'failed' ? (
                  <><AlertTriangle size={16} style={{ color: colors.destructive }} /> The last sync didn’t finish. Try again, or reconnect if it keeps failing.</>
                ) : run?.status === 'partial' ? (
                  <><AlertTriangle size={16} style={{ color: 'hsl(38 92% 60%)' }} /> Last sync finished, but some items couldn’t be read.</>
                ) : run ? (
                  <><CheckCircle2 size={16} style={{ color: colors.green600 }} /> Up to date. Syncs automatically every night.</>
                ) : (
                  <>Not synced yet.</>
                )}
              </p>
              <button
                type="button"
                onClick={syncNow}
                disabled={syncing || syncStarting || busy !== null}
                className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold disabled:opacity-50"
                style={{ background: colors.secondary, color: colors.foreground, border: `1px solid ${colors.border}` }}
              >
                {syncStarting ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                Sync now
              </button>
            </div>
          ) : null}

          {isActive && briefEmail !== null ? (
            <label className="mt-3 flex cursor-pointer items-center justify-between gap-3 rounded-xl px-4 py-3 text-sm" style={{ background: colors.muted, color: colors.foreground }}>
              <span>
                Email me the Monday brief
                <span className="block text-xs" style={{ color: colors.mutedForeground }}>Every Monday at 9 AM: last week, what won, what to stop, and 5 new ads to test.</span>
              </span>
              <input type="checkbox" checked={briefEmail} onChange={(e) => void toggleBriefEmail(e.target.checked)} className="h-5 w-5 shrink-0" style={{ accentColor: colors.primary }} />
            </label>
          ) : null}

          {status.missingScopes.length ? (
            <p className="mt-3 text-sm" style={{ color: 'hsl(38 92% 60%)' }}>
              Some permissions were not granted ({status.missingScopes.join(', ')}). Reconnect and keep all boxes ticked for full results.
            </p>
          ) : null}

          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            {status.state === 'needs_selection' ? (
              <Link
                href="/integrations/meta-intel/select"
                className="inline-flex h-11 items-center justify-center rounded-xl px-5 text-sm font-semibold"
                style={{ background: colors.primary, color: colors.primaryForeground }}
              >
                Choose accounts
              </Link>
            ) : (
              <>
              <Link
                href="/meta-intelligence"
                className="inline-flex h-11 items-center justify-center rounded-xl px-5 text-sm font-semibold"
                style={{ background: colors.primary, color: colors.primaryForeground }}
              >
                View ad performance
              </Link>
              <Link
                href="/integrations/meta-intel/select"
                className="inline-flex h-11 items-center justify-center rounded-xl px-5 text-sm font-semibold"
                style={{ background: colors.secondary, color: colors.foreground, border: `1px solid ${colors.border}` }}
              >
                Change accounts
              </Link>
              </>
            )}
            <button
              type="button"
              onClick={connect}
              disabled={busy !== null}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold disabled:opacity-60"
              style={needsReconnect ? { background: '#0866FF', color: '#fff' } : { background: colors.secondary, color: colors.foreground, border: `1px solid ${colors.border}` }}
            >
              {busy === 'connect' ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
              Reconnect
            </button>
            <button
              type="button"
              onClick={disconnect}
              disabled={busy !== null}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold disabled:opacity-60 sm:ml-auto"
              style={{ background: 'transparent', color: colors.destructive, border: `1px solid hsl(0 84% 55% / 0.4)` }}
            >
              {busy === 'disconnect' ? <Loader2 size={16} className="animate-spin" /> : <Unplug size={16} />}
              Disconnect
            </button>
          </div>
        </>
      )}
    </SettingsCard>
  );
}
