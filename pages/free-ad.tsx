import React from 'react';
import dynamic from 'next/dynamic';
import PageSeo from '@/components/seo/PageSeo';
import { HeaderSkeleton } from '@/app/web/src/components/landing-skeletons';
import FreeAdForm from '@/app/web/src/components/FreeAdForm';
import colors from '@/lib/ui/colors';

const Header = dynamic(() => import('../app/web/src/components/Header'), { ssr: true, loading: HeaderSkeleton });
const Footer = dynamic(() => import('../app/web/src/components/Footer'), { ssr: true });

const STEPS = [
  'Tell us your brand and the product to feature.',
  'AJ makes one ad for it using SkalX.',
  'You get it by email within 2 working days. No strings.',
];

/** Door-opener: one free ad, made manually by the founder. */
export default function FreeAdPage() {
  return (
    <div className="min-h-screen relative" style={{ backgroundColor: '#121212' }}>
      <PageSeo
        title="Get one free ad for your brand"
        description="See it before you pay. Tell us your D2C brand and product, and we'll make one ad for it, free, within 2 working days."
        path="/free-ad"
      />
      <Header />
      <main className="relative z-10 px-4 sm:px-6 pt-28 pb-20" style={{ color: colors.foreground }}>
        <div className="mx-auto max-w-5xl grid gap-10 lg:grid-cols-[1fr_1.1fr] lg:gap-16 items-start">
          <div className="lg:pt-6">
            <p className="text-xs sm:text-sm uppercase tracking-[0.2em] mb-4 font-medium" style={{ color: colors.primary }}>
              Free sample
            </p>
            <h1 className="text-4xl sm:text-5xl font-normal leading-tight tracking-tight mb-5">
              See it before you pay.
            </h1>
            <p className="text-lg sm:text-xl font-extralight mb-8" style={{ color: colors.mutedForeground }}>
              We&apos;ll make one ad for your brand, free.
            </p>
            <ol className="space-y-4">
              {STEPS.map((step, i) => (
                <li key={step} className="flex gap-4 items-start">
                  <span
                    aria-hidden
                    className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium"
                    style={{ border: '1px solid rgba(255,255,255,0.2)' }}
                  >
                    {i + 1}
                  </span>
                  <span className="pt-1" style={{ color: colors.mutedForeground }}>
                    {step}
                  </span>
                </li>
              ))}
            </ol>
          </div>

          <div
            className="rounded-2xl p-5 sm:p-8"
            style={{ background: 'hsl(0 0% 11%)', border: '1px solid rgba(255,255,255,0.1)' }}
          >
            <FreeAdForm />
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
