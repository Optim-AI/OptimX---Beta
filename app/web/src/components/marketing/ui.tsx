import React from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

type Tone = 'paper' | 'ink';

/** Small label with a running section index ("01 —"), like a printed proof sheet. */
export function Eyebrow({
  children,
  index,
  tone = 'paper',
  className = '',
}: {
  children: React.ReactNode;
  /** Decorative section number, e.g. "02". */
  index?: string;
  tone?: Tone;
  className?: string;
}) {
  return (
    <p
      className={`mb-5 flex items-center gap-3 text-[12.5px] font-semibold uppercase tracking-[0.18em] ${
        tone === 'ink' ? 'text-accent-on-ink' : 'text-accent'
      } ${className}`}
    >
      {index ? (
        <span aria-hidden className={`font-display tabular-nums ${tone === 'ink' ? 'text-paper/60' : 'text-ink-mute'}`}>
          {index}
        </span>
      ) : null}
      {index ? <span aria-hidden className={`h-px w-6 ${tone === 'ink' ? 'bg-paper/30' : 'bg-ink/25'}`} /> : null}
      <span>{children}</span>
    </p>
  );
}

export function SectionHeading({
  id,
  eyebrow,
  index,
  title,
  intro,
  align = 'left',
  tone = 'paper',
  className = '',
}: {
  id?: string;
  eyebrow?: string;
  index?: string;
  title: React.ReactNode;
  intro?: React.ReactNode;
  align?: 'left' | 'center';
  tone?: Tone;
  className?: string;
}) {
  return (
    <div className={`${align === 'center' ? 'mx-auto text-center' : ''} max-w-2xl ${className}`}>
      {eyebrow ? (
        <Eyebrow index={index} tone={tone} className={align === 'center' ? 'justify-center' : ''}>
          {eyebrow}
        </Eyebrow>
      ) : null}
      <h2
        id={id}
        className="text-balance font-display text-[clamp(2.1rem,4.6vw,3.6rem)] font-semibold leading-[1.02] tracking-[-0.03em]"
      >
        {title}
      </h2>
      {intro ? (
        <p className={`mt-5 max-w-xl text-lg ${tone === 'ink' ? 'text-paper/75' : 'text-ink-soft'} ${align === 'center' ? 'mx-auto' : ''}`}>
          {intro}
        </p>
      ) : null}
    </div>
  );
}

type ButtonLinkProps = {
  href: string;
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'onInk';
  className?: string;
  onClick?: () => void;
  /** Trailing arrow that nudges on hover. */
  arrow?: boolean;
};

const VARIANTS = {
  primary: 'bg-accent text-white shadow-[0_10px_24px_-12px_rgba(29,78,216,0.8)] hover:bg-accent-deep',
  secondary: 'border border-ink/25 text-ink hover:border-ink hover:bg-surface',
  onInk: 'bg-paper text-ink hover:bg-white',
} as const;

/** Link styled as a button. External/mailto hrefs render a plain <a>. */
export function ButtonLink({ href, children, variant = 'primary', className = '', onClick, arrow = false }: ButtonLinkProps) {
  const cls = `inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-6 text-base font-medium transition-[background-color,border-color,transform] active:scale-[0.98] ${VARIANTS[variant]} ${className}`;
  const content = (
    <>
      {children}
      {arrow ? <ArrowRight aria-hidden className="sx-btn-arrow h-4 w-4" /> : null}
    </>
  );
  if (/^(https?:|mailto:)/.test(href)) {
    return (
      <a href={href} className={cls} onClick={onClick}>
        {content}
      </a>
    );
  }
  return (
    <Link href={href} className={cls} onClick={onClick}>
      {content}
    </Link>
  );
}

/** Minimal phone frame for 9:16 creatives. */
export function PhoneFrame({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-[22px] bg-ink p-[5px] shadow-[0_18px_40px_-18px_rgba(23,20,15,0.45)] ${className}`}>
      <div className="relative aspect-[9/16] overflow-hidden rounded-[18px] bg-paper-deep">{children}</div>
    </div>
  );
}
