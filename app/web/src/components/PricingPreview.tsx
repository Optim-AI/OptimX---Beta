'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Button } from './ui/button';
import { useScrollAnimation } from '../hooks/use-scroll-animation';
import colors from '@/lib/ui/colors';
import { Check, X, Sparkles } from 'lucide-react';

type BillingMode = 'monthly' | '3months' | 'payg';

// Exact pricing from pricing document – DO NOT modify numbers
const SUBSCRIPTION_PLANS = [
  {
    key: 'free_trial',
    name: 'Free trial',
    priceMonthly: 0,
    priceQuarterly: 0,
    duration: '5 days',
    imageCredits: 5,
    videoCredits: '6 seconds',
    watermark: true,
    automation: false,
    analytics: false,
    scheduling: false,
    brandInsights: false,
    priorityProcessing: false,
    monthlyReset: 'N/A',
    cta: 'Explore now',
    ctaHref: '/auth/signup',
    popular: false,
    comingSoon: false,
  },
  {
    key: 'starter',
    name: 'Starter',
    priceMonthly: 1499,
    priceQuarterly: 4197,
    effectivePerMonth: 1399,
    duration: 'Ongoing',
    imageCredits: 20,
    videoCredits: '30 seconds',
    watermark: false,
    automation: false,
    analytics: false,
    scheduling: false,
    brandInsights: false,
    priorityProcessing: false,
    monthlyReset: 'Yes',
    cta: 'Subscribe',
    ctaHref: '/auth/signup',
    popular: true,
    comingSoon: false,
  },
  {
    key: 'lite_growth',
    name: 'Lite Growth',
    priceMonthly: 599,
    priceQuarterly: 1749,
    effectivePerMonth: 583,
    duration: 'Ongoing',
    imageCredits: 30,
    videoCredits: '20 seconds',
    watermark: false,
    automation: false,
    analytics: true,
    scheduling: true,
    brandInsights: false,
    priorityProcessing: false,
    monthlyReset: 'Yes',
    cta: 'Coming Soon',
    ctaHref: '/auth/signup',
    popular: false,
    comingSoon: true,
  },
  {
    key: 'growth_pro',
    name: 'Growth Pro',
    priceMonthly: 2199,
    priceQuarterly: 6399,
    duration: 'Ongoing',
    imageCredits: 30,
    videoCredits: '50 seconds',
    watermark: false,
    automation: true,
    analytics: true,
    scheduling: true,
    brandInsights: true,
    priorityProcessing: true,
    monthlyReset: 'Yes',
    cta: 'Coming Soon',
    ctaHref: '/auth/signup',
    popular: false,
    comingSoon: true,
  },
] as const;

const PricingPreview: React.FC = () => {
  const [billingMode, setBillingMode] = useState<BillingMode>('monthly');
  const { elementRef: titleRef, isVisible: titleVisible } = useScrollAnimation();
  const { elementRef: contentRef, isVisible: contentVisible } = useScrollAnimation({ threshold: 0.1 });

  const isSubscription = billingMode === 'monthly' || billingMode === '3months';

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
          <h2 className="text-4xl md:text-5xl font-bold mb-4 leading-tight" style={{ color: colors.foreground }}>
            Flexible Pricing for Lean Marketing Teams
          </h2>
          <p className="text-lg" style={{ color: colors.mutedForeground }}>
            Choose a subscription or pay as you go. Upgrade anytime.
          </p>
        </div>

        {/* Billing Toggle Controls */}
        <div
          ref={contentRef}
          className="flex justify-center mb-8 transition-all duration-700"
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
            <button
              onClick={() => setBillingMode('payg')}
              className="px-5 py-2.5 rounded-lg font-semibold text-sm transition-all duration-200"
              style={{
                background: billingMode === 'payg' ? colors.primary : 'transparent',
                color: billingMode === 'payg' ? colors.primaryForeground : colors.mutedForeground,
              }}
            >
              Pay As You Go
            </button>
          </div>
        </div>

        {/* Subscription Mode: Comparison Table */}
        {isSubscription && (
          <div
            className="max-w-6xl mx-auto mb-8 transition-all duration-500 overflow-x-auto"
            style={{ opacity: contentVisible ? 1 : 0 }}
          >
            <div
              className="rounded-2xl overflow-hidden"
              style={{ background: 'hsl(0 0% 14% / 0.7)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.06)' }}
            >
              <div className="grid grid-cols-5 gap-0 min-w-[800px]">
                {/* Header row */}
                <div className="p-4 border-b border-r" style={{ borderColor: 'rgba(255,255,255,0.06)' }} />
                {SUBSCRIPTION_PLANS.map((p) => (
                  <div
                    key={p.key}
                    className="p-4 md:p-5 border-b border-r text-center last:border-r-0"
                    style={{
                      borderColor: 'rgba(255,255,255,0.06)',
                      background: p.popular ? 'hsl(213 100% 55% / 0.08)' : undefined,
                    }}
                  >
                    <div className="flex flex-col items-center justify-center gap-1 mb-1">
                      <div className="flex items-center gap-2">
                        {p.key === 'free_trial' && <Sparkles size={18} style={{ color: '#f59e0b' }} />}
                        <span className="font-bold text-base md:text-lg" style={{ color: colors.foreground }}>{p.name}</span>
                      </div>
                      {p.comingSoon && (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: 'rgba(251,191,36,0.2)', color: '#f59e0b' }}>Coming Soon</span>
                      )}
                    </div>
                    {p.popular && (
                      <span className="inline-block text-xs font-semibold px-2 py-0.5 rounded-full mb-2" style={{ background: colors.primary, color: colors.primaryForeground }}>Most Popular</span>
                    )}
                    <div className="font-bold text-xl md:text-2xl" style={{ color: colors.foreground }}>
                      {p.priceMonthly === 0 ? (
                        'Free'
                      ) : billingMode === 'monthly' ? (
                        <>₹{p.priceMonthly.toLocaleString()}<span className="text-sm font-normal" style={{ color: colors.mutedForeground }}>/mo</span></>
                      ) : (
                        <>
                          ₹{p.priceQuarterly.toLocaleString()}
                          <span className="text-xs font-normal block mt-0.5" style={{ color: colors.mutedForeground }}>₹{(p as { effectivePerMonth?: number }).effectivePerMonth?.toLocaleString() || Math.round(p.priceQuarterly / 3).toLocaleString()}/mo effective</span>
                        </>
                      )}
                    </div>
                  </div>
                ))}

                {/* Feature rows */}
                {[
                  { label: 'Duration', values: SUBSCRIPTION_PLANS.map((p) => p.duration) },
                  { label: 'Image Credits', values: SUBSCRIPTION_PLANS.map((p) => String(p.imageCredits)) },
                  { label: 'Video Credits', values: SUBSCRIPTION_PLANS.map((p) => p.videoCredits) },
                  { label: 'Watermark', values: SUBSCRIPTION_PLANS.map((p) => p.watermark) },
                  { label: 'Automation', values: SUBSCRIPTION_PLANS.map((p) => p.automation) },
                  { label: 'Analytics', values: SUBSCRIPTION_PLANS.map((p) => p.analytics) },
                  { label: 'Scheduling', values: SUBSCRIPTION_PLANS.map((p) => p.scheduling) },
                  { label: 'Brand & Competitor Insights', values: SUBSCRIPTION_PLANS.map((p) => p.brandInsights) },
                  { label: 'Priority Processing', values: SUBSCRIPTION_PLANS.map((p) => p.priorityProcessing) },
                  { label: 'Monthly Reset Rule', values: SUBSCRIPTION_PLANS.map((p) => p.monthlyReset) },
                ].map((row, i) => (
                  <div key={i} className="grid grid-cols-5 gap-0 col-span-5">
                    <div className="p-3 md:p-4 border-b border-r text-sm" style={{ borderColor: 'rgba(255,255,255,0.06)', color: colors.mutedForeground }}>{row.label}</div>
                    {row.values.map((val, cellIdx) => (
                      <div
                        key={cellIdx}
                        className={`p-3 md:p-4 border-b border-r flex items-center justify-center ${cellIdx === SUBSCRIPTION_PLANS.length - 1 ? 'last:border-r-0' : ''}`}
                        style={{
                          borderColor: 'rgba(255,255,255,0.06)',
                          background: SUBSCRIPTION_PLANS[cellIdx].popular ? 'hsl(213 100% 55% / 0.04)' : undefined,
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
                <div className="col-span-5 grid grid-cols-5 gap-0">
                  <div className="p-4 border-r" style={{ borderColor: 'rgba(255,255,255,0.06)' }} />
                  {SUBSCRIPTION_PLANS.map((p) => (
                    <div key={p.key} className="p-4 border-r last:border-r-0 flex flex-col items-center" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                      {p.comingSoon ? (
                        <span
                          className="w-full py-3 rounded-lg font-semibold text-center text-sm"
                          style={{ background: 'rgba(255,255,255,0.08)', color: colors.mutedForeground }}
                        >
                          Coming Soon
                        </span>
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
              Subscription credits reset monthly. Unused credits do not roll over.
            </p>
          </div>
        )}

        {/* Pay-As-You-Go Mode */}
        {billingMode === 'payg' && (
          <div
            className="max-w-2xl mx-auto mb-8 transition-all duration-500"
            style={{ opacity: contentVisible ? 1 : 0 }}
          >
            <h3 className="text-xl font-bold mb-6 text-center" style={{ color: colors.foreground }}>
              Pay as you go
            </h3>

            <div className="grid md:grid-cols-2 gap-6 mb-6">
              <div
                className="p-6 rounded-2xl"
                style={{ background: 'hsl(0 0% 14% / 0.7)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.06)' }}
              >
                <h4 className="font-semibold mb-4 text-base" style={{ color: colors.foreground }}>Image Credits</h4>
                <div className="flex justify-between items-center py-2">
                  <span style={{ color: colors.mutedForeground }}>10 credits</span>
                  <span className="font-semibold" style={{ color: colors.foreground }}>₹100</span>
                </div>
                <Button variant="outline" size="lg" className="w-full mt-4" asChild>
                  <Link href="/buy-credits">Buy Image Credits</Link>
                </Button>
              </div>
              <div
                className="p-6 rounded-2xl"
                style={{ background: 'hsl(0 0% 14% / 0.7)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.06)' }}
              >
                <h4 className="font-semibold mb-4 text-base" style={{ color: colors.foreground }}>Video Credits</h4>
                <div className="flex justify-between items-center py-2">
                  <span style={{ color: colors.mutedForeground }}>10 seconds</span>
                  <span className="font-semibold" style={{ color: colors.foreground }}>₹249</span>
                </div>
                <Button variant="outline" size="lg" className="w-full mt-4" asChild>
                  <Link href="/buy-credits">Buy Video Credits</Link>
                </Button>
              </div>
            </div>

            <ul className="text-sm space-y-1 mb-6" style={{ color: colors.mutedForeground }}>
              <li>• No subscription required.</li>
              <li>• No expiry.</li>
              <li>• No monthly reset.</li>
              <li>• No automation or analytics included.</li>
            </ul>
          </div>
        )}

        <div className="text-center">
          <Link href="/#pricing" className="text-base font-medium" style={{ color: colors.primary }}>View Full Pricing →</Link>
        </div>
      </div>
    </section>
  );
};

export default PricingPreview;

