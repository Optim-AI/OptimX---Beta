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
import { SITE_SUPPORT_EMAIL } from "@/lib/seo/site";
import colors from "@/lib/ui/colors";
import { authFetch } from "@/lib/utils";
import { toast } from "sonner";
import { showError, showConfirm } from "@/app/web/src/components/ui/alert-modal-api";
import {
  SETTINGS_TABS,
  POLICY_LINKS,
  isSettingsTab,
  type SettingsTabValue,
  SettingsCard,
  SettingsSectionHeader,
  ProfileAvatar,
  PaymentStatusBadge,
  fieldLabelStyle,
  fieldInputStyle,
  fieldSelectStyle,
} from "@/app/web/src/components/settings/SettingsUI";
import { Building2, Check, ChevronRight, CreditCard, FileText, Image as ImageIcon, KeyRound, LogOut, Plug, Receipt, ShieldCheck, Trash2, User, Video } from "lucide-react";
import MetaIntegrationCard from "@/app/web/src/components/meta-intel/MetaIntegrationCard";

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

/** The five sections, in plain words, with what each one is for. */
const SECTIONS: Record<SettingsTabValue, { label: string; hint: string; Icon: typeof User }> = {
  profile: { label: "Your account", hint: "Name, email, sign out", Icon: User },
  business: { label: "Your business", hint: "Name, location, GST", Icon: Building2 },
  billing: { label: "Plan & billing", hint: "Credits, plan, payments", Icon: CreditCard },
  integrations: { label: "Connected accounts", hint: "Facebook & Instagram", Icon: Plug },
  security: { label: "Security & legal", hint: "Password, policies", Icon: ShieldCheck },
};

const controlStyle: React.CSSProperties = { ...fieldInputStyle, minHeight: 46, fontSize: 15 };
const selectStyle: React.CSSProperties = { ...fieldSelectStyle, minHeight: 46, fontSize: 15 };

function Field({ id, label, hint, error, wide, children }: { id: string; label: string; hint?: string; error?: string | null; wide?: boolean; children: React.ReactNode }) {
  return (
    <div className={wide ? "md:col-span-2" : undefined}>
      <label htmlFor={id} style={{ ...fieldLabelStyle, color: colors.foreground, fontSize: 14 }}>
        {label}
      </label>
      {children}
      {error ? (
        <p role="alert" className="mt-1.5 text-sm" style={{ color: colors.destructive }}>{error}</p>
      ) : hint ? (
        <p className="mt-1.5 text-xs" style={{ color: colors.mutedForeground }}>{hint}</p>
      ) : null}
    </div>
  );
}

/** A row that opens something: icon, title, one line of help, and an action on the right. */
function ActionRow({ Icon, title, body, tone = "default", children }: { Icon: typeof User; title: string; body: React.ReactNode; tone?: "default" | "danger"; children?: React.ReactNode }) {
  const danger = tone === "danger";
  return (
    <div className="flex flex-col gap-3 rounded-xl px-4 py-4 sm:flex-row sm:items-center sm:justify-between" style={{ background: colors.background, border: `1px solid ${colors.border}` }}>
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={{ background: danger ? "hsl(0 84% 55% / 0.1)" : "hsl(213 100% 55% / 0.12)", color: danger ? colors.destructive : colors.primary }}>
          <Icon size={16} aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold" style={{ color: colors.foreground }}>{title}</p>
          <p className="mt-0.5 text-sm leading-relaxed" style={{ color: colors.mutedForeground }}>{body}</p>
        </div>
      </div>
      {children ? <div className="shrink-0">{children}</div> : null}
    </div>
  );
}

export default function SettingsPage(): JSX.Element {
  const router = useRouter();
  const recaptchaContainerRef = useRef<HTMLDivElement | null>(null);
  const navRef = useRef<HTMLElement | null>(null);

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
    plan: { name: string; billingCycle: string; imageCredits?: number; videoCredits?: number };
    nextResetDate: string | null;
    cancelAtPeriodEnd?: boolean;
    currentPeriodEnd?: string | null;
  } | null>(null);
  const [cancelling, setCancelling] = useState(false);
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

  // On phones the section menu scrolls sideways: keep the open section's button in view.
  useEffect(() => {
    if (loading) return;
    const nav = navRef.current;
    const item = nav?.querySelector<HTMLElement>('.settings-nav-item[aria-current="page"]');
    if (!nav || !item || nav.scrollWidth <= nav.clientWidth) return;
    const left = item.getBoundingClientRect().left - nav.getBoundingClientRect().left + nav.scrollLeft;
    nav.scrollTo({ left: Math.max(0, left - (nav.clientWidth - item.offsetWidth) / 2) });
  }, [tab, loading]);

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
            cancelAtPeriodEnd: Boolean(subData.subscription.cancelAtPeriodEnd),
            currentPeriodEnd: subData.subscription.currentPeriodEnd ?? null,
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

  const formatDate = (iso?: string | null) =>
    iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }) : null;
  const periodEnd = formatDate(subscription?.currentPeriodEnd || subscription?.nextResetDate);

  /** Stop the plan from renewing. It stays active, with its credits, until the paid period ends. */
  async function handleCancelSubscription() {
    if (!subscription || cancelling) return;
    const until = periodEnd ? ` until ${periodEnd}` : " until the end of the period you have paid for";
    const ok = await showConfirm(
      `Your ${subscription.plan.name} plan will stay active${until}. After that it will not renew: no payment will be taken and no new credits will be added. Credits you bought separately stay with you.`,
      { title: "Cancel subscription?", confirmLabel: "Cancel subscription", cancelLabel: "Keep my plan" }
    );
    if (!ok) return;
    setCancelling(true);
    try {
      const res = await authFetch("/api/billing/subscriptions/cancel", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) throw new Error(data.error || "We couldn't cancel your subscription. Please try again.");
      if (data.cancelAtPeriodEnd) {
        setSubscription((prev) => (prev ? { ...prev, cancelAtPeriodEnd: true, currentPeriodEnd: data.currentPeriodEnd ?? prev.currentPeriodEnd } : prev));
        const end = formatDate(data.currentPeriodEnd) || periodEnd;
        toast.success(end ? `Subscription cancelled. Your plan stays active until ${end}.` : "Subscription cancelled. It will not renew.");
      } else {
        setSubscription(null);
        toast.success("Subscription cancelled.");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "We couldn't cancel your subscription. Please try again.");
    } finally {
      setCancelling(false);
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

  const shell = (content: React.ReactNode) => (
    <div className="min-h-screen flex app-page" style={{ background: colors.background }}>
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">{content}</div>
      </main>
    </div>
  );

  if (loading) {
    return shell(
      <div aria-busy="true" aria-label="Loading settings">
        <div className="h-8 w-40 animate-pulse rounded-lg" style={{ background: colors.muted }} />
        <div className="mt-6 grid gap-6 lg:grid-cols-[230px_minmax(0,1fr)]">
          <div className="hidden space-y-2 lg:block">
            {[0, 1, 2, 3, 4].map((i) => <div key={i} className="h-14 animate-pulse rounded-xl" style={{ background: colors.muted }} />)}
          </div>
          <div className="h-72 animate-pulse rounded-2xl" style={{ background: colors.muted }} />
        </div>
      </div>
    );
  }

  const saveRow = (
    <div className="flex flex-col gap-3 pt-5 sm:flex-row sm:items-center" style={{ borderTop: `1px solid ${colors.border}` }}>
      <Button type="submit" disabled={saving} className="h-11 px-6 text-sm font-semibold">
        {saving ? "Saving…" : "Save changes"}
      </Button>
      <span aria-live="polite" className="text-sm font-medium">
        {saveSuccess ? (
          <span className="inline-flex items-center gap-1.5" style={{ color: colors.green600 }}><Check size={15} aria-hidden /> Saved</span>
        ) : saveError ? (
          <span style={{ color: colors.destructive }}>{saveError}</span>
        ) : null}
      </span>
    </div>
  );
  const onSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await saveProfileAndAi();
  };

  const subEnding = Boolean(subscription?.cancelAtPeriodEnd);
  const planStatus = !subscription ? "No plan" : subEnding ? "Cancelled" : subscription.status === "past_due" ? "Payment due" : "Active";
  const planTone = !subscription
    ? { background: colors.muted, color: colors.mutedForeground }
    : subEnding || subscription.status === "past_due"
      ? { background: "hsl(38 92% 50% / 0.16)", color: "hsl(38 92% 68%)" }
      : { background: "hsl(142 70% 45% / 0.16)", color: "hsl(142 70% 62%)" };

  return shell(
    <>
      <style jsx global>{`
        .settings-input:focus, .settings-select:focus {
          border-color: ${colors.primary} !important;
          box-shadow: 0 0 0 3px hsl(213 100% 55% / 0.16);
        }
        .settings-select option { background: ${colors.card}; color: ${colors.foreground}; }
        .settings-nav-scroll { -webkit-overflow-scrolling: touch; scrollbar-width: none; }
        .settings-nav-scroll::-webkit-scrollbar { display: none; }
        .settings-nav-item:focus-visible, .settings-link:focus-visible { outline: 2px solid ${colors.primary}; outline-offset: 2px; }
        .settings-nav-item[aria-current="false"]:hover { background: ${colors.muted}; }
        .settings-link:hover { border-color: ${colors.primary} !important; }
      `}</style>

      {/* Who is signed in */}
      <header className="mb-6 flex flex-wrap items-center gap-4 sm:mb-8">
        <ProfileAvatar name={profile?.full_name} email={profile?.email} />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl" style={{ color: colors.foreground }}>Settings</h1>
          <p className="mt-1 truncate text-sm sm:text-[15px]" style={{ color: colors.mutedForeground }}>
            {profile?.full_name ? `${profile.full_name} · ` : ""}{profile?.email || "Your SkalX account"}
          </p>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[230px_minmax(0,1fr)] lg:gap-8">
        {/* Section menu: a side list on large screens, a scrolling row on phones */}
        <nav ref={navRef} aria-label="Settings sections" className="settings-nav-scroll -mx-4 overflow-x-auto px-4 lg:mx-0 lg:overflow-visible lg:px-0">
          <ul className="flex gap-2 lg:sticky lg:top-6 lg:flex-col lg:gap-1">
            {SETTINGS_TABS.map((item) => {
              const active = tab === item.value;
              const { label, hint, Icon } = SECTIONS[item.value];
              return (
                <li key={item.value} className="shrink-0">
                  <button
                    type="button"
                    aria-current={active ? "page" : "false"}
                    onClick={() => handleTabChange(item.value)}
                    className="settings-nav-item flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-left transition-colors"
                    style={{
                      background: active ? "hsl(213 100% 55% / 0.14)" : "transparent",
                      border: `1px solid ${active ? "hsl(213 100% 55% / 0.45)" : "transparent"}`,
                      minHeight: 48,
                    }}
                  >
                    <Icon size={18} aria-hidden style={{ color: active ? colors.primary : colors.mutedForeground }} />
                    <span className="min-w-0">
                      <span className="block whitespace-nowrap text-sm font-semibold" style={{ color: active ? colors.foreground : colors.mutedForeground }}>{label}</span>
                      <span className="hidden text-xs lg:block" style={{ color: colors.mutedForeground }}>{hint}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="min-w-0 space-y-5">
          {/* Your account */}
          {tab === "profile" && (
            <>
              <SettingsCard>
                <SettingsSectionHeader title="Your details" description="The name we use for you in SkalX." />
                <form className="space-y-5" onSubmit={onSave}>
                  <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                    <Field id="full_name" label="Full name" error={profileNameError}>
                      <input
                        id="full_name"
                        className="settings-input"
                        style={controlStyle}
                        value={profile?.full_name ?? ""}
                        onChange={(e) => {
                          setProfileNameError(null);
                          setProfile({ ...(profile as ProfilePayload), full_name: e.target.value });
                        }}
                        placeholder="Your full name"
                        autoComplete="name"
                      />
                    </Field>
                    <Field id="email" label="Email" hint="This is the email you sign in with. It can't be changed here.">
                      <input
                        id="email"
                        type="email"
                        className="settings-input"
                        style={{ ...controlStyle, opacity: 0.72, cursor: "not-allowed" }}
                        value={profile?.email ?? ""}
                        disabled
                        readOnly
                        autoComplete="email"
                      />
                    </Field>
                  </div>
                  {saveRow}
                </form>
              </SettingsCard>

              <SettingsCard>
                <ActionRow Icon={LogOut} title="Sign out" body="Sign out of SkalX on this device. You can sign back in any time." tone="danger">
                  <Button variant="outline" type="button" onClick={handleSignOut} className="h-11 px-5"
                    style={{ borderColor: "hsl(0 84% 55% / 0.45)", color: colors.destructive, background: "hsl(0 84% 55% / 0.08)" }}>
                    Sign out
                  </Button>
                </ActionRow>
              </SettingsCard>
            </>
          )}

          {/* Your business */}
          {tab === "business" && (
            <SettingsCard>
              <SettingsSectionHeader title="Business details" description="We use these to tailor your ads and to put the right details on your invoices." />
              <form className="space-y-5" onSubmit={onSave}>
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                  <Field id="business_name" label="Business name">
                    <input id="business_name" className="settings-input" style={controlStyle} value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="e.g. Oorgaa Foods" autoComplete="organization" />
                  </Field>
                  <Field id="location" label="City">
                    <input id="location" className="settings-input" style={controlStyle} value={location} onChange={(e) => setLocation(e.target.value)} placeholder="e.g. Chennai, India" />
                  </Field>
                  <Field id="business_type" label="What you sell">
                    <select id="business_type" className="settings-select" style={selectStyle} value={businessType ?? ""} onChange={(e) => setBusinessType(e.target.value)}>
                      {BUSINESS_TYPES.map((item) => <option key={item} value={item}>{item}</option>)}
                    </select>
                  </Field>
                  <Field id="business_size" label="Team size">
                    <select id="business_size" className="settings-select" style={selectStyle} value={businessSize ?? ""} onChange={(e) => setBusinessSize(e.target.value)}>
                      {BUSINESS_SIZES.map((item) => <option key={item} value={item}>{item}</option>)}
                    </select>
                  </Field>
                  <Field id="gst_number" label="GST number (optional)" hint="Add it if you want GST on your invoices." wide>
                    <input id="gst_number" className="settings-input" style={controlStyle} value={gstNumber} onChange={(e) => setGstNumber(e.target.value.toUpperCase())} placeholder="e.g. 33ABCDE1234F1Z5" autoCapitalize="characters" />
                  </Field>
                </div>
                {saveRow}
              </form>
            </SettingsCard>
          )}

          {/* Plan & billing */}
          {tab === "billing" && (
            billingLoading ? (
              <div aria-busy="true" aria-label="Loading billing" className="space-y-5">
                <div className="h-32 animate-pulse rounded-2xl" style={{ background: colors.muted }} />
                <div className="h-48 animate-pulse rounded-2xl" style={{ background: colors.muted }} />
              </div>
            ) : billingError ? (
              <SettingsCard>
                <p role="alert" className="text-sm" style={{ color: colors.destructive }}>{billingError}</p>
                <Button type="button" variant="outline" className="mt-4 h-11" onClick={() => router.reload()}>Try again</Button>
              </SettingsCard>
            ) : (
              <>
                <SettingsCard>
                  <SettingsSectionHeader
                    title="Your credits"
                    description="Image credits make posters and photos. Video credits make video ads."
                    action={<Button type="button" className="h-11 px-5" onClick={() => router.push("/buy-credits")}>Buy credits</Button>}
                  />
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {([
                      ["Image credits", creditBalance?.imageCredits?.total ?? 0, ImageIcon, "213 100% 55%", "213 100% 72%"],
                      ["Video credits", creditBalance?.videoCredits?.total ?? 0, Video, "270 80% 55%", "270 80% 74%"],
                    ] as const).map(([label, value, Icon, base, text]) => (
                      <div key={label} className="rounded-xl px-5 py-5" style={{ background: `hsl(${base} / 0.12)`, border: `1px solid hsl(${base} / 0.3)` }}>
                        <div className="mb-2 flex items-center gap-2" style={{ color: `hsl(${text})` }}>
                          <Icon size={16} aria-hidden />
                          <span className="text-sm font-semibold">{label}</span>
                        </div>
                        <p className="text-3xl font-bold tabular-nums" style={{ color: `hsl(${text})` }}>{value}</p>
                      </div>
                    ))}
                  </div>
                </SettingsCard>

                <SettingsCard>
                  <SettingsSectionHeader
                    title="Your plan"
                    description={subscription ? "Your monthly plan and when it renews." : "You're not on a monthly plan."}
                    action={<Button type="button" variant="outline" className="h-11 px-5" onClick={() => router.push(planAction.href)}>{subscription ? "Change plan" : planAction.label}</Button>}
                  />
                  <div className="rounded-xl px-5 py-4" style={{ background: colors.background, border: `1px solid ${colors.border}` }}>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-lg font-semibold" style={{ color: colors.foreground }}>{subscription?.plan?.name ?? "Pay as you go"}</span>
                      <span className="rounded-full px-2.5 py-1 text-xs font-semibold" style={planTone}>{planStatus}</span>
                    </div>

                    {subscription ? (
                      <>
                        <dl className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
                          {[
                            ["Billed", subscription.plan.billingCycle === "yearly" ? "Every year" : subscription.plan.billingCycle === "monthly" ? "Every month" : subscription.plan.billingCycle],
                            [subEnding ? "Ends on" : "Renews on", periodEnd || "—"],
                            ["Credits each cycle", `${subscription.plan.imageCredits ?? 0} image · ${subscription.plan.videoCredits ?? 0} video`],
                          ].map(([term, value]) => (
                            <div key={term}>
                              <dt className="text-xs" style={{ color: colors.mutedForeground }}>{term}</dt>
                              <dd className="mt-0.5 text-sm font-medium" style={{ color: colors.foreground }}>{value}</dd>
                            </div>
                          ))}
                        </dl>

                        {subEnding ? (
                          <p role="status" className="mt-4 rounded-lg px-3.5 py-3 text-sm leading-relaxed" style={{ background: "hsl(38 92% 50% / 0.1)", color: colors.foreground }}>
                            Your subscription is cancelled. You can keep using your plan and its credits
                            {periodEnd ? ` until ${periodEnd}` : " until the end of this billing period"}. After that it will not renew, no payment will be taken and no new credits will be added.
                          </p>
                        ) : (
                          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-4" style={{ borderColor: colors.border }}>
                            <p className="max-w-md text-sm" style={{ color: colors.mutedForeground }}>
                              You can cancel any time. Your plan stays active until the end of the period you have already paid for.
                            </p>
                            <Button type="button" variant="outline" disabled={cancelling} onClick={() => void handleCancelSubscription()} className="h-11 px-5"
                              style={{ borderColor: "hsl(0 72% 51% / 0.5)", color: "hsl(0 84% 70%)" }}>
                              {cancelling ? "Cancelling…" : "Cancel subscription"}
                            </Button>
                          </div>
                        )}
                      </>
                    ) : (
                      <p className="mt-2 text-sm" style={{ color: colors.mutedForeground }}>You buy credits when you need them. A monthly plan gives you more credits for less.</p>
                    )}
                  </div>
                  <p className="mt-4 text-xs" style={{ color: colors.mutedForeground }}>Payments are handled securely by Razorpay: cards, UPI and net banking.</p>
                </SettingsCard>

                <SettingsCard>
                  <SettingsSectionHeader title="Payment history" description="Your recent purchases and plan payments." />
                  {paymentHistory.length > 0 ? (
                    <ul className="-my-1 divide-y" style={{ borderColor: colors.border }}>
                      {paymentHistory.map((tx) => (
                        <li key={tx.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3.5" style={{ borderColor: colors.border }}>
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={{ background: colors.muted, color: colors.mutedForeground }}>
                            <Receipt size={16} aria-hidden />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium" style={{ color: colors.foreground }}>{transactionLabel(tx)}</p>
                            <p className="text-xs" style={{ color: colors.mutedForeground }}>{formatDate(tx.createdAt)}</p>
                          </div>
                          <p className="text-sm font-semibold tabular-nums" style={{ color: colors.foreground }}>{"₹"}{Number(tx.amount).toLocaleString("en-IN")}</p>
                          <PaymentStatusBadge status={tx.status} />
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm" style={{ color: colors.mutedForeground }}>No payments yet. They will show here after your first purchase.</p>
                  )}
                </SettingsCard>
              </>
            )
          )}

          {/* Connected accounts */}
          {tab === "integrations" && <MetaIntegrationCard />}

          {/* Security & legal */}
          {tab === "security" && (
            <>
              <SettingsCard>
                <SettingsSectionHeader title="Security" description="Keep your account safe." />
                <ActionRow Icon={KeyRound} title="Password" body="We'll email you a link to set a new password.">
                  <Button asChild type="button" variant="outline" className="h-11 px-5">
                    <Link href="/auth/forgot-password">Change password</Link>
                  </Button>
                </ActionRow>
              </SettingsCard>

              <SettingsCard>
                <SettingsSectionHeader title="Policies" description="How we handle your data, payments and refunds." />
                <ul className="grid gap-2 sm:grid-cols-2">
                  {POLICY_LINKS.map((item) => (
                    <li key={item.href}>
                      <Link href={item.href} className="settings-link flex min-h-[48px] items-center justify-between gap-3 rounded-xl px-4 py-3 transition-colors"
                        style={{ border: `1px solid ${colors.border}`, background: colors.background, color: colors.foreground }}>
                        <span className="flex min-w-0 items-center gap-2.5 text-sm font-medium">
                          <FileText size={15} aria-hidden style={{ color: colors.mutedForeground }} />
                          <span className="truncate">{item.label}</span>
                        </span>
                        <ChevronRight size={16} aria-hidden style={{ color: colors.mutedForeground }} />
                      </Link>
                    </li>
                  ))}
                </ul>
              </SettingsCard>

              <SettingsCard>
                <ActionRow
                  Icon={Trash2}
                  tone="danger"
                  title="Delete your account"
                  body={<>To remove your data or permanently delete your account, email us at <a href={`mailto:${SITE_SUPPORT_EMAIL}?subject=Delete%20Account&body=delete%20-%20[reason]`} className="font-medium underline" style={{ color: colors.primary }}>{SITE_SUPPORT_EMAIL}</a>. We&apos;ll confirm before anything is deleted.</>}
                />
              </SettingsCard>
            </>
          )}
        </div>
      </div>

      <div className="sr-only">
        <div ref={recaptchaContainerRef} id="recaptcha-container" />
      </div>
    </>
  );
}
