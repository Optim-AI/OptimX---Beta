// pages/settings.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Sidebar from "../app/web/src/components/Sidebar";
import { supabase } from "@/auth/supabase/client";
import { initFirebaseApp } from "@/auth/firebase/client";
import { useRouter } from "next/router";
import { profileClient } from "@/database/client-helpers";
import type { JSX } from "react";
import Link from "next/link";
import { Button } from "../app/web/src/components/ui/button";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../app/web/src/components/ui/tabs";
import { SITE_SUPPORT_EMAIL } from "@/lib/seo/site";
import colors from "@/lib/ui/colors";
import { authFetch } from "@/lib/utils";
import { showError, showConfirm } from "@/app/web/src/components/ui/alert-modal-api";
import {
  SETTINGS_TABS,
  POLICY_LINKS,
  isSettingsTab,
  type SettingsTabValue,
  SettingsCard,
  SettingsSectionHeader,
  SettingsDivider,
  ProfileAvatar,
  PolicyDocumentLink,
  PaymentStatusBadge,
  fieldLabelStyle,
  fieldInputStyle,
  fieldSelectStyle,
} from "@/app/web/src/components/settings/SettingsUI";
import { Image as ImageIcon, Video, Shield, KeyRound } from "lucide-react";

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
    business_mobile_verified:
      data.businessMobileVerified ?? data.business_mobile_verified ?? null,
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

function transactionLabel(tx: {
  paymentType: string;
  metadata?: { creditType?: string; credits?: number };
}) {
  if (tx.paymentType === "subscription") return "Subscription";
  if (tx.paymentType === "image_topup") {
    return `Image Credits${tx.metadata?.credits ? ` · ${tx.metadata.credits}` : ""}`;
  }
  if (tx.paymentType === "video_topup") {
    return `Video Credits${tx.metadata?.credits ? ` · ${tx.metadata.credits}` : ""}`;
  }
  return tx.paymentType;
}

export default function SettingsPage(): JSX.Element {
  const router = useRouter();
  const recaptchaContainerRef = useRef<HTMLDivElement | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [profileNameError, setProfileNameError] = useState<string | null>(null);

  const [tab, setTab] = useState<SettingsTabValue>("profile");

  const [billingLoading, setBillingLoading] = useState(false);
  const [billingError, setBillingError] = useState<string | null>(null);
  const [creditBalance, setCreditBalance] = useState<{
    imageCredits: { total: number };
    videoCredits: { total: number };
  } | null>(null);
  const [subscription, setSubscription] = useState<{
    id?: string;
    status?: string;
    plan: { name: string; billingCycle: string };
    nextResetDate: string | null;
  } | null>(null);
  const [paymentHistory, setPaymentHistory] = useState<
    {
      id: string;
      amount: number;
      currency: string;
      status: string;
      paymentType: string;
      createdAt: string;
      metadata?: { creditType?: string; credits?: number };
    }[]
  >([]);

  const [profile, setProfile] = useState<ProfilePayload | null>(null);

  const [businessName, setBusinessName] = useState("");
  const [location, setLocation] = useState("");
  const [gstNumber, setGstNumber] = useState("");
  const [businessType, setBusinessType] = useState<string | null>(BUSINESS_TYPES[0]);
  const [businessSize, setBusinessSize] = useState<string | null>(BUSINESS_SIZES[0]);
  const [useCase, setUseCase] = useState<string[]>([]);
  const [heardFrom, setHeardFrom] = useState<string | null>(HEARD_FROM_OPTIONS[0]);
  const [heardFromOther, setHeardFromOther] = useState<string>("");

  // Sync tab from URL once router is ready
  useEffect(() => {
    if (!router.isReady) return;
    const queryTab = router.query.tab;
    if (typeof queryTab === "string" && isSettingsTab(queryTab)) {
      setTab(queryTab);
    }
  }, [router.isReady, router.query.tab]);

  function handleTabChange(next: string) {
    if (!isSettingsTab(next)) return;
    setTab(next);
    setSaveSuccess(false);
    setSaveError(null);
    void router.replace(
      { pathname: router.pathname, query: { ...router.query, tab: next } },
      undefined,
      { shallow: true }
    );
  }

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
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

          setBusinessName(data.businessName ?? data.business_name ?? "");
          setLocation(data.location ?? "");
          setGstNumber(data.gstNumber ?? data.gst_number ?? "");
          setBusinessType(data.businessType ?? data.business_type ?? BUSINESS_TYPES[0]);
          setBusinessSize(data.businessSize ?? data.business_size ?? BUSINESS_SIZES[0]);
          const useCaseData = data.useCase ?? data.use_case;
          if (Array.isArray(useCaseData)) setUseCase(useCaseData);
          setHeardFrom(data.heardFrom ?? data.heard_from ?? HEARD_FROM_OPTIONS[0]);
          setHeardFromOther(data.heardFromOther ?? data.heard_from_other ?? "");
        } else {
          setProfile({
            id: user.id,
            full_name:
              user.user_metadata?.full_name || user.user_metadata?.fullName || null,
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

  useEffect(() => {
    if (tab !== "billing") return;
    let cancelled = false;
    setBillingLoading(true);
    setBillingError(null);
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
        if (balanceData.success) {
          setCreditBalance({
            imageCredits: balanceData.imageCredits,
            videoCredits: balanceData.videoCredits,
          });
        }
        if (subData.success && subData.subscription) {
          setSubscription({
            id: subData.subscription.id,
            status: subData.subscription.status,
            plan: subData.subscription.plan,
            nextResetDate: subData.subscription.nextResetDate,
          });
        } else if (subData.success) {
          setSubscription(null);
        }
        if (historyData.success) setPaymentHistory(historyData.payments || []);
      } catch (e) {
        console.error("fetch billing error", e);
        if (!cancelled) setBillingError("Unable to load billing details right now.");
      } finally {
        if (!cancelled) setBillingLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tab]);

  async function saveProfileAndAi() {
    if (!profile || saving) return;

    const trimmedName = (profile.full_name || "").trim();
    if (tab === "profile" && !trimmedName) {
      setProfileNameError("Full name is required.");
      return;
    }
    setProfileNameError(null);
    setSaveError(null);
    setSaving(true);

    try {
      const sessResp: any = await supabase.auth.getSession();
      const session = sessResp?.data?.session ?? null;
      const authUser = session?.user ?? null;

      if (!session || !authUser) {
        router.push("/auth/signin");
        return;
      }

      // Email stays read-only in the UI. Keep auth email as source of truth.
      const authEmail = authUser?.email || null;

      const payload: any = {
        id: profile.id,
        full_name: trimmedName || profile.full_name || null,
        fullName: trimmedName || profile.full_name || null,
        email: authEmail || profile.email || null,
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
        } else {
          setSaveError("Failed to save changes. Please try again.");
          showError("Failed to save changes. Please try again.");
        }
      } catch (upErr) {
        console.error("profiles upsert error", upErr);
        setSaveError("Failed to save changes. Please try again.");
        showError("Failed to save changes. Please try again.");
      }
    } catch (err) {
      console.error("saveProfileAndAi error", err);
      setSaveError("Failed to save changes. Please try again.");
      showError("Failed to save changes. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSignOut() {
    try {
      const ok = await showConfirm("Are you sure you want to sign out?", {
        title: "Sign Out",
        confirmLabel: "Sign Out",
        cancelLabel: "Cancel",
      });
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

  const planAction = useMemo(() => {
    if (!subscription) {
      return { label: "View plans", href: "/pricing" };
    }
    return { label: "Manage plan", href: "/buy-credits" };
  }, [subscription]);

  if (loading) {
    return (
      <div className="min-h-screen flex app-page" style={{ background: colors.background }}>
        <Sidebar />
        <main className="flex-1 flex items-center justify-center p-6">
          <p style={{ color: colors.mutedForeground, fontSize: 15 }}>Loading settings…</p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex app-page" style={{ background: colors.background }}>
      <Sidebar />

      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
          <style jsx>{`
            .settings-tabs button {
              transition: background-color 0.15s, color 0.15s;
            }
            .settings-tabs button[data-state="inactive"]:hover {
              background-color: hsl(0 0% 22%) !important;
              color: ${colors.foreground} !important;
            }
            .settings-input:focus,
            .settings-select:focus {
              border-color: ${colors.primary} !important;
              box-shadow: 0 0 0 3px hsl(213 100% 55% / 0.16);
            }
            .settings-select option {
              background: ${colors.card};
              color: ${colors.foreground};
            }
            .settings-tabs-scroll {
              -webkit-overflow-scrolling: touch;
              scrollbar-width: none;
            }
            .settings-tabs-scroll::-webkit-scrollbar {
              display: none;
            }
          `}</style>

          <header className="mb-6 sm:mb-8">
            <h1
              className="text-2xl font-bold tracking-tight sm:text-3xl"
              style={{ color: colors.foreground }}
            >
              Settings
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed sm:text-[15px]" style={{ color: colors.mutedForeground }}>
              Manage your account, business profile, billing, and security.
            </p>
          </header>

          <Tabs value={tab} onValueChange={handleTabChange}>
            <div className="settings-tabs-scroll mb-6 overflow-x-auto">
              <TabsList
                className="settings-tabs inline-flex min-w-full gap-1 rounded-xl p-1 sm:min-w-0"
                style={{
                  backgroundColor: colors.muted,
                  border: `1px solid ${colors.border}`,
                  height: "auto",
                }}
              >
                {SETTINGS_TABS.map((item) => {
                  const active = tab === item.value;
                  return (
                    <TabsTrigger
                      key={item.value}
                      value={item.value}
                      className="rounded-lg px-3 py-2.5 text-sm font-medium sm:px-4"
                      style={{
                        backgroundColor: active ? colors.primary : "transparent",
                        color: active ? colors.primaryForeground : colors.mutedForeground,
                        boxShadow: active ? "0 4px 14px hsl(213 100% 55% / 0.28)" : "none",
                      }}
                    >
                      {item.label}
                    </TabsTrigger>
                  );
                })}
              </TabsList>
            </div>

            {/* Profile */}
            <TabsContent value="profile" className="mt-0 space-y-5" style={{ background: "transparent" }}>
              <SettingsCard>
                <SettingsSectionHeader
                  title="Personal Information"
                  description="Update the details associated with your SkalX account."
                />

                <div className="mb-6 flex items-center gap-4">
                  <ProfileAvatar name={profile?.full_name} email={profile?.email} />
                  <div className="min-w-0">
                    <p className="truncate text-base font-semibold" style={{ color: colors.foreground }}>
                      {profile?.full_name || "Your profile"}
                    </p>
                    <p className="truncate text-sm" style={{ color: colors.mutedForeground }}>
                      {profile?.email || "No email on file"}
                    </p>
                  </div>
                </div>

                <form
                  className="space-y-5"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    await saveProfileAndAi();
                  }}
                >
                  <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                    <div>
                      <label htmlFor="full_name" style={fieldLabelStyle}>
                        Full name
                      </label>
                      <input
                        id="full_name"
                        className="settings-input"
                        style={fieldInputStyle}
                        value={profile?.full_name ?? ""}
                        onChange={(e) => {
                          setProfileNameError(null);
                          setProfile({
                            ...(profile as ProfilePayload),
                            full_name: e.target.value,
                          });
                        }}
                        placeholder="Your full name"
                        autoComplete="name"
                      />
                      {profileNameError ? (
                        <p className="mt-1.5 text-xs" style={{ color: colors.destructive }}>
                          {profileNameError}
                        </p>
                      ) : null}
                    </div>

                    <div>
                      <label htmlFor="email" style={fieldLabelStyle}>
                        Email
                      </label>
                      <input
                        id="email"
                        type="email"
                        className="settings-input"
                        style={{
                          ...fieldInputStyle,
                          opacity: 0.72,
                          cursor: "not-allowed",
                        }}
                        value={profile?.email ?? ""}
                        disabled
                        readOnly
                        placeholder="you@example.com"
                        autoComplete="email"
                      />
                      <p className="mt-1.5 text-xs" style={{ color: colors.mutedForeground }}>
                        Email is managed by your sign-in method and can&apos;t be changed here.
                      </p>
                    </div>
                  </div>

                  <div
                    className="flex flex-col gap-3 pt-5 sm:flex-row sm:items-center"
                    style={{ borderTop: `1px solid ${colors.border}` }}
                  >
                    <Button type="submit" disabled={saving}>
                      {saving ? "Saving…" : "Save changes"}
                    </Button>
                    {saveSuccess ? (
                      <span className="text-sm font-medium" style={{ color: colors.green600 }}>
                        Saved successfully
                      </span>
                    ) : null}
                    {saveError ? (
                      <span className="text-sm font-medium" style={{ color: colors.destructive }}>
                        {saveError}
                      </span>
                    ) : null}
                  </div>
                </form>
              </SettingsCard>

              <SettingsCard>
                <SettingsSectionHeader
                  title="Account access"
                  description="Sign out of SkalX on this device. You can sign back in anytime with your existing credentials."
                />
                <Button
                  variant="outline"
                  type="button"
                  onClick={handleSignOut}
                  style={{
                    borderColor: "hsl(0 84% 55% / 0.45)",
                    color: colors.destructive,
                    background: "hsl(0 84% 55% / 0.08)",
                  }}
                >
                  Sign out
                </Button>
              </SettingsCard>
            </TabsContent>

            {/* Business */}
            <TabsContent value="business" className="mt-0" style={{ background: "transparent" }}>
              <SettingsCard>
                <SettingsSectionHeader
                  title="Business Details"
                  description="Information used across Brand Studio and campaign experiences."
                />

                <form
                  className="space-y-5"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    await saveProfileAndAi();
                  }}
                >
                  <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                    <div>
                      <label htmlFor="business_name" style={fieldLabelStyle}>
                        Business name
                      </label>
                      <input
                        id="business_name"
                        className="settings-input"
                        style={fieldInputStyle}
                        value={businessName}
                        onChange={(e) => setBusinessName(e.target.value)}
                        placeholder="Acme Inc."
                      />
                    </div>

                    <div>
                      <label htmlFor="location" style={fieldLabelStyle}>
                        Location
                      </label>
                      <input
                        id="location"
                        className="settings-input"
                        style={fieldInputStyle}
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        placeholder="City, Country"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label htmlFor="gst_number" style={fieldLabelStyle}>
                        GST number
                      </label>
                      <input
                        id="gst_number"
                        className="settings-input"
                        style={fieldInputStyle}
                        value={gstNumber}
                        onChange={(e) => setGstNumber(e.target.value)}
                        placeholder="e.g. 27XXXXX1234X1Z5"
                      />
                    </div>

                    <div>
                      <label htmlFor="business_type" style={fieldLabelStyle}>
                        Business type
                      </label>
                      <select
                        id="business_type"
                        className="settings-select"
                        style={fieldSelectStyle}
                        value={businessType ?? ""}
                        onChange={(e) => setBusinessType(e.target.value)}
                      >
                        {BUSINESS_TYPES.map((item) => (
                          <option key={item} value={item}>
                            {item}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label htmlFor="business_size" style={fieldLabelStyle}>
                        Business size
                      </label>
                      <select
                        id="business_size"
                        className="settings-select"
                        style={fieldSelectStyle}
                        value={businessSize ?? ""}
                        onChange={(e) => setBusinessSize(e.target.value)}
                      >
                        {BUSINESS_SIZES.map((item) => (
                          <option key={item} value={item}>
                            {item}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div
                    className="flex flex-col gap-3 pt-5 sm:flex-row sm:items-center"
                    style={{ borderTop: `1px solid ${colors.border}` }}
                  >
                    <Button type="submit" disabled={saving}>
                      {saving ? "Saving…" : "Save changes"}
                    </Button>
                    {saveSuccess ? (
                      <span className="text-sm font-medium" style={{ color: colors.green600 }}>
                        Saved successfully
                      </span>
                    ) : null}
                    {saveError ? (
                      <span className="text-sm font-medium" style={{ color: colors.destructive }}>
                        {saveError}
                      </span>
                    ) : null}
                  </div>
                </form>
              </SettingsCard>
            </TabsContent>

            {/* Billing */}
            <TabsContent value="billing" className="mt-0" style={{ background: "transparent" }}>
              <SettingsCard>
                {billingLoading ? (
                  <p className="py-10 text-sm" style={{ color: colors.mutedForeground }}>
                    Loading billing info…
                  </p>
                ) : billingError ? (
                  <p className="py-10 text-sm" style={{ color: colors.destructive }}>
                    {billingError}
                  </p>
                ) : (
                  <>
                    <SettingsSectionHeader
                      title="Credit balance"
                      description="Your available credits for image and video generation."
                      action={
                        <Button type="button" onClick={() => router.push("/buy-credits")}>
                          Buy Credits
                        </Button>
                      }
                    />

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div
                        className="rounded-xl px-5 py-5"
                        style={{
                          background: "hsl(213 100% 55% / 0.12)",
                          border: "1px solid hsl(213 100% 55% / 0.32)",
                        }}
                      >
                        <div className="mb-3 flex items-center gap-2" style={{ color: "hsl(213 100% 70%)" }}>
                          <ImageIcon size={16} />
                          <span className="text-xs font-semibold uppercase tracking-[0.08em]">
                            Image credits
                          </span>
                        </div>
                        <p className="text-3xl font-bold" style={{ color: "hsl(213 100% 72%)" }}>
                          {creditBalance?.imageCredits?.total ?? 0}
                        </p>
                      </div>

                      <div
                        className="rounded-xl px-5 py-5"
                        style={{
                          background: "hsl(270 80% 55% / 0.12)",
                          border: "1px solid hsl(270 80% 55% / 0.28)",
                        }}
                      >
                        <div className="mb-3 flex items-center gap-2" style={{ color: "hsl(270 80% 72%)" }}>
                          <Video size={16} />
                          <span className="text-xs font-semibold uppercase tracking-[0.08em]">
                            Video credits
                          </span>
                        </div>
                        <p className="text-3xl font-bold" style={{ color: "hsl(270 80% 72%)" }}>
                          {creditBalance?.videoCredits?.total ?? 0}
                        </p>
                      </div>
                    </div>

                    <SettingsDivider />

                    <SettingsSectionHeader
                      title="Subscription plan"
                      description="Your current plan and billing cycle."
                      action={
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => router.push(planAction.href)}
                        >
                          {planAction.label}
                        </Button>
                      }
                    />

                    <div
                      className="rounded-xl px-5 py-4"
                      style={{
                        background: colors.background,
                        border: `1px solid ${colors.border}`,
                      }}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-base font-semibold" style={{ color: colors.primary }}>
                          {subscription?.plan?.name ?? "Pay-as-you-go"}
                        </span>
                        {subscription?.status ? (
                          <span
                            className="rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide"
                            style={{
                              background: "hsl(213 100% 55% / 0.14)",
                              color: colors.primary,
                            }}
                          >
                            {subscription.status}
                          </span>
                        ) : (
                          <span
                            className="rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide"
                            style={{
                              background: colors.muted,
                              color: colors.mutedForeground,
                            }}
                          >
                            On demand
                          </span>
                        )}
                      </div>
                      <p className="mt-2 text-sm" style={{ color: colors.mutedForeground }}>
                        {subscription?.plan?.billingCycle ?? "Credits purchased on demand"}
                      </p>
                      {subscription?.nextResetDate ? (
                        <p className="mt-2 text-sm" style={{ color: colors.mutedForeground }}>
                          Credits reset on{" "}
                          {new Date(subscription.nextResetDate).toLocaleDateString()}
                        </p>
                      ) : null}
                    </div>

                    <SettingsDivider />

                    <SettingsSectionHeader
                      title="Payment method"
                      description="All payments are processed securely via Razorpay."
                    />
                    <div
                      className="rounded-xl px-5 py-4 text-sm font-medium"
                      style={{
                        background: colors.background,
                        border: `1px solid ${colors.border}`,
                        color: colors.foreground,
                      }}
                    >
                      Razorpay · Cards, UPI, Net Banking
                    </div>

                    <SettingsDivider />

                    <SettingsSectionHeader
                      title="Latest transactions"
                      description="Recent purchases and subscription payments."
                    />

                    {paymentHistory.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[520px] border-collapse text-sm">
                          <thead>
                            <tr>
                              {["Invoice", "Date", "Amount", "Status"].map((heading) => (
                                <th
                                  key={heading}
                                  className="pb-3 text-left text-xs font-semibold uppercase tracking-[0.06em]"
                                  style={{
                                    color: colors.mutedForeground,
                                    borderBottom: `1px solid ${colors.border}`,
                                  }}
                                >
                                  {heading}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {paymentHistory.map((tx) => (
                              <tr key={tx.id}>
                                <td
                                  className="py-3.5 pr-3"
                                  style={{
                                    color: colors.foreground,
                                    borderBottom: `1px solid ${colors.border}`,
                                  }}
                                >
                                  {transactionLabel(tx)}
                                </td>
                                <td
                                  className="py-3.5 pr-3"
                                  style={{
                                    color: colors.foreground,
                                    borderBottom: `1px solid ${colors.border}`,
                                  }}
                                >
                                  {new Date(tx.createdAt).toLocaleDateString()}
                                </td>
                                <td
                                  className="py-3.5 pr-3 font-semibold"
                                  style={{
                                    color: colors.foreground,
                                    borderBottom: `1px solid ${colors.border}`,
                                  }}
                                >
                                  {"\u20B9"}
                                  {tx.amount}
                                </td>
                                <td
                                  className="py-3.5"
                                  style={{ borderBottom: `1px solid ${colors.border}` }}
                                >
                                  <PaymentStatusBadge status={tx.status} />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-sm" style={{ color: colors.mutedForeground }}>
                        No transactions yet.
                      </p>
                    )}
                  </>
                )}
              </SettingsCard>
            </TabsContent>

            {/* Security & Policy */}
            <TabsContent value="security" className="mt-0 space-y-5" style={{ background: "transparent" }}>
              <SettingsCard>
                <SettingsSectionHeader
                  title="Security"
                  description="Protect your account with the authentication options available for your sign-in method."
                />

                <div
                  className="flex flex-col gap-4 rounded-xl px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
                  style={{
                    background: colors.background,
                    border: `1px solid ${colors.border}`,
                  }}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg"
                      style={{
                        background: "hsl(213 100% 55% / 0.12)",
                        color: colors.primary,
                      }}
                    >
                      <KeyRound size={16} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold" style={{ color: colors.foreground }}>
                        Password
                      </p>
                      <p className="mt-1 text-sm" style={{ color: colors.mutedForeground }}>
                        Use the password reset flow to securely update your password.
                      </p>
                    </div>
                  </div>
                  <Button asChild type="button" variant="outline">
                    <Link href="/auth/forgot-password">Reset password</Link>
                  </Button>
                </div>
              </SettingsCard>

              <SettingsCard>
                <SettingsSectionHeader
                  title="Policies & Legal"
                  description="Important legal, security, and data-handling documents."
                />
                <div className="grid gap-3 sm:grid-cols-2">
                  {POLICY_LINKS.map((item) => (
                    <PolicyDocumentLink key={item.href} href={item.href} label={item.label} />
                  ))}
                </div>

                <SettingsDivider />

                <div className="flex items-start gap-3">
                  <div
                    className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                    style={{
                      background: "hsl(0 84% 55% / 0.1)",
                      color: colors.destructive,
                    }}
                  >
                    <Shield size={16} />
                  </div>
                  <p className="text-sm leading-relaxed" style={{ color: colors.mutedForeground }}>
                    To remove your data or permanently delete your account, email{" "}
                    <a
                      href={`mailto:${SITE_SUPPORT_EMAIL}?subject=Delete%20Account&body=delete%20-%20[reason]`}
                      className="font-medium underline"
                      style={{ color: colors.primary }}
                    >
                      {SITE_SUPPORT_EMAIL}
                    </a>{" "}
                    with the subject{" "}
                    <span className="font-semibold" style={{ color: colors.foreground }}>
                      &quot;delete&quot;
                    </span>{" "}
                    and a brief reason.
                  </p>
                </div>
              </SettingsCard>
            </TabsContent>
          </Tabs>

          <div className="sr-only">
            <div ref={recaptchaContainerRef} id="recaptcha-container" />
          </div>
        </div>
      </main>
    </div>
  );
}
