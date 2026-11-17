/**
 * Focused research: one product, chosen regions, or both — next to the whole-brand
 * Brand Research.
 *
 *   1. frame          what the product is and the plain search term buyers use (no web)
 *   2. in parallel
 *      market         live web: competitors selling this product, prices, packs, ratings, where sold
 *      regional       live web: local brands, prices, language and festival hooks per region
 *      trends         Google Trends interest by state for the search term (real numbers)
 *      local search   Google results as seen from each region (SerpApi location)
 *   3. synthesize     the strategist's read, every point tagged with its basis
 *   4. fact check     numbers SkalX didn't read are removed; search scores come from Trends, never the model
 */
import { randomUUID } from "crypto";
import { safeFetchText } from "@/lib/audit/url-safety";
import { generateResearchJson, groundedResearch, parseJsonLoose, type ResearchSource } from "./gemini";
import { getSerpApiKey, serpGoogleSearchDetailed } from "./serp-search";
import { buildEvidence, cleanText, keepIfBacked, type VerifyStats } from "./verify";
import type { EvidenceBasis, ResearchInsight } from "./brand-research";
import { STATES, type ResearchRegion } from "./regions";

export type FocusedScope = {
  product: { name: string; url?: string | null; details?: string | null } | null;
  /** Region ids from regions.ts; empty = all of India */
  regions: Array<{ id: string; name: string; kind: "state" | "city"; stateName: string }>;
};

export type FocusedCompetitor = {
  name: string;
  brand: string;
  price: string;
  pack_size: string;
  rating: string;
  where_sold: string[];
  strength: string;
  weakness: string;
  source?: string;
  basis: EvidenceBasis;
};

export type RegionSearchInterest = {
  /** Google Trends score for the state, 0–100 (100 = the state that searches most) */
  score: number | null;
  /** Rank among states with data, 1 = highest */
  rank: number | null;
  of: number;
  /** For a city: its figure is its state's */
  fromState?: string;
};

export type FocusedRegion = {
  id: string;
  name: string;
  search_interest: RegionSearchInterest;
  summary: string;
  local_competitors: Array<{ name: string; note: string; basis: EvidenceBasis }>;
  price_notes: string;
  language_and_culture: string[];
  where_people_buy: string[];
  ad_angles: string[];
};

export type FocusedResearch = {
  version: 1;
  id: string;
  generatedAt: string;
  scope: FocusedScope;
  brandName: string;
  title: string;
  summary: string;
  product: {
    name: string;
    what_it_is: string;
    price: string;
    claims: string[];
    search_term: string;
  } | null;
  competitors: FocusedCompetitor[];
  price_landscape: { budget: string; typical: string; premium: string; where_yours_sits: string };
  customer_voice: { loves: ResearchInsight[]; complaints: ResearchInsight[]; buying_triggers: string[] };
  how_it_is_doing: { verdict: string; signals: string[]; basis: EvidenceBasis };
  regions: FocusedRegion[];
  /** Top states nationally for the search term (Google Trends), for context */
  top_states: Array<{ name: string; score: number }>;
  opportunities: Array<{ title: string; why: string; play: string }>;
  sources: ResearchSource[];
  evidence: {
    web_research: "ok" | "partial" | "unavailable";
    trends: "ok" | "no_data" | "unavailable";
    search_term: string;
    notes: string[];
  };
};

export type FocusedInput = {
  brand: { name: string; description?: string; category?: string; website?: string | null; digest?: string };
  product: { name: string; url?: string | null; details?: string | null; price?: string | null } | null;
  regions: ResearchRegion[];
};

/* ---------------------------- small helpers ---------------------------- */

const str = (v: unknown, max = 600) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const list = (v: unknown, n = 8, max = 200) =>
  Array.isArray(v) ? v.map((x) => str(x, max)).filter(Boolean).slice(0, n) : [];
const basisOf = (v: unknown): EvidenceBasis => (v === "web" || v === "site" ? v : "inferred");
const where = (regions: ResearchRegion[]) =>
  regions.length ? regions.map((r) => (r.kind === "city" ? `${r.name} (${r.stateName})` : r.name)).join(", ") : "India (all regions)";

function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

async function readProductPage(url: string): Promise<string> {
  try {
    const page = await safeFetchText(url, {
      timeoutMs: 12_000,
      maxBytes: 1_500_000,
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36",
    });
    return htmlToText(page.body).slice(0, 6000);
  } catch (e) {
    console.warn("[focusedResearch] product page unreadable", (e as Error)?.message);
    return "";
  }
}

/* ------------------------------ 1. frame ------------------------------ */

type Frame = { what_it_is: string; search_term: string; category: string; price: string; claims: string[] };

async function frameProduct(input: FocusedInput, pageText: string): Promise<Frame> {
  const p = input.product;
  const raw = await generateResearchJson<Record<string, unknown>>(
    `Identify what is being researched, for an Indian market study.

BRAND: ${input.brand.name}${input.brand.category ? ` (${input.brand.category})` : ""}
${input.brand.description ? `About the brand: ${input.brand.description}` : ""}
${p ? `PRODUCT: ${p.name}${p.price ? `\nListed price: ${p.price}` : ""}${p.details ? `\nOwner's notes: ${p.details}` : ""}` : "No single product: research the brand's main category."}
${pageText ? `PRODUCT PAGE TEXT:\n${pageText}` : ""}

Return ONLY JSON:
{
  "what_it_is": "one plain sentence: the product type, form and who it's for",
  "search_term": "the 1-3 word generic term Indian shoppers type into Google for this kind of product, in English, no brand name (e.g. 'quinoa', 'hair oil', 'protein bar')",
  "category": "product category",
  "price": "the price and pack if the page or notes state it, else empty",
  "claims": ["claims the product makes, from the page or notes only"]
}`,
    { label: "focused-frame", timeoutMs: 40_000 }
  );
  const term = str(raw.search_term, 60).toLowerCase().replace(/["']/g, "");
  return {
    what_it_is: str(raw.what_it_is, 300),
    search_term: term || (p?.name || input.brand.category || input.brand.name).toLowerCase().slice(0, 40),
    category: str(raw.category, 80) || input.brand.category || "",
    price: str(raw.price, 120),
    claims: list(raw.claims, 6, 160),
  };
}

/* ---------------------------- 2. live research ---------------------------- */

function marketPrompt(input: FocusedInput, frame: Frame): string {
  const p = input.product;
  return `You are researching ONE product's market in India for a marketing strategy. Use Google Search — Amazon.in, Flipkart, BigBasket, Blinkit, Zepto, Swiggy Instamart, brand sites, reviews, Reddit.

THE PRODUCT: ${p ? `${p.name} by ${input.brand.name}` : `${input.brand.name}'s ${frame.category}`} — ${frame.what_it_is}
Search term buyers use: "${frame.search_term}"
${frame.price ? `Its price: ${frame.price}` : ""}
MARKET FOCUS: ${where(input.regions)}

Find and report:
1. 4-8 REAL competing products sold in India that a buyer would compare it with (brand + product). For each: price with pack size, rating with its platform and count if shown, where it is sold, what buyers like, what they complain about.
2. How ${input.brand.name}'s product itself shows up online: listings, ratings, reviews, mentions. If you find nothing, say so.
3. The usual price range for this product type (budget / typical / premium), with pack sizes.
4. What buyers of this product type love, what they complain about, and what makes them buy.

Return ONLY JSON:
{
  "competitors": [{"name":"product","brand":"","price":"₹… for …g","pack_size":"","rating":"4.2 on Amazon (1,300)","where_sold":["Amazon"],"liked_for":"","complaints":"","source":"domain"}],
  "own_product": {"found_online": true, "signals": ["4.1 on Amazon (210 ratings)", "listed on Blinkit"], "sources": ["domain"]},
  "price_range": {"budget":"","typical":"","premium":""},
  "loves": [""], "complaints": [""], "buying_triggers": [""]
}
If you cannot verify something, leave it empty rather than guessing.`;
}

function regionalPrompt(input: FocusedInput, frame: Frame): string {
  return `You are researching regional markets in India for "${frame.search_term}" (${frame.what_it_is}). Use Google Search.

REGIONS: ${input.regions.map((r) => `${r.name}${r.kind === "city" ? ` (city in ${r.stateName})` : ""}, local language ${r.language}`).join("; ")}

For EACH region report:
- local or regional brands of this product type that are strong there (real names only)
- price notes: anything specific to that region (local pricing, popular pack sizes)
- language and culture: local-language words, dishes or uses, festivals and seasons that matter for this product
- where people there buy it (modern trade, quick commerce, kirana, local chains — name chains only if real)
- 2-3 ad angles that would land there

Return ONLY JSON:
{"regions":[{"name":"exact region name from the list","local_brands":[{"name":"","note":""}],"price_notes":"","language_and_culture":[""],"where_people_buy":[""],"ad_angles":[""],"sources":["domain"]}]}
Leave fields empty rather than guessing.`;
}

async function grounded(prompt: string, label: string) {
  const r = await groundedResearch(prompt, { label, timeoutMs: 70_000 });
  return { data: parseJsonLoose<Record<string, any>>(r.text), sources: r.sources, text: r.text };
}

type TrendsResult = { status: "ok" | "no_data" | "unavailable"; byState: Map<string, number>; ranked: Array<{ code: string; name: string; score: number }> };

/** Google Trends interest by Indian state for the term, past 12 months (SerpApi). */
export async function trendsByState(term: string, fetcher: typeof fetch = fetch): Promise<TrendsResult> {
  const empty = (status: TrendsResult["status"]): TrendsResult => ({ status, byState: new Map(), ranked: [] });
  const key = getSerpApiKey();
  if (!key || !term) return empty("unavailable");
  try {
    const p = new URLSearchParams({ engine: "google_trends", q: term, geo: "IN", data_type: "GEO_MAP_0", region: "REGION", date: "today 12-m", api_key: key });
    const res = await fetcher(`https://serpapi.com/search.json?${p}`, { signal: AbortSignal.timeout(20_000) });
    const j = (await res.json()) as { error?: string; interest_by_region?: Array<{ geo?: string; location?: string; extracted_value?: number }> };
    if (!res.ok) return empty("unavailable");
    const rows = (j.interest_by_region || []).filter((r) => r.geo && typeof r.extracted_value === "number" && r.extracted_value > 0);
    if (!rows.length) return empty("no_data");
    const ranked = rows
      .map((r) => ({ code: String(r.geo), name: String(r.location || r.geo), score: Number(r.extracted_value) }))
      .sort((a, b) => b.score - a.score);
    return { status: "ok", byState: new Map(ranked.map((r) => [r.code, r.score])), ranked };
  } catch (e) {
    console.warn("[focusedResearch] trends failed", (e as Error)?.message);
    return empty("unavailable");
  }
}

export function interestFor(region: ResearchRegion, t: TrendsResult): RegionSearchInterest {
  const score = t.byState.get(region.stateCode) ?? null;
  const rank = score === null ? null : t.ranked.findIndex((r) => r.code === region.stateCode) + 1;
  return { score, rank, of: t.ranked.length, ...(region.kind === "city" ? { fromState: region.stateName } : {}) };
}

async function localSearch(region: ResearchRegion, term: string): Promise<string> {
  const out = await serpGoogleSearchDetailed(getSerpApiKey(), {
    q: `best ${term} brands ${region.name}`,
    num: 8,
    gl: "in",
    hl: "en",
    location: region.searchLocation,
  });
  return out.results.map((r) => `- ${r.title}: ${r.snippet || ""} (${r.link})`).join("\n");
}

/* ------------------------------ 3. synthesis ------------------------------ */

function synthesisPrompt(input: FocusedInput, frame: Frame, evidence: string): string {
  const p = input.product;
  return `You are a senior marketing strategist in India writing a focused research brief.

BRAND: ${input.brand.name}${input.brand.website ? ` (${input.brand.website})` : ""}
${input.brand.digest ? `WHAT WE ALREADY KNOW ABOUT THE BRAND:\n${input.brand.digest}\n` : ""}
FOCUS: ${p ? `the product "${p.name}" — ${frame.what_it_is}` : `the brand's ${frame.category}`}
MARKET: ${where(input.regions)}

EVIDENCE (the only facts you may use; numbers not in here must not appear):
${evidence}

Write plain, specific English a busy founder understands. Every competitor and claim must come from the evidence. Mark "basis": "web" when the evidence shows it, "inferred" when it is your judgement.
${input.regions.length ? `Write one entry in "regions" for each of: ${input.regions.map((r) => r.name).join(", ")} (use these exact names).` : `"regions" must be an empty array.`}

Return ONLY JSON:
{
  "title": "short report title, e.g. 'Quinoa in Tamil Nadu & Kerala'",
  "summary": "one paragraph: the market for this product here and the single biggest opportunity",
  "competitors": [{"name":"","brand":"","price":"","pack_size":"","rating":"","where_sold":[""],"strength":"","weakness":"","source":"domain","basis":"web"}],
  "price_landscape": {"budget":"","typical":"","premium":"","where_yours_sits":""},
  "customer_voice": {"loves":[{"insight":"","evidence":"","basis":"web"}],"complaints":[{"insight":"","evidence":"","basis":"web"}],"buying_triggers":[""]},
  "how_it_is_doing": {"verdict":"honest read from public signals only (ratings, reviews, listings); say clearly if there is little or nothing public","signals":["short plain sentences, e.g. 'Listed on Amazon with 4.1 stars from 210 ratings'"],"basis":"web"},
  "regions": [{"name":"","summary":"","local_competitors":[{"name":"","note":"","basis":"web"}],"price_notes":"","language_and_culture":[""],"where_people_buy":[""],"ad_angles":[""]}],
  "opportunities": [{"title":"","why":"","play":"what to do in ads"}]
}`;
}

/* ------------------------------ 4. fact check ------------------------------ */

function insight(raw: any, ev: ReturnType<typeof buildEvidence>, stats: VerifyStats): ResearchInsight | null {
  const text = cleanText(str(raw?.insight ?? raw?.point, 300), ev, stats);
  if (!text) return null;
  return { insight: text, evidence: cleanText(str(raw?.evidence, 300), ev, stats), basis: basisOf(raw?.basis) };
}

/* -------------------------------- run it -------------------------------- */

export async function researchFocused(input: FocusedInput): Promise<FocusedResearch> {
  const notes: string[] = [];
  const pageText = input.product?.url ? await readProductPage(input.product.url) : "";
  if (input.product?.url && !pageText) notes.push("SkalX couldn't open the product link, so the product details come from its name and your notes.");

  const frame = await frameProduct(input, pageText);

  const [market, regional, trends, local] = await Promise.all([
    grounded(marketPrompt(input, frame), "focused-market").catch((e) => {
      console.warn("[focusedResearch] market failed", (e as Error)?.message);
      return null;
    }),
    input.regions.length
      ? grounded(regionalPrompt(input, frame), "focused-regional").catch((e) => {
          console.warn("[focusedResearch] regional failed", (e as Error)?.message);
          return null;
        })
      : Promise.resolve(null),
    trendsByState(frame.search_term),
    Promise.all(input.regions.map((r) => localSearch(r, frame.search_term).catch(() => ""))),
  ]);

  const sources: ResearchSource[] = [];
  const seen = new Set<string>();
  for (const s of [...(market?.sources || []), ...(regional?.sources || [])]) {
    if (seen.has(s.title || s.url)) continue;
    seen.add(s.title || s.url);
    sources.push(s);
  }

  const evidenceParts = [
    pageText && `PRODUCT PAGE:\n${pageText}`,
    input.product?.details && `OWNER'S NOTES: ${input.product.details}`,
    input.product?.price && `LISTED PRICE: ${input.product.price}`,
    market?.text && `MARKET SEARCH:\n${market.text}`,
    regional?.text && `REGIONAL SEARCH:\n${regional.text}`,
    ...input.regions.map((r, i) => local[i] && `GOOGLE RESULTS AS SEEN FROM ${r.name.toUpperCase()}:\n${local[i]}`),
  ].filter(Boolean) as string[];
  const evidenceText = evidenceParts.join("\n\n").slice(0, 30_000);

  const webOk = Boolean(market?.data);
  const regionalOk = !input.regions.length || Boolean(regional?.data) || local.some(Boolean);
  if (!webOk) notes.push("Live competitor search was unavailable, so competitor details are limited.");
  if (input.regions.length && !regionalOk) notes.push("Regional search was unavailable, so regional notes are limited.");
  if (trends.status === "no_data") notes.push(`Google Trends has too little search data for "${frame.search_term}" in India to compare states.`);
  if (trends.status === "unavailable") notes.push("Google Trends was unavailable, so regional search interest isn't shown.");
  if (input.regions.some((r) => r.kind === "city")) notes.push("Google Trends has no reliable city-level figures, so each city shows its state's search interest.");

  const raw = await generateResearchJson<Record<string, any>>(synthesisPrompt(input, frame, evidenceText || "(no live evidence — say so)"), {
    label: "focused-synthesis",
    timeoutMs: 80_000,
  });

  const ev = buildEvidence([evidenceText, frame.price, ...frame.claims]);
  const stats: VerifyStats = { removedStatements: 0, unverifiedSources: 0 };
  const realHosts = new Set(sources.map((s) => (s.title || "").toLowerCase().replace(/^www\./, "")).filter((h) => h.includes(".")));
  // The model often names a source ("BigBasket") rather than its domain: match either.
  const sourceOk = (s: string) => {
    const h = s.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
    const bare = h.replace(/[^a-z0-9]/g, "");
    return [...realHosts].some((r) => h === r || h.endsWith(`.${r}`) || r.endsWith(`.${h}`) || (bare.length > 3 && r.split(".")[0].replace(/[^a-z0-9]/g, "") === bare));
  };
  // A rating is a short number with its scale or platform ("4.2 on Amazon (1,300)"), never a review quote.
  const ratingOf = (v: unknown) => {
    const r = str(v, 80);
    return r.length <= 60 && /^\d(\.\d+)?\s*(\/\s*(5|10)|out of|★|stars?\b|on\b)/i.test(r) ? keepIfBacked(r, ev, stats) || "" : "";
  };
  // Signals are sentences for a founder, not data keys like "own_product.found_online: false".
  const plain = (t: string) => !/^[a-z_.]+\s*:\s*(true|false|null|\d+)\s*$/i.test(t) && !/[a-z]+_[a-z]+\.[a-z_]+/i.test(t);

  const competitors: FocusedCompetitor[] = (Array.isArray(raw.competitors) ? raw.competitors : [])
    .slice(0, 8)
    .map((c: any) => {
      const source = str(c?.source, 80);
      const real = Boolean(source) && sourceOk(source);
      if (source && !real) stats.unverifiedSources++;
      const price = keepIfBacked(str(c?.price, 80), ev, stats) || "";
      const rating = ratingOf(c?.rating);
      // Web-backed when it names a real source, or its price/rating was found in what SkalX read.
      const backed = real || Boolean(price || rating);
      return {
        name: str(c?.name, 120),
        brand: str(c?.brand, 80),
        price,
        pack_size: str(c?.pack_size, 60),
        rating,
        where_sold: list(c?.where_sold, 6, 40),
        strength: cleanText(str(c?.strength, 240), ev, stats),
        weakness: cleanText(str(c?.weakness, 240), ev, stats),
        ...(real ? { source } : {}),
        basis: backed ? basisOf(c?.basis) : basisOf(c?.basis) === "web" ? "inferred" : basisOf(c?.basis),
      };
    })
    .filter((c: FocusedCompetitor) => c.name);

  const regionsOut: FocusedRegion[] = input.regions.map((r) => {
    const m = (Array.isArray(raw.regions) ? raw.regions : []).find((x: any) => str(x?.name, 80).toLowerCase() === r.name.toLowerCase()) || {};
    return {
      id: r.id,
      name: r.name,
      search_interest: interestFor(r, trends),
      summary: cleanText(str(m.summary, 500), ev, stats),
      local_competitors: (Array.isArray(m.local_competitors) ? m.local_competitors : [])
        .slice(0, 6)
        .map((c: any) => ({ name: str(c?.name, 80), note: cleanText(str(c?.note, 200), ev, stats), basis: basisOf(c?.basis) }))
        .filter((c: { name: string }) => c.name),
      price_notes: cleanText(str(m.price_notes, 300), ev, stats),
      language_and_culture: list(m.language_and_culture, 6).map((x) => cleanText(x, ev, stats)).filter(Boolean),
      where_people_buy: list(m.where_people_buy, 6, 80),
      ad_angles: list(m.ad_angles, 4).map((x) => cleanText(x, ev, stats)).filter(Boolean),
    };
  });

  const pl = raw.price_landscape || {};
  const cv = raw.customer_voice || {};
  const hd = raw.how_it_is_doing || {};
  if (stats.removedStatements) notes.push(`${stats.removedStatements} statement(s) were removed because SkalX couldn't find their numbers in what it read.`);

  return {
    version: 1,
    id: randomUUID(),
    generatedAt: new Date().toISOString(),
    scope: {
      product: input.product ? { name: input.product.name, url: input.product.url ?? null, details: input.product.details ?? null } : null,
      regions: input.regions.map((r) => ({ id: r.id, name: r.name, kind: r.kind, stateName: r.stateName })),
    },
    brandName: input.brand.name,
    title: str(raw.title, 120) || [input.product?.name, input.regions.length ? `in ${input.regions.map((r) => r.name).join(", ")}` : ""].filter(Boolean).join(" ") || input.brand.name,
    summary: cleanText(str(raw.summary, 900), ev, stats),
    product: input.product
      ? { name: input.product.name, what_it_is: frame.what_it_is, price: keepIfBacked(frame.price, ev, stats) || "", claims: frame.claims, search_term: frame.search_term }
      : null,
    competitors,
    price_landscape: {
      budget: keepIfBacked(str(pl.budget, 120), ev, stats) || "",
      typical: keepIfBacked(str(pl.typical, 120), ev, stats) || "",
      premium: keepIfBacked(str(pl.premium, 120), ev, stats) || "",
      where_yours_sits: cleanText(str(pl.where_yours_sits, 240), ev, stats),
    },
    customer_voice: {
      loves: (Array.isArray(cv.loves) ? cv.loves : []).slice(0, 5).map((x: any) => insight(x, ev, stats)).filter(Boolean) as ResearchInsight[],
      complaints: (Array.isArray(cv.complaints) ? cv.complaints : []).slice(0, 5).map((x: any) => insight(x, ev, stats)).filter(Boolean) as ResearchInsight[],
      buying_triggers: list(cv.buying_triggers, 5),
    },
    how_it_is_doing: {
      verdict: cleanText(str(hd.verdict, 500), ev, stats),
      signals: list(hd.signals, 6).filter(plain).map((s) => keepIfBacked(s, ev, stats)).filter(Boolean) as string[],
      basis: basisOf(hd.basis),
    },
    regions: regionsOut,
    top_states: trends.ranked.slice(0, 5).map((r) => ({ name: r.name, score: r.score })),
    opportunities: (Array.isArray(raw.opportunities) ? raw.opportunities : [])
      .slice(0, 5)
      .map((o: any) => ({ title: str(o?.title, 120), why: cleanText(str(o?.why, 300), ev, stats), play: cleanText(str(o?.play, 300), ev, stats) }))
      .filter((o: { title: string }) => o.title),
    sources,
    evidence: {
      web_research: webOk && regionalOk ? "ok" : webOk || regionalOk ? "partial" : "unavailable",
      trends: trends.status,
      search_term: frame.search_term,
      notes,
    },
  };
}

/** States list for the picker (re-exported so the API can send it). */
export { STATES };
