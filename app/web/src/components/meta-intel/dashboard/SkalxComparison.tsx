import React from 'react';
import { Sparkles } from 'lucide-react';
import colors from '@/lib/ui/colors';
import type { DashboardPayload } from '@/lib/meta-intel/summary';
import { money, ratio, pct } from './format';

const ROWS: { key: 'roas' | 'cpa' | 'ctr' | 'spend'; label: string; fmt: (v: number | null, c: string | null) => string }[] = [
  { key: 'roas', label: 'ROAS', fmt: (v) => ratio(v) },
  { key: 'cpa', label: 'Cost per purchase', fmt: (v, c) => money(v, c) },
  { key: 'ctr', label: 'Click rate', fmt: (v) => pct(v) },
  { key: 'spend', label: 'Spend', fmt: (v, c) => money(v, c) },
];

/** Hidden until both sides have enough spend to compare (see comparisonReady). */
export default function SkalxComparison({ data }: { data: DashboardPayload }) {
  const { ready, skalx, others } = data.comparison;
  if (!ready || !skalx || !others) return null;
  return (
    <section className="rounded-2xl p-4 sm:p-5" style={{ background: colors.card, border: `1px solid ${colors.border}` }}>
      <h2 className="flex items-center gap-2 text-base font-semibold" style={{ color: colors.foreground }}>
        <Sparkles size={16} style={{ color: colors.accentForeground }} aria-hidden /> SkalX ads vs your other ads
      </h2>
      <p className="mb-4 text-xs" style={{ color: colors.mutedForeground }}>Same period, same ad account. {skalx.ads} SkalX ads, {others.ads} other ads.</p>
      <table className="w-full text-sm">
        <thead>
          <tr style={{ color: colors.mutedForeground }}>
            <th className="pb-2 text-left text-xs font-medium" />
            <th className="pb-2 text-right text-xs font-medium">Made by SkalX</th>
            <th className="pb-2 text-right text-xs font-medium">Other ads</th>
          </tr>
        </thead>
        <tbody>
          {ROWS.map((r) => (
            <tr key={r.key} style={{ borderTop: `1px solid ${colors.border}` }}>
              <td className="py-2.5" style={{ color: colors.mutedForeground }}>{r.label}</td>
              <td className="py-2.5 text-right font-semibold tabular-nums" style={{ color: colors.foreground }}>{r.fmt(skalx[r.key], data.currency)}</td>
              <td className="py-2.5 text-right tabular-nums" style={{ color: colors.secondaryForeground }}>{r.fmt(others[r.key], data.currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
