'use client';

import React, { useEffect, useState } from 'react';
import colors from '@/lib/ui/colors';

type Props = {
  /** Typical duration shown up front, e.g. "about a minute". */
  typical: string;
  /** Seconds after which the reassurance copy replaces the typical estimate. */
  slowAfterSec?: number;
};

/** Live elapsed time + "still working" reassurance for long onboarding steps. */
export default function ElapsedHint({ typical, slowAfterSec = 45 }: Props) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const started = Date.now();
    const id = window.setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => window.clearInterval(id);
  }, []);

  const mm = Math.floor(elapsed / 60);
  const ss = String(elapsed % 60).padStart(2, '0');
  const slow = elapsed >= slowAfterSec;

  return (
    <p className="mt-6 text-sm" style={{ color: colors.mutedForeground }}>
      <span className="tabular-nums" aria-hidden>
        {mm}:{ss}
      </span>
      <span aria-hidden> · </span>
      <span aria-live="polite">
        {slow
          ? 'Still working — larger sites take a little longer. Keep this tab open.'
          : `This usually takes ${typical}.`}
      </span>
    </p>
  );
}
