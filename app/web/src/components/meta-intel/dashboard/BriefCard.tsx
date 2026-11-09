import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { CalendarDays, Loader2, Mail, Trophy, Hand, Instagram, Facebook, Wand2 } from 'lucide-react';
import colors from '@/lib/ui/colors';
import { authFetch } from '@/lib/utils';
import { showError } from '@/app/web/src/components/ui/alert-modal-api';
import type { BriefResponse } from '@/pages/api/meta-intel/brief';
import { GOOD, BAD } from './format';

const day = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' });

/** "Monday brief" on Ad Performance: the same content as the Monday email. */
export default function BriefCard() {
  const [data, setData] = useState<BriefResponse | null>(null);
  const [requesting, setRequesting] = useState(false);

  const load = useCallback(async () => {
    const res = await authFetch('/api/meta-intel/brief');
    if (res.ok) setData((await res.json()) as BriefResponse);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const building = !!data?.building || requesting;
  useEffect(() => {
    if (!building) return;
    const started = Date.now();
    const t = setInterval(async () => {
      await load();
      if (Date.now() - started > 20_000) setRequesting(false);
    }, 5000);
    return () => clearInterval(t);
  }, [building, load]);

  async function build(send: boolean) {
    setRequesting(true);
    try {
      const res = await authFetch('/api/meta-intel/brief', { method: 'POST', body: JSON.stringify({ send }) });
      const body = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) throw new Error(body.message || 'Could not build the brief.');
    } catch (e) {
      setRequesting(false);
      showError((e as Error).message);
    }
  }

  if (!data) return null;
  const b = data.brief;
  const c = b?.content;
  const emailed = b?.delivery?.email?.status === 'sent';

  return (
    <section className="rounded-2xl p-4 sm:p-5" style={{ background: colors.card, border: `1px solid ${colors.border}` }}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 className="flex items-center gap-2 text-base font-semibold" style={{ color: colors.foreground }}>
          <CalendarDays size={16} style={{ color: colors.accentForeground }} aria-hidden /> Monday brief
          {b ? <span className="text-xs font-normal" style={{ color: colors.mutedForeground }}>· {day(b.weekStart)} – {day(b.weekEnd)}</span> : null}
        </h2>
        <div className="flex items-center gap-2">
          {emailed ? <span className="inline-flex items-center gap-1 text-xs" style={{ color: colors.mutedForeground }}><Mail size={12} aria-hidden /> Emailed</span> : null}
          <button type="button" onClick={() => build(true)} disabled={building} className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium disabled:opacity-60"
            style={{ background: colors.secondary, border: `1px solid ${colors.border}`, color: colors.foreground }}>
            {building ? <Loader2 size={12} className="animate-spin" /> : <Mail size={12} />} {building ? 'Building…' : b ? 'Rebuild & email me' : 'Build it now & email me'}
          </button>
        </div>
      </div>

      {!c ? (
        <p className="mt-3 text-sm" style={{ color: colors.mutedForeground }}>
          {building ? 'Putting last week together… about a minute.' : `Every Monday at 9 AM SkalX sums up last week — what won, what to stop, your top post — and prepares 5 new ads to test.${data.emailEnabled ? ' It’s also emailed to you.' : ''}`}
        </p>
      ) : (
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <p className="text-[15px] font-semibold leading-snug" style={{ color: colors.foreground }}>{c.oneLine}</p>
            {c.notEnoughData ? <p className="mt-1 text-xs" style={{ color: 'hsl(38 92% 60%)' }}>Spend was low, so treat these as early signals.</p> : null}
          </div>
          <div>
            <h3 className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide" style={{ color: colors.mutedForeground }}><Trophy size={12} style={{ color: GOOD }} aria-hidden /> What won</h3>
            {c.winners.length ? c.winners.map((w) => (
              <p key={w.adId} className="mb-1.5 text-sm" style={{ color: colors.foreground }}>{w.name}<span className="block text-xs" style={{ color: colors.mutedForeground }}>{w.line}</span></p>
            )) : <p className="text-sm" style={{ color: colors.mutedForeground }}>No clear winner yet.</p>}
          </div>
          <div>
            <h3 className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide" style={{ color: colors.mutedForeground }}><Hand size={12} style={{ color: BAD }} aria-hidden /> What to stop</h3>
            {c.stop.length ? c.stop.map((s) => (
              <p key={s.adId} className="mb-1.5 text-sm" style={{ color: colors.foreground }}>{s.name}<span className="block text-xs" style={{ color: colors.mutedForeground }}>{s.line}</span></p>
            )) : <p className="text-sm" style={{ color: colors.mutedForeground }}>Nothing to stop this week.</p>}
          </div>
          {c.topPost ? (
            <div>
              <h3 className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide" style={{ color: colors.mutedForeground }}>
                {c.topPost.platform === 'instagram' ? <Instagram size={12} aria-hidden /> : <Facebook size={12} aria-hidden />} Top post
              </h3>
              <p className="text-sm" style={{ color: colors.foreground }}>{c.topPost.caption || '(no caption)'}</p>
              <p className="text-xs" style={{ color: colors.mutedForeground }}>{c.topPost.line}{c.topPost.permalink ? <> · <a href={c.topPost.permalink} target="_blank" rel="noopener noreferrer" className="underline">View</a></> : null}</p>
            </div>
          ) : null}
          <div className="flex items-end">
            {c.pack ? (
              <Link href={`${c.pack.kind === 'posters' ? '/content-studio/posters/' : '/content-studio/test-pack/'}${c.pack.id}`} className="inline-flex h-11 items-center gap-2 rounded-xl px-5 text-sm font-semibold" style={{ background: colors.primary, color: colors.primaryForeground }}>
                <Wand2 size={15} aria-hidden /> See {c.pack.ads} new ads to test
              </Link>
            ) : c.packNote ? <p className="text-xs" style={{ color: colors.mutedForeground }}>{c.packNote}</p> : null}
          </div>
        </div>
      )}
    </section>
  );
}
