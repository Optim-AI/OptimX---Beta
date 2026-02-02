// pages/analytics.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import type { JSX } from "react";
import { apiFetch } from "../lib/apiFetch";
import { supabase } from "../lib/supabaseClient";

import { Card, CardContent, CardHeader, CardTitle } from "../app/web/src/components/ui/card";
import { Button } from "../app/web/src/components/ui/button";

import { 
  BarChart3, 
  Share2, 
  TrendingUp, 
  TrendingDown, 
  Eye, 
  MousePointerClick, 
  DollarSign, 
  Target, 
  Zap, 
  RefreshCw,
  Search,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Calendar,
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  Facebook,
  Instagram,
  LayoutDashboard,
  Lightbulb,
  PlayCircle,
  PauseCircle
} from "lucide-react";

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
  total_spend: number;
  budget_estimate_daily: number | null;
  total_reach: number;
  avg_ctr: number;
  conversions: number;
  roas: number | null;
};

type TimeSeriesPoint = {
  date: string;
  impressions?: number;
  clicks?: number;
  spend?: number;
  ctr?: number;
  conversions?: number;
  roas?: number | null;
};

type SummaryResp = {
  ok: boolean;
  meta?: {
    current?: MetaMetrics;
    change?: Record<string, number | null>;
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

function fmtMoneyINR(n: number | null | undefined) {
  if (n == null) return "—";
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(Number(n));
  } catch {
    return `₹${Number(n).toFixed(0)}`;
  }
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
  const [loadingMeta, setLoadingMeta] = useState(false);

  const [recList, setRecList] = useState<Recommendation[]>([]);
  const [recLoading, setRecLoading] = useState(false);
  const [recsRequested, setRecsRequested] = useState(false);
  const [recError, setRecError] = useState<string | null>(null);

  const ranges = ["24h", "48h", "7d", "30d", "3m"] as const;
  const [selectedRange, setSelectedRange] = useState<typeof ranges[number]>("7d");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  const [activeTab, setActiveTab] = useState<"platforms" | "campaigns" | "overview" | "insights">("overview");
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campaignsLoading, setCampaignsLoading] = useState(true);
  const [query, setQuery] = useState("");

  const [series, setSeries] = useState<TimeSeriesPoint[]>([]);

  useEffect(() => {
    fetchCampaigns();
    fetchStatuses();
    fetchMetrics({ range: selectedRange });

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
    // If not connected, do NOT fetch, do NOT show dummy data.
    if (!isMetaConnectedLocal()) {
      setMetaSummary(null);
      setSeries([]);
      setLoadingMeta(false);
      return;
    }

    setLoadingMeta(true);
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
        // Map new range values to API format
        const rangeMap: Record<string, string> = {
          "24h": "1d",
          "48h": "2d",
          "7d": "7d",
          "30d": "30d",
          "3m": "90d"
        };
        query.set("range", rangeMap[r] || r);
      }

      const resp = await fetch(`/api/integrations/metrics?${query.toString()}`, {
        headers,
      });

      // if ok and payload has current -> use it
      if (resp.ok) {
        const j = await resp.json();

        // If metrics are missing or empty => persist zeros (no alert)
        const hasCurr = !!(j?.meta && j.meta.current);
        if (!hasCurr) {
          // create zeroed meta but keep shape
          const zeroMeta: SummaryResp = {
            ok: true,
            meta: {
              current: {
                total_spend: 0,
                budget_estimate_daily: null,
                total_reach: 0,
                avg_ctr: 0,
                conversions: 0,
                roas: null,
              },
              change: {
                total_reach_pct: 0,
                avg_ctr_pct: 0,
                total_spend_pct: 0,
                conversions_pct: 0,
              },
              time_series: [],
            }
          };
          setMetaSummary(zeroMeta);
          hydrateUiFromMeta(zeroMeta);
        } else {
          setMetaSummary(j);
          hydrateUiFromMeta(j);
        }
      } else {
        // non-ok -> treat as empty range: show zeros (persisted), no alert
        const zeroMeta: SummaryResp = {
          ok: false,
          meta: {
            current: {
              total_spend: 0,
              budget_estimate_daily: null,
              total_reach: 0,
              avg_ctr: 0,
              conversions: 0,
              roas: null,
            },
            change: {},
            time_series: [],
          }
        };
        setMetaSummary(zeroMeta);
        hydrateUiFromMeta(zeroMeta);
      }
    } catch (e) {
      console.error("fetchMetrics error", e);
      const zeroMeta: SummaryResp = {
        ok: false,
        meta: {
          current: {
            total_spend: 0,
            budget_estimate_daily: null,
            total_reach: 0,
            avg_ctr: 0,
            conversions: 0,
            roas: null,
          },
          change: {},
          time_series: [],
        }
      };
      setMetaSummary(zeroMeta);
      hydrateUiFromMeta(zeroMeta);
    } finally {
      setLoadingMeta(false);
    }
  }

  function safeNum(v: any, fallback = 0) {
    if (v == null || v === "") return fallback;
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }

  function generateDateLabels(count = 7, endDate?: Date) {
    const end = endDate ? new Date(endDate) : new Date();
    const labels: string[] = [];
    for (let i = count - 1; i >= 0; i--) {
      const d = new Date(end);
      d.setDate(end.getDate() - i);
      labels.push(d.toLocaleDateString("en-IN", { day: "numeric", month: "short" }));
    }
    return labels;
  }

  function inferLatestActivityDate(campaigns: Campaign[]) {
    const dates = campaigns
      .map(c => c.created_at ? new Date(c.created_at) : null)
      .filter(Boolean) as Date[];

    if (dates.length === 0) return null;
    return new Date(Math.max(...dates.map(d => d.getTime())));
  }

  function hydrateUiFromMeta(summary: SummaryResp | null) {
    // If disconnected/summary null -> keep series empty
    if (!summary || !summary.meta) {
      setSeries([]);
      return;
    }

    // if time_series present and non-empty: map and set
    if (summary.meta.time_series && summary.meta.time_series.length > 0) {
      const ordered = summary.meta.time_series.map((p: any) => ({
        date: new Date(p.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
        impressions: safeNum(p.impressions),
        clicks: safeNum(p.clicks),
        spend: safeNum(p.spend),
        ctr: p.ctr != null ? safeNum(p.ctr) : 0,
        conversions: safeNum(p.conversions),
        roas: p.roas ?? null,
      }));
      setSeries(ordered);
      return;
    }

    // else: produce zero-series if meta.current exists (even if ok:false)
    const pointCount = 7;
    const lastActivity = inferLatestActivityDate(campaigns);
    const endDate = lastActivity ?? new Date();
    const labels = generateDateLabels(pointCount, endDate);

    const cur = summary.meta.current ?? {
      total_reach: 0,
      total_spend: 0,
      avg_ctr: 0,
      conversions: 0,
      roas: null,
    };

    const allZero =
      (cur.total_reach ?? 0) === 0 &&
      (cur.total_spend ?? 0) === 0 &&
      (cur.conversions ?? 0) === 0;

    if (allZero) {
      const zeroSeries = labels.map((lab) => ({
        date: lab,
        impressions: 0,
        clicks: 0,
        spend: 0,
        ctr: 0,
        conversions: 0,
        roas: null,
      }));
      setSeries(zeroSeries);
    } else {
      const weights = [0.08, 0.09, 0.14, 0.16, 0.18, 0.17, 0.18];
      const synth = labels.map((lab, i) => ({
        date: lab,
        impressions: Math.round((cur.total_reach ?? 0) * weights[i]),
        clicks: Math.round(((cur.total_reach ?? 0) * ((cur.avg_ctr ?? 0) / 100)) * weights[i]),
        spend: Math.round((cur.total_spend ?? 0) * weights[i]),
        ctr: cur.avg_ctr ?? 0,
        conversions: Math.round((cur.conversions ?? 0) * weights[i]),
        roas: cur.roas,
      }));
      setSeries(synth);
    }
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
        range: { range: selectedRange },
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
      setCustomStart("");
      setCustomEnd("");
      fetchMetrics({ range: r });
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

  const metaSpend = metaSummary?.meta?.current?.total_spend ?? 0;
  const metaBudgetDaily = metaSummary?.meta?.current?.budget_estimate_daily ?? null;

  const overallMetrics = [
    {
      label: "Impressions",
      value: metaSummary?.meta?.current?.total_reach
        ? `${Math.round(metaSummary!.meta!.current!.total_reach / 1000)}K`
        : "0",
      change: pctDisplay(metaSummary?.meta?.change?.total_reach_pct),
      trend: (metaSummary?.meta?.change?.total_reach_pct ?? 0) > 0 ? "up" : "down",
    },
    {
      label: "Clicks",
      value: metaSummary?.meta?.current?.avg_ctr
        ? `${Math.round(
            ((metaSummary!.meta!.current!.total_reach ?? 0) *
              ((metaSummary!.meta!.current!.avg_ctr ?? 0) / 100))
          ).toLocaleString()}`
      : "0",
      change: pctDisplay(metaSummary?.meta?.change?.avg_ctr_pct),
      trend: (metaSummary?.meta?.change?.avg_ctr_pct ?? 0) > 0 ? "up" : "down",
    },
    {
      label: "CTR",
      value: metaSummary?.meta?.current?.avg_ctr
        ? `${metaSummary!.meta!.current!.avg_ctr.toFixed(2)}%`
        : "0%",
      change: pctDisplay(metaSummary?.meta?.change?.avg_ctr_pct),
      trend: (metaSummary?.meta?.change?.avg_ctr_pct ?? 0) > 0 ? "up" : "down",
    },
    {
      label: "Spend",
      value: fmtMoneyINR(metaSpend),
      change: pctDisplay(metaSummary?.meta?.change?.total_spend_pct),
      trend: (metaSummary?.meta?.change?.total_spend_pct ?? 0) > 0 ? "up" : "down",
    },
    {
      label: "Budget (daily est.)",
      value: metaBudgetDaily ? fmtMoneyINR(metaBudgetDaily) : "—",
      change: "—",
      trend: "up",
    },
    {
      label: "Conversions",
      value: (metaSummary?.meta?.current?.conversions ?? 0).toString(),
      change: pctDisplay(metaSummary?.meta?.change?.conversions_pct),
      trend: (metaSummary?.meta?.change?.conversions_pct ?? 0) > 0 ? "up" : "down",
    },
  ];

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
    return selectedRange;
  }, [selectedRange]);

  const metaConnected = isMetaConnectedLocal();

  // ---- NEW: compute "all metrics empty" condition (strict) ----
  const currentMetrics = metaSummary?.meta?.current ?? null;
  const allMetricsEmpty = Boolean(
    currentMetrics &&
      safeNum((currentMetrics as any).total_reach) === 0 &&
      safeNum((currentMetrics as any).avg_ctr) === 0 &&
      safeNum((currentMetrics as any).total_spend) === 0 &&
      ((currentMetrics as any).budget_estimate_daily == null || safeNum((currentMetrics as any).budget_estimate_daily) === 0) &&
      safeNum((currentMetrics as any).conversions) === 0 &&
      ((currentMetrics as any).roas == null)
  );
  const noDataInSelectedRange = metaConnected && !loadingMeta && series.length === 0 && allMetricsEmpty;

  // Helper to get platform metrics
  const getPlatformMetrics = (platform: "facebook" | "instagram") => {
    if (!metaSummary?.meta?.current) return null;
    const current = metaSummary.meta.current;
    // For now, Meta combines both - in future, split by platform
    return {
      spend: current.total_spend,
      reach: current.total_reach,
      ctr: current.avg_ctr,
      roi: current.roas,
      conversions: current.conversions,
    };
  };

  // Industry benchmarks (placeholder - would come from API)
  const benchmarks = {
    ctr: 2.5,
    roi: 3.0,
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50">
      <div className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl shadow-lg">
                <BarChart3 className="w-6 h-6 text-white" />
              </div>
          <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
                  Analytics
                </h1>
          </div>
            </div>

            {/* Global Date Range Selector */}
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-slate-500" />
              <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-1">
                {ranges.map((r) => (
            <button
                    key={r}
                    onClick={() => handleRangeClick(r)}
                    className={`text-xs font-medium px-3 py-1.5 rounded transition-all ${
                      selectedRange === r
                        ? "bg-blue-600 text-white shadow-sm"
                        : "text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {r === "24h" ? "24h" : r === "48h" ? "48h" : r === "7d" ? "7d" : r === "30d" ? "30d" : "3m"}
                  </button>
                ))}
              </div>
              <Button
                variant="outline"
                size="sm"
              onClick={() => {
                fetchCampaigns();
                fetchStatuses();
                fetchMetrics({ range: selectedRange });
              }}
                className="gap-2"
              >
                <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>

          {/* Tab Navigation */}
          <div className="flex items-center gap-1 mt-4 border-b border-slate-200">
            {[
              { id: "platforms", label: "Platforms", icon: Facebook },
              { id: "campaigns", label: "Campaigns", icon: Target },
              { id: "overview", label: "Overview", icon: LayoutDashboard },
              { id: "insights", label: "AI Insights", icon: Lightbulb },
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                    <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? "border-blue-600 text-blue-600"
                      : "border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                    </button>
              );
            })}
                </div>
              </div>
            </div>

      <main className="max-w-7xl mx-auto px-6 lg:px-8 py-8">

        {/* Tab Content */}
            {statusLoading ? (
          <Card className="p-12">
            <div className="flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              <div className="text-sm text-slate-600">Checking connection status...</div>
            </div>
          </Card>
            ) : !metaConnected ? (
          <Card className="p-12 border-2 border-dashed border-slate-300">
            <div className="flex flex-col items-center justify-center text-center gap-4">
              <div className="p-4 bg-slate-100 rounded-full">
                <AlertCircle className="w-8 h-8 text-slate-400" />
                </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-800 mb-1">Connect Meta to Get Started</h3>
                <p className="text-sm text-slate-600">
                  Connect your Facebook or Instagram account to view analytics and insights.
                </p>
              </div>
              <Button
                    onClick={() => goToIntegrations()}
                className="gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                  >
                <CheckCircle2 className="w-4 h-4" />
                    Connect Meta
            </Button>
                </div>
          </Card>
            ) : loadingMeta ? (
          <Card className="p-12">
            <div className="flex flex-col items-center justify-center gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              <div className="text-sm text-slate-600">Loading metrics...</div>
            </div>
          </Card>
        ) : (
          <>
            {/* Tab 1: Platforms */}
            {activeTab === "platforms" && (
              <div className="space-y-6">
              <div>
                  <h2 className="text-xl font-bold text-slate-900 mb-1">Platform Performance</h2>
                  <p className="text-sm text-slate-600">See how each platform is performing</p>
                      </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Facebook Card */}
                  <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-3 bg-blue-100 rounded-xl">
                            <Facebook className="w-6 h-6 text-blue-600" />
                    </div>
                          <div>
                            <CardTitle className="text-lg">Facebook</CardTitle>
                            <p className="text-xs text-slate-500">Meta Platform</p>
                </div>
                  </div>
                        {getPlatformMetrics("facebook") && (
                          <div className={`text-xs px-2 py-1 rounded ${
                            (getPlatformMetrics("facebook")?.ctr ?? 0) > benchmarks.ctr 
                              ? "bg-green-100 text-green-700" 
                              : "bg-slate-100 text-slate-600"
                          }`}>
                            {(getPlatformMetrics("facebook")?.ctr ?? 0) > benchmarks.ctr ? "Above Avg" : "Below Avg"}
              </div>
            )}
          </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {(() => {
                        const metrics = getPlatformMetrics("facebook");
                        return metrics ? (
                          <>
                            <div className="grid grid-cols-2 gap-4">
              <div>
                                <div className="text-xs text-slate-500 mb-1">Spend</div>
                                <div className="text-lg font-bold text-slate-900">
                                  {fmtMoneyINR(metrics.spend)}
              </div>
            </div>
            <div>
                                <div className="text-xs text-slate-500 mb-1">Reach</div>
                                <div className="text-lg font-bold text-slate-900">
                                  {metrics.reach ? `${Math.round(metrics.reach / 1000)}K` : "0"}
                      </div>
                    </div>
                              <div>
                                <div className="text-xs text-slate-500 mb-1">CTR</div>
                                <div className="text-lg font-bold text-slate-900">
                                  {metrics.ctr?.toFixed(2) ?? "0"}%
                    </div>
                              </div>
                              <div>
                                <div className="text-xs text-slate-500 mb-1">ROI</div>
                                <div className="text-lg font-bold text-slate-900">
                                  {metrics.roi ? metrics.roi.toFixed(2) : "—"}
                                </div>
                              </div>
                            </div>
                          </>
                        ) : (
                          <div className="text-sm text-slate-500 text-center py-4">No data available</div>
                        );
                      })()}
                  </CardContent>
                </Card>

                  {/* Instagram Card */}
                  <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow">
                  <CardHeader>
                      <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                          <div className="p-3 bg-pink-100 rounded-xl">
                            <Instagram className="w-6 h-6 text-pink-600" />
                          </div>
                <div>
                            <CardTitle className="text-lg">Instagram</CardTitle>
                            <p className="text-xs text-slate-500">Meta Platform</p>
                </div>
              </div>
                        {getPlatformMetrics("instagram") && (
                          <div className={`text-xs px-2 py-1 rounded ${
                            (getPlatformMetrics("instagram")?.ctr ?? 0) > benchmarks.ctr 
                              ? "bg-green-100 text-green-700" 
                              : "bg-slate-100 text-slate-600"
                          }`}>
                            {(getPlatformMetrics("instagram")?.ctr ?? 0) > benchmarks.ctr ? "Above Avg" : "Below Avg"}
                          </div>
                        )}
                      </div>
                  </CardHeader>
                    <CardContent className="space-y-4">
                      {(() => {
                        const metrics = getPlatformMetrics("instagram");
                        return metrics ? (
                          <>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <div className="text-xs text-slate-500 mb-1">Spend</div>
                                <div className="text-lg font-bold text-slate-900">
                                  {fmtMoneyINR(metrics.spend)}
                      </div>
                    </div>
                              <div>
                                <div className="text-xs text-slate-500 mb-1">Reach</div>
                                <div className="text-lg font-bold text-slate-900">
                                  {metrics.reach ? `${Math.round(metrics.reach / 1000)}K` : "0"}
                    </div>
                              </div>
                              <div>
                                <div className="text-xs text-slate-500 mb-1">CTR</div>
                                <div className="text-lg font-bold text-slate-900">
                                  {metrics.ctr?.toFixed(2) ?? "0"}%
                                </div>
                              </div>
                              <div>
                                <div className="text-xs text-slate-500 mb-1">ROI</div>
                                <div className="text-lg font-bold text-slate-900">
                                  {metrics.roi ? metrics.roi.toFixed(2) : "—"}
                                </div>
                              </div>
                            </div>
                          </>
                        ) : (
                          <div className="text-sm text-slate-500 text-center py-4">No data available</div>
                        );
                      })()}
                  </CardContent>
                </Card>
                      </div>
                    </div>
            )}

            {/* Tab 2: Campaigns */}
            {activeTab === "campaigns" && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900 mb-1">Campaigns</h2>
                    <p className="text-sm text-slate-600">View and manage your campaigns</p>
                    </div>
                  <Button variant="outline" size="sm" onClick={fetchCampaigns} className="gap-2">
                    <RefreshCw className="w-4 h-4" />
                    Refresh
                  </Button>
                </div>

                <div className="mb-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Search campaigns..."
                      className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                      </div>
                    </div>

                {campaignsLoading ? (
                  <Card className="p-12">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                      <div className="text-sm text-slate-600">Loading campaigns...</div>
                    </div>
                  </Card>
                ) : filteredCampaigns.length === 0 ? (
                  <Card className="p-12 border-2 border-dashed">
                    <div className="text-center text-slate-500">No campaigns found</div>
                  </Card>
                ) : (
                  <div className="space-y-3">
                    {filteredCampaigns.map((c) => (
                      <Card key={c.id} className="border-0 shadow-md hover:shadow-lg transition-all">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <div className="font-semibold text-slate-900">{c.name}</div>
                                {c.is_published ? (
                                  <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-medium flex items-center gap-1">
                                    <PlayCircle className="w-3 h-3" />
                                    Active
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded text-xs font-medium flex items-center gap-1">
                                    <PauseCircle className="w-3 h-3" />
                                    Paused
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-4 text-sm text-slate-600">
                                <span>{c.platform ?? "Meta"}</span>
                                <span>•</span>
                                <span>Spend: {fmtMoneyINR(Number(c.spend) || 0)}</span>
                                <span>•</span>
                                <span>Reach: {c.impressions ? `${Math.round(Number(c.impressions) / 1000)}K` : "0"}</span>
                                <span>•</span>
                                <span>CTR: {c.ctr ?? "0%"}</span>
                                <span>•</span>
                                <span>ROI: {c.roas ?? "—"}</span>
                              </div>
                            </div>
                    </div>
                  </CardContent>
                </Card>
                  ))}
                </div>
                )}
              </div>
            )}

            {/* Tab 3: Overview */}
            {activeTab === "overview" && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 mb-1">Cross-Platform Summary</h2>
                  <p className="text-sm text-slate-600">Big-picture performance across all platforms</p>
                      </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <Card className="border-0 shadow-lg">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-sm text-slate-500">Total Spend</div>
                        <DollarSign className="w-5 h-5 text-slate-400" />
                    </div>
                      <div className="text-3xl font-bold text-slate-900">{fmtMoneyINR(metaSpend)}</div>
                    </CardContent>
                  </Card>

                  <Card className="border-0 shadow-lg">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-sm text-slate-500">Total Reach</div>
                        <Eye className="w-5 h-5 text-slate-400" />
                </div>
                      <div className="text-3xl font-bold text-slate-900">
                        {metaSummary?.meta?.current?.total_reach
                          ? `${Math.round(metaSummary.meta.current.total_reach / 1000)}K`
                          : "0"}
                    </div>
                  </CardContent>
                </Card>

                  <Card className="border-0 shadow-lg">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-sm text-slate-500">Average CTR</div>
                        <Target className="w-5 h-5 text-slate-400" />
                      </div>
                      <div className="text-3xl font-bold text-slate-900">
                        {metaSummary?.meta?.current?.avg_ctr?.toFixed(2) ?? "0"}%
                    </div>
                    </CardContent>
                  </Card>

                  <Card className="border-0 shadow-lg">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-sm text-slate-500">Overall ROI</div>
                        <TrendingUp className="w-5 h-5 text-slate-400" />
                      </div>
                      <div className="text-3xl font-bold text-slate-900">
                        {metaSummary?.meta?.current?.roas 
                          ? metaSummary.meta.current.roas.toFixed(2)
                          : "—"}
                    </div>
                  </CardContent>
                </Card>
              </div>

                {/* Benchmarks Section */}
                <Card className="border-0 shadow-lg">
                  <CardHeader>
                    <CardTitle>Performance vs Industry Benchmarks</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
              <div>
                        <div className="font-semibold text-slate-900">CTR</div>
                        <div className="text-sm text-slate-600">Your performance vs industry average</div>
                </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-slate-900">
                          {metaSummary?.meta?.current?.avg_ctr?.toFixed(2) ?? "0"}%
                    </div>
                        <div className="text-xs text-slate-500">Industry: {benchmarks.ctr}%</div>
                        {metaSummary?.meta?.current?.avg_ctr && (
                          <div className={`text-xs font-medium mt-1 ${
                            metaSummary.meta.current.avg_ctr > benchmarks.ctr 
                              ? "text-green-600" 
                              : "text-red-600"
                          }`}>
                            {metaSummary.meta.current.avg_ctr > benchmarks.ctr ? "✓ Above average" : "Below average"}
            </div>
          )}
          </div>
        </div>

                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                  <div>
                        <div className="font-semibold text-slate-900">ROI</div>
                        <div className="text-sm text-slate-600">Your performance vs industry average</div>
                    </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-slate-900">
                          {metaSummary?.meta?.current?.roas 
                            ? metaSummary.meta.current.roas.toFixed(2)
                            : "—"}
                  </div>
                        <div className="text-xs text-slate-500">Industry: {benchmarks.roi}x</div>
                        {metaSummary?.meta?.current?.roas && (
                          <div className={`text-xs font-medium mt-1 ${
                            metaSummary.meta.current.roas > benchmarks.roi 
                              ? "text-green-600" 
                              : "text-red-600"
                          }`}>
                            {metaSummary.meta.current.roas > benchmarks.roi ? "✓ Above average" : "Below average"}
                  </div>
                )}
                      </div>
                  </div>
                </CardContent>
              </Card>
          </div>
            )}

            {/* Tab 4: AI Insights */}
            {activeTab === "insights" && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
        <div>
                    <h2 className="text-xl font-bold text-slate-900 mb-1">AI Insights</h2>
                    <p className="text-sm text-slate-600">Actionable recommendations for your campaigns</p>
                  </div>
                  <Button 
                    onClick={askRecommendations} 
                    size="sm"
                    className="gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                    disabled={recLoading}
                  >
                    {recLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        Generate Insights
                      </>
                    )}
                  </Button>
        </div>

        {!metaConnected && recsRequested ? (
                  <Card className="p-8 border-2 border-dashed">
                    <div className="text-center text-slate-600">
            Please connect Meta to generate recommendations.
          </div>
                  </Card>
        ) : recLoading && recsRequested ? (
                  <Card className="p-12">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                      <div className="text-sm text-slate-600">Analyzing your data...</div>
                    </div>
                  </Card>
        ) : !recsRequested ? (
                  <Card className="p-12 border-2 border-dashed">
                    <div className="flex flex-col items-center justify-center text-center gap-4">
                      <div className="p-4 bg-slate-100 rounded-full">
                        <Lightbulb className="w-8 h-8 text-slate-400" />
          </div>
              <div>
                        <h3 className="text-lg font-semibold text-slate-800 mb-1">No insights yet</h3>
                        <p className="text-sm text-slate-600">
                          Click "Generate Insights" to receive AI-powered recommendations
                        </p>
                      </div>
                    </div>
                  </Card>
                ) : recList.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {recList.map((r) => (
                      <Card key={r.id} className={`border-0 shadow-lg ${r.resolved ? "opacity-50" : ""}`}>
                        <CardContent className="p-6">
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex-1">
                              <div className="font-semibold text-slate-900 mb-2">{r.title}</div>
                    {r.reason && (
                                <div className="text-sm text-slate-600 mb-3">{r.reason}</div>
                    )}
                  </div>
                            <div className={`text-xs font-semibold px-2.5 py-1 rounded ${
                        r.impact === "High"
                                ? "bg-red-100 text-red-700"
                          : r.impact === "Medium"
                                ? "bg-orange-100 text-orange-700"
                                : "bg-slate-100 text-slate-700"
                            }`}>
                      {r.impact ?? "—"}
                            </div>
                    </div>

                          {r.actions && r.actions.length > 0 && (
                            <div className="mb-4">
                              <div className="text-xs font-medium text-slate-700 mb-2">Actions:</div>
                              <ul className="space-y-2">
                                {r.actions.map((a, i) => (
                                  <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2 flex-shrink-0"></div>
                                    <span>{a}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {!r.resolved && (
                            <Button
                        onClick={() => resolveRecommendation(r.id)}
                              size="sm"
                              className="w-full gap-2 bg-gradient-to-r from-green-600 to-emerald-600"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Mark as Resolved
                            </Button>
                          )}
                          {r.resolved && (
                            <div className="flex items-center justify-center gap-2 text-sm text-green-600 font-medium py-2">
                              <CheckCircle2 className="w-4 h-4" />
                              Resolved
                    </div>
                          )}
                        </CardContent>
                      </Card>
            ))}
          </div>
        ) : (
                  <Card className="p-8 border-2 border-dashed">
                    <div className="text-center text-slate-600">
                      {recError ?? "No recommendations found."}
          </div>
                  </Card>
                )}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

/* -------------------- small helpers outside component -------------------- */
function fmtMoney(n: number | null | undefined) {
  if (n == null) return "—";
  try {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0 }).format(Number(n));
  } catch {
    return `₹${Number(n).toFixed(0)}`;
  }
}
// function pctDisplay(n: number | null | undefined) {
//   if (n == null) return "—";
//   const r = Math.round((n as number) * 10) / 10;
//   const sign = r > 0 ? "+" : "";
//   return `${sign}${r}%`;
// }

