'use client';

import React from 'react';
import { useScrollPosition } from '../hooks/use-scroll-position';

type LayerConfig = {
  factor: number;
  size: number;
  top?: string;
  bottom?: string;
  left?: string;
  right?: string;
  blur: number;
  opacity: number;
};

/**
 * Site-wide parallax background layers.
 * Decorative blur orbs that move at different speeds for depth effect.
 * Fixed position, sits behind all content.
 */
const ParallaxBackground: React.FC = () => {
  const scrollY = useScrollPosition();

  // Parallax factors: lower = moves slower (further "back"), creates depth
  const layers: LayerConfig[] = [
    { factor: 0.08, size: 480, top: '15%', left: '10%', blur: 140, opacity: 0.04 },
    { factor: 0.12, size: 520, top: '60%', right: '15%', blur: 120, opacity: 0.03 },
    { factor: 0.05, size: 360, bottom: '20%', left: '60%', blur: 100, opacity: 0.025 },
  ];

  return (
    <div
      className="fixed inset-0 pointer-events-none z-0"
      aria-hidden
    >
      {layers.map((layer, i) => {
        const offsetY = scrollY * layer.factor;
        const style: React.CSSProperties = {
          position: 'absolute',
          width: layer.size,
          height: layer.size,
          borderRadius: '50%',
          filter: `blur(${layer.blur}px)`,
          opacity: layer.opacity,
          background: `radial-gradient(circle, hsl(213 100% 55% / 0.6) 0%, transparent 70%)`,
          transform: `translateY(${-offsetY * 0.5}px)`,
          willChange: 'transform',
        };
        if (layer.top) style.top = layer.top;
        if (layer.bottom) style.bottom = layer.bottom;
        if (layer.left) style.left = layer.left;
        if (layer.right) style.right = layer.right;

        return <div key={i} style={style} />;
      })}
    </div>
  );
};

export default ParallaxBackground;
