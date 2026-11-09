// /content-studio/test-pack/[id] — review angles → see cost → generate 6 ads → download ZIP → real results.
import React, { useCallback, useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { Check, Copy, Download, Loader2, RefreshCw, Shuffle, Trophy, Quote, Swords, Flag, AlertTriangle, ImageOff, ChevronDown } from 'lucide-react';
import Sidebar from '../../../app/web/src/components/Sidebar';
import colors from '@/lib/ui/colors';
import { authFetch } from '@/lib/utils';
import { showError } from '@/app/web/src/components/ui/alert-modal-api';
import { money, ratio, pct, count } from '@/app/web/src/components/meta-intel/dashboard/format';
import { FORMAT_INFO, type PackAngle, type PackFormat } from '@/lib/test-packs/types';
import type { TestPlan } from '@/lib/test-packs/plan';
import type { PackResults } from '@/lib/test-packs/results';

type Variant = {
  id: string; angleIndex: number; format: PackFormat; adName: string; hook: string | null; primaryText: string | null; headline: string | null;
  whatItTests: string | null; whyItMightWork: string | null; testFirst: boolean; status: string; imageUrl: string | null; error: string | null;
  matchedAdId: string | null; matchedBy: string | null;
};
type PackView = {
  pack: { id: string; status: string; source: string; sourceAd: { name?: string } | null; product: { product_name: string }; angles: PackAngle[]; formats: PackFormat[];
    creditsEstimated: number; creditsCharged: number; testPlan: TestPlan | null; hasZip: boolean; error: string | null };
  variants: Variant[];
  creditBalance: number;
  results: PackResults | null;
};

const SOURCE = {
  past_winner: { label: 'From your winning ad', Icon: Trophy },
  customer_voice: { label: 'From what customers say', Icon: Quote },
  competitor: { label: 'From a competitor gap', Icon: Swords },
} as const;

function CopyButton({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button type="button" aria-label={`Copy ${label}`} onClick={async () => { try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1500); } catch { /* clipboard blocked */ } }}
      className="inline-flex h-7 shrink-0 items-center gap-1 rounded-md px-2 text-[11px] font-medium" style={{ background: colors.muted, color: colors.foreground }}>
      {done ? <Check size={12} /> : <Copy size={12} />} {done ? 'Copied' : 'Copy'}
    </button>
  );
}

const inputStyle: React.CSSProperties = { background: colors.secondary, border: `1px solid ${colors.border}`, color: colors.foreground };

function AngleEditor({ a, index, onChange, onSwap, swapping, disabled }: { a: PackAngle; index: number; onChange: (a: PackAngle) => void; onSwap: () => void; swapping: boolean; disabled: boolean }) {
  const [open, setOpen] = useState(false);
  const s = SOURCE[a.source];
  const field = (key: 'name' | 'hook' | 'message' | 'what_it_tests' | 'why_it_might_work', label: string, multiline = false) => (
    <label className="block">
      <span className="text-[11px] font-medium uppercase tracking-wide" style={{ color: colors.mutedForeground }}>{label}</span>
      {multiline ? (
        <textarea value={a[key]} disabled={disabled} rows={2} onChange={(e) => onChange({ ...a, [key]: e.target.value })} className="mt-1 w-full rounded-lg px-3 py-2 text-sm" style={inputStyle} />
      ) : (
        <input value={a[key]} disabled={disabled} onChange={(e) => onChange({ ...a, [key]: e.target.value })} className="mt-1 w-full rounded-lg px-3 py-2 text-sm" style={inputStyle} />
      )}
    </label>
  );
  return (
    <div className="rounded-2xl p-4" style={{ background: colors.card, border: `1px solid ${colors.border}` }}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-xs font-medium" style={{ color: colors.mutedForeground }}><s.Icon size={13} aria-hidden /> Angle {index + 1} · {s.label}</p>
        <button type="button" onClick={onSwap} disabled={disabled || swapping} className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium disabled:opacity-50" style={{ background: colors.secondary, border: `1px solid ${colors.border}`, color: colors.foreground }}>
          {swapping ? <Loader2 size={12} className="animate-spin" /> : <Shuffle size={12} />} Swap
        </button>
      </div>
      <p className="mb-3 text-xs" style={{ color: colors.mutedForeground }}>Source: {a.source_detail}</p>
      <div className="space-y-3">
        {field('name', 'Angle')}
        {field('hook', 'Hook (the big line on the poster)')}
        {field('message', 'What the ad says', true)}
        {field('what_it_tests', 'What it tests', true)}
        {field('why_it_might_work', 'Why it might work', true)}
      </div>
      <button type="button" onClick={() => setOpen((o) => !o)} className="mt-3 inline-flex items-center gap-1 text-xs font-medium" style={{ color: colors.accentForeground }}>
        <ChevronDown size={12} style={{ transform: open ? 'rotate(180deg)' : undefined }} /> Ad copy for feed and story
      </button>
      {open ? (
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {(['feed', 'story'] as PackFormat[]).map((f) => (
            <div key={f} className="space-y-2">
              <p className="text-xs font-semibold" style={{ color: colors.foreground }}>{FORMAT_INFO[f].label}</p>
              <input value={a.copy[f].headline} disabled={disabled} onChange={(e) => onChange({ ...a, copy: { ...a.copy, [f]: { ...a.copy[f], headline: e.target.value } } })} className="w-full rounded-lg px-3 py-2 text-sm" style={inputStyle} aria-label={`${f} headline`} />
              <textarea value={a.copy[f].primary_text} disabled={disabled} rows={3} onChange={(e) => onChange({ ...a, copy: { ...a.copy, [f]: { ...a.copy[f], primary_text: e.target.value } } })} className="w-full rounded-lg px-3 py-2 text-sm" style={inputStyle} aria-label={`${f} primary text`} />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ResultLine({ v, results }: { v: Variant; results: PackResults | null }) {
  if (!results?.connected) return <p className="text-xs" style={{ color: colors.mutedForeground }}>Connect Meta to see how this ad does.</p>;
  const r = results.byVariant[v.id];
  if (!r) return <p className="text-xs" style={{ color: colors.mutedForeground }}>Not live yet. Name the ad <span className="font-mono">{v.adName}</span> in Ads Manager and results appear here after the next sync.</p>;
  const leader = results.leaderVariantId === v.id;
  return (
    <div className="rounded-lg p-2 text-xs" style={{ background: colors.muted }}>
      <p className="mb-1 font-semibold" style={{ color: leader ? 'hsl(142 70% 50%)' : colors.foreground }}>{leader ? '🏆 Leading so far' : r.enoughData ? 'Live results' : 'Live — too early to judge'}</p>
      <p className="tabular-nums" style={{ color: colors.secondaryForeground }}>
        Spend {money(r.spend, results.currency)} · ROAS {ratio(r.roas)} · Cost/purchase {money(r.cpa, results.currency)} · CTR {pct(r.ctr)} · {count(r.purchases)} purchases
      </p>
    </div>
  );
}

function VariantCard({ v, angle, results }: { v: Variant; angle: PackAngle | undefined; results: PackResults | null }) {
  return (
    <div className="flex flex-col rounded-2xl p-3" style={{ background: colors.card, border: `1px solid ${v.testFirst ? colors.primary : colors.border}` }}>
      <div className="relative overflow-hidden rounded-xl" style={{ background: colors.muted, aspectRatio: v.format === 'feed' ? '4 / 5' : '9 / 16', maxHeight: 420 }}>
        {v.status === 'ready' && v.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={v.imageUrl} alt={`${angle?.name ?? ''} ${v.format}`} className="h-full w-full object-contain" />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-4 text-center text-xs" style={{ color: colors.mutedForeground }}>
            {v.status === 'failed' ? <><AlertTriangle size={18} /> {v.error || 'This one didn’t come out right.'} No credit was charged.</>
              : v.status === 'generating' ? <><Loader2 size={18} className="animate-spin" /> Making this ad…</>
              : v.status === 'pending' ? <><Loader2 size={18} className="animate-spin opacity-40" /> Waiting…</>
              : <ImageOff size={18} />}
          </div>
        )}
        {v.testFirst ? <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: colors.primary, color: colors.primaryForeground }}><Flag size={11} aria-hidden /> Test first</span> : null}
      </div>
      <div className="mt-3 space-y-2 text-sm">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate font-mono text-[11px]" style={{ color: colors.mutedForeground }} title={v.adName}>{v.adName}</p>
          <CopyButton text={v.adName} label="ad name" />
        </div>
        <p className="font-semibold" style={{ color: colors.foreground }}>{angle?.name} · {FORMAT_INFO[v.format].label}</p>
        <p className="italic" style={{ color: colors.secondaryForeground }}>“{v.hook}”</p>
        <p className="text-xs" style={{ color: colors.mutedForeground }}><span className="font-semibold" style={{ color: colors.foreground }}>Tests:</span> {v.whatItTests}</p>
        <p className="text-xs" style={{ color: colors.mutedForeground }}><span className="font-semibold" style={{ color: colors.foreground }}>Why it might work:</span> {v.whyItMightWork}</p>
        <div className="rounded-lg p-2" style={{ background: colors.secondary }}>
          <div className="flex items-start justify-between gap-2"><p className="text-xs font-semibold" style={{ color: colors.foreground }}>{v.headline}</p><CopyButton text={v.headline ?? ''} label="headline" /></div>
          <div className="mt-1 flex items-start justify-between gap-2"><p className="text-xs" style={{ color: colors.secondaryForeground }}>{v.primaryText}</p><CopyButton text={v.primaryText ?? ''} label="primary text" /></div>
        </div>
        {v.status === 'ready' ? <ResultLine v={v} results={results} /> : null}
      </div>
    </div>
  );
}

export default function TestPackPage() {
  const router = useRouter();
  const id = typeof router.query.id === 'string' ? router.query.id : null;
  const [view, setView] = useState<PackView | null>(null);
  const [angles, setAngles] = useState<PackAngle[]>([]);
  const [dirty, setDirty] = useState(false);
  const [swapping, setSwapping] = useState<number | null>(null);
  const [starting, setStarting] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    const res = await authFetch(`/api/test-packs/${id}`);
    if (res.status === 401) { router.replace('/login'); return; }
    if (!res.ok) { showError('Could not load this test pack.'); return; }
    const body = (await res.json()) as PackView;
    setView(body);
    setAngles((prev) => (dirty && body.pack.status === 'draft' ? prev : (body.pack.angles as PackAngle[])));
  }, [id, router, dirty]);

  useEffect(() => { void load(); }, [load]);

  const status = view?.pack.status;
  useEffect(() => {
    if (status !== 'generating') return;
    const t = setInterval(() => void load(), 6000);
    return () => clearInterval(t);
  }, [status, load]);

  async function saveEdits(): Promise<boolean> {
    if (!dirty || !id) return true;
    const res = await authFetch(`/api/test-packs/${id}`, { method: 'PATCH', body: JSON.stringify({ angles }) });
    if (!res.ok) { showError('Could not save your edits.'); return false; }
    setDirty(false);
    return true;
  }

  async function swap(i: number) {
    if (!id) return;
    setSwapping(i);
    try {
      if (!(await saveEdits())) return;
      const res = await authFetch(`/api/test-packs/${id}/swap`, { method: 'POST', body: JSON.stringify({ index: i }) });
      const body = (await res.json().catch(() => ({}))) as { angles?: PackAngle[]; message?: string };
      if (!res.ok || !body.angles) throw new Error(body.message || 'Could not find another angle. Try again.');
      setAngles(body.angles);
    } catch (e) {
      showError((e as Error).message);
    } finally {
      setSwapping(null);
    }
  }

  async function generate() {
    if (!id) return;
    setStarting(true);
    try {
      if (!(await saveEdits())) return;
      const res = await authFetch(`/api/test-packs/${id}/generate`, { method: 'POST' });
      const body = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) throw new Error(body.message || 'Could not start making the ads.');
      await load();
    } catch (e) {
      showError((e as Error).message);
    } finally {
      setStarting(false);
    }
  }

  async function download() {
    if (!id) return;
    setDownloading(true);
    try {
      const res = await authFetch(`/api/test-packs/${id}/zip`);
      const body = (await res.json().catch(() => ({}))) as { url?: string; message?: string };
      if (!res.ok || !body.url) throw new Error(body.message || 'Could not prepare the download.');
      window.location.href = body.url;
    } catch (e) {
      showError((e as Error).message);
    } finally {
      setDownloading(false);
    }
  }

  const p = view?.pack;
  const plan = p?.testPlan;
  const formatCount = p?.formats?.length || 2;
  const adCount = p ? (p.status === 'draft' ? angles.length * formatCount : view!.variants.length) : 0;
  const needed = p ? (p.status === 'draft' ? p.creditsEstimated : new Set(view!.variants.filter((v) => v.status !== 'ready').map((v) => v.angleIndex)).size * formatCount) : 0;
  const enough = (view?.creditBalance ?? 0) >= needed;
  const ready = view?.variants.filter((v) => v.status === 'ready').length ?? 0;

  return (
    <div className="h-screen flex overflow-hidden app-page" style={{ background: colors.background }}>
      <Head><title>Test pack | SkalX AI</title></Head>
      <Sidebar />
      <main className="min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
          {!view || !p ? (
            <p className="flex items-center gap-2" style={{ color: colors.mutedForeground }}><Loader2 size={16} className="animate-spin" /> Loading…</p>
          ) : (
            <>
              <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide" style={{ color: colors.mutedForeground }}>Test pack · {p.product.product_name}</p>
                  <h1 className="mt-1 text-2xl font-semibold" style={{ color: colors.foreground }}>
                    {p.status === 'draft' ? `Check the ${angles.length} angles` : p.status === 'generating' ? `Making your ads… ${ready} of ${view.variants.length} done` : p.status === 'failed' ? 'The ads couldn’t be made' : p.status === 'partial' ? `${ready} of ${view.variants.length} ads are ready` : `Your ${view.variants.length} ads are ready`}
                  </h1>
                  {p.sourceAd?.name ? <p className="mt-1 text-sm" style={{ color: colors.mutedForeground }}>Built on your winning ad “{p.sourceAd.name}”.</p> : null}
                </div>
                {['ready', 'partial'].includes(p.status) ? (
                  <button type="button" onClick={download} disabled={downloading} className="inline-flex h-12 items-center justify-center gap-2 rounded-xl px-6 font-semibold disabled:opacity-60" style={{ background: colors.primary, color: colors.primaryForeground }}>
                    {downloading ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />} Download all (ZIP)
                  </button>
                ) : null}
              </header>

              {p.status === 'draft' ? (
                <>
                  <p className="mt-2 text-sm" style={{ color: colors.mutedForeground }}>Edit anything you like, or swap an angle for a different one. {formatCount === 2 ? 'Each angle becomes a feed post and a story.' : 'Each angle becomes a feed post.'}</p>
                  <div className="mt-5 grid gap-4 lg:grid-cols-3">
                    {angles.map((a, i) => (
                      <AngleEditor key={i} a={a} index={i} disabled={starting} swapping={swapping === i}
                        onChange={(next) => { setAngles((prev) => prev.map((x, j) => (j === i ? next : x))); setDirty(true); }}
                        onSwap={() => void swap(i)} />
                    ))}
                  </div>
                  <section className="mt-6 flex flex-col gap-4 rounded-2xl p-5 sm:flex-row sm:items-center sm:justify-between" style={{ background: colors.card, border: `1px solid ${colors.border}` }}>
                    <div>
                      <p className="text-base font-semibold" style={{ color: colors.foreground }}>{adCount} ads · {p.creditsEstimated} image credits</p>
                      <p className="text-sm" style={{ color: enough ? colors.mutedForeground : 'hsl(0 84% 62%)' }}>
                        You have {view.creditBalance} image credits.{!enough ? ' Not enough for this pack.' : ''} Credits are only used for ads that come out right.
                      </p>
                    </div>
                    {enough ? (
                      <button type="button" onClick={generate} disabled={starting || swapping !== null} className="inline-flex h-12 items-center justify-center gap-2 rounded-xl px-6 font-semibold disabled:opacity-60" style={{ background: colors.primary, color: colors.primaryForeground }}>
                        {starting ? <Loader2 size={18} className="animate-spin" /> : null} Make {adCount} ads
                      </button>
                    ) : (
                      <Link href="/buy-credits" className="inline-flex h-12 items-center justify-center rounded-xl px-6 font-semibold" style={{ background: colors.primary, color: colors.primaryForeground }}>Get more credits</Link>
                    )}
                  </section>
                </>
              ) : (
                <>
                  {p.error ? <p className="mt-3 text-sm" style={{ color: 'hsl(0 84% 62%)' }}>{p.error}</p> : null}
                  {['partial', 'failed'].includes(p.status) ? (
                    <button type="button" onClick={generate} disabled={starting || !enough} className="mt-3 inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-semibold disabled:opacity-60" style={{ background: colors.secondary, border: `1px solid ${colors.border}`, color: colors.foreground }}>
                      {starting ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Try the missing ones again ({needed} credits)
                    </button>
                  ) : null}
                  <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {view.variants.map((v) => <VariantCard key={v.id} v={v} angle={(p.angles as PackAngle[])[v.angleIndex]} results={view.results} />)}
                  </div>
                  {plan ? (
                    <section className="mt-6 rounded-2xl p-5" style={{ background: colors.card, border: `1px solid ${colors.border}` }}>
                      <h2 className="text-base font-semibold" style={{ color: colors.foreground }}>How to run this test</h2>
                      <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm" style={{ color: colors.secondaryForeground }}>
                        {plan.steps.map((s, i) => <li key={i}>{s}</li>)}
                      </ol>
                    </section>
                  ) : null}
                </>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
