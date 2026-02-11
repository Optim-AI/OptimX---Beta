'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { Check, X, Sparkles, Zap } from 'lucide-react';
import { supabase } from '@/auth/supabase/client';
import { authFetch } from '@/lib/utils';
import colors from '@/lib/ui/colors';

interface Plan {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  billingCycle: string;
  priceInr: number;
  imageCredits: number;
  videoCredits: number;
}

interface GroupedPlan {
  name: string;
  monthly: Plan | null;
  quarterly: Plan | null;
}

interface CurrentSubscription {
  id: string;
  planId: string;
  planName: string;
  status: string;
  billingCycle: string;
}

// Feature comparison for display
const PLAN_FEATURES: Record<string, { label: string; plans: Record<string, boolean | string> }[]> = {
  'Basic': [
    { label: 'Image Credits / month', plans: { 'Basic': '15', 'Starter': '20', 'Lite Growth': '30', 'Growth Pro': '30' } },
    { label: 'Video Credits / month', plans: { 'Basic': '❌', 'Starter': '30 sec', 'Lite Growth': '20 sec', 'Growth Pro': '50 sec' } },
    { label: 'No Watermark', plans: { 'Basic': true, 'Starter': true, 'Lite Growth': true, 'Growth Pro': true } },
    { label: 'Fast Generation', plans: { 'Basic': false, 'Starter': true, 'Lite Growth': false, 'Growth Pro': true } },
    { label: 'Priority Processing', plans: { 'Basic': false, 'Starter': false, 'Lite Growth': false, 'Growth Pro': true } },
  ],
};

export default function PricingPage() {
  const router = useRouter();
  const [plans, setPlans] = useState<GroupedPlan[]>([]);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'quarterly'>('monthly');
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [subscribing, setSubscribing] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDevMode, setIsDevMode] = useState(false);
  const [currentSubscription, setCurrentSubscription] = useState<CurrentSubscription | null>(null);
  const { redirect } = router.query;

  // Check if running in development mode
  useEffect(() => {
    const isDev = process.env.NODE_ENV === 'development' || 
                  window.location.hostname === 'localhost';
    setIsDevMode(isDev);
  }, []);

  useEffect(() => {
    // Check if user is logged in
    (async () => {
      const { data } = await supabase.auth.getUser();
      setUser(data?.user || null);
      
      // Fetch current subscription if logged in
      if (data?.user) {
        fetchCurrentSubscription();
      }
    })();

    // Fetch plans
    fetchPlans();
  }, []);

  async function fetchCurrentSubscription() {
    try {
      const response = await authFetch('/api/billing/subscriptions/current');
      const data = await response.json();
      if (data.success && data.hasSubscription && data.subscription) {
        setCurrentSubscription({
          id: data.subscription.id,
          planId: data.subscription.plan.id,
          planName: data.subscription.plan.name,
          status: data.subscription.status,
          billingCycle: data.subscription.plan.billingCycle,
        });
        // Set billing cycle to match current subscription
        if (data.subscription.plan.billingCycle === 'quarterly') {
          setBillingCycle('quarterly');
        }
      }
    } catch (err) {
      console.error('Failed to fetch subscription:', err);
    }
  }

  async function fetchPlans() {
    try {
      // First check if plans are enabled
      const statusResponse = await fetch('/api/billing/plans/status');
      const statusData = await statusResponse.json();

      if (!statusData.plansEnabled) {
        // Plans are disabled, redirect to pay-as-you-go credit purchase
        router.replace('/buy-credits');
        return;
      }

      // Plans are enabled, fetch them
      const response = await fetch('/api/billing/plans?grouped=true');
      const data = await response.json();
      if (data.success) {
        setPlans(data.plans);
      }
    } catch (err) {
      console.error('Failed to fetch plans:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSelectPlan(planId: string) {
    if (!user) {
      // Redirect to signup with plan selection
      router.push(`/auth/signup?plan=${planId}`);
      return;
    }

    // If user has existing subscription, handle plan change
    if (currentSubscription) {
      await handlePlanChange(planId);
      return;
    }

    // New subscription flow
    setSelectedPlan(planId);
    setSubscribing(true);
    setError(null);

    try {
      // In development, use test endpoint to bypass Razorpay
      const isDev = process.env.NODE_ENV === 'development' || 
                    window.location.hostname === 'localhost';
      
      if (isDev && planId !== 'free_trial') {
        // Use test subscription creation
        const response = await authFetch('/api/testing/create-test-subscription', {
          method: 'POST',
          body: JSON.stringify({ planId }),
        });
        const data = await response.json();
        
        if (!data.success) {
          setError(data.error || 'Failed to create subscription');
          setSubscribing(false);
          return;
        }
        
        await fetchCurrentSubscription();
        router.push(redirect as string || '/welcome');
        return;
      }

      const response = await authFetch('/api/billing/subscriptions/create', {
        method: 'POST',
        body: JSON.stringify({
          planId,
          email: user.email,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        setError(data.error || 'Failed to create subscription');
        setSubscribing(false);
        return;
      }

      // For free trial, redirect directly
      if (planId === 'free_trial') {
        await fetchCurrentSubscription();
        router.push(redirect as string || '/welcome');
        return;
      }

      // For paid plans, open Razorpay checkout
      if (data.shortUrl) {
        window.location.href = data.shortUrl;
      } else if (data.razorpaySubscriptionId) {
        // Use Razorpay Checkout
        openRazorpayCheckout(data.razorpaySubscriptionId, planId);
      } else {
        // Direct subscription created (no payment needed for first time)
        await fetchCurrentSubscription();
        router.push(redirect as string || '/welcome');
      }
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
      setSubscribing(false);
    }
  }

  async function handlePlanChange(newPlanId: string) {
    if (!currentSubscription) return;

    // Cannot change to same plan
    if (currentSubscription.planId === newPlanId) {
      setError('You are already on this plan');
      return;
    }

    setSelectedPlan(newPlanId);
    setSubscribing(true);
    setError(null);

    try {
      const isDev = process.env.NODE_ENV === 'development' || 
                    window.location.hostname === 'localhost';

      if (isDev) {
        // In dev mode, use test endpoint
        const response = await authFetch('/api/testing/create-test-subscription', {
          method: 'POST',
          body: JSON.stringify({ planId: newPlanId }),
        });
        const data = await response.json();
        
        if (!data.success) {
          setError(data.error || 'Failed to change plan');
          setSubscribing(false);
          return;
        }
        
        await fetchCurrentSubscription();
        setError(null);
        setSubscribing(false);
        
        // Show success message
        const planName = plans.find(p => 
          p.monthly?.id === newPlanId || p.quarterly?.id === newPlanId
        )?.name || 'new plan';
        alert(`✓ Successfully changed to ${planName}!`);
        return;
      }

      const response = await authFetch('/api/billing/subscriptions/change-plan', {
        method: 'POST',
        body: JSON.stringify({
          subscriptionId: currentSubscription.id,
          newPlanId,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        setError(data.error || 'Failed to change plan');
        setSubscribing(false);
        return;
      }

      // Refresh subscription data
      await fetchCurrentSubscription();
      setError(null);
      setSubscribing(false);
      
      // Show success message
      const planName = plans.find(p => 
        p.monthly?.id === newPlanId || p.quarterly?.id === newPlanId
      )?.name || 'new plan';
      alert(`✓ ${data.message || `Successfully changed to ${planName}!`}`);
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
      setSubscribing(false);
    }
  }

  function openRazorpayCheckout(subscriptionId: string, planId: string) {
    const options = {
      key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
      subscription_id: subscriptionId,
      name: 'Oli AI',
      description: 'Subscription Payment',
      handler: function (response: any) {
        // Payment successful, redirect
        router.push(redirect as string || '/welcome');
      },
      prefill: {
        email: user?.email || '',
      },
      theme: {
        color: colors.primary || '#0088FF',
      },
      modal: {
        ondismiss: function () {
          setSubscribing(false);
        },
      },
    };

    // @ts-ignore
    const rzp = new window.Razorpay(options);
    rzp.open();
  }

  function getPlanPrice(group: GroupedPlan) {
    const plan = billingCycle === 'monthly' ? group.monthly : group.quarterly;
    return plan?.priceInr || 0;
  }

  function getMonthlyEquivalent(group: GroupedPlan) {
    if (billingCycle === 'monthly') return null;
    const quarterly = group.quarterly?.priceInr || 0;
    return Math.round(quarterly / 3);
  }

  function getSavings(group: GroupedPlan) {
    if (billingCycle === 'monthly') return null;
    const monthly = group.monthly?.priceInr || 0;
    const quarterlyPerMonth = (group.quarterly?.priceInr || 0) / 3;
    const savings = Math.round(((monthly - quarterlyPerMonth) / monthly) * 100);
    return savings > 0 ? savings : null;
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="animate-pulse">Loading plans...</div>
      </div>
    );
  }

  return (
    <>
      {/* Load Razorpay Script */}
      <script src="https://checkout.razorpay.com/v1/checkout.js" async />

      <style jsx>{`
        .pricing-page {
          min-height: 100vh;
          padding: 60px 20px;
          font-family: Poppins, Inter, system-ui;
          background: linear-gradient(180deg, #f8fafc 0%, #ffffff 100%);
        }
        .container {
          max-width: 1200px;
          margin: 0 auto;
        }
        .header {
          text-align: center;
          margin-bottom: 48px;
        }
        .title {
          font-size: 42px;
          font-weight: 800;
          color: #0f172a;
          margin-bottom: 16px;
        }
        .subtitle {
          font-size: 18px;
          color: #64748b;
          max-width: 600px;
          margin: 0 auto;
        }
        .billing-toggle {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          margin-top: 32px;
        }
        .toggle-btn {
          padding: 10px 24px;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          transition: all 200ms;
          border: 2px solid transparent;
        }
        .toggle-btn.active {
          background: ${colors.primary};
          color: white;
        }
        .toggle-btn:not(.active) {
          background: white;
          border-color: #e2e8f0;
          color: #64748b;
        }
        .savings-badge {
          background: #dcfce7;
          color: #166534;
          padding: 4px 10px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;
        }
        .plans-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 24px;
          margin-top: 40px;
        }
        .plan-card {
          background: white;
          border-radius: 16px;
          padding: 32px;
          border: 2px solid #e2e8f0;
          transition: all 300ms;
          position: relative;
          display: flex;
          flex-direction: column;
        }
        .plan-card:hover {
          border-color: ${colors.primary};
          box-shadow: 0 20px 40px rgba(0, 136, 255, 0.1);
          transform: translateY(-4px);
        }
        .plan-card.popular {
          border-color: ${colors.primary};
        }
        .plan-card.current {
          border-color: #10b981;
          border-width: 3px;
          background: linear-gradient(135deg, #ffffff 0%, #f0fdf4 100%);
        }
        .popular-badge {
          position: absolute;
          top: -12px;
          left: 50%;
          transform: translateX(-50%);
          background: ${colors.primary};
          color: white;
          padding: 4px 16px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;
        }
        .current-badge {
          position: absolute;
          top: -12px;
          left: 50%;
          transform: translateX(-50%);
          background: #10b981;
          color: white;
          padding: 4px 16px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;
        }
        .plan-name {
          font-size: 24px;
          font-weight: 700;
          color: #0f172a;
          margin-bottom: 8px;
        }
        .plan-desc {
          color: #64748b;
          font-size: 14px;
          margin-bottom: 24px;
        }
        .plan-price {
          font-size: 48px;
          font-weight: 800;
          color: #0f172a;
        }
        .plan-price-currency {
          font-size: 24px;
          vertical-align: top;
        }
        .plan-price-period {
          font-size: 16px;
          color: #64748b;
          font-weight: 400;
        }
        .plan-monthly-eq {
          font-size: 14px;
          color: #64748b;
          margin-top: 4px;
        }
        .plan-features {
          margin-top: 24px;
          padding-top: 24px;
          border-top: 1px solid #e2e8f0;
          flex-grow: 1;
        }
        .feature-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 8px 0;
          font-size: 14px;
          color: #334155;
        }
        .feature-icon {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .feature-icon.yes {
          background: #dcfce7;
          color: #166534;
        }
        .feature-icon.no {
          background: #fee2e2;
          color: #991b1b;
        }
        .select-btn {
          width: 100%;
          margin-top: 24px;
          padding: 14px;
          border-radius: 10px;
          font-weight: 700;
          font-size: 15px;
          cursor: pointer;
          transition: all 200ms;
          border: none;
        }
        .select-btn.primary {
          background: ${colors.primary};
          color: white;
        }
        .select-btn.primary:hover {
          background: ${colors.primaryHover || '#0073e6'};
          transform: scale(1.02);
        }
        .select-btn.outline {
          background: white;
          color: ${colors.primary};
          border: 2px solid ${colors.primary};
        }
        .select-btn.outline:hover {
          background: ${colors.primary};
          color: white;
        }
        .select-btn.current {
          background: #10b981;
          color: white;
          cursor: default;
        }
        .select-btn.current:hover {
          background: #10b981;
          transform: none;
        }
        .select-btn.upgrade {
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          color: white;
        }
        .select-btn.upgrade:hover {
          background: linear-gradient(135deg, #059669 0%, #047857 100%);
          transform: scale(1.02);
        }
        .select-btn.downgrade {
          background: white;
          color: #64748b;
          border: 2px solid #cbd5e1;
        }
        .select-btn.downgrade:hover {
          background: #f1f5f9;
          border-color: #94a3b8;
        }
        .select-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none;
        }
        .error-msg {
          text-align: center;
          color: #dc2626;
          margin-top: 24px;
          padding: 12px;
          background: #fef2f2;
          border-radius: 8px;
        }
        .trial-card {
          background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
          border-color: #f59e0b;
        }
        .trial-card .plan-name {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        @media (max-width: 768px) {
          .title { font-size: 32px; }
          .plans-grid { grid-template-columns: 1fr; }
        }
      `}</style>

      <div className="pricing-page">
        <div className="container">
          {/* Dev Mode Banner */}
          {isDevMode && (
            <div style={{
              background: 'linear-gradient(90deg, #fbbf24, #f59e0b)',
              color: '#78350f',
              padding: '12px 20px',
              borderRadius: 8,
              marginBottom: 24,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: 14,
              fontWeight: 600,
            }}>
              <span>🔧 Development Mode - Payments are simulated (no real charges)</span>
              <a 
                href="/test-billing" 
                style={{ color: '#78350f', textDecoration: 'underline' }}
              >
                Open Test Dashboard →
              </a>
            </div>
          )}
          
          <div className="header">
            <h1 className="title">
              {currentSubscription ? 'Manage Your Plan' : 'Choose Your Plan'}
            </h1>
            <p className="subtitle">
              {currentSubscription 
                ? `You're currently on ${currentSubscription.planName}. Upgrade or downgrade anytime.`
                : 'Start creating stunning ads with Oli AI. Pick a plan that fits your needs.'}
            </p>

            <div className="billing-toggle">
              <button
                className={`toggle-btn ${billingCycle === 'monthly' ? 'active' : ''}`}
                onClick={() => setBillingCycle('monthly')}
                disabled={currentSubscription?.billingCycle === 'quarterly' && currentSubscription?.status !== 'trialing'}
                title={currentSubscription?.billingCycle === 'quarterly' ? 'Cannot change billing cycle. Cancel and resubscribe to switch.' : ''}
              >
                Monthly
              </button>
              <button
                className={`toggle-btn ${billingCycle === 'quarterly' ? 'active' : ''}`}
                onClick={() => setBillingCycle('quarterly')}
                disabled={currentSubscription?.billingCycle === 'monthly' && currentSubscription?.status !== 'trialing'}
                title={currentSubscription?.billingCycle === 'monthly' ? 'Cannot change billing cycle. Cancel and resubscribe to switch.' : ''}
              >
                3-Month
                <span className="savings-badge" style={{ marginLeft: 8 }}>Save up to 7%</span>
              </button>
            </div>
            {currentSubscription && currentSubscription.billingCycle !== billingCycle && (
              <p style={{ textAlign: 'center', marginTop: 12, fontSize: 14, color: '#f59e0b' }}>
                ⚠️ To change billing cycle, cancel your current subscription and choose a new plan.
              </p>
            )}
          </div>

          {error && <div className="error-msg">{error}</div>}

          <div className="plans-grid">
            {/* Free Trial Card */}
            <div className={`plan-card trial-card ${currentSubscription?.planId === 'free_trial' ? 'current' : ''}`}>
              {currentSubscription?.planId === 'free_trial' && <div className="current-badge">Current Plan</div>}
              
              <h3 className="plan-name">
                <Sparkles size={24} color="#f59e0b" />
                Free Trial
              </h3>
              <p className="plan-desc">Try Oli AI for 5 days</p>
              
              <div className="plan-price">
                <span className="plan-price-currency">₹</span>0
              </div>
              <p className="plan-monthly-eq">5 days • No credit card required</p>

              <div className="plan-features">
                <div className="feature-item">
                  <div className="feature-icon yes"><Check size={14} /></div>
                  5 Image Credits
                </div>
                <div className="feature-item">
                  <div className="feature-icon yes"><Check size={14} /></div>
                  6 Seconds Video
                </div>
                <div className="feature-item">
                  <div className="feature-icon no"><X size={14} /></div>
                  Watermark on exports
                </div>
              </div>

              {/* Only show button if NOT currently on free trial */}
              {currentSubscription?.planId !== 'free_trial' && (
                <button
                  className="select-btn primary"
                  onClick={() => handleSelectPlan('free_trial')}
                  disabled={subscribing && selectedPlan === 'free_trial'}
                >
                  {subscribing && selectedPlan === 'free_trial' ? 'Starting...' : 'Start Free Trial'}
                </button>
              )}
            </div>

            {/* Paid Plans */}
            {plans.map((group) => {
              const plan = billingCycle === 'monthly' ? group.monthly : group.quarterly;
              if (!plan) return null;
              
              const isPopular = group.name === 'Starter';
              const isCurrent = currentSubscription?.planId === plan.id;
              const monthlyEq = getMonthlyEquivalent(group);
              const savings = getSavings(group);
              
              // Determine button type (only if not current plan)
              let buttonClass = isPopular ? 'primary' : 'outline';
              let buttonText = 'Get Started';
              
              if (currentSubscription && !isCurrent) {
                const currentPlan = plans.find(p => 
                  (billingCycle === 'monthly' ? p.monthly : p.quarterly)?.id === currentSubscription.planId
                );
                const currentPlanPrice = currentPlan 
                  ? (billingCycle === 'monthly' ? currentPlan.monthly?.priceInr : currentPlan.quarterly?.priceInr) || 0
                  : 0;
                const newPlanPrice = getPlanPrice(group);
                
                if (newPlanPrice > currentPlanPrice) {
                  buttonClass = 'upgrade';
                  buttonText = 'Upgrade';
                } else if (newPlanPrice < currentPlanPrice) {
                  buttonClass = 'downgrade';
                  buttonText = 'Downgrade';
                } else {
                  buttonClass = 'outline';
                  buttonText = 'Switch';
                }
              }

              return (
                <div key={group.name} className={`plan-card ${isPopular ? 'popular' : ''} ${isCurrent ? 'current' : ''}`}>
                  {isCurrent && <div className="current-badge">Current Plan</div>}
                  {!isCurrent && isPopular && <div className="popular-badge">Most Popular</div>}
                  
                  <h3 className="plan-name">{group.name}</h3>
                  <p className="plan-desc">{plan.description}</p>
                  
                  <div className="plan-price">
                    <span className="plan-price-currency">₹</span>
                    {getPlanPrice(group).toLocaleString()}
                    <span className="plan-price-period">
                      /{billingCycle === 'monthly' ? 'mo' : '3 mo'}
                    </span>
                  </div>
                  
                  {monthlyEq && (
                    <p className="plan-monthly-eq">
                      ₹{monthlyEq}/month equivalent
                      {savings && <span className="savings-badge" style={{ marginLeft: 8 }}>Save {savings}%</span>}
                    </p>
                  )}

                  <div className="plan-features">
                    <div className="feature-item">
                      <div className="feature-icon yes"><Check size={14} /></div>
                      {plan.imageCredits} Image Credits / month
                    </div>
                    <div className="feature-item">
                      {plan.videoCredits > 0 ? (
                        <>
                          <div className="feature-icon yes"><Check size={14} /></div>
                          {plan.videoCredits} sec Video / month
                        </>
                      ) : (
                        <>
                          <div className="feature-icon no"><X size={14} /></div>
                          No video credits
                        </>
                      )}
                    </div>
                    <div className="feature-item">
                      <div className="feature-icon yes"><Check size={14} /></div>
                      No Watermark
                    </div>
                    {(group.name === 'Starter' || group.name === 'Growth Pro') && (
                      <div className="feature-item">
                        <div className="feature-icon yes"><Check size={14} /></div>
                        {group.name === 'Growth Pro' ? 'Priority Processing' : 'Fast Generation'}
                      </div>
                    )}
                  </div>

                  {/* Only show button if this is NOT the current plan */}
                  {!isCurrent ? (
                    <button
                      className={`select-btn ${buttonClass}`}
                      onClick={() => handleSelectPlan(plan.id)}
                      disabled={subscribing && selectedPlan === plan.id}
                    >
                      {subscribing && selectedPlan === plan.id ? 'Processing...' : buttonText}
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>

          <div style={{ textAlign: 'center', marginTop: 48, color: '#64748b' }}>
            <p>All plans include monthly credit reset. Credits do not roll over.</p>
            <p style={{ marginTop: 8 }}>
              Need more credits? You can purchase additional credits anytime.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
