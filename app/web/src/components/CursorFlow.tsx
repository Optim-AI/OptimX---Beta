'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useIsMobile } from '../hooks/use-mobile';

const BLOB_SIZE = 140;
const LERP = 0.18;
const HEADER_HEIGHT = 64;

const DISABLED = true;

export const CursorFlow: React.FC = () => {
  if (DISABLED) return null;
  const router = useRouter();
  const isMobile = useIsMobile();
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);
  const [fadingOut, setFadingOut] = useState(false);
  const mouseRef = useRef({ x: 0, y: 0, visible: false });
  const smoothRef = useRef({ x: 0, y: 0 });
  const blobRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const fadeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isExcluded = (clientX: number, clientY: number): boolean => {
    if (router.pathname === '/product') return true;
    if (clientY < HEADER_HEIGHT) return true;
    const footer = document.querySelector('footer');
    if (footer) {
      const rect = footer.getBoundingClientRect();
      if (clientY >= rect.top && clientY <= rect.bottom) return true;
    }
    return false;
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleMove = (e: MouseEvent) => {
      const excluded = isExcluded(e.clientX, e.clientY);
      mouseRef.current = { x: e.clientX, y: e.clientY, visible: !excluded };

      if (excluded) {
        setCursorPos(null);
        setFadingOut(true);
        if (fadeTimeoutRef.current) clearTimeout(fadeTimeoutRef.current);
        fadeTimeoutRef.current = setTimeout(() => setFadingOut(false), 500);
        return;
      }

      smoothRef.current = { x: e.clientX, y: e.clientY };
      setCursorPos({ x: e.clientX, y: e.clientY });
      setFadingOut(false);
    };

    const handleLeave = () => {
      mouseRef.current = { x: 0, y: 0, visible: false };
      setCursorPos(null);
      setFadingOut(true);
      if (fadeTimeoutRef.current) clearTimeout(fadeTimeoutRef.current);
      fadeTimeoutRef.current = setTimeout(() => setFadingOut(false), 500);
    };

    const loop = () => {
      rafRef.current = requestAnimationFrame(loop);
      const { x, y, visible } = mouseRef.current;
      const s = smoothRef.current;
      if (visible) {
        smoothRef.current = {
          x: s.x + (x - s.x) * LERP,
          y: s.y + (y - s.y) * LERP,
        };
      }
      if (blobRef.current) {
        const { x: sx, y: sy } = smoothRef.current;
        blobRef.current.style.transform = `
          translate3d(${sx}px, ${sy}px, 0)
          translate(-50%, -50%)
          scale(${visible ? 1.1 : 1})
        `;
      }
    };
    rafRef.current = requestAnimationFrame(loop);

    document.addEventListener('mousemove', handleMove, { passive: true });
    document.addEventListener('mouseleave', handleLeave);
    return () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseleave', handleLeave);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (fadeTimeoutRef.current) clearTimeout(fadeTimeoutRef.current);
    };
  }, [router.pathname]);

  if (isMobile || router.pathname === '/product') return null;

  return (
    <>
      <style jsx global>{`
        .cursor-flow-liquid {
          position: fixed;
          top: 0;
          left: 0;
          pointer-events: none;
          will-change: transform, opacity;
          animation: cursorBlobMorph 7s ease-in-out infinite;
          transition: opacity 0.4s ease;
        }
        .cursor-flow-liquid::after {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: inherit;
          background: radial-gradient(ellipse 80% 80% at 20% 20%, rgba(255,255,255,0.4) 0%, transparent 60%);
          opacity: 0.1;
          pointer-events: none;
        }
        @keyframes cursorBlobMorph {
          0%, 100% { border-radius: 60% 40% 55% 45% / 50% 60% 40% 50%; }
          25% { border-radius: 45% 55% 50% 50% / 55% 45% 55% 45%; }
          50% { border-radius: 50% 50% 40% 60% / 45% 55% 45% 55%; }
          75% { border-radius: 55% 45% 60% 40% / 50% 50% 55% 45%; }
        }
        @media (prefers-reduced-motion: reduce) {
          .cursor-flow-liquid { animation: none; }
        }
      `}</style>
      {(cursorPos !== null || fadingOut) && (
        <div
          ref={blobRef}
          className="cursor-flow-liquid"
          style={{
            width: BLOB_SIZE,
            height: BLOB_SIZE,
            zIndex: 9998,
            borderRadius: '60% 40% 55% 45% / 50% 60% 40% 50%',
            background: 'rgba(255,255,255,0.015)',
            border: '1px solid rgba(255,255,255,0.06)',
            boxShadow: '0 0 60px rgba(255,255,255,0.04), inset 0 1px 0 rgba(255,255,255,0.03)',
            opacity: cursorPos !== null ? 1 : 0,
            filter: 'url(#liquid)',
          }}
          aria-hidden
        />
      )}
    </>
  );
};
