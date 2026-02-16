'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Button } from './ui/button';
import { useScrollAnimation } from '../hooks/use-scroll-animation';
import colors from '@/lib/ui/colors';
import { Check, X } from 'lucide-react';

type BillingMode = 'monthly' | '3months';

// Pay As You Go + Growth Lite + Growth Pro
const PLANS = [
  {
    key: 'payg',
    name: 'Pay As You Go',
    type: 'payg' as const,
    priceMonthly: null,
    priceQuarterly: null,
    effectivePerMonth: null,
    imageCredits: '10 credits = ₹99',
    videoCredits: '8 sec = ₹199',
    freeIncluded: '5 images, 8 sec video',
    noWatermark: true,
    crossPlatformPosting: false,
    automation: false,
    analytics: false,
    scheduling: false,
    competitorAnalysis: false,
    yourBrand: false,
    priorityProcessing: false,
    monthlyReset: 'No',
    cta: 'Start Free Trial',
    ctaHref: '/auth/signup',
    popular: false,
    comingSoon: false,
  },
  {
    key: 'growth_lite',
    name: 'Growth Lite',
    type: 'subscription' as const,
    priceMonthly: 599,
    priceQuarterly: 1749,
    effectivePerMonth: 583,
    imageCredits: '30/mo',
    videoCredits: '20 sec/mo',
    freeIncluded: '5 images, 6 sec video',
    noWatermark: true,
    crossPlatformPosting: true,
    automation: false,
    analytics: true,
    scheduling: false,
    competitorAnalysis: false,
    yourBrand: false,
    priorityProcessing: false,
    monthlyReset: 'Yes',
    cta: 'Coming Soon',
    ctaHref: '#',
    popular: true,
    comingSoon: true,
  },
  {
    key: 'growth_pro',
    name: 'Growth Pro',
    type: 'subscription' as const,
    priceMonthly: 2199,
    priceQuarterly: 6399,
    effectivePerMonth: 733,
    imageCredits: '50/mo',
    videoCredits: '50 sec/mo',
    freeIncluded: '5 images, 6 sec video',
    noWatermark: true,
    crossPlatformPosting: true,
    automation: true,
    analytics: true,
    scheduling: true,
    competitorAnalysis: true,
    yourBrand: true,
    priorityProcessing: true,
    monthlyReset: 'Yes',
    cta: 'Coming Soon',
    ctaHref: '#',
    popular: false,
    comingSoon: true,
  },
] as const;

const PricingPreview: React.FC = () => {
  const [billingMode, setBillingMode] = useState<BillingMode>('monthly');
  const { elementRef: titleRef, isVisible: titleVisible } = useScrollAnimation();
  const { elementRef: contentRef, isVisible: contentVisible } = useScrollAnimation({ threshold: 0.1 });

  return (
    <section id="pricing" className="py-24 relative overflow-hidden section-solid">
      <div className="grain-overlay" />

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Section Header */}
        <div
          ref={titleRef}
          className="text-center max-w-3xl mx-auto mb-10 transition-all duration-700"
          style={{ opacity: titleVisible ? 1 : 0, transform: titleVisible ? 'translateY(0)' : 'translateY(20px)', transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)' }}
        >
          <h2 className="text-4xl md:text-[46px] font-normal mb-4 leading-tight" style={{ color: colors.foreground }}>
            Simple Pricing for Lean Marketing Teams
          </h2>
          <p className="text-lg font-extralight" style={{ color: colors.mutedForeground }}>
            Pay as you go for images & video, or subscribe to Growth Lite or Growth Pro.
          </p>
        </div>

        {/* Billing Toggle (subscription plans only) */}
        <div
          ref={contentRef}
          className="flex justify-center mb-6 transition-all duration-700"
          style={{ opacity: contentVisible ? 1 : 0, transform: contentVisible ? 'translateY(0)' : 'translateY(20px)', transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)' }}
        >
          <div
            className="inline-flex rounded-xl p-1"
            style={{ background: 'rgba(255,255,255,0.06)', border: `1px solid ${colors.border}` }}
          >
            <button
              onClick={() => setBillingMode('monthly')}
              className="px-5 py-2.5 rounded-lg font-semibold text-sm transition-all duration-200"
              style={{
                background: billingMode === 'monthly' ? colors.primary : 'transparent',
                color: billingMode === 'monthly' ? colors.primaryForeground : colors.mutedForeground,
              }}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingMode('3months')}
              className="px-5 py-2.5 rounded-lg font-semibold text-sm transition-all duration-200 flex items-center gap-1.5"
              style={{
                background: billingMode === '3months' ? colors.primary : 'transparent',
                color: billingMode === '3months' ? colors.primaryForeground : colors.mutedForeground,
              }}
            >
              3 Months
              <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(34,197,94,0.25)', color: '#22c55e' }}>Save More</span>
            </button>
          </div>
        </div>

        {/* Comparison Table: Pay As You Go | Growth Lite | Growth Pro */}
        <div
          className="max-w-5xl mx-auto mb-8 transition-all duration-500 overflow-x-auto"
          style={{ opacity: contentVisible ? 1 : 0 }}
        >
          <div
            className="rounded-2xl overflow-hidden"
            style={{ background: 'hsl(0 0% 14% / 0.7)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.06)' }}
          >
            <div className="grid grid-cols-4 gap-0 min-w-[720px]">
              {/* Header row */}
              <div className="p-4 border-b border-r" style={{ borderColor: 'rgba(255,255,255,0.06)' }} />
              {PLANS.map((p) => (
                <div
                  key={p.key}
                  className="p-4 md:p-5 border-b border-r text-center last:border-r-0"
                  style={{
                    borderColor: 'rgba(255,255,255,0.06)',
                    background: p.popular ? 'hsl(213 100% 55% / 0.08)' : undefined,
                  }}
                >
                  <span className="font-bold text-base md:text-lg" style={{ color: colors.foreground }}>{p.name}</span>
                  {p.popular && (
                    <span className="inline-block text-xs font-semibold px-2 py-0.5 rounded-full mt-2" style={{ background: colors.primary, color: colors.primaryForeground }}>Most Popular</span>
                  )}
                  <div className="font-bold text-lg md:text-xl mt-2" style={{ color: colors.foreground }}>
                    {p.type === 'payg' ? (
                      <span className="text-sm font-normal" style={{ color: colors.mutedForeground }}>No subscription</span>
                    ) : billingMode === 'monthly' ? (
                      <>
                        ₹{p.priceMonthly!.toLocaleString()}<span className="text-sm font-normal" style={{ color: colors.mutedForeground }}>/mo</span>
                        <span className="block text-xs font-normal mt-0.5" style={{ color: colors.mutedForeground }}>(excl tax)</span>
                      </>
                    ) : (
                      <>
                        ₹{p.priceQuarterly!.toLocaleString()}
                        <span className="text-xs font-normal block mt-0.5" style={{ color: colors.mutedForeground }}>₹{p.effectivePerMonth!.toLocaleString()}/mo effective</span>
                        <span className="block text-xs font-normal mt-0.5" style={{ color: colors.mutedForeground }}>(excl tax)</span>
                      </>
                    )}
                  </div>
                </div>
              ))}

              {/* Feature rows */}
              {[
                { label: 'Limited Free Trial', values: PLANS.map((p) => p.freeIncluded) },
                { label: 'Image Credits', values: PLANS.map((p) => p.imageCredits) },
                { label: 'Video Credits', values: PLANS.map((p) => p.videoCredits) },
                { label: 'No Watermark', values: PLANS.map((p) => p.noWatermark) },
                { label: 'Cross Platform Posting', values: PLANS.map((p) => p.crossPlatformPosting) },
                { label: 'Smart AI Automation', values: PLANS.map((p) => p.automation) },
                { label: 'AI Analytics', values: PLANS.map((p) => p.analytics) },
                { label: 'Scheduling', values: PLANS.map((p) => p.scheduling) },
                { label: 'Competitor Analysis', values: PLANS.map((p) => p.competitorAnalysis) },
                { label: 'Your Brand', values: PLANS.map((p) => p.yourBrand) },
                { label: 'Priority Processing', values: PLANS.map((p) => p.priorityProcessing) },
                { label: 'Monthly Reset', values: PLANS.map((p) => p.monthlyReset) },
              ].map((row, i) => (
                <div key={i} className="grid grid-cols-4 gap-0 col-span-4" style={row.label === 'Limited Free Trial' ? { background: 'rgba(34,197,94,0.12)' } : undefined}>
                  <div className="p-3 md:p-4 border-b border-r text-sm" style={{ borderColor: 'rgba(255,255,255,0.06)', color: row.label === 'Limited Free Trial' ? colors.foreground : colors.mutedForeground, fontWeight: row.label === 'Limited Free Trial' ? 600 : undefined }}>{row.label}</div>
                  {row.values.map((val, cellIdx) => (
                    <div
                      key={cellIdx}
                      className={`p-3 md:p-4 border-b border-r flex items-center justify-center ${cellIdx === PLANS.length - 1 ? 'last:border-r-0' : ''}`}
                      style={{
                        borderColor: 'rgba(255,255,255,0.06)',
                        background: row.label === 'Limited Free Trial' ? 'rgba(34,197,94,0.16)' : PLANS[cellIdx].popular ? 'hsl(213 100% 55% / 0.04)' : undefined,
                      }}
                    >
                      {typeof val === 'boolean' ? (
                        val ? <Check size={18} style={{ color: '#22c55e' }} /> : <X size={18} style={{ color: '#ef4444' }} />
                      ) : (
                        <span className="text-sm" style={{ color: colors.foreground }}>{val}</span>
                      )}
                    </div>
                  ))}
                </div>
              ))}

              {/* CTA row */}
              <div className="col-span-4 grid grid-cols-4 gap-0">
                <div className="p-4 border-r" style={{ borderColor: 'rgba(255,255,255,0.06)' }} />
                {PLANS.map((p) => (
                  <div key={p.key} className="p-4 border-r last:border-r-0 flex flex-col items-center" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                    {p.comingSoon ? (
                      <Button
                        variant="outline"
                        size="lg"
                        className="w-full cursor-not-allowed"
                        disabled
                        style={{ background: 'rgba(255,255,255,0.08)', color: colors.mutedForeground, borderColor: colors.border }}
                      >
                        {p.cta}
                      </Button>
                    ) : (
                      <Button
                        variant={p.popular ? 'hero' : 'outline'}
                        size="lg"
                        className="w-full"
                        asChild
                        style={p.popular ? { background: colors.gradientPrimary, color: colors.primaryForeground, boxShadow: colors.shadowGlow } : {}}
                      >
                        <Link href={p.ctaHref}>{p.cta}</Link>
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <p className="text-center text-sm mt-4" style={{ color: colors.mutedForeground }}>
            Pay As You Go: no expiry, no monthly reset. Subscription credits reset monthly.
          </p>
        </div>
      </div>
    </section>
  );
};

export default PricingPreview;

