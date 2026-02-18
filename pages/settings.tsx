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
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../app/web/src/components/ui/card";
import { Button } from "../app/web/src/components/ui/button";
import { Input } from "../app/web/src/components/ui/input";
import { Label } from "../app/web/src/components/ui/label";
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
  tagline?: string | null;
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

export default function SettingsPage(): JSX.Element {
  const router = useRouter();
  const recaptchaContainerRef = useRef<HTMLDivElement | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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
  const [tagline, setTagline] = useState("");
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
          setProfile(data as ProfilePayload);

          setBusinessName(data.business_name ?? "");
          setLocation(data.location ?? "");
          setTagline(data.tagline ?? "");
          setBusinessType(data.business_type ?? BUSINESS_TYPES[0]);
          setBusinessSize(data.business_size ?? BUSINESS_SIZES[0]);
          if (Array.isArray(data.use_case)) setUseCase(data.use_case);
          setHeardFrom(data.heard_from ?? HEARD_FROM_OPTIONS[0]);
          setHeardFromOther(data.heard_from_other ?? "");

          setPhoneVerified(Boolean((data as any).phone_verified));
          setBusinessVerified(Boolean((data as any).business_mobile_verified));
        } else {
          setProfile({
            id: user.id,
            full_name: user.user_metadata?.full_name || null,
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
      const authUser = sessResp?.data?.user ?? null;

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
          router.push("/auth/signin");
          return;
        }
      }

      const payload: any = {
        id: profile.id,
        full_name: profile.full_name || null,
        email: profile.email || null,
        phone: profile.phone ?? null,
        phone_verified: profile.phone_verified ?? null,
        business_name: businessName || profile.business_name || null,
        business_mobile: profile.business_mobile ?? null,
        business_mobile_verified: profile.business_mobile_verified ?? null,
        location: location || profile.location || null,
        business_type: businessType || profile.business_type || null,
        business_size: businessSize || profile.business_size || null,
        use_case:
          useCase && useCase.length
            ? useCase
            : Array.isArray(profile.use_case)
            ? profile.use_case
            : null,
        color_primary: profile.color_primary || "#0ea5e9",
        color_secondary: profile.color_secondary || "#0b74ff",
        font: profile.font || FONT_LIST[0],
        logo_path: profile.logo_path ?? null,
        ref_images:
          Array.isArray(profile.ref_images) && profile.ref_images.length
            ? profile.ref_images
            : null,
        tagline: tagline || profile.tagline || null,
        heard_from: heardFrom || profile.heard_from || null,
        heard_from_other:
          heardFrom === "Other"
            ? heardFromOther || profile.heard_from_other || null
            : profile.heard_from_other || null,
      };

      try {
        const result = await profileClient.upsert(payload);
        if (result.success && result.data) {
          setProfile(result.data as ProfilePayload);
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
      const ok = window.confirm("Are you sure you want to sign out?");
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

  if (loading) return <div className="p-8">Loading profile…</div>;

  return (
    <div className="min-h-screen flex app-page">
      <Sidebar />

      <main className="flex-1 p-8">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl font-bold mb-6" style={{ color: colors.foreground }}>Settings</h2>

          <Tabs defaultValue={tab} onValueChange={(v) => setTab(v as any)}>
            <TabsList className="settings-tabs flex gap-2 mb-6 p-1 rounded-lg overflow-x-auto" style={{ backgroundColor: colors.muted, border: `1px solid ${colors.border}` }}>
              <style jsx>{`
                .settings-tabs button {
                  transition: background-color 0.2s, color 0.2s;
                }
                .settings-tabs button[data-state="inactive"]:hover {
                  background-color: ${colors.primary} !important;
                  color: white !important;
                }
              `}</style>
              <TabsTrigger
                value="profile"
                className="settings-tab-trigger px-4 py-2 rounded-lg"
                style={{
                  backgroundColor: tab === "profile" ? colors.primary : "transparent",
                  color: tab === "profile" ? colors.primaryForeground : colors.mutedForeground,
                }}
              >
                Profile
              </TabsTrigger>

              <TabsTrigger
                value="business"
                className="settings-tab-trigger px-4 py-2 rounded-lg"
                style={{
                  backgroundColor: tab === "business" ? colors.primary : "transparent",
                  color: tab === "business" ? colors.primaryForeground : colors.mutedForeground,
                }}
              >
                Business
              </TabsTrigger>

              <TabsTrigger
                value="billing"
                className="settings-tab-trigger px-4 py-2 rounded-lg"
                style={{
                  backgroundColor: tab === "billing" ? colors.primary : "transparent",
                  color: tab === "billing" ? colors.primaryForeground : colors.mutedForeground,
                }}
              >
                Billing Details
              </TabsTrigger>

              <TabsTrigger
                value="security"
                className="settings-tab-trigger px-4 py-2 rounded-lg"
                style={{
                  backgroundColor: tab === "security" ? colors.primary : "transparent",
                  color: tab === "security" ? colors.primaryForeground : colors.mutedForeground,
                }}
              >
                Security &amp; Policy
              </TabsTrigger>
            </TabsList>

            {/* Tabs content wrapper */}
            <div style={{ boxShadow: "0 40px 80px rgba(2,6,23,0.08)" }}>
              <TabsContent value="profile" className="p-6 bg-white rounded-xl">
                <Card className="!shadow-none border-0">
                  <CardHeader>
                    <CardTitle>Personal</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <form
                      className="space-y-4"
                      onSubmit={async (e) => {
                        e.preventDefault();
                        await saveProfileAndAi();
                      }}
                    >
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="full_name">Full name</Label>
                          <Input
                            id="full_name"
                            value={profile?.full_name ?? ""}
                            onChange={(e) =>
                              setProfile({
                                ...(profile as ProfilePayload),
                                full_name: e.target.value,
                              })
                            }
                            className="mt-1"
                          />
                        </div>

                        <div>
                          <Label htmlFor="email">Email</Label>
                          <div className="flex items-center gap-2">
                            <Input
                              id="email"
                              type="email"
                              value={profile?.email ?? ""}
                              onChange={(e) =>
                                setProfile({
                                  ...(profile as ProfilePayload),
                                  email: e.target.value,
                                })
                              }
                              className="mt-1"
                            />
                            {profile?.email ? (
                              <div className="text-sm text-slate-600">✉️</div>
                            ) : null}
                          </div>
                          <div className="text-xs text-slate-500 mt-1">
                            Updating email updates your Supabase auth email.
                          </div>
                        </div>

                        <div>
                          <div className="mt-4 flex items-center gap-2">
                            <Button onClick={saveProfileAndAi} disabled={saving}>
                              {saving ? "Saving…" : "Save changes"}
                            </Button>
                            <Button variant="destructive" onClick={handleSignOut}>
                              Sign out
                            </Button>
                          </div>
                        </div>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="business" className="p-6 bg-white rounded-xl">
                <Card className="!shadow-none border-0">
                  <CardHeader>
                    <CardTitle>Business</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <form
                      className="space-y-6"
                      onSubmit={async (e) => {
                        e.preventDefault();
                        await saveProfileAndAi();
                      }}
                    >
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="business_name">Business Name</Label>
                          <Input
                            id="business_name"
                            value={businessName}
                            onChange={(e) => setBusinessName(e.target.value)}
                            className="mt-1"
                          />
                        </div>

                        <div>
                          <Label htmlFor="location">Location</Label>
                          <Input
                            id="location"
                            value={location}
                            onChange={(e) => setLocation(e.target.value)}
                            className="mt-1"
                          />
                        </div>

                        <div className="md:col-span-2">
                          <Label htmlFor="tagline">Tagline</Label>
                          <Input
                            id="tagline"
                            value={tagline}
                            onChange={(e) => setTagline(e.target.value)}
                            className="mt-1"
                          />
                        </div>

                        <div>
                          <Label>Business type</Label>
                          <select
                            value={businessType ?? ""}
                            onChange={(e) => setBusinessType(e.target.value)}
                            className="p-2 border rounded w-full mt-1"
                          >
                            {BUSINESS_TYPES.map((b) => (
                              <option key={b} value={b}>
                                {b}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <Label>Business size</Label>
                          <select
                            value={businessSize ?? ""}
                            onChange={(e) => setBusinessSize(e.target.value)}
                            className="p-2 border rounded w-full mt-1"
                          >
                            {BUSINESS_SIZES.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="pt-4 flex items-center gap-3">
                        <Button onClick={saveProfileAndAi} disabled={saving}>
                          {saving ? "Saving…" : "Save business"}
                        </Button>
                        <Button
                          variant="ghost"
                          onClick={() => router.push("/integrationsbeta")}
                        >
                          Continue to Integrations
                        </Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="billing" className="p-0 rounded-xl overflow-hidden">
                <div
                  className="billing-section"
                  style={{
                    background: colors.background,
                    color: colors.foreground,
                  }}
                >
                  <style jsx>{`
                    .billing-section {
                      padding: 32px;
                      font-family: Poppins, Inter, system-ui;
                    }
                    .billing-section h3 {
                      font-size: 18px;
                      font-weight: 700;
                      margin: 0 0 8px;
                      color: ${colors.foreground};
                    }
                    .billing-section .subtitle {
                      font-size: 14px;
                      color: ${colors.mutedForeground};
                      margin-bottom: 16px;
                    }
                    .billing-card {
                      background: ${colors.card};
                      border: 1px solid ${colors.border};
                      border-radius: 12px;
                      padding: 24px;
                      margin-bottom: 24px;
                    }
                    .credit-chips {
                      display: flex;
                      gap: 12px;
                      flex-wrap: wrap;
                      margin-bottom: 24px;
                    }
                    .credit-chip {
                      background: ${colors.card};
                      border: 1px solid ${colors.border};
                      border-radius: 10px;
                      padding: 20px 28px;
                      min-width: 120px;
                      text-align: center;
                      transition: box-shadow 0.2s, transform 0.2s;
                    }
                    .credit-chip:hover {
                      box-shadow: 0 4px 12px hsl(0 0% 0% / 0.25);
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
                    .buy-credits-btn {
                      display: inline-flex;
                      align-items: center;
                      justify-content: center;
                      padding: 14px 28px;
                      border-radius: 10px;
                      background: ${colors.primary};
                      color: white;
                      font-weight: 600;
                      font-size: 15px;
                      border: none;
                      cursor: pointer;
                      transition: all 0.2s;
                    }
                    .buy-credits-btn:hover {
                      background: ${colors.primaryHover || "hsl(213 100% 60%)"};
                      transform: translateY(-1px);
                      box-shadow: 0 6px 20px hsl(213 100% 55% / 0.25);
                    }
                    .tx-table {
                      width: 100%;
                      border-collapse: collapse;
                      font-size: 14px;
                    }
                    .tx-table th {
                      text-align: left;
                      padding: 12px 16px;
                      color: ${colors.mutedForeground};
                      font-weight: 600;
                      border-bottom: 1px solid ${colors.border};
                    }
                    .tx-table td {
                      padding: 14px 16px;
                      border-bottom: 1px solid ${colors.border};
                      color: ${colors.foreground};
                    }
                    .tx-table tr:hover td {
                      background: hsl(0 0% 15% / 0.5);
                    }
                    .status-badge {
                      display: inline-block;
                      padding: 4px 10px;
                      border-radius: 6px;
                      font-size: 12px;
                      font-weight: 600;
                    }
                    .status-complete {
                      background: hsl(142 76% 36% / 0.2);
                      color: ${colors.green600};
                    }
                    .status-captured {
                      background: hsl(142 76% 36% / 0.2);
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

                  {billingLoading ? (
                    <div className="billing-card">
                      <p className="subtitle">Loading billing info…</p>
                    </div>
                  ) : (
                    <>
                      {/* Credit Balance - horizontal chips */}
                      <div style={{ marginBottom: 32 }}>
                        <h3>Credit Balance</h3>
                        <p className="subtitle">
                          Your available credits for image and video generation
                        </p>
                        <div className="credit-chips">
                          {creditBalance ? (
                            <>
                              <div className="credit-chip">
                                <span className="value">
                                  {creditBalance.imageCredits?.total ?? 0}
                                </span>
                                <span className="label">Image Credits</span>
                              </div>
                              <div className="credit-chip">
                                <span className="value">
                                  {creditBalance.videoCredits?.total ?? 0}s
                                </span>
                                <span className="label">Video Credits</span>
                              </div>
                            </>
                          ) : (
                            <div className="credit-chip">
                              <span className="value">—</span>
                              <span className="label">Loading…</span>
                            </div>
                          )}
                        </div>
                        <button
                          className="buy-credits-btn"
                          onClick={() => router.push("/buy-credits")}
                        >
                          Buy Credits
                        </button>
                      </div>

                      {/* Subscription Plan */}
                      <div className="billing-card">
                        <h3>
                          Subscription Plan:{" "}
                          <span style={{ color: colors.primary }}>
                            {subscription?.plan?.name ?? "Pay-as-you-go"}
                          </span>
                        </h3>
                        <p className="subtitle">
                          {subscription?.plan?.billingCycle ?? "Credits purchased on demand"}
                        </p>
                        {subscription?.nextResetDate && (
                          <p
                            className="subtitle"
                            style={{ marginBottom: 0, marginTop: 8 }}
                          >
                            Credits reset on{" "}
                            {new Date(
                              subscription.nextResetDate
                            ).toLocaleDateString()}
                          </p>
                        )}
                      </div>

                      {/* Payment Method */}
                      <div className="billing-card">
                        <h3>Payment Method</h3>
                        <p className="subtitle">
                          All payments are processed securely via Razorpay
                        </p>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 12,
                            padding: "16px 20px",
                            background: colors.input,
                            borderRadius: 8,
                            border: `1px solid ${colors.border}`,
                          }}
                        >
                          <span style={{ fontWeight: 600 }}>
                            Razorpay (Cards, UPI, Net Banking)
                          </span>
                        </div>
                      </div>

                      {/* Latest Transactions */}
                      <div className="billing-card">
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginBottom: 16,
                          }}
                        >
                          <h3 style={{ marginBottom: 0 }}>Latest Transactions</h3>
                          <select
                            style={{
                              padding: "8px 12px",
                              borderRadius: 8,
                              border: `1px solid ${colors.border}`,
                              background: colors.input,
                              color: colors.foreground,
                              fontSize: 13,
                            }}
                          >
                            <option>Sort by: Recent</option>
                          </select>
                        </div>
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
                                  <td>
                                    {new Date(
                                      tx.createdAt
                                    ).toLocaleDateString()}
                                  </td>
                                  <td style={{ fontWeight: 700 }}>
                                    ₹{tx.amount}
                                  </td>
                                  <td>
                                    <span
                                      className={`status-badge status-${tx.status}`}
                                    >
                                      {tx.status === "captured"
                                        ? "Complete"
                                        : tx.status}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        ) : (
                          <p
                            className="subtitle"
                            style={{ marginBottom: 0, padding: "24px 0" }}
                          >
                            No transactions yet
                          </p>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </TabsContent>

              <TabsContent
                value="security"
                className="p-6 rounded-xl"
                style={{ backgroundColor: colors.card, border: `1px solid ${colors.border}` }}
              >
                {/* Security & Policy as its own top-level tab */}
                <Card className="rounded-xl shadow-sm" style={{ backgroundColor: colors.card, borderColor: colors.border, border: `1px solid ${colors.border}` }}>
                  <CardHeader>
                    <CardTitle style={{ color: colors.foreground }}>Security &amp; Policy</CardTitle>
                    <p className="text-sm mt-1" style={{ color: colors.mutedForeground }}>
                      All the important legal, security, and data-handling
                      details in one place.
                    </p>
                  </CardHeader>

                  <CardContent>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {[
                        { href: "/terms-and-conditions", label: "Terms & Conditions" },
                        { href: "/privacy-policy", label: "Privacy Policy" },
                        { href: "/refund-cancellation", label: "Refund Policy" },
                        { href: "/cookie-policy", label: "Cookie Policy" },
                        { href: "/data-handling-security", label: "Data Handling & Security" },
                        { href: "/ai-disclosure", label: "AI Use Disclosure" },
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

                    <div className="mt-6 pt-4" style={{ borderTop: `1px solid ${colors.border}` }}>
                      <p className="text-sm leading-relaxed" style={{ color: colors.mutedForeground }}>
                        To remove your data or permanently delete your account,
                        email{" "}
                        <a
                          href="mailto:info@optimx.app?subject=Delete%20Account&body=delete%20-%20[reason]"
                          className="font-medium underline"
                          style={{ color: colors.primary }}
                        >
                          info@optimx.app
                        </a>{" "}
                        with the subject <span className="font-semibold" style={{ color: colors.foreground }}>&quot;delete&quot;</span>{" "}
                        and a brief reason.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </div>
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
