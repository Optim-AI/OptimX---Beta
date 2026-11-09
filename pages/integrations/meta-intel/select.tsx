// /integrations/meta-intel/select — pick the ad account(s), Page and Instagram account for this brand.
import React, { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { Facebook, Instagram, Megaphone, Loader2, Check } from 'lucide-react';
import Sidebar from '../../../app/web/src/components/Sidebar';
import colors from '@/lib/ui/colors';
import { authFetch } from '@/lib/utils';
import { showError } from '@/app/web/src/components/ui/alert-modal-api';
import { startMetaConnect } from '@/app/web/src/components/meta-intel/startMetaConnect';
import type { MetaAssetView, MetaStatus } from '@/app/web/src/components/meta-intel/types';

const AD_ACCOUNT_STATUS: Record<number, string> = {
  2: 'Disabled', 3: 'Payment issue', 7: 'Under review', 8: 'Pending settlement', 9: 'In grace period', 100: 'Pending closure', 101: 'Closed',
};

function Choice({
  checked, onClick, title, subtitle, multi, badge,
}: { checked: boolean; onClick: () => void; title: string; subtitle?: string | null; multi?: boolean; badge?: string | null }) {
  return (
    <button
      type="button"
      role={multi ? 'checkbox' : 'radio'}
      aria-checked={checked}
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left transition-colors"
      style={{
        background: checked ? colors.accent : colors.secondary,
        border: `1px solid ${checked ? colors.primary : colors.border}`,
        minHeight: 56,
      }}
    >
      <span
        className={`flex h-6 w-6 shrink-0 items-center justify-center ${multi ? 'rounded-md' : 'rounded-full'}`}
        style={{ border: `2px solid ${checked ? colors.primary : colors.mutedForeground}`, background: checked ? colors.primary : 'transparent' }}
      >
        {checked ? <Check size={14} color="#fff" strokeWidth={3} /> : null}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-medium" style={{ color: colors.foreground }}>{title}</span>
        {subtitle ? <span className="block truncate text-xs" style={{ color: colors.mutedForeground }}>{subtitle}</span> : null}
      </span>
      {badge ? (
        <span className="shrink-0 rounded-full px-2 py-0.5 text-xs" style={{ background: 'hsl(38 92% 50% / 0.15)', color: 'hsl(38 92% 60%)' }}>{badge}</span>
      ) : null}
    </button>
  );
}

function Section({ icon, title, hint, children }: { icon: React.ReactNode; title: string; hint: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl p-5 sm:p-6" style={{ background: colors.card, border: `1px solid ${colors.border}` }}>
      <div className="mb-4 flex items-center gap-2">
        <span style={{ color: colors.primary }}>{icon}</span>
        <h2 className="text-lg font-semibold" style={{ color: colors.foreground }}>{title}</h2>
      </div>
      <p className="mb-4 text-sm" style={{ color: colors.mutedForeground }}>{hint}</p>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

export default function MetaIntelSelectPage() {
  const router = useRouter();
  const [status, setStatus] = useState<MetaStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [adIds, setAdIds] = useState<string[]>([]);
  const [pageId, setPageId] = useState<string | null>(null);
  const [igId, setIgId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await authFetch('/api/meta-intel/status');
        if (res.status === 401) {
          router.replace('/login');
          return;
        }
        const s = (await res.json()) as MetaStatus;
        setStatus(s);
        const by = (k: string) => s.assets.filter((a) => a.kind === k);
        const ads = by('ad_account');
        const pages = by('page');
        const igs = by('ig_account');
        const selAds = ads.filter((a) => a.selected).map((a) => a.metaId);
        // Preselect the only active ad account (account_status 1) so the common case is one click.
        const activeAds = ads.filter((a) => a.accountStatus === 1 || a.accountStatus === null);
        setAdIds(selAds.length ? selAds : activeAds.length === 1 ? [activeAds[0].metaId] : []);
        const selPage = pages.find((p) => p.selected)?.metaId ?? (pages.length === 1 ? pages[0].metaId : null);
        setPageId(selPage);
        const selIg =
          igs.find((i) => i.selected)?.metaId ??
          igs.find((i) => i.parentMetaId === selPage)?.metaId ??
          (igs.length === 1 ? igs[0].metaId : null);
        setIgId(selIg);
      } catch {
        showError('Could not load your Meta accounts. Please try again.');
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  const group = useMemo(() => {
    const a = status?.assets ?? [];
    return {
      ads: a.filter((x) => x.kind === 'ad_account'),
      pages: a.filter((x) => x.kind === 'page'),
      igs: a.filter((x) => x.kind === 'ig_account'),
    };
  }, [status]);

  function choosePage(p: MetaAssetView) {
    setPageId(p.metaId);
    const linked = group.igs.find((i) => i.parentMetaId === p.metaId);
    if (linked) setIgId(linked.metaId);
  }

  async function save() {
    setSaving(true);
    try {
      const res = await authFetch('/api/meta-intel/assets', {
        method: 'POST',
        body: JSON.stringify({ adAccountIds: adIds, pageId, igAccountId: igId }),
      });
      const data = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) throw new Error(data.message || 'Could not save your choice. Please try again.');
      router.push('/meta-intelligence');
    } catch (e) {
      showError((e as Error).message);
      setSaving(false);
    }
  }

  const nothingFound = status?.connected && !group.ads.length && !group.pages.length;
  const canSave = adIds.length > 0 || !!pageId || !!igId;

  return (
    <div className="h-screen flex overflow-hidden app-page" style={{ background: colors.background }}>
      <Head><title>Choose Meta accounts · SkalX</title></Head>
      <Sidebar />
      <main className="min-w-0 flex-1 overflow-y-auto px-4 py-6 sm:px-8 sm:py-10">
        <div className="mx-auto max-w-2xl">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl" style={{ color: colors.foreground }}>
            Which accounts should SkalX use?
          </h1>
          <p className="mt-2 text-[15px]" style={{ color: colors.mutedForeground }}>
            SkalX only reads results. It never changes your ads or posts anything.
          </p>

          {loading ? (
            <div className="mt-10 flex items-center gap-2" style={{ color: colors.mutedForeground }}>
              <Loader2 className="animate-spin" size={18} /> Loading your accounts…
            </div>
          ) : !status?.connected ? (
            <div className="mt-8 rounded-2xl p-6" style={{ background: colors.card, border: `1px solid ${colors.border}` }}>
              <p style={{ color: colors.foreground }}>Your Meta account isn’t connected yet.</p>
              <button
                type="button"
                onClick={async () => { const err = await startMetaConnect(); if (err) showError(err); }}
                className="mt-4 inline-flex h-12 items-center gap-2 rounded-xl px-6 font-semibold"
                style={{ background: '#0866FF', color: '#fff' }}
              >
                <Facebook size={18} /> Connect with Facebook
              </button>
            </div>
          ) : nothingFound ? (
            <div className="mt-8 rounded-2xl p-6" style={{ background: colors.card, border: `1px solid ${colors.border}` }}>
              <p className="font-medium" style={{ color: colors.foreground }}>We couldn’t find any ad accounts or Pages.</p>
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm" style={{ color: colors.mutedForeground }}>
                <li>Make sure you are an admin of the business’s ad account and Facebook Page.</li>
                <li>When Facebook asks which accounts to share, tick them all.</li>
              </ul>
              <button
                type="button"
                onClick={async () => { const err = await startMetaConnect(); if (err) showError(err); }}
                className="mt-5 inline-flex h-12 items-center gap-2 rounded-xl px-6 font-semibold"
                style={{ background: '#0866FF', color: '#fff' }}
              >
                <Facebook size={18} /> Try again
              </button>
            </div>
          ) : (
            <div className="mt-8 space-y-5">
              <Section icon={<Megaphone size={20} />} title="Ad account" hint="Where your ads run. You can pick more than one.">
                {group.ads.length ? group.ads.map((a) => (
                  <Choice
                    key={a.metaId}
                    multi
                    checked={adIds.includes(a.metaId)}
                    onClick={() => setAdIds((prev) => (prev.includes(a.metaId) ? prev.filter((x) => x !== a.metaId) : [...prev, a.metaId]))}
                    title={a.name || `Ad account ${a.metaId}`}
                    subtitle={[a.currency, a.timezoneName, `ID ${a.metaId}`].filter(Boolean).join(' · ')}
                    badge={a.accountStatus && a.accountStatus !== 1 ? AD_ACCOUNT_STATUS[a.accountStatus] ?? 'Not active' : null}
                  />
                )) : <p className="text-sm" style={{ color: colors.mutedForeground }}>No ad accounts shared.</p>}
              </Section>

              <Section icon={<Facebook size={20} />} title="Facebook Page" hint="Your business Page. Pick one.">
                {group.pages.length ? group.pages.map((p) => (
                  <Choice
                    key={p.metaId}
                    checked={pageId === p.metaId}
                    onClick={() => choosePage(p)}
                    title={p.name || p.metaId}
                    subtitle={typeof p.metadata?.category === 'string' ? (p.metadata.category as string) : null}
                  />
                )) : <p className="text-sm" style={{ color: colors.mutedForeground }}>No Pages shared.</p>}
              </Section>

              <Section icon={<Instagram size={20} />} title="Instagram account" hint="Linked to your Facebook Page. Pick one.">
                {group.igs.length ? (
                  <>
                    {group.igs.map((i) => (
                      <Choice
                        key={i.metaId}
                        checked={igId === i.metaId}
                        onClick={() => setIgId(i.metaId)}
                        title={i.name || i.metaId}
                        subtitle={group.pages.find((p) => p.metaId === i.parentMetaId)?.name ? `Linked to ${group.pages.find((p) => p.metaId === i.parentMetaId)?.name}` : null}
                      />
                    ))}
                    <Choice checked={igId === null} onClick={() => setIgId(null)} title="Don’t use Instagram" />
                  </>
                ) : (
                  <p className="text-sm" style={{ color: colors.mutedForeground }}>
                    No Instagram business account is linked to these Pages. You can link one in Instagram settings and reconnect later.
                  </p>
                )}
              </Section>

              <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
                <Link href="/settings?tab=integrations" className="inline-flex h-12 items-center justify-center rounded-xl px-6 text-sm font-medium" style={{ color: colors.mutedForeground }}>
                  Cancel
                </Link>
                <button
                  type="button"
                  onClick={save}
                  disabled={!canSave || saving}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-xl px-8 text-base font-semibold disabled:opacity-50"
                  style={{ background: colors.primary, color: colors.primaryForeground }}
                >
                  {saving ? <Loader2 size={18} className="animate-spin" /> : null}
                  Save and continue
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
