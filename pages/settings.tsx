// pages/settings.tsx
"use client";

import React, { useEffect, useRef, useState } from "react";
import Sidebar from "../app/web/src/components/Sidebar";
import { supabase } from '@/auth/supabase/client';
import { initFirebaseApp } from '@/auth/firebase/client';
import { useRouter } from "next/router";
import { profileClient } from '@/database/client-helpers';
import type { JSX } from "react";
import Link from "next/link";
import { Button } from "../app/web/src/components/ui/button";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../app/web/src/components/ui/tabs";

type ProfilePayload = {
  id: string;
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
  phone_verified?: boolean | null;
  business_name?: string | null;
  business_mobile?: string | null;
  business_mobile_verified?: boolean | null;
  location?: string | null;
  business_type?: string | null;
  business_size?: string | null;
  use_case?: string[] | null;
  color_primary?: string | null;
  color_secondary?: string | null;
  font?: string | null;
  logo_path?: string | null;
  ref_images?: string[] | null;
  gst_number?: string | null;
  heard_from?: string | null;
  heard_from_other?: string | null;
};

const FONT_LIST = [
  "Inter",
  "Roboto",
  "Poppins",
  "Montserrat",
  "Lato",
  "Open Sans",
  "Source Sans Pro",
];

const BUSINESS_TYPES = [
  "Food & Beverage (Restaurant, Cafes)",
  "Fashion & Apparel",
  "Beauty & Personal Care",
  "Health, Fitness & Wellness",
  "Education & E-learning",
  "Real Estate & Property",
  "Travel & Hospitality",
  "Automotive & Dealerships",
  "Finance, Banking & Insurance",
  "Technology & SaaS",
  "Home & Lifestyle",
  "Entertainment & Events",
  "Media & Advertising",
  "Logistics & Transportation",
  "Manufacturing & Industrial",
  "Professional Services (Agencies, Consultants, Freelancers)",
  "Non-Profit",
  "Agriculture & Farming",
  "Other",
];

const BUSINESS_SIZES = [
  "Solo / Individual",
  "Small (1-10)",
  "Medium (11-50)",
  "Large (51-200)",
  "Enterprise (200+)",
];

const USE_CASE_OPTIONS = [
  "Run Ads & Promotions",
  "Increase Brand Awareness",
  "Drive Store Visits / Foot Traffic",
  "Generate Leads or Signups",
  "Boost Online Sales",
  "Engage Existing Customers",
  "Launch New Products / Offers",
  "Analyze Marketing Performance",
  "Automate Campaigns with AI",
  "Other",
];

const HEARD_FROM_OPTIONS = [
  "Google / Search",
  "Friend / Referral",
  "Social Media",
  "Paid Ad",
  "Email",
  "Event / Conference",
  "Partner",
  "Other",
];

import colors from '@/lib/ui/colors';
import { authFetch } from '@/lib/utils';
import { showError, showConfirm } from '@/app/web/src/components/ui/AlertModal';

/** Normalize a Drizzle camelCase profile response to snake_case ProfilePayload */
function normalizeProfile(data: any): ProfilePayload {
  return {
    id: data.id,
    full_name: data.fullName ?? data.full_name ?? null,
    email: data.email ?? null,
    phone: data.phone ?? null,
    phone_verified: data.phoneVerified ?? data.phone_verified ?? null,
    business_name: data.businessName ?? data.business_name ?? null,
    business_mobile: data.businessMobile ?? data.business_mobile ?? null,
    business_mobile_verified: data.businessMobileVerified ?? data.business_mobile_verified ?? null,
    location: data.location ?? null,
    business_type: data.businessType ?? data.business_type ?? null,
    business_size: data.businessSize ?? data.business_size ?? null,
    use_case: data.useCase ?? data.use_case ?? null,
    color_primary: data.colorPrimary ?? data.color_primary ?? null,
    color_secondary: data.colorSecondary ?? data.color_secondary ?? null,
    font: data.font ?? null,
    logo_path: data.logoPath ?? data.logo_path ?? null,
    ref_images: data.refImages ?? data.ref_images ?? null,
    gst_number: data.gstNumber ?? data.gst_number ?? null,
    heard_from: data.heardFrom ?? data.heard_from ?? null,
    heard_from_other: data.heardFromOther ?? data.heard_from_other ?? null,
  };
}

export default function SettingsPage(): JSX.Element {
  const router = useRouter();
  const recaptchaContainerRef = useRef<HTMLDivElement | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Four tabs: profile, business, billing, security
  const [tab, setTab] = useState<"profile" | "business" | "billing" | "security">(
    "profile"
  );

  // Billing state
  const [billingLoading, setBillingLoading] = useState(false);
  const [creditBalance, setCreditBalance] = useState<{
    imageCredits: { total: number };
    videoCredits: { total: number };
  } | null>(null);
  const [subscription, setSubscription] = useState<{
    plan: { name: string; billingCycle: string };
    nextResetDate: string | null;
  } | null>(null);
  const [paymentHistory, setPaymentHistory] = useState<
    { id: string; amount: number; currency: string; status: string; paymentType: string; createdAt: string; metadata?: { creditType?: string; credits?: number } }[]
  >([]);

  const [profile, setProfile] = useState<ProfilePayload | null>(null);

  const [phoneVerified, setPhoneVerified] = useState(false);
  const [businessVerified, setBusinessVerified] = useState(false);

  const [businessName, setBusinessName] = useState("");
  const [location, setLocation] = useState("");
  const [gstNumber, setGstNumber] = useState("");
  const [businessType, setBusinessType] = useState<string | null>(
    BUSINESS_TYPES[0]
  );
  const [businessSize, setBusinessSize] = useState<string | null>(
    BUSINESS_SIZES[0]
  );
  const [useCase, setUseCase] = useState<string[]>([]);
  const [heardFrom, setHeardFrom] = useState<string | null>(
    HEARD_FROM_OPTIONS[0]
  );
  const [heardFromOther, setHeardFromOther] = useState<string>("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        // Wait for auth to initialize (session restore from storage) before redirecting.
        // getUser() can briefly return null on initial load before Supabase hydrates the session.
        let user: any = null;
        let userErr: any = null;
        for (let attempt = 0; attempt < 3; attempt++) {
          const res = await supabase.auth.getUser();
          user = res.data?.user ?? null;
          userErr = res.error ?? null;
          if (user) break;
          if (attempt < 2) await new Promise((r) => setTimeout(r, 300));
        }
        if (userErr || !user) {
          router.push("/auth/signin");
          return;
        }

        const result = await profileClient.get();

        if (result.success && result.data) {
          const data = result.data;
          const normalized = normalizeProfile(data);
          setProfile(normalized);

          // Drizzle returns camelCase keys; fall back to snake_case for compatibility
          setBusinessName(data.businessName ?? data.business_name ?? "");
          setLocation(data.location ?? "");
          setGstNumber(data.gstNumber ?? data.gst_number ?? "");
          setBusinessType(data.businessType ?? data.business_type ?? BUSINESS_TYPES[0]);
          setBusinessSize(data.businessSize ?? data.business_size ?? BUSINESS_SIZES[0]);
          const useCaseData = data.useCase ?? data.use_case;
          if (Array.isArray(useCaseData)) setUseCase(useCaseData);
          setHeardFrom(data.heardFrom ?? data.heard_from ?? HEARD_FROM_OPTIONS[0]);
          setHeardFromOther(data.heardFromOther ?? data.heard_from_other ?? "");

          setPhoneVerified(Boolean(data.phoneVerified ?? data.phone_verified));
          setBusinessVerified(Boolean(data.businessMobileVerified ?? data.business_mobile_verified));
        } else {
          setProfile({
            id: user.id,
            full_name: user.user_metadata?.full_name || user.user_metadata?.fullName || null,
            email: user.email || null,
          });
        }

        if (typeof window !== "undefined") {
          try {
            initFirebaseApp();
          } catch (e) {
            console.warn("Firebase init error", e);
          }
        }
      } catch (e) {
        console.error("fetch profile error", e);
        router.push("/auth/signin");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch billing data when billing tab is active
  useEffect(() => {
    if (tab !== "billing") return;
    let cancelled = false;
    setBillingLoading(true);
    (async () => {
      try {
        const [balanceRes, subRes, historyRes] = await Promise.all([
          authFetch("/api/credits/balance"),
          authFetch("/api/billing/subscriptions/current"),
          authFetch("/api/billing/payments/history"),
        ]);
        if (cancelled) return;
        const balanceData = await balanceRes.json();
        const subData = await subRes.json();
        const historyData = await historyRes.json();
        if (balanceData.success)
          setCreditBalance({
            imageCredits: balanceData.imageCredits,
            videoCredits: balanceData.videoCredits,
          });
        if (subData.success && subData.subscription)
          setSubscription({
            plan: subData.subscription.plan,
            nextResetDate: subData.subscription.nextResetDate,
          });
        if (historyData.success) setPaymentHistory(historyData.payments || []);
      } catch (e) {
        console.error("fetch billing error", e);
      } finally {
        if (!cancelled) setBillingLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [tab]);

  async function saveProfileAndAi() {
    if (!profile) return;
    setSaving(true);

    try {
      const sessResp: any = await supabase.auth.getSession();
      const session = sessResp?.data?.session ?? null;
      const authUser = session?.user ?? null;

      if (!session || !authUser) {
        router.push("/auth/signin");
        return;
      }

      const authEmail = authUser?.email || null;
      if (profile.email && profile.email !== authEmail) {
        const { error: updateErr } = await supabase.auth.updateUser({
          email: profile.email,
        });
        if (updateErr) {
          console.error("updateUser error", updateErr);
          showError("Failed to update email. Please try again.");
          return;
        }
      }

      const payload: any = {
        id: profile.id,
        full_name: profile.full_name || null,
        fullName: profile.full_name || null,
        email: profile.email || null,
        phone: profile.phone ?? null,
        phone_verified: profile.phone_verified ?? null,
        business_name: businessName || profile.business_name || null,
        businessName: businessName || profile.business_name || null,
        business_mobile: profile.business_mobile ?? null,
        businessMobile: profile.business_mobile ?? null,
        business_mobile_verified: profile.business_mobile_verified ?? null,
        location: location || profile.location || null,
        business_type: businessType || profile.business_type || null,
        businessType: businessType || profile.business_type || null,
        business_size: businessSize || profile.business_size || null,
        businessSize: businessSize || profile.business_size || null,
        use_case:
          useCase && useCase.length
            ? useCase
            : Array.isArray(profile.use_case)
            ? profile.use_case
            : null,
        useCase:
          useCase && useCase.length
            ? useCase
            : Array.isArray(profile.use_case)
            ? profile.use_case
            : null,
        color_primary: profile.color_primary || "#0ea5e9",
        colorPrimary: profile.color_primary || "#0ea5e9",
        color_secondary: profile.color_secondary || "#0b74ff",
        colorSecondary: profile.color_secondary || "#0b74ff",
        font: profile.font || FONT_LIST[0],
        logo_path: profile.logo_path ?? null,
        logoPath: profile.logo_path ?? null,
        ref_images:
          Array.isArray(profile.ref_images) && profile.ref_images.length
            ? profile.ref_images
            : null,
        refImages:
          Array.isArray(profile.ref_images) && profile.ref_images.length
            ? profile.ref_images
            : null,
        gst_number: gstNumber || profile.gst_number || null,
        gstNumber: gstNumber || profile.gst_number || null,
        heard_from: heardFrom || profile.heard_from || null,
        heardFrom: heardFrom || profile.heard_from || null,
        heard_from_other:
          heardFrom === "Other"
            ? heardFromOther || profile.heard_from_other || null
            : profile.heard_from_other || null,
        heardFromOther:
          heardFrom === "Other"
            ? heardFromOther || profile.heard_from_other || null
            : profile.heard_from_other || null,
      };

      try {
        const result = await profileClient.upsert(payload);
        if (result.success && result.data) {
          setProfile(normalizeProfile(result.data));
          setSaveSuccess(true);
          setTimeout(() => setSaveSuccess(false), 3000);
        }
      } catch (upErr) {
        console.error("profiles upsert error", upErr);
      }
    } catch (err) {
      console.error("saveProfileAndAi error", err);
    } finally {
      setSaving(false);
    }
  }

  async function handleSignOut() {
    try {
      const ok = await showConfirm("Are you sure you want to sign out?", { title: "Sign Out", confirmLabel: "Sign Out", cancelLabel: "Cancel" });
      if (!ok) return;
      try {
        await supabase.auth.signOut();
      } catch (e) {
        console.error("signOut error (ignored)", e);
      }
      router.push("/auth/signin");
    } catch (e) {
      console.error("signout flow error", e);
      router.push("/auth/signin");
    }
  }

  const inputStyle: React.CSSProperties = {
    background: colors.input,
    color: colors.foreground,
    border: `1px solid ${colors.border}`,
    borderRadius: 8,
    padding: "10px 14px",
    width: "100%",
    fontSize: 14,
    outline: "none",
    transition: "border-color 0.2s",
  };

  const selectStyle: React.CSSProperties = {
    ...inputStyle,
    appearance: "none" as const,
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23999' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
    backgroundRepeat: "no-repeat",
    backgroundPosition: "right 14px center",
    paddingRight: 36,
  };

  const labelStyle: React.CSSProperties = {
    color: colors.mutedForeground,
    fontSize: 13,
    fontWeight: 500,
    marginBottom: 6,
    display: "block",
  };

  const sectionStyle: React.CSSProperties = {
    background: colors.card,
    border: `1px solid ${colors.border}`,
    borderRadius: 12,
    padding: 28,
  };

  if (loading) {
    return (
      <div className="min-h-screen flex app-page" style={{ background: colors.background }}>
        <Sidebar />
        <main className="flex-1 flex items-center justify-center">
          <p style={{ color: colors.mutedForeground, fontSize: 15 }}>Loading profile...</p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex app-page" style={{ background: colors.background }}>
      <Sidebar />

      <main className="flex-1 p-8 overflow-y-auto">
        <div className="max-w-3xl mx-auto">
          <style jsx>{`
            .settings-tabs button {
              transition: background-color 0.2s, color 0.2s;
            }
            .settings-tabs button[data-state="inactive"]:hover {
              background-color: hsl(0 0% 25%) !important;
              color: ${colors.foreground} !important;
            }
            .settings-input:focus {
              border-color: ${colors.primary} !important;
              box-shadow: 0 0 0 2px hsl(213 100% 55% / 0.15);
            }
            .settings-select:focus {
              border-color: ${colors.primary} !important;
              box-shadow: 0 0 0 2px hsl(213 100% 55% / 0.15);
            }
            .settings-select option {
              background: ${colors.card};
              color: ${colors.foreground};
            }
            .credit-chips {
              display: flex;
              gap: 12px;
              flex-wrap: wrap;
              margin-bottom: 24px;
            }
            .credit-chip {
              background: ${colors.background};
              border: 1px solid ${colors.border};
              border-radius: 10px;
              padding: 20px 28px;
              min-width: 140px;
              text-align: center;
              transition: border-color 0.2s, transform 0.2s;
            }
            .credit-chip:hover {
              border-color: ${colors.primary};
              transform: translateY(-1px);
            }
            .credit-chip .value {
              font-size: 28px;
              font-weight: 700;
              color: ${colors.foreground};
              display: block;
              margin-bottom: 4px;
            }
            .credit-chip .label {
              font-size: 12px;
              color: ${colors.mutedForeground};
              text-transform: uppercase;
              letter-spacing: 0.04em;
            }
            .tx-table {
              width: 100%;
              border-collapse: collapse;
              font-size: 14px;
            }
            .tx-table th {
              text-align: left;
              padding: 12px 0;
              color: ${colors.mutedForeground};
              font-weight: 600;
              font-size: 12px;
              text-transform: uppercase;
              letter-spacing: 0.04em;
              border-bottom: 1px solid ${colors.border};
            }
            .tx-table td {
              padding: 14px 0;
              border-bottom: 1px solid ${colors.border};
              color: ${colors.foreground};
            }
            .tx-table tr:last-child td {
              border-bottom: none;
            }
            .status-badge {
              display: inline-block;
              padding: 4px 10px;
              border-radius: 6px;
              font-size: 12px;
              font-weight: 600;
            }
            .status-complete, .status-captured {
              background: hsl(142 76% 36% / 0.15);
              color: ${colors.green600};
            }
            .status-created {
              background: hsl(213 100% 55% / 0.15);
              color: ${colors.primary};
            }
            .status-failed {
              background: hsl(0 84% 55% / 0.15);
              color: ${colors.destructive};
            }
          `}</style>

          <h2 className="text-2xl font-bold mb-6" style={{ color: colors.foreground }}>Settings</h2>

          <Tabs defaultValue={tab} onValueChange={(v) => setTab(v as any)}>
            <TabsList className="settings-tabs flex gap-1 mb-6 p-1 rounded-lg overflow-x-auto" style={{ backgroundColor: colors.muted, border: `1px solid ${colors.border}` }}>
              {([
                { value: "profile", label: "Profile" },
                { value: "business", label: "Business" },
                { value: "billing", label: "Billing" },
                { value: "security", label: "Security & Policy" },
              ] as const).map((t) => (
                <TabsTrigger
                  key={t.value}
                  value={t.value}
                  className="px-4 py-2 rounded-md text-sm font-medium"
                  style={{
                    backgroundColor: tab === t.value ? colors.primary : "transparent",
                    color: tab === t.value ? colors.primaryForeground : colors.mutedForeground,
                  }}
                >
                  {t.label}
                </TabsTrigger>
              ))}
            </TabsList>

            {/* ── Profile Tab ── */}
            <TabsContent value="profile">
              <div style={sectionStyle}>
                <h3 className="text-lg font-semibold mb-1" style={{ color: colors.foreground }}>Personal Information</h3>
                <p className="text-sm mb-6" style={{ color: colors.mutedForeground }}>Manage your account details</p>

                <form
                  className="space-y-5"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    await saveProfileAndAi();
                  }}
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <label htmlFor="full_name" style={labelStyle}>Full name</label>
                      <input
                        id="full_name"
                        className="settings-input"
                        style={inputStyle}
                        value={profile?.full_name ?? ""}
                        onChange={(e) =>
                          setProfile({
                            ...(profile as ProfilePayload),
                            full_name: e.target.value,
                          })
                        }
                        placeholder="Your full name"
                      />
                    </div>

                    <div>
                      <label htmlFor="email" style={labelStyle}>Email</label>
                      <input
                        id="email"
                        type="email"
                        className="settings-input"
                        style={{ ...inputStyle, opacity: 0.7, cursor: 'not-allowed' }}
                        value={profile?.email ?? ""}
                        disabled
                        placeholder="you@example.com"
                      />
                    </div>
                  </div>

                  <div style={{ borderTop: `1px solid ${colors.border}`, paddingTop: 20, marginTop: 24, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div className="flex items-center gap-3">
                      <Button type="button" onClick={saveProfileAndAi} disabled={saving}>
                        {saving ? "Saving..." : "Save changes"}
                      </Button>
                      {saveSuccess && (
                        <span className="text-sm font-medium" style={{ color: colors.green600 }}>Saved</span>
                      )}
                    </div>
                    <Button variant="destructive" type="button" onClick={handleSignOut}>
                      Sign out
                    </Button>
                  </div>
                </form>

              </div>
            </TabsContent>

            {/* ── Business Tab ── */}
            <TabsContent value="business">
              <div style={sectionStyle}>
                <h3 className="text-lg font-semibold mb-1" style={{ color: colors.foreground }}>Business Details</h3>
                <p className="text-sm mb-6" style={{ color: colors.mutedForeground }}>Information about your business</p>

                <form
                  className="space-y-5"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    await saveProfileAndAi();
                  }}
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <label htmlFor="business_name" style={labelStyle}>Business name</label>
                      <input
                        id="business_name"
                        className="settings-input"
                        style={inputStyle}
                        value={businessName}
                        onChange={(e) => setBusinessName(e.target.value)}
                        placeholder="Acme Inc."
                      />
                    </div>

                    <div>
                      <label htmlFor="location" style={labelStyle}>Location</label>
                      <input
                        id="location"
                        className="settings-input"
                        style={inputStyle}
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        placeholder="City, Country"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label htmlFor="gst_number" style={labelStyle}>GST Number</label>
                      <input
                        id="gst_number"
                        className="settings-input"
                        style={inputStyle}
                        value={gstNumber}
                        onChange={(e) => setGstNumber(e.target.value)}
                        placeholder="e.g. 27XXXXX1234X1Z5"
                      />
                    </div>

                    <div>
                      <label style={labelStyle}>Business type</label>
                      <select
                        className="settings-select"
                        style={selectStyle}
                        value={businessType ?? ""}
                        onChange={(e) => setBusinessType(e.target.value)}
                      >
                        {BUSINESS_TYPES.map((b) => (
                          <option key={b} value={b}>{b}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label style={labelStyle}>Business size</label>
                      <select
                        className="settings-select"
                        style={selectStyle}
                        value={businessSize ?? ""}
                        onChange={(e) => setBusinessSize(e.target.value)}
                      >
                        {BUSINESS_SIZES.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div style={{ borderTop: `1px solid ${colors.border}`, paddingTop: 20, marginTop: 24, display: "flex", alignItems: "center", gap: 12 }}>
                    <Button type="button" onClick={saveProfileAndAi} disabled={saving}>
                      {saving ? "Saving..." : "Save changes"}
                    </Button>
                    {saveSuccess && (
                      <span className="text-sm font-medium" style={{ color: colors.green600 }}>Saved</span>
                    )}
                  </div>
                </form>

                <div style={{ borderTop: `1px solid ${colors.border}`, marginTop: 32, paddingTop: 24 }}>
                  <h3 className="text-lg font-semibold mb-2" style={{ color: colors.foreground }}>Policies & Legal</h3>
                  <p className="text-sm mb-4" style={{ color: colors.mutedForeground }}>Important legal and policy documents</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {[
                      { href: "/terms-and-conditions", label: "Terms & Conditions" },
                      { href: "/privacy-policy", label: "Privacy Policy" },
                      { href: "/terms-and-conditions#refund-cancellation", label: "Refund Policy" },
                      { href: "/cpolicy", label: "Cookie Policy" },
                      { href: "/terms-and-conditions#data-handling", label: "Data Handling & Security" },
                      { href: "/terms-and-conditions#ai-usage", label: "AI Use Disclosure" },
                    ].map((item) => (
                      <Link key={item.href} href={item.href} className="group block">
                        <div
                          className="flex items-center justify-between rounded-lg border px-4 py-3 transition"
                          style={{
                            borderColor: colors.border,
                            backgroundColor: "transparent",
                            color: colors.foreground,
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = colors.primary;
                            e.currentTarget.style.backgroundColor = "hsl(213 100% 55% / 0.08)";
                            const view = e.currentTarget.querySelector(".policy-view");
                            if (view) (view as HTMLElement).style.color = colors.primary;
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = colors.border;
                            e.currentTarget.style.backgroundColor = "transparent";
                            const view = e.currentTarget.querySelector(".policy-view");
                            if (view) (view as HTMLElement).style.color = colors.mutedForeground;
                          }}
                        >
                          <span className="text-sm font-medium" style={{ color: colors.foreground }}>
                            {item.label}
                          </span>
                          <span className="policy-view text-xs" style={{ color: colors.mutedForeground }}>
                            View
                          </span>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            </TabsContent>

            {/* ── Billing Tab ── */}
            <TabsContent value="billing">
              <div style={sectionStyle}>

                {billingLoading ? (
                  <p style={{ color: colors.mutedForeground, fontSize: 14, padding: "24px 0" }}>Loading billing info...</p>
                ) : (
                  <div className="space-y-8">
                    {/* Credit Balance */}
                    <div>
                      <h3 className="text-lg font-semibold mb-1" style={{ color: colors.foreground }}>Credit Balance</h3>
                      <p className="text-sm mb-4" style={{ color: colors.mutedForeground }}>
                        Your available credits for image and video generation
                      </p>
                      <div className="credit-chips">
                        {creditBalance ? (
                          <>
                            <div className="credit-chip">
                              <span className="value">{creditBalance.imageCredits?.total ?? 0}</span>
                              <span className="label">Image Credits</span>
                            </div>
                            <div className="credit-chip">
                              <span className="value">{creditBalance.videoCredits?.total ?? 0}s</span>
                              <span className="label">Video Credits</span>
                            </div>
                          </>
                        ) : (
                          <div className="credit-chip">
                            <span className="value">--</span>
                            <span className="label">Loading</span>
                          </div>
                        )}
                      </div>
                      <Button type="button" onClick={() => router.push("/buy-credits")}>
                        Buy Credits
                      </Button>
                    </div>

                    <div style={{ borderTop: `1px solid ${colors.border}` }} />

                    {/* Subscription Plan */}
                    <div>
                      <h3 className="text-lg font-semibold mb-1" style={{ color: colors.foreground }}>
                        Subscription Plan
                      </h3>
                      <div
                        className="mt-3"
                        style={{
                          background: colors.background,
                          border: `1px solid ${colors.border}`,
                          borderRadius: 10,
                          padding: "16px 20px",
                        }}
                      >
                        <span className="font-semibold" style={{ color: colors.primary }}>
                          {subscription?.plan?.name ?? "Pay-as-you-go"}
                        </span>
                        <span className="ml-2 text-sm" style={{ color: colors.mutedForeground }}>
                          {subscription?.plan?.billingCycle ?? "Credits purchased on demand"}
                        </span>
                        {subscription?.nextResetDate && (
                          <p className="text-sm mt-2" style={{ color: colors.mutedForeground }}>
                            Credits reset on {new Date(subscription.nextResetDate).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </div>

                    <div style={{ borderTop: `1px solid ${colors.border}` }} />

                    {/* Payment Method */}
                    <div>
                      <h3 className="text-lg font-semibold mb-1" style={{ color: colors.foreground }}>Payment Method</h3>
                      <p className="text-sm mb-3" style={{ color: colors.mutedForeground }}>
                        All payments are processed securely via Razorpay
                      </p>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 12,
                          padding: "14px 20px",
                          background: colors.background,
                          borderRadius: 10,
                          border: `1px solid ${colors.border}`,
                        }}
                      >
                        <span style={{ fontWeight: 600, color: colors.foreground, fontSize: 14 }}>
                          Razorpay (Cards, UPI, Net Banking)
                        </span>
                      </div>
                    </div>

                    <div style={{ borderTop: `1px solid ${colors.border}` }} />

                    {/* Latest Transactions */}
                    <div>
                      <h3 className="text-lg font-semibold mb-4" style={{ color: colors.foreground }}>Latest Transactions</h3>
                      {paymentHistory.length > 0 ? (
                        <table className="tx-table">
                          <thead>
                            <tr>
                              <th>Invoice</th>
                              <th>Date</th>
                              <th>Amount</th>
                              <th>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {paymentHistory.map((tx) => (
                              <tr key={tx.id}>
                                <td>
                                  {tx.paymentType === "subscription"
                                    ? "Subscription"
                                    : tx.paymentType === "image_topup"
                                    ? `Image Credits${tx.metadata?.credits ? ` - ${tx.metadata.credits}` : ""}`
                                    : tx.paymentType === "video_topup"
                                    ? `Video Credits${tx.metadata?.credits ? ` - ${tx.metadata.credits}s` : ""}`
                                    : tx.paymentType}
                                </td>
                                <td>{new Date(tx.createdAt).toLocaleDateString()}</td>
                                <td style={{ fontWeight: 700 }}>
                                  {"\u20B9"}{tx.amount}
                                </td>
                                <td>
                                  <span className={`status-badge status-${tx.status}`}>
                                    {tx.status === "captured" ? "Complete" : tx.status}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <p style={{ color: colors.mutedForeground, fontSize: 14, padding: "16px 0" }}>
                          No transactions yet
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* ── Security Tab ── */}
            <TabsContent value="security">
              <div style={sectionStyle}>
                <h3 className="text-lg font-semibold mb-1" style={{ color: colors.foreground }}>Security &amp; Policy</h3>
                <p className="text-sm mb-6" style={{ color: colors.mutedForeground }}>
                  All the important legal, security, and data-handling details in one place.
                </p>

                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    { href: "/terms-and-conditions", label: "Terms & Conditions" },
                    { href: "/privacy-policy", label: "Privacy Policy" },
                    { href: "/terms-and-conditions#refund-cancellation", label: "Refund Policy" },
                    { href: "/cpolicy", label: "Cookie Policy" },
                    { href: "/terms-and-conditions#data-handling", label: "Data Handling & Security" },
                    { href: "/terms-and-conditions#ai-usage", label: "AI Use Disclosure" },
                  ].map((item) => (
                    <Link key={item.href} href={item.href} className="group block">
                      <div
                        className="flex items-center justify-between rounded-lg px-4 py-3 transition-all"
                        style={{
                          border: `1px solid ${colors.border}`,
                          backgroundColor: colors.background,
                          color: colors.foreground,
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = colors.primary;
                          e.currentTarget.style.backgroundColor = "hsl(213 100% 55% / 0.06)";
                          const view = e.currentTarget.querySelector(".policy-view");
                          if (view) (view as HTMLElement).style.color = colors.primary;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = colors.border;
                          e.currentTarget.style.backgroundColor = colors.background;
                          const view = e.currentTarget.querySelector(".policy-view");
                          if (view) (view as HTMLElement).style.color = colors.mutedForeground;
                        }}
                      >
                        <span className="text-sm font-medium" style={{ color: colors.foreground }}>
                          {item.label}
                        </span>
                        <span className="policy-view text-xs" style={{ color: colors.mutedForeground, transition: "color 0.2s" }}>
                          View
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>

                <div className="mt-6 pt-5" style={{ borderTop: `1px solid ${colors.border}` }}>
                  <p className="text-sm leading-relaxed" style={{ color: colors.mutedForeground }}>
                    To remove your data or permanently delete your account, email{" "}
                    <a
                      href="mailto:info@optimx.app?subject=Delete%20Account&body=delete%20-%20[reason]"
                      className="font-medium underline"
                      style={{ color: colors.primary }}
                    >
                      info@optimx.app
                    </a>{" "}
                    with the subject <span className="font-semibold" style={{ color: colors.foreground }}>&quot;delete&quot;</span> and a brief reason.
                  </p>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          {/* recaptcha container (kept) */}
          <div className="sr-only">
            <div ref={recaptchaContainerRef} id="recaptcha-container" />
          </div>
        </div>
      </main>
    </div>
  );
}
