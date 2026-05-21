'use client';

import ContactForPricing from './ContactForPricing';

export default function PricingPreview() {
  return <ContactForPricing />;
}

/*
'use client';

import ContactForPricing from './ContactForPricing';

export default function PricingPreview() {
  return <ContactForPricing />;
}

'use client';

import ContactForPricing from './ContactForPricing';

// Pricing is removed from the homepage and replaced by the pricing contact form CTA.
export default function PricingPreview() {
  return <ContactForPricing />;
}

/*
'use client';

import ContactForPricing from './ContactForPricing';

// PricingPreview is now a contact form CTA section.
// This removes the pricing plan grid from the homepage completely.
export default function PricingPreview() {
  return <ContactForPricing />;
}

'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Button } from './ui/button';
import { useScrollAnimation } from '../hooks/use-scroll-animation';
import colors from '@/lib/ui/colors';
import { Check, X } from 'lucide-react';

type BillingMode = 'monthly' | '3months';
type PlanType = 'subscription' | 'contact';

// Starter, Growth, Scale, Enterprise
const PLANS: Array<{
  key: 'starter' | 'growth' | 'scale' | 'enterprise';
  name: string;
  type: PlanType;
  position: string;
  priceMonthly: number | null;
  priceQuarterly: number | null;
  effectivePerMonth: number | null;
  imageCredits: string;
  videoCredits: string;
  noWatermark: boolean;
  schedulingLabel: string;
  crossPlatformPosting: boolean;
  /** Shown in comparison row: Basic / AI / AI / Full */
  analyticsLabel: string;
  brandAnalysis: boolean;
  automation: boolean;
  competitorAnalysis: boolean;
  adStudio: boolean;
  ugcAdVideos: boolean;
  priorityProcessing: boolean;
  /** Enterprise tier table rows */
  multiBrandManagement: boolean;
  dedicatedSupport: boolean;
  customAIModels: boolean;
  monthlyReset: string;
  cta: string;
  ctaHref: string;
  ctaExternal?: boolean;
  comingSoon: boolean;
  moneyLine?: string;
}> = [
  {
    key: 'starter',
    name: 'Starter',
    type: 'subscription',
    position: 'Stay consistent without hiring a designer',
    priceMonthly: 599,
    priceQuarterly: 1647,
    effectivePerMonth: 549,
    imageCredits: '40/mo',
    videoCredits: '20 sec/mo',
    noWatermark: true,
    schedulingLabel: 'Basic',
    crossPlatformPosting: false,
    analyticsLabel: 'Basic',
    brandAnalysis: false,
    automation: false,
    competitorAnalysis: false,
    adStudio: false,
    ugcAdVideos: false,
    priorityProcessing: false,
    multiBrandManagement: false,
    dedicatedSupport: false,
    customAIModels: false,
    monthlyReset: 'Yes',
    cta: 'Get started',
    ctaHref: '/auth/signup',
    comingSoon: false,
  },
  {
    key: 'growth',
    name: 'Growth',
    type: 'subscription',
    position: 'Run high performing campaigns, not just posts',
    priceMonthly: 2199,
    priceQuarterly: 5997,
    effectivePerMonth: 1999,
    imageCredits: '150/mo',
    videoCredits: '60 sec/mo',
    noWatermark: true,
    schedulingLabel: 'Smart',
    crossPlatformPosting: true,
    analyticsLabel: 'AI',
    brandAnalysis: true,
    automation: false,
    competitorAnalysis: false,
    adStudio: false,
    ugcAdVideos: false,
    priorityProcessing: false,
    multiBrandManagement: false,
    dedicatedSupport: false,
    customAIModels: false,
    monthlyReset: 'Yes',
    cta: 'Get started',
    ctaHref: '/auth/signup',
    comingSoon: false,
  },
  {
    key: 'scale',
    name: 'Scale',
    type: 'subscription',
    position: 'Let AI be one of your marketing members',
    priceMonthly: 6999,
    priceQuarterly: 18897,
    effectivePerMonth: 6299,
    imageCredits: '500/mo',
    videoCredits: '200 sec/mo',
    noWatermark: true,
    schedulingLabel: 'Smart + automation',
    crossPlatformPosting: true,
    analyticsLabel: 'AI',
    brandAnalysis: true,
    automation: true,
    competitorAnalysis: true,
    adStudio: true,
    ugcAdVideos: true,
    priorityProcessing: true,
    multiBrandManagement: false,
    dedicatedSupport: false,
    customAIModels: false,
    monthlyReset: 'Yes',
    cta: 'Get started',
    ctaHref: '/auth/signup',
    comingSoon: false,
  },
  {
    key: 'enterprise',
    name: 'Enterprise',
    type: 'contact',
    position: 'For agencies and large brands',
    priceMonthly: null,
    priceQuarterly: null,
    effectivePerMonth: null,
    imageCredits: 'Custom',
    videoCredits: 'Custom',
    noWatermark: true,
    schedulingLabel: 'Custom',
    crossPlatformPosting: true,
    analyticsLabel: 'Full + custom',
    brandAnalysis: true,
    automation: true,
    competitorAnalysis: true,
    adStudio: true,
    ugcAdVideos: true,
    priorityProcessing: true,
    multiBrandManagement: true,
    dedicatedSupport: true,
    customAIModels: true,
    monthlyReset: 'Custom',
    cta: 'Book a demo',
    ctaHref: 'https://calendly.com/reachout-optim/new-meeting',
    ctaExternal: true,
    comingSoon: false,
  },
];

const GROWTH_HIGHLIGHT = {
  border: 'rgba(16, 185, 129, 0.45)',
  bg: 'linear-gradient(145deg, hsl(190 100% 50% / 0.12) 0%, hsl(150 100% 40% / 0.1) 100%)',
  shadow: 'inset 0 0 32px rgba(16, 185, 129, 0.15), 0 0 28px hsl(190 100% 50% / 0.12)',
  titleColor: colors.foreground,
  chipBg: 'linear-gradient(90deg, #10b981, #3b82f6)',
} as const;

const CALENDLY_URL = 'https://calendly.com/reachout-optim/new-meeting';

const PricingPreview: React.FC = () => {
  const [billingMode, setBillingMode] = useState<BillingMode>('monthly');
  const { elementRef: titleRef, isVisible: titleVisible } = useScrollAnimation();
  const { elementRef: contentRef, isVisible: contentVisible } = useScrollAnimation({ threshold: 0.1 });

  return (
    <section id="pricing" className="py-24 relative overflow-hidden section-solid" style={{ backgroundColor: colors.background }}>
      <div className="grain-overlay" />

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div
          ref={titleRef}
          className="text-center max-w-3xl mx-auto mb-10 transition-all duration-700"
          style={{ opacity: titleVisible ? 1 : 0, transform: titleVisible ? 'translateY(0)' : 'translateY(20px)', transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)' }}
        >
          <h2 className="text-4xl md:text-[46px] font-normal mb-4 leading-tight" style={{ color: colors.foreground }}>
            Simple pricing that grows with you
          </h2>
          <p className="text-lg font-extralight" style={{ color: colors.mutedForeground }}>
            From your first posts to full AI driven campaigns. Choose Starter, Growth, Scale, or Enterprise.
          </p>
        </div>

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
              <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(34,197,94,0.25)', color: '#22c55e' }}>Save</span>
            </button>
          </div>
        </div>

        <div
          className="max-w-6xl mx-auto mb-8 transition-all duration-500 overflow-x-auto"
          style={{ opacity: contentVisible ? 1 : 0 }}
        >
          <div
            className="rounded-2xl overflow-hidden"
            style={{ background: 'hsl(0 0% 14% / 0.7)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.06)' }}
          >
            <div className="grid grid-cols-5 gap-0 min-w-[900px]">
              <div className="p-4 border-b border-r" style={{ borderColor: 'rgba(255,255,255,0.06)' }} />
              {PLANS.map((p) => {
                const isGrowth = p.key === 'growth';
                return (
                  <div
                    key={p.key}
                    className="p-4 md:p-5 border-b border-r text-center last:border-r-0 relative"
                    style={{
                      borderColor: isGrowth ? GROWTH_HIGHLIGHT.border : 'rgba(255,255,255,0.06)',
                      background: isGrowth ? GROWTH_HIGHLIGHT.bg : p.key === 'enterprise' ? 'linear-gradient(135deg, rgba(212,175,55,0.1) 0%, rgba(255,215,0,0.04) 100%)' : undefined,
                      boxShadow: isGrowth ? GROWTH_HIGHLIGHT.shadow : undefined,
                    }}
                  >
                    <div className="flex flex-col items-center gap-0.5">
                      <span className="font-bold text-base md:text-lg" style={{ color: isGrowth ? GROWTH_HIGHLIGHT.titleColor : colors.foreground }}>{p.name}</span>
                    </div>
                    <p className="text-xs mt-2 leading-snug" style={{ color: colors.mutedForeground }}>{p.position}</p>
                    {p.moneyLine && (
                      <p className="text-xs font-medium mt-1" style={{ color: '#10b981' }}>{p.moneyLine}</p>
                    )}
                    <div className="font-bold text-lg md:text-xl mt-3" style={{ color: colors.foreground }}>
                      {p.type === 'contact' ? (
                        <span className="text-sm font-semibold" style={{ color: colors.foreground }}>Custom pricing</span>
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
                );
              })}

              {[
                { label: 'For', values: PLANS.map((p) => p.key === 'starter' ? 'Small businesses' : p.key === 'growth' ? 'Brands that want results' : p.key === 'scale' ? 'Brands scaling fast' : 'Agencies & large brands') },
                { label: 'Image credits', values: PLANS.map((p) => p.imageCredits) },
                { label: 'Video credits', values: PLANS.map((p) => p.videoCredits) },
                { label: 'No watermark', values: PLANS.map((p) => p.noWatermark) },
                { label: 'Scheduling', values: PLANS.map((p) => p.schedulingLabel) },
                { label: 'Cross-platform posting', values: PLANS.map((p) => p.crossPlatformPosting) },
                { label: 'Analytics', values: PLANS.map((p) => p.analyticsLabel) },
                { label: 'Brand analysis', values: PLANS.map((p) => p.brandAnalysis) },
                { label: 'Full AI automation', values: PLANS.map((p) => p.automation) },
                { label: 'Competitor analysis', values: PLANS.map((p) => p.competitorAnalysis) },
                { label: 'Ad studio', values: PLANS.map((p) => p.adStudio) },
                { label: 'UGC ad videos', values: PLANS.map((p) => p.ugcAdVideos) },
                { label: 'Priority processing', values: PLANS.map((p) => p.priorityProcessing) },
                { label: 'Multi-brand management', values: PLANS.map((p) => p.multiBrandManagement) },
                { label: 'Dedicated support', values: PLANS.map((p) => p.dedicatedSupport) },
                { label: 'Custom AI models', values: PLANS.map((p) => p.customAIModels) },
                { label: 'Monthly reset (credits)', values: PLANS.map((p) => p.monthlyReset) },
              ].map((row, i) => (
                <div key={i} className="grid grid-cols-5 gap-0 col-span-5">
                  <div className="p-3 md:p-4 border-b border-r text-sm" style={{ borderColor: 'rgba(255,255,255,0.06)', color: colors.mutedForeground }}>{row.label}</div>
                  {row.values.map((val, cellIdx) => {
                    const plan = PLANS[cellIdx];
                    const isGrowth = plan.key === 'growth';
                    return (
                      <div
                        key={cellIdx}
                        className={`p-3 md:p-4 border-b border-r flex items-center justify-center text-center ${cellIdx === row.values.length - 1 ? 'last:border-r-0' : ''}`}
                        style={{
                          borderColor: isGrowth ? 'rgba(16, 185, 129, 0.22)' : 'rgba(255,255,255,0.06)',
                          background: isGrowth ? 'hsl(190 100% 50% / 0.04)' : undefined,
                        }}
                      >
                        {typeof val === 'boolean' ? (
                          val ? <Check size={18} style={{ color: '#22c55e' }} /> : <X size={18} style={{ color: '#ef4444' }} />
                        ) : (
                          <span className="text-sm" style={{ color: colors.foreground }}>{val}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}

              <div className="col-span-5 grid grid-cols-5 gap-0">
                <div className="p-4 border-r" style={{ borderColor: 'rgba(255,255,255,0.06)' }} />
                {PLANS.map((p) => {
                  const isGrowth = p.key === 'growth';
                  if (p.comingSoon) {
                    return (
                      <div key={p.key} className="p-4 border-r last:border-r-0" style={{ borderColor: isGrowth ? 'rgba(16, 185, 129, 0.22)' : 'rgba(255,255,255,0.06)' }}>
                        <Button variant="outline" size="lg" className="w-full cursor-not-allowed" disabled style={{ background: 'rgba(255,255,255,0.08)', color: colors.mutedForeground, borderColor: colors.border }}>
                          {p.cta}
                        </Button>
                      </div>
                    );
                  }
                  if (p.ctaExternal) {
                    return (
                      <div key={p.key} className="p-4 border-r last:border-r-0" style={{ borderColor: isGrowth ? 'rgba(16, 185, 129, 0.22)' : 'rgba(255,255,255,0.06)' }}>
                        <Button
                          variant={p.key === 'enterprise' ? 'hero' : 'outline'}
                          size="lg"
                          className="w-full"
                          asChild
                          style={p.key === 'enterprise' ? { background: GROWTH_HIGHLIGHT.chipBg, color: '#fff', boxShadow: colors.shadowGlow } : {}}
                        >
                          <a href={p.ctaHref || CALENDLY_URL} target="_blank" rel="noopener noreferrer">
                            {p.cta}
                          </a>
                        </Button>
                      </div>
                    );
                  }
                  return (
                    <div key={p.key} className="p-4 border-r last:border-r-0" style={{ borderColor: isGrowth ? 'rgba(16, 185, 129, 0.22)' : 'rgba(255,255,255,0.06)' }}>
                      <Button
                        variant={isGrowth ? 'hero' : 'outline'}
                        size="lg"
                        className="w-full"
                        asChild
                        style={isGrowth ? { background: colors.gradientPrimary, color: colors.primaryForeground, boxShadow: colors.shadowGlow } : {}}
                      >
                        <Link href={p.ctaHref}>{p.cta}</Link>
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <p className="text-center text-sm mt-4 max-w-2xl mx-auto" style={{ color: colors.mutedForeground }}>
            Subscription credits reset every billing cycle. Enterprise includes multibrand management, dedicated support, and custom AI models on request.
          </p>
        </div>
      </div>
    </section>
  );
};

export default PricingPreview;
*/


