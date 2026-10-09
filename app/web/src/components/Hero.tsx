'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import { Button } from './ui/button';
import colors from '@/lib/ui/colors';
import { useTryNavigation } from '../hooks/use-try-navigation';

function withAlpha(token: string, alpha: number) {
  const hslMatch = token.match(/hsl\(\s*([\d.]+)\s+([\d.]+)%\s+([\d.]+)%\s*\)/i);
  if (hslMatch) {
    const [, h, s, l] = hslMatch;
    return `hsla(${h}, ${s}%, ${l}%, ${alpha})`;
  }
  return token;
}

const EASE = [0.16, 1, 0.3, 1] as const;

const CREATIVES = [
  {
    src: '/images/partners/boat-stone-350-deadpool.png',
    label: 'Social post',
    role: 'side' as const,
    rotate: -6,
  },
  {
    src: '/images/partners/jimmys-cocktails-green-apple-martini.png',
    label: 'Product ad',
    role: 'primary' as const,
    rotate: 0,
  },
  {
    src: '/images/partners/plum-cc332b6e-16f6-42a6-937c-cca1d9a11816.png',
    label: 'Campaign',
    role: 'side' as const,
    rotate: 6,
  },
] as const;

/**
 * Public hero — stacked hierarchy: headline → creatives → brand input.
 * Routes into the canonical /try guest onboarding flow.
 */
const Hero: React.FC = () => {
  const reduceMotion = useReducedMotion();
  const [url, setUrl] = useState('');
  const { goToTry, submitting, inputError, clearError } = useTryNavigation();

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  const fadeUp = (delay = 0) =>
    reduceMotion
      ? {}
      : {
          initial: { opacity: 0, y: 16 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.65, delay, ease: EASE },
        };

  return (
    <section
      id="hero-liquid-trigger"
      className="relative overflow-hidden pt-24 sm:pt-28 pb-14 sm:pb-20"
      style={{ backgroundColor: '#121212', color: colors.foreground }}
    >
      <a id="home" className="absolute top-0 left-0 block w-px h-px invisible" aria-hidden />

      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: colors.gradientMesh, opacity: 0.45 }}
        aria-hidden
      />
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.015]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }}
        aria-hidden
      />

      <div className="container relative z-10 mx-auto flex w-full max-w-5xl flex-col items-center px-4 sm:px-6 lg:px-8">
        {/* 1. Headline — own region, never overlapped */}
        <div className="w-full max-w-[850px] text-center">
          <motion.h1
            className="text-[2rem] font-normal leading-[1.15] tracking-tight sm:text-5xl md:text-[52px]"
            style={{ color: colors.foreground }}
            {...fadeUp(0.05)}
          >
            Your brand.
            <br />
            Infinite possibilities.
          </motion.h1>
          <motion.p
            className="mx-auto mt-4 max-w-xl text-base font-light sm:text-lg"
            style={{ color: colors.mutedForeground }}
            {...fadeUp(0.12)}
          >
            Turn your brand into campaign-ready creatives with AI.
          </motion.p>
        </div>

        {/* 2. Creative showcase — defined container below headline */}
        <motion.div
          className="relative mt-8 w-full max-w-3xl sm:mt-10"
          {...fadeUp(0.2)}
          aria-label="Example SkalX creatives"
        >
          {/* Soft blue glow behind the set */}
          <div
            className="pointer-events-none absolute left-1/2 top-1/2 h-[70%] w-[60%] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
            style={{ background: 'hsl(213 100% 55% / 0.12)' }}
            aria-hidden
          />

      <ParallaxLayer speed={0.08} className="relative" style={{ zIndex: 10 }}>
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10 w-full max-w-6xl">
          <div
            className="text-center mb-4 mx-auto max-w-6xl animate-[fadeUp_0.7s_cubic-bezier(0.16,1,0.3,1)_both"
            style={{ animationDelay: "0.1s" }}
          >
            <h1
              className="text-4xl sm:text-[46px] font-normal leading-tight tracking-tight md:whitespace-nowrap"
              style={{ color: colors.foreground }}
            >
              SkalX AI — Your AI Marketing Partner.
            </h1>
          </div>
          <p
            className="text-center text-xl mb-8 max-w-3xl mx-auto font-extralight animate-[fadeUp_0.7s_cubic-bezier(0.16,1,0.3,1)_both"
            style={{ color: colors.mutedForeground, animationDelay: "0.25s" }}
          >
            SkalX AI understands your brand and creates marketing creatives — ad creatives,
            posters, and short video ads — so campaigns move faster.
          </p>

        {/* 3. Brand input — dedicated panel below artwork */}
        <motion.form
          onSubmit={(e) => goToTry(url, e)}
          className="mt-8 w-full max-w-[760px] rounded-[20px] p-5 sm:mt-10 sm:p-6"
          style={{
            background: `linear-gradient(135deg, ${withAlpha(colors.card, 0.94)} 0%, ${withAlpha(colors.card, 0.98)} 100%)`,
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 20px 48px rgba(0,0,0,0.4)',
            backdropFilter: 'blur(20px)',
          }}
          {...fadeUp(0.42)}
        >
          <div className="space-y-4">
            <label htmlFor="hero-brand-input" className="sr-only">
              Website URL or brand name
            </label>
            <input
              id="hero-brand-input"
              type="text"
              placeholder="Paste your website URL or brand name..."
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                if (inputError) clearError();
              }}
              className="h-12 w-full rounded-[16px] px-4 text-base outline-none"
              style={{
                backgroundColor: 'hsl(0 0% 10%)',
                border: `1px solid ${colors.input}`,
                color: colors.foreground,
              }}
            />
            <div className="flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
              <Button
                type="submit"
                variant="hero"
                size="lg"
                disabled={submitting}
                className="btn-premium w-full min-w-[160px] rounded-xl px-8 py-4 text-base sm:w-auto"
                style={{
                  background: colors.gradientPrimary,
                  color: colors.primaryForeground,
                  boxShadow: colors.shadowGlow,
                }}
              >
                Get Started →
              </Button>
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="w-full min-w-[160px] rounded-xl px-8 py-4 text-base sm:w-auto"
                onClick={() => scrollToSection('how-it-works')}
                style={{ borderColor: colors.border, color: colors.foreground }}
              >
                See How It Works
              </Button>
            </div>
            {inputError && (
              <p className="text-center text-sm" role="alert" style={{ color: 'hsl(0 84% 60%)' }}>
                {inputError}
              </p>
            )}
            <p className="text-center">
              <Link href="/try" className="text-sm font-medium" style={{ color: colors.primary }}>
                Or continue without entering a URL →
              </Link>
            </p>
          </div>
        </motion.form>
      </div>
    </section>
  );
};

export default Hero;
