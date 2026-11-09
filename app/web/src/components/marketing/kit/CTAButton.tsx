import React from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

type Variant = 'primary' | 'secondary' | 'onInk' | 'ghostOnInk';
type Size = 'md' | 'lg';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent text-white shadow-[0_10px_24px_-12px_rgba(29,78,216,0.8)] hover:bg-accent-deep',
  secondary: 'border border-ink/25 bg-transparent text-ink hover:border-ink hover:bg-surface',
  onInk: 'bg-paper text-ink hover:bg-white',
  ghostOnInk: 'border border-paper/30 text-paper hover:border-paper hover:bg-paper/10',
};

const SIZES: Record<Size, string> = {
  md: 'min-h-11 px-5 text-[15px]',
  lg: 'min-h-12 px-6 text-base',
};

type Props = {
  href: string;
  children: React.ReactNode;
  variant?: Variant;
  size?: Size;
  /** Trailing arrow that nudges on hover. */
  arrow?: boolean;
  className?: string;
  onClick?: () => void;
};

/**
 * Primary / secondary call to action. External (http, mailto) links open as plain anchors;
 * booking links open in a new tab.
 */
export function CTAButton({ href, children, variant = 'primary', size = 'lg', arrow = false, className = '', onClick }: Props) {
  const cls = `group inline-flex items-center justify-center gap-2 rounded-full font-medium transition-[background-color,border-color,transform] active:scale-[0.98] ${VARIANTS[variant]} ${SIZES[size]} ${className}`;
  const content = (
    <>
      {children}
      {arrow ? <ArrowRight aria-hidden className="sx-btn-arrow h-4 w-4" /> : null}
    </>
  );
  if (/^https?:/.test(href)) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={cls} onClick={onClick}>
        {content}
      </a>
    );
  }
  if (/^mailto:/.test(href)) {
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
