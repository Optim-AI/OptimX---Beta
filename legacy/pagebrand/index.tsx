// pages/brand/index.tsx
import React, { useState } from "react";
import { useRouter } from "next/router";
import {
  RefreshCw,
  Users,
  Layers,
  Target,
  AlertTriangle,
  Sparkles
} from "lucide-react";

export default function BrandPage() {
  const router = useRouter();
  <button
  onClick={() => router.push("/brand/templates")}
  className="px-5 py-3 bg-indigo-600 text-white rounded-lg font-semibold"
>
  Generate Templates →
</button>

  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [res, setRes] = useState<any>(null);
  const [err, setErr] = useState("");

  async function run() {
    setErr("");
    setRes(null);
    if (!url) return setErr("Paste a website URL");
    setLoading(true);
    try {
      const r = await fetch("/api/brand/fullAnalyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url })
      });
      const j = await r.json();

if (j.error) {
  setErr(j.error);
} else {
  setRes(j.result);
  localStorage.setItem(
    "brand:lastResult",
    JSON.stringify(j.result)
  );
}

    } catch (e: any) {
      setErr(e.message);
    }
    setLoading(false);
  }

  return (
    <div className="max-w-6xl mx-auto p-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Brand Intelligence Report</h1>
          <p className="text-gray-500 text-sm">
            Understand your brand. Spot gaps. Unlock growth.
          </p>
        </div>
        <button
          onClick={run}
          className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-lg"
        >
          <RefreshCw size={16} />
          Re-analyze
        </button>
      </div>

      {/* Input */}
      <div className="flex gap-3">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://yourbrand.com"
          className="flex-1 border rounded-lg p-3"
        />
        <button
          onClick={run}
          className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-semibold"
        >
          {loading ? "Analyzing…" : "Analyze"}
        </button>
      </div>

      {err && (
        <div className="bg-red-50 text-red-700 p-3 rounded">{err}</div>
      )}

      {res && (
        <>
          {/* Snapshot */}
          <div className="grid grid-cols-4 gap-4">
            <Snapshot label="Category" value={res.classification.category} />
            <Snapshot label="Customer" value={res.classification.customer_type} />
            <Snapshot label="Stage" value={res.classification.stage} />
            <Snapshot label="Positioning" value={res.classification.positioning} />
          </div>

          {/* Brand Overview */}
          <Section title="Brand Overview" icon={<Layers size={18} />}>
            <p className="text-gray-700 mb-4">
              {res.positioning.primary_value_proposition}
            </p>
            <div className="grid grid-cols-2 gap-6">
              <List title="What they sell" items={res.facts.what_they_sell} />
              <List title="Who it’s for" items={res.facts.who_it_is_for} />
            </div>
          </Section>

          {/* Positioning */}
          <Section title="Market Positioning" icon={<Target size={18} />}>
            <div className="grid grid-cols-2 gap-6">
              <Insight
                label="Intended positioning"
                value={res.positioning.intended_positioning}
              />
              <Insight
                label="Perceived positioning"
                value={res.positioning.perceived_positioning}
              />
            </div>

            {res.positioning.confusion_points?.length > 0 && (
              <AlertBox
                title="Positioning gaps"
                items={res.positioning.confusion_points}
              />
            )}
          </Section>

          {/* Competition */}
          <Section title="Competitive Landscape" icon={<Users size={18} />}>
            <p className="text-gray-700 mb-4">
              {res.competition.summary}
            </p>

            <div className="space-y-4">
              {res.competition.comparison.map((c: any, i: number) => (
                <div key={i} className="border rounded-lg p-4">
                  <h3 className="font-semibold mb-2">{c.competitor}</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <Bullet title="They win on" items={c.where_they_win} />
                    <Bullet title="They lose on" items={c.where_they_lose} />
                  </div>
                  <p className="text-sm text-gray-600 mt-3">
                    Gap: {c.gap}
                  </p>
                </div>
              ))}
            </div>
          </Section>

          {/* Action Plan */}
          <Section
            title="Website Teardown & Action Plan"
            icon={<AlertTriangle size={18} />}
          >
            <div className="flex gap-6 mb-6">
              <Score label="Clarity" value={res.teardown.clarity_score} />
              <Score label="Trust" value={res.teardown.trust_score} />
            </div>

            <div className="space-y-6">
              {["now", "next", "later"].map((p) => (
                <div key={p}>
                  <h4 className="uppercase text-xs font-semibold text-gray-500 mb-2">
                    {p}
                  </h4>
                  <div className="space-y-3">
                    {res.teardown.action_plan
                      .filter((a: any) => a.priority === p)
                      .map((a: any, i: number) => (
                        <div key={i} className="border rounded p-4">
                          <p className="font-medium">{a.what}</p>
                          <p className="text-sm text-gray-600 mt-1">{a.why}</p>
                          <p className="text-sm mt-1">
                            Impact: <strong>{a.impact}</strong>
                          </p>
                        </div>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          </Section>

          {/* 🚀 GROWTH ACTIVATION CTA (NEW) */}
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl p-6 text-white flex items-center justify-between">
            <div>
              <h3 className="text-xl font-semibold mb-1">
                Turn insights into growth assets
              </h3>
              <p className="text-sm opacity-90">
                Generate ad creatives, social posts, website banners, and email templates —
                automatically tailored to this brand.
              </p>
            </div>
            <button
              onClick={() => router.push("/brand/templates")}
              className="flex items-center gap-2 bg-white text-black px-5 py-3 rounded-lg font-semibold"
            >
              <Sparkles size={18} />
              Generate Growth Templates
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/* ---------------------- UI COMPONENTS ---------------------- */

function Snapshot({ label, value }: any) {
  return (
    <div className="bg-white border rounded-lg p-4">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="font-semibold mt-1">{value || "—"}</p>
    </div>
  );
}

function Section({ title, icon, children }: any) {
  return (
    <section className="bg-white border rounded-lg p-6">
      <div className="flex items-center gap-2 mb-4">
        {icon}
        <h2 className="text-lg font-semibold">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function List({ title, items }: any) {
  return (
    <div>
      <h4 className="font-medium mb-2">{title}</h4>
      <ul className="list-disc pl-5 text-sm text-gray-700">
        {(items || []).map((i: string, idx: number) => (
          <li key={idx}>{i}</li>
        ))}
      </ul>
    </div>
  );
}

function Insight({ label, value }: any) {
  return (
    <div>
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-gray-700 mt-1">{value || "—"}</p>
    </div>
  );
}

function Bullet({ title, items }: any) {
  return (
    <div>
      <p className="text-sm font-medium mb-1">{title}</p>
      <ul className="list-disc pl-5 text-sm text-gray-700">
        {(items || []).map((i: string, idx: number) => (
          <li key={idx}>{i}</li>
        ))}
      </ul>
    </div>
  );
}

function AlertBox({ title, items }: any) {
  return (
    <div className="bg-yellow-50 border border-yellow-200 rounded p-4 mt-4">
      <p className="font-medium mb-2">{title}</p>
      <ul className="list-disc pl-5 text-sm">
        {(items || []).map((i: string, idx: number) => (
          <li key={idx}>{i}</li>
        ))}
      </ul>
    </div>
  );
}

function Score({ label, value }: any) {
  return (
    <div className="border rounded-lg p-4 text-center w-32">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-3xl font-bold">{value}/10</p>
    </div>
  );
}
