'use client';

import React from 'react';
import { useRouter } from 'next/router';
import { Check } from 'lucide-react';
import colors from '@/lib/ui/colors';
import {
  MARKETING_SUBSCRIPTION_PLANS,
  formatInr,
  formatPricePlusGst,
  isMarketingPlanId,
  subscriptionTotalsInr,
  type MarketingPlanId,
} from '@/lib/billing/marketing-plans';
import { PLAN_CARD_CAPABILITIES } from '@/lib/onboarding/plan-comparison';
import {
  PLAN_SWITCH_UNAVAILABLE_NOTE,
  resolvePlanCardAction,
  type PaidPlanEntitlement,
} from '@/lib/billing/plan-card-actions';

type Props = {
  currentSubscription: PaidPlanEntitlement | null;
  loading?: boolean;
};

const glass = {
  background: 'hsl(0 0% 12% / 0.75)',
  border: '1px solid rgba(255,255,255,0.08)',
  boxShadow: '0 16px 40px rgba(0,0,0,0.28)',
} as const;

/**
 * Paid plans only (Starter / Growth / Pro) for Plans & Purchases.
 * Free Trial is intentionally excluded. Checkout reuses /subscribe.
 */
export default function SubscriptionPlansSection({
  currentSubscription,
  loading = false,
}: Props) {
  const router = useRouter();
  const hasActivePaid = Boolean(
    currentSubscription &&
      (currentSubscription.status === 'active' || currentSubscription.status === 'trialing') &&
      isMarketingPlanId(currentSubscription.planId)
  );

  const onSelect = (planId: MarketingPlanId) => {
    const action = resolvePlanCardAction(planId, currentSubscription);
    if (!action.canCheckout || action.disabled) return;
    try {
      sessionStorage.setItem('skalx_pending_plan', planId);
    } catch {
      /* ignore */
    }
    void router.push(`/subscribe?plan=${encodeURIComponent(planId)}`);
  };

  return (
    <section className="subscription-plans-section" aria-labelledby="subscription-plans-heading">
      <div className="plans-header">
        <h2 id="subscription-plans-heading">Subscription Plans</h2>
        <p>Choose a plan that fits your marketing workflow.</p>
      </div>

      <div className="plans-grid">
        {MARKETING_SUBSCRIPTION_PLANS.map((plan) => {
          const action = resolvePlanCardAction(plan.id, currentSubscription);
          const totals = subscriptionTotalsInr(plan.priceInr);
          const isCurrent = action.kind === 'current';

          return (
            <div
              key={plan.id}
              className="plan-card"
              style={{
                ...glass,
                border: isCurrent
                  ? '1px solid hsl(213 100% 55% / 0.55)'
                  : glass.border,
                boxShadow: isCurrent
                  ? '0 0 0 1px hsl(213 100% 55% / 0.2), 0 16px 40px rgba(0,0,0,0.35)'
                  : glass.boxShadow,
              }}
            >
              <div className="plan-card-top">
                <h3>{plan.name}</h3>
                {isCurrent && <span className="current-badge">Active</span>}
              </div>
              <div className="plan-price">
                <span className="plan-price-main">{formatPricePlusGst(plan.priceInr)}</span>
                <span className="plan-price-period">/ month</span>
              </div>
              <p className="plan-due">
                {formatInr(totals.totalInr)} due today (incl. 18% GST)
              </p>

              <ul className="plan-credits">
                <li>
                  <strong>{plan.imageCredits.toLocaleString('en-IN')}</strong> Image Credits
                </li>
                <li>
                  <strong>{plan.videoCredits.toLocaleString('en-IN')}</strong> Video Credits
                </li>
              </ul>

              <ul className="plan-features">
                {PLAN_CARD_CAPABILITIES.map((cap) => (
                  <li key={cap}>
                    <Check size={14} style={{ color: colors.primary, flexShrink: 0, marginTop: 2 }} />
                    <span>{cap}</span>
                  </li>
                ))}
                {plan.id === 'skalx_pro' && (
                  <li>
                    <Check size={14} style={{ color: colors.primary, flexShrink: 0, marginTop: 2 }} />
                    <span>Priority generation</span>
                  </li>
                )}
              </ul>

              <button
                type="button"
                className="plan-cta"
                disabled={loading || action.disabled}
                aria-disabled={action.disabled}
                onClick={() => onSelect(plan.id)}
                style={{
                  background: action.disabled
                    ? 'rgba(255,255,255,0.08)'
                    : colors.gradientPrimary,
                  color: action.disabled ? colors.mutedForeground : colors.primaryForeground,
                  cursor: action.disabled ? 'not-allowed' : 'pointer',
                }}
              >
                {action.label}
              </button>
            </div>
          );
        })}
      </div>

      {hasActivePaid && (
        <p className="plans-note" role="note">
          {PLAN_SWITCH_UNAVAILABLE_NOTE}
        </p>
      )}

      <style jsx>{`
        .subscription-plans-section {
          margin-top: 48px;
          padding-top: 40px;
          border-top: 1px solid ${colors.border};
        }
        .plans-header {
          text-align: center;
          margin-bottom: 28px;
        }
        .plans-header h2 {
          margin: 0;
          font-size: 22px;
          font-weight: 600;
        }
        .plans-header p {
          margin: 8px 0 0;
          color: ${colors.mutedForeground};
          font-size: 14px;
        }
        .plans-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 16px;
        }
        .plan-card {
          border-radius: 16px;
          padding: 22px 20px;
          display: flex;
          flex-direction: column;
        }
        .plan-card-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          margin-bottom: 10px;
        }
        .plan-card-top h3 {
          margin: 0;
          font-size: 20px;
          font-weight: 600;
        }
        .current-badge {
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          color: ${colors.primary};
          border: 1px solid hsl(213 100% 55% / 0.45);
          border-radius: 999px;
          padding: 3px 8px;
        }
        .plan-price {
          display: flex;
          align-items: baseline;
          gap: 6px;
        }
        .plan-price-main {
          font-size: 24px;
          font-weight: 700;
          letter-spacing: -0.02em;
        }
        .plan-price-period {
          font-size: 13px;
          color: ${colors.mutedForeground};
        }
        .plan-due {
          margin: 6px 0 14px;
          font-size: 12px;
          color: ${colors.mutedForeground};
        }
        .plan-credits {
          list-style: none;
          margin: 0 0 14px;
          padding: 0;
          display: grid;
          gap: 6px;
          font-size: 14px;
        }
        .plan-features {
          list-style: none;
          margin: 0 0 18px;
          padding: 0;
          display: grid;
          gap: 8px;
          flex: 1;
        }
        .plan-features li {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          font-size: 13px;
          color: ${colors.mutedForeground};
        }
        .plan-cta {
          width: 100%;
          height: 44px;
          border: none;
          border-radius: 12px;
          font-size: 14px;
          font-weight: 600;
          transition: opacity 0.15s ease;
        }
        .plan-cta:disabled {
          opacity: 0.85;
        }
        .plans-note {
          margin: 18px auto 0;
          max-width: 720px;
          text-align: center;
          font-size: 12px;
          line-height: 1.5;
          color: ${colors.mutedForeground};
        }
        @media (max-width: 900px) {
          .plans-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </section>
  );
}
