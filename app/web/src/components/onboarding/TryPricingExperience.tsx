'use client';

import React, { useEffect, useId, useState } from 'react';
import Link from 'next/link';
import { Check, ChevronDown, Minus } from 'lucide-react';
import colors from '@/lib/ui/colors';
import {
  MARKETING_SUBSCRIPTION_PLANS,
  formatInr,
  formatPricePlusGst,
  isMarketingPlanId,
  subscriptionTotalsInr,
  type MarketingPlanId,
} from '@/lib/billing/marketing-plans';
import { BUY_CREDITS_PRICING } from '@/lib/billing/pricing';
import {
  PLAN_CARD_CAPABILITIES,
  PLAN_COMPARISON_ROWS,
  type ComparisonCell,
} from '@/lib/onboarding/plan-comparison';
import { WORKSPACE_PATH } from '@/lib/onboarding/try-onboarding';

type Props = {
  brandName: string;
  selectedPlanId: MarketingPlanId | null;
  hasActiveSubscription: boolean;
  activePlanName?: string | null;
  onSelectPlan: (planId: MarketingPlanId) => void;
  onContinue: (planId: MarketingPlanId) => void;
  onBack: () => void;
  continuing?: boolean;
};

function trackSafe(event: string, data?: Record<string, string>) {
  try {
    // Optional — only if Vercel Analytics track is available
    void import('@vercel/analytics').then((m) => {
      if (typeof m.track === 'function') m.track(event, data);
    });
  } catch {
    /* ignore */
  }
}

function renderCell(value: ComparisonCell) {
  if (value === true) {
    return <Check className="h-4 w-4 mx-auto" style={{ color: colors.primary }} aria-label="Included" />;
  }
  if (value === false) {
    return <Minus className="h-4 w-4 mx-auto opacity-40" aria-label="Not included" />;
  }
  if (value === 'coming_soon') {
    return (
      <span className="text-xs" style={{ color: colors.mutedForeground }}>
        Coming soon
      </span>
    );
  }
  return <span className="text-sm font-medium">{value}</span>;
}

const glass = {
  background: 'hsl(0 0% 12% / 0.75)',
  border: '1px solid rgba(255,255,255,0.08)',
  boxShadow: '0 24px 64px rgba(0,0,0,0.35)',
} as const;

/**
 * In-flow pricing for /try after personalized demo.
 * Selection only — does not open Razorpay or grant credits.
 */
export default function TryPricingExperience({
  brandName,
  selectedPlanId,
  hasActiveSubscription,
  activePlanName,
  onSelectPlan,
  onContinue,
  onBack,
  continuing = false,
}: Props) {
  const headingId = useId();
  const [openRow, setOpenRow] = useState<string | null>(PLAN_COMPARISON_ROWS[0]?.id ?? null);

  useEffect(() => {
    trackSafe('pricing_viewed', { brand: brandName || 'unknown' });
  }, [brandName]);

  if (hasActiveSubscription) {
    return (
      <div className="max-w-xl mx-auto mt-10 sm:mt-16">
        <div className="rounded-2xl p-8 text-center" style={glass}>
          <h1 id={headingId} className="text-2xl sm:text-3xl font-normal mb-3">
            You&apos;re already on the {activePlanName || 'SkalX'} plan.
          </h1>
          <p className="mb-8 font-light" style={{ color: colors.mutedForeground }}>
            Plan changes aren&apos;t available here. Continue into your workspace.
          </p>
          <Link
            href={WORKSPACE_PATH}
            className="inline-flex items-center justify-center h-12 px-8 rounded-xl font-medium"
            style={{
              background: colors.gradientPrimary,
              color: colors.primaryForeground,
            }}
          >
            Go to SkalX →
          </Link>
        </div>
        <div className="text-center mt-6">
          <button
            type="button"
            onClick={onBack}
            className="text-sm"
            style={{ color: colors.mutedForeground, background: 'none', border: 'none' }}
          >
            ← Back to your poster
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto mt-6 sm:mt-10 pb-10">
      <p
        className="text-xs uppercase tracking-[0.2em] mb-3 text-center"
        style={{ color: colors.mutedForeground }}
      >
        Plans
      </p>
      <h1
        id={headingId}
        className="text-3xl sm:text-4xl font-normal text-center mb-3 leading-tight"
      >
        Ready to create more{brandName ? ` for ${brandName}` : ''}?
      </h1>
      <p
        className="text-center text-lg font-extralight max-w-2xl mx-auto mb-2"
        style={{ color: colors.mutedForeground }}
      >
        Choose the plan that fits your marketing workflow.
      </p>
      <p
        className="text-center text-sm max-w-xl mx-auto mb-10"
        style={{ color: colors.mutedForeground }}
      >
        Your personalized creative was just the beginning. Create more posters, videos, and
        campaigns with SkalX.
      </p>

      <div
        className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-14"
        role="radiogroup"
        aria-labelledby={headingId}
      >
        {MARKETING_SUBSCRIPTION_PLANS.map((plan) => {
          const isSelected = selectedPlanId === plan.id;
          const totals = subscriptionTotalsInr(plan.priceInr);
          return (
            <div
              key={plan.id}
              className="rounded-2xl p-6 flex flex-col transition-all duration-300"
              style={{
                ...glass,
                border: isSelected
                  ? '1px solid hsl(213 100% 55% / 0.55)'
                  : glass.border,
                boxShadow: isSelected
                  ? '0 0 0 1px hsl(213 100% 55% / 0.25), 0 24px 64px rgba(0,0,0,0.45)'
                  : glass.boxShadow,
              }}
            >
              <h2 className="text-2xl font-semibold mb-3">{plan.name}</h2>
              <div className="mb-1">
                <span className="text-3xl font-bold tracking-tight">
                  {formatPricePlusGst(plan.priceInr)}
                </span>
                <span className="text-sm ml-1" style={{ color: colors.mutedForeground }}>
                  / month
                </span>
              </div>
              <p className="text-xs mb-5" style={{ color: colors.mutedForeground }}>
                {formatInr(totals.totalInr)} due today (incl. 18% GST)
              </p>

              <ul className="space-y-2 mb-5">
                <li className="text-sm">
                  <strong>{plan.imageCredits.toLocaleString('en-IN')}</strong> Image Credits
                </li>
                <li className="text-sm">
                  <strong>{plan.videoCredits.toLocaleString('en-IN')}</strong> Video Credits
                </li>
              </ul>

              <ul className="space-y-2 mb-6 flex-1">
                {PLAN_CARD_CAPABILITIES.map((cap) => (
                  <li
                    key={cap}
                    className="flex items-start gap-2 text-sm"
                    style={{ color: colors.mutedForeground }}
                  >
                    <Check
                      className="h-4 w-4 mt-0.5 flex-shrink-0"
                      style={{ color: colors.primary }}
                    />
                    {cap}
                  </li>
                ))}
                {plan.id === 'skalx_pro' && (
                  <li
                    className="flex items-start gap-2 text-sm"
                    style={{ color: colors.mutedForeground }}
                  >
                    <Check
                      className="h-4 w-4 mt-0.5 flex-shrink-0"
                      style={{ color: colors.primary }}
                    />
                    Priority generation
                  </li>
                )}
              </ul>

              <button
                type="button"
                role="radio"
                aria-checked={isSelected}
                aria-label={`Select ${plan.name} plan`}
                disabled={continuing}
                onClick={() => {
                  if (!isMarketingPlanId(plan.id) || continuing) return;
                  onSelectPlan(plan.id);
                  trackSafe('plan_selected', { plan: plan.id });
                  trackSafe('checkout_intent', { plan: plan.id });
                  onContinue(plan.id);
                }}
                className="w-full h-11 rounded-xl text-sm font-medium transition-opacity disabled:opacity-60"
                style={{
                  background: colors.gradientPrimary,
                  color: colors.primaryForeground,
                  border: 'none',
                }}
              >
                {continuing && selectedPlanId === plan.id
                  ? 'Continuing…'
                  : `Select ${plan.name}`}
              </button>
            </div>
          );
        })}
      </div>

      {/* Comparison — desktop table */}
      <section className="mb-14" aria-labelledby="compare-heading">
        <h2 id="compare-heading" className="text-2xl font-normal mb-6 text-center">
          Compare plans
        </h2>

        <div className="hidden md:block overflow-x-auto rounded-2xl" style={glass}>
          <table className="w-full text-left border-collapse min-w-[640px]">
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                <th className="p-4 text-sm font-medium" scope="col">
                  Feature
                </th>
                {MARKETING_SUBSCRIPTION_PLANS.map((p) => (
                  <th
                    key={p.id}
                    className="p-4 text-sm font-medium text-center"
                    scope="col"
                    style={{
                      color: selectedPlanId === p.id ? colors.primary : colors.foreground,
                    }}
                  >
                    {p.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PLAN_COMPARISON_ROWS.map((row) => (
                <tr
                  key={row.id}
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                >
                  <th className="p-4 text-sm font-normal text-left" scope="row">
                    <div>{row.label}</div>
                    {row.hint && (
                      <div className="text-xs mt-1 font-light" style={{ color: colors.mutedForeground }}>
                        {row.hint}
                      </div>
                    )}
                  </th>
                  {MARKETING_SUBSCRIPTION_PLANS.map((p) => (
                    <td key={p.id} className="p-4 text-center">
                      {renderCell(row.values[p.id])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Comparison — mobile accordion */}
        <div className="md:hidden space-y-2">
          {PLAN_COMPARISON_ROWS.map((row) => {
            const open = openRow === row.id;
            return (
              <div key={row.id} className="rounded-xl overflow-hidden" style={glass}>
                <button
                  type="button"
                  className="w-full flex items-center justify-between p-4 text-left"
                  aria-expanded={open}
                  onClick={() => {
                    setOpenRow(open ? null : row.id);
                    if (!open) trackSafe('plan_comparison_viewed', { row: row.id });
                  }}
                  style={{ background: 'transparent', border: 'none', color: colors.foreground }}
                >
                  <span className="text-sm font-medium pr-3">{row.label}</span>
                  <ChevronDown
                    className={`h-4 w-4 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
                  />
                </button>
                {open && (
                  <div className="px-4 pb-4 space-y-3">
                    {row.hint && (
                      <p className="text-xs" style={{ color: colors.mutedForeground }}>
                        {row.hint}
                      </p>
                    )}
                    {MARKETING_SUBSCRIPTION_PLANS.map((p) => (
                      <div key={p.id} className="flex items-center justify-between text-sm">
                        <span style={{ color: colors.mutedForeground }}>{p.name}</span>
                        <span>{renderCell(row.values[p.id])}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Credit explanation */}
      <div className="rounded-2xl p-6 mb-10 max-w-3xl mx-auto" style={glass}>
        <h3 className="text-lg font-medium mb-3">How credits work</h3>
        <p className="text-sm mb-2" style={{ color: colors.mutedForeground }}>
          <strong style={{ color: colors.foreground }}>Image Credits</strong> — One successful
          image generation uses one Image Credit.
        </p>
        <p className="text-sm" style={{ color: colors.mutedForeground }}>
          <strong style={{ color: colors.foreground }}>Video Credits</strong> — Video generation
          uses SkalX Video Credits based on generation duration (for example, 15 seconds uses 300
          Video Credits).
        </p>
      </div>

      {/* PAYG info */}
      <div className="rounded-2xl p-6 mb-10 max-w-3xl mx-auto" style={glass}>
        <h3 className="text-lg font-medium mb-2">Need more credits later?</h3>
        <p className="text-sm mb-3" style={{ color: colors.mutedForeground }}>
          After you subscribe, you can buy additional credits anytime (pay-as-you-go):
        </p>
        <ul className="text-sm space-y-1" style={{ color: colors.mutedForeground }}>
          <li>
            Image: ₹{BUY_CREDITS_PRICING.imageCreditPriceInr} per Image Credit (minimum{' '}
            {BUY_CREDITS_PRICING.minQuantity})
          </li>
          <li>
            Video: ₹{BUY_CREDITS_PRICING.videoCreditBlockPriceInr} per 100 Video Credits (minimum{' '}
            {BUY_CREDITS_PRICING.minVideoQuantity}, increments of{' '}
            {BUY_CREDITS_PRICING.videoQuantityStep})
          </li>
        </ul>
        <p className="text-xs mt-3" style={{ color: colors.mutedForeground }}>
          PAYG is available inside SkalX after signup — not a fourth subscription plan.
        </p>
      </div>

      <div className="text-center mb-6">
        <button
          type="button"
          onClick={onBack}
          className="text-sm"
          style={{ color: colors.mutedForeground, background: 'none', border: 'none' }}
        >
          ← Back to your poster
        </button>
      </div>
    </div>
  );
}
