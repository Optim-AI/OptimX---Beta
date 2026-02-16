'use client';

import React, { useEffect, useRef } from 'react';

/**
 * Animates the liquid glass SVG filter's feTurbulence baseFrequency.
 * Uses requestAnimationFrame + Math.sin for smooth, organic water-like shimmer.
 * Ref: Mitkov tutorial / Mikhail Bespalov CodePen (MYwrMNy)
 */
const LiquidGlassAnimator: React.FC = () => {
  const frameRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const turbulence = document.querySelector('#liquid-turbulence') as SVGElement | null;
    if (!turbulence) return;

    const animate = () => {
      frameRef.current += 0.005;
      const freq = 0.006 + Math.sin(frameRef.current) * 0.005;
      turbulence.setAttribute('baseFrequency', String(freq));
      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return null;
};

export default LiquidGlassAnimator;
