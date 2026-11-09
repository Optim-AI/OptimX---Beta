// A bar centred on "your average": grows right (better) or left (worse), with the result in words.
// Colour is never the only signal: the sentence below always says better/worse.
import React from 'react';
import colors from '@/lib/ui/colors';
import { GOOD, BAD } from './format';

/** Differences under this are "about average". */
const SAME_BAND = 5;

export function compareTone(pct: number, higherIsBetter: boolean): 'good' | 'bad' | 'same' {
  if (Math.abs(pct) < SAME_BAND) return 'same';
  return (pct > 0) === higherIsBetter ? 'good' : 'bad';
}

export default function CompareBar({ pct, higherIsBetter, text }: { pct: number; higherIsBetter: boolean; text: string }) {
  const tone = compareTone(pct, higherIsBetter);
  const color = tone === 'good' ? GOOD : tone === 'bad' ? BAD : colors.mutedForeground;
  const half = Math.min(Math.abs(pct), 100) / 2;
  return (
    <div className="w-full">
      <div className="relative h-2 w-full rounded-full" style={{ background: colors.muted }} aria-hidden>
        <div className="absolute top-[-3px] h-3.5 w-0.5" style={{ left: '50%', background: colors.mutedForeground }} />
        {tone !== 'same' ? (
          <div className="absolute h-2 rounded-full" style={{ background: color, width: `${Math.max(half, 2)}%`, ...(tone === 'good' ? { left: '50%' } : { right: '50%' }) }} />
        ) : null}
      </div>
      <p className="mt-1 text-[11px] font-medium" style={{ color }}>{text}</p>
    </div>
  );
}
