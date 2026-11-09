import React from 'react';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import colors from '@/lib/ui/colors';
import type { DashboardPayload } from '@/lib/meta-intel/summary';
import { money, count, ratio, pct, GOOD, BAD } from './format';

type Key = keyof DashboardPayload['kpis'];

const CARDS: { key: Key; label: string; hint: string; fmt: (v: number | null, c: string | null) => string; better: 'up' | 'down' | 'neutral' }[] = [
  { key: 'spend', label: 'Spend', hint: 'Money spent on ads', fmt: (v, c) => money(v, c), better: 'neutral' },
  { key: 'revenue', label: 'Revenue', hint: 'Sales value Meta tracked from your ads', fmt: (v, c) => money(v, c), better: 'up' },
  { key: 'roas', label: 'ROAS', hint: 'Revenue for every 1 spent', fmt: (v) => ratio(v), better: 'up' },
  { key: 'cpa', label: 'Cost per purchase', hint: 'Spend ÷ purchases', fmt: (v, c) => money(v, c), better: 'down' },
  { key: 'purchases', label: 'Purchases', hint: 'Purchases Meta tracked', fmt: (v) => count(v), better: 'up' },
  { key: 'ctr', label: 'Click rate (CTR)', hint: 'Clicks ÷ times shown', fmt: (v) => pct(v), better: 'up' },
];

function Delta({ value, better }: { value: number | null; better: 'up' | 'down' | 'neutral' }) {
  if (value === null) return <span className="text-xs" style={{ color: colors.mutedForeground }}>No earlier data</span>;
  const up = value > 0;
  const flat = value === 0;
  const good = better === 'neutral' || flat ? null : (better === 'up') === up;
  const color = good === null ? colors.mutedForeground : good ? GOOD : BAD;
  const Icon = flat ? Minus : up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className="inline-flex items-center gap-0.5 text-xs font-medium" style={{ color }}>
      <Icon size={14} aria-hidden />
      {Math.abs(value).toFixed(1)}% <span className="font-normal" style={{ color: colors.mutedForeground }}>&nbsp;vs previous</span>
    </span>
  );
}

export default function KpiCards({ data }: { data: DashboardPayload }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
      {CARDS.map((c) => (
        <div key={c.key} className="rounded-2xl p-4" style={{ background: colors.card, border: `1px solid ${colors.border}` }} title={c.hint}>
          <p className="text-xs font-medium uppercase tracking-wide" style={{ color: colors.mutedForeground }}>{c.label}</p>
          <p className="mt-2 text-xl font-semibold tabular-nums sm:text-2xl" style={{ color: colors.foreground }}>
            {c.fmt(data.kpis[c.key], data.currency)}
          </p>
          <div className="mt-1"><Delta value={data.deltas[c.key]} better={c.better} /></div>
        </div>
      ))}
    </div>
  );
}
