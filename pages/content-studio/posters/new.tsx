// /content-studio/posters/new[?scan=<scanId>&product=<name>&from_ad=<id>&idea=<text>] — product → goal → where it runs → (optional note) → 8 draft posters.
import React, { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { Check, ImageOff, Loader2, Sparkles, ShoppingBag, Rocket, Tag, PartyPopper, ArrowLeftRight, Megaphone, MessageSquareQuote } from 'lucide-react';
import Sidebar from '../../../app/web/src/components/Sidebar';
import colors from '@/lib/ui/colors';
import { authFetch } from '@/lib/utils';
import { showError } from '@/app/web/src/components/ui/alert-modal-api';
import { AD_FORMATS, AD_FORMAT_KEYS, AD_GOALS, AD_GOAL_KEYS, type AdFormat, type AdGoal } from '@/lib/ad-studio/options';
import { DRAFTS_PER_ROUND } from '@/lib/ad-studio/limits';

type ProductOption = { id: string; name: string; image: string | null; price: string | null };

const GOAL_ICON: Record<AdGoal, React.ComponentType<{ size?: number }>> = {
  sell_more: ShoppingBag, launch: Rocket, offer: Tag, festive: PartyPopper, before_after: ArrowLeftRight, awareness: Megaphone, reviews: MessageSquareQuote,
};

function Step({ n, title, children, done }: { n: number; title: string; children: React.ReactNode; done?: boolean }) {
  return (
    <section className="rounded-2xl p-5" style={{ background: colors.card, border: `1px solid ${colors.border}` }}>
      <h2 className="mb-4 flex items-center gap-2 text-base font-semibold" style={{ color: colors.foreground }}>
        <span className="flex h-6 w-6 items-center justify-center rounded-full text-xs" style={{ background: done ? colors.primary : colors.muted, color: done ? colors.primaryForeground : colors.mutedForeground }}>
          {done ? <Check size={13} /> : n}
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function Choice({ on, onClick, children, multi }: { on: boolean; onClick: () => void; children: React.ReactNode; multi?: boolean }) {
  return (
    <button type="button" role={multi ? 'checkbox' : 'radio'} aria-checked={on} onClick={onClick}
      className="flex w-full items-start gap-3 rounded-xl p-3 text-left"
      style={{ background: on ? colors.accent : colors.secondary, border: `1px solid ${on ? colors.primary : colors.border}`, minHeight: 56 }}>
      {children}
    </button>
  );
}

export default function NewPostersPage() {
  const router = useRouter();
  const [products, setProducts] = useState<ProductOption[] | null>(null);
  const [productId, setProductId] = useState<string | null>(null);
  const [goal, setGoal] = useState<AdGoal | null>(null);
  const [offer, setOffer] = useState('');
  const [formats, setFormats] = useState<AdFormat[]>(['feed_4x5']);
  const [note, setNote] = useState('');
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (!router.isReady) return;
    (async () => {
      try {
        const fromAd = typeof router.query.from_ad === 'string' ? router.query.from_ad : null;
        const res = await authFetch(`/api/test-packs/products${fromAd ? `?from_ad=${encodeURIComponent(fromAd)}` : ''}`);
        if (res.status === 401) { router.replace('/login'); return; }
        const body = (await res.json()) as { products: ProductOption[]; suggested?: string | null };
        const list = body.products ?? [];
        setProducts(list);
        const scan = typeof router.query.scan === 'string' ? router.query.scan : null;
        const name = typeof router.query.product === 'string' ? router.query.product.toLowerCase() : null;
        const match = list.find((p) => (!scan || p.id.startsWith(`${scan}:`)) && name && p.name.toLowerCase() === name)
          ?? list.find((p) => name && p.name.toLowerCase() === name);
        setProductId(match?.id ?? body.suggested ?? (list.length === 1 ? list[0].id : null));
        if (fromAd) setGoal((g) => g ?? 'sell_more');
        // From Trends: the idea arrives as a ready note the owner can edit.
        const idea = typeof router.query.idea === 'string' ? router.query.idea.slice(0, 1000) : '';
        if (idea) setNote((n) => n || idea);
      } catch {
        setProducts([]);
      }
    })();
  }, [router, router.isReady]);

  const product = useMemo(() => products?.find((p) => p.id === productId) ?? null, [products, productId]);
  const fromAdId = typeof router.query.from_ad === 'string' && /^\d{1,30}$/.test(router.query.from_ad) ? router.query.from_ad : null;
  const needsOffer = goal ? !!AD_GOALS[goal].needsOffer : false;
  const ready = !!product && !!goal && formats.length > 0 && (!needsOffer || offer.trim().length > 2);

  const toggleFormat = (f: AdFormat) =>
    setFormats((prev) => (prev.includes(f) ? (prev.length > 1 ? prev.filter((x) => x !== f) : prev) : [...prev, f]));

  async function start() {
    if (!product || !goal) return;
    setStarting(true);
    try {
      const [scanId] = product.id.split(':');
      const res = await authFetch('/api/ad-studio/projects', {
        method: 'POST',
        body: JSON.stringify({ scanId, productName: product.name, goal, offer: offer.trim() || undefined, formats, direction: note.trim() || undefined, fromAdId: fromAdId || undefined }),
      });
      const body = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
      if (!res.ok || !body.id) throw new Error(body.message || 'Could not start. Please try again.');
      router.push(`/content-studio/posters/${body.id}`);
    } catch (e) {
      showError((e as Error).message);
      setStarting(false);
    }
  }

  return (
    <div className="h-screen flex overflow-hidden app-page" style={{ background: colors.background }}>
      <Head><title>Poster ads | SkalX AI</title></Head>
      <Sidebar />
      <main className="min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl space-y-4 px-4 py-8 sm:px-6">
          <header>
            <h1 className="text-2xl font-semibold" style={{ color: colors.foreground }}>{fromAdId ? 'Make more like your winning ad' : 'Poster ads'}</h1>
            {fromAdId ? (
              <p className="mt-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium" style={{ background: colors.muted, color: 'hsl(142 70% 50%)' }}>
                Built on your winning ad — SkalX keeps what worked and tries new ways to say it
              </p>
            ) : null}
            <p className="mt-1 text-sm" style={{ color: colors.mutedForeground }}>
              Tell SkalX what you’re selling and why. It researches your product, customers and competitors, then makes {DRAFTS_PER_ROUND} ready-made posters. <strong style={{ color: colors.foreground }}>You only pay for the ones you keep.</strong>
            </p>
          </header>

          <Step n={1} title="Which product?" done={!!product}>
            {products === null ? (
              <p className="flex items-center gap-2 text-sm" style={{ color: colors.mutedForeground }}><Loader2 size={14} className="animate-spin" /> Loading your products…</p>
            ) : products.length === 0 ? (
              <div className="text-sm" style={{ color: colors.mutedForeground }}>
                <p>Scan your website in Ad Studio first so SkalX has your product photos.</p>
                <Link href="/content-studio" className="mt-3 inline-flex h-11 items-center rounded-xl px-5 font-semibold" style={{ background: colors.primary, color: colors.primaryForeground }}>Open Ad Studio</Link>
              </div>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {products.map((p) => (
                  <Choice key={p.id} on={productId === p.id} onClick={() => setProductId(p.id)}>
                    {p.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.image} alt="" className="h-12 w-12 shrink-0 rounded-lg object-cover" style={{ background: colors.muted }} />
                    ) : <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg" style={{ background: colors.muted, color: colors.mutedForeground }}><ImageOff size={16} /></span>}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium" style={{ color: colors.foreground }}>{p.name}</span>
                      {p.price ? <span className="block text-xs" style={{ color: colors.mutedForeground }}>{p.price}</span> : null}
                    </span>
                  </Choice>
                ))}
              </div>
            )}
          </Step>

          <Step n={2} title="What do you want these ads to do?" done={!!goal && (!needsOffer || offer.trim().length > 2)}>
            <div className="grid gap-2 sm:grid-cols-2">
              {AD_GOAL_KEYS.map((g) => {
                const Icon = GOAL_ICON[g];
                return (
                  <Choice key={g} on={goal === g} onClick={() => setGoal(g)}>
                    <span className="mt-0.5 shrink-0" style={{ color: goal === g ? colors.primary : colors.mutedForeground }}><Icon size={18} /></span>
                    <span>
                      <span className="block text-sm font-medium" style={{ color: colors.foreground }}>{AD_GOALS[g].label}</span>
                      <span className="block text-xs" style={{ color: colors.mutedForeground }}>{AD_GOALS[g].hint}</span>
                    </span>
                  </Choice>
                );
              })}
            </div>
            {needsOffer ? (
              <label className="mt-4 block">
                <span className="text-sm font-medium" style={{ color: colors.foreground }}>What’s the offer?</span>
                <input value={offer} onChange={(e) => setOffer(e.target.value)} maxLength={300} placeholder="e.g. 20% off this week, or Buy 2 get 1 free"
                  className="mt-1 w-full rounded-lg px-3 py-2.5 text-sm" style={{ background: colors.secondary, border: `1px solid ${colors.border}`, color: colors.foreground }} />
                <span className="mt-1 block text-xs" style={{ color: colors.mutedForeground }}>SkalX uses exactly this — it never makes up discounts.</span>
              </label>
            ) : null}
          </Step>

          <Step n={3} title="Where will the ads run?" done={formats.length > 0}>
            <div className="grid gap-2 sm:grid-cols-2">
              {AD_FORMAT_KEYS.map((f) => {
                const info = AD_FORMATS[f];
                const on = formats.includes(f);
                const [w, h] = info.aspect === '1.91:1' ? [1.91, 1] : info.aspect.split(':').map(Number);
                return (
                  <Choice key={f} multi on={on} onClick={() => toggleFormat(f)}>
                    <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center">
                      <span className="rounded-sm" style={{ width: (w / Math.max(w, h)) * 30, height: (h / Math.max(w, h)) * 30, border: `2px solid ${on ? colors.primary : colors.mutedForeground}` }} />
                    </span>
                    <span>
                      <span className="block text-sm font-medium" style={{ color: colors.foreground }}>{info.label} <span className="text-xs font-normal" style={{ color: colors.mutedForeground }}>({info.aspect})</span>{info.recommended ? <span className="ml-1 text-[11px]" style={{ color: colors.accentForeground }}>Recommended</span> : null}</span>
                      <span className="block text-xs" style={{ color: colors.mutedForeground }}>{info.where}</span>
                    </span>
                  </Choice>
                );
              })}
            </div>
            {formats.length > 1 ? (
              <p className="mt-3 text-xs" style={{ color: colors.mutedForeground }}>
                SkalX draws the posters as {AD_FORMATS[formats[0]].label}. For posters you keep, you can add the {formats.slice(1).map((f) => AD_FORMATS[f].label).join(' and ')} version for 1 credit each.
              </p>
            ) : null}
          </Step>

          <Step n={4} title="Anything SkalX should know? (optional)" done={note.trim().length > 0}>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={1000}
              placeholder="e.g. Show it with rasam rice. Make it feel festive. It's for bachelors who don't cook."
              className="w-full rounded-lg px-3 py-2.5 text-sm" style={{ background: colors.secondary, border: `1px solid ${colors.border}`, color: colors.foreground }} />
          </Step>

          <div className="flex flex-col gap-3 rounded-2xl p-5 sm:flex-row sm:items-center sm:justify-between" style={{ background: colors.card, border: `1px solid ${colors.border}` }}>
            <p className="text-sm" style={{ color: colors.mutedForeground }}>
              Making the {DRAFTS_PER_ROUND} posters is free. <strong style={{ color: colors.foreground }}>1 image credit for each poster you keep.</strong>
            </p>
            <button type="button" onClick={start} disabled={!ready || starting}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-xl px-6 text-base font-semibold disabled:opacity-50"
              style={{ background: colors.primary, color: colors.primaryForeground }}>
              {starting ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />} Make {DRAFTS_PER_ROUND} posters
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
