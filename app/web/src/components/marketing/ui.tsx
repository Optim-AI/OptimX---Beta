import React from 'react';
import Link from 'next/link';

export function Eyebrow({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={`mb-4 text-[13px] font-semibold uppercase tracking-[0.16em] text-accent ${className}`}>{children}</p>
  );
}

export function SectionHeading({
  id,
  eyebrow,
  title,
  intro,
  align = 'left',
  className = '',
}: {
  id?: string;
  eyebrow?: string;
  title: React.ReactNode;
  intro?: React.ReactNode;
  align?: 'left' | 'center';
  className?: string;
}) {
  return (
    <div className={`${align === 'center' ? 'mx-auto text-center' : ''} max-w-2xl ${className}`}>
      {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
      <h2 id={id} className="font-display text-[clamp(2rem,4.2vw,3.1rem)] font-medium leading-[1.08] tracking-[-0.015em]">
        {title}
      </h2>
      {intro ? <p className="mt-4 text-lg text-ink-soft">{intro}</p> : null}
    </div>
  );
}

type ButtonLinkProps = {
  href: string;
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'onInk';
  className?: string;
  onClick?: () => void;
};

const VARIANTS = {
  primary: 'bg-accent text-white hover:bg-accent-deep',
  secondary: 'border border-ink/25 text-ink hover:border-ink hover:bg-surface',
  onInk: 'bg-paper text-ink hover:bg-white',
} as const;

/** Link styled as a button. External/mailto hrefs render a plain <a>. */
export function ButtonLink({ href, children, variant = 'primary', className = '', onClick }: ButtonLinkProps) {
  const cls = `inline-flex min-h-12 items-center justify-center rounded-full px-6 text-base font-medium transition-colors ${VARIANTS[variant]} ${className}`;
  if (/^(https?:|mailto:)/.test(href)) {
    return (
      <a href={href} className={cls} onClick={onClick}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={cls} onClick={onClick}>
      {children}
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
