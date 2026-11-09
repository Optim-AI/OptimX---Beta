// Ad Performance → "Instagram trends" (hashtags) and "Competitors" (other business accounts).
// Every number is Instagram's own (likes, comments, followers) or simple arithmetic on it.
import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Hash, AtSign, Plus, X, Loader2, RefreshCw, Heart, MessageCircle, ExternalLink, ImageOff, Sparkles, Wand2, AlertTriangle, Users, Layers } from 'lucide-react';
import colors from '@/lib/ui/colors';
import { authFetch } from '@/lib/utils';
import { showError } from '@/app/web/src/components/ui/alert-modal-api';
import type { AccountStats, FormatShare, HashtagStats, IgPost, InstagramView, WatchItem } from '@/lib/meta-ig/types';

const nf1 = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 1 });
const nf0 = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
/** Big counts as whole numbers (12,366); small ones keep one decimal (1.3, 6.5). */
const num = (v: number | null | undefined) => (v === null || v === undefined ? '—' : Math.abs(v) >= 100 ? nf0.format(v) : nf1.format(v));
const FORMAT_COLOR: Record<FormatShare['format'], string> = { 'Reels / video': '#3987e5', Photo: '#d95926', Carousel: '#8b7cf6' };
const WARN = 'hsl(38 92% 60%)';

function useInstagram() {
  const [data, setData] = useState<InstagramView | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const load = useCallback(async (refresh = false) => {
    const res = await authFetch(`/api/meta-intel/instagram${refresh ? '?refresh=1' : ''}`);
    if (res.ok) setData((await res.json()) as InstagramView);
  }, []);
  const act = useCallback(async (label: string, body: Record<string, string>) => {
    setBusy(label);
    try {
      const res = await authFetch('/api/meta-intel/instagram', { method: 'POST', body: JSON.stringify(body) });
      const out = (await res.json().catch(() => ({}))) as InstagramView & { message?: string };
      if (!res.ok) showError(out.message || 'That didn’t work. Please try again.');
      else setData(out);
    } finally {
      setBusy(null);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);
  return { data, busy, load, act };
}

function FormatBar({ formats }: { formats: FormatShare[] }) {
  if (!formats.length) return null;
  const best = formats.filter((f) => f.avgEngagement !== null && f.posts >= 2).sort((a, b) => (b.avgEngagement ?? 0) - (a.avgEngagement ?? 0))[0];
  return (
    <div>
      <div className="flex h-3 w-full overflow-hidden rounded-full" role="img" aria-label={formats.map((f) => `${f.format} ${f.pct}%`).join(', ')}>
        {formats.map((f) => <span key={f.format} style={{ width: `${f.pct}%`, background: FORMAT_COLOR[f.format] }} title={`${f.format}: ${f.pct}% of posts, ${num(f.avgEngagement)} engagements each on average`} />)}
      </div>
      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px]" style={{ color: colors.secondaryForeground }}>
        {formats.map((f) => (
          <span key={f.format} className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-full" style={{ background: FORMAT_COLOR[f.format] }} aria-hidden /> {f.format} {f.pct}%
          </span>
        ))}
      </div>
      {best ? (
        <p className="mt-1 text-xs" style={{ color: colors.foreground }}>
          Works best: <b>{best.format}</b> <span style={{ color: colors.mutedForeground }}>({num(best.avgEngagement)} likes + comments per post)</span>
        </p>
      ) : null}
    </div>
  );
}

function PostTile({ p }: { p: IgPost }) {
  const [broken, setBroken] = useState(false);
  const inner = (
    <div className="group relative aspect-square overflow-hidden rounded-lg" style={{ background: colors.muted }}>
      {p.imageUrl && !broken
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={p.imageUrl} alt={p.caption?.slice(0, 80) ?? 'Instagram post'} referrerPolicy="no-referrer" onError={() => setBroken(true)} className="h-full w-full object-cover" />
        : <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-[10px]" style={{ color: colors.mutedForeground }}>
            {p.mediaType === 'CAROUSEL_ALBUM' ? <Layers size={16} aria-hidden /> : <ImageOff size={16} aria-hidden />}
            {p.mediaType === 'CAROUSEL_ALBUM' ? 'Carousel' : 'No preview'}
          </div>}
      <div className="absolute inset-x-0 bottom-0 flex gap-2 bg-gradient-to-t from-black/75 to-transparent px-1.5 pb-1 pt-4 text-[10px] font-semibold text-white">
        {p.likes !== null ? <span className="inline-flex items-center gap-0.5"><Heart size={10} aria-hidden /> {num(p.likes)}</span> : null}
        {p.comments !== null ? <span className="inline-flex items-center gap-0.5"><MessageCircle size={10} aria-hidden /> {num(p.comments)}</span> : null}
      </div>
    </div>
  );
  return p.permalink ? <a href={p.permalink} target="_blank" rel="noopener noreferrer" title="Open on Instagram">{inner}</a> : inner;
}

function AddForm({ kind, onAdd, busy, disabled }: { kind: 'hashtag' | 'account'; onAdd: (v: string) => void; busy: boolean; disabled?: boolean }) {
  const [v, setV] = useState('');
  const Icon = kind === 'hashtag' ? Hash : AtSign;
  return (
    <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (v.trim()) { onAdd(v.trim()); setV(''); } }}>
      <label className="flex h-10 flex-1 items-center gap-2 rounded-lg px-3" style={{ background: colors.muted, border: `1px solid ${colors.border}` }}>
        <Icon size={15} style={{ color: colors.mutedForeground }} aria-hidden />
        <input value={v} onChange={(e) => setV(e.target.value)} disabled={disabled} maxLength={60}
          placeholder={kind === 'hashtag' ? 'Add a hashtag, e.g. pickles or chennaifood' : 'Add a competitor’s Instagram, e.g. brandname'}
          className="w-full bg-transparent text-sm outline-none" style={{ color: colors.foreground }} aria-label={kind === 'hashtag' ? 'Hashtag' : 'Instagram username'} />
      </label>
      <button type="submit" disabled={busy || disabled || !v.trim()} className="inline-flex h-10 items-center gap-1.5 rounded-lg px-4 text-sm font-semibold disabled:opacity-50"
        style={{ background: colors.primary, color: colors.primaryForeground }}>
        {busy ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} Add
      </button>
    </form>
  );
}

function ItemError({ text }: { text: string }) {
  return <p className="mt-2 flex items-start gap-1.5 text-xs" style={{ color: WARN }}><AlertTriangle size={13} className="mt-0.5 shrink-0" aria-hidden /> {text}</p>;
}

function RemoveButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} className="rounded-md p-1.5 hover:opacity-80" style={{ color: colors.mutedForeground }}>
      <X size={15} />
    </button>
  );
}

function HashtagCard({ item, onRemove }: { item: WatchItem<HashtagStats>; onRemove: () => void }) {
  const d = item.data;
  return (
    <section className="rounded-2xl p-4" style={{ background: colors.card, border: `1px solid ${colors.border}` }}>
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-base font-semibold" style={{ color: colors.foreground }}>#{item.value}</h3>
        <RemoveButton onClick={onRemove} label={`Stop watching #${item.value}`} />
      </div>
      {item.error ? <ItemError text={item.error} /> : null}
      {d ? (
        <>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {[
              { k: 'New posts, last 24h', v: d.last24h === null ? '—' : `${num(d.last24h)}${d.last24hCapped ? '+' : ''}` },
              { k: 'Avg likes, top posts', v: num(d.avgLikes) },
              { k: 'Avg comments', v: num(d.avgComments) },
            ].map((s) => (
              <div key={s.k} className="rounded-lg p-2" style={{ background: colors.secondary }}>
                <p className="text-[10px]" style={{ color: colors.mutedForeground }}>{s.k}</p>
                <p className="text-base font-semibold tabular-nums" style={{ color: colors.foreground }}>{s.v}</p>
              </div>
            ))}
          </div>
          <div className="mt-3"><FormatBar formats={d.formats} /></div>
          <p className="mt-3 text-[11px] font-medium uppercase tracking-wide" style={{ color: colors.mutedForeground }}>Top posts right now</p>
          <div className="mt-1.5 grid grid-cols-3 gap-1.5">{d.topPosts.map((p) => <PostTile key={p.id} p={p} />)}</div>
        </>
      ) : !item.error ? <p className="mt-2 text-sm" style={{ color: colors.mutedForeground }}>Loading…</p> : null}
    </section>
  );
}

export function InstagramTrendsTab() {
  const { data, busy, load, act } = useInstagram();
  if (!data) return <p className="mt-6 flex items-center gap-2 text-sm" style={{ color: colors.mutedForeground }}><Loader2 size={15} className="animate-spin" /> Loading Instagram…</p>;
  if (!data.connected) return <NotConnected />;
  const full = data.hashtags.length >= data.limits.hashtags;
  const quotaPct = Math.min(100, (data.hashtagQuota.used / data.hashtagQuota.limit) * 100);
  return (
    <div className="mt-5 space-y-4">
      <div className="rounded-2xl p-4" style={{ background: colors.card, border: `1px solid ${colors.border}` }}>
        <p className="text-sm" style={{ color: colors.secondaryForeground }}>
          See what’s doing well on Instagram for the hashtags your buyers follow: the top posts right now, how many new posts each day, and which format wins.
        </p>
        <div className="mt-3"><AddForm kind="hashtag" busy={busy === 'add'} disabled={full} onAdd={(v) => act('add', { action: 'add', kind: 'hashtag', value: v })} /></div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px]" style={{ color: colors.mutedForeground }}>
          <span className="flex items-center gap-2">
            Hashtag lookups this week: {data.hashtagQuota.used} of {data.hashtagQuota.limit}
            <span className="inline-block h-1.5 w-24 rounded-full" style={{ background: colors.muted }}><span className="block h-1.5 rounded-full" style={{ width: `${quotaPct}%`, background: quotaPct > 80 ? WARN : colors.primary }} /></span>
          </span>
          <span>Instagram allows {data.hashtagQuota.metaLimit} different hashtags a week · watching {data.hashtags.length} of {data.limits.hashtags}</span>
        </div>
      </div>
      {data.hashtags.length ? (
        <>
          <div className="flex justify-end">
            <button type="button" onClick={() => void load(true)} className="inline-flex items-center gap-1.5 text-xs font-medium hover:underline" style={{ color: colors.mutedForeground }}><RefreshCw size={12} /> Refresh now</button>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {data.hashtags.map((h) => <HashtagCard key={h.id} item={h} onRemove={() => act('remove', { action: 'remove', id: h.id })} />)}
          </div>
        </>
      ) : (
        <p className="text-sm" style={{ color: colors.mutedForeground }}>Add a hashtag to start, for example your product (#pickles), your city (#chennaifood) or an occasion (#diwaligifts).</p>
      )}
      <p className="text-[11px]" style={{ color: colors.mutedForeground }}>From Instagram’s public hashtag pages. Instagram doesn’t share who posted, and some reels and carousels come without a preview. Tap a post to open it on Instagram.</p>
    </div>
  );
}

function NotConnected() {
  return (
    <div className="mt-6 rounded-2xl p-6 text-sm" style={{ background: colors.card, border: `1px solid ${colors.border}`, color: colors.secondaryForeground }}>
      Link your Instagram business account to use this. <Link href="/settings?tab=integrations" className="font-semibold underline">Open Settings → Integrations</Link>
    </div>
  );
}

/** One measure across You + competitors, as labelled horizontal bars. */
function CompareChart({ title, rows, unit }: { title: string; rows: { label: string; value: number | null; you: boolean }[]; unit?: string }) {
  const shown = rows.filter((r) => r.value !== null) as { label: string; value: number; you: boolean }[];
  if (shown.length < 2) return null;
  const max = Math.max(...shown.map((r) => r.value), 1);
  return (
    <div className="rounded-xl p-3" style={{ background: colors.secondary, border: `1px solid ${colors.border}` }}>
      <h4 className="text-xs font-semibold uppercase tracking-wide" style={{ color: colors.mutedForeground }}>{title}</h4>
      <ul className="mt-2 space-y-1.5">
        {shown.sort((a, b) => b.value - a.value).map((r) => (
          <li key={r.label} className="grid grid-cols-[128px_1fr_auto] items-center gap-2 text-xs">
            <span className="truncate font-medium" style={{ color: r.you ? colors.foreground : colors.secondaryForeground }}>{r.you ? 'You' : `@${r.label}`}</span>
            <span className="h-3 rounded-full" style={{ background: colors.muted }}>
              <span className="block h-3 rounded-full" style={{ width: `${Math.max((r.value / max) * 100, 2)}%`, background: r.you ? '#d95926' : '#3987e5' }} />
            </span>
            <span className="tabular-nums" style={{ color: colors.foreground }}>{num(r.value)}{unit ?? ''}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AccountCard({ item, you, onRemove }: { item: WatchItem<AccountStats> | { id: string; value: string; data: AccountStats; error: null }; you?: boolean; onRemove?: () => void }) {
  const d = item.data;
  const [broken, setBroken] = useState(false);
  return (
    <section className="rounded-2xl p-4" style={{ background: colors.card, border: `1px solid ${you ? '#d95926' : colors.border}` }}>
      <div className="flex items-start gap-3">
        <div className="h-11 w-11 shrink-0 overflow-hidden rounded-full" style={{ background: colors.muted }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {d?.profilePictureUrl && !broken ? <img src={d.profilePictureUrl} alt="" referrerPolicy="no-referrer" onError={() => setBroken(true)} className="h-full w-full object-cover" /> : <Users size={18} className="m-3" style={{ color: colors.mutedForeground }} />}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold" style={{ color: colors.foreground }}>{d?.name || `@${item.value}`} {you ? <span className="ml-1 rounded-full px-1.5 py-0.5 text-[10px]" style={{ background: '#d95926', color: '#fff' }}>You</span> : null}</p>
          <a href={`https://www.instagram.com/${item.value}/`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs hover:underline" style={{ color: colors.mutedForeground }}>@{item.value} <ExternalLink size={10} /></a>
        </div>
        {onRemove ? <RemoveButton onClick={onRemove} label={`Stop watching @${item.value}`} /> : null}
      </div>
      {item.error ? <ItemError text={item.error} /> : null}
      {d ? (
        <>
          <div className="mt-3 grid grid-cols-4 gap-1.5">
            {[
              { k: 'Followers', v: num(d.followers) },
              { k: 'Posts / week', v: num(d.postsPerWeek) },
              { k: 'Avg likes', v: num(d.avgLikes) },
              { k: 'Engagement', v: d.engagementRatePct === null ? '—' : `${num(d.engagementRatePct)}%` },
            ].map((s) => (
              <div key={s.k} className="rounded-lg p-2" style={{ background: colors.secondary }}>
                <p className="text-[10px]" style={{ color: colors.mutedForeground }}>{s.k}</p>
                <p className="text-sm font-semibold tabular-nums" style={{ color: colors.foreground }}>{s.v}</p>
              </div>
            ))}
          </div>
          <div className="mt-3"><FormatBar formats={d.formats} /></div>
          {d.topPosts.length ? (
            <>
              <p className="mt-3 text-[11px] font-medium uppercase tracking-wide" style={{ color: colors.mutedForeground }}>Best recent posts</p>
              <div className="mt-1.5 grid grid-cols-3 gap-1.5">{d.topPosts.map((p) => <PostTile key={p.id} p={p} />)}</div>
            </>
          ) : null}
          <p className="mt-2 text-[10px]" style={{ color: colors.mutedForeground }}>From their last {d.sampled} posts.</p>
        </>
      ) : null}
    </section>
  );
}

export function CompetitorsTab() {
  const { data, busy, load, act } = useInstagram();
  if (!data) return <p className="mt-6 flex items-center gap-2 text-sm" style={{ color: colors.mutedForeground }}><Loader2 size={15} className="animate-spin" /> Loading Instagram…</p>;
  if (!data.connected) return <NotConnected />;
  const all = [...(data.you ? [{ s: data.you, you: true }] : []), ...data.accounts.filter((a) => a.data).map((a) => ({ s: a.data as AccountStats, you: false }))];
  const rows = (f: (s: AccountStats) => number | null) => all.map(({ s, you }) => ({ label: s.username, value: f(s), you }));
  const style = data.style?.output;
  return (
    <div className="mt-5 space-y-4">
      <div className="rounded-2xl p-4" style={{ background: colors.card, border: `1px solid ${colors.border}` }}>
        <p className="text-sm" style={{ color: colors.secondaryForeground }}>
          Watch up to {data.limits.accounts} competitors on Instagram: how often they post, what gets them likes and comments, and how you compare. Works for public business and creator accounts.
        </p>
        <div className="mt-3"><AddForm kind="account" busy={busy === 'add'} disabled={data.accounts.length >= data.limits.accounts} onAdd={(v) => act('add', { action: 'add', kind: 'account', value: v })} /></div>
      </div>

      {all.length >= 2 ? (
        <div className="grid gap-3 md:grid-cols-3">
          <CompareChart title="Engagement per post" rows={rows((s) => s.engagementRatePct)} unit="%" />
          <CompareChart title="Posts per week" rows={rows((s) => s.postsPerWeek)} />
          <CompareChart title="Average likes" rows={rows((s) => s.avgLikes)} />
        </div>
      ) : null}

      <section className="rounded-2xl p-4" style={{ background: colors.card, border: `1px solid ${colors.border}` }}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 text-base font-semibold" style={{ color: colors.foreground }}><Sparkles size={16} aria-hidden /> Their style, in plain words</h3>
          <button type="button" onClick={() => act('style', { action: 'style' })} disabled={busy === 'style' || !data.accounts.some((a) => a.data) || data.styleReadsLeftToday === 0}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold disabled:opacity-50" style={{ background: colors.primary, color: colors.primaryForeground }}>
            {busy === 'style' ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />} {busy === 'style' ? 'Reading their posts… (about 30s)' : `${style ? 'Read again' : 'Read their style'} (${data.styleReadsLeftToday} left today)`}
          </button>
        </div>
        {style ? (
          <div className="mt-3 space-y-3">
            {style.summary ? <p className="text-sm font-medium" style={{ color: colors.foreground }}>{style.summary}</p> : null}
            <div className="grid gap-3 md:grid-cols-2">
              {style.competitors.map((c) => (
                <div key={c.username} className="rounded-xl p-3" style={{ background: colors.secondary, border: `1px solid ${colors.border}` }}>
                  <p className="text-sm font-semibold" style={{ color: colors.foreground }}>@{c.username}</p>
                  {c.style ? <p className="mt-1 text-xs leading-relaxed" style={{ color: colors.secondaryForeground }}>{c.style}</p> : null}
                  {c.what_works.length ? <ul className="mt-2 list-disc space-y-0.5 pl-4 text-xs" style={{ color: colors.secondaryForeground }}>{c.what_works.map((w, i) => <li key={i}>{w}</li>)}</ul> : null}
                  {c.borrow ? <p className="mt-2 text-xs" style={{ color: colors.foreground }}><b>Borrow for you:</b> {c.borrow}</p> : null}
                </div>
              ))}
            </div>
            {style.ideas.length ? (
              <div className="grid gap-2 md:grid-cols-3">
                {style.ideas.map((i, n) => (
                  <div key={n} className="rounded-xl p-3" style={{ background: colors.secondary, border: `1px solid ${colors.border}` }}>
                    <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase" style={{ background: colors.muted, color: colors.mutedForeground }}>{i.format}</span>
                    <p className="mt-1.5 text-sm font-semibold" style={{ color: colors.foreground }}>“{i.hook}”</p>
                    <p className="mt-1 text-xs" style={{ color: colors.secondaryForeground }}>{i.show}</p>
                    <Link href={`/content-studio/posters/new?idea=${encodeURIComponent(`Hook: ${i.hook.replace(/[.!?…]+$/, '')}. Show: ${i.show}`.slice(0, 900))}`}
                      className="mt-2 inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold" style={{ background: colors.primary, color: colors.primaryForeground }}>
                      <Wand2 size={12} aria-hidden /> Make this poster
                    </Link>
                  </div>
                ))}
              </div>
            ) : null}
            <p className="text-[11px]" style={{ color: colors.mutedForeground }}>
              Written by AI from their recent posts and Instagram’s numbers{data.style && data.style.dropped ? `; ${data.style.dropped} line${data.style.dropped === 1 ? '' : 's'} with numbers that didn’t match were left out` : ''}. Adapt ideas to your own product. Never copy another brand’s content.
            </p>
          </div>
        ) : (
          <p className="mt-2 text-sm" style={{ color: colors.mutedForeground }}>Add a competitor, then SkalX looks at their best posts and tells you what their style is and what you could borrow.</p>
        )}
      </section>

      <div className="flex justify-end">
        <button type="button" onClick={() => void load(true)} className="inline-flex items-center gap-1.5 text-xs font-medium hover:underline" style={{ color: colors.mutedForeground }}><RefreshCw size={12} /> Refresh now</button>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {data.you ? <AccountCard item={{ id: 'you', value: data.you.username, data: data.you, error: null }} you /> : null}
        {data.accounts.map((a) => <AccountCard key={a.id} item={a} onRemove={() => act('remove', { action: 'remove', id: a.id })} />)}
      </div>
    </div>
  );
}
