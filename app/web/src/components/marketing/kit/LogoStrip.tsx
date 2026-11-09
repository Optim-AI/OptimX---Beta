import React from 'react';
import Image from 'next/image';
import { LOGOS, LOGO_FALLBACK, permittedLogos, type CustomerLogo } from '@/content/logos';

/**
 * "Brands growing with SkalX" logo row, only for logos with permission.
 * With none permitted, shows the "Made for brands in" category chips instead.
 */
export function LogoStrip({
  logos = LOGOS,
  label = 'Brands growing with SkalX',
  className = '',
}: {
  logos?: CustomerLogo[];
  label?: string;
  className?: string;
}) {
  const shown = permittedLogos(logos);
  if (shown.length === 0) {
    return (
      <div className={`flex flex-col items-center gap-3 sm:flex-row sm:justify-center sm:gap-4 ${className}`}>
        <p className="text-sm font-medium text-ink-mute">{LOGO_FALLBACK.label}</p>
        <ul className="flex flex-wrap justify-center gap-2">
          {LOGO_FALLBACK.categories.map((c) => (
            <li key={c} className="rounded-full border border-line bg-surface px-3.5 py-1.5 text-sm text-ink-soft">
              {c}
            </li>
          ))}
        </ul>
      </div>
    );
  }
  return (
    <div className={className}>
      <p className="text-center text-sm font-medium text-ink-mute">{label}</p>
      <ul className="mt-5 flex flex-wrap items-center justify-center gap-x-10 gap-y-6">
        {shown.map((l) => (
          <li key={l.name}>
            <Image src={l.src} alt={l.name} width={l.width} height={l.height} className="h-7 w-auto opacity-70 grayscale" />
          </li>
        ))}
      </ul>
    </div>
  );
}
