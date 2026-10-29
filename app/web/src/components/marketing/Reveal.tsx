'use client';

import React, { useEffect, useRef, useState } from 'react';

type Props = {
  children: React.ReactNode;
  className?: string;
  /** Stagger in ms. */
  delay?: number;
  as?: 'div' | 'li' | 'section';
};

/** Fade/slide in once on scroll. Motion is skipped under prefers-reduced-motion (CSS). */
export default function Reveal({ children, className = '', delay = 0, as = 'div' }: Props) {
  const ref = useRef<HTMLElement | null>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || !('IntersectionObserver' in window)) {
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.12 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const Tag = as as React.ElementType;
  return (
    <Tag
      ref={ref}
      data-shown={shown ? 'true' : 'false'}
      className={`sx-reveal ${className}`}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </Tag>
  );
}
