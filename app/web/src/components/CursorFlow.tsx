'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useIsMobile } from '../hooks/use-mobile';

const SPOT_RADIUS = 50;
const MAX_TRAIL = 100;
const HEADER_HEIGHT = 64; // h-16

export const CursorFlow: React.FC = () => {
  const router = useRouter();
  const isMobile = useIsMobile();
  const [cursorSpot, setCursorSpot] = useState<{ x: number; y: number } | null>(null);
  const [cursorTrail, setCursorTrail] = useState<Array<{ id: number; x: number; y: number }>>([]);
  const mouseRef = useRef({ x: 0, y: 0, excluded: false });
  const rafRef = useRef<number | null>(null);
  const trailIdRef = useRef(0);

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
      mouseRef.current = { x: e.clientX, y: e.clientY, excluded };

      if (excluded) {
        setCursorSpot(null);
        return;
      }

      setCursorSpot({ x: e.clientX, y: e.clientY });
    };

    const handleLeave = () => {
      mouseRef.current = { x: 0, y: 0, excluded: true };
      setCursorSpot(null);
    };

    let lastX = 0;
    let lastY = 0;
    const loop = () => {
      rafRef.current = requestAnimationFrame(loop);
      const { x, y, excluded } = mouseRef.current;
      if (!excluded && (x !== lastX || y !== lastY)) {
        lastX = x;
        lastY = y;
        trailIdRef.current += 1;
        setCursorTrail((prev) => {
          const next = [...prev, { id: trailIdRef.current, x, y }];
          return next.slice(-MAX_TRAIL);
        });
      }
    };
    rafRef.current = requestAnimationFrame(loop);

    document.addEventListener('mousemove', handleMove, { passive: true });
    document.addEventListener('mouseleave', handleLeave);
    return () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseleave', handleLeave);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [router.pathname]);

  if (isMobile || router.pathname === '/product') return null;

  const trailStyle = {
    width: SPOT_RADIUS * 2,
    height: SPOT_RADIUS * 2,
    borderRadius: '50%',
    background: 'radial-gradient(circle at center, hsl(213 100% 72% / 0.55) 0%, hsl(213 100% 68% / 0.35) 40%, hsl(220 100% 70% / 0.15) 65%, transparent 85%)',
    filter: 'blur(18px)',
    WebkitFilter: 'blur(18px)',
  } as const;

  return (
    <>
      <style jsx global>{`
        @keyframes cursorFlowTrailFade { from{opacity:0.6} to{opacity:0} }
        .cursor-flow-trail { animation: cursorFlowTrailFade 2.2s cubic-bezier(0.4,0,0.2,1) forwards; }
      `}</style>
      {cursorTrail.map((t) => (
        <div
          key={t.id}
          className="cursor-flow-trail fixed pointer-events-none"
          style={{
            ...trailStyle,
            left: t.x - SPOT_RADIUS,
            top: t.y - SPOT_RADIUS,
            zIndex: 9998,
          }}
          aria-hidden
        />
      ))}
      {cursorSpot && (
        <div
          className="fixed pointer-events-none"
          style={{
            ...trailStyle,
            left: cursorSpot.x - SPOT_RADIUS,
            top: cursorSpot.y - SPOT_RADIUS,
            zIndex: 9998,
            filter: 'blur(12px)',
            WebkitFilter: 'blur(12px)',
            willChange: 'left, top',
            transition: 'left 15ms cubic-bezier(0.25, 0.1, 0.25, 1), top 15ms cubic-bezier(0.25, 0.1, 0.25, 1)',
          }}
          aria-hidden
        />
      )}
    </>
  );
};
