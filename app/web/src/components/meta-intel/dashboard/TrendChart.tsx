import React from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import colors from '@/lib/ui/colors';
import type { DailyPoint } from '@/lib/meta-intel/kpis';
import { money, shortDate, SERIES } from './format';

function TooltipBox({ active, payload, label, currency }: { active?: boolean; payload?: { dataKey: string; value: number | null }[]; label?: string; currency: string | null }) {
  if (!active || !payload?.length || !label) return null;
  const get = (k: string) => payload.find((p) => p.dataKey === k)?.value ?? null;
  const spend = get('spend');
  const revenue = get('revenue');
  return (
    <div className="rounded-lg px-3 py-2 text-xs shadow-lg" style={{ background: colors.popover, border: `1px solid ${colors.border}`, color: colors.foreground }}>
      <p className="mb-1 font-medium">{shortDate(label)}</p>
      <p className="flex items-center gap-2"><span className="inline-block h-0.5 w-3" style={{ background: SERIES.spend }} />Spend <span className="ml-auto tabular-nums">{money(spend, currency)}</span></p>
      <p className="flex items-center gap-2"><span className="inline-block h-0.5 w-3" style={{ background: SERIES.revenue }} />Revenue <span className="ml-auto tabular-nums">{money(revenue, currency)}</span></p>
      {spend && revenue !== null ? <p className="mt-1" style={{ color: colors.mutedForeground }}>ROAS {(revenue / spend).toFixed(2)}×</p> : null}
    </div>
  );
}

export default function TrendChart({ points, currency }: { points: DailyPoint[]; currency: string | null }) {
  const hasRevenue = points.some((p) => p.revenue !== null);
  return (
    <section className="rounded-2xl p-4 sm:p-5" style={{ background: colors.card, border: `1px solid ${colors.border}` }}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold" style={{ color: colors.foreground }}>Spend vs revenue</h2>
        <div className="flex items-center gap-4 text-xs" style={{ color: colors.mutedForeground }} aria-label="Legend">
          <span className="flex items-center gap-1.5"><span className="inline-block h-0.5 w-4 rounded" style={{ background: SERIES.spend }} />Spend</span>
          <span className="flex items-center gap-1.5"><span className="inline-block h-0.5 w-4 rounded" style={{ background: SERIES.revenue }} />Revenue</span>
        </div>
      </div>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={colors.border} strokeDasharray="0" vertical={false} />
            <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fill: colors.mutedForeground, fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={24} />
            <YAxis tickFormatter={(v: number) => money(v, currency, { compact: true })} tick={{ fill: colors.mutedForeground, fontSize: 11 }} axisLine={false} tickLine={false} width={56} />
            <Tooltip content={<TooltipBox currency={currency} />} cursor={{ stroke: colors.mutedForeground, strokeWidth: 1 }} />
            <Line type="monotone" dataKey="spend" stroke={SERIES.spend} strokeWidth={2} dot={false} activeDot={{ r: 4, stroke: colors.card, strokeWidth: 2 }} isAnimationActive={false} />
            <Line type="monotone" dataKey="revenue" stroke={SERIES.revenue} strokeWidth={2} dot={false} connectNulls={false} activeDot={{ r: 4, stroke: colors.card, strokeWidth: 2 }} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      {!hasRevenue ? (
        <p className="mt-2 text-xs" style={{ color: colors.mutedForeground }}>
          Meta isn’t reporting purchase value for these ads, so revenue can’t be shown. This usually means the Meta Pixel or Conversions API isn’t sending purchase values.
        </p>
      ) : null}
    </section>
  );
}
