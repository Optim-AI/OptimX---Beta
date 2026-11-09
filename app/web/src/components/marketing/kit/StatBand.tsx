import React from 'react';
import { MIN_STATS_TO_SHOW, STATS, sourcedStats, type Stat } from '@/content/stats';

/**
 * Up to 4 stat tiles. Renders only stats with a `source`, and nothing at all when fewer
 * than MIN_STATS_TO_SHOW are sourced.
 */
export function StatBand({ stats = STATS, className = '' }: { stats?: Stat[]; className?: string }) {
  const shown = sourcedStats(stats).slice(0, 4);
  if (shown.length < MIN_STATS_TO_SHOW) return null;
  return (
    <dl className={`grid grid-cols-2 gap-px overflow-hidden rounded-card border border-line bg-line md:grid-cols-4 ${className}`}>
      {shown.map((s) => (
        <div key={s.label} className="flex flex-col bg-surface p-5 sm:p-6">
          <dt className="text-[14px] text-ink-soft">{s.label}</dt>
          <dd className="order-first font-display text-[clamp(1.75rem,4vw,2.5rem)] font-semibold tracking-[-0.03em]">
            {s.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
