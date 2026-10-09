// pages/dashboard.tsx
"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import type { JSX } from "react";
import Sidebar from "../app/web/src/components/Sidebar";
import { Button } from "../app/web/src/components/ui/button";
import { Alert, AlertTitle, AlertDescription } from "../app/web/src/components/ui/alert";
import { ComingSoonOverlay } from "@/app/web/src/components/billing/ComingSoonOverlay";
import {
  IntegrationsConnectPanel,
  type IntegrationStatusMap,
} from "@/app/web/src/components/integrations/IntegrationsConnectPanel";
import { ContentCalendar } from "@/app/web/src/components/dashboard/ContentCalendar";
import { PerformanceChart, type PerformancePoint } from "@/app/web/src/components/dashboard/PerformanceChart";
import { authFetch } from "@/lib/utils";
import {
  Plus,
  DollarSign,
  MousePointerClick,
  Eye,
  Sparkles,
  AlertCircle,
  RefreshCw,
  ImageIcon,
  Megaphone,
  Target,
  Send,
} from "lucide-react";

import colors from "@/lib/ui/colors";
import { apiFetch } from "@/api/fetch";
import { supabase } from "@/auth/supabase/client";
import { campaignClient } from "@/database/client-helpers";
import { SkeletonPageLoader, SkeletonCampaignRow } from "@/app/web/src/components/ui/skeletons";
import {
  buildActivity,
  pipelineCounts,
  type ActivityItem,
  type CreativeActivityInput,
  type SocialActivityInput,
} from "@/lib/dashboard/activity";

function platformConnected(value: unknown): boolean {
  if (typeof value === "object" && value !== null && "connected" in (value as object)) {
    return !!(value as { connected?: boolean }).connected;
  }
  return !!value;
}

function hexToRgba(hex: string, alpha = 1) {
  try {
    const h = (hex || "").trim();
    if (!h) return hex;
    if (h.startsWith("rgba") || h.startsWith("rgb") || h.startsWith("hsl")) return h;
    const normalized = h.length === 4 ? "#" + h[1] + h[1] + h[2] + h[2] + h[3] + h[3] : h;
    const bigint = parseInt(normalized.slice(1), 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  } catch {
    return hex;
  }
}

const { primary, mutedForeground, primary20 } = (colors as any) || {};
const primaryColor = typeof primary === "string" ? primary : undefined;
const mutedFg = typeof mutedForeground === "string" ? mutedForeground : undefined;
const primaryBorder10 = typeof primary20 === "string" ? primary20 : primaryColor ? hexToRgba(primaryColor, 0.1) : undefined;

type MetaMetrics = {
  total_spend: number;
  total_reach: number;
  avg_ctr: number;
  conversions: number;
  roas: number | null;
  impressions?: number;
  clicks?: number;
  purchase_value?: number;
};

type SummaryResp = {
  ok?: boolean;
  source?: string;
  meta?: {
    current?: MetaMetrics | null;
    change?: Record<string, number | null>;
    time_series?: PerformancePoint[];
  };
  ranges?: { current?: { since?: string; until?: string } };
};

type Campaign = {
  id: string;
  name: string;
  campaign_type?: string | null;
  image_url?: any;
  is_published?: boolean;
  created_at?: string;
};

type Recommendation = {
  title?: string;
  impact?: "High" | "Medium" | "Low" | string;
  reason?: string;
  actions?: string[];
  estimate?: string;
};

const RANGE_OPTIONS = [
  { id: "7d", label: "Last 7 days" },
  { id: "30d", label: "Last 30 days" },
  { id: "90d", label: "Last 90 days" },
] as const;

function greeting(date = new Date()) {
  const hour = date.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function surfaceStyle(): React.CSSProperties {
  return {
    background: colors.gradientCard,
    border: `1px solid ${colors.border}`,
    boxShadow: colors.shadowSoft,
  };
}

export default function DashboardPage(): JSX.Element {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [featureAccess, setFeatureAccess] = useState<{ enabled: boolean; comingSoon: boolean } | null>(null);
  const [checkingFeature, setCheckingFeature] = useState(true);
  const [statuses, setStatuses] = useState<Record<string, any> | null>(null);
  const [metaHealth, setMetaHealth] = useState<{
    connected: boolean;
    healthStatus?: string;
    message?: string;
    needsReconnect?: boolean;
    tokenExpiresAt?: string | null;
  } | null>(null);
  const [metaSummary, setMetaSummary] = useState<SummaryResp | null>(null);
  const [series, setSeries] = useState<PerformancePoint[]>([]);
  const [loadingMeta, setLoadingMeta] = useState(false);
  const [metaError, setMetaError] = useState<string | null>(null);
  const [metricsRange, setMetricsRange] = useState<(typeof RANGE_OPTIONS)[number]["id"]>("7d");
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(true);
  const [activityItems, setActivityItems] = useState<ActivityItem[]>([]);
  const [creativeTotal, setCreativeTotal] = useState<number | null>(null);
  const [publishSampleSize, setPublishSampleSize] = useState(0);
  const [activityLoading, setActivityLoading] = useState(true);
  const [activityError, setActivityError] = useState<string | null>(null);
  const [autoRecs, setAutoRecs] = useState<Recommendation[]>([]);
  const [recLoading, setRecLoading] = useState(false);
  const [recError, setRecError] = useState<string | null>(null);
  const [recsRequested, setRecsRequested] = useState(false);

  const LS_KEY_FOR = (uid: string | null) => `integrations_status_v1:${uid ?? "anon"}`;
  const rangeLabel = RANGE_OPTIONS.find((option) => option.id === metricsRange)?.label ?? "Last 7 days";

  async function fetchStatuses(uid: string | null) {
    try {
      if (!uid) {
        setStatuses(null);
        return;
      }
      const userScopedApi = (path: string) => {
        const sep = path.includes("?") ? "&" : "?";
        return `${path}${sep}userId=${encodeURIComponent(uid)}`;
      };
      try {
        const res = await apiFetch(userScopedApi("/api/integrations/status"));
        if (res.ok) {
          const data = await res.json();
          const next: Record<string, boolean> = { meta: false };
          if (data && typeof data === "object") {
            Object.keys(data).forEach((k) => {
              next[k] = platformConnected(data[k]);
            });
          }
          setStatuses(next);
          try { localStorage.setItem(LS_KEY_FOR(uid), JSON.stringify(next)); } catch {}
          return;
        }
      } catch (err) {
        console.debug("user-scoped status fetch failed, falling back to local cache", err);
      }
      try {
        const raw = localStorage.getItem(LS_KEY_FOR(uid));
        if (raw) {
          setStatuses({ meta: false, ...(JSON.parse(raw) || {}) });
          return;
        }
      } catch (err) {
        console.debug("localStorage read failed:", err);
      }
      const initial: Record<string, boolean> = { meta: false };
      setStatuses(initial);
      try { localStorage.setItem(LS_KEY_FOR(uid), JSON.stringify(initial)); } catch {}
    } catch (err) {
      console.error("fetchStatuses error:", err);
      setStatuses({ meta: false });
    }
  }

  async function checkMetaHealth(uid: string | null) {
    try {
      if (!uid) {
        setMetaHealth(null);
        return;
      }
      const response = await apiFetch("/api/dashboard/health-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (response.ok) {
        const data = await response.json();
        setMetaHealth(data.meta || null);
      }
    } catch (err) {
      console.error("Meta health check error:", err);
    }
  }

  async function fetchMetaMetrics(uid: string | null, range: string) {
    setLoadingMeta(true);
    setMetaError(null);
    try {
      if (!uid) {
        setMetaSummary(null);
        setSeries([]);
        return;
      }
      let token: string | null = null;
      try {
        const { data } = await supabase.auth.getSession();
        token = (data as any)?.session?.access_token ?? null;
      } catch (e) {
        console.debug("supabase.getSession error (ignored):", e);
      }
      const headers: HeadersInit = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const q = new URLSearchParams();
      q.set("range", range);
      q.set("userId", uid);
      const resp = await fetch(`/api/integrations/metrics?${q.toString()}`, {
        method: "GET",
        headers,
        cache: "no-store",
        credentials: "same-origin",
      });
      if (!resp.ok) {
        setMetaError("Couldn't load ad metrics for this range.");
        return;
      }
      const j = (await resp.json()) as SummaryResp;
      setMetaSummary(j);
      const points = Array.isArray(j?.meta?.time_series) ? j.meta.time_series : [];
      setSeries(points.filter((point) => point && typeof point.date === "string"));
      const hasMeaningfulMetrics = Boolean(
        j?.meta?.current &&
          (j.meta.current.total_spend !== undefined || j.meta.current.total_reach !== undefined)
      );
      if (hasMeaningfulMetrics) {
        const normalized: Record<string, any> = { meta: true };
        try {
          const rawLs = localStorage.getItem(LS_KEY_FOR(uid));
          if (rawLs) Object.assign(normalized, JSON.parse(rawLs));
        } catch {}
        setStatuses(normalized);
        try { localStorage.setItem(LS_KEY_FOR(uid), JSON.stringify(normalized)); } catch {}
      }
    } catch (err) {
      console.error("fetchMetaMetrics error:", err);
      setMetaError("Couldn't load ad metrics for this range.");
    } finally {
      setLoadingMeta(false);
    }
  }

  async function fetchCampaigns(uid: string | null) {
    setLoadingCampaigns(true);
    try {
      if (!uid) {
        setCampaigns([]);
        return;
      }
      const result = await campaignClient.list();
      if (!result.success) {
        setCampaigns([]);
        return;
      }
      const normalized = (result.data || []).map((c: any) => ({
        id: c.id ?? (c.name || Math.random()).toString(),
        name: c.name ?? "Untitled",
        campaign_type: c.campaign_type ?? c.type ?? null,
        image_url: c.image_url ?? c.image_url_public ?? c.preview_url ?? null,
        is_published: !!c.is_published,
        created_at: c.created_at ?? undefined,
      })) as Campaign[];
      normalized.sort((a, b) => +new Date(b.created_at || 0) - +new Date(a.created_at || 0));
      setCampaigns(normalized);
    } catch (err) {
      console.error("fetchCampaigns exception:", err);
      setCampaigns([]);
    } finally {
      setLoadingCampaigns(false);
    }
  }

  async function fetchActivity() {
    setActivityLoading(true);
    setActivityError(null);
    try {
      const [postsRes, creativesRes] = await Promise.all([
        authFetch("/api/social/facebook/posts?limit=100"),
        authFetch("/api/generated-contents/list?limit=100"),
      ]);
      if (!postsRes.ok || !creativesRes.ok) {
        setActivityError("Couldn't load publishing activity.");
        return;
      }
      const postsJson = await postsRes.json();
      const creativesJson = await creativesRes.json();
      const posts = (Array.isArray(postsJson?.posts) ? postsJson.posts : []) as SocialActivityInput[];
      const creatives = (Array.isArray(creativesJson?.items) ? creativesJson.items : []) as CreativeActivityInput[];
      setActivityItems(buildActivity(posts, creatives));
      setCreativeTotal(typeof creativesJson?.total === "number" ? creativesJson.total : creatives.length);
      setPublishSampleSize(posts.length);
    } catch (err) {
      console.error("fetchActivity error:", err);
      setActivityError("Couldn't load publishing activity.");
    } finally {
      setActivityLoading(false);
    }
  }

  function buildDynamicCandidates(summary: SummaryResp | null, campaignsList: Campaign[]) {
    const meta = summary?.meta?.current ?? null;
    const change = summary?.meta?.change ?? null;
    const candidates: Array<{ r: Recommendation; score: number }> = [];

    if (meta) {
      candidates.push({
        r: {
          title: "Reallocate budget to improve ROAS",
          impact: (meta.roas ?? 0) < 2 ? "High" : "Medium",
          reason: `ROAS for this range is ${(meta.roas ?? 0).toFixed(2)}x. Shift spend toward the better performers.`,
          actions: ["Move budget to top ad sets", "Pause low-ROAS creatives"],
          estimate: "Based on the synced account totals",
        },
        score: (meta.roas ?? 0) < 2 ? 8 : 4,
      });
      candidates.push({
        r: {
          title: "Improve CTR with creative experiments",
          impact: (meta.avg_ctr ?? 0) < 2 ? "High" : "Medium",
          reason: `Average CTR is ${(meta.avg_ctr ?? 0).toFixed(2)}% for this range.`,
          actions: ["Test new primary text", "Swap thumbnails and headlines"],
          estimate: "Based on the synced account totals",
        },
        score: (meta.avg_ctr ?? 0) < 1 ? 7 : (meta.avg_ctr ?? 0) < 2 ? 4 : 1,
      });
      candidates.push({
        r: {
          title: "Review conversion tracking",
          impact: (meta.total_spend ?? 0) > 1000 && (meta.conversions ?? 0) < 20 ? "High" : "Medium",
          reason: `Spent ${fmtMoney(meta.total_spend)} with ${meta.conversions ?? 0} conversions in this range.`,
          actions: ["Check pixel and server events", "Review the landing page"],
          estimate: "Based on the synced account totals",
        },
        score: (meta.total_spend ?? 0) > 1000 && (meta.conversions ?? 0) < 20 ? 9 : 3,
      });
      if (change && typeof change.roas_pct === "number" && change.roas_pct < 0) {
        candidates.push({
          r: {
            title: "ROAS is down versus the previous period",
            impact: "High",
            reason: `ROAS changed ${pctDisplay(change.roas_pct)} compared with the previous window.`,
            actions: ["Compare recent creative and audience changes"],
            estimate: "Based on the synced comparison window",
          },
          score: 6,
        });
      }
    }

    if (campaignsList.length < 3) {
      candidates.push({
        r: {
          title: "Add another campaign test",
          impact: "Medium",
          reason: `This workspace has ${campaignsList.length} campaign${campaignsList.length === 1 ? "" : "s"}.`,
          actions: ["Create a campaign from Brand Studio or Ad Studio"],
          estimate: "Uses your saved campaigns",
        },
        score: 5,
      });
    }

    const unique: Record<string, { r: Recommendation; score: number }> = {};
    for (const candidate of candidates) {
      const key = (candidate.r.title ?? "").trim();
      if (!key) continue;
      if (!unique[key] || candidate.score > unique[key].score) unique[key] = candidate;
    }
    return Object.values(unique).sort((a, b) => b.score - a.score).map((entry) => entry.r);
  }

  async function handleGetRecommendations() {
    setRecLoading(true);
    setRecError(null);
    setRecsRequested(true);
    const metaCurrentNow = metaSummary?.meta?.current ?? null;
    const isConnectedNow = Boolean(
      (statuses && statuses.meta === true) ||
        (metaCurrentNow && (metaCurrentNow.total_spend !== undefined || metaCurrentNow.total_reach !== undefined))
    );
    if (!isConnectedNow) {
      setRecError("Connect Meta before generating recommendations.");
      setAutoRecs([]);
      setRecLoading(false);
      return;
    }
    try {
      let token: string | null = null;
      try {
        const { data } = await supabase.auth.getSession();
        token = (data as any)?.session?.access_token ?? null;
      } catch {
        token = null;
      }
      if (!token) {
        setRecError("Not signed in.");
        setRecLoading(false);
        return;
      }
      const resp = await fetch("/api/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ metrics: metaSummary?.meta ?? null, range: metricsRange }),
      });
      if (!resp.ok) {
        const chosen = buildDynamicCandidates(metaSummary, campaigns).slice(0, 3);
        setAutoRecs(chosen);
        setRecError(chosen.length ? "Showing suggestions from the metrics already loaded." : "Couldn't generate recommendations.");
        return;
      }
      const j = await resp.json();
      const recs = Array.isArray(j.recommendations) ? j.recommendations : [];
      const normalized: Recommendation[] = recs.slice(0, 3).map((r: any) => ({
        title: r.title ?? r.name ?? "Recommendation",
        reason: r.reason ?? undefined,
        impact: r.impact ?? undefined,
        actions: r.actions ?? undefined,
        estimate: r.estimate ?? undefined,
      }));
      if (normalized.length === 0) {
        setAutoRecs(buildDynamicCandidates(metaSummary, campaigns).slice(0, 3));
      } else {
        setAutoRecs(normalized);
      }
    } catch (err) {
      console.error("handleGetRecommendations error:", err);
      const chosen = buildDynamicCandidates(metaSummary, campaigns).slice(0, 3);
      setAutoRecs(chosen);
      setRecError(chosen.length ? "Showing suggestions from the metrics already loaded." : "Couldn't generate recommendations.");
    } finally {
      setRecLoading(false);
    }
  }

  useEffect(() => {
    (async () => {
      try {
        try {
          const response = await authFetch("/api/features/access");
          const data = await response.json();
          if (data.success && data.features) {
            setFeatureAccess(data.features.dashboard || { enabled: false, comingSoon: true });
          }
        } catch (err) {
          console.error("Failed to check feature access:", err);
          setFeatureAccess({ enabled: false, comingSoon: true });
        } finally {
          setCheckingFeature(false);
        }

        const { data: userData, error: userErr } = await supabase.auth.getUser();
        if (userErr || !(userData as any)?.user) {
          router.push("/auth/signin");
          return;
        }
        const user = (userData as any).user;
        setUserId(user.id);
        const rawName = user.user_metadata?.full_name || user.user_metadata?.name || user.email || "";
        const first = String(rawName).split("@")[0].split(" ")[0];
        setDisplayName(first || null);
        await Promise.all([
          fetchStatuses(user.id),
          fetchCampaigns(user.id),
          checkMetaHealth(user.id),
          fetchActivity(),
        ]);
      } catch (err) {
        console.error("init dashboard error:", err);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!userId) return;
    fetchMetaMetrics(userId, metricsRange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, metricsRange]);

  function fmtMoney(n: number | null | undefined) {
    if (n == null || Number.isNaN(Number(n))) return "—";
    try {
      return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Number(n));
    } catch {
      return `₹${Number(n).toFixed(0)}`;
    }
  }
  function pctDisplay(n: number | null | undefined) {
    if (n == null || Number.isNaN(Number(n))) return null;
    const rounded = Math.round(Number(n) * 10) / 10;
    return `${rounded > 0 ? "+" : ""}${rounded}%`;
  }
  function fmtCount(n: number | null | undefined) {
    if (n == null || Number.isNaN(Number(n))) return "—";
    return Number(n).toLocaleString();
  }

  const metaCurrent = metaSummary?.meta?.current ?? null;
  const metaChange = metaSummary?.meta?.change ?? null;
  const isConnected = Boolean(
    (statuses && platformConnected(statuses.meta)) ||
      (metaCurrent && (metaCurrent.total_spend !== undefined || metaCurrent.total_reach !== undefined))
  );
  const pipeline = pipelineCounts(activityItems, campaigns);
  const publishedPosts = activityItems.filter((item) => item.status === "published" && item.kind === "post").length;

  function refreshAll() {
    if (!userId) return;
    fetchStatuses(userId);
    fetchMetaMetrics(userId, metricsRange);
    fetchCampaigns(userId);
    checkMetaHealth(userId);
    fetchActivity();
  }

  function handleIntegrationStatusesChange(next: IntegrationStatusMap) {
    const normalized: Record<string, boolean> = {};
    Object.keys(next).forEach((k) => {
      normalized[k] = platformConnected(next[k]);
    });
    setStatuses(normalized);
    if (userId) {
      try { localStorage.setItem(LS_KEY_FOR(userId), JSON.stringify(normalized)); } catch {}
      if (normalized.meta) {
        fetchMetaMetrics(userId, metricsRange);
        checkMetaHealth(userId);
      }
    }
  }

  const getCampaignImageUrl = (c: Campaign) => {
    if (!c?.image_url) return null;
    if (Array.isArray(c.image_url)) return c.image_url.length ? c.image_url[0] : null;
    return String(c.image_url);
  };

  if (checkingFeature) {
    return (
      <div className="min-h-screen flex app-page">
        <Sidebar />
        <main className="flex min-w-0 flex-1 items-center justify-center p-6">
          <SkeletonPageLoader variant="dashboard" />
        </main>
      </div>
    );
  }

  if (!featureAccess?.enabled || featureAccess?.comingSoon) {
    return (
      <div className="min-h-screen flex app-page">
        <Sidebar />
        <main className="relative min-w-0 flex-1">
          <ComingSoonOverlay featureKey="dashboard">
            <div className="p-6 sm:p-8">
              <h1 className="text-2xl font-semibold" style={{ color: colors.foreground }}>Dashboard</h1>
              <p className="mt-1 text-sm" style={mutedFg ? { color: mutedFg } : undefined}>Workspace overview</p>
            </div>
          </ComingSoonOverlay>
        </main>
      </div>
    );
  }

  const adsReady = isConnected && metaCurrent;
  const kpis: Array<{
    label: string;
    value: string;
    hint: string;
    trend: string | null;
    trendIntent?: "up-good";
    icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  }> = [
    {
      label: "Campaigns",
      value: loadingCampaigns ? "…" : String(campaigns.length),
      hint: "Saved in this workspace",
      trend: null,
      icon: Megaphone,
    },
    {
      label: "Creatives",
      value: activityLoading ? "…" : creativeTotal == null ? "—" : String(creativeTotal),
      hint: "Generated contents",
      trend: null,
      icon: ImageIcon,
    },
    {
      label: "Published posts",
      value: activityLoading ? "…" : String(publishedPosts),
      hint: publishSampleSize >= 100 ? "Within the latest 100 posts" : "Facebook publish history",
      trend: null,
      icon: Send,
    },
    {
      label: "Spend",
      value: !isConnected ? "—" : loadingMeta ? "…" : adsReady ? fmtMoney(metaCurrent.total_spend) : "—",
      hint: isConnected ? rangeLabel : "Connect Meta to load spend",
      trend: isConnected ? pctDisplay(metaChange?.total_spend_pct) : null,
      icon: DollarSign,
    },
    {
      label: "Reach",
      value: !isConnected ? "—" : loadingMeta ? "…" : adsReady ? fmtCount(metaCurrent.total_reach) : "—",
      hint: isConnected ? rangeLabel : "Connect Meta to load reach",
      trend: isConnected ? pctDisplay(metaChange?.total_reach_pct) : null,
      icon: Eye,
    },
    {
      label: "CTR",
      value: !isConnected ? "—" : loadingMeta ? "…" : adsReady ? `${(metaCurrent.avg_ctr ?? 0).toFixed(2)}%` : "—",
      hint: isConnected ? rangeLabel : "Connect Meta to load CTR",
      trend: isConnected ? pctDisplay(metaChange?.avg_ctr_pct) : null,
      trendIntent: "up-good",
      icon: MousePointerClick,
    },
    {
      label: "Conversions",
      value: !isConnected ? "—" : loadingMeta ? "…" : adsReady ? fmtCount(metaCurrent.conversions) : "—",
      hint: isConnected ? rangeLabel : "Connect Meta to load conversions",
      trend: isConnected ? pctDisplay(metaChange?.conversions_pct) : null,
      trendIntent: "up-good",
      icon: Target,
    },
    {
      label: "ROAS",
      value: !isConnected ? "—" : loadingMeta ? "…" : adsReady && metaCurrent.roas != null ? `${metaCurrent.roas.toFixed(2)}x` : "—",
      hint: isConnected ? (adsReady && metaCurrent.roas == null ? "No conversion value in this range" : rangeLabel) : "Connect Meta to load ROAS",
      trend: isConnected ? pctDisplay(metaChange?.roas_pct) : null,
      trendIntent: "up-good",
      icon: Sparkles,
    },
  ];

  return (
    <div className="min-h-screen flex app-page">
      <Sidebar />
      <main className="min-w-0 flex-1 overflow-x-hidden">
        <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8">
          <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold tracking-tight" style={{ color: colors.foreground }}>
                {greeting()}{displayName ? `, ${displayName}` : ""}
              </h1>
              <p className="mt-1 text-sm" style={{ color: colors.mutedForeground }}>
                Campaigns, creatives, and publishing for this workspace.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="sr-only" htmlFor="metrics-range">Metrics range</label>
              <select
                id="metrics-range"
                className="skx-focus h-10 rounded-lg px-3 text-sm"
                style={{ background: colors.card, color: colors.foreground, border: `1px solid ${colors.border}` }}
                value={metricsRange}
                onChange={(event) => setMetricsRange(event.target.value as (typeof RANGE_OPTIONS)[number]["id"])}
              >
                {RANGE_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>{option.label}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={refreshAll}
                className="skx-focus inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm"
                style={{ background: colors.card, color: colors.foreground, border: `1px solid ${colors.border}` }}
              >
                <RefreshCw size={15} />
                Refresh
              </button>
              <Link
                href="/create-campaign"
                className="skx-focus inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-medium"
                style={{ background: colors.gradientPrimary, color: colors.primaryForeground, boxShadow: colors.shadowGlow }}
              >
                <Plus size={16} />
                Create campaign
              </Link>
            </div>
          </header>

          {metaHealth?.needsReconnect ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Meta connection issue</AlertTitle>
              <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <span>{metaHealth.message || "Your Facebook connection needs to be refreshed."}</span>
                <Link href="/integrations" className="skx-focus inline-flex rounded-lg px-3 py-1.5 text-sm font-medium" style={{ background: colors.primary, color: colors.primaryForeground }}>
                  Reconnect
                </Link>
              </AlertDescription>
            </Alert>
          ) : null}

          {metaError ? (
            <p className="text-sm" role="alert" style={{ color: colors.destructive }}>{metaError}</p>
          ) : null}

          <section className="grid grid-cols-2 gap-3 xl:grid-cols-4" aria-label="Workspace metrics">
            {kpis.map((kpi) => {
              const Icon = kpi.icon;
              const trendColor = kpi.trend && kpi.trendIntent === "up-good"
                ? kpi.trend.startsWith("-") ? colors.destructive : kpi.trend.startsWith("+") ? colors.green600 : colors.mutedForeground
                : colors.mutedForeground;
              return (
                <article key={kpi.label} className="rounded-2xl p-4" style={surfaceStyle()}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs" style={{ color: colors.mutedForeground }}>{kpi.label}</p>
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: colors.accent, color: colors.primary }}>
                      <Icon size={16} strokeWidth={1.75} />
                    </span>
                  </div>
                  <p className="mt-3 text-2xl font-semibold tracking-tight" style={{ color: colors.foreground }}>{kpi.value}</p>
                  <p className="mt-1 text-[11px]" style={{ color: colors.mutedForeground }}>{kpi.hint}</p>
                  {kpi.trend ? (
                    <p className="mt-2 text-[11px] font-medium" style={{ color: trendColor }}>{kpi.trend} vs previous period</p>
                  ) : null}
                </article>
              );
            })}
          </section>

          {!isConnected ? (
            <IntegrationsConnectPanel
              showHeader
              showFooter
              requireAuth={false}
              oauthRedirectPath="/dashboard"
              onStatusesChange={handleIntegrationStatusesChange}
            />
          ) : null}

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
            <div className="min-w-0 xl:col-span-8">
              <ContentCalendar
                items={activityItems}
                loading={activityLoading}
                error={activityError}
                onRetry={fetchActivity}
              />
            </div>
            <div className="flex min-w-0 flex-col gap-4 xl:col-span-4">
              <PerformanceChart
                points={series}
                loading={loadingMeta}
                connected={isConnected}
                error={metaError}
                rangeLabel={rangeLabel}
              />
              <section className="rounded-2xl p-4" style={{ ...surfaceStyle(), borderColor: primaryBorder10 ?? colors.border }} aria-labelledby="recommendations-heading">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 id="recommendations-heading" className="flex items-center gap-2 text-sm font-semibold" style={{ color: colors.foreground }}>
                      <Sparkles size={15} />
                      Recommendations
                    </h2>
                    <p className="mt-0.5 text-xs" style={{ color: colors.mutedForeground }}>
                      Generated from your ad metrics when you ask for them.
                    </p>
                  </div>
                  {recsRequested ? (
                    <Button size="sm" onClick={handleGetRecommendations} disabled={recLoading}>
                      {recLoading ? "Thinking…" : "Refresh"}
                    </Button>
                  ) : null}
                </div>
                {!recsRequested ? (
                  <div className="mt-4">
                    <p className="text-sm leading-relaxed" style={{ color: colors.mutedForeground }}>
                      {isConnected
                        ? "Ask for a short list based on the metrics loaded for this range."
                        : "Connect Meta to generate recommendations from account metrics. Campaign and creative work stays available without it."}
                    </p>
                    <div className="mt-3">
                      {isConnected ? (
                        <Button size="sm" onClick={handleGetRecommendations} disabled={recLoading}>
                          {recLoading ? "Thinking…" : "Get recommendations"}
                        </Button>
                      ) : (
                        <Link href="/integrations" className="skx-focus text-sm font-medium" style={{ color: colors.primary }}>
                          Go to Integrations
                        </Link>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 space-y-3">
                    {recError ? (
                      <p className="rounded-lg px-3 py-2 text-xs" style={{ background: colors.secondary, color: colors.foreground }} role="status">
                        {recError}
                      </p>
                    ) : null}
                    {autoRecs.length === 0 && !recLoading ? (
                      <p className="text-sm" style={{ color: colors.mutedForeground }}>No recommendations were returned.</p>
                    ) : null}
                    {autoRecs.map((rec, index) => (
                      <article key={`${rec.title}-${index}`} className="rounded-xl p-3" style={{ background: colors.background, border: `1px solid ${colors.border}` }}>
                        <div className="flex items-start justify-between gap-3">
                          <h3 className="text-sm font-medium" style={{ color: colors.foreground }}>{rec.title}</h3>
                          {rec.impact ? (
                            <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ background: colors.accent, color: colors.accentForeground }}>
                              {rec.impact}
                            </span>
                          ) : null}
                        </div>
                        {rec.reason ? <p className="mt-1 text-xs leading-relaxed" style={{ color: colors.mutedForeground }}>{rec.reason}</p> : null}
                        {rec.actions?.length ? (
                          <ul className="mt-2 space-y-1 text-xs" style={{ color: colors.foreground }}>
                            {rec.actions.map((action) => <li key={action}>{action}</li>)}
                          </ul>
                        ) : null}
                      </article>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
            <section className="rounded-2xl p-4 lg:col-span-7" style={surfaceStyle()} aria-labelledby="recent-campaigns-heading">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 id="recent-campaigns-heading" className="text-sm font-semibold" style={{ color: colors.foreground }}>Recent campaigns</h2>
                <Link href="/library" className="skx-focus text-xs font-medium" style={{ color: colors.primary }}>Campaign Library</Link>
              </div>
              {loadingCampaigns ? (
                <div className="space-y-2">
                  <SkeletonCampaignRow />
                  <SkeletonCampaignRow />
                </div>
              ) : campaigns.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-sm" style={{ color: colors.foreground }}>No campaigns yet.</p>
                  <Link href="/create-campaign" className="skx-focus mt-2 inline-flex text-sm font-medium" style={{ color: colors.primary }}>
                    Create the first campaign
                  </Link>
                </div>
              ) : (
                <ul className="space-y-2">
                  {campaigns.slice(0, 5).map((campaign) => {
                    const image = getCampaignImageUrl(campaign);
                    return (
                      <li key={campaign.id} className="flex items-center justify-between gap-3 rounded-xl p-2" style={{ background: colors.background }}>
                        <div className="flex min-w-0 items-center gap-3">
                          {image ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={image} alt="" className="h-12 w-16 rounded-md object-cover" />
                          ) : (
                            <div className="flex h-12 w-16 items-center justify-center rounded-md text-[10px]" style={{ background: colors.secondary, color: colors.mutedForeground }}>
                              No image
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium" style={{ color: colors.foreground }}>{campaign.name}</p>
                            <p className="text-xs" style={{ color: colors.mutedForeground }}>{campaign.campaign_type || "General"}</p>
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <span
                            className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                            style={{
                              background: campaign.is_published ? colors.green100 : colors.secondary,
                              color: campaign.is_published ? colors.green600 : colors.mutedForeground,
                            }}
                          >
                            {campaign.is_published ? "Published" : "Draft"}
                          </span>
                          {image ? (
                            <a href={image} target="_blank" rel="noopener noreferrer" className="skx-focus text-xs" style={{ color: colors.primary }}>View</a>
                          ) : (
                            <Link href="/library" className="skx-focus text-xs" style={{ color: colors.primary }}>Open</Link>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <section className="rounded-2xl p-4 lg:col-span-5" style={surfaceStyle()} aria-labelledby="pipeline-heading">
              <h2 id="pipeline-heading" className="text-sm font-semibold" style={{ color: colors.foreground }}>Workspace pipeline</h2>
              <p className="mt-0.5 text-xs" style={{ color: colors.mutedForeground }}>
                Counts from saved campaigns and the publishing history loaded on this page.
              </p>
              <dl className="mt-4 grid grid-cols-2 gap-2">
                {[
                  ["Campaign drafts", pipeline.campaignDrafts],
                  ["Campaigns published", pipeline.campaignPublished],
                  ["Unpublished creatives", pipeline.unpublished],
                  ["Post drafts", pipeline.drafts],
                  ["Publishing", pipeline.publishing],
                  ["Posts published", pipeline.published],
                  ["Posts failed", pipeline.failed],
                ].map(([label, value]) => (
                  <div key={String(label)} className="rounded-xl px-3 py-2" style={{ background: colors.background }}>
                    <dt className="text-[11px]" style={{ color: colors.mutedForeground }}>{label}</dt>
                    <dd className="mt-1 text-lg font-semibold" style={{ color: colors.foreground }}>{value}</dd>
                  </div>
                ))}
              </dl>
              {campaigns.length === 0 && activityItems.length === 0 && !loadingCampaigns && !activityLoading ? (
                <p className="mt-3 text-xs" style={{ color: colors.mutedForeground }}>
                  Create a campaign or generate a creative to start filling this pipeline.
                </p>
              ) : null}
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
