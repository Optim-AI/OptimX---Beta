// pages/analytics.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import type { JSX } from "react";
import Sidebar from "../app/web/src/components/Sidebar";
import { apiFetch } from '@/api/fetch';
import { supabase } from '@/auth/supabase/client';
import { ComingSoonOverlay } from '@/app/web/src/components/billing/ComingSoonOverlay';
import { authFetch } from '@/lib/utils';
import type { AdsAnalyticsAvailability } from '@/lib/ads/analytics/availability';
import {
  availabilityBanner,
  availabilityFromPayload,
  buildOverviewCards,
} from '@/lib/ads/analytics/ui-state';
import { formatMoneyAmount } from '@/lib/ads/analytics/currency';
import { isFeatureEntitled } from '@/lib/features/access';

import { Card, CardContent, CardHeader, CardTitle } from "../app/web/src/components/ui/card";
import { Button } from "../app/web/src/components/ui/button";

import { BarChart3 } from "lucide-react";
import colors from '@/lib/ui/colors';
import { SkeletonPageLoader, SkeletonMetricGrid, SkeletonCard, SkeletonRecommendationCard } from '@/app/web/src/components/ui/skeletons';

import {
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
  ReferenceLine,
} from "recharts";

/* ---------------- TYPE DEFINITIONS ---------------- */

type MetaMetrics = {
  total_spend: number | null;
  budget_estimate_daily: number | null;
  total_reach: number | null;
  avg_ctr: number | null;
  conversions: number | null;
  roas: number | null;
  impressions?: number | null;
  clicks?: number | null;
  currency?: string | null;
  mixed_currency?: boolean;
  spend_by_currency?: Record<string, number>;
};

type TimeSeriesPoint = {
  date: string;
  impressions?: number;
  clicks?: number;
  spend?: number;
  ctr?: number | null;
  conversions?: number;
  roas?: number | null;
};

type SummaryResp = {
  ok: boolean;
  source?: string;
  availability?: AdsAnalyticsAvailability;
  meta?: {
    current?: MetaMetrics | null;
    change?: Record<string, number | null> | null;
    time_series?: TimeSeriesPoint[];
  };
  [k: string]: any;
};

type Recommendation = {
  id?: string;
  title?: string;
  impact?: "High" | "Medium" | "Low" | string;
  reason?: string;
  actions?: string[];
  estimate?: string;
  campaignId?: string;
  resolved?: boolean;
  confidence?: number;
  effort?: string;
};

type Campaign = {
  id: string;
  name: string;
  campaign_type?: string | null;
  image_url?: any;
  is_published?: boolean;
  created_at?: string | null;
  spend?: number | string;
  roas?: string;
  ctr?: string;
  impressions?: string | number;
  platform?: string;
  conversions?: number;
  budget?: number | string;
  _raw?: any;
};

const LS_KEY = "integrations_status_v1";

/* -------------------- helpers -------------------- */

/** Format spend using the account/metric currency — never assume INR. */
function fmtMoney(
  n: number | null | undefined,
  currency?: string | null
) {
  return formatMoneyAmount(n, currency);
}

function pctDisplay(n: number | null | undefined) {
  if (n == null) return "—";
  const r = Math.round((n as number) * 10) / 10;
  const sign = r > 0 ? "+" : "";
  return `${sign}${r}%`;
}

function normalizeRec(x: any): Recommendation {
  if (!x) return {} as Recommendation;
  const id = x.id ?? (Math.random() + "").slice(2);
  const title = x.title ?? x.heading ?? x.name ?? (typeof x === "string" ? x : undefined);
  const impact = x.impact ?? x.level ?? x.priority;
  let actions: string[] = [];
  if (Array.isArray(x.actions)) actions = x.actions;
  else if (typeof x.actions === "string") {
    actions = x.actions
      .split(/\n+/)
      .map((s: string) => s.replace(/^[\-\d\.\)\s]+/, "").trim())
      .filter(Boolean);
  }
  const estimate = x.estimate ?? x.estimate_uplift ?? x.uplift;
  const campaignId = x.related_to?.id ?? x.campaignId ?? x.campaign_id ?? x.c;
  const confidence = x.confidence ?? x.conf ?? undefined;
  const effort = x.effort ?? x.estimated_effort ?? undefined;
  return { id, title, impact, reason: x.reason, actions, estimate, campaignId, resolved: false, confidence, effort };
}

/* -------------------- component -------------------- */

export default function Analytics(): JSX.Element {
  const [statuses, setStatuses] = useState<Record<string, any> | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);

  const [metaSummary, setMetaSummary] = useState<SummaryResp | null>(null);
  const [metricsError, setMetricsError] = useState<string | null>(null);
  const [loadingMeta, setLoadingMeta] = useState(false);

  // Feature access checking
  const [featureAccess, setFeatureAccess] = useState<{ enabled: boolean; comingSoon: boolean } | null>(null);
  const [checkingFeature, setCheckingFeature] = useState(true);

  const [recList, setRecList] = useState<Recommendation[]>([]);
  const [recLoading, setRecLoading] = useState(false);
  const [recsRequested, setRecsRequested] = useState(false);
  const [recError, setRecError] = useState<string | null>(null);

  const ranges = ["1d", "7d", "15d", "1m", "3m", "6m", "1y", "custom"] as const;
  const [selectedRange, setSelectedRange] = useState<typeof ranges[number]>("7d");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campaignsLoading, setCampaignsLoading] = useState(true);
  const [query, setQuery] = useState("");

  const [series, setSeries] = useState<TimeSeriesPoint[]>([]);

  useEffect(() => {
    // Check feature access first
    async function checkFeature() {
      try {
        const response = await authFetch('/api/features/access');
        const data = await response.json();
        if (data.success && data.features) {
          const analyticsAccess = data.features['basic_analytics'];
          setFeatureAccess(analyticsAccess || { enabled: false, comingSoon: true });
        }
      } catch (err) {
        console.error('Failed to check feature access:', err);
        setFeatureAccess({ enabled: false, comingSoon: true });
      } finally {
        setCheckingFeature(false);
      }
    }

    checkFeature();
    fetchCampaigns();
    fetchStatuses().then(() => fetchMetrics({ range: selectedRange }));

    function onStorage(e: StorageEvent) {
      if (e.key === LS_KEY) {
        try {
          setStatuses(e.newValue ? JSON.parse(e.newValue) : null);
        } catch {}
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* -------------------- campaigns (dashboard-style multi-column lookup) -------------------- */
  async function fetchCampaigns() {
    setCampaignsLoading(true);
    try {
      // grab current user id
      const { data: sessionData } = await supabase.auth.getSession();
      const user = (sessionData as any)?.session?.user ?? null;
      if (!user || !user.id) {
        setCampaigns([]);
        setCampaignsLoading(false);
        return;
      }
      const uid = user.id;

      // helper: query campaigns by column
      async function queryByColumn(column: string) {
        try {
          const { data, error } = await supabase
            .from("campaigns")
            .select("*")
            .eq(column, uid)
            .order("created_at", { ascending: false })
            .limit(200);

          if (error) {
            console.debug(`campaigns query by ${column} error:`, (error as any).message || error);
            return null;
          }
          return data as any[] | null;
        } catch (err) {
          console.debug(`campaigns query by ${column} failed:`, err);
          return null;
        }
      }

      const candidateColumns = ["user_id", "created_by", "owner", "profile_id", "author_id"];
      let rows: any[] | null = null;
      for (const col of candidateColumns) {
        rows = await queryByColumn(col);
        if (rows && rows.length > 0) break;
      }

      if (!rows || rows.length === 0) {
        setCampaigns([]);
        return;
      }

      const normalized = (rows || []).map((c) => ({
        id: c.id ?? (c.name || Math.random()).toString(),
        name: c.name ?? "Untitled",
        campaign_type: c.campaign_type ?? c.type ?? null,
        image_url: c.image_url ?? c.image_url_public ?? c.preview_url ?? null,
        is_published: !!c.is_published,
        created_at: c.created_at ?? undefined,
        spend: c.spend_inr ?? c.spend ?? undefined,
        roas: c.roas ?? undefined,
        ctr: c.ctr ?? undefined,
        impressions: c.impressions ?? undefined,
        platform: c.platform ?? c.source ?? (c.campaign_type ?? "Meta"),
        conversions: c.conversions ?? 0,
        budget: c.budget_inr ?? c.budget ?? undefined,
        _raw: c,
      })) as Campaign[];

      // match dashboard behaviour: only show top 5
      setCampaigns(normalized.slice(0, 5));
    } catch (err) {
      console.error("fetchCampaigns unexpected error:", err);
      setCampaigns([]);
    } finally {
      setCampaignsLoading(false);
    }
  }

  async function fetchStatuses() {
    setStatusLoading(true);
    try {
      const res = await apiFetch("/api/integrations/status");
      if (res.ok) {
        const j = await res.json();
        setStatuses(j);
        localStorage.setItem(LS_KEY, JSON.stringify(j));
      } else {
        setStatuses(null);
      }
    } catch (e) {
      setStatuses(null);
    } finally {
      setStatusLoading(false);
    }
  }

  function isMetaConnectedLocal(s?: Record<string, any> | null) {
    const st = s ?? statuses;
    if (!st) return false;
    if (st.meta === true) return true;
    if (typeof st.meta === "object" && (st.meta.connected === true || st.meta === true))
      return true;
    for (const [k, v] of Object.entries(st)) {
      const low = k.toLowerCase();
      if (low.includes("meta") || low.includes("facebook") || low.includes("instagram")) {
        if (v === true) return true;
        if (typeof v === "object" && (v.connected === true || v === true)) return true;
        if (typeof v === "string" && v === "true") return true;
      }
    }
    return false;
  }

  // fetchMetrics accepts explicit options so clicks update immediately
  async function fetchMetrics(opts?: { range?: string; start?: string; end?: string }) {
    // If not connected, do NOT fetch, do NOT invent zeros.
    if (!isMetaConnectedLocal()) {
      setMetaSummary(null);
      setMetricsError(null);
      setSeries([]);
      setLoadingMeta(false);
      return;
    }

    setLoadingMeta(true);
    setMetricsError(null);
    let token: string | null = null;

    try {
      const { data } = await supabase.auth.getSession();
      token = (data as any)?.session?.access_token ?? null;
    } catch {}

    try {
      const headers: any = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const query = new URLSearchParams();

      if (opts?.start && opts?.end) {
        query.set("start", opts.start);
        query.set("end", opts.end);
      } else {
        const r = opts?.range ?? selectedRange;
        query.set("range", r === "custom" ? "7d" : r);
      }

      const resp = await fetch(`/api/integrations/metrics?${query.toString()}`, {
        headers,
      });

      if (resp.ok) {
        const j = await resp.json();
        setMetaSummary(j);
        hydrateUiFromMeta(j);
        setMetricsError(null);
      } else {
        // HTTP failure → error state, never fabricate $0 performance
        setMetaSummary(null);
        setSeries([]);
        setMetricsError(
          `Could not load metrics (${resp.status}). Try again or re-sync Ads.`
        );
      }
    } catch (e: any) {
      console.error("fetchMetrics error", e);
      setMetaSummary(null);
      setSeries([]);
      setMetricsError(e?.message || "Could not load metrics. Check your connection and try again.");
    } finally {
      setLoadingMeta(false);
    }
  }

  function safeNum(v: any, fallback = 0) {
    if (v == null || v === "") return fallback;
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }

  function hydrateUiFromMeta(summary: SummaryResp | null) {
    // Only plot dates that the API returned — never invent zero-filled or synthetic series.
    if (!summary || !summary.meta) {
      setSeries([]);
      return;
    }

    const ts = summary.meta.time_series || (summary as any).time_series;
    if (ts && ts.length > 0) {
      const ordered = ts.map((p: any) => ({
        date: new Date(p.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
        impressions: p.impressions != null ? safeNum(p.impressions) : undefined,
        clicks: p.clicks != null ? safeNum(p.clicks) : undefined,
        spend: p.spend != null ? safeNum(p.spend) : undefined,
        ctr: p.ctr != null ? safeNum(p.ctr) : null,
        conversions: p.conversions != null ? safeNum(p.conversions) : undefined,
        roas: p.roas ?? null,
      }));
      setSeries(ordered);
      return;
    }

    setSeries([]);
  }

  // ---------- Recommendations (USER-SPECIFIC) ----------
  async function askRecommendations() {
    setRecError(null);
    setRecLoading(true);
    setRecsRequested(true);
    setRecList([]);

    // must be connected to Meta
    if (!isMetaConnectedLocal()) {
      setRecError("Please connect Meta to generate recommendations.");
      setRecLoading(false);
      return;
    }

    // get token
    let token: string | null = null;
    try {
      const { data } = await supabase.auth.getSession();
      token = (data as any)?.session?.access_token ?? null;
    } catch (e) {
      token = null;
    }

    if (!token) {
      setRecError("Not signed in.");
      setRecLoading(false);
      return;
    }

    try {
      const body = {
        metrics: metaSummary?.meta ?? null,
        range: selectedRange === "custom" ? { start: customStart, end: customEnd } : { range: selectedRange },
      };

      const resp = await fetch("/api/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });

      if (!resp.ok) {
        const txt = await resp.text();
        setRecError(txt || "Failed to generate recommendations.");
        setRecLoading(false);
        return;
      }

      const j = await resp.json();
      const recs = Array.isArray(j.recommendations) ? j.recommendations : [];
      const normalized = recs.map(normalizeRec);
      setRecList(normalized);
      setRecError(null);
    } catch (err: any) {
      console.error("askRecommendations error", err);
      setRecError("Failed to generate recommendations. Try again.");
      setRecList([]);
    } finally {
      setRecLoading(false);
    }
  }

  function resolveRecommendation(id?: string) {
    if (!id) return;

    setRecList(prev =>
      prev.map(r => (r.id === id ? { ...r, resolved: true } : r))
    );

    const rec = recList.find(r => r.id === id);
    if (rec?.campaignId) {
      setCampaigns(prev =>
        prev.map(c => {
          if (c.id !== rec.campaignId) return c;

          const updated = { ...c };

          if (rec.title?.toLowerCase().includes("ctr"))
            updated.ctr = updated.ctr
              ? `${Math.min(10, Number(String(updated.ctr).replace("%", "")) + 0.8)}%`
              : "1.6%";

          if (rec.title?.toLowerCase().includes("roas"))
            updated.roas = updated.roas
              ? `${(Number(updated.roas) + 0.5).toFixed(2)}`
              : "3.0";

          if (rec.title?.toLowerCase().includes("landing"))
            updated.conversions = (Number(updated.conversions ?? 0) + 10);

          if (!updated.budget)
            updated.budget = Math.max(
              100,
              Number(updated.budget ?? 0) || 500
            );

          updated.spend = Number(updated.spend ?? 0)
            ? Math.max(0, Number(updated.spend) - 50)
            : updated.spend;

          return updated;
        })
      );
    }

    setTimeout(
      () =>
        setRecList(prev => prev.filter(r => r.id !== id)),
      900
    );
  }

  function handleRangeClick(r: typeof ranges[number]) {
    setSelectedRange(r);

    if (r !== "custom") {
      setCustomStart("");
      setCustomEnd("");
      fetchMetrics({ range: r });
    }
  }

  async function handleApplyCustomRange() {
    if (!customStart || !customEnd) {
      return;
    }

    if (customStart > customEnd) {
      return;
    }

    await fetchMetrics({ start: customStart, end: customEnd });
  }

  function goToIntegrations() {
    window.location.href = "/integrations";
  }

  const availability =
    availabilityFromPayload(metaSummary) ||
    (metaSummary?.availability as AdsAnalyticsAvailability | undefined) ||
    null;
  const banner = availabilityBanner(availability?.state, {
    mixedCurrency:
      Boolean((metaSummary?.meta?.current as MetaMetrics | undefined)?.mixed_currency) ||
      Boolean((metaSummary as any)?.mixed_currency),
  });
  const currentForCards =
    metaSummary?.meta?.current ??
    (metaSummary as any)?.current ??
    null;
  const changeForCards =
    metaSummary?.meta?.change ??
    (metaSummary as any)?.change ??
    null;
  const displayCurrency =
    currentForCards?.currency ??
    (metaSummary as any)?.currency ??
    null;
  const mixedCurrency =
    Boolean(currentForCards?.mixed_currency) ||
    Boolean((metaSummary as any)?.mixed_currency);
  const spendByCurrency: Record<string, number> =
    currentForCards?.spend_by_currency ||
    (metaSummary as any)?.spend_by_currency ||
    {};

  const fmtMoneyForCards = (n: number | null | undefined) =>
    mixedCurrency ? "—" : fmtMoney(n, displayCurrency);

  const overallMetrics = buildOverviewCards(
    currentForCards,
    changeForCards,
    fmtMoneyForCards,
    pctDisplay
  );

  const filteredCampaigns = campaigns.filter((c) => {
    if (!query) return true;
    const q = query.toLowerCase();
    return (
      (c.name ?? "").toLowerCase().includes(q) ||
      (c.platform ?? "").toLowerCase().includes(q) ||
      (c.campaign_type ?? "").toLowerCase().includes(q)
    );
  });

  const selectedCampaign = campaigns.find((c) => c.id === selectedCampaignId) ?? null;

  const rightPanelRecs = recsRequested
    ? (selectedCampaignId
        ? recList.filter((r) => r.campaignId === selectedCampaignId || !r.campaignId)
        : recList)
    : [];

  const dateRangeLabel = useMemo(() => {
    if (selectedRange === "custom") {
      if (customStart && customEnd) return `${customStart} → ${customEnd}`;
      return "custom";
    }
    return selectedRange;
  }, [selectedRange, customStart, customEnd]);

  const metaConnected = isMetaConnectedLocal();

  const noDataInSelectedRange =
    metaConnected &&
    !loadingMeta &&
    !metricsError &&
    (availability?.state === "empty_range" ||
      availability?.state === "no_data" ||
      (!currentForCards && series.length === 0));

  // Loading state while checking feature access
  if (checkingFeature) {
    return (
      <div className="min-h-screen flex app-page">
        <Sidebar />
        <main className="flex-1 p-8 flex items-center justify-center" style={{ color: colors.foreground }}>
          <SkeletonPageLoader variant="analytics" />
        </main>
      </div>
    );
  }

  // If feature is not enabled or is coming soon, show overlay
  // Entitled = enabled && !comingSoon. Hiding UI is not authorization — APIs also gate.
  if (!isFeatureEntitled(featureAccess)) {
    return (
      <div className="min-h-screen flex app-page">
        <Sidebar />
        <main className="flex-1 relative">
          <ComingSoonOverlay featureKey="basic_analytics">
            <div className="p-8">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold" style={{ color: colors.foreground }}>AI Analytics</h2>
                  <p className="text-sm" style={{ color: colors.mutedForeground }}>Deep insights across your connected platforms</p>
                </div>
              </div>
              {/* Placeholder content for visual effect */}
              <div className="space-y-4">
                <div className="grid grid-cols-6 gap-4">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div key={i} className="p-4 rounded-xl h-24" style={{ backgroundColor: colors.card, border: `1px solid ${colors.border}` }} />
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-6">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="p-6 rounded-xl h-64" style={{ backgroundColor: colors.card, border: `1px solid ${colors.border}` }} />
                  ))}
                </div>
              </div>
            </div>
          </ComingSoonOverlay>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex app-page">
      <Sidebar />

      <main className="flex-1 p-8" style={{ color: colors.foreground }}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold" style={{ color: colors.foreground }}>AI Analytics</h2>
            <p className="text-sm" style={{ color: colors.mutedForeground }}>Deep insights across your connected platforms</p>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right mr-4">
              <div className="text-sm" style={{ color: colors.mutedForeground }}>
                {mixedCurrency
                  ? "Spend by currency"
                  : displayCurrency
                    ? `Total Spend (${displayCurrency})`
                    : "Total Spend"}
              </div>
              <div className="text-xl font-semibold" style={{ color: colors.foreground }}>
                {mixedCurrency
                  ? Object.entries(spendByCurrency)
                      .filter(([code]) => code !== "UNKNOWN")
                      .map(([code, amount]) => fmtMoney(amount, code))
                      .join(" · ") || "—"
                  : fmtMoney(currentForCards?.total_spend, displayCurrency)}
              </div>
            </div>

            <button
              onClick={() => {
                fetchCampaigns();
                fetchStatuses();
                fetchMetrics({ range: selectedRange });
              }}
              className="px-3 py-2 text-sm rounded-lg border"
              style={{ borderColor: colors.border, backgroundColor: colors.card, color: colors.foreground }}
            >
              Refresh
            </button>

            {/* <Button variant="outline" size="sm">
              <Share2 className="w-4 h-4 mr-2" />
              Export
            </Button> */}

            <Button onClick={askRecommendations} size="sm">
              {recLoading ? "Thinking…" : "Get Recommendations"}
            </Button>
          </div>
        </div>

        <h3 className="text-lg font-semibold mb-3" style={{ color: colors.foreground }}>Overview</h3>

        <div className="space-y-4 mb-8">
          {/* Time Range Card */}
          <div className="p-4 rounded-xl shadow" style={{ backgroundColor: colors.card, border: `1px solid ${colors.border}` }}>
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-3">
                <BarChart3 className="w-5 h-5" style={{ color: colors.mutedForeground }} />
                <div>
                  <div className="text-sm" style={{ color: colors.mutedForeground }}>Meta (Facebook & Instagram)</div>
                  <div className="text-lg font-semibold" style={{ color: colors.foreground }}>Live account metrics</div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="text-sm" style={{ color: colors.mutedForeground }}>
                  Period:{" "}
                  {selectedRange === "custom"
                    ? customStart && customEnd
                      ? `${customStart} → ${customEnd}`
                      : "Custom range"
                    : selectedRange}
                </div>

                <div className="flex items-center gap-2 ml-4">
                  {ranges.map((r) => (
                    <button
                      key={r}
                      onClick={() => handleRangeClick(r)}
                      className="text-xs px-2 py-1 rounded"
                      style={selectedRange === r
                        ? { backgroundColor: colors.primary, color: colors.primaryForeground }
                        : { border: `1px solid ${colors.border}`, backgroundColor: colors.card, color: colors.foreground }}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {statusLoading ? (
              <SkeletonMetricGrid columns={6} />
            ) : !metaConnected ? (
              <div className="p-6 text-center">
                <div className="text-lg font-semibold" style={{ color: colors.foreground }}>Please connect Meta</div>
                <div className="text-sm mt-2" style={{ color: colors.mutedForeground }}>
                  No connected Facebook / Instagram account found.
                </div>
                <div className="mt-4">
                  <button
                    onClick={() => goToIntegrations()}
                    className="px-4 py-2 rounded text-white"
                    style={{ backgroundColor: colors.primary }}
                  >
                    Connect Meta
                  </button>
                </div>
              </div>
            ) : loadingMeta ? (
              <SkeletonMetricGrid columns={6} />
            ) : (
              <div>
                {(metricsError || banner.text) && (
                  <div
                    className="mb-3 rounded px-3 py-2 text-sm"
                    style={{
                      border: `1px solid ${colors.border}`,
                      backgroundColor: colors.muted,
                      color:
                        metricsError || banner.tone === "error"
                          ? colors.destructive
                          : colors.foreground,
                    }}
                  >
                    {metricsError || banner.text}
                    {(availability?.state === "partial" ||
                      availability?.state === "stale" ||
                      availability?.state === "unavailable" ||
                      metricsError) && (
                      <button
                        type="button"
                        className="ml-3 underline text-xs"
                        onClick={() => void fetchMetrics({ range: selectedRange })}
                      >
                        Retry
                      </button>
                    )}
                  </div>
                )}
                <div className="grid grid-cols-6 gap-4">
                  {overallMetrics.map((m, i) => (
                    <div key={i} className="p-4 rounded" style={{ backgroundColor: colors.muted, border: `1px solid ${colors.border}` }}>
                      <div className="text-sm" style={{ color: colors.mutedForeground }}>{m.label}</div>
                      <div className="text-xl font-bold" style={{ color: colors.foreground }}>{m.value}</div>
                      <div
                        className="text-xs mt-1"
                        style={{
                          color:
                            m.trend === "up"
                              ? colors.green600
                              : m.trend === "down"
                                ? colors.destructive
                                : colors.mutedForeground,
                        }}
                      >
                        {m.change}
                      </div>
                    </div>
                  ))}
                </div>

                {noDataInSelectedRange && !banner.text && (
                  <div className="text-center text-sm mt-3" style={{ color: colors.mutedForeground }}>
                    No metrics available for the selected time range.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* CHARTS */}
          {!metaConnected ? (
            <div className="p-6 rounded-xl shadow text-center" style={{ backgroundColor: colors.card, border: `1px solid ${colors.border}` }}>
              <div className="text-lg font-semibold mb-2" style={{ color: colors.foreground }}>Connect Meta to view charts</div>
              <div className="text-sm mb-4" style={{ color: colors.mutedForeground }}>Charts & deeper insights require a connection to Meta.</div>
              <div>
                <button
                  onClick={() => goToIntegrations()}
                  className="px-4 py-2 rounded text-white"
                  style={{ backgroundColor: colors.primary }}
                >
                  Connect Meta
                </button>
              </div>
            </div>
          ) : (
            <div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Impressions */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="w-5 h-5" /> Impressions — {dateRangeLabel}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-4 mb-3">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-3 h-3 rounded-full"
                          style={{ background: "hsl(210 100% 56%)" }}
                        />
                        Impressions
                      </div>
                    </div>

                    <div className="h-[260px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={series}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="date" hide />
                          <YAxis />
                          <Legend />
                          <Line
                            type="monotone"
                            dataKey="impressions"
                            name="Impressions"
                            stroke="hsl(210 100% 56%)"
                            strokeWidth={2}
                            dot={{ r: 3 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                {/* Clicks */}
                <Card>
                  <CardHeader>
                    <CardTitle>Clicks — {dateRangeLabel}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-4 mb-3">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-3 h-3 rounded-full"
                          style={{ background: "hsl(200 80% 45%)" }}
                        />
                        Clicks
                      </div>
                    </div>

                    <div className="h-[260px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={series}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="date" hide />
                          <YAxis />
                          <Area
                            type="monotone"
                            dataKey="clicks"
                            name="Clicks"
                            stroke="hsl(200 80% 45%)"
                            fill="rgba(30,130,230,0.12)"
                            strokeWidth={2}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                {/* Spend */}
                <Card>
                  <CardHeader>
                    <CardTitle>Spend — {dateRangeLabel}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-4 mb-3">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full" style={{ background: "#3FA7FF" }} />
                        Spend
                      </div>
                    </div>

                    <div className="h-[260px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={series}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="date" hide />
                          <YAxis />
                          <Bar
                            dataKey="spend"
                            name={
                              mixedCurrency
                                ? "Spend (mixed currencies)"
                                : displayCurrency
                                  ? `Spend (${displayCurrency})`
                                  : "Spend"
                            }
                            fill="#3FA7FF"
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                {/* CTR */}
                <Card>
                  <CardHeader>
                    <CardTitle>CTR (%) — {dateRangeLabel}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-4 mb-3">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-3 h-3 rounded-full"
                          style={{ background: "hsl(210 80% 50%)" }}
                        />
                        CTR
                      </div>
                    </div>

                    <div className="h-[260px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={series}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="date" hide />
                          <YAxis
                            domain={[0, "dataMax + 1"]}
                            tickFormatter={(v) => `${v}%`}
                          />
                          <Line
                            type="monotone"
                            dataKey="ctr"
                            name="CTR (%)"
                            stroke="hsl(210 80% 50%)"
                            strokeWidth={2}
                            dot={{ r: 3 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                {/* Conversions */}
                <Card>
                  <CardHeader>
                    <CardTitle>Conversions — {dateRangeLabel}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-4 mb-3">
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full" style={{ background: "#16A34A" }} />
                        Conversions
                      </div>
                    </div>

                    <div className="h-[260px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={series}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="date" hide />
                          <YAxis />
                          <Bar dataKey="conversions" name="Conversions" fill="#16A34A" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>

                {/* ROAS */}
                <Card>
                  <CardHeader>
                    <CardTitle>ROAS — {dateRangeLabel}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-4 mb-3">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-3 h-3 rounded-full"
                          style={{ background: "rgba(99,102,241,1)" }}
                        />
                        ROAS
                      </div>
                    </div>

                    <div className="h-[260px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={series}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="date" hide />
                          <YAxis />
                          <Area
                            type="monotone"
                            dataKey="roas"
                            name="ROAS"
                            stroke="rgba(99,102,241,1)"
                            fill="rgba(99,102,241,0.12)"
                            strokeWidth={2}
                          />
                          <ReferenceLine y={1} stroke="rgba(0,0,0,0.08)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {noDataInSelectedRange && (
                <div className="text-center text-sm mt-2" style={{ color: colors.mutedForeground }}>
                  No chart data for this range (missing days are not shown as zero).
                </div>
              )}
            </div>
          )}

          <div className="text-center text-sm mt-3" style={{ color: colors.mutedForeground }}>
            {dateRangeLabel}
          </div>
        </div>

        {/* Campaign List */}
        <h3 className="text-lg font-semibold mb-3 mt-6" style={{ color: colors.foreground }}>Campaigns</h3>

        <div className="space-y-3">
          <div className="flex gap-4 mb-3">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search campaigns..."
              className="flex-1 px-3 py-2 border rounded-lg"
              style={{ backgroundColor: colors.input, borderColor: colors.border, color: colors.foreground }}
            />
            <Button variant="outline" onClick={fetchCampaigns}>
              Refresh
            </Button>
          </div>

          {campaignsLoading ? (
            <div className="grid grid-cols-1 gap-3">
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </div>
          ) : filteredCampaigns.length === 0 ? (
            <div className="text-sm" style={{ color: colors.mutedForeground }}>No campaigns found.</div>
          ) : null}

          <div className="grid grid-cols-1 gap-3">
            {filteredCampaigns.map((c) => (
              <Card
                key={c.id}
                className={`p-4 ${selectedCampaignId === c.id ? "ring-2" : ""}`}
                style={selectedCampaignId === c.id ? { borderColor: colors.primary } : undefined}
                onClick={() => setSelectedCampaignId(c.id)}
              >
                <CardContent className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold" style={{ color: colors.foreground }}>{c.name}</div>
                    <div className="text-sm" style={{ color: colors.mutedForeground }}>
                      {c.campaign_type ?? c.platform ?? "Meta"}
                    </div>
                  </div>

                  <div className="text-sm" style={{ color: colors.mutedForeground }}>
                    {c.created_at ? new Date(c.created_at).toLocaleString() : "—"}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </main>

      {/* Right Insights Panel */}
      <aside className="w-[360px] p-6 space-y-6" style={{ backgroundColor: colors.card, borderLeft: `1px solid ${colors.border}` }}>
        <div>
          <h3 className="text-lg font-bold" style={{ color: colors.foreground }}>Recommendations</h3>
          <p className="text-sm" style={{ color: colors.mutedForeground }}>
            Dynamic suggestions based on account & campaigns (user-specific)
          </p>
        </div>

        {!metaConnected && recsRequested ? (
          <div className="text-sm" style={{ color: colors.mutedForeground }}>
            Please connect Meta to generate recommendations.
          </div>
        ) : recLoading && recsRequested ? (
          <div className="space-y-3">
            <SkeletonRecommendationCard />
            <SkeletonRecommendationCard />
            <SkeletonRecommendationCard />
          </div>
        ) : !recsRequested ? (
          <div className="text-sm" style={{ color: colors.mutedForeground }}>
            No recommendations yet. Click &quot;Get Recommendations&quot;.
          </div>
        ) : rightPanelRecs.length > 0 ? (
          <div className="space-y-3">
            {rightPanelRecs.map((r) => (
              <div
                key={r.id}
                className={`p-4 rounded-lg shadow-md ${r.resolved ? "opacity-60" : ""}`}
                style={{ backgroundColor: colors.background, border: `1px solid ${colors.border}` }}
              >
                <div className="flex justify-between items-start">
                  <div className="pr-3">
                    <div className="font-semibold" style={{ color: colors.foreground }}>{r.title}</div>

                    {r.actions && r.actions.length > 0 && (
                      <ul className="list-disc ml-5 mt-3 text-sm space-y-1" style={{ color: colors.mutedForeground }}>
                        {r.actions.map((a, i) => (
                          <li key={i}>{a}</li>
                        ))}
                      </ul>
                    )}

                    {r.reason && (
                      <div className="text-xs mt-2" style={{ color: colors.mutedForeground }}>{r.reason}</div>
                    )}
                  </div>

                  <div className="text-right flex flex-col items-end gap-2">
                    <div
                      className="text-xs px-2 py-1 rounded text-white"
                      style={{
                        backgroundColor:
                          r.impact === "High"
                            ? colors.destructive
                            : r.impact === "Medium"
                            ? "hsl(25 95% 53%)"
                            : colors.mutedForeground,
                      }}
                    >
                      {r.impact ?? "—"}
                    </div>

                    <div>
                      <button
                        onClick={() => resolveRecommendation(r.id)}
                        className="px-3 py-1 text-sm rounded text-white"
                        style={{ backgroundColor: colors.green600 }}
                      >
                        Resolve
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-sm" style={{ color: colors.mutedForeground }}>
            {recError ?? "No recommendations found for the selected scope."}
          </div>
        )}
      </aside>
    </div>
  );
}

