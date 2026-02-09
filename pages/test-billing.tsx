// pages/test-billing.tsx
// Test dashboard for billing system
// DEVELOPMENT ONLY - This page will not render in production

'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { authFetch } from '@/lib/utils';

// Block in production - redirect to home
export default function TestBillingPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string>('');
  const [subscription, setSubscription] = useState<any>(null);
  const [credits, setCredits] = useState<any>(null);

  useEffect(() => {
    // Check if we're in development mode
    if (process.env.NODE_ENV === 'production') {
      router.replace('/');
      return;
    }
    setMounted(true);
    fetchCurrentStatus();
  }, [router]);

  async function fetchCurrentStatus() {
    try {
      const response = await authFetch('/api/billing/subscriptions/current');
      const data = await response.json();
      if (data.success) {
        setSubscription(data.subscription);
        setCredits(data.credits);
      }
    } catch (err) {
      console.error('Failed to fetch status:', err);
    }
  }

  async function callTestEndpoint(endpoint: string, body: any = {}) {
    setLoading(endpoint);
    setError(null);
    setResult(null);

    try {
      const response = await authFetch(`/api/testing/${endpoint}`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      const data = await response.json();
      
      if (!response.ok) {
        setError(data.error || 'Request failed');
      } else {
        setResult(data);
        // Refresh status after changes
        await fetchCurrentStatus();
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(null);
    }
  }

  if (!mounted) {
    return <div style={{ padding: 40 }}>Loading...</div>;
  }

  // Double check for production (client-side)
  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'production') {
    return null;
  }

  return (
    <div style={{ 
      padding: 40, 
      fontFamily: 'system-ui', 
      maxWidth: 1200, 
      margin: '0 auto',
      background: '#f8fafc',
      minHeight: '100vh',
    }}>
      <h1 style={{ color: '#0f172a', marginBottom: 8 }}>Billing Test Dashboard</h1>
      <p style={{ color: '#64748b', marginBottom: 32 }}>
        Development only - Test billing features without real payments
      </p>

      {/* Current Status */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: 20,
        marginBottom: 32,
      }}>
        <StatusCard title="Subscription Status">
          {subscription ? (
            <div>
              <p><strong>Plan:</strong> {subscription.plan.name}</p>
              <p><strong>Status:</strong> {subscription.status}</p>
              <p><strong>Billing:</strong> {subscription.plan.billingCycle}</p>
              <p><strong>Period End:</strong> {new Date(subscription.currentPeriodEnd).toLocaleDateString()}</p>
              <p><strong>Next Reset:</strong> {new Date(subscription.nextResetDate).toLocaleDateString()}</p>
            </div>
          ) : (
            <p style={{ color: '#94a3b8' }}>No active subscription</p>
          )}
        </StatusCard>

        <StatusCard title="Credit Balance">
          {credits ? (
            <div>
              <p><strong>Image Credits:</strong> {credits.imageCredits?.total || 0}</p>
              <p style={{ fontSize: 12, color: '#94a3b8' }}>
                (Sub: {credits.imageCredits?.subscription || 0} + Addon: {credits.imageCredits?.addon || 0})
              </p>
              <p><strong>Video Credits:</strong> {credits.videoCredits?.total || 0} sec</p>
              <p style={{ fontSize: 12, color: '#94a3b8' }}>
                (Sub: {credits.videoCredits?.subscription || 0} + Addon: {credits.videoCredits?.addon || 0})
              </p>
              {credits.lastResetAt && (
                <p><strong>Last Reset:</strong> {new Date(credits.lastResetAt).toLocaleDateString()}</p>
              )}
            </div>
          ) : (
            <p style={{ color: '#94a3b8' }}>No credits data</p>
          )}
        </StatusCard>
      </div>

      {/* Test Actions */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
        gap: 20,
      }}>
        {/* Create Subscription */}
        <TestCard title="Create Test Subscription">
          <p style={{ fontSize: 14, color: '#64748b', marginBottom: 16 }}>
            Creates a subscription without Razorpay payment
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {['free_trial', 'basic_monthly', 'starter_monthly', 'lite_growth_monthly', 'growth_pro_monthly'].map(plan => (
              <button
                key={plan}
                onClick={() => callTestEndpoint('create-test-subscription', { planId: plan })}
                disabled={!!loading || !!subscription}
                style={buttonStyle(loading === 'create-test-subscription')}
              >
                {plan.replace('_', ' ')}
              </button>
            ))}
          </div>
          {subscription && <p style={{ marginTop: 12, color: '#f59e0b', fontSize: 13 }}>Cancel existing subscription first</p>}
        </TestCard>

        {/* Add Credits */}
        <TestCard title="Add Test Credits">
          <p style={{ fontSize: 14, color: '#64748b', marginBottom: 16 }}>
            Adds addon credits (never expire)
          </p>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <button
              onClick={() => callTestEndpoint('add-test-credits', { type: 'image', amount: 10 })}
              disabled={!!loading}
              style={buttonStyle(loading === 'add-test-credits')}
            >
              +10 Images
            </button>
            <button
              onClick={() => callTestEndpoint('add-test-credits', { type: 'image', amount: 25 })}
              disabled={!!loading}
              style={buttonStyle(false)}
            >
              +25 Images
            </button>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => callTestEndpoint('add-test-credits', { type: 'video', amount: 30 })}
              disabled={!!loading}
              style={buttonStyle(false)}
            >
              +30 sec Video
            </button>
            <button
              onClick={() => callTestEndpoint('add-test-credits', { type: 'video', amount: 60 })}
              disabled={!!loading}
              style={buttonStyle(false)}
            >
              +60 sec Video
            </button>
          </div>
        </TestCard>

        {/* Reset Credits */}
        <TestCard title="Reset Subscription Credits">
          <p style={{ fontSize: 14, color: '#64748b', marginBottom: 16 }}>
            Simulates monthly credit reset (resets subscription credits to plan defaults)
          </p>
          <button
            onClick={() => callTestEndpoint('reset-test-credits')}
            disabled={!!loading || !subscription}
            style={buttonStyle(loading === 'reset-test-credits')}
          >
            {loading === 'reset-test-credits' ? 'Resetting...' : 'Reset Credits'}
          </button>
          {!subscription && <p style={{ marginTop: 12, color: '#f59e0b', fontSize: 13 }}>Create a subscription first</p>}
        </TestCard>

        {/* Cancel Subscription */}
        <TestCard title="Cancel Subscription">
          <p style={{ fontSize: 14, color: '#64748b', marginBottom: 16 }}>
            Cancels subscription without Razorpay
          </p>
          <button
            onClick={() => callTestEndpoint('cancel-test-subscription')}
            disabled={!!loading || !subscription}
            style={{ ...buttonStyle(loading === 'cancel-test-subscription'), background: '#dc2626' }}
          >
            {loading === 'cancel-test-subscription' ? 'Cancelling...' : 'Cancel Subscription'}
          </button>
          {!subscription && <p style={{ marginTop: 12, color: '#94a3b8', fontSize: 13 }}>No active subscription</p>}
        </TestCard>

        {/* Simulate Webhooks */}
        <TestCard title="Simulate Razorpay Webhooks">
          <p style={{ fontSize: 14, color: '#64748b', marginBottom: 16 }}>
            Sends mock webhook events to test webhook handling
          </p>
          {subscription?.razorpaySubscriptionId ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <button
                onClick={() => callTestEndpoint('simulate-webhook', { 
                  event: 'subscription.charged',
                  data: { 
                    razorpaySubscriptionId: subscription.razorpaySubscriptionId,
                    amount: 1499,
                  }
                })}
                disabled={!!loading}
                style={buttonStyle(false)}
              >
                subscription.charged
              </button>
              <button
                onClick={() => callTestEndpoint('simulate-webhook', { 
                  event: 'subscription.cancelled',
                  data: { razorpaySubscriptionId: subscription.razorpaySubscriptionId }
                })}
                disabled={!!loading}
                style={buttonStyle(false)}
              >
                subscription.cancelled
              </button>
            </div>
          ) : (
            <p style={{ color: '#94a3b8', fontSize: 13 }}>Create a subscription first to test webhooks</p>
          )}
        </TestCard>
      </div>

      {/* Result Display */}
      {(result || error) && (
        <div style={{ 
          marginTop: 32, 
          padding: 20, 
          background: error ? '#fef2f2' : '#f0fdf4', 
          borderRadius: 12,
          border: `1px solid ${error ? '#fecaca' : '#bbf7d0'}`,
        }}>
          <h3 style={{ color: error ? '#dc2626' : '#166534', marginBottom: 12 }}>
            {error ? 'Error' : 'Result'}
          </h3>
          <pre style={{ 
            background: error ? '#fee2e2' : '#dcfce7', 
            padding: 16, 
            borderRadius: 8,
            overflow: 'auto',
            fontSize: 13,
          }}>
            {JSON.stringify(error || result, null, 2)}
          </pre>
        </div>
      )}

      {/* API Reference */}
      <div style={{ marginTop: 48 }}>
        <h2 style={{ color: '#0f172a', marginBottom: 16 }}>API Reference (Development Only)</h2>
        <div style={{ 
          background: '#1e293b', 
          padding: 20, 
          borderRadius: 12, 
          color: '#e2e8f0',
          fontSize: 13,
          fontFamily: 'monospace',
          overflow: 'auto',
        }}>
          <pre>{`# Create test subscription
curl -X POST http://localhost:3000/api/testing/create-test-subscription \\
  -H "Content-Type: application/json" \\
  -H "Cookie: <your-auth-cookie>" \\
  -d '{"planId": "starter_monthly"}'

# Add test credits
curl -X POST http://localhost:3000/api/testing/add-test-credits \\
  -H "Content-Type: application/json" \\
  -H "Cookie: <your-auth-cookie>" \\
  -d '{"type": "image", "amount": 10}'

# Reset credits (simulates monthly reset)
curl -X POST http://localhost:3000/api/testing/reset-test-credits \\
  -H "Cookie: <your-auth-cookie>"

# Cancel subscription
curl -X POST http://localhost:3000/api/testing/cancel-test-subscription \\
  -H "Cookie: <your-auth-cookie>"

# Simulate webhook
curl -X POST http://localhost:3000/api/testing/simulate-webhook \\
  -H "Content-Type: application/json" \\
  -d '{"event": "payment.captured", "data": {"orderId": "order_xxx", "amount": 199}}'`}</pre>
        </div>
      </div>
    </div>
  );
}

// Helper components
function StatusCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ 
      background: 'white', 
      padding: 20, 
      borderRadius: 12,
      border: '1px solid #e2e8f0',
    }}>
      <h3 style={{ color: '#0f172a', marginBottom: 12, fontSize: 16 }}>{title}</h3>
      {children}
    </div>
  );
}

function TestCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ 
      background: 'white', 
      padding: 20, 
      borderRadius: 12,
      border: '1px solid #e2e8f0',
    }}>
      <h3 style={{ color: '#0f172a', marginBottom: 12, fontSize: 16 }}>{title}</h3>
      {children}
    </div>
  );
}

function buttonStyle(isLoading: boolean): React.CSSProperties {
  return {
    padding: '8px 16px',
    borderRadius: 8,
    border: 'none',
    background: isLoading ? '#94a3b8' : '#0088FF',
    color: 'white',
    fontWeight: 600,
    fontSize: 13,
    cursor: isLoading ? 'wait' : 'pointer',
    opacity: isLoading ? 0.7 : 1,
  };
}
