// Product & region research: pick a product and/or regions, run, read saved reports.
import React, { useCallback, useEffect, useMemo, useState } from "react";
import colors from "@/lib/ui/colors";
import { authFetch } from "@/lib/utils";
import { friendlyError, readJson, responseError } from "@/lib/api-errors";
import { showConfirm } from "@/app/web/src/components/ui/alert-modal-api";
import { toast } from "sonner";
import { MapPin, Package, Search, Trash2, X } from "lucide-react";
import { ArcSpinner, StepProgress } from "@/app/web/src/components/ui/loaders";
import { BasisChip } from "./BrandResearchReport";
import type { FocusedResearch, FocusedRegion } from "@/lib/research/focused-research";

type RegionOption = { id: string; name: string; kind: "state" | "city"; stateName: string };
type ProductOption = { id: string; name: string; price?: string | null };

const field = "w-full rounded-lg px-3 py-2 text-sm outline-none";
const fieldStyle = { background: colors.secondary, border: `1px solid ${colors.border}`, color: colors.foreground };

function Card(props: { title: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl p-5 ${props.className || ""}`} style={{ background: colors.card, border: `1px solid ${colors.border}` }}>
      <h2 className="text-sm font-semibold" style={{ color: colors.foreground }}>{props.title}</h2>
      {props.hint && <p className="mt-1 text-xs" style={{ color: colors.mutedForeground }}>{props.hint}</p>}
      <div className="mt-3">{props.children}</div>
    </section>
  );
}

const muted = (t: string) => <p className="text-xs" style={{ color: colors.mutedForeground }}>{t}</p>;

function Bullets({ items, empty }: { items: string[]; empty: string }) {
  if (!items.length) return muted(empty);
  return (
    <ul className="space-y-1.5">
      {items.map((t, i) => (
        <li key={i} className="text-sm leading-snug" style={{ color: colors.foreground }}>• {t}</li>
      ))}
    </ul>
  );
}

function InterestBar({ region }: { region: FocusedRegion }) {
  const s = region.search_interest;
  if (s.score === null) return muted("Not enough Google searches here to score.");
  return (
    <div>
      <div className="flex items-baseline justify-between text-xs" style={{ color: colors.mutedForeground }}>
        <span>Search interest (Google Trends)</span>
        <span>
          <b style={{ color: colors.foreground }}>{s.score}</b>/100 · #{s.rank} of {s.of} states
        </span>
      </div>
      <div className="mt-1 h-2 rounded-full" style={{ background: colors.secondary }}>
        <div className="h-2 rounded-full" style={{ width: `${s.score}%`, background: colors.primary }} />
      </div>
      {s.fromState && <p className="mt-1 text-[11px]" style={{ color: colors.mutedForeground }}>Uses {s.fromState}&apos;s figure (no city-level data).</p>}
    </div>
  );
}

export function FocusedReport({ report }: { report: FocusedResearch }) {
  const pl = report.price_landscape;
  return (
    <div className="space-y-4">
      <Card title={report.title}>
        <div className="mb-3 flex flex-wrap gap-2">
          {report.scope.product && (
            <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs" style={{ background: colors.secondary, color: colors.foreground }}>
              <Package className="h-3 w-3" /> {report.scope.product.name}
            </span>
          )}
          {report.scope.regions.length ? (
            report.scope.regions.map((r) => (
              <span key={r.id} className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs" style={{ background: colors.secondary, color: colors.foreground }}>
                <MapPin className="h-3 w-3" /> {r.name}
              </span>
            ))
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs" style={{ background: colors.secondary, color: colors.foreground }}>
              <MapPin className="h-3 w-3" /> All of India
            </span>
          )}
          <span className="text-xs self-center" style={{ color: colors.mutedForeground }}>
            {new Date(report.generatedAt).toLocaleDateString()}
          </span>
        </div>
        <p className="text-sm leading-relaxed" style={{ color: colors.foreground }}>{report.summary || "No summary — see the sections below."}</p>
        {report.product?.what_it_is && <p className="mt-2 text-xs" style={{ color: colors.mutedForeground }}>Researched as: {report.product.what_it_is} (Google term: “{report.evidence.search_term}”)</p>}
      </Card>

      {report.scope.product && (
        <Card title="How this product is doing" hint="From public signals only: listings, ratings and reviews. Sales need your own store or ad data.">
          <p className="text-sm" style={{ color: colors.foreground }}>{report.how_it_is_doing.verdict || "Nothing public found yet."}</p>
          {report.how_it_is_doing.signals.length > 0 && <div className="mt-2"><Bullets items={report.how_it_is_doing.signals} empty="" /></div>}
        </Card>
      )}

      <Card title="Competing products" hint="Real products a buyer would compare yours with.">
        {report.competitors.length ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {report.competitors.map((c, i) => (
              <div key={i} className="rounded-lg p-3" style={{ background: colors.secondary }}>
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium" style={{ color: colors.foreground }}>{c.brand ? `${c.brand} — ` : ""}{c.name}</p>
                  <BasisChip basis={c.basis} />
                </div>
                <p className="mt-1 text-xs" style={{ color: colors.mutedForeground }}>
                  {[c.price, c.pack_size && !c.price.includes(c.pack_size) ? c.pack_size : "", c.rating].filter(Boolean).join(" · ") || "No verified price or rating"}
                </p>
                {c.where_sold.length > 0 && <p className="mt-1 text-xs" style={{ color: colors.mutedForeground }}>Sold on: {c.where_sold.join(", ")}</p>}
                {c.strength && <p className="mt-2 text-xs" style={{ color: colors.foreground }}><b>Strength:</b> {c.strength}</p>}
                {c.weakness && <p className="mt-1 text-xs" style={{ color: colors.foreground }}><b>Weakness:</b> {c.weakness}</p>}
              </div>
            ))}
          </div>
        ) : muted("No competing products could be verified.")}
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card title="Price landscape">
          <dl className="space-y-1.5 text-sm" style={{ color: colors.foreground }}>
            {([["Budget", pl.budget], ["Typical", pl.typical], ["Premium", pl.premium]] as const).map(([k, v]) => (
              <div key={k} className="flex gap-2"><dt className="w-20 shrink-0" style={{ color: colors.mutedForeground }}>{k}</dt><dd>{v || "—"}</dd></div>
            ))}
          </dl>
          {pl.where_yours_sits && <p className="mt-2 text-xs" style={{ color: colors.mutedForeground }}>{pl.where_yours_sits}</p>}
        </Card>
        <Card title="What buyers say">
          <p className="mb-1 text-xs font-medium" style={{ color: colors.mutedForeground }}>They love</p>
          <Bullets items={report.customer_voice.loves.map((x) => x.insight)} empty="Not enough reviews found." />
          <p className="mb-1 mt-3 text-xs font-medium" style={{ color: colors.mutedForeground }}>They complain about</p>
          <Bullets items={report.customer_voice.complaints.map((x) => x.insight)} empty="Not enough reviews found." />
          {report.customer_voice.buying_triggers.length > 0 && (
            <>
              <p className="mb-1 mt-3 text-xs font-medium" style={{ color: colors.mutedForeground }}>What makes them buy</p>
              <Bullets items={report.customer_voice.buying_triggers} empty="" />
            </>
          )}
        </Card>
      </div>

      {report.regions.length > 0 && (
        <div className="space-y-4">
          <h2 className="pt-2 text-base font-semibold" style={{ color: colors.foreground }}>By region</h2>
          {report.top_states.length > 0 && muted(`Most searched nationally: ${report.top_states.map((s) => `${s.name} (${s.score})`).join(", ")}.`)}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {report.regions.map((r) => (
              <Card key={r.id} title={r.name}>
                <InterestBar region={r} />
                {r.summary && <p className="mt-3 text-sm" style={{ color: colors.foreground }}>{r.summary}</p>}
                <p className="mb-1 mt-3 text-xs font-medium" style={{ color: colors.mutedForeground }}>Brands strong here</p>
                <Bullets items={r.local_competitors.map((c) => (c.note ? `${c.name} — ${c.note}` : c.name))} empty="No local brands verified." />
                {r.price_notes && (
                  <>
                    <p className="mb-1 mt-3 text-xs font-medium" style={{ color: colors.mutedForeground }}>Prices</p>
                    <p className="text-sm" style={{ color: colors.foreground }}>{r.price_notes}</p>
                  </>
                )}
                <p className="mb-1 mt-3 text-xs font-medium" style={{ color: colors.mutedForeground }}>Language, food &amp; festivals</p>
                <Bullets items={r.language_and_culture} empty="—" />
                {r.where_people_buy.length > 0 && (
                  <>
                    <p className="mb-1 mt-3 text-xs font-medium" style={{ color: colors.mutedForeground }}>Where people buy</p>
                    <p className="text-sm" style={{ color: colors.foreground }}>{r.where_people_buy.join(", ")}</p>
                  </>
                )}
                <p className="mb-1 mt-3 text-xs font-medium" style={{ color: colors.mutedForeground }}>Ad angles for {r.name}</p>
                <Bullets items={r.ad_angles} empty="—" />
              </Card>
            ))}
          </div>
        </div>
      )}

      {report.opportunities.length > 0 && (
        <Card title="Where you can win">
          <div className="space-y-3">
            {report.opportunities.map((o, i) => (
              <div key={i}>
                <p className="text-sm font-medium" style={{ color: colors.foreground }}>{o.title}</p>
                {o.why && <p className="text-xs" style={{ color: colors.mutedForeground }}>{o.why}</p>}
                {o.play && <p className="mt-1 text-sm" style={{ color: colors.foreground }}>→ {o.play}</p>}
              </div>
            ))}
          </div>
        </Card>
      )}

      {(report.evidence.notes.length > 0 || report.sources.length > 0) && (
        <details className="rounded-xl p-4 text-xs" style={{ background: colors.card, border: `1px solid ${colors.border}`, color: colors.mutedForeground }}>
          <summary className="cursor-pointer">How this was researched ({report.sources.length} sources)</summary>
          <ul className="mt-2 space-y-1">{report.evidence.notes.map((n, i) => <li key={i}>• {n}</li>)}</ul>
          <ul className="mt-2 space-y-0.5">
            {report.sources.slice(0, 30).map((s, i) => (
              <li key={i}><a href={s.url} target="_blank" rel="noreferrer" className="underline">{s.title || s.url}</a></li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

export default function FocusedResearchPanel() {
  const [reports, setReports] = useState<FocusedResearch[]>([]);
  const [regions, setRegions] = useState<{ states: RegionOption[]; cities: RegionOption[] }>({ states: [], cities: [] });
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [productName, setProductName] = useState("");
  const [productUrl, setProductUrl] = useState("");
  const [productNotes, setProductNotes] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [running, setRunning] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [r, p] = await Promise.all([authFetch("/api/brand/focused-research"), authFetch("/api/test-packs/products").catch(() => null)]);
        const json = await readJson<any>(r);
        if (r.ok) {
          setReports(json.reports || []);
          setRegions(json.regions || { states: [], cities: [] });
          setSelectedId(json.reports?.[0]?.id ?? null);
        }
        if (p?.ok) setProducts(((await readJson<any>(p)).products || []) as ProductOption[]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const toggle = (id: string) =>
    setPicked((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : cur.length >= 6 ? (toast.message("Pick up to 6 regions at a time."), cur) : [...cur, id]));

  const run = useCallback(async () => {
    if (!productName.trim() && !picked.length) {
      toast.error("Pick a product, a region, or both.");
      return;
    }
    setRunning(true);
    try {
      const res = await authFetch("/api/brand/focused-research", {
        method: "POST",
        body: JSON.stringify({
          product: productName.trim() ? { name: productName.trim(), url: productUrl.trim() || null, details: productNotes.trim() || null, price: products.find((p) => p.name === productName.trim())?.price ?? null } : null,
          regions: picked,
        }),
      });
      const json = await readJson<any>(res);
      if (!res.ok || !json.report) throw new Error(responseError(res, json, "Research failed. Please try again."));
      setReports((cur) => [json.report, ...cur.filter((r) => r.id !== json.report.id)]);
      setSelectedId(json.report.id);
    } catch (e) {
      toast.error(friendlyError(e, "Research failed. Please try again."));
    } finally {
      setRunning(false);
    }
  }, [productName, productUrl, productNotes, picked, products]);

  const remove = useCallback(async (id: string) => {
    if (!(await showConfirm("Delete this report? This can't be undone.", { title: "Delete report", confirmLabel: "Delete" }))) return;
    const res = await authFetch(`/api/brand/focused-research?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (!res.ok) return toast.error("Couldn't delete the report.");
    setReports((cur) => {
      const next = cur.filter((r) => r.id !== id);
      setSelectedId(next[0]?.id ?? null);
      return next;
    });
  }, []);

  const selected = useMemo(() => reports.find((r) => r.id === selectedId) || null, [reports, selectedId]);
  const chip = (r: RegionOption) => {
    const on = picked.includes(r.id);
    return (
      <button key={r.id} type="button" onClick={() => toggle(r.id)} aria-pressed={on}
        className="rounded-full px-3 py-1 text-xs"
        style={on ? { background: colors.primary, color: colors.primaryForeground } : { background: colors.secondary, color: colors.foreground, border: `1px solid ${colors.border}` }}>
        {r.name}
      </button>
    );
  };

  return (
    <div className="space-y-6">
      <section className="rounded-xl p-5" style={{ background: colors.card, border: `1px solid ${colors.border}` }}>
        <h2 className="text-sm font-semibold" style={{ color: colors.foreground }}>What do you want to research?</h2>
        <p className="mt-1 text-xs" style={{ color: colors.mutedForeground }}>
          Pick one product, the regions you sell in, or both. No website needed.
        </p>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <label htmlFor="fr-product" className="mb-1 block text-xs font-medium" style={{ color: colors.mutedForeground }}>Product (optional)</label>
            <input id="fr-product" list="fr-products" className={field} style={fieldStyle} value={productName}
              onChange={(e) => setProductName(e.target.value)} placeholder="e.g. Begain Quinoa 500g" />
            <datalist id="fr-products">{products.map((p) => <option key={p.id} value={p.name} />)}</datalist>
          </div>
          <div>
            <label htmlFor="fr-url" className="mb-1 block text-xs font-medium" style={{ color: colors.mutedForeground }}>Product link (optional)</label>
            <input id="fr-url" className={field} style={fieldStyle} value={productUrl}
              onChange={(e) => setProductUrl(e.target.value)} placeholder="Amazon, Flipkart or your own page" />
          </div>
          <div className="md:col-span-2">
            <label htmlFor="fr-notes" className="mb-1 block text-xs font-medium" style={{ color: colors.mutedForeground }}>About the product (optional)</label>
            <input id="fr-notes" className={field} style={fieldStyle} value={productNotes}
              onChange={(e) => setProductNotes(e.target.value)} placeholder="e.g. organic white quinoa, 500g jar, ₹299" />
          </div>
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium" style={{ color: colors.mutedForeground }}>Regions (optional — leave empty for all of India)</p>
            {picked.length > 0 && (
              <button type="button" onClick={() => setPicked([])} className="inline-flex items-center gap-1 text-xs" style={{ color: colors.mutedForeground }}>
                <X className="h-3 w-3" /> Clear
              </button>
            )}
          </div>
          <p className="mb-1.5 mt-2 text-[11px] uppercase tracking-wide" style={{ color: colors.mutedForeground }}>States</p>
          <div className="flex flex-wrap gap-1.5">{regions.states.map(chip)}</div>
          <p className="mb-1.5 mt-3 text-[11px] uppercase tracking-wide" style={{ color: colors.mutedForeground }}>Cities</p>
          <div className="flex flex-wrap gap-1.5">{regions.cities.map(chip)}</div>
        </div>

        <button type="button" onClick={() => void run()} disabled={running || (!productName.trim() && !picked.length)}
          className="mt-5 inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-60"
          style={{ background: colors.primary, color: colors.primaryForeground }}>
          {running ? <ArcSpinner className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          {running ? "Researching…" : "Run research"}
        </button>
      </section>

      {running && (
        <div className="rounded-2xl p-5" style={{ background: colors.card, border: `1px solid ${colors.border}` }}>
          <StepProgress
            className="max-w-md"
            estimatedMs={80_000}
            hint="about a minute"
            steps={[
              "Understanding the product…",
              "Finding competing products and prices…",
              "Checking Google search interest by state…",
              "Reading local markets…",
              "Writing your report…",
            ]}
          />
        </div>
      )}

      {!loading && reports.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-medium" style={{ color: colors.mutedForeground }}>Your reports</p>
          <div className="flex flex-wrap gap-2">
            {reports.map((r) => (
              <span key={r.id} className="inline-flex items-center overflow-hidden rounded-full text-xs"
                style={r.id === selectedId ? { background: colors.primary, color: colors.primaryForeground } : { background: colors.secondary, color: colors.foreground, border: `1px solid ${colors.border}` }}>
                <button type="button" onClick={() => setSelectedId(r.id)} className="px-3 py-1">{r.title}</button>
                <button type="button" onClick={() => void remove(r.id)} aria-label={`Delete ${r.title}`} className="px-2 py-1 opacity-70 hover:opacity-100">
                  <Trash2 className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {selected && !running && <FocusedReport report={selected} />}
      {!loading && !reports.length && !running && muted("No product or regional research yet.")}
    </div>
  );
}
