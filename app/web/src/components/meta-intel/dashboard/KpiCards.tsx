// Headline numbers in plain words: money in vs money out, then cost per sale, sales and clicks.
// Every card says whether it got better or worse than the previous period (icon + words, not colour alone)
// and explains the business term behind a "What is this?" toggle.
import React, { useState } from 'react';
import { ArrowDownRight, ArrowUpRight, Minus, HelpCircle } from 'lucide-react';
import colors from '@/lib/ui/colors';
import type { DashboardPayload } from '@/lib/meta-intel/summary';
import { money, perUnit, count, GOOD, BAD, SERIES } from './format';

type Key = keyof DashboardPayload['kpis'];
type Better = 'up' | 'down';

/** Changes smaller than this are "about the same". */
const SAME_BAND_PCT = 5;

export function signal(delta: number | null, better: Better): { tone: 'good' | 'bad' | 'same' | 'none'; text: string } {
  if (delta === null) return { tone: 'none', text: 'No earlier period to compare' };
  if (Math.abs(delta) < SAME_BAND_PCT) return { tone: 'same', text: 'About the same as before' };
  const good = (better === 'up') === delta > 0;
  return { tone: good ? 'good' : 'bad', text: `${good ? 'Better' : 'Worse'} than before (${delta > 0 ? 'up' : 'down'} ${Math.abs(delta).toFixed(0)}%)` };
}

function Signal({ delta, better }: { delta: number | null; better: Better }) {
  const s = signal(delta, better);
  const color = s.tone === 'good' ? GOOD : s.tone === 'bad' ? BAD : colors.mutedForeground;
  const Icon = s.tone === 'none' || s.tone === 'same' ? Minus : (delta ?? 0) > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium" style={{ color }}>
      <Icon size={14} aria-hidden /> {s.text}
    </span>
  );
}

function Explain({ term, text }: { term: string; text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-2">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
        className="inline-flex items-center gap-1 text-[11px] font-medium hover:underline" style={{ color: colors.mutedForeground }}>
        <HelpCircle size={12} aria-hidden /> What is this?
      </button>
      {open ? <p className="mt-1 text-xs leading-relaxed" style={{ color: colors.mutedForeground }}><b style={{ color: colors.foreground }}>{term}.</b> {text}</p> : null}
    </div>
  );
}

function MoneyBar({ label, value, color, max, currency }: { label: string; value: number | null; color: string; max: number; currency: string | null }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span style={{ color: colors.mutedForeground }}>{label}</span>
        <span className="text-lg font-semibold tabular-nums" style={{ color: colors.foreground }}>{money(value, currency)}</span>
      </div>
      <div className="mt-1.5 h-3 w-full rounded-full" style={{ background: colors.muted }}>
        <div className="h-3 rounded-full" style={{ width: `${Math.max(2, ((value ?? 0) / max) * 100)}%`, background: color }} />
      </div>
    </div>
  );
}

/** Money in vs money out: two bars on one scale, so "did ads pay back" shows at a glance. */
function MoneyInOut({ data }: { data: DashboardPayload }) {
  const { spend, revenue, roas } = data.kpis;
  const max = Math.max(spend ?? 0, revenue ?? 0, 1);
  const verdict = revenue === null
    ? { tone: 'warn', text: 'Meta isn’t reporting sales from these ads yet, so SkalX can’t tell what they brought back.' }
    : roas !== null && roas >= 1
      ? { tone: 'good', text: `For every ${money(1, data.currency)} you spent, your ads brought back ${perUnit(roas, data.currency)} in sales.` }
      : { tone: 'bad', text: `For every ${money(1, data.currency)} you spent, your ads brought back only ${perUnit(roas ?? 0, data.currency)} in sales.` };
  const vColor = verdict.tone === 'good' ? GOOD : verdict.tone === 'bad' ? BAD : 'hsl(38 92% 60%)';
  return (
    <section aria-label="Money in vs money out" className="rounded-2xl p-4 sm:p-5" style={{ background: colors.card, border: `1px solid ${colors.border}` }}>
      <h2 className="text-base font-semibold" style={{ color: colors.foreground }}>Money in vs money out</h2>
      <p className="mt-1 text-sm font-medium" style={{ color: vColor }}>{verdict.text}</p>
      <div className="mt-4 space-y-3">
        <MoneyBar label="You spent on ads" value={spend} color={SERIES.spend} max={max} currency={data.currency} />
        <MoneyBar label="Sales your ads brought in" value={revenue} color={SERIES.revenue} max={max} currency={data.currency} />
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <Signal delta={data.deltas.roas} better="up" />
        <Explain term="ROAS (return on ad spend)" text="Sales from ads divided by what the ads cost. 3× means ₹3 of sales for every ₹1 spent. It doesn’t include your product or delivery costs, so a good level depends on your margins." />
      </div>
    </section>
  );
}

const CARDS: { key: Key; title: string; value: (d: DashboardPayload) => string; meaning: (d: DashboardPayload) => string; better: Better; term: string; explain: string }[] = [
  {
    key: 'cpa', title: 'Cost of each sale', better: 'down',
    value: (d) => money(d.kpis.cpa, d.currency),
    meaning: () => 'What you paid in ads, on average, for one purchase.',
    term: 'CPA (cost per purchase)', explain: 'Money spent ÷ number of purchases. Lower is better. If it is more than you make on one order, the ads are losing money.',
  },
  {
    key: 'purchases', title: 'Sales from ads', better: 'up',
    value: (d) => (d.kpis.purchases === null ? '—' : `${count(d.kpis.purchases)} ${d.kpis.purchases === 1 ? 'sale' : 'sales'}`),
    meaning: () => 'Purchases Meta tracked after someone saw or clicked your ads.',
    term: 'Purchases', explain: 'Counted by your Meta Pixel or shop connection. If this looks too low, your tracking may be missing some sales.',
  },
  {
    key: 'ctr', title: 'People who clicked', better: 'up',
    value: (d) => (d.kpis.ctr === null ? '—' : `${(d.kpis.ctr).toFixed(1)} in 100`),
    meaning: () => 'Out of every 100 times your ads were shown, how many got a click.',
    term: 'CTR (click-through rate)', explain: 'Clicks ÷ times shown. It tells you whether the picture and words grab attention. Low CTR usually means the ad itself needs to change.',
  },
];

export default function KpiCards({ data }: { data: DashboardPayload }) {
  return (
    <div className="space-y-3">
      <MoneyInOut data={data} />
      <div className="grid gap-3 sm:grid-cols-3">
        {CARDS.map((c) => (
          <div key={c.key} className="rounded-2xl p-4" style={{ background: colors.card, border: `1px solid ${colors.border}` }}>
            <p className="text-sm font-medium" style={{ color: colors.mutedForeground }}>{c.title}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums" style={{ color: colors.foreground }}>{c.value(data)}</p>
            <p className="mt-1 text-xs" style={{ color: colors.mutedForeground }}>{c.meaning(data)}</p>
            <div className="mt-2"><Signal delta={data.deltas[c.key]} better={c.better} /></div>
            <Explain term={c.term} text={c.explain} />
          </div>
        ))}
      </div>
    </div>
  );
}
