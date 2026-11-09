// /content-studio/posters/[id] — draft posters fill in as they're drawn; keep the ones you like, pay only for those.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { Check, ChevronDown, Copy, Download, Loader2, RefreshCw, Sparkles, AlertTriangle, Search, Eye, Pencil, MessageSquareText, Maximize2 } from 'lucide-react';
import FeedPreview from '@/app/web/src/components/ad-studio/FeedPreview';
import EditDialog from '@/app/web/src/components/ad-studio/EditDialog';
import ChatPanel from '@/app/web/src/components/ad-studio/ChatPanel';
import Sidebar from '../../../app/web/src/components/Sidebar';
import colors from '@/lib/ui/colors';
import { authFetch } from '@/lib/utils';
import { showError, showConfirm } from '@/app/web/src/components/ui/alert-modal-api';
import { AD_FORMATS, AD_FORMAT_KEYS, type AdFormat } from '@/lib/ad-studio/options';
import type { DraftWhy } from '@/lib/ad-studio/why';
import type { PosterResults } from '@/lib/ad-studio/results';
import type { TestPlan } from '@/lib/test-packs/plan';
import { money, ratio, pct, count } from '@/app/web/src/components/meta-intel/dashboard/format';

type Draft = { id: string; round: number; position: number; format: string; kind: string; parentId: string | null; status: string; error: string | null; imageUrl: string | null; kept: boolean; adName: string | null; headline: string | null; primaryText: string | null; matchedAdId: string | null; angleName: string; message: string; why: DraftWhy };
type View = {
  project: { id: string; status: string; goal: string; goalLabel: string; formats: string[]; offer: string | null; direction: string | null; rounds: number; error: string | null; product: { name: string; image: string | null }; brandName: string | null; working: boolean };
  drafts: Draft[];
  credits: number;
  results: PosterResults | null;
  testPlan: TestPlan | null;
  draftsLeftToday: number;
  nextRoundSize: number;
};

const GOOD = 'hsl(142 70% 50%)';
const aspectCss = (format: string) => {
  const a = AD_FORMATS[format as AdFormat]?.aspect ?? '4:5';
  return a === '1.91:1' ? '1.91 / 1' : a.replace(':', ' / ');
};

function WhyBox({ why }: { why: DraftWhy }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-2">
      <button type="button" onClick={() => setOpen((o) => !o)} className="inline-flex items-center gap-1 text-xs font-medium" style={{ color: colors.accentForeground }} aria-expanded={open}>
        <ChevronDown size={12} style={{ transform: open ? 'rotate(180deg)' : undefined }} aria-hidden /> Why we suggested it
      </button>
      {open ? (
        <dl className="mt-2 space-y-1.5 text-xs" style={{ color: colors.secondaryForeground }}>
          <div><dt className="inline font-semibold" style={{ color: colors.foreground }}>For: </dt><dd className="inline">{why.forWho}</dd></div>
          {why.whyItMightWork ? <div><dt className="inline font-semibold" style={{ color: colors.foreground }}>Why it might work: </dt><dd className="inline">{why.whyItMightWork}</dd></div> : null}
          {why.whatItTests ? <div><dt className="inline font-semibold" style={{ color: colors.foreground }}>What it tests: </dt><dd className="inline">{why.whatItTests}</dd></div> : null}
          <div><dt className="inline font-semibold" style={{ color: colors.foreground }}>Based on: </dt><dd className="inline">{why.source}{why.evidence ? ` — ${why.evidence}` : ''}</dd></div>
        </dl>
      ) : null}
    </div>
  );
}

function CopyBtn({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button type="button" aria-label={`Copy ${label}`} onClick={async () => { try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1500); } catch { /* clipboard blocked */ } }}
      className="inline-flex h-6 shrink-0 items-center gap-1 rounded px-1.5 text-[10px] font-medium" style={{ background: colors.muted, color: colors.foreground }}>
      {done ? <Check size={11} /> : <Copy size={11} />} {done ? 'Copied' : 'Copy'}
    </button>
  );
}

function Field({ label, text, mono, strong }: { label: string; text: string; mono?: boolean; strong?: boolean }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: colors.mutedForeground }}>{label}</span>
        <CopyBtn text={text} label={label.toLowerCase()} />
      </div>
      <p className={`mt-0.5 ${mono ? 'break-all font-mono text-[10px]' : ''} ${strong ? 'font-semibold' : ''}`} style={{ color: strong ? colors.foreground : colors.secondaryForeground }}>{text}</p>
    </div>
  );
}

function KeptDetails({ d, results }: { d: Draft; results: PosterResults | null }) {
  if (!d.kept || !d.adName) return null;
  const r = results?.byDraft[d.id] ?? null;
  const leader = results?.leaderDraftId === d.id;
  return (
    <div className="mt-2 space-y-2 rounded-lg p-2 text-xs" style={{ background: colors.secondary }}>
      <Field label="Ad name" text={d.adName} mono />
      {d.headline ? <Field label="Headline" text={d.headline} strong /> : null}
      {d.primaryText ? <Field label="Primary text" text={d.primaryText} /> : null}
      {!results?.connected ? null : r ? (
        <div className="rounded-md p-1.5 tabular-nums" style={{ background: colors.muted }}>
          <p className="font-semibold" style={{ color: leader ? GOOD : colors.foreground }}>{leader ? '🏆 Leading so far' : r.enoughData ? 'Live on Meta' : 'Live — too early to judge'}</p>
          <p style={{ color: colors.secondaryForeground }}>
            {money(r.spend, results.currency)} spent · ROAS {ratio(r.roas)} · {money(r.cpa, results.currency)} per purchase · CTR {pct(r.ctr)} · {count(r.purchases)} purchases
          </p>
        </div>
      ) : (
        <p style={{ color: colors.mutedForeground }}>Not live yet — use this ad name in Ads Manager and results show here after the next sync.</p>
      )}
    </div>
  );
}

type CardActions = { onPreview: () => void; onEdit: () => void; onAddSize: (f: AdFormat) => void; existingSizes: string[] };

function DraftCard({ d, picked, onToggle, actions, results }: { d: Draft; picked: boolean; onToggle: () => void; actions: CardActions; results: PosterResults | null }) {
  const selectable = d.status === 'ready' && !d.kept;
  const border = d.kept ? GOOD : picked ? colors.primary : colors.border;
  return (
    <div className="flex flex-col rounded-2xl p-3" style={{ background: colors.card, border: `2px solid ${border}` }}>
      <button type="button" onClick={selectable ? onToggle : undefined} disabled={!selectable} aria-pressed={selectable ? picked : undefined}
        aria-label={selectable ? (picked ? 'Don’t keep this poster' : 'Keep this poster') : undefined}
        className="relative block w-full overflow-hidden rounded-xl text-left" style={{ background: colors.muted, aspectRatio: aspectCss(d.format), cursor: selectable ? 'pointer' : 'default' }}>
        {d.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={d.imageUrl} alt={`Poster: ${d.angleName}`} className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full w-full flex-col items-center justify-center gap-2 p-4 text-center text-xs" style={{ color: colors.mutedForeground }}>
            {d.status === 'failed' ? <><AlertTriangle size={18} /> This one didn’t come out right.</> : <><Loader2 size={18} className="animate-spin" /> Drawing…</>}
          </span>
        )}
        {d.kept ? (
          <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: GOOD, color: '#06210f' }}><Check size={11} /> Kept</span>
        ) : selectable ? (
          <span className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full" style={{ background: picked ? colors.primary : 'rgba(0,0,0,0.55)', border: '2px solid #fff' }}>
            {picked ? <Check size={15} color="#fff" strokeWidth={3} /> : null}
          </span>
        ) : null}
      </button>
      <div className="mt-2 flex items-start justify-between gap-2">
        <p className="text-sm font-medium" style={{ color: colors.foreground }}>
          {d.angleName || 'Poster'}
          {d.kind === 'edit' ? <span className="ml-1.5 rounded px-1.5 py-0.5 text-[10px] font-semibold" style={{ background: colors.muted, color: colors.mutedForeground }}>Edited</span> : null}
          {d.kind === 'format' ? <span className="ml-1.5 rounded px-1.5 py-0.5 text-[10px] font-semibold" style={{ background: colors.muted, color: colors.mutedForeground }}>{AD_FORMATS[d.format as AdFormat]?.label ?? d.format}</span> : null}
        </p>
        {d.kept && d.imageUrl ? (
          <a href={d.imageUrl} download target="_blank" rel="noopener noreferrer" className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg px-2.5 text-xs font-semibold" style={{ background: colors.secondary, border: `1px solid ${colors.border}`, color: colors.foreground }}>
            <Download size={12} /> Download
          </a>
        ) : selectable ? (
          <button type="button" onClick={onToggle} className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg px-2.5 text-xs font-semibold"
            style={picked ? { background: colors.primary, color: colors.primaryForeground } : { background: colors.secondary, border: `1px solid ${colors.border}`, color: colors.foreground }}>
            {picked ? <><Check size={12} /> Keeping</> : 'Keep'}
          </button>
        ) : null}
      </div>
      {d.status === 'ready' && d.imageUrl ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          <button type="button" onClick={actions.onPreview} className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-[11px] font-medium" style={{ background: colors.secondary, color: colors.foreground }}><Eye size={12} /> Preview in feed</button>
          <button type="button" onClick={actions.onEdit} className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-[11px] font-medium" style={{ background: colors.secondary, color: colors.foreground }}><Pencil size={12} /> Edit</button>
          {d.kept && d.kind !== 'format' ? (
            <label className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-[11px] font-medium" style={{ background: colors.secondary, color: colors.foreground }}>
              <Maximize2 size={12} aria-hidden />
              <select aria-label="Add another size" value="" onChange={(e) => e.target.value && actions.onAddSize(e.target.value as AdFormat)} className="bg-transparent text-[11px] outline-none">
                <option value="">More sizes · 1 credit</option>
                {AD_FORMAT_KEYS.filter((f) => f !== d.format && !actions.existingSizes.includes(f)).map((f) => <option key={f} value={f}>{AD_FORMATS[f].label} ({AD_FORMATS[f].aspect})</option>)}
              </select>
            </label>
          ) : null}
        </div>
      ) : null}
      <KeptDetails d={d} results={results} />
      {d.status === 'failed' && d.error ? <p className="mt-1 text-[11px]" style={{ color: colors.mutedForeground }}>{d.error}</p> : null}
      {d.status !== 'failed' ? <WhyBox why={d.why} /> : null}
    </div>
  );
}

export default function PosterProjectPage() {
  const router = useRouter();
  const id = typeof router.query.id === 'string' ? router.query.id : null;
  const [view, setView] = useState<View | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [paying, setPaying] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [startingRound, setStartingRound] = useState(false);
  const [previewing, setPreviewing] = useState<Draft | null>(null);
  const [editing, setEditing] = useState<Draft | null>(null);
  const [chatOpen, setChatOpen] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    const res = await authFetch(`/api/ad-studio/projects/${id}`);
    if (res.status === 401) { router.replace('/login'); return; }
    if (!res.ok) { showError('Could not load these posters.'); return; }
    setView((await res.json()) as View);
  }, [id, router]);

  useEffect(() => { void load(); }, [load]);

  const busy = view?.project.status === 'researching' || view?.project.status === 'drawing' || !!view?.project.working;
  useEffect(() => {
    if (!busy) return;
    const t = setInterval(() => void load(), 5000);
    return () => clearInterval(t);
  }, [busy, load]);

  const rounds = useMemo(() => {
    const by = new Map<number, Draft[]>();
    for (const d of view?.drafts ?? []) by.set(d.round, [...(by.get(d.round) ?? []), d]);
    return [...by.entries()].sort((a, b) => b[0] - a[0]);
  }, [view]);

  const toggle = (draftId: string) => setPicked((prev) => {
    const next = new Set(prev);
    if (next.has(draftId)) next.delete(draftId); else next.add(draftId);
    return next;
  });

  async function keep() {
    if (!id || !picked.size) return;
    const n = picked.size;
    const ok = await showConfirm(`Keep ${n} poster${n > 1 ? 's' : ''} for ${n} image credit${n > 1 ? 's' : ''}? You’ll get the full-quality file${n > 1 ? 's' : ''} to download.`, { title: 'Get my ads', confirmLabel: `Keep ${n} · ${n} credit${n > 1 ? 's' : ''}`, cancelLabel: 'Not yet' });
    if (!ok) return;
    setPaying(true);
    try {
      const res = await authFetch(`/api/ad-studio/projects/${id}/keep`, { method: 'POST', body: JSON.stringify({ draftIds: [...picked] }) });
      const body = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) throw new Error(body.message || 'Could not keep these posters.');
      setPicked(new Set());
      await load();
    } catch (e) {
      showError((e as Error).message);
    } finally {
      setPaying(false);
    }
  }

  async function moreRound(explicit?: string) {
    if (!id) return;
    setStartingRound(true);
    try {
      const fb = (explicit ?? feedback).trim();
      const res = await authFetch(`/api/ad-studio/projects/${id}/rounds`, { method: 'POST', body: JSON.stringify({ feedback: fb || undefined }) });
      const body = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) throw new Error(body.message || 'Could not make more posters.');
      setFeedback('');
      await load();
    } catch (e) {
      showError((e as Error).message);
    } finally {
      setStartingRound(false);
    }
  }

  const [downloading, setDownloading] = useState(false);
  async function downloadAll() {
    setDownloading(true);
    try {
      const res = await authFetch(`/api/ad-studio/projects/${id}/download`);
      const body = (await res.json().catch(() => ({}))) as { url?: string; message?: string };
      if (!res.ok || !body.url) throw new Error(body.message || 'Could not prepare the download.');
      window.location.href = body.url;
    } catch (e) {
      showError((e as Error).message);
    } finally {
      setDownloading(false);
    }
  }

  async function submitEdit(d: Draft, instruction: string, box: { x: number; y: number; w: number; h: number } | null) {
    const res = await authFetch(`/api/ad-studio/projects/${id}/drafts/${d.id}/edit`, { method: 'POST', body: JSON.stringify({ instruction, box: box ?? undefined }) });
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    if (!res.ok) { showError(body.message || 'Could not make that change.'); return; }
    setEditing(null);
    await load();
  }

  async function addSize(d: Draft, f: AdFormat) {
    const ok = await showConfirm(`Make this poster as ${AD_FORMATS[f].label} (${AD_FORMATS[f].aspect}) for 1 image credit? The credit is only used if it comes out right.`, { title: 'Another size', confirmLabel: 'Make it · 1 credit', cancelLabel: 'Cancel' });
    if (!ok) return;
    const res = await authFetch(`/api/ad-studio/projects/${id}/drafts/${d.id}/format`, { method: 'POST', body: JSON.stringify({ format: f }) });
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    if (!res.ok) { showError(body.message || 'Could not make that size.'); return; }
    await load();
  }

  const p = view?.project;
  const drawingCount = view?.drafts.filter((d) => d.round === p?.rounds && d.status === 'ready').length ?? 0;
  const roundTotal = view?.drafts.filter((d) => d.round === p?.rounds).length ?? 0;
  const keptCount = view?.drafts.filter((d) => d.kept).length ?? 0;
  const enough = (view?.credits ?? 0) >= picked.size;

  return (
    <div className="h-screen flex overflow-hidden app-page" style={{ background: colors.background }}>
      <Head><title>Poster ads | SkalX AI</title></Head>
      <Sidebar />
      <main className="min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl px-4 pb-10 pt-8 sm:px-6">
          {!view || !p ? (
            <p className="flex items-center gap-2" style={{ color: colors.mutedForeground }}><Loader2 size={16} className="animate-spin" /> Loading…</p>
          ) : (
            <>
              <header>
                <p className="text-xs font-medium uppercase tracking-wide" style={{ color: colors.mutedForeground }}>
                  {p.product.name} · {p.goalLabel} · {p.formats.map((f) => AD_FORMATS[f as AdFormat]?.label ?? f).join(', ')}
                </p>
                <h1 className="mt-1 text-2xl font-semibold" style={{ color: colors.foreground }}>
                  {p.status === 'researching' ? 'Researching your product, customers and competitors…'
                    : p.status === 'drawing' ? `Drawing your posters… ${drawingCount} of ${roundTotal} ready`
                    : p.status === 'failed' && !view.drafts.length ? 'Something went wrong'
                    : 'Pick the posters you want'}
                </h1>
                <p className="mt-1 text-sm" style={{ color: colors.mutedForeground }}>
                  {busy ? 'This takes a few minutes. You can leave this page and come back.' : 'Tap a poster to keep it. Previews are watermarked — you get the full-quality poster when you keep it. You only pay for the ones you keep.'}
                </p>
                {p.error ? <p className="mt-2 text-sm" style={{ color: 'hsl(0 84% 62%)' }}>{p.error}</p> : null}
                <button type="button" onClick={() => setChatOpen(true)} className="mt-4 inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold"
                  style={{ background: colors.secondary, border: `1px solid ${colors.border}`, color: colors.foreground }}>
                  <MessageSquareText size={15} /> Tell SkalX what you want
                </button>
              </header>

              {p.status === 'researching' && !rounds.some(([r]) => r === p.rounds) ? (
                <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-hidden>
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="animate-pulse rounded-2xl" style={{ background: colors.card, border: `1px solid ${colors.border}`, aspectRatio: aspectCss(p.formats[0]) }} />
                  ))}
                </div>
              ) : null}

              {rounds.map(([round, drafts]) => (
                <section key={round} className="mt-8">
                  {rounds.length > 1 ? <h2 className="mb-3 text-sm font-semibold" style={{ color: colors.mutedForeground }}>Round {round}</h2> : null}
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {drafts.map((d) => (
                      <DraftCard key={d.id} d={d} picked={picked.has(d.id)} onToggle={() => toggle(d.id)} actions={{
                        onPreview: () => setPreviewing(d),
                        onEdit: () => setEditing(d),
                        onAddSize: (f) => void addSize(d, f),
                        existingSizes: view.drafts.filter((x) => x.parentId === d.id && x.kind === 'format' && x.status !== 'failed').map((x) => x.format),
                      }} results={view.results} />
                    ))}
                  </div>
                </section>
              ))}

              {!busy && view.drafts.length ? (
                <section className="mt-10 rounded-2xl p-5" style={{ background: colors.card, border: `1px solid ${colors.border}` }}>
                  <h2 className="flex items-center gap-2 text-base font-semibold" style={{ color: colors.foreground }}><Search size={16} aria-hidden /> None of these quite right?</h2>
                  <p className="mt-1 text-sm" style={{ color: colors.mutedForeground }}>Tell SkalX what to change and it will research and draw {view.nextRoundSize || 8} new ones. Free — you still only pay for posters you keep.</p>
                  <textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} rows={2} maxLength={1000}
                    placeholder="e.g. Less text, show the pack bigger, more festive colours"
                    className="mt-3 w-full rounded-lg px-3 py-2.5 text-sm" style={{ background: colors.secondary, border: `1px solid ${colors.border}`, color: colors.foreground }} />
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs" style={{ color: colors.mutedForeground }}>{view.draftsLeftToday} free drafts left today for this product.</p>
                    <button type="button" onClick={() => void moreRound()} disabled={startingRound || view.nextRoundSize === 0}
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold disabled:opacity-50"
                      style={{ background: colors.secondary, border: `1px solid ${colors.border}`, color: colors.foreground }}>
                      {startingRound ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />} {view.nextRoundSize === 0 ? 'Come back tomorrow for more' : `Make ${view.nextRoundSize} more`}
                    </button>
                  </div>
                </section>
              ) : null}

              {keptCount ? (
                <section className="mt-8 rounded-2xl p-5" style={{ background: colors.card, border: `1px solid ${colors.border}` }}>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h2 className="text-base font-semibold" style={{ color: colors.foreground }}>Your {keptCount} kept poster{keptCount > 1 ? 's' : ''}, ready to run</h2>
                      <p className="mt-1 text-sm" style={{ color: colors.mutedForeground }}>Each has an SKX- name and copy. Download them all with a short guide on how to test them.</p>
                    </div>
                    <button type="button" onClick={downloadAll} disabled={downloading} className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold disabled:opacity-60" style={{ background: colors.primary, color: colors.primaryForeground }}>
                      {downloading ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />} Download all (ZIP)
                    </button>
                  </div>
                  {view.testPlan ? (
                    <ol className="mt-4 list-decimal space-y-1.5 pl-5 text-sm" style={{ color: colors.secondaryForeground }}>
                      {view.testPlan.steps.map((step, i) => <li key={i}>{step}</li>)}
                    </ol>
                  ) : null}
                </section>
              ) : null}
            </>
          )}
        </div>

        {picked.size ? (
          <div className="sticky bottom-0 z-20 border-t px-4 py-3" style={{ background: colors.card, borderColor: colors.border }}>
            <div className="mx-auto flex max-w-6xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm" style={{ color: enough ? colors.foreground : 'hsl(0 84% 62%)' }}>
                <strong>{picked.size} selected</strong> · {picked.size} image credit{picked.size > 1 ? 's' : ''} · you have {view?.credits ?? 0}
                {!enough ? ' — not enough credits' : ''}
              </p>
              <div className="flex gap-2">
                <button type="button" onClick={() => setPicked(new Set())} className="h-11 rounded-xl px-4 text-sm font-medium" style={{ color: colors.mutedForeground }}>Clear</button>
                {enough ? (
                  <button type="button" onClick={keep} disabled={paying} className="inline-flex h-11 items-center gap-2 rounded-xl px-6 text-sm font-semibold disabled:opacity-60" style={{ background: colors.primary, color: colors.primaryForeground }}>
                    {paying ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />} Get my ads
                  </button>
                ) : (
                  <Link href="/buy-credits" className="inline-flex h-11 items-center rounded-xl px-6 text-sm font-semibold" style={{ background: colors.primary, color: colors.primaryForeground }}>Get more credits</Link>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </main>
      {previewing?.imageUrl && view ? (
        <FeedPreview imageUrl={previewing.imageUrl} aspect={AD_FORMATS[previewing.format as AdFormat]?.aspect ?? '4:5'}
          brandName={view.project.brandName || view.project.product.name} avatarUrl={view.project.product.image}
          caption={previewing.message || previewing.angleName} onClose={() => setPreviewing(null)} />
      ) : null}
      {editing?.imageUrl ? (
        <EditDialog imageUrl={editing.imageUrl} aspect={AD_FORMATS[editing.format as AdFormat]?.aspect ?? '4:5'}
          onClose={() => setEditing(null)} onSubmit={(t, b) => submitEdit(editing, t, b)} />
      ) : null}
      {chatOpen && view ? (
        <ChatPanel projectId={view.project.id} roundSize={view.nextRoundSize || 8} canMakeMore={view.nextRoundSize > 0 && !busy}
          onMakeRound={(direction) => moreRound(direction)} onClose={() => setChatOpen(false)} />
      ) : null}
    </div>
  );
}
