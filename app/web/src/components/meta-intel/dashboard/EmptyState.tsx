import React from 'react';
import Link from 'next/link';
import { Facebook, Loader2, RefreshCw, Settings2 } from 'lucide-react';
import colors from '@/lib/ui/colors';

type Kind = 'not_connected' | 'needs_selection' | 'syncing' | 'reconnect' | 'empty';

const COPY: Record<Kind, { title: string; body: string }> = {
  not_connected: { title: 'See how your ads are really doing', body: 'Connect your Facebook and Instagram ad account to see spend, sales, your best and worst ads, and your top posts — in one place. It takes about 2 minutes and SkalX only reads your results.' },
  needs_selection: { title: 'Almost there', body: 'Choose which ad account, Page and Instagram account SkalX should use.' },
  syncing: { title: 'Getting your results from Meta…', body: 'SkalX is bringing in the last 90 days of ads and posts. This usually takes a few minutes — you can leave this page and come back.' },
  reconnect: { title: 'Your Meta connection needs attention', body: 'SkalX can no longer read your results. Reconnect to resume syncing.' },
  empty: { title: 'No ad results in this period', body: 'None of your linked ad accounts spent money in this period. Try a longer date range, or check that you linked the right ad account.' },
};

export default function EmptyState({ kind, onConnect }: { kind: Kind; onConnect?: () => void }) {
  const c = COPY[kind];
  return (
    <div className="mx-auto mt-6 max-w-xl rounded-2xl p-8 text-center" style={{ background: colors.card, border: `1px solid ${colors.border}` }}>
      {kind === 'syncing' ? <Loader2 className="mx-auto mb-4 animate-spin" size={28} style={{ color: colors.primary }} /> : null}
      <h2 className="text-xl font-semibold" style={{ color: colors.foreground }}>{c.title}</h2>
      <p className="mt-2 text-[15px] leading-relaxed" style={{ color: colors.mutedForeground }}>{c.body}</p>
      {kind === 'not_connected' || kind === 'reconnect' ? (
        <button type="button" onClick={onConnect} className="mt-6 inline-flex h-12 items-center gap-2 rounded-xl px-6 text-base font-semibold" style={{ background: '#0866FF', color: '#fff' }}>
          {kind === 'reconnect' ? <RefreshCw size={18} /> : <Facebook size={18} />} {kind === 'reconnect' ? 'Reconnect' : 'Connect with Facebook'}
        </button>
      ) : null}
      {kind === 'needs_selection' ? (
        <Link href="/integrations/meta-intel/select" className="mt-6 inline-flex h-12 items-center rounded-xl px-6 text-base font-semibold" style={{ background: colors.primary, color: colors.primaryForeground }}>
          Choose accounts
        </Link>
      ) : null}
      {kind === 'empty' ? (
        <Link href="/settings?tab=integrations" className="mt-6 inline-flex h-11 items-center gap-2 rounded-xl px-5 text-sm font-semibold" style={{ background: colors.secondary, color: colors.foreground, border: `1px solid ${colors.border}` }}>
          <Settings2 size={16} /> Check linked accounts
        </Link>
      ) : null}
    </div>
  );
}
