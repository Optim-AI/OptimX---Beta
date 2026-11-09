import React from 'react';
import { Eyebrow } from '../ui';

export type SectionTone = 'paper' | 'deep' | 'surface' | 'ink';

const TONES: Record<SectionTone, string> = {
  paper: 'bg-paper text-ink',
  deep: 'bg-paper-deep text-ink',
  surface: 'bg-surface text-ink',
  ink: 'bg-ink text-paper',
};

/**
 * Page section with consistent rhythm: mobile-first padding, a max-width container and a tone.
 * Pass `labelledBy` with the id of the section's heading.
 */
export function Section({
  id,
  labelledBy,
  tone = 'paper',
  width = 'default',
  className = '',
  innerClassName = '',
  children,
}: {
  id?: string;
  labelledBy?: string;
  tone?: SectionTone;
  width?: 'narrow' | 'default' | 'wide';
  className?: string;
  innerClassName?: string;
  children: React.ReactNode;
}) {
  const max = width === 'narrow' ? 'max-w-3xl' : width === 'wide' ? 'max-w-7xl' : 'max-w-6xl';
  return (
    <section id={id} aria-labelledby={labelledBy} className={`relative scroll-mt-24 ${TONES[tone]} ${className}`}>
      <div className={`mx-auto ${max} px-4 py-16 sm:px-6 md:py-24 ${innerClassName}`}>{children}</div>
    </section>
  );
}

/** Eyebrow, H2 and sub-line for a section. */
export function SectionHeading({
  id,
  eyebrow,
  title,
  sub,
  align = 'left',
  tone = 'paper',
  as: Tag = 'h2',
  className = '',
}: {
  id?: string;
  eyebrow?: string;
  title: React.ReactNode;
  sub?: React.ReactNode;
  align?: 'left' | 'center';
  tone?: 'paper' | 'ink';
  as?: 'h1' | 'h2';
  className?: string;
}) {
  const center = align === 'center';
  return (
    <div className={`${center ? 'mx-auto text-center' : ''} max-w-3xl ${className}`}>
      {eyebrow ? (
        <Eyebrow tone={tone} className={center ? 'justify-center' : ''}>
          {eyebrow}
        </Eyebrow>
      ) : null}
      <Tag id={id} className="text-balance font-display text-h2 font-semibold">
        {title}
      </Tag>
      {sub ? (
        <p className={`mt-4 max-w-2xl text-lead ${tone === 'ink' ? 'text-paper/75' : 'text-ink-soft'} ${center ? 'mx-auto' : ''}`}>
          {sub}
        </p>
      ) : null}
    </div>
  );
}
