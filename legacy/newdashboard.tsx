// "use client";

// import React, { useEffect, useState } from "react";
// import Link from "next/link";

// import Sidebar from "../app/web/src/components/Sidebar";
// import { Button } from "../app/web/src/components/ui/button";
// import { Card, CardContent, CardHeader, CardTitle } from "../app/web/src/components/ui/card";
// import {
//   Plus,
//   TrendingUp,
//   DollarSign,
//   MousePointerClick,
//   Eye,
//   Sparkles,
// } from "lucide-react";

// import colors from "../lib/colors";
// import { apiFetch } from "../lib/apiFetch";
// import { supabase } from "../lib/supabaseClient";

// /* --------------------------------------------------------------------------
//    Helpers / color tokens (fall back gracefully if tokens missing)
//    -------------------------------------------------------------------------- */
// function hexToRgba(hex: string, alpha = 1) {
//   try {
//     const h = hex.trim();
//     if (!h) return hex;
//     if (h.startsWith("rgba") || h.startsWith("rgb") || h.startsWith("hsl")) return h;
//     const normalized =
//       h.length === 4 ? "#" + h[1] + h[1] + h[2] + h[2] + h[3] + h[3] : h;
//     const bigint = parseInt(normalized.slice(1), 16);
//     const r = (bigint >> 16) & 255;
//     const g = (bigint >> 8) & 255;
//     const b = bigint & 255;
//     return `rgba(${r}, ${g}, ${b}, ${alpha})`;
//   } catch {
//     return hex;
//   }
// }

// const {
//   primary,
//   secondary,
//   muted,
//   mutedForeground,
//   gradientPrimary,
//   primary5,
//   primary10,
//   primary20,
//   secondary5,
//   secondary10,
// } = (colors as any) || {};

// const primaryColor = typeof primary === "string" ? primary : undefined;
// const mutedFg = typeof mutedForeground === "string" ? mutedForeground : undefined;

// const primaryBg10 = typeof primary10 === "string" ? primary10 : primaryColor ? hexToRgba(primaryColor, 0.10) : undefined;
// const primaryBg5 = typeof primary5 === "string" ? primary5 : primaryColor ? hexToRgba(primaryColor, 0.05) : undefined;
// const primaryBorder10 = typeof primary20 === "string" ? primary20 : primaryColor ? hexToRgba(primaryColor, 0.10) : undefined;
// const secondaryBg5 = typeof secondary5 === "string" ? secondary5 : secondary ? hexToRgba(secondary, 0.05) : undefined;
// const secondaryBorder10 = typeof secondary10 === "string" ? secondary10 : secondary ? hexToRgba(secondary, 0.10) : undefined;

// /* --------------------------------------------------------------------------
//    Types
//    -------------------------------------------------------------------------- */
// type MetaMetrics = {
//   total_spend: number;
//   budget_estimate_daily: number | null;
//   total_reach: number;
//   avg_ctr: number;
//   conversions: number;
//   roas: number | null;
//   purchase_value?: number;
// };

// type SummaryResp = {
//   ok: boolean;
//   meta: {
//     current: MetaMetrics;
//     previous?: Partial<MetaMetrics>;
//     change: {
//       total_spend_pct: number | null;
//       total_reach_pct: number | null;
//       avg_ctr_pct: number | null;
//       conversions_pct: number | null;
//       roas_pct: number | null;
//     };
//   };
//   [k: string]: any;
// };

// type Campaign = {
//   id: string;
//   name: string;
//   campaign_type: string | null;
//   image_url: any;
//   is_published: boolean;
//   created_at?: string;
// };

// type Recommendation = {
//   title?: string;
//   impact?: "High" | "Medium" | "Low" | string;
//   reason?: string;
//   actions?: string[];
//   estimate?: string;
// };

// /* --------------------------------------------------------------------------
//    Dashboard page (client)
//    - UI from your new dashboard
//    - backend/data logic from analytics.tsx + library.tsx
//    - shows Sidebar
//    - metrics: all-time (range=all)
//    - shows connect CTA if not connected
//    - auto-generates 3 high-priority suggestions on load
//    -------------------------------------------------------------------------- */
// const DashboardPage: React.FC = () => {
//   const [statuses, setStatuses] = useState<Record<string, any> | null>(null);
//   const [statusLoading, setStatusLoading] = useState(false);

//   const [metaSummary, setMetaSummary] = useState<SummaryResp | null>(null);
//   const [loadingMeta, setLoadingMeta] = useState(false);

//   const [campaigns, setCampaigns] = useState<Campaign[]>([]);
//   const [loadingCampaigns, setLoadingCampaigns] = useState(true);

//   const [autoRecs, setAutoRecs] = useState<Recommendation[]>([]);
//   const [recLoading, setRecLoading] = useState(false);
//   const [aiRaw, setAiRaw] = useState<any | null>(null);

//   // default "all time" metrics
//   const metricsRange = "all";

//   // fallback google demo numbers (kept as earlier)
//   const google = {
//     total_spend: 5200,
//     budget: 7000,
//     total_reach: 65000,
//     avg_ctr: 1.8,
//     conversions: 98,
//     roas: 2.1,
//     change: {
//       total_spend_pct: 3.4,
//       total_reach_pct: -1.2,
//       avg_ctr_pct: 0.2,
//       conversions_pct: 5.0,
//       roas_pct: 0.1,
//     },
//   };

//   /* ------------------------ Data fetchers (preserve previous logic) ------------------------ */
//   async function fetchStatuses() {
//     setStatusLoading(true);
//     try {
//       // use apiFetch helper to call /api/integrations/status
//       const res = await apiFetch("/api/integrations/status");
//       if (res.ok) {
//         const j = await res.json();
//         setStatuses(j);
//         try { localStorage.setItem("integrations_status_v1", JSON.stringify(j)); } catch {}
//       } else {
//         // swallow errors — keep null
//       }
//     } catch {
//       // ignore
//     } finally {
//       setStatusLoading(false);
//     }
//   }

//   async function fetchMetaMetricsAllTime() {
//     setLoadingMeta(true);
//     try {
//       let token: string | null = null;
//       try {
//         const { data } = await supabase.auth.getSession();
//         token = (data as any)?.session?.access_token ?? null;
//       } catch {}

//       const headers: HeadersInit = {};
//       if (token) headers["Authorization"] = `Bearer ${token}`;
//       const query = new URLSearchParams();
//       query.set("range", metricsRange); // "all"
//       const resp = await fetch(`/api/integrations/metrics?${query.toString()}`, { headers });
//       if (resp.ok) {
//         const j = await resp.json();
//         setMetaSummary(j as SummaryResp);

//         // mark meta connected in statuses + localStorage
//         const normalized: Record<string, any> = { meta: true };
//         try {
//           const rawLs = localStorage.getItem("integrations_status_v1");
//           if (rawLs) Object.assign(normalized, JSON.parse(rawLs));
//         } catch {}
//         setStatuses(normalized);
//         try { localStorage.setItem("integrations_status_v1", JSON.stringify(normalized)); } catch {}
//         return;
//       } else {
//         // keep metaSummary null — UI shows connect CTA
//       }
//     } catch {
//       // ignore
//     } finally {
//       setLoadingMeta(false);
//     }
//   }

//   async function fetchCampaigns() {
//     setLoadingCampaigns(true);
//     try {
//       const { data, error } = await supabase
//         .from("campaigns")
//         .select("*")
//         .order("created_at", { ascending: false });

//       if (error) {
//         setCampaigns([]);
//       } else {
//         setCampaigns((data as Campaign[]) || []);
//       }
//     } catch {
//       setCampaigns([]);
//     } finally {
//       setLoadingCampaigns(false);
//     }
//   }

//   /* ------------------------ Auto recommendations (deterministic, immediate) ------------------------ */
//   function pctDisplay(n: number | null | undefined) {
//     if (n == null) return "—";
//     const r = Math.round((n as number) * 10) / 10;
//     const sign = r > 0 ? "+" : "";
//     return `${sign}${r}%`;
//   }

//   function generateAutoRecommendations(summary: SummaryResp | null, campaignsList: Campaign[]) {
//     const recs: Recommendation[] = [];
//     const meta = summary?.meta?.current ?? null;
//     const change = summary?.meta?.change ?? null;

//     if (meta) {
//       if ((meta.roas ?? 0) < 3) {
//         recs.push({
//           title: "Reallocate budget to improve ROAS",
//           impact: "High",
//           reason: `All-time ROAS is ${(meta.roas ?? 0).toFixed(2)}x — consider focusing budget on top-performing audiences.`,
//           actions: ["Move budget to best-performing ad sets", "Pause frequently underperforming creatives"],
//           estimate: "Expected +15–40% ROAS uplift",
//         });
//       } else if ((change?.roas_pct ?? 0) < 0) {
//         recs.push({
//           title: "ROAS trend negative — review creatives",
//           impact: "High",
//           reason: `ROAS change (all-time vs prior) is ${pctDisplay(change?.roas_pct ?? null)}.`,
//           actions: ["Audit recent creatives & offers", "Re-evaluate targeting and bids"],
//           estimate: "Prevent further decline",
//         });
//       }

//       if ((meta.avg_ctr ?? 0) < 2) {
//         recs.push({
//           title: "Increase CTR with creative experiments",
//           impact: "High",
//           reason: `All-time Avg CTR is ${(meta.avg_ctr ?? 0).toFixed(2)}% — creative can be optimized.`,
//           actions: ["A/B test headlines & thumbnails", "Try different primary text lengths"],
//           estimate: "Potential +10–30% CTR",
//         });
//       }

//       if ((meta.total_spend ?? 0) > 1000 && (meta.conversions ?? 0) < 20) {
//         recs.push({
//           title: "Conversion optimization needed",
//           impact: "High",
//           reason: `High cumulative spend (${fmtMoney(meta.total_spend)}) with low conversions (${meta.conversions ?? 0}).`,
//           actions: ["Audit landing pages", "Verify tracking & events"],
//           estimate: "Potential +20–60% conversions",
//         });
//       }
//     }

//     if (campaignsList.length < 3) {
//       recs.push({
//         title: "Run more test campaigns",
//         impact: "Medium",
//         reason: `Only ${campaignsList.length} campaigns in the library — expand tests.`,
//         actions: ["Create 2–3 low-budget experiments", "Test new audience segments"],
//         estimate: "Discover higher-performing segments",
//       });
//     }

//     while (recs.length < 3) {
//       recs.push({
//         title: "Audit account structure",
//         impact: "Medium",
//         reason: "Run a quick audit for budget pacing, audience overlap, and ad frequency.",
//         actions: ["Review budget pacing", "Check frequency & fatigue"],
//         estimate: "Operational improvements",
//       });
//     }

//     recs.sort((a, b) => {
//       const order = { High: 0, Medium: 1, Low: 2, undefined: 3 } as any;
//       return (order[a.impact ?? ""] || 3) - (order[b.impact ?? ""] || 3);
//     });

//     return recs.slice(0, 3);
//   }

//   /* ------------------------ manual AI recs (optional) ------------------------ */
//   async function askRecommendations() {
//     setRecLoading(true);
//     setAiRaw(null);
//     try {
//       const metrics = { meta: metaSummary?.meta ?? null, google, note: "Return JSON with key 'recommendations' array" };
//       const r = await fetch("/api/recommendations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ metrics }) });
//       const j = await r.json();
//       setAiRaw(j);
//       const parsed = (j && (j.recommendations || j.recs || j.parsed)) ?? null;
//       if (Array.isArray(parsed)) {
//         setAutoRecs(parsed.map((x: any) => ({
//           title: x.title,
//           impact: x.impact,
//           reason: x.reason,
//           actions: x.actions,
//           estimate: x.estimate,
//         })));
//       }
//     } catch (err) {
//       setAiRaw({ error: String(err) });
//     } finally {
//       setRecLoading(false);
//     }
//   }

//   /* ------------------------ lifecycle ------------------------ */
//   useEffect(() => {
//     (async () => {
//       await Promise.all([fetchStatuses(), fetchCampaigns(), fetchMetaMetricsAllTime()]);
//       // auto recs will be generated after metaSummary/campaigns update (useEffect below)
//     })();
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, []);

//   useEffect(() => {
//     const recs = generateAutoRecommendations(metaSummary ?? null, campaigns);
//     setAutoRecs(recs);
//   }, [metaSummary, campaigns]);

//   /* ------------------------ helpers & UI formatting ------------------------ */
//   function fmtMoney(n: number | null | undefined) {
//     if (n == null) return "—";
//     try {
//       return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0 }).format(Number(n));
//     } catch {
//       return `₹${Number(n).toFixed(0)}`;
//     }
//   }
//   function pctColor(n: number | null | undefined) {
//     if (n == null) return "text-gray-500";
//     if (n > 0) return "text-green-600";
//     if (n < 0) return "text-red-600";
//     return "text-gray-500";
//   }

//   const metaCurrent = metaSummary?.meta?.current ?? null;

//   const stats = [
//     { label: "Total Campaigns", value: String(campaigns.length ?? 0), icon: Eye, connected: !!statuses?.meta },
//     { label: "Total Spend (All time)", value: metaCurrent ? fmtMoney(metaCurrent.total_spend) : fmtMoney(google.total_spend), icon: DollarSign, connected: !!statuses?.meta },
//     { label: "Avg CTR (All time)", value: metaCurrent ? `${(metaCurrent.avg_ctr ?? 0).toFixed(2)}%` : `${google.avg_ctr}%`, icon: MousePointerClick, connected: !!statuses?.meta },
//     { label: "ROAS (All time)", value: metaCurrent && metaCurrent.roas ? `${metaCurrent.roas.toFixed(2)}x` : `${google.roas}x`, icon: TrendingUp, connected: !!statuses?.meta },
//   ];

//   function goToIntegrations(platform?: string) {
//     // simple redirect to integrations page; the backend popup/connect logic lives there
//     if (platform) {
//       window.location.href = `/integrations?connected=${platform}`;
//     } else {
//       window.location.href = "/integrations";
//     }
//   }

//   const getCampaignImageUrl = (c: Campaign) => {
//     if (!c?.image_url) return null;
//     if (Array.isArray(c.image_url)) return c.image_url.length ? c.image_url[0] : null;
//     return String(c.image_url);
//   };

//   /* ------------------------ Render UI ------------------------ */
//   return (
//     <div className="min-h-screen flex bg-slate-50">
//       <Sidebar />

//       <main className="flex-1 p-8">
//         {/* Top header */}
//         <div className="flex items-center justify-between mb-6">
//           <div>
//             <h2 className="text-3xl font-extrabold text-slate-900">Dashboard</h2>
//             <p className="mt-1 text-sm" style={mutedFg ? { color: mutedFg } : undefined}>Overview — all-time metrics & actionable suggestions</p>
//           </div>

//           <div className="flex items-center gap-3">
//             <Link href="/campaigns/create" legacyBehavior>
//               <a>
//                 <Button size="lg" className="gradient-primary" style={primaryColor ? { background: gradientPrimary ?? primaryColor } : undefined}>
//                   <Plus className="w-5 h-5 mr-2" /> New Campaign
//                 </Button>
//               </a>
//             </Link>
//             <button onClick={() => { fetchStatuses(); fetchMetaMetricsAllTime(); fetchCampaigns(); }} className="px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-sm">
//               Refresh
//             </button>
//           </div>
//         </div>

//         {/* Cards: stats & action */}
//         <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
//           {/* Left: Stats grid */}
//           <div className="lg:col-span-2 space-y-4">
//             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
//               {stats.map((stat, i) => {
//                 const Icon = stat.icon;
//                 const connected = stat.connected;
//                 return (
//                   <Card key={i} className="glass-card hover:shadow-lg transition-shadow">
//                     <CardContent className="flex items-center justify-between gap-4">
//                       <div className="flex items-center gap-4">
//                         <div className="p-3 rounded-xl" style={{ background: primaryBg10 ?? undefined }}>
//                           <Icon className="w-6 h-6" style={primaryColor ? { color: primaryColor } : undefined} />
//                         </div>
//                         <div>
//                           <div className="text-sm text-slate-500">{stat.label}</div>
//                           <div className="text-2xl font-semibold text-slate-900">{stat.value}</div>
//                         </div>
//                       </div>

//                       <div className="flex flex-col items-end gap-2">
//                         {connected ? (
//                           <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-800">Connected</span>
//                         ) : (
//                           <button onClick={() => goToIntegrations("meta")} className="px-3 py-1 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700">
//                             Connect Meta
//                           </button>
//                         )}
//                         <div className="text-xs text-gray-500">{i === 1 && metaSummary?.meta?.change ? `Change: ${pctDisplay(metaSummary?.meta?.change.total_spend_pct ?? null)}` : ""}</div>
//                       </div>
//                     </CardContent>
//                   </Card>
//                 );
//               })}
//             </div>

//             {/* AI Insights (auto 3 high-priority suggestions) */}
//             <Card className="glass-card border-primary/20" style={primaryBorder10 ? { borderColor: primaryBorder10 } : undefined}>
//               <CardHeader>
//                 <CardTitle className="flex items-center gap-2">
//                   <Sparkles className="w-5 h-5" style={primaryColor ? { color: primaryColor } : undefined} /> Top Recommendations
//                 </CardTitle>
//               </CardHeader>
//               <CardContent>
//                 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
//                   {autoRecs.map((r, idx) => (
//                     <div key={idx} className="p-4 rounded-lg shadow-sm bg-white/60 border">
//                       <div className="flex items-start justify-between gap-2">
//                         <div>
//                           <div className="text-sm font-semibold">{r.title}</div>
//                           <div className="text-xs mt-1 text-muted-foreground" style={mutedFg ? { color: mutedFg } : undefined}>{r.reason}</div>
//                           {r.actions && r.actions.length ? <ul className="list-disc ml-4 mt-2 text-sm">{r.actions.map((a, i) => <li key={i}>{a}</li>)}</ul> : null}
//                           {r.estimate ? <div className="text-xs text-gray-500 mt-2">{r.estimate}</div> : null}
//                         </div>
//                         <div>
//                           <span className={`text-xs px-2 py-1 rounded ${r.impact === "High" ? "bg-red-500 text-white" : r.impact === "Medium" ? "bg-orange-400 text-white" : "bg-gray-400 text-white"}`}>{r.impact}</span>
//                         </div>
//                       </div>
//                     </div>
//                   ))}
//                 </div>

//                 <div className="mt-4 flex gap-3">
//                   <button onClick={() => askRecommendations()} disabled={recLoading} className="px-3 py-1 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
//                     {recLoading ? "Thinking…" : "Get AI Recommendations"}
//                   </button>
//                   <button onClick={() => { setAiRaw(null); }} className="px-3 py-1 border rounded-lg text-sm hover:bg-slate-100">Clear</button>
//                 </div>

//                 {aiRaw ? <pre className="bg-gray-100 p-3 rounded text-xs max-h-60 overflow-auto mt-3">{JSON.stringify(aiRaw, null, 2)}</pre> : null}
//               </CardContent>
//             </Card>

//             {/* Recent Campaigns list (library) */}
//             <Card className="glass-card">
//               <CardHeader>
//                 <CardTitle>Recent Campaigns</CardTitle>
//               </CardHeader>
//               <CardContent>
//                 <div className="space-y-3">
//                   {loadingCampaigns ? <div>Loading campaigns…</div> : campaigns.length === 0 ? <div className="text-sm text-gray-500">No campaigns yet. Create a campaign to get started.</div> : null}

//                   {campaigns.map((campaign) => (
//                     <div key={campaign.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors">
//                       <div className="flex items-center gap-3">
//                         {getCampaignImageUrl(campaign) ? (
//                           // eslint-disable-next-line @next/next/no-img-element
//                           <img src={getCampaignImageUrl(campaign)!} alt={campaign.name} className="w-16 h-12 object-cover rounded" />
//                         ) : (
//                           <div className="w-16 h-12 rounded bg-slate-100 flex items-center justify-center text-sm text-slate-400">No image</div>
//                         )}
//                         <div>
//                           <div className="font-medium">{campaign.name}</div>
//                           <div className="text-xs text-muted-foreground" style={mutedFg ? { color: mutedFg } : undefined}>{campaign.campaign_type || "General"}</div>
//                         </div>
//                       </div>

//                       <div className="flex items-center gap-3">
//                         <div className={`text-xs px-2 py-1 rounded-full ${campaign.is_published ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}`}>{campaign.is_published ? "Active" : "Draft"}</div>
//                         <div className="flex gap-2">
//                           <button className="px-3 py-1 text-sm border rounded-lg hover:bg-slate-100">View</button>
//                           <button className="px-3 py-1 text-sm border rounded-lg hover:bg-slate-100">Post</button>
//                         </div>
//                       </div>
//                     </div>
//                   ))}
//                 </div>
//               </CardContent>
//             </Card>
//           </div>

//           {/* Right column: quick details / meta summary card */}
//           <aside className="space-y-4">
//             <Card className="glass-card sticky top-6">
//               <CardContent>
//                 <div className="flex items-center justify-between mb-2">
//                   <div>
//                     <div className="text-sm text-slate-500">Meta Account</div>
//                     <div className="text-lg font-semibold">{statuses?.meta ? "Connected" : "Not connected"}</div>
//                   </div>
//                   <div>
//                     {!statuses?.meta ? (
//                       <button onClick={() => goToIntegrations("meta")} className="px-3 py-1 rounded bg-blue-600 text-white text-sm hover:bg-blue-700">Connect</button>
//                     ) : (
//                       <span className="text-xs px-2 py-1 rounded bg-green-100 text-green-800">Active</span>
//                     )}
//                   </div>
//                 </div>

//                 <div className="mt-3 space-y-2">
//                   <div className="text-sm text-slate-500">Total Spend</div>
//                   <div className="text-xl font-bold">{metaCurrent ? fmtMoney(metaCurrent.total_spend) : fmtMoney(google.total_spend)}</div>

//                   <div className="text-sm text-slate-500 mt-3">Conversions</div>
//                   <div className="text-lg font-semibold">{metaCurrent ? (metaCurrent.conversions ?? 0) : google.conversions}</div>

//                   <div className="text-sm text-slate-500 mt-3">Avg CTR</div>
//                   <div className="text-lg font-semibold">{metaCurrent ? `${(metaCurrent.avg_ctr ?? 0).toFixed(2)}%` : `${google.avg_ctr}%`}</div>

//                   <div className="text-sm text-slate-500 mt-3">ROAS</div>
//                   <div className="text-lg font-semibold">{metaCurrent && metaCurrent.roas ? `${metaCurrent.roas.toFixed(2)}x` : `${google.roas}x`}</div>
//                 </div>
//               </CardContent>
//             </Card>

//             <Card className="glass-card">
//               <CardHeader>
//                 <CardTitle>Quick Actions</CardTitle>
//               </CardHeader>
//               <CardContent>
//                 <div className="flex flex-col gap-2">
//                   <button onClick={() => goToIntegrations()} className="px-3 py-2 rounded-lg border hover:bg-slate-50 text-sm">Manage Integrations</button>
//                   <Link href="/library" legacyBehavior>
//                     <a className="px-3 py-2 rounded-lg border hover:bg-slate-50 text-sm text-center">Open Campaign Library</a>
//                   </Link>
//                   <button onClick={() => { fetchMetaMetricsAllTime(); }} className="px-3 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 text-sm">Refresh Metrics</button>
//                 </div>
//               </CardContent>
//             </Card>

//             <Card className="glass-card">
//               <CardHeader>
//                 <CardTitle>Account Tips</CardTitle>
//               </CardHeader>
//               <CardContent>
//                 <ul className="list-disc ml-5 text-sm space-y-1">
//                   <li>Keep conversions tracked to improve optimization.</li>
//                   <li>Run small experiments to find winning creatives.</li>
//                   <li>Check frequency to avoid audience fatigue.</li>
//                 </ul>
//               </CardContent>
//             </Card>
//           </aside>
//         </div>
//       </main>
//     </div>
//   );
// };

// export default DashboardPage;
