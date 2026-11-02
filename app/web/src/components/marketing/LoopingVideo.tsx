'use client';

import React, { useEffect, useRef } from 'react';

/**
 * Silent looping clip for marketing sample tiles. Stays on its poster frame for
 * visitors who prefer reduced motion.
 */
export default function LoopingVideo({ src, poster, label }: { src: string; poster: string; label: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    video.play().catch(() => undefined);
  }, []);
  return (
    <video
      ref={ref}
      src={src}
      poster={poster}
      muted
      loop
      playsInline
      preload="metadata"
      aria-label={label}
      className="absolute inset-0 h-full w-full object-cover"
    />
  );
}
