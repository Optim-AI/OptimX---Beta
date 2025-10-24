// pages/analytics.tsx
import React, { useEffect, useState } from "react";
import { TrendingUp, DollarSign, BarChart3 } from "lucide-react";
import Sidebar from '../app/web/src/components/Sidebar'; // keep your existing sidebar path

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
  ok: boolean;
  ranges: any;
  meta: {
    current: MetaMetrics;
    previous: Partial<MetaMetrics>;
    change: {
      total_spend_pct: number | null;
      total_reach_pct: number | null;
      avg_ctr_pct: number | null;
      conversions_pct: number | null;
      roas_pct: number | null;
    };
  };
};

type Recommendation = {
  title?: string;
  impact?: "High" | "Medium" | "Low" | string;
  reason?: string;
  actions?: string[];
  estimate?: string;
  [k: string]: any;
};

export default function Analytics() {
  const [loadingMeta, setLoadingMeta] = useState(false);
  const [metaSummary, setMetaSummary] = useState<SummaryResp | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Hardcoded Google metrics for now
  const google = {
    total_spend: 5200,
    budget: 7000,
    total_reach: 65000,
    avg_ctr: 1.8,
    conversions: 98,
    roas: 2.1,
    change: {
      total_spend_pct: 3.4,
      total_reach_pct: -1.2,
      avg_ctr_pct: 0.2,
      conversions_pct: 5.0,
      roas_pct: 0.1,
    },
  };

  const [recList, setRecList] = useState<Recommendation[]>([]);
  const [aiRaw, setAiRaw] = useState<any | null>(null);
  const [recLoading, setRecLoading] = useState(false);

  useEffect(() => {
    fetchMetaSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchMetaSummary() {
    setLoadingMeta(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/facebook/summaryMetrics");
      const text = await res.text();
      try {
        const json = JSON.parse(text);
        if (!res.ok) {
          setError(JSON.stringify(json));
          setMetaSummary(null);
        } else {
          setMetaSummary(json as SummaryResp);
        }
      } catch (parseErr) {
        console.error("Non-JSON response from summaryMetrics:", text.slice(0, 400));
        setError("Non-JSON response from server. See console logs.");
        setMetaSummary(null);
      }
    } catch (err: any) {
      setError(String(err));
      setMetaSummary(null);
    } finally {
      setLoadingMeta(false);
    }
  }

  function pctDisplay(n: number | null | undefined) {
    if (n === null || n === undefined) return "—";
    const r = Math.round(n * 10) / 10;
    const sign = r > 0 ? "+" : "";
    return `${sign}${r}%`;
  }

  function pctColor(n: number | null | undefined) {
    if (n === null || n === undefined) return "text-gray-500";
    if (n > 0) return "text-green-600";
    if (n < 0) return "text-red-600";
    return "text-gray-500";
  }

  const fmtMoney = (n: number | null | undefined) => {
    if (n === null || n === undefined) return "—";
    try {
      return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(Number(n));
    } catch {
      return `₹${Number(n).toFixed(2)}`;
    }
  };

  // --- Recommendations logic: ask / parse / normalize ---
  function extractJsonFromText(text: string): any | null {
    if (!text) return null;
    // strip code fences and leading/trailing whitespace
    const cleaned = text.replace(/^\s*```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
    // try to find first object
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      const candidate = cleaned.slice(firstBrace, lastBrace + 1);
      try {
        return JSON.parse(candidate);
      } catch {}
    }
    try {
      return JSON.parse(cleaned);
    } catch {
      return null;
    }
  }

  function normalizeRec(x: any): Recommendation {
    if (!x) return {};
    const title = x.title ?? x.heading ?? x.name ?? (typeof x === "string" ? x : undefined);
    const impact = x.impact ?? x.level ?? x.priority;
    const reason = x.reason ?? x.explanation ?? x.summary ?? x.description ?? (typeof x === "string" ? x : undefined);
    let actions: string[] = [];
    if (Array.isArray(x.actions)) actions = x.actions;
    else if (typeof x.actions === "string") actions = x.actions.split(/\n+/).map(s => s.replace(/^[\-\d\.\)\s]+/, "").trim()).filter(Boolean);
    const estimate = x.estimate ?? x.estimate_uplift ?? x.uplift;
    return { title, impact, reason, actions, estimate };
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

  async function askRecommendations() {
    setRecLoading(true);
    setRecList([]);
    setAiRaw(null);
    try {
      const metrics = { meta: metaSummary?.meta ?? null, google, note: "Return JSON with key 'recommendations' (array) where each item: title, impact, reason, actions[], estimate." };

      const r = await fetch("/api/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ metrics }),
      });
      const j = await r.json();
      setAiRaw(j);

      let parsed = j?.parsed ?? null;
      if (!parsed && typeof j?.raw === "string") parsed = extractJsonFromText(j.raw);
      if (!parsed && typeof j?.raw === "object" && j.raw?.choices?.[0]?.message?.content) parsed = extractJsonFromText(j.raw.choices[0].message.content);
      if (!parsed && typeof j?.text === "string") parsed = extractJsonFromText(j.text);

      if (parsed) {
        let arr: any[] = [];
        if (Array.isArray(parsed)) arr = parsed;
        else if (Array.isArray(parsed.recommendations)) arr = parsed.recommendations;
        else if (Array.isArray(parsed.recs)) arr = parsed.recs;
        else {
          const maybe = Object.values(parsed).find(v => Array.isArray(v));
          if (maybe) arr = maybe as any[];
        }
        if (arr.length > 0) {
          setRecList(arr.map(normalizeRec));
          setRecLoading(false);
          return;
        }
      }

      // fallback: try raw text splitting
      const rawText = typeof j?.raw === "string" ? j.raw : JSON.stringify(j);
      const parts = splitTextIntoRecommendations(rawText);
      setRecList(parts.map(p => ({ title: undefined, impact: undefined, reason: p, actions: [] })));
    } catch (err: any) {
      setAiRaw({ error: String(err) });
      setRecList([]);
    } finally {
      setRecLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex bg-slate-50">
      <Sidebar />
      <main className="flex-1 p-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-slate-800">AI Analytics</h2>
          <div className="flex items-center gap-3">
            <button onClick={() => fetchMetaSummary()} className="px-3 py-2 text-sm rounded-lg border border-slate-300 hover:bg-slate-100">Refresh Meta</button>
            <button className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700">Generate Report</button>
          </div>
        </div>

        <h3 className="text-lg font-semibold text-slate-700 mb-3">Overview</h3>

        <div className="space-y-4 mb-8">
          <div className="p-4 bg-white rounded-xl shadow">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-3">
                <DollarSign className="w-5 h-5 text-slate-600" />
                <div>
                  <div className="text-sm text-slate-500">Meta (Facebook & Instagram)</div>
                  <div className="text-lg font-semibold">Live account metrics</div>
                </div>
              </div>
              <div className="text-sm text-gray-500">Period: last 7 days vs previous 7 days</div>
            </div>

            {loadingMeta ? (
              <div>Loading Meta metrics…</div>
            ) : metaSummary ? (
              <div className="grid grid-cols-6 gap-4">
                <div className="p-4 bg-gray-50 rounded">
                  <div className="text-sm text-slate-500">Total Spend</div>
                  <div className="text-xl font-bold text-slate-800">{fmtMoney(metaSummary.meta.current.total_spend)}</div>
                  <div className={`text-xs mt-1 ${pctColor(metaSummary.meta.change.total_spend_pct)}`}>{pctDisplay(metaSummary.meta.change.total_spend_pct)}</div>
                </div>

                <div className="p-4 bg-gray-50 rounded">
                  <div className="text-sm text-slate-500">Budget (daily estimate)</div>
                  <div className="text-xl font-bold text-slate-800">{fmtMoney(metaSummary.meta.current.budget_estimate_daily)}</div>
                  <div className="text-xs mt-1 text-gray-500">Sum of campaign daily budgets</div>
                </div>

                <div className="p-4 bg-gray-50 rounded">
                  <div className="text-sm text-slate-500">Total Reach</div>
                  <div className="text-xl font-bold text-slate-800">{metaSummary.meta.current.total_reach?.toLocaleString?.() ?? metaSummary.meta.current.total_reach}</div>
                  <div className={`text-xs mt-1 ${pctColor(metaSummary.meta.change.total_reach_pct)}`}>{pctDisplay(metaSummary.meta.change.total_reach_pct)}</div>
                </div>

                <div className="p-4 bg-gray-50 rounded">
                  <div className="text-sm text-slate-500">Avg CTR</div>
                  <div className="text-xl font-bold text-slate-800">{(metaSummary.meta.current.avg_ctr ?? 0).toFixed(2)}%</div>
                  <div className={`text-xs mt-1 ${pctColor(metaSummary.meta.change.avg_ctr_pct)}`}>{pctDisplay(metaSummary.meta.change.avg_ctr_pct)}</div>
                </div>

                <div className="p-4 bg-gray-50 rounded">
                  <div className="text-sm text-slate-500">Conversions</div>
                  <div className="text-xl font-bold text-slate-800">{metaSummary.meta.current.conversions ?? 0}</div>
                  <div className={`text-xs mt-1 ${pctColor(metaSummary.meta.change.conversions_pct)}`}>{pctDisplay(metaSummary.meta.change.conversions_pct)}</div>
                </div>

                <div className="p-4 bg-gray-50 rounded">
                  <div className="text-sm text-slate-500">ROAS</div>
                  <div className="text-xl font-bold text-slate-800">{metaSummary.meta.current.roas ? `${metaSummary.meta.current.roas.toFixed(2)}x` : "—"}</div>
                  <div className={`text-xs mt-1 ${pctColor(metaSummary.meta.change.roas_pct)}`}>{metaSummary.meta.change.roas_pct === null ? "—" : pctDisplay(metaSummary.meta.change.roas_pct)}</div>
                </div>
              </div>
            ) : (
              <div className="text-red-600">Could not fetch Meta metrics. {error ? <pre className="text-xs mt-2">{error}</pre> : null}</div>
            )}
          </div>

          <div className="p-4 bg-white rounded-xl shadow">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-3">
                <BarChart3 className="w-5 h-5 text-slate-600" />
                <div>
                  <div className="text-sm text-slate-500">Google Ads (Hardcoded)</div>
                  <div className="text-lg font-semibold">Demo / placeholder</div>
                </div>
              </div>
              <div className="text-sm text-gray-500">Static demo numbers</div>
            </div>

            <div className="grid grid-cols-6 gap-4">
              <div className="p-4 bg-gray-50 rounded">
                <div className="text-sm text-slate-500">Total Spend</div>
                <div className="text-xl font-bold text-slate-800">₹{google.total_spend.toLocaleString()}</div>
                <div className={`text-xs mt-1 ${pctColor(google.change.total_spend_pct)}`}>{pctDisplay(google.change.total_spend_pct)}</div>
              </div>

              <div className="p-4 bg-gray-50 rounded">
                <div className="text-sm text-slate-500">Budget (daily)</div>
                <div className="text-xl font-bold text-slate-800">₹{google.budget.toLocaleString()}</div>
                <div className="text-xs mt-1 text-gray-500">Hardcoded</div>
              </div>

              <div className="p-4 bg-gray-50 rounded">
                <div className="text-sm text-slate-500">Total Reach</div>
                <div className="text-xl font-bold text-slate-800">{google.total_reach.toLocaleString()}</div>
                <div className={`text-xs mt-1 ${pctColor(google.change.total_reach_pct)}`}>{pctDisplay(google.change.total_reach_pct)}</div>
              </div>

              <div className="p-4 bg-gray-50 rounded">
                <div className="text-sm text-slate-500">Avg CTR</div>
                <div className="text-xl font-bold text-slate-800">{google.avg_ctr}%</div>
                <div className={`text-xs mt-1 ${pctColor(google.change.avg_ctr_pct)}`}>{pctDisplay(google.change.avg_ctr_pct)}</div>
              </div>

              <div className="p-4 bg-gray-50 rounded">
                <div className="text-sm text-slate-500">Conversions</div>
                <div className="text-xl font-bold text-slate-800">{google.conversions}</div>
                <div className="text-xs mt-1">{pctDisplay(google.change.conversions_pct)}</div>
              </div>

              <div className="p-4 bg-gray-50 rounded">
                <div className="text-sm text-slate-500">ROAS</div>
                <div className="text-xl font-bold text-slate-800">{google.roas}x</div>
                <div className="text-xs mt-1">{pctDisplay(google.change.roas_pct)}</div>
              </div>
            </div>
          </div>
        </div>

        <h3 className="text-lg font-semibold text-slate-700 mb-3">Smart Recommendations</h3>
        <div className="mb-8 space-y-3">
          <div className="p-5 bg-white rounded-xl shadow border-l-4 border-blue-500">
            <div className="flex justify-between items-start">
              <div>
                <h4 className="font-semibold text-slate-800 flex items-center gap-2"><TrendingUp className="w-5 h-5 text-blue-500" /> Recommendations (AI)</h4>
                <p className="text-sm text-slate-600 mt-1">Get prioritized recommendations based on current account metrics (Meta live + Google demo)</p>
                <div className="flex gap-3 mt-3">
                  <button onClick={askRecommendations} disabled={recLoading} className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200">{recLoading ? "Thinking…" : "Get Recommendations"}</button>
                  <button onClick={() => { setRecList([]); setAiRaw(null); }} className="px-3 py-1 text-sm border rounded-lg hover:bg-slate-100">Clear</button>
                </div>
              </div>
            </div>

            <div className="mt-4">
              {recLoading ? <div>Generating recommendations…</div> : null}

              {recList && recList.length > 0 ? (
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {recList.map((r, idx) => (
                    <div key={idx} className="p-4 bg-white border rounded-lg shadow-sm flex flex-col">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-semibold text-slate-800">{r.title ?? `Recommendation ${idx + 1}`}</div>
                          {r.reason ? <div className="text-sm text-gray-600 mt-1">{r.reason}</div> : null}
                        </div>
                        <div>
                          <span className={`text-xs px-2 py-1 rounded ${r.impact === "High" ? "bg-red-500 text-white" : r.impact === "Medium" ? "bg-orange-400 text-white" : "bg-gray-400 text-white"}`}>{r.impact ?? "—"}</span>
                        </div>
                      </div>

                      {r.actions && r.actions.length > 0 ? (
                        <ul className="list-disc ml-5 mt-3 text-sm space-y-1">{r.actions.map((a, i) => <li key={i}>{a}</li>)}</ul>
                      ) : null}

                      {r.estimate ? <div className="text-xs text-gray-500 mt-3">{r.estimate}</div> : null}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-4">
                  {aiRaw ? <pre className="bg-gray-100 p-3 rounded text-xs max-h-60 overflow-auto">{JSON.stringify(aiRaw, null, 2)}</pre> : <div className="text-sm text-gray-500 mt-2">No recommendations yet. Click "Get Recommendations".</div>}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
