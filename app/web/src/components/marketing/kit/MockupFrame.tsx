import React from 'react';

/**
 * Browser / app window frame for product mockups. Always shows a visible label
 * ("Example data" by default) so sample numbers are never mistaken for real results.
 */
export function MockupFrame({
  title,
  label = 'Example data',
  variant = 'browser',
  tone = 'light',
  children,
  className = '',
}: {
  /** Shown in the window bar, e.g. "Competitor Ad Watch". */
  title?: string;
  label?: string;
  variant?: 'browser' | 'app';
  tone?: 'light' | 'dark';
  children: React.ReactNode;
  className?: string;
}) {
  const dark = tone === 'dark';
  return (
    <figure
      className={`m-0 overflow-hidden rounded-card border shadow-frame ${
        dark ? 'border-white/10 bg-[#141414] text-white' : 'border-line bg-surface text-ink'
      } ${className}`}
    >
      <div className={`flex items-center gap-3 border-b px-4 py-2.5 ${dark ? 'border-white/10' : 'border-line'}`}>
        {variant === 'browser' ? (
          <span aria-hidden className="flex gap-1.5">
            <span className={`h-2 w-2 rounded-full ${dark ? 'bg-white/15' : 'bg-ink/15'}`} />
            <span className={`h-2 w-2 rounded-full ${dark ? 'bg-white/15' : 'bg-ink/15'}`} />
            <span className={`h-2 w-2 rounded-full ${dark ? 'bg-white/15' : 'bg-ink/15'}`} />
          </span>
        ) : null}
        {title ? <span className={`min-w-0 flex-1 truncate text-[12.5px] font-medium ${dark ? 'text-white/70' : 'text-ink-soft'}`}>{title}</span> : <span className="flex-1" />}
        <span
          className={`shrink-0 rounded-full border px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.1em] ${
            dark ? 'border-white/20 text-white/70' : 'border-ink/15 bg-paper text-ink-mute'
          }`}
        >
          {label}
        </span>
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </figure>
  );
}
