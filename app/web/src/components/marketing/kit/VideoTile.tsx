'use client';

import React, { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { Pause, Play } from 'lucide-react';

type Source = { src: string; type: 'video/webm' | 'video/mp4' };

/**
 * Lazy video tile: shows the poster image first, loads and plays (muted, looping) only while
 * on screen, and pauses when scrolled away. With prefers-reduced-motion it never autoplays;
 * the visitor can press play. Always has a pause/play control.
 */
export function VideoTile({
  sources,
  poster,
  label,
  aspect = '9/16',
  frame = 'none',
  className = '',
}: {
  /** WebM first, MP4 fallback. */
  sources: Source[];
  poster: string;
  /** Describes the video for screen readers. */
  label: string;
  aspect?: '9/16' | '4/5' | '1/1' | '16/9';
  frame?: 'none' | 'phone';
  className?: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [load, setLoad] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [userPaused, setUserPaused] = useState(false);
  const reduced = useRef(false);

  useEffect(() => {
    reduced.current = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const el = wrapRef.current;
    if (!el || !('IntersectionObserver' in window)) {
      setLoad(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        const video = videoRef.current;
        if (entry.isIntersecting) {
          setLoad(true);
          if (video && !reduced.current && !userPaused) video.play().catch(() => undefined);
        } else if (video) {
          video.pause();
        }
      },
      { threshold: 0.35 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [userPaused]);

  const toggle = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      setUserPaused(false);
      video.play().catch(() => undefined);
    } else {
      setUserPaused(true);
      video.pause();
    }
  };

  const ratio = { '9/16': 'aspect-[9/16]', '4/5': 'aspect-[4/5]', '1/1': 'aspect-square', '16/9': 'aspect-video' }[aspect];
  const inner = (
    <div ref={wrapRef} className={`relative overflow-hidden ${frame === 'phone' ? 'rounded-[18px]' : 'rounded-card'} ${ratio} bg-paper-deep`}>
      <Image src={poster} alt="" fill sizes="(max-width: 768px) 60vw, 280px" className="object-cover" />
      {load ? (
        <video
          ref={videoRef}
          poster={poster}
          muted
          loop
          playsInline
          preload="none"
          aria-label={label}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          className="absolute inset-0 h-full w-full object-cover"
        >
          {sources.map((s) => (
            <source key={s.src} src={s.src} type={s.type} />
          ))}
        </video>
      ) : null}
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? `Pause: ${label}` : `Play: ${label}`}
        className="absolute bottom-2.5 right-2.5 flex h-9 w-9 items-center justify-center rounded-full bg-ink/70 text-paper backdrop-blur transition-colors hover:bg-ink"
      >
        {playing ? <Pause className="h-3.5 w-3.5 fill-current" /> : <Play className="h-3.5 w-3.5 fill-current" />}
      </button>
    </div>
  );
  if (frame === 'phone') {
    return <div className={`rounded-[22px] bg-ink p-[5px] shadow-card ${className}`}>{inner}</div>;
  }
  return <div className={className}>{inner}</div>;
}
