// pages/dashboard.tsx
"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import type { JSX } from "react";
import Sidebar from "../app/web/src/components/Sidebar";
import { Button } from "../app/web/src/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../app/web/src/components/ui/card";
import {
  Plus,
  TrendingUp,
  DollarSign,
  MousePointerClick,
  Eye,
  Sparkles,
} from "lucide-react";

import colors from "../lib/colors";
import { apiFetch } from "../lib/apiFetch";
import { supabase } from "../lib/supabaseClient";

/* -------------------- Helpers & tokens -------------------- */
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

const {
  primary,
  mutedForeground,
  gradientPrimary,
  primary10,
  primary20,
  shadowGlow,
} = (colors as any) || {};

const primaryColor = typeof primary === "string" ? primary : undefined;
const mutedFg = typeof mutedForeground === "string" ? mutedForeground : undefined;

const primaryBg10 = typeof primary10 === "string" ? primary10 : primaryColor ? hexToRgba(primaryColor, 0.10) : undefined;
const primaryBorder10 = typeof primary20 === "string" ? primary20 : primaryColor ? hexToRgba(primaryColor, 0.10) : undefined;

/* -------------------- Types -------------------- */
type MetaMetrics = {
  total_spend: number;
  budget_estimate_daily: number | null;
  total_reach: number;
  avg_ctr: number;
  conversions: number;
  roas: number | null;
  purchase_value?: number;
};

type SummaryResp = {
  ok?: boolean;
  meta?: {
    current?: MetaMetrics;
    change?: Record<string, number | null>;
  };
  [k: string]: any;
};

type Campaign = {
  id: string;
  name: string;
  campaign_type?: string | null;
  image_url?: any;
  is_published?: boolean;
  created_at?: string;
  _raw?: any;
};

type Recommendation = {
  title?: string;
  impact?: "High" | "Medium" | "Low" | string;
  reason?: string;
  actions?: string[];
  estimate?: string;
};

/* -------------------- Component -------------------- */
export default function DashboardPage(): JSX.Element {
  const router = useRouter();

  const [userId, setUserId] = useState<string | null>(null);

  // statuses: per-user flags returned from /api/integrations/status and/or local cache
  const [statuses, setStatuses] = useState<Record<string, any> | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);

  const [metaSummary, setMetaSummary] = useState<SummaryResp | null>(null);
  const [loadingMeta, setLoadingMeta] = useState(false);

  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(true);

  // IMPORTANT: recommendations must NOT show until user explicitly clicks button.
  // Start with no recommendations and centered prompt.
  const [autoRecs, setAutoRecs] = useState<Recommendation[]>([]);
  const [recLoading, setRecLoading] = useState(false);
  const [recError, setRecError] = useState<string | null>(null);

  // show the centered prompt until user clicks the button
  const [recsCentered, setRecsCentered] = useState<boolean>(true);

  const metricsRange = "7d";

  // namespaced localStorage key for statuses to avoid cross-user collisions
  const LS_KEY_FOR = (uid: string | null) => `integrations_status_v1:${uid ?? "anon"}`;

  /* -------------------- Fetch statuses (user-scoped) -------------------- */
  async function fetchStatuses(uid: string | null) {
    setStatusLoading(true);
    try {
      if (!uid) {
        setStatuses(null);
        setStatusLoading(false);
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
              next[k] = !!data[k];
            });
          }
          setStatuses(next);
          try {
            localStorage.setItem(LS_KEY_FOR(uid), JSON.stringify(next));
          } catch {}
          setStatusLoading(false);
          return;
        } else {
          console.warn("user-scoped /api/integrations/status returned non-ok", res.status);
        }
      } catch (err) {
        console.debug("user-scoped status fetch failed, falling back to local cache", err);
      }

      try {
        const raw = localStorage.getItem(LS_KEY_FOR(uid));
        if (raw) {
          const parsed = JSON.parse(raw);
          const normalized: Record<string, boolean> = { meta: false, ...(parsed || {}) };
          setStatuses(normalized);
          setStatusLoading(false);
          return;
        }
      } catch (err) {
        console.debug("localStorage read failed:", err);
      }

      const initial: Record<string, boolean> = { meta: false };
      setStatuses(initial);
      try {
        localStorage.setItem(LS_KEY_FOR(uid), JSON.stringify(initial));
      } catch {}
    } catch (err) {
      console.error("fetchStatuses error:", err);
      setStatuses({ meta: false });
    } finally {
      setStatusLoading(false);
    }
  }

  /* -------------------- Fetch meta metrics (no cache), include supabase token if present (user-scoped) -------------------- */
  async function fetchMetaMetricsAllTime(uid: string | null) {
    setLoadingMeta(true);
    try {
      if (!uid) {
        setMetaSummary(null);
        setLoadingMeta(false);
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
      q.set("range", metricsRange);
      q.set("userId", uid);

      const resp = await fetch(`/api/integrations/metrics?${q.toString()}`, { method: "GET", headers, cache: "no-store", credentials: "same-origin" });

      if (resp.ok) {
        const j = await resp.json();
        setMetaSummary(j as SummaryResp);

        const hasMeaningfulMetrics = Boolean(j?.meta?.current && (j.meta.current.total_spend !== undefined || j.meta.current.total_reach !== undefined));
        if (hasMeaningfulMetrics) {
          const normalized: Record<string, any> = { meta: true };
          try {
            const rawLs = localStorage.getItem(LS_KEY_FOR(uid));
            if (rawLs) {
              const prev = JSON.parse(rawLs);
              Object.assign(normalized, prev);
            }
          } catch {}
          setStatuses(normalized);
          try { localStorage.setItem(LS_KEY_FOR(uid), JSON.stringify(normalized)); } catch {}
        }

        return;
      } else {
        console.warn("metrics fetch returned non-ok:", resp.status);
      }
    } catch (err) {
      console.error("fetchMetaMetricsAllTime error:", err);
    } finally {
      setLoadingMeta(false);
    }
  }

  /* -------------------- campaigns (only user's campaigns) -------------------- */
  async function fetchCampaigns(uid: string | null) {
    setLoadingCampaigns(true);
    try {
      if (!uid) {
        setCampaigns([]);
        setLoadingCampaigns(false);
        return;
      }

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
        _raw: c,
      })) as Campaign[];

      setCampaigns(normalized);
    } catch (err) {
      console.error("fetchCampaigns exception:", err);
      setCampaigns([]);
    } finally {
      setLoadingCampaigns(false);
    }
  }

  /* -------------------- Candidates builder (same logic) -------------------- */
  function buildDynamicCandidates(summary: SummaryResp | null, campaignsList: Campaign[]) {
    const meta = summary?.meta?.current ?? null;
    const change = summary?.meta?.change ?? null;

    const candidates: Array<{ r: Recommendation; score: number }> = [];

    if (meta) {
      candidates.push({
        r: {
          title: "Reallocate budget to improve ROAS",
          impact: (meta.roas ?? 0) < 2 ? "High" : "Medium",
          reason: `All-time ROAS is ${(meta.roas ?? 0).toFixed(2)}x — focus spend on best performers.`,
          actions: ["Move budget to top ad sets", "Pause low-ROAS creatives", "Increase bid on winners"],
          estimate: "Expected +10–40% ROAS uplift",
        },
        score: ((meta.roas ?? 0) < 2 ? 8 : 4),
      });

      candidates.push({
        r: {
          title: "Improve CTR with creative experiments",
          impact: (meta.avg_ctr ?? 0) < 2 ? "High" : "Medium",
          reason: `Average CTR ${(meta.avg_ctr ?? 0).toFixed(2)}% suggests creative fatigue or weak hooks.`,
          actions: ["Test short vs long primary text", "Swap thumbnails & headlines", "Try bold CTA variants"],
          estimate: "Potential +10–30% CTR",
        },
        score: ((meta.avg_ctr ?? 0) < 1 ? 7 : (meta.avg_ctr ?? 0) < 2 ? 4 : 1),
      });

      candidates.push({
        r: {
          title: "Conversion & tracking audit",
          impact: ((meta.total_spend ?? 0) > 1000 && (meta.conversions ?? 0) < 20) ? "High" : "Medium",
          reason: `Spent ${fmtMoney(meta.total_spend)} with ${(meta.conversions ?? 0)} conversions — verify funnels & events.`,
          actions: ["Verify pixel firing & server events", "Audit landing page UX", "Run CRO experiments"],
          estimate: "Potential +15–60% conversions",
        },
        score: ((meta.total_spend ?? 0) > 1000 && (meta.conversions ?? 0) < 20 ? 9 : 3),
      });

      if (change) {
        candidates.push({
          r: {
            title: "Address negative ROAS trend",
            impact: (change.roas_pct ?? 0) < 0 ? "High" : "Low",
            reason: `ROAS change: ${pctDisplay(change.roas_pct ?? null)} — check recent creative & audience changes.`,
            actions: ["Rollback recent targeting tweaks", "Compare cohorts by date"],
            estimate: "Stabilize ROAS",
          },
          score: (change.roas_pct ?? 0) < 0 ? 6 : 1,
        });
      }
    } else {
      candidates.push({
        r: {
          title: "Connect Meta account for accurate metrics",
          impact: "High",
          reason: "No Meta metrics available — connect to fetch real account data and recommendations.",
          actions: ["Go to Integrations and connect Meta account"],
          estimate: "Unlock full diagnostics",
        },
        score: 10,
      });
    }

    candidates.push({
      r: {
        title: "Run more low-budget tests",
        impact: campaignsList.length < 3 ? "Medium" : "Low",
        reason: `You have ${campaignsList.length} campaigns — more tests increase chance to find winners.`,
        actions: ["Launch 2–3 low-budget experiments", "Test new audiences & creatives"],
        estimate: "Discover higher-performing segments",
      },
      score: campaignsList.length < 3 ? 5 : 1,
    });

    candidates.push({
      r: {
        title: "Audit audience overlap & frequency",
        impact: "Medium",
        reason: "Check frequency and audience overlap to reduce fatigue and wasted spend.",
        actions: ["Check frequency by campaign", "Split overlapping audiences", "Rotate creatives weekly"],
        estimate: "Improve efficiency & CTR",
      },
      score: 3,
    });

    const unique: Record<string, { r: Recommendation; score: number }> = {};
    for (const c of candidates) {
      const key = (c.r.title ?? "").trim();
      if (!key) continue;
      if (!unique[key]) unique[key] = c;
      else if (c.score > unique[key].score) unique[key] = c;
    }
    const sorted = Object.values(unique).sort((a, b) => b.score - a.score).map(v => v.r);
    return sorted;
  }

  function pickTopPriorityRecommendations(all: Recommendation[], limit = 3): Recommendation[] {
    const high = all.filter(a => (a.impact ?? "").toLowerCase() === "high");
    if (high.length > 0) return high.slice(0, limit);
    const medium = all.filter(a => (a.impact ?? "").toLowerCase() === "medium");
    if (medium.length > 0) return medium.slice(0, limit);
    return all.slice(0, limit);
  }

  /* -------------------- Generate & persist recommendations -------------------- */
  // THIS is the updated function — it calls your server endpoint when connected
  async function handleGetRecommendations() {
    setRecLoading(true);
    setRecError(null);

    // robust connected check:
    const metaCurrent = metaSummary?.meta?.current ?? null;
    const isConnected = Boolean(
      (statuses && statuses.meta === true) ||
      (metaCurrent && (metaCurrent.total_spend !== undefined || metaCurrent.total_reach !== undefined))
    );

    if (!isConnected) {
      setRecError("Please connect Meta to get recommendations.");
      setAutoRecs([]);
      setRecsCentered(false);
      setRecLoading(false);
      return;
    }

    try {
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

      const payload = {
        metrics: metaSummary?.meta ?? null,
        range: metricsRange,
      };

      const resp = await fetch("/api/recommendations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!resp.ok) {
        // fallback to local builder (keeps existing UX)
        try {
          const all = buildDynamicCandidates(metaSummary, campaigns);
          const chosen = pickTopPriorityRecommendations(all, 3);
          setAutoRecs(chosen);
          try {
            sessionStorage.setItem("auto_recs_v1", JSON.stringify({
              recs: chosen,
              metaTotal: metaSummary?.meta?.current?.total_spend ?? null,
              ts: Date.now(),
            }));
          } catch {}
          setRecsCentered(false);
          setRecError("Failed to fetch server recommendations — showing local suggestions.");
        } catch (fallbackErr) {
          console.error("fallback builder error", fallbackErr);
          setAutoRecs([]);
          setRecError("Failed to generate recommendations.");
        } finally {
          setRecLoading(false);
        }
        return;
      }

      const j = await resp.json();
      const recs = Array.isArray(j.recommendations) ? j.recommendations : [];
      // backend returns minimal records (id,title,reason,impact,confidence,campaignId,created_at)
      const normalized: Recommendation[] = recs.slice(0, 3).map((r: any) => ({
        title: r.title ?? r.name ?? "Recommendation",
        reason: r.reason ?? undefined,
        impact: r.impact ?? undefined,
        actions: r.actions ?? undefined,
        estimate: r.estimate ?? undefined,
      }));

      if (normalized.length === 0) {
        // fallback to local builder (only if server returned empty)
        const all = buildDynamicCandidates(metaSummary, campaigns);
        const chosen = pickTopPriorityRecommendations(all, 3);
        setAutoRecs(chosen);
        try {
          sessionStorage.setItem("auto_recs_v1", JSON.stringify({
            recs: chosen,
            metaTotal: metaSummary?.meta?.current?.total_spend ?? null,
            ts: Date.now(),
          }));
        } catch {}
        setRecsCentered(false);
        setRecError(null);
      } else {
        setAutoRecs(normalized);
        try {
          sessionStorage.setItem("auto_recs_v1", JSON.stringify({
            recs: normalized,
            metaTotal: metaSummary?.meta?.current?.total_spend ?? null,
            ts: Date.now(),
          }));
        } catch {}
        setRecsCentered(false);
        setRecError(null);
      }
    } catch (err) {
      console.error("handleGetRecommendations error:", err);
      // fallback to local builder on any exception
      try {
        const all = buildDynamicCandidates(metaSummary, campaigns);
        const chosen = pickTopPriorityRecommendations(all, 3);
        setAutoRecs(chosen);
        try {
          sessionStorage.setItem("auto_recs_v1", JSON.stringify({
            recs: chosen,
            metaTotal: metaSummary?.meta?.current?.total_spend ?? null,
            ts: Date.now(),
          }));
        } catch {}
        setRecsCentered(false);
        setRecError("Failed to fetch recommendations — showing local suggestions.");
      } catch {
        setAutoRecs([]);
        setRecError("Failed to generate recommendations.");
      }
    } finally {
      setRecLoading(false);
    }
  }

  /* -------------------- lifecycle: load data -------------------- */
  useEffect(() => {
    (async () => {
      try {
        const { data: userData, error: userErr } = await supabase.auth.getUser();
        if (userErr) {
          console.error("Error getting user from supabase.auth:", userErr);
          router.push("/auth/signin");
          return;
        }
        const user = (userData as any)?.user ?? null;
        if (!user) {
          router.push("/auth/signin");
          return;
        }
        setUserId(user.id);

        await Promise.all([
          fetchStatuses(user.id),
          fetchCampaigns(user.id),
          fetchMetaMetricsAllTime(user.id),
        ]);
      } catch (err) {
        console.error("init dashboard error:", err);
      }

      // NOTE: Deliberately DO NOT hydrate previous recommendations from sessionStorage
      // per user's request: show NO recommendations until the user clicks the button.
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* -------------------- helpers & UI -------------------- */
  function fmtMoney(n: number | null | undefined) {
    if (n == null) return "—";
    try {
      return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0 }).format(Number(n));
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

  const metaCurrent = metaSummary?.meta?.current ?? null;

  const isConnected = Boolean(
    (statuses && statuses.meta === true) ||
    (metaCurrent && (metaCurrent.total_spend !== undefined || metaCurrent.total_reach !== undefined))
  );

  const stats = [
    { label: "Total Campaigns", value: String(campaigns.length ?? 0), icon: Eye, connected: isConnected },
    { label: "Total Spend (All time)", value: metaCurrent ? fmtMoney(metaCurrent.total_spend) : "—", icon: DollarSign, connected: isConnected },
    { label: "Avg CTR (All time)", value: metaCurrent ? `${(metaCurrent.avg_ctr ?? 0).toFixed(2)}%` : "—", icon: MousePointerClick, connected: isConnected },
    { label: "ROAS (All time)", value: metaCurrent && metaCurrent.roas ? `${metaCurrent.roas.toFixed(2)}x` : "—", icon: TrendingUp, connected: isConnected },
  ];

  function goToIntegrations(platform?: string) {
    if (platform) window.location.href = `/integrations?connected=${platform}`;
    else window.location.href = "/integrations";
  }

  const getCampaignImageUrl = (c: Campaign) => {
    if (!c?.image_url) return null;
    if (Array.isArray(c.image_url)) return c.image_url.length ? c.image_url[0] : null;
    return String(c.image_url);
  };

  const cardShadowStyle = shadowGlow ? { boxShadow: shadowGlow } : undefined;

  /* -------------------- Render -------------------- */
  return (
    <div className="min-h-screen flex bg-slate-50">
      <Sidebar />
      <main className="flex-1 p-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-extrabold text-slate-900">Dashboard</h2>
            <p className="mt-1 text-sm" style={mutedFg ? { color: mutedFg } : undefined}>Overview — all-time metrics & actionable suggestions</p>
          </div>

          <div className="flex items-center gap-4">
            <Link href="/create-campaign" legacyBehavior>
              <a>
                <Button size="lg" className="!px-5 !py-3" style={primaryColor ? { background: gradientPrimary ?? primaryColor, color: "#fff" } : undefined}>
                  <Plus className="w-5 h-5 mr-2" /> New Campaign
                </Button>
              </a>
            </Link>
            <button onClick={() => { fetchStatuses(userId); fetchMetaMetricsAllTime(userId); fetchCampaigns(userId); }} className="px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-sm">
              Refresh
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-8">
          <div className="space-y-6">
            {/* -------------------- Stats area -------------------- */}
            {isConnected ? (
              <div className="pt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                {stats.map((stat, i) => {
                  const Icon = stat.icon;
                  const connected = stat.connected;
                  return (
                    <Card key={i} className="glass-card transition-transform transform hover:-translate-y-1" style={{ boxShadow: "0 36px 90px rgba(2,6,23,0.16)", borderColor: primaryBorder10 ?? undefined, ...cardShadowStyle }}>
                      <CardContent className="flex items-center justify-between gap-6 py-6">
                        <div className="flex items-center gap-5">
                          <div className="flex items-center justify-center rounded-md p-2 transition-shadow duration-200" style={{ color: primaryColor ?? "#0f172a" }}>
                            <Icon className="w-6 h-6 hover:scale-110 hover:shadow-[0_8px_30px_rgba(59,130,246,0.18)]" strokeWidth={1.6} />
                          </div>

                          <div>
                            <div className="text-sm text-slate-500">{stat.label}</div>
                            <div className="text-2xl font-semibold text-slate-900 mt-1">{stat.value}</div>
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-2">
                          {connected ? (
                            <span className="text-xs px-3 py-1 rounded-full bg-green-100 text-green-800">Connected</span>
                          ) : (
                            <button onClick={() => goToIntegrations("meta")} className="px-3 py-1 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700">
                              Connect Meta
                            </button>
                          )}
                          <div className="text-xs text-gray-500">{i === 1 && metaSummary?.meta?.change ? `Change: ${pctDisplay(metaSummary?.meta?.change.total_spend_pct ?? null)}` : ""}</div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <Card className="glass-card" style={{ boxShadow: "0 36px 90px rgba(2,6,23,0.16)", borderColor: primaryBorder10 ?? undefined }}>
                <CardContent className="py-12 flex flex-col items-center justify-center">
                  <Sparkles className="w-8 h-8 mb-4" />
                  <div className="text-lg font-semibold mb-2">Connect Meta</div>
                  <div className="text-sm mb-6" style={mutedFg ? { color: mutedFg } : undefined}>Connect your Meta account to view accurate metrics and recommendations.</div>
                  <div>
                    <Button size="lg" onClick={() => goToIntegrations()} style={primaryColor ? { background: gradientPrimary ?? primaryColor, color: "#fff" } : undefined}>
                      Connect
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* -------------------- Recommendations -------------------- */}
            <Card className="glass-card" style={{ boxShadow: "0 48px 120px rgba(2,6,23,0.18)", borderColor: primaryBorder10 ?? undefined }}>
              <CardHeader className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-3 py-3">
                  <Sparkles className="w-5 h-5" />
                  <span className="text-lg font-semibold">Top Recommendations</span>
                </CardTitle>

                {!recsCentered ? (
                  <div>
                    <Button size="sm" onClick={handleGetRecommendations} disabled={recLoading}>
                      {recLoading ? "Thinking…" : "Get Recommendations"}
                    </Button>
                  </div>
                ) : null}
              </CardHeader>

              <CardContent className="pt-1 pb-6">
                {recsCentered && autoRecs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <div className="mb-4 text-sm text-slate-600">Generate prioritized recommendations for this account</div>
                    <Button size="lg" onClick={handleGetRecommendations} disabled={recLoading}>
                      {recLoading ? "Thinking…" : "Get Recommendations"}
                    </Button>
                  </div>
                ) : (
                  <>
                    {recError ? (
                      <div className="py-6 px-4 bg-yellow-50 border border-yellow-100 rounded text-sm text-amber-800">
                        {recError}
                      </div>
                    ) : null}

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-3">
                      {autoRecs.map((r, idx) => {
                        const impact = r.impact ?? "Medium";
                        const impactClass = impact === "High" ? "bg-red-600 text-white" : impact === "Medium" ? "bg-orange-400 text-white" : "bg-gray-400 text-white";
                        return (
                          <div key={idx} className="rounded-lg bg-white p-5" style={{ boxShadow: "0 44px 90px rgba(15,23,42,0.18)" }}>
                            <div className="flex items-start justify-between gap-4">
                              <div className="min-w-0">
                                <div className="text-sm font-semibold leading-tight">{r.title}</div>
                                <div className="text-xs mt-2" style={mutedFg ? { color: mutedFg } : { color: "#6b7280" }}>{r.reason}</div>
                                {r.actions && r.actions.length ? (
                                  <ul className="list-disc ml-5 mt-3 text-sm">
                                    {r.actions.map((a, i) => <li key={i}>{a}</li>)}
                                  </ul>
                                ) : null}
                                {r.estimate ? <div className="text-xs text-gray-500 mt-3">{r.estimate}</div> : null}
                              </div>

                              <div className="flex-shrink-0">
                                <span className={`text-xs px-3 py-1 rounded ${impactClass}`}>{impact}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="mt-4 text-xs text-gray-500">Recommendations are generated from account metrics and campaign history. Click the top-right button to refresh.</div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* -------------------- Recent Campaigns -------------------- */}
            <Card className="glass-card" style={{ boxShadow: "0 36px 72px rgba(15,23,42,0.14)" }}>
              <CardHeader>
                <CardTitle className="py-3">Recent Campaigns</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {loadingCampaigns ? <div>Loading campaigns…</div> : campaigns.length === 0 ? <div className="text-sm text-gray-500">No campaigns yet. Create a campaign to get started.</div> : null}

                  {campaigns.slice(0, 5).map((campaign) => (
                    <div key={campaign.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-3">
                        {getCampaignImageUrl(campaign) ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={getCampaignImageUrl(campaign)!} alt={campaign.name} className="w-16 h-12 object-cover rounded" />
                        ) : (
                          <div className="w-16 h-12 rounded bg-slate-100 flex items-center justify-center text-sm text-slate-400">No image</div>
                        )}
                        <div>
                          <div className="font-medium">{campaign.name}</div>
                          <div className="text-xs" style={mutedFg ? { color: mutedFg } : { color: "#6b7280" }}>{campaign.campaign_type || "General"}</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className={`text-xs px-2 py-1 rounded-full ${campaign.is_published ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}`}>{campaign.is_published ? "Active" : "Draft"}</div>
                        <div className="flex gap-2">
                          {getCampaignImageUrl(campaign) ? (
                            <a href={getCampaignImageUrl(campaign)!} target="_blank" rel="noopener noreferrer" className="px-3 py-1 text-sm border rounded-lg hover:bg-slate-100">View</a>
                          ) : (
                            <a href={`/campaigns/${campaign.id}`} target="_blank" rel="noopener noreferrer" className="px-3 py-1 text-sm border rounded-lg hover:bg-slate-100">View</a>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
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
function pctDisplay(n: number | null | undefined) {
  if (n == null) return "—";
  const r = Math.round((n as number) * 10) / 10;
  const sign = r > 0 ? "+" : "";
  return `${sign}${r}%`;
}
