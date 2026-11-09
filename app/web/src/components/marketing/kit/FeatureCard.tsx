import React from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import type { FeatureStatus } from '@/content/features';
import { Badge } from './Badge';

/**
 * Card for a feature or point. `status: "soon"` shows a Coming soon badge and never a CTA.
 */
export function FeatureCard({
  title,
  body,
  icon,
  status,
  cta,
  headingLevel = 'h3',
  children,
  className = '',
}: {
  title: string;
  body?: React.ReactNode;
  icon?: React.ReactNode;
  status?: FeatureStatus;
  cta?: { label: string; href: string };
  headingLevel?: 'h3' | 'h4';
  children?: React.ReactNode;
  className?: string;
}) {
  const Heading = headingLevel;
  const showCta = cta && status !== 'soon';
  return (
    <div className={`sx-lift flex h-full flex-col rounded-card border border-line bg-surface p-5 sm:p-6 ${className}`}>
      <div className="flex items-start justify-between gap-3">
        {icon ? (
          <span aria-hidden className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-wash text-accent-deep">
            {icon}
          </span>
        ) : null}
        {status && status !== 'live' ? <Badge status={status} className={icon ? '' : 'order-last'} /> : null}
      </div>
      <Heading className={`${icon ? 'mt-4' : ''} font-display text-h3 font-semibold`}>{title}</Heading>
      {body ? <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">{body}</p> : null}
      {children}
      {showCta ? (
        <Link href={cta.href} className="group mt-auto inline-flex items-center gap-1.5 pt-5 text-[15px] font-medium text-ink">
          <span className="sx-link">{cta.label}</span>
          <ArrowRight aria-hidden className="sx-btn-arrow h-4 w-4" />
        </Link>
      ) : null}
    </div>
  );
}
