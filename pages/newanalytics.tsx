// pages/analytics.tsx
"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import Sidebar from "../app/web/src/components/Sidebar";
import { apiFetch } from "../lib/apiFetch";
import { supabase } from "../lib/supabaseClient";
import colors from "../lib/colors";

import { Card, CardContent, CardHeader, CardTitle } from "../app/web/src/components/ui/card";
import { Button } from "../app/web/src/components/ui/button";
import { Badge } from "../app/web/src/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../app/web/src/components/ui/select";
import {
  BarChart3,
  TrendingUp,
  Zap,
  Share2,
  Pause,
  Play,
  Copy,
  Edit,
  CheckCircle2,
} from "lucide-react";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "../app/web/src/components/ui/chart";
import { Line, LineChart, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts";

/* -------------------- types -------------------- */
type MetaMetrics = {
  total_spend: number;
  budget_estimate_daily: number | null;
  total_reach: number;
  avg_ctr: number;
  conversions: number;
  roas: number | null;
};

type SummaryResp = {
  ok: boolean;
  meta?: {
    current?: MetaMetrics;
    change?: {
      total_spend_pct?: number | null;
      total_reach_pct?: number | null;
      avg_ctr_pct?: number | null;
      conversions_pct?: number | null;
      roas_pct?: number | null;
    };
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
};

/* -------------------- tokens & helpers -------------------- */
const LS_KEY = "integrations_status_v1";

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
function extractJsonFromText(text: string): any | null {
  if (!text) return null;
  const cleaned = text.replace(/^\s*```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    const candidate = cleaned.slice(firstBrace, lastBrace + 1);
    try { return JSON.parse(candidate); } catch {}
  }
  try { return JSON.parse(cleaned); } catch { return null; }
}
function normalizeRec(x: any): Recommendation {
  if (!x) return {};
  const id = x.id ?? (Math.random() + "").slice(2);
  const title = x.title ?? x.heading ?? x.name ?? (typeof x === "string" ? x : undefined);
  const impact = x.impact ?? x.level ?? x.priority;
  const reason = x.reason ?? x.explanation ?? x.summary ?? x.description ?? (typeof x === "string" ? x : undefined);
  let actions: string[] = [];
  if (Array.isArray(x.actions)) actions = x.actions;
  else if (typeof x.actions === "string") actions = x.actions.split(/\n+/).map(s => s.replace(/^[\-\d\.\)\s]+/, "").trim()).filter(Boolean);
  const estimate = x.estimate ?? x.estimate_uplift ?? x.uplift;
  const campaignId = x.campaignId ?? x.campaign_id ?? x.c;
  const confidence = x.confidence ?? x.conf ?? undefined;
  const effort = x.effort ?? x.estimated_effort ?? undefined;
  return { id, title, impact, reason, actions, estimate, campaignId, resolved: false, confidence, effort };
}
function splitTextIntoRecommendations(text: string): string[] {
  const numbered = text.split(/\n\s*\d+\.\s/).map(s => s.trim()).filter(Boolean);
  if (numbered.length > 1) return numbered;
  const dd = text.split(/\n{2,}/).map(s => s.trim()).filter(Boolean);
  if (dd.length > 1) return dd;
  const bullets = text.split(/[\u2022\u2023\-•\*]\s+/).map(s => s.trim()).filter(Boolean);
  if (bullets.length > 1) return bullets;
  return [text.trim()];
}

/* -------------------- component -------------------- */
export default function Analytics(): JSX.Element {
  // data & loading
  const [statuses, setStatuses] = useState<Record<string, any> | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);

  const [metaSummary, setMetaSummary] = useState<SummaryResp | null>(null);
  const [loadingMeta, setLoadingMeta] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [recList, setRecList] = useState<Recommendation[]>([]);
  const [aiRaw, setAiRaw] = useState<any | null>(null);
  const [recLoading, setRecLoading] = useState(false);

  // time range UI (restored)
  const ranges = ["1d", "7d", "15d", "1m", "3m", "6m", "1y", "custom"] as const;
  const [selectedRange, setSelectedRange] = useState<typeof ranges[number]>("7d");
  const [customStart, setCustomStart] = useState<string>("");
  const [customEnd, setCustomEnd] = useState<string>("");

  // other UI state
  const [selectedChannel, setSelectedChannel] = useState<string>("all");
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);

  // Campaigns fetched from supabase
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campaignsLoading, setCampaignsLoading] = useState<boolean>(true);
  const [query, setQuery] = useState<string>("");

  // performance chart data
  const [performanceData, setPerformanceData] = useState<any[]>([
    { date: "Day 1", impressions: 120000, clicks: 4200, spend: 1200 },
    { date: "Day 2", impressions: 125000, clicks: 4500, spend: 1250 },
    { date: "Day 3", impressions: 118000, clicks: 4100, spend: 1180 },
    { date: "Day 4", impressions: 132000, clicks: 4800, spend: 1320 },
    { date: "Day 5", impressions: 128000, clicks: 4600, spend: 1280 },
    { date: "Day 6", impressions: 135000, clicks: 5000, spend: 1350 },
    { date: "Day 7", impressions: 142000, clicks: 5300, spend: 1420 },
  ]);

  useEffect(() => {
    fetchCampaigns();
    fetchStatuses();
    fetchMetrics(); // will populate recList dynamically
    function onStorage(e: StorageEvent) {
      if (e.key === LS_KEY) {
        try { setStatuses(e.newValue ? JSON.parse(e.newValue) : null); } catch {}
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* -------------------- Campaigns (from your CampaignsPage) -------------------- */
  async function fetchCampaigns() {
    setCampaignsLoading(true);
    try {
      const { data, error } = await supabase.from("campaigns").select("*").order("created_at", { ascending: false });
      if (error) {
        console.error("Error fetching campaigns:", error);
        setCampaigns([]);
      } else {
        const normalized = (data as any[] || []).map((c) => ({
          id: c.id ?? (c.name || Math.random()).toString(),
          name: c.name ?? "Untitled",
          campaign_type: c.campaign_type ?? c.type ?? null,
          image_url: c.image_url ?? null,
          is_published: !!c.is_published,
          created_at: c.created_at ?? undefined,
          spend: c.spend_inr ?? c.spend ?? undefined,
          roas: c.roas ?? undefined,
          ctr: c.ctr ?? undefined,
          impressions: c.impressions ?? undefined,
          platform: c.platform ?? c.source ?? (c.campaign_type ?? "Meta"),
          conversions: c.conversions ?? 0,
          budget: c.budget_inr ?? c.budget ?? undefined,
        })) as Campaign[];
        setCampaigns(normalized);
      }
    } catch (err) {
      console.error("Fetch error:", err);
      setCampaigns([]);
    } finally {
      setCampaignsLoading(false);
    }
  }

  /* -------------------- integrations status -------------------- */
  async function fetchStatuses() {
    setStatusLoading(true);
    try {
      const res = await apiFetch("/api/integrations/status");
      if (res.ok) {
        const j = await res.json();
        setStatuses(j);
        try { localStorage.setItem(LS_KEY, JSON.stringify(j)); } catch {}
      }
    } catch (err) {
      // ignore
    } finally {
      setStatusLoading(false);
    }
  }

  function isMetaConnectedLocal(s?: Record<string, any> | null) {
    const st = s ?? statuses;
    if (!st) return false;
    if (st.meta === true) return true;
    if (typeof st.meta === "object" && (st.meta.connected === true || st.meta === true)) return true;
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

  /* -------------------- metrics fetch & hydrate -------------------- */
  async function fetchMetrics() {
    setLoadingMeta(true);
    setError(null);
    let token: string | null = null;
    try {
      const { data } = await supabase.auth.getSession();
      token = (data as any)?.session?.access_token ?? null;
    } catch {}
    try {
      const headers: HeadersInit = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const query = new URLSearchParams();
      query.set("range", selectedRange === "custom" ? "7d" : selectedRange);
      const resp = await fetch(`/api/integrations/metrics?${query.toString()}`, { headers });
      if (resp.ok) {
        const j = await resp.json();
        setMetaSummary(j as SummaryResp);
        hydrateUiFromMeta(j as SummaryResp);
      } else {
        const body = await resp.text();
        try { setError(JSON.stringify(JSON.parse(body))); } catch { setError(body); }
        // still produce fallback dynamic recommendations if no live metrics
        hydrateUiFromMeta(null);
      }
    } catch (err: any) {
      console.error("metrics fetch error", err);
      setError(String(err));
      hydrateUiFromMeta(null);
    } finally {
      setLoadingMeta(false);
    }
  }

  /* -------------------- hydrate UI & generate dynamic recs -------------------- */
  function hydrateUiFromMeta(summary: SummaryResp | null) {
    // update chart & some campaign values
    if (summary?.meta?.current) {
      const cur = summary.meta.current;
      const weights = [0.08, 0.09, 0.14, 0.16, 0.18, 0.17, 0.18];
      const newPerf = weights.map((w, i) => ({
        date: `Day ${i + 1}`,
        impressions: Math.round((cur.total_reach ?? 0) * w),
        clicks: Math.round(((cur.total_reach ?? 0) * ((cur.avg_ctr ?? 0) / 100)) * w),
        spend: Math.round((cur.total_spend ?? 0) * w),
      }));
      setPerformanceData(newPerf);

      setCampaigns(prev => {
        const copy = [...prev];
        if (copy.length > 0) {
          copy[0] = {
            ...copy[0],
            spend: cur.total_spend ? cur.total_spend * 0.35 : copy[0].spend,
            budget: cur.budget_estimate_daily ? cur.budget_estimate_daily * 10 : copy[0].budget,
            impressions: cur.total_reach ?? copy[0].impressions,
            conversions: cur.conversions ?? copy[0].conversions,
          };
        }
        return copy;
      });
    }

    // Build dynamic recommendations based on current metrics & campaign states
    const suggestions: Recommendation[] = [];

    // if metrics exist, create metric-driven recs
    if (summary?.meta?.current) {
      const cur = summary.meta.current;
      if (cur.roas && cur.roas < 3) {
        suggestions.push(normalizeRec({
          id: "rec-roas-1",
          title: "Reallocate budget to top converting ad sets",
          reason: `Account ROAS ${Number(cur.roas).toFixed(2)}x — shift budget to highest converting ad sets.`,
          impact: "High",
          campaignId: campaigns[0]?.id ?? undefined,
          confidence: 88,
          effort: "low",
        }));
      }
      if ((cur.avg_ctr ?? 0) < 1.5) {
        suggestions.push(normalizeRec({
          id: "rec-ctr-1",
          title: "Refresh creatives to improve CTR",
          reason: `Avg CTR ${(cur.avg_ctr ?? 0).toFixed ? (cur.avg_ctr as number).toFixed(2) : cur.avg_ctr}% — test new creatives.`,
          impact: "Medium",
          campaignId: campaigns[1]?.id ?? undefined,
          confidence: 76,
          effort: "medium",
        }));
      }
      if ((cur.total_reach ?? 0) > 100000 && (cur.conversions ?? 0) < 50) {
        suggestions.push(normalizeRec({
          id: "rec-conv-1",
          title: "Optimize landing page & tracking",
          reason: `High reach but low conversions (${cur.conversions ?? 0}). Check funnel & tracking.`,
          impact: "High",
          campaignId: campaigns[2]?.id ?? undefined,
          confidence: 91,
          effort: "high",
        }));
      }
    }

    // Additional campaign-state-driven recs (if campaigns exist)
    for (const c of campaigns) {
      // if a campaign is active and spend high but conversions low -> suggestion
      const spentNum = Number(c.spend ?? 0);
      if (c.is_published && spentNum > 1000 && (c.conversions ?? 0) < 10) {
        suggestions.push(normalizeRec({
          id: `rec-campaign-${c.id}-1`,
          title: `Review ${c.name} targeting & creative`,
          reason: `High spend but low conversions for ${c.name}. Consider creative refresh or audience change.`,
          impact: "Medium",
          campaignId: c.id,
          confidence: 72,
          effort: "medium",
        }));
      }
      // if campaign has no budget field present, suggest to set budget
      if (!c.budget) {
        suggestions.push(normalizeRec({
          id: `rec-campaign-${c.id}-setbudget`,
          title: `Set daily budget for ${c.name}`,
          reason: `${c.name} has no budget set — add a daily budget to keep pacing controlled.`,
          impact: "Low",
          campaignId: c.id,
          confidence: 60,
          effort: "low",
        }));
      }
    }

    // If NOTHING generated, show a benign suggestion
    if (suggestions.length === 0) {
      suggestions.push(normalizeRec({
        id: "rec-sample-1",
        title: "Monitor frequency and ad fatigue",
        reason: "Audience frequency may be climbing — monitor fatigue and refresh creatives when CTR drops.",
        impact: "Medium",
        campaignId: campaigns[0]?.id ?? undefined,
        confidence: 65,
        effort: "low",
      }));
    }

    // dedupe by id and set
    const deduped: Record<string, Recommendation> = {};
    for (const s of suggestions) {
      if (!s.id) s.id = (Math.random() + "").slice(2);
      deduped[s.id] = s;
    }
    setRecList(Object.values(deduped));
  }

  /* -------------------- resolve recommendation (applies dynamic change) -------------------- */
  function resolveRecommendation(id?: string) {
    if (!id) return;
    setRecList(prev => prev.map(r => (r.id === id ? { ...r, resolved: true } : r)));
    const rec = recList.find(r => r.id === id);
    if (rec?.campaignId) {
      setCampaigns(prev => prev.map(c => {
        if (c.id !== rec.campaignId) return c;
        const updated: Campaign = { ...c };
        if (rec.title?.toLowerCase().includes("ctr") || rec.reason?.toLowerCase().includes("ctr")) {
          updated.ctr = updated.ctr ? `${Math.min(10, (Number(updated.ctr.replace?.("%","") ?? 0) + 0.8)).toFixed(1)}%` : "1.6%";
        }
        if (rec.title?.toLowerCase().includes("roas") || rec.reason?.toLowerCase().includes("roas")) {
          updated.roas = updated.roas ? `${(Number(updated.roas) + 0.5).toFixed(2)}` : "3.0";
        }
        if (rec.title?.toLowerCase().includes("landing") || rec.reason?.toLowerCase().includes("landing")) {
          updated.conversions = (Number(updated.conversions ?? 0) + 10);
        }
        if (!updated.budget) updated.budget = Math.max(100, Number(updated.budget ?? 0) || 500);
        updated.spend = (Number(updated.spend ?? 0) ? Math.max(0, Number(updated.spend ?? 0) - 50) : updated.spend);
        return updated;
      }));
    }
    // remove after short UX delay
    setTimeout(() => setRecList(prev => prev.filter(r => r.id !== id)), 900);
  }

  /* -------------------- UI interactions -------------------- */
  function handleRangeClick(r: typeof ranges[number]) {
    setSelectedRange(r);
    if (r !== "custom") {
      setCustomStart("");
      setCustomEnd("");
      fetchMetrics();
    }
  }

  function handleApplyCustomRange() {
    if (!customStart || !customEnd) { setError("Please pick both start and end for custom range."); return; }
    if (customStart > customEnd) { setError("Start date must be before end date."); return; }
    setError(null);
    (async () => {
      setLoadingMeta(true);
      try {
        let token: string | null = null;
        try { const { data } = await supabase.auth.getSession(); token = (data as any)?.session?.access_token ?? null; } catch {}
        const headers: HeadersInit = {};
        if (token) headers["Authorization"] = `Bearer ${token}`;
        const query = new URLSearchParams();
        query.set("start", customStart);
        query.set("end", customEnd);
        const resp = await fetch(`/api/integrations/metrics?${query.toString()}`, { headers });
        if (resp.ok) {
          const j = await resp.json();
          setMetaSummary(j as SummaryResp);
          hydrateUiFromMeta(j as SummaryResp);
        } else {
          const txt = await resp.text();
          setError(txt);
        }
      } catch (err: any) { setError(String(err)); }
      setLoadingMeta(false);
    })();
  }

  function goToIntegrations(platform?: "meta" | "google") { window.location.href = "/integrations"; }

  /* -------------------- derived values for UI -------------------- */
  const metaSpend = metaSummary?.meta?.current?.total_spend ?? 0;
  const metaBudgetDaily = metaSummary?.meta?.current?.budget_estimate_daily ?? null;
  const totalSpendAll = metaSpend;

  const overallMetrics = [
    {
      label: "Impressions",
      value: metaSummary?.meta?.current?.total_reach ? `${Math.round((metaSummary.meta.current.total_reach) / 1000)}K` : "—",
      change: pctDisplay(metaSummary?.meta?.change?.total_reach_pct ?? null),
      trend: (metaSummary?.meta?.change?.total_reach_pct ?? 0) > 0 ? "up" : "down",
    },
    {
      label: "Clicks",
      value: metaSummary?.meta?.current?.avg_ctr ? `${Math.round(((metaSummary.meta.current.total_reach ?? 0) * ((metaSummary.meta.current.avg_ctr ?? 0) / 100))).toLocaleString()}` : "—",
      change: pctDisplay(metaSummary?.meta?.change?.avg_ctr_pct ?? null),
      trend: (metaSummary?.meta?.change?.avg_ctr_pct ?? 0) > 0 ? "up" : "down",
    },
    {
      label: "CTR",
      value: metaSummary?.meta?.current?.avg_ctr ? `${(metaSummary.meta.current.avg_ctr).toFixed(2)}%` : "—",
      change: pctDisplay(metaSummary?.meta?.change?.avg_ctr_pct ?? null),
      trend: (metaSummary?.meta?.change?.avg_ctr_pct ?? 0) > 0 ? "up" : "down",
    },
    {
      label: "Spend",
      value: metaSummary?.meta?.current?.total_spend ? fmtMoneyINR(metaSummary.meta.current.total_spend) : fmtMoneyINR(totalSpendAll),
      change: pctDisplay(metaSummary?.meta?.change?.total_spend_pct ?? null),
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
      value: metaSummary?.meta?.current?.conversions ? `${metaSummary.meta.current.conversions}` : "—",
      change: pctDisplay(metaSummary?.meta?.change?.conversions_pct ?? null),
      trend: (metaSummary?.meta?.change?.conversions_pct ?? 0) > 0 ? "up" : "down",
    },
  ];

  const filteredCampaigns = campaigns.filter(c => {
    if (!query) return true;
    const q = query.toLowerCase();
    return (c.name ?? "").toLowerCase().includes(q) || (c.platform ?? "").toLowerCase().includes(q) || (c.campaign_type ?? "").toLowerCase().includes(q);
  });

  const selectedCampaign = campaigns.find(c => c.id === selectedCampaignId) ?? null;

  const rightPanelRecs = selectedCampaignId
    ? recList.filter(r => r.campaignId === selectedCampaignId || !r.campaignId)
    : recList.filter(r => !r.campaignId || r.campaignId === recList[0]?.campaignId);

  /* -------------------- render -------------------- */
  return (
    <div className="min-h-screen flex bg-slate-50">
      <Sidebar />
      <main className="flex-1 p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">AI Analytics</h2>
            <p className="text-sm text-slate-500">Deep insights across your connected platforms</p>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right mr-4">
              <div className="text-sm text-slate-500">Total Spend (All platforms)</div>
              <div className="text-xl font-semibold text-slate-900">{fmtMoneyINR(totalSpendAll)}</div>
            </div>

            <button onClick={() => { fetchCampaigns(); fetchStatuses(); fetchMetrics(); }} className="px-3 py-2 text-sm rounded-lg border border-slate-300 hover:bg-slate-100">Refresh</button>
            <Button variant="outline" size="sm">
              <Share2 className="w-4 h-4 mr-2" />
              Export
            </Button>
          </div>
        </div>

        <h3 className="text-lg font-semibold text-slate-700 mb-3">Overview</h3>

        <div className="space-y-4 mb-8">
          {/* Top card with restored time-range UI and added Budget */}
          <div className="p-4 bg-white rounded-xl shadow">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-3">
                <BarChart3 className="w-5 h-5 text-slate-600" />
                <div>
                  <div className="text-sm text-slate-500">Meta (Facebook & Instagram)</div>
                  <div className="text-lg font-semibold">Live account metrics</div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="text-sm text-gray-500">Period: {selectedRange === "custom" ? (customStart && customEnd ? `${customStart} → ${customEnd}` : "Custom range") : selectedRange}</div>
                <div className="flex items-center gap-2 ml-4">
                  {ranges.map(r => (
                    <button key={r} onClick={() => handleRangeClick(r)} className={`text-xs px-2 py-1 rounded ${selectedRange === r ? "bg-blue-600 text-white" : "border border-slate-200 bg-white"}`}>{r}</button>
                  ))}
                </div>
              </div>
            </div>

            {statusLoading ? (
              <div>Checking connection status…</div>
            ) : !isMetaConnectedLocal() ? (
              <div className="p-6 text-center">
                <div className="text-lg font-semibold text-slate-800">Please connect Meta</div>
                <div className="text-sm text-slate-600 mt-2">No connected Facebook / Instagram account found. Connect to view live metrics.</div>
                <div className="mt-4">
                  <button onClick={() => goToIntegrations("meta")} className="px-4 py-2 rounded bg-blue-600 text-white">Connect Meta</button>
                </div>
                {statuses ? <pre className="text-xs mt-3 bg-gray-50 p-2 rounded text-left overflow-auto">{JSON.stringify(statuses, null, 2)}</pre> : null}
              </div>
            ) : loadingMeta ? (
              <div>Loading Meta metrics…</div>
            ) : metaSummary?.meta?.current ? (
              <div className="grid grid-cols-6 gap-4">
                {overallMetrics.map((m, i) => (
                  <div key={i} className="p-4 bg-gray-50 rounded">
                    <div className="text-sm text-slate-500">{m.label}</div>
                    <div className="text-xl font-bold text-slate-800">{m.value}</div>
                    <div className={`text-xs mt-1 ${m.trend === "up" ? "text-green-600" : "text-red-600"}`}>{m.change}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-red-600">
                Could not fetch Meta metrics.
                {error ? <pre className="text-xs mt-2">{error}</pre> : <div className="text-xs mt-1">Try reconnecting or ensure the integration row contains tokens/ad account.</div>}
              </div>
            )}
          </div>

          {/* Performance timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><BarChart3 className="w-5 h-5" /> Performance Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer config={{ impressions: { label: "Impressions", color: "hsl(var(--primary))" }, clicks: { label: "Clicks", color: "hsl(var(--chart-2))" } }} className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={performanceData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="date" className="text-xs" />
                    <YAxis className="text-xs" />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Line type="monotone" dataKey="impressions" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ fill: "hsl(var(--primary))" }} />
                    <Line type="monotone" dataKey="clicks" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={{ fill: "hsl(var(--chart-2))" }} />
                  </LineChart>
                </ResponsiveContainer>
              </ChartContainer>
            </CardContent>
          </Card>
        </div>

        {/* Platform Performance (Google removed) */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Platform Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { platform: "Meta", spend: metaSummary?.meta?.current?.total_spend ?? 0, roas: metaSummary?.meta?.current?.roas ?? null, ctr: metaSummary?.meta?.current?.avg_ctr ?? null, colorClass: "bg-blue-500" },
              ].map((p, i) => (
                <div key={i} className="flex items-center gap-4">
                  <div className={`${p.colorClass} w-3 h-3 rounded-full`} />
                  <div className="flex-1">
                    <div className="font-medium">{p.platform}</div>
                    <div className="text-sm text-muted-foreground">{p.spend ? `Spend: ${fmtMoneyINR(p.spend)}` : "No data"}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium">{p.roas ? `${p.roas}x` : "—"}</div>
                    <div className="text-sm text-muted-foreground">ROAS</div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium">{p.ctr ? `${(p.ctr as number).toFixed(1)}%` : "—"}</div>
                    <div className="text-sm text-muted-foreground">CTR</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Campaigns list (simplified) */}
        <h3 className="text-lg font-semibold text-slate-700 mb-3 mt-6">Campaigns</h3>
        <div className="space-y-3">
          <div className="flex gap-4 mb-3">
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search campaigns..." className="flex-1 px-3 py-2 border rounded-lg" />
            <Button variant="outline" onClick={() => { fetchCampaigns(); }}>Refresh</Button>
          </div>

          {campaignsLoading ? <div>Loading campaigns…</div> : filteredCampaigns.length === 0 ? <div className="text-sm text-slate-500">No campaigns found.</div> : null}

          <div className="grid grid-cols-1 gap-3">
            {filteredCampaigns.map(c => (
              <Card key={c.id} className={`p-4 ${selectedCampaignId === c.id ? "ring-2 ring-blue-500" : ""}`} onClick={() => setSelectedCampaignId(c.id)}>
                <CardContent className="flex items-center justify-between">
                  <div>
                    <div className="font-semibold">{c.name}</div>
                    <div className="text-sm text-slate-500">{c.campaign_type ?? c.platform ?? "Meta"}</div>
                  </div>
                  <div className="text-sm text-slate-400">{c.created_at ? new Date(c.created_at).toLocaleString() : "—"}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </main>

      {/* Right inspector panel now shows dynamic recommendations by default */}
      <aside className="w-[360px] border-l bg-white p-6 space-y-6">
        <div>
          <h3 className="text-lg font-bold">Recommendations</h3>
          <p className="text-sm text-slate-500">Dynamic suggestions based on account & campaign state</p>
        </div>

        {rightPanelRecs.length > 0 ? (
          <div className="space-y-3">
            {rightPanelRecs.map(r => (
              <div key={r.id} className={`p-4 rounded-lg shadow-sm ${r.resolved ? "opacity-60 bg-gray-50" : "bg-white border"}`}>
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-semibold text-slate-800">{r.title}</div>
                    {r.reason ? <div className="text-sm text-gray-600 mt-1">{r.reason}</div> : null}
                    {r.actions && r.actions.length > 0 ? (
                      <ul className="list-disc ml-5 mt-3 text-sm space-y-1">{r.actions.map((a, i) => <li key={i}>{a}</li>)}</ul>
                    ) : null}
                  </div>
                  <div className="text-right">
                    <div className={`text-xs px-2 py-1 rounded ${r.impact === "High" ? "bg-red-500 text-white" : r.impact === "Medium" ? "bg-orange-400 text-white" : "bg-gray-400 text-white"}`}>{r.impact ?? "—"}</div>
                    <div className="mt-2">
                      <button onClick={() => resolveRecommendation(r.id)} className="px-3 py-1 text-sm rounded bg-green-600 text-white hover:bg-green-700">Resolve</button>
                    </div>
                  </div>
                </div>
                {r.estimate ? <div className="text-xs text-gray-500 mt-3">{r.estimate}</div> : null}
                {r.campaignId ? <div className="text-xs text-slate-400 mt-2">Campaign: {campaigns.find(c => c.id === r.campaignId)?.name ?? r.campaignId}</div> : null}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-sm text-slate-500">No recommendations available right now.</div>
        )}
      </aside>
    </div>
  );
}
