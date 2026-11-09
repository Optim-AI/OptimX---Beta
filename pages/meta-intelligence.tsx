// /meta-intelligence — Ad Performance dashboard (Meta Intelligence Phase 3).
import React, { useCallback, useEffect, useRef, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { AlertTriangle, Loader2, RefreshCw, TrendingUp } from 'lucide-react';
import Sidebar from '../app/web/src/components/Sidebar';
import ComingSoonGate from '@/app/web/src/components/ui/ComingSoonGate';
import { AD_PERFORMANCE_LIVE } from '@/lib/launch-flags';
import colors from '@/lib/ui/colors';
import { authFetch } from '@/lib/utils';
import { showError } from '@/app/web/src/components/ui/alert-modal-api';
import { startMetaConnect } from '@/app/web/src/components/meta-intel/startMetaConnect';
import KpiCards from '@/app/web/src/components/meta-intel/dashboard/KpiCards';
import TrendChart from '@/app/web/src/components/meta-intel/dashboard/TrendChart';
import AdsLeaderboard from '@/app/web/src/components/meta-intel/dashboard/AdsLeaderboard';
import SkalxComparison from '@/app/web/src/components/meta-intel/dashboard/SkalxComparison';
import TopPosts from '@/app/web/src/components/meta-intel/dashboard/TopPosts';
import InsightsPanel from '@/app/web/src/components/meta-intel/dashboard/InsightsPanel';
import EmptyState from '@/app/web/src/components/meta-intel/dashboard/EmptyState';
import BriefCard from '@/app/web/src/components/meta-intel/dashboard/BriefCard';
import ConnectedStrip from '@/app/web/src/components/meta-intel/dashboard/ConnectedStrip';
import PostCharts from '@/app/web/src/components/meta-intel/dashboard/PostCharts';
import { InstagramTrendsTab, CompetitorsTab } from '@/app/web/src/components/meta-intel/instagram/InstagramTabs';
import { money, shortDate } from '@/app/web/src/components/meta-intel/dashboard/format';
import type { DashboardPayload } from '@/lib/meta-intel/summary';

const RANGES = [7, 14, 30, 90] as const;

function Banner({ tone, children }: { tone: 'warn' | 'info'; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-xl px-4 py-3 text-sm"
      style={{ background: tone === 'warn' ? 'hsl(38 92% 50% / 0.12)' : colors.muted, color: colors.foreground, border: `1px solid ${tone === 'warn' ? 'hsl(38 92% 50% / 0.35)' : colors.border}` }}>
      {tone === 'warn' ? <AlertTriangle size={16} className="mt-0.5 shrink-0" style={{ color: 'hsl(38 92% 60%)' }} /> : <Loader2 size={16} className="mt-0.5 shrink-0 animate-spin" />}
      <div>{children}</div>
    </div>
  );
}

type Tab = 'results' | 'instagram' | 'competitors';
const TABS: { id: Tab; label: string }[] = [
  { id: 'results', label: 'Your results' },
  { id: 'instagram', label: 'Instagram trends' },
  { id: 'competitors', label: 'Competitors' },
];

export default function MetaIntelligencePage() {
  const router = useRouter();
  const [range, setRange] = useState<(typeof RANGES)[number]>(30);
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const tab: Tab = router.query.tab === 'instagram' || router.query.tab === 'competitors' ? router.query.tab : 'results';
  const chooseTab = (t: Tab) => { void router.replace({ query: { ...router.query, tab: t === 'results' ? undefined : t } }, undefined, { shallow: true }); };

  useEffect(() => {
    const q = Number(router.query.range);
    if ((RANGES as readonly number[]).includes(q)) setRange(q as (typeof RANGES)[number]);
  }, [router.query.range]);

  // Only the latest request may update the page (a slow 30d response must not overwrite 7d).
  const requestSeq = useRef(0);
  const load = useCallback(async (silent = false) => {
    const seq = ++requestSeq.current;
    if (!silent) setLoading(true);
    try {
      const res = await authFetch(`/api/meta-intel/dashboard?range=${range}`);
      if (seq !== requestSeq.current) return;
      if (res.status === 401) {
        router.replace('/login');
        return;
      }
      if (!res.ok) throw new Error(String(res.status));
      const body = (await res.json()) as DashboardPayload;
      if (seq !== requestSeq.current) return;
      setData(body);
      setError(false);
    } catch {
      if (seq === requestSeq.current) setError(true);
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }, [range, router]);

  useEffect(() => {
    if (!router.isReady) return;
    void load();
  }, [load, router.isReady]);

  // While a sync is running, refresh quietly.
  useEffect(() => {
    if (!data?.syncing) return;
    const t = setInterval(() => void load(true), 10_000);
    return () => clearInterval(t);
  }, [data?.syncing, load]);

  const chooseRange = (r: (typeof RANGES)[number]) => {
    setRange(r);
    router.replace({ pathname: router.pathname, query: { ...router.query, range: r } }, undefined, { shallow: true });
  };

  const connect = async () => {
    const err = await startMetaConnect();
    if (err) showError(err);
  };

  const ready = data?.state === 'ready';

  return (
    <div className="h-screen flex overflow-hidden app-page" style={{ background: colors.background }}>
      <Head><title>Ad Performance | SkalX AI</title></Head>
      <Sidebar />
      <div className="relative min-w-0 flex-1 overflow-hidden">
      {!AD_PERFORMANCE_LIVE && <ComingSoonGate Icon={TrendingUp} title="Ad Performance is on its way" body="See what your Facebook and Instagram ads and posts are really doing, in plain words, with what to do next. We’ll let you know as soon as it’s ready." onBack={() => router.push('/brand-studio')} />}
      <main className={`h-full min-w-0 overflow-y-auto ${AD_PERFORMANCE_LIVE ? '' : 'pointer-events-none select-none blur-[6px] opacity-60'}`} aria-hidden={!AD_PERFORMANCE_LIVE} inert={!AD_PERFORMANCE_LIVE || undefined}>
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
          <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-2xl font-semibold" style={{ color: colors.foreground }}>Ad Performance</h1>
              <p className="mt-1 text-sm" style={{ color: colors.mutedForeground }}>
                {ready && data
                  ? <>Your Meta results, {shortDate(data.period.since)} – {shortDate(data.period.until)}, compared with the {data.range} days before.{data.lastSyncAt ? ` Updated ${new Date(data.lastSyncAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}.` : ''}</>
                  : 'Real spend, sales and your best ads from Facebook and Instagram.'}
              </p>
            </div>
            {ready && tab === 'results' ? (
              <div className="flex items-center gap-2">
                <div className="inline-flex rounded-lg p-1" role="tablist" aria-label="Date range" style={{ background: colors.muted, border: `1px solid ${colors.border}` }}>
                  {RANGES.map((r) => (
                    <button key={r} type="button" role="tab" aria-selected={range === r} onClick={() => chooseRange(r)}
                      className="rounded-md px-3 py-1.5 text-sm font-medium"
                      style={{ background: range === r ? colors.primary : 'transparent', color: range === r ? colors.primaryForeground : colors.mutedForeground }}>
                      {r}d
                    </button>
                  ))}
                </div>
                <button type="button" onClick={() => void load()} aria-label="Refresh" className="flex h-9 w-9 items-center justify-center rounded-lg"
                  style={{ background: colors.secondary, border: `1px solid ${colors.border}`, color: colors.mutedForeground }}>
                  <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
                </button>
              </div>
            ) : null}
          </header>

          {ready ? <ConnectedStrip /> : null}

          {ready ? (
            <div className="mt-5 flex gap-1 overflow-x-auto border-b" role="tablist" aria-label="Ad Performance sections" style={{ borderColor: colors.border }}>
              {TABS.map((t) => (
                <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => chooseTab(t.id)}
                  className="-mb-px whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium"
                  style={{ borderColor: tab === t.id ? colors.primary : 'transparent', color: tab === t.id ? colors.foreground : colors.mutedForeground }}>
                  {t.label}
                </button>
              ))}
            </div>
          ) : null}

          {ready && tab === 'instagram' ? <InstagramTrendsTab /> : ready && tab === 'competitors' ? <CompetitorsTab /> : (<>

          {loading && !data ? (
            <div className="mt-10 flex items-center gap-2" style={{ color: colors.mutedForeground }}>
              <Loader2 size={18} className="animate-spin" /> Loading your results…
            </div>
          ) : error && !data ? (
            <div className="mt-6"><Banner tone="warn">We couldn’t load your results. <button type="button" className="underline" onClick={() => void load()}>Try again</button></Banner></div>
          ) : !data ? null : data.state === 'not_connected' ? (
            <EmptyState kind="not_connected" onConnect={connect} />
          ) : data.state === 'needs_selection' ? (
            <EmptyState kind="needs_selection" />
          ) : data.state === 'syncing' ? (
            <EmptyState kind="syncing" />
          ) : data.state === 'reconnect' ? (
            <EmptyState kind="reconnect" onConnect={connect} />
          ) : (
            <div className="mt-6 space-y-5">
              {data.needsReconnect ? (
                <Banner tone="warn">
                  Your Meta access has stopped working, so these numbers may be out of date. <button type="button" className="font-semibold underline" onClick={connect}>Reconnect</button>
                </Banner>
              ) : null}
              {data.syncing ? <Banner tone="info">Syncing your latest results from Meta…</Banner> : null}
              {data.mixedCurrency ? (
                <Banner tone="warn">Showing only ad accounts in {data.currency}. Not included: {data.excludedAccounts.join(', ')}.</Banner>
              ) : null}
              {!data.hasAdAccounts || data.dataState === 'empty' ? (
                <>
                  {!data.hasAdAccounts
                    ? <Banner tone="warn">No ad account is linked, so only organic posts are shown. <Link className="font-semibold underline" href="/integrations/meta-intel/select">Link an ad account</Link></Banner>
                    : <EmptyState kind="empty" />}
                  {data.hasOrganicAccounts ? <InsightsPanel dataState={data.dataState} ads={data.ads} postsOnly /> : null}
                </>
              ) : (
                <>
                  {data.dataState === 'limited' ? (
                    <Banner tone="warn">
                      Not enough data yet: these ads have spent under {money(data.minSpend, data.currency)} in this period, so treat the numbers as early signals. Try a longer date range.
                    </Banner>
                  ) : null}
                  <KpiCards data={data} />
                  <BriefCard />
                  <InsightsPanel dataState={data.dataState} ads={data.ads} />
                  <TrendChart points={data.trend} currency={data.currency} />
                  <AdsLeaderboard ads={data.ads} currency={data.currency} />
                  <SkalxComparison data={data} />
                </>
              )}
              {data.hasOrganicAccounts ? <PostCharts /> : null}
              <TopPosts posts={data.organic} hasOrganicAccounts={data.hasOrganicAccounts} />
            </div>
          )}
          </>)}
        </div>
      </main>
      </div>
    </div>
  );
}
