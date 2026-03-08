'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '@/auth/supabase/client';
import { profileClient } from '@/database/client-helpers';
import colors from '@/lib/ui/colors';

const PRIMARY_GOALS = [
  'Launch campaigns faster',
  'Generate high-converting creatives',
  'Scale ad performance',
  'Reduce manual creative work',
];

export default function OnboardingInfoPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  const [companyName, setCompanyName] = useState('');
  const [primaryGoal, setPrimaryGoal] = useState(PRIMARY_GOALS[0]);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [invoiceEmail, setInvoiceEmail] = useState('');
  const [gstNumber, setGstNumber] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data } = await supabase.auth.getUser();
        const user = data?.user ?? null;
        if (!user) {
          router.replace('/auth/signin');
          return;
        }
        setUserId(user.id);

        try {
          const result = await profileClient.get();
          if (result.success && result.data) {
            const p = result.data as Record<string, unknown>;
            setCompanyName((p.businessName as string) || (p.business_name as string) || '');
            const pg = (p.primaryGoal as string) || (p.primary_goal as string);
            const uc = p.useCase || p.use_case;
            const firstGoal = pg || (Array.isArray(uc) && uc[0] ? String(uc[0]) : null);
            setPrimaryGoal(firstGoal && PRIMARY_GOALS.includes(firstGoal) ? firstGoal : PRIMARY_GOALS[0]);
            setInvoiceEmail((p.invoiceEmail as string) || (p.invoice_email as string) || '');
            setGstNumber((p.gstNumber as string) || (p.gst_number as string) || '');
            setMobileNumber((p.businessMobile as string) || (p.business_mobile as string) || '');
          }
        } catch {
          // No profile yet - use empty form
        }
      } catch (e: any) {
        setError(e?.message ?? String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  const handleCreateWorkspace = async () => {
    if (!companyName.trim()) {
      setError('Company name is required');
      return;
    }
    if (!userId) return;

    setSaving(true);
    setError(null);
    try {
      // Save all collected onboarding details to the user profile
      await profileClient.upsert({
        businessName: companyName.trim(),
        primaryGoal,
        useCase: [primaryGoal],
        invoiceEmail: invoiceEmail.trim() || null,
        gstNumber: gstNumber.trim() || null,
        businessMobile: mobileNumber.trim() || null,
      });
      setCreated(true);
      setTimeout(() => {
        router.push('/brand-studio');
      }, 2000);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="app-page" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: colors.background, color: colors.foreground }}>
        Loading…
      </div>
    );
  }

  if (created) {
    return (
      <div
        className="app-page"
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 40,
          background: colors.background,
          fontFamily: "'Poppins', Inter, system-ui",
          color: colors.foreground,
        }}
      >
        <div style={{ fontSize: 64, marginBottom: 24 }}>✅</div>
        <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 12, textAlign: 'center' }}>
          Your workspace is ready.
        </h1>
        <p style={{ fontSize: 18, color: colors.mutedForeground, marginBottom: 32 }}>
          Let&apos;s generate your first creative.
        </p>
        <div style={{ width: 32, height: 32, border: `3px solid ${colors.primary}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style jsx>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div
      className="app-page"
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 40,
        background: colors.background,
        fontFamily: "'Poppins', Inter, system-ui",
      }}
    >
      <button
        aria-label="Go back"
        onClick={() => router.back()}
        style={{
          position: 'absolute',
          top: 24,
          left: 24,
          height: 40,
          padding: '0 16px',
          borderRadius: 10,
          border: `1px solid ${colors.border}`,
          background: colors.muted,
          color: colors.foreground,
          cursor: 'pointer',
          fontSize: 14,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 19l-7-7 7-7" />
        </svg>
        Back
      </button>

      <div style={{ width: '100%', maxWidth: 480, margin: '0 auto' }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8, color: colors.foreground }}>
          Set up your workspace
        </h1>

        <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <label style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 8, color: colors.foreground }}>
              Company Name <span style={{ color: colors.destructive }}>*</span>
            </label>
            <input
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Your company or brand name"
              style={{
                width: '100%',
                height: 48,
                padding: '0 16px',
                borderRadius: 12,
                border: `1px solid ${colors.border}`,
                background: colors.card,
                color: colors.foreground,
                fontSize: 16,
                outline: 'none',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 14, fontWeight: 500, marginBottom: 8, color: colors.foreground }}>
              Primary Goal <span style={{ color: colors.destructive }}>*</span>
            </label>
            <select
              value={primaryGoal}
              onChange={(e) => setPrimaryGoal(e.target.value)}
              style={{
                width: '100%',
                height: 48,
                padding: '0 16px',
                borderRadius: 12,
                border: `1px solid ${colors.border}`,
                background: colors.card,
                color: colors.foreground,
                fontSize: 16,
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              {PRIMARY_GOALS.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>

          {/* Advanced (collapsed) */}
          <div>
            <button
              type="button"
              onClick={() => setAdvancedOpen(!advancedOpen)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: 0,
                border: 'none',
                background: 'none',
                color: colors.primary,
                fontSize: 14,
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              {advancedOpen ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 15l-6-6-6 6" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 9l6 6 6-6" />
                </svg>
              )}
              Advanced <span style={{ color: colors.mutedForeground, fontWeight: 400 }}> (Recommended)</span>
            </button>

            {advancedOpen && (
              <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 16, borderTop: `1px solid ${colors.border}` }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: colors.mutedForeground }}>
                    Invoice Email
                  </label>
                  <input
                    type="email"
                    value={invoiceEmail}
                    onChange={(e) => setInvoiceEmail(e.target.value)}
                    placeholder="billing@company.com"
                    style={{
                      width: '100%',
                      height: 44,
                      padding: '0 14px',
                      borderRadius: 10,
                      border: `1px solid ${colors.border}`,
                      background: colors.card,
                      color: colors.foreground,
                      fontSize: 15,
                      outline: 'none',
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: colors.mutedForeground }}>
                    GST Number
                  </label>
                  <input
                    value={gstNumber}
                    onChange={(e) => setGstNumber(e.target.value)}
                    placeholder="e.g. 27XXXXX1234X1Z5"
                    style={{
                      width: '100%',
                      height: 44,
                      padding: '0 14px',
                      borderRadius: 10,
                      border: `1px solid ${colors.border}`,
                      background: colors.card,
                      color: colors.foreground,
                      fontSize: 15,
                      outline: 'none',
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 500, marginBottom: 6, color: colors.mutedForeground }}>
                    Mobile Number
                  </label>
                  <input
                    type="tel"
                    value={mobileNumber}
                    onChange={(e) => setMobileNumber(e.target.value)}
                    placeholder="+91 98765 43210"
                    style={{
                      width: '100%',
                      height: 44,
                      padding: '0 14px',
                      borderRadius: 10,
                      border: `1px solid ${colors.border}`,
                      background: colors.card,
                      color: colors.foreground,
                      fontSize: 15,
                      outline: 'none',
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          {error && (
            <div style={{ color: colors.destructive, fontSize: 14 }}>{error}</div>
          )}

          <button
            onClick={handleCreateWorkspace}
            disabled={saving}
            style={{
              width: '100%',
              height: 52,
              marginTop: 8,
              borderRadius: 12,
              border: 'none',
              background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.primaryGlow} 100%)`,
              color: 'white',
              fontSize: 16,
              fontWeight: 600,
              cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.7 : 1,
              boxShadow: '0 10px 30px rgba(0, 136, 255, 0.3)',
            }}
          >
            {saving ? 'Creating…' : 'Create Workspace'}
          </button>
        </div>
      </div>
    </div>
  );
}
