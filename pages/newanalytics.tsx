// pages/analytics.tsx
"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import Sidebar from "../app/web/src/components/Sidebar";
import { apiFetch } from "../lib/apiFetch";
import { supabase } from "../lib/supabaseClient";
import colors from "../lib/colors";

import { Card, CardContent, CardHeader, CardTitle } from "../app/web/src/components/ui/card";
import { Button } from "../app/web/src/components/ui/button";
import { Badge } from "../app/web/src/components/ui/badge";
import {
  BarChart3,
  Share2,
} from "lucide-react";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  TooltipProps,
  Legend,
  ReferenceLine,
} from "recharts";

type MetaMetrics = {
  total_spend: number;
  budget_estimate_daily: number | null;
  total_reach: number;
  avg_ctr: number;
  conversions: number;
  roas: number | null;
};

type TimeSeriesPoint = {
  date: string; // ISO or human date
  impressions?: number;
  clicks?: number;
  spend?: number;
  ctr?: number; // percent (e.g. 1.2)
  conversions?: number;
  roas?: number | null;
};

type SummaryResp = {
  ok: boolean;
  meta?: {
    current?: MetaMetrics;
    change?: Record<string, number | null>;
    // optional time_series returned by backend if available:
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

/* generate N human-friendly date labels ending at endDate (inclusive) */
function generateDateLabels(count = 7, endDate?: Date) {
  const end = endDate ? new Date(endDate) : new Date();
  const labels: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(end);
    d.setDate(end.getDate() - i);
    labels.push(d.toLocaleDateString("en-IN", { day: "numeric", month: "short" })); // e.g. 16 Nov
  }
  return labels;
}

/* infer latest activity date from campaigns (most recent created_at) */
function inferLatestActivityDate(campaigns: Campaign[]) {
  const dates = campaigns
    .map(c => c.created_at ? new Date(c.created_at) : null)
    .filter(Boolean) as Date[];
  if (dates.length === 0) return null;
  const max = new Date(Math.max(...dates.map(d => d.getTime())));
  return max;
}

/* try to extract a numeric safe value */
function safeNum(v: any, fallback = 0) {
  if (v == null || v === "") return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/* custom tooltip small wrapper */
const GenericTooltip = ({ active, payload, label }: TooltipProps<string, string>) => {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="p-2 bg-white rounded shadow text-xs border">
      <div className="font-semibold">{label}</div>
      {payload.map((p, i) => (
        <div key={i} className="flex justify-between gap-2">
          <div>{p.name}</div>
          <div className="font-medium">{typeof p.value === "number" ? (p.name.toLowerCase().includes("ctr") ? `${Number(p.value).toFixed(2)}%` : (p.name.toLowerCase().includes("spend") ? fmtMoneyINR(Number(p.value)) : Number(p.value).toLocaleString())) : p.value}</div>
        </div>
      ))}
    </div>
  );
};

/* defensive JSON extractor to pull JSON block out of text responses */
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

/* split text heuristically into multiple recommendations */
function splitTextIntoRecommendations(text: string): string[] {
  if (!text) return [];
  // try numbered lists
  let parts = text.split(/\n\s*\d+\.\s/).map(s => s.trim()).filter(Boolean);
  if (parts.length > 1) return parts;
  // double newlines
  parts = text.split(/\n{2,}/).map(s => s.trim()).filter(Boolean);
  if (parts.length > 1) return parts;
  // bullets
  parts = text.split(/[\u2022\u2023\-•\*]\s+/).map(s => s.trim()).filter(Boolean);
  if (parts.length > 1) return parts;
  // as last resort, split into sentence chunks (1-3 sentences per chunk)
  const sentences = text.split(/[.?!]\s+/).map(s => s.trim()).filter(Boolean);
  if (sentences.length === 0) return [text.trim()].filter(Boolean);
  const chunks: string[] = [];
  for (let i = 0; i < sentences.length; i += 2) {
    const chunk = sentences.slice(i, i + 2).join(". ").trim();
    if (chunk) chunks.push(chunk + (chunk.endsWith(".") ? "" : "."));
    if (chunks.length >= 10) break;
  }
  return chunks.length ? chunks : [text.trim()];
}

/* -------------------- component -------------------- */
export default function Analytics(): JSX.Element {
  // state kept identical
  const [statuses, setStatuses] = useState<Record<string, any> | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);

  const [metaSummary, setMetaSummary] = useState<SummaryResp | null>(null);
  const [loadingMeta, setLoadingMeta] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [recList, setRecList] = useState<Recommendation[]>([]);
  const [aiRaw, setAiRaw] = useState<any | null>(null);
  const [recLoading, setRecLoading] = useState(false);

  const ranges = ["1d", "7d", "15d", "1m", "3m", "6m", "1y", "custom"] as const;
  const [selectedRange, setSelectedRange] = useState<typeof ranges[number]>("7d");
  const [customStart, setCustomStart] = useState<string>("");
  const [customEnd, setCustomEnd] = useState<string>("");

  const [selectedChannel, setSelectedChannel] = useState<string>("all");
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campaignsLoading, setCampaignsLoading] = useState<boolean>(true);
  const [query, setQuery] = useState<string>("");

  // chart series (canonical timeseries used by all charts)
  const [series, setSeries] = useState<TimeSeriesPoint[]>([]);

  useEffect(() => {
    fetchCampaigns();
    fetchStatuses();
    fetchMetrics(); // hydrate UI and series
    function onStorage(e: StorageEvent) {
      if (e.key === LS_KEY) {
        try { setStatuses(e.newValue ? JSON.parse(e.newValue) : null); } catch {}
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* -------------------- NOTE: auto-recommendations removed intentionally -------------------- */
  /* All recommendation fetching is now manual — trigger via the Get Recommendations button. */

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

  /* -------------------- fetch metrics (unchanged backend) -------------------- */
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
        // fallback to synthesized series but aligned to last activity
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

  /* -------------------- build/hydrate UI data and series -------------------- */
  function hydrateUiFromMeta(summary: SummaryResp | null) {
    // prefer time_series from backend if available (most accurate)
    if (summary?.meta?.time_series && Array.isArray(summary.meta.time_series) && summary.meta.time_series.length > 0) {
      // normalize dates to human labels and set series
      const ordered = summary.meta.time_series.map((p) => ({
        date: new Date(p.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
        impressions: safeNum(p.impressions, 0),
        clicks: safeNum(p.clicks, 0),
        spend: safeNum(p.spend, 0),
        ctr: p.ctr != null ? safeNum(p.ctr, 0) : undefined,
        conversions: safeNum(p.conversions, 0),
        roas: p.roas ?? null,
      }));
      setSeries(ordered);
    } else {
      // Build synthetic series from current metrics but align to last activity
      const pointCount = 7;
      const lastActivity = inferLatestActivityDate(campaigns);
      const endDate = lastActivity ?? new Date(); // if user ran ads long time ago, this will reflect it
      const labels = generateDateLabels(pointCount, endDate);

      if (summary?.meta?.current) {
        const cur = summary.meta.current;
        // weights to distribute totals across points
        const weights = [0.08, 0.09, 0.14, 0.16, 0.18, 0.17, 0.18].slice(0, pointCount);
        const synth = weights.map((w, i) => ({
          date: labels[i],
          impressions: Math.round((cur.total_reach ?? 0) * w),
          clicks: Math.round(((cur.total_reach ?? 0) * ((cur.avg_ctr ?? 0) / 100)) * w),
          spend: Math.round((cur.total_spend ?? 0) * w),
          ctr: cur.avg_ctr ?? undefined,
          conversions: Math.round((cur.conversions ?? 0) * w),
          roas: cur.roas ?? null,
        }));
        setSeries(synth);
      } else {
        // pure synthetic fallback (no backend metrics) but aligned to last activity
        const syntheticImpr = [120000,125000,118000,132000,128000,135000,142000];
        const syntheticClicks = [4200,4500,4100,4800,4600,5000,5300];
        const syntheticSpend = [1200,1250,1180,1320,1280,1350,1420];
        const synth = labels.map((lab, i) => ({
          date: lab,
          impressions: syntheticImpr[i] ?? 100000,
          clicks: syntheticClicks[i] ?? 4000,
          spend: syntheticSpend[i] ?? 1200,
          ctr: Number(((syntheticClicks[i] ?? 4000) / ((syntheticImpr[i] ?? 100000) || 1) * 100).toFixed(2)),
          conversions: Math.round(((syntheticClicks[i] ?? 4000) * 0.08)),
          roas: null,
        }));
        setSeries(synth);
      }
    }

    // build recommendations (kept consistent with previous logic)
    const suggestions: Recommendation[] = [];

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

    for (const c of campaigns) {
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

    const deduped: Record<string, Recommendation> = {};
    for (const s of suggestions) {
      if (!s.id) s.id = (Math.random() + "").slice(2);
      deduped[s.id] = s;
    }
    setRecList(Object.values(deduped));
  }

  /* -------------------- IMPROVED: askRecommendations (robust parsing + fill to 10) -------------------- */
  async function askRecommendations() {
    setRecLoading(true);
    setRecList([]); // show loading state
    setAiRaw(null);

    try {
      const metricsPayload = {
        meta: metaSummary?.meta ?? null,
        note: "Return JSON with key 'recommendations' (array) where each item: title, impact, reason, actions[], estimate. Provide up to 10 recommendations prioritized.",
      };

      const resp = await fetch("/api/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ metrics: metricsPayload }),
      });

      const j = await resp.json();
      setAiRaw(j);

      // 1) Try direct parsed field
      let parsed: any = j?.parsed ?? null;

      // 2) Try choices content (OpenAI-like shapes)
      if (!parsed && j?.raw?.choices?.[0]?.message?.content) parsed = extractJsonFromText(j.raw.choices[0].message.content);

      // 3) Try raw string
      if (!parsed && typeof j?.raw === "string") parsed = extractJsonFromText(j.raw);

      // 4) Try raw top-level text
      if (!parsed && typeof j?.text === "string") parsed = extractJsonFromText(j.text);

      // 5) Try entire response string
      if (!parsed && typeof j === "object") parsed = extractJsonFromText(JSON.stringify(j));

      // Collect candidate array
      let arr: any[] = [];
      if (parsed) {
        if (Array.isArray(parsed)) arr = parsed;
        else if (Array.isArray(parsed.recommendations)) arr = parsed.recommendations;
        else if (Array.isArray(parsed.recs)) arr = parsed.recs;
        else {
          // find first array-valued property
          const maybe = Object.values(parsed).find(v => Array.isArray(v));
          if (maybe) arr = maybe as any[];
        }
      }

      // If we didn't get an array, try heuristic splits against likely text fields
      const candidateTexts: string[] = [];
      if ((!arr || arr.length === 0) && (typeof j?.raw === "string" || typeof j?.text === "string" || typeof j === "string")) {
        if (typeof j?.raw === "string") candidateTexts.push(j.raw);
        if (typeof j?.text === "string") candidateTexts.push(j.text);
        if (typeof j === "string") candidateTexts.push(j as string);
      }
      // also add choices message content as candidate text
      if ((!arr || arr.length === 0) && j?.raw?.choices?.[0]?.message?.content) candidateTexts.push(j.raw.choices[0].message.content);

      // process candidate texts into arrays
      for (const t of candidateTexts) {
        if (arr.length >= 10) break;
        const parts = splitTextIntoRecommendations(String(t));
        for (const p of parts) {
          if (arr.length >= 10) break;
          arr.push({ reason: p });
        }
      }

      // If parsed produced objects but too few, try extracting more from raw text
      if (arr.length > 0 && arr.length < 10) {
        const rawAll = JSON.stringify(j);
        const extraParts = splitTextIntoRecommendations(rawAll);
        for (const p of extraParts) {
          if (arr.length >= 10) break;
          // don't duplicate identical reasons
          const already = arr.find(a => String(a.reason || a.title || a.title === p));
          if (!already) arr.push({ reason: p });
        }
      }

      // Final fallback: if still empty, provide a few heuristic recs derived from metaSummary & campaigns
      if ((!arr || arr.length === 0)) {
        const fallback: any[] = [];
        if (metaSummary?.meta?.current) {
          const cur = metaSummary.meta.current;
          if (cur.roas == null || cur.roas < 3) fallback.push({ title: "Check top converting adsets", reason: `Account ROAS ${cur.roas ?? "—"} — prioritize top converters.` });
          if ((cur.avg_ctr ?? 0) < 1.5) fallback.push({ title: "Test new creatives", reason: "Low CTR — rotate creatives and headlines." });
          if ((cur.total_reach ?? 0) > 100000 && (cur.conversions ?? 0) < 50) fallback.push({ title: "Audit funnel & tracking", reason: "High reach but low conversions — check landing pages and tracking." });
        }
        // add some generic recs if still small
        while (fallback.length < 5) {
          fallback.push({ reason: "Monitor ad fatigue — refresh creatives when CTR drops." });
          if (fallback.length >= 5) break;
        }
        arr = fallback;
      }

      // Normalize items and limit to 10
      const normalized = arr.slice(0, 10).map(normalizeRec);

      // dedupe by reason/title
      const seen = new Set<string>();
      const deduped: Recommendation[] = [];
      for (const r of normalized) {
        const key = (r.title ?? r.reason ?? "").slice(0, 200);
        if (!key) continue;
        if (seen.has(key)) continue;
        seen.add(key);
        deduped.push(r);
      }

      // ensure at least 3 recommendations present (if possible)
      if (deduped.length < 3) {
        // create small synthetic recs from metaSummary
        if (metaSummary?.meta?.current) {
          const cur = metaSummary.meta.current;
          if ((cur.avg_ctr ?? 0) < 2) deduped.push(normalizeRec({ title: "Improve CTR", reason: "CTR below 2% — test creatives & CTAs.", impact: "Medium" }));
          if ((cur.roas ?? 0) < 3) deduped.push(normalizeRec({ title: "Improve ROAS", reason: "ROAS below 3x — reallocate budget & optimize bids.", impact: "High" }));
        }
      }

      // finally set recList and cache in sessionStorage
      setRecList(deduped);
      try {
        sessionStorage.setItem("auto_recs_v1", JSON.stringify({ recs: deduped, metaTotal: metaSummary?.meta?.current?.total_spend ?? null, ts: Date.now() }));
      } catch {}
    } catch (err: any) {
      console.error("askRecommendations error", err);
      setAiRaw({ error: String(err) });
      setRecList([]);
    } finally {
      setRecLoading(false);
    }
  }

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
    setTimeout(() => setRecList(prev => prev.filter(r => r.id !== id)), 900);
  }

  function handleRangeClick(r: typeof ranges[number]) {
    setSelectedRange(r);
    if (r !== "custom") {
      setCustomStart("");
      setCustomEnd("");
      fetchMetrics();
    }
  }

  async function handleApplyCustomRange() {
    if (!customStart || !customEnd) { setError("Please pick both start and end for custom range."); return; }
    if (customStart > customEnd) { setError("Start date must be before end date."); return; }
    setError(null);
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
  }

  function goToIntegrations(platform?: "meta" | "google") { window.location.href = "/integrations"; }

  /* derived values */
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
    ? recList.filter(r => (r.campaignId === selectedCampaignId) || !r.campaignId)
    : recList.filter(r => !r.campaignId || r.campaignId === recList[0]?.campaignId);

  /* memoized date range string for UI */
  const dateRangeLabel = useMemo(() => {
    if (!series || series.length === 0) return "";
    const first = series[0].date;
    const last = series[series.length - 1].date;
    return `${first} → ${last}`;
  }, [series]);

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

            {/* Manual Get Recommendations button (replaces auto-fetch) */}
            <Button onClick={askRecommendations} size="sm" className="ml-2">
              {recLoading ? "Thinking…" : "Get Recommendations"}
            </Button>
          </div>
        </div>

        <h3 className="text-lg font-semibold text-slate-700 mb-3">Overview</h3>

        <div className="space-y-4 mb-8">
          {/* Top card with restored time-range UI */}
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

          {/* Charts grid: 6 charts (different styles) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 1) Impressions (Line) */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><BarChart3 className="w-5 h-5" /> Impressions — {dateRangeLabel}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4 mb-3">
                  <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full" style={{ background: "hsl(210 100% 56%)" }} /> Impressions</div>
                  <div className="ml-auto text-xs text-slate-500">Data aligned to last activity date</div>
                </div>
                <div className="h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={series}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                      <YAxis />
                      <Tooltip content={<GenericTooltip />} />
                      <Legend />
                      <Line type="monotone" dataKey="impressions" name="Impressions" stroke="hsl(210 100% 56%)" strokeWidth={2} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* 2) Clicks (Area) */}
            <Card>
              <CardHeader>
                <CardTitle>Clicks — {dateRangeLabel}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4 mb-3">
                  <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full" style={{ background: "hsl(200 80% 45%)" }} /> Clicks</div>
                  <div className="ml-auto text-xs text-slate-500">Area highlights click volume</div>
                </div>
                <div className="h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={series}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip content={<GenericTooltip />} />
                      <Area type="monotone" dataKey="clicks" name="Clicks" stroke="hsl(200 80% 45%)" fill="rgba(30,130,230,0.12)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* 3) Spend (Bar) */}
            <Card>
              <CardHeader>
                <CardTitle>Spend — {dateRangeLabel}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4 mb-3">
                  <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full" style={{ background: "#3FA7FF" }} /> Spend</div>
                  <div className="ml-auto text-xs text-slate-500">Shows daily spend</div>
                </div>
                <div className="h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={series}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip content={<GenericTooltip />} />
                      <Bar dataKey="spend" name="Spend (INR)" fill="#3FA7FF" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* 4) CTR (Line - percent axis) */}
            <Card>
              <CardHeader>
                <CardTitle>CTR (%) — {dateRangeLabel}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4 mb-3">
                  <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full" style={{ background: "hsl(210 80% 50%)" }} /> CTR</div>
                  <div className="ml-auto text-xs text-slate-500">Click-through rate (percentage)</div>
                </div>
                <div className="h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={series}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis domain={[0, 'dataMax + 1']} tickFormatter={(v) => `${v}%`} />
                      <Tooltip content={<GenericTooltip />} />
                      <Line type="monotone" dataKey="ctr" name="CTR (%)" stroke="hsl(210 80% 50%)" strokeWidth={2} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* 5) Conversions (Bar) */}
            <Card>
              <CardHeader>
                <CardTitle>Conversions — {dateRangeLabel}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4 mb-3">
                  <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full" style={{ background: "#16A34A" }} /> Conversions</div>
                  <div className="ml-auto text-xs text-slate-500">Goal completions per day</div>
                </div>
                <div className="h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={series}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip content={<GenericTooltip />} />
                      <Bar dataKey="conversions" name="Conversions" fill="#16A34A" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* 6) ROAS (Area) */}
            <Card>
              <CardHeader>
                <CardTitle>ROAS — {dateRangeLabel}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4 mb-3">
                  <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full" style={{ background: "rgba(99,102,241,1)" }} /> ROAS</div>
                  <div className="ml-auto text-xs text-slate-500">Revenue / Ad spend (may be empty)</div>
                </div>
                <div className="h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={series}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip content={<GenericTooltip />} />
                      <Area type="monotone" dataKey="roas" name="ROAS" stroke="rgba(99,102,241,1)" fill="rgba(99,102,241,0.12)" strokeWidth={2} />
                      <ReferenceLine y={1} stroke="rgba(0,0,0,0.08)" ifOverflow="extendDomain" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

        </div>

        {/* Platform Performance */}
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

        {/* Campaigns list */}
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

      {/* Right inspector panel: recommendations — removed outline, use shadow */}
      <aside className="w-[360px] bg-white p-6 space-y-6">
        <div>
          <h3 className="text-lg font-bold">Recommendations</h3>
          <p className="text-sm text-slate-500">Dynamic suggestions based on account & campaign state</p>
        </div>

        {recLoading ? (
          <div className="text-sm text-slate-500">Generating recommendations…</div>
        ) : rightPanelRecs.length > 0 ? (
          <div className="space-y-3">
            {rightPanelRecs.map(r => (
              <div key={r.id} className={`p-4 rounded-lg shadow-md bg-white ${r.resolved ? "opacity-60" : ""}`}>
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
          <div className="text-sm text-slate-500">No recommendations available right now. Click "Get Recommendations" to generate them.</div>
        )}
      </aside>
    </div>
  );
}
