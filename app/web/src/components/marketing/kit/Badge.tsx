import React from 'react';
import type { FeatureStatus } from '@/content/features';

type Tone = 'paper' | 'ink';

const STATUS_LABEL: Record<FeatureStatus, string> = {
  live: 'Live',
  beta: 'Beta',
  soon: 'Coming soon',
};

/** Small pill. `status` renders the Live / Beta / Coming soon label for a feature. */
export function Badge({
  children,
  status,
  tone = 'paper',
  className = '',
}: {
  children?: React.ReactNode;
  status?: FeatureStatus;
  tone?: Tone;
  className?: string;
}) {
  const label = children ?? (status ? STATUS_LABEL[status] : null);
  if (!label) return null;
  const palette =
    status === 'soon'
      ? tone === 'ink'
        ? 'border-paper/25 text-paper/70'
        : 'border-ink/20 text-ink-mute'
      : status === 'beta'
        ? tone === 'ink'
          ? 'border-accent-on-ink/40 text-accent-on-ink'
          : 'border-accent/30 bg-accent-wash text-accent-deep'
        : tone === 'ink'
          ? 'border-paper/20 bg-paper/10 text-paper'
          : 'border-ink/15 bg-surface text-ink';
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.1em] ${palette} ${className}`}
    >
      {label}
    </span>
  );
}
