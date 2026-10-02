'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import { Button } from './ui/button';
import { useScrollAnimation } from '../hooks/use-scroll-animation';
import { useTryNavigation } from '../hooks/use-try-navigation';
import colors from '@/lib/ui/colors';

const FinalCTA: React.FC = () => {
  const { elementRef, isVisible } = useScrollAnimation({ threshold: 0.2 });
  const reduceMotion = useReducedMotion();
  const [url, setUrl] = useState('');
  const { goToTry, submitting, inputError, clearError } = useTryNavigation();

  return (
    <section className="py-16 md:py-20 relative overflow-hidden">
      <div
        className="absolute inset-0 pointer-events-none opacity-40"
        style={{ background: colors.gradientMesh }}
        aria-hidden
      />
      <div
        ref={elementRef}
        className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10 max-w-2xl"
      >
        <motion.div
          className="text-center"
          initial={reduceMotion ? false : { opacity: 0, y: 18 }}
          animate={isVisible || reduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 18 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          <h2
            className="text-3xl md:text-4xl font-normal mb-3 leading-tight"
            style={{ color: colors.foreground }}
          >
            Start with your brand.
          </h2>
          <p
            className="text-base mb-8 font-light"
            style={{ color: colors.mutedForeground }}
          >
            See what SkalX creates for you in minutes.
          </p>

          <form
            onSubmit={(e) => goToTry(url, e)}
            className="rounded-2xl p-5 sm:p-6 space-y-4 text-left"
            style={{
              background: colors.glassBg,
              border: `1px solid ${colors.glassBorder}`,
              boxShadow: colors.glassShadow,
            }}
          >
            <label htmlFor="final-cta-input" className="sr-only">
              Website URL or brand name
            </label>
            <input
              id="final-cta-input"
              type="text"
              placeholder="Website URL or brand name..."
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                if (inputError) clearError();
              }}
              className="w-full h-12 rounded-xl px-4 outline-none"
              style={{
                background: 'hsl(0 0% 10%)',
                border: `1px solid ${colors.input}`,
                color: colors.foreground,
              }}
            />
            {inputError && (
              <p className="text-sm" role="alert" style={{ color: 'hsl(0 84% 60%)' }}>
                {inputError}
              </p>
            )}
            <Button
              type="submit"
              variant="hero"
              size="lg"
              disabled={submitting}
              className="w-full sm:w-auto px-10 py-5 text-base btn-premium"
              style={{
                background: colors.gradientPrimary,
                color: colors.primaryForeground,
                boxShadow: colors.shadowGlow,
              }}
            >
              Get Started →
            </Button>
          </form>

          <div className="mt-5">
            <Link href="/Contact" className="text-sm" style={{ color: colors.mutedForeground }}>
              Talk to Sales
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default FinalCTA;
