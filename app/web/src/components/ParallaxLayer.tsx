'use client';

import React from 'react';
import { useScrollPosition } from '../hooks/use-scroll-position';

type ParallaxLayerProps = {
  /** Parallax factor: 0.05–0.15 typical. Positive = lags behind (moves slower), negative = leads (moves faster). */
  speed?: number;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
};

/**
 * Wraps content and applies scroll-based parallax transform.
 * Creates depth by shifting the element slightly as the user scrolls.
 */
export const ParallaxLayer: React.FC<ParallaxLayerProps> = ({
  speed = 0.12,
  children,
  className = '',
  style = {},
}) => {
  const scrollY = useScrollPosition();
  // Negative: as we scroll down, element translates up slightly = "lags behind" (depth)
  const offsetY = -scrollY * speed;

  return (
    <div
      className={className}
      style={{
        ...style,
        transform: `translateY(${offsetY}px)`,
        willChange: 'transform',
      }}
    >
      {children}
    </div>
  );
};
