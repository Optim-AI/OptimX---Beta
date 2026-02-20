// pages/insights.tsx
import React, { useEffect, useState } from "react";
import { BarChart3, Clock, TrendingUp, Zap } from "lucide-react";
import Sidebar from '../app/web/src/components/Sidebar';
import { SkeletonMetricGrid, SkeletonRecommendationCard } from '@/app/web/src/components/ui/skeletons';

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
  meta?: {
    current: MetaMetrics;
    previous?: Partial<MetaMetrics>;
    change?: {
      total_spend_pct?: number | null;
      total_reach_pct?: number | null;
      avg_ctr_pct?: number | null;
      conversions_pct?: number | null;
      roas_pct?: number | null;
    };
    raw?: any;
  };
  error?: string;
};

type Recommendation = {
  title?: string;
  impact?: "High" | "Medium" | "Low" | string;
  reason?: string;
  actions?: string[];
  estimate?: string;
};

export default function Insights() {
  const [metaSummary, setMetaSummary] = useState<SummaryResp | null>(null);
  const [loadingMeta, setLoadingMeta] = useState(false);
  const [googleMetrics, setGoogleMetrics] = useState<any | null>(null);
  const [loadingGoogle, setLoadingGoogle] = useState(false);

  const [recs, setRecs] = useState<Recommendation[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiRaw, setAiRaw] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchMeta();
    fetchGoogleIfAvailable();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchMeta() {
    setLoadingMeta(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/facebook/summaryMetrics");
      const text = await res.text();
      try {
        const json = JSON.parse(text);
        setMetaSummary(json);
      } catch (err) {
        setError("summaryMetrics returned non-JSON. See console.");
        console.error("summaryMetrics text:", text);
        setMetaSummary({ ok: false, error: "Non-JSON response" });
      }
    } catch (err: any) {
      setError(String(err));
      setMetaSummary({ ok: false, error: String(err) });
    } finally {
      setLoadingMeta(false);
    }
  }

  // Optional: if you later add /api/google/metrics, this will fetch it. If not found -> null.
  async function fetchGoogleIfAvailable() {
    setLoadingGoogle(true);
    try {
      const res = await fetch("/api/google/metrics");
      if (!res.ok) {
        setGoogleMetrics(null);
        return;
      }
      const json = await res.json();
      setGoogleMetrics(json);
    } catch {
      setGoogleMetrics(null);
    } finally {
      setLoadingGoogle(false);
    }
  }

  function fmtMoney(n: number | null | undefined) {
    if (n === null || n === undefined) return "—";
    try {
      return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2 }).format(Number(n));
    } catch {
      return `₹${Number(n).toFixed(2)}`;
    }
  }

  function pctDisplay(n: number | null | undefined) {
    if (n === null || n === undefined) return "—";
    const r = Math.round((n + Number.EPSILON) * 10) / 10;
    return (r > 0 ? "+" : "") + r + "%";
  }

  // call AI endpoint to get recommendations
  async function getRecommendations() {
    setAiLoading(true);
    setRecs([]);
    setAiRaw(null);

    try {
      const payload = {
        meta: metaSummary?.meta ?? null,
        google: googleMetrics ?? null,
        note: "Provide prioritized, actionable recommendations (title, impact High/Medium/Low, reason, actions[], estimate). Respond in strict JSON: { recommendations: [ ... ] }",
      };

      const r = await fetch("/api/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload }),
      });
      const j = await r.json();
      setAiRaw(j);

      // prefer parsed JSON from server
      if (j.parsed && Array.isArray(j.parsed.recommendations)) {
        setRecs(j.parsed.recommendations);
        setAiLoading(false);
        return;
      }

      // if server returned `json` field parsed already
      if (j.json && Array.isArray(j.json.recommendations)) {
        setRecs(j.json.recommendations);
        setAiLoading(false);
        return;
      }

      // fallback: try to parse raw text
      const rawText = j.rawText ?? j.raw ?? JSON.stringify(j);
      try {
        const parsed = JSON.parse(String(rawText));
        if (parsed && Array.isArray(parsed.recommendations)) {
          setRecs(parsed.recommendations);
        } else if (Array.isArray(parsed)) {
          setRecs(parsed);
        } else {
          setRecs([]);
        }
      } catch (err) {
        // fallback to whatever server returned as "parsed" text blocks
        setRecs([]);
      }
    } catch (err: any) {
      console.error("AI error", err);
      setError(String(err));
    } finally {
      setAiLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex app-page">
      <Sidebar />

      <main className="flex-1 p-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold mb-1">AI Insights</h2>
            <p className="text-slate-500">Intelligent recommendations and performance predictions for your campaigns.</p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={fetchMeta}
              className="px-3 py-2 rounded border text-sm bg-white hover:bg-slate-50"
            >
              Refresh Meta
            </button>
            <button
              onClick={getRecommendations}
              className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
              disabled={aiLoading || loadingMeta}
            >
              {aiLoading ? "Thinking…" : "Get AI Insights"}
            </button>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-6">
          <div className="bg-white rounded-xl shadow p-4 flex items-center gap-4">
            <Zap className="w-10 h-10 text-blue-600" />
            <div>
              <p className="text-sm text-slate-500">Predicted Engagement</p>
              <h3 className="text-lg font-semibold text-slate-800">+18%</h3>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow p-4 flex items-center gap-4">
            <Clock className="w-10 h-10 text-green-600" />
            <div>
              <p className="text-sm text-slate-500">Best Posting Window</p>
              <h3 className="text-lg font-semibold text-slate-800">6–9 PM</h3>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow p-4 flex items-center gap-4">
            <TrendingUp className="w-10 h-10 text-purple-600" />
            <div>
              <p className="text-sm text-slate-500">ROI Forecast</p>
              <h3 className="text-lg font-semibold text-slate-800">+25%</h3>
            </div>
          </div>
        </div>

        {/* Live Meta & Google rows */}
        <div className="space-y-6 mb-6">
          {/* Meta row */}
          <div className="bg-white rounded-xl shadow p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-semibold">Meta (Facebook & Instagram)</h3>
                <p className="text-sm text-slate-500">Live metrics from your connected Meta ad account.</p>
              </div>
              <div className="text-sm text-gray-500">Period: last 7 days (compared to previous 7)</div>
            </div>

            {loadingMeta ? (
              <SkeletonMetricGrid columns={6} />
            ) : metaSummary?.meta ? (
              <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                <div className="p-3 bg-gray-50 rounded">
                  <div className="text-sm text-slate-500">Total Spend</div>
                  <div className="text-xl font-bold">{fmtMoney(metaSummary.meta.current.total_spend)}</div>
                </div>

                <div className="p-3 bg-gray-50 rounded">
                  <div className="text-sm text-slate-500">Budget (daily est)</div>
                  <div className="text-xl font-bold">{fmtMoney(metaSummary.meta.current.budget_estimate_daily)}</div>
                </div>

                <div className="p-3 bg-gray-50 rounded">
                  <div className="text-sm text-slate-500">Total Reach</div>
                  <div className="text-xl font-bold">{(metaSummary.meta.current.total_reach ?? 0).toLocaleString()}</div>
                </div>

                <div className="p-3 bg-gray-50 rounded">
                  <div className="text-sm text-slate-500">Avg CTR</div>
                  <div className="text-xl font-bold">{((metaSummary.meta.current.avg_ctr ?? 0)).toFixed(2)}%</div>
                </div>

                <div className="p-3 bg-gray-50 rounded">
                  <div className="text-sm text-slate-500">Conversions</div>
                  <div className="text-xl font-bold">{metaSummary.meta.current.conversions ?? 0}</div>
                </div>

                <div className="p-3 bg-gray-50 rounded">
                  <div className="text-sm text-slate-500">ROAS</div>
                  <div className="text-xl font-bold">{metaSummary.meta.current.roas ? `${metaSummary.meta.current.roas.toFixed(2)}x` : "—"}</div>
                </div>
              </div>
            ) : (
              <div className="text-sm text-red-600">
                Could not load Meta metrics. {metaSummary?.error ? <span>{metaSummary.error}</span> : null}
              </div>
            )}
          </div>

          {/* Google row (tries to fetch; if not connected, shows CTA) */}
          <div className="bg-white rounded-xl shadow p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-semibold">Google Ads</h3>
                <p className="text-sm text-slate-500">If you connect Google Ads later, we'll surface live metrics here.</p>
              </div>
              <div className="text-sm text-gray-500">Integration status</div>
            </div>

            {loadingGoogle ? (
              <SkeletonMetricGrid columns={6} />
            ) : googleMetrics ? (
              <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                {/* adapt to the shape of googleMetrics you provide */}
                <div className="p-3 bg-gray-50 rounded">
                  <div className="text-sm text-slate-500">Total Spend</div>
                  <div className="text-xl font-bold">{fmtMoney(googleMetrics.total_spend)}</div>
                </div>
                <div className="p-3 bg-gray-50 rounded">
                  <div className="text-sm text-slate-500">Budget</div>
                  <div className="text-xl font-bold">{fmtMoney(googleMetrics.budget)}</div>
                </div>
                <div className="p-3 bg-gray-50 rounded">
                  <div className="text-sm text-slate-500">Impressions</div>
                  <div className="text-xl font-bold">{(googleMetrics.impressions ?? 0).toLocaleString()}</div>
                </div>
                <div className="p-3 bg-gray-50 rounded">
                  <div className="text-sm text-slate-500">Avg CTR</div>
                  <div className="text-xl font-bold">{(googleMetrics.ctr ?? 0).toFixed(2)}%</div>
                </div>
                <div className="p-3 bg-gray-50 rounded">
                  <div className="text-sm text-slate-500">Conversions</div>
                  <div className="text-xl font-bold">{googleMetrics.conversions ?? 0}</div>
                </div>
                <div className="p-3 bg-gray-50 rounded">
                  <div className="text-sm text-slate-500">ROAS</div>
                  <div className="text-xl font-bold">{googleMetrics.roas ? `${Number(googleMetrics.roas).toFixed(2)}x` : "—"}</div>
                </div>
              </div>
            ) : (
              <div className="flex gap-4 items-center">
                <div className="text-sm text-slate-600">Google Ads not connected.</div>
                <button className="px-3 py-1 rounded bg-blue-600 text-white text-sm">Connect Google Ads</button>
              </div>
            )}
          </div>
        </div>

        {/* AI Recommendations */}
        <div className="bg-white rounded-xl shadow p-6">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h3 className="text-lg font-semibold flex items-center gap-2"><TrendingUp className="w-5 h-5 text-blue-500" /> Smart Recommendations</h3>
              <p className="text-sm text-slate-500">Actionable tips generated by the AI based on your account metrics.</p>
            </div>
            <div className="text-sm text-gray-500">Powered by OpenAI</div>
          </div>

          <div className="mb-4">
            <button
              disabled={aiLoading}
              onClick={getRecommendations}
              className="px-3 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
            >
              {aiLoading ? "Generating…" : "Generate Recommendations"}
            </button>
          </div>

          {aiLoading ? (
            <div className="space-y-4">
              <SkeletonRecommendationCard />
              <SkeletonRecommendationCard />
              <SkeletonRecommendationCard />
            </div>
          ) : recs.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {recs.map((r, i) => (
                <div key={i} className="p-4 border rounded shadow-sm flex flex-col">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-semibold text-slate-800">{r.title ?? `Recommendation ${i + 1}`}</div>
                      {r.reason ? <div className="text-sm text-gray-600 mt-1">{r.reason}</div> : null}
                    </div>
                    <div>
                      <span className={`text-xs px-2 py-1 rounded ${r.impact === "High" ? "bg-red-500 text-white" : r.impact === "Medium" ? "bg-orange-400 text-white" : "bg-gray-400 text-white"}`}>
                        {r.impact ?? "—"}
                      </span>
                    </div>
                  </div>

                  {r.actions && r.actions.length > 0 ? (
                    <ul className="list-disc ml-5 mt-3 space-y-1 text-sm">
                      {r.actions.map((a, idx) => <li key={idx}>{a}</li>)}
                    </ul>
                  ) : null}

                  {r.estimate ? <div className="text-xs text-gray-500 mt-3">{r.estimate}</div> : null}

                  <div className="mt-4 flex gap-2">
                    <button className="px-3 py-1 rounded bg-blue-100 text-blue-700 text-sm">Apply Suggestion</button>
                    <button className="px-3 py-1 rounded border text-sm">Details</button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-gray-500">
              No recommendations yet. Click "Generate Recommendations" to create AI-driven suggestions from the live metrics.
              {aiRaw ? <pre className="mt-3 text-xs bg-gray-100 p-3 rounded max-h-48 overflow-auto">{JSON.stringify(aiRaw, null, 2)}</pre> : null}
              {error ? <div className="text-red-600 mt-2">{error}</div> : null}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
