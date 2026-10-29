/**
 * Brand research — what a strategist would want to know before writing a brief.
 *
 *   1. crawlSite            first-party evidence (pages, prices, ratings, proof)
 *   2. in parallel
 *      profileBrand         brand facts + identity from the site (no web)
 *      researchMarket       live web: real competitors, prices, what's said about the brand
 *      researchCustomers    live web: how buyers in the category talk (Reddit, reviews…)
 *   3. synthesizeResearch   the strategist's read, every point tagged with its basis
 *
 * Web steps degrade gracefully: if search fails the report is built from the
 * site alone and says so in evidence.notes. Numbers are never invented.
 */

import { crawlSite, formatSiteEvidence, type SiteEvidence } from "./site-crawl";
import {
  generateResearchJson,
  groundedResearch,
  parseJsonLoose,
  type ResearchSource,
} from "./gemini";

export type EvidenceBasis = "site" | "web" | "inferred";

export type BrandProfile = {
  company_name: string;
  one_liner: string;
  what_they_sell: string[];
  who_it_is_for: string[];
  category: string;
  sub_category: string;
  business_model: string;
  customer_type: "B2B" | "B2C" | "D2C" | "B2B2C" | string;
  country: string;
  price_positioning: "budget" | "mid-range" | "premium" | "unclear";
  claims_made: string[];
  value_proposition: string;
  tagline: string;
  brand_voice: "Professional" | "Playful" | "Minimalist" | "Bold";
  personality: string;
  brand_aesthetic: string[];
  brand_tone: string[];
  brand_values: string[];
  business_overview: string;
  visual_style: {
    minimal_vs_detailed?: string;
    flat_vs_realistic?: string;
    illustration_vs_photography?: string;
    light_vs_dark?: string;
  };
  typography_intent: { style?: string; contrast?: string };
  product_images: string[];
};

export type ResearchCompetitor = {
  name: string;
  website?: string;
  flagship?: string;
  price_point?: string;
  positioning: string;
  strength: string;
  weakness: string;
  how_to_win: string;
  basis: EvidenceBasis;
};

export type ResearchInsight = {
  insight: string;
  evidence: string;
  source?: string;
  basis: EvidenceBasis;
};

export type BrandResearch = {
  version: 1;
  generatedAt: string;
  websiteUrl: string;
  /** One paragraph a founder would recognise as true about their business. */
  summary: string;
  snapshot: {
    category: string;
    business_model: string;
    market: string;
    price_point: string;
    price_evidence: string;
  };
  positioning: {
    claimed: string;
    proof_points: ResearchInsight[];
    gaps: string[];
    verdict: string;
  };
  audiences: Array<{
    segment: string;
    job_to_be_done: string;
    trigger_moment: string;
    what_they_need_to_hear: string;
    basis: EvidenceBasis;
  }>;
  competitors: ResearchCompetitor[];
  customer_voice: {
    desires: ResearchInsight[];
    frustrations: ResearchInsight[];
    objections: ResearchInsight[];
    their_words: string[];
  };
  market: {
    sophistication: { stage: number; meaning: string };
    category_conventions: string[];
    saturated_claims: string[];
    whitespace: string[];
  };
  reputation: { summary: string; ratings: string[]; basis: EvidenceBasis };
  site_findings: Array<{ finding: string; impact: "high" | "medium" | "low"; fix: string }>;
  opportunities: Array<{ title: string; why: string; play: string; evidence: string }>;
  sources: ResearchSource[];
  evidence: {
    pages_read: number;
    products_found: number;
    web_sources: number;
    web_research: "ok" | "partial" | "unavailable";
    notes: string[];
  };
};

export type BrandResearchResult = {
  site: SiteEvidence;
  profile: BrandProfile;
  research: BrandResearch | null;
  timings: Record<string, number>;
};

const ANALYST_SYSTEM = `You are a senior brand strategist and market researcher at a top agency.
You write for founders and marketers who will act on what you say.
- Be specific to THIS business. A line that could describe any brand in the category is a failure.
- Separate what you observed from what you infer. Never invent numbers, ratings, review counts, prices or customer counts.
- Prefer concrete nouns (product names, prices, places, moments) over adjectives.
- Plain text only inside JSON strings. No markdown, no asterisks.`;

function compactSiteBrief(site: SiteEvidence): string {
  const home = site.pages[0];
  const products = site.products
    .slice(0, 12)
    .map((p) => `${p.name}${p.price ? ` ${p.currency || ""}${p.price}` : ""}`)
    .join("; ");
  return [
    `Domain: ${site.domain}`,
    `Homepage title: ${home?.title}`,
    `Homepage description: ${home?.description}`,
    `Homepage headings: ${home?.headings.slice(0, 8).join(" | ")}`,
    products ? `Products on site: ${products}` : "",
    site.priceRange
      ? `Price range on site: ${site.priceRange.currency || ""}${site.priceRange.min}–${site.priceRange.max}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/* ---------------------------- 2a. profile ---------------------------- */

function profilePrompt(site: SiteEvidence, images: string[]): string {
  return `Read this website evidence and profile the business.

${formatSiteEvidence(site)}

Candidate images (pick product/offering photos only — no logos, icons, banners, people avatars, payment badges):
${images.slice(0, 40).join("\n") || "(none)"}

Return JSON:
{
  "company_name": "brand name as customers say it",
  "one_liner": "what they sell, to whom, and the angle — max 20 words, concrete",
  "what_they_sell": ["product lines or services, concrete"],
  "who_it_is_for": ["customer segments evident from the site"],
  "category": "market category, e.g. 'protein snacks', 'project management software'",
  "sub_category": "narrower niche, e.g. 'clean-label protein bars'",
  "business_model": "e.g. D2C e-commerce, subscription SaaS, marketplace, local service",
  "customer_type": "B2B|B2C|D2C|B2B2C",
  "country": "main market, from currency/phone/address/shipping cues; 'global' if unclear",
  "price_positioning": "budget|mid-range|premium|unclear — judged from actual prices if present",
  "claims_made": ["claims the site makes about itself, verbatim-ish"],
  "value_proposition": "the core promise in the brand's own framing, max 100 chars",
  "tagline": "exact tagline/slogan if present, else empty",
  "brand_voice": "Professional|Playful|Minimalist|Bold",
  "personality": "one word: confident|friendly|youthful|premium|bold|playful|professional|minimal",
  "brand_aesthetic": ["4-6 visual descriptors"],
  "brand_tone": ["3-5 tone descriptors"],
  "brand_values": ["certifications, commitments, differentiators stated on the site"],
  "business_overview": "exactly 2 sentences, max 220 chars",
  "visual_style": {"minimal_vs_detailed":"minimal|detailed|balanced","flat_vs_realistic":"flat|realistic|mixed","illustration_vs_photography":"illustration|photography|mixed","light_vs_dark":"light|dark|balanced"},
  "typography_intent": {"style":"modern|bold|playful|premium|minimal|classic","contrast":"high|medium|low"},
  "product_images": ["up to 6 image URLs from the candidate list, best product shots first"]
}`;
}

/* ------------------------- 2b. market (grounded) ------------------------- */

function marketPrompt(site: SiteEvidence): string {
  return `You are researching a company for a marketing strategy. Use Google Search.

THE COMPANY (from its own website):
${compactSiteBrief(site)}

Research and report:
1. What the company sells and its main market (country).
2. 4-6 REAL direct competitors a buyer of this company would actually compare it against — brands, not marketplaces, retailers, review sites or media. For each: name, website, flagship product, typical price, main positioning/claim, what customers praise, what customers complain about.
3. What is said about the company itself online: ratings (only if you find a real number with its platform), review themes, press, controversies.
4. How brands in this category usually advertise — the claims nearly everyone makes.
5. Notable category trends in the last 12 months.

Return ONLY JSON:
{
  "market": "country/region",
  "competitors": [{"name":"","website":"","flagship":"","price_point":"","positioning":"","praised_for":"","complaints":"","source":"domain you got it from"}],
  "brand_reputation": {"summary":"","ratings":["4.3 on Amazon (1,200 ratings)"],"themes":[""],"sources":["domain"]},
  "category_conventions": ["claims/visual tropes everyone uses"],
  "trends": [""],
  "notes": "anything that changes how this company should market itself"
}
If you cannot verify something, leave it empty rather than guessing.`;
}

/* ---------------------- 2c. customer voice (grounded) ---------------------- */

function customerPrompt(site: SiteEvidence): string {
  return `You are doing voice-of-customer research for a marketing strategy. Use Google Search — Reddit, Amazon/Flipkart/G2/Trustpilot reviews, YouTube comments, forums, Quora.

THE COMPANY:
${compactSiteBrief(site)}

Find what real buyers in this company's category (and of this company, if there is enough) say:
- what they want (desired outcomes, in their terms),
- what frustrates them about current options,
- what makes them hesitate before buying (objections, risks, price doubts),
- the moments/situations that make them go looking for a product like this,
- exact phrases they repeat.

Return ONLY JSON:
{
  "desires": [{"insight":"","evidence":"short paraphrase or quote","source":"e.g. reddit.com/r/IndianFood"}],
  "frustrations": [{"insight":"","evidence":"","source":""}],
  "objections": [{"insight":"","evidence":"","source":""}],
  "trigger_moments": [""],
  "their_words": ["phrases buyers use, verbatim"]
}
Use 3-6 items per list. Only include what you found; do not fill gaps with assumptions.`;
}

/* --------------------------- 3. synthesis --------------------------- */

function synthesisPrompt(input: {
  site: SiteEvidence;
  profile: BrandProfile;
  market: unknown;
  customers: unknown;
}): string {
  const { site, profile, market, customers } = input;
  return `Write the research read for this business. Inputs are labelled by where they came from.

=== SITE EVIDENCE (basis "site") ===
${formatSiteEvidence(site).slice(0, 14000)}

=== BRAND PROFILE (derived from the site) ===
${JSON.stringify(profile)}

=== MARKET RESEARCH FROM THE WEB (basis "web") ===
${market ? JSON.stringify(market) : "(unavailable — do not invent competitors; leave competitors empty)"}

=== VOICE OF CUSTOMER FROM THE WEB (basis "web") ===
${customers ? JSON.stringify(customers) : "(unavailable — any customer insight must be basis \"inferred\")"}

Think like a strategist preparing for a client meeting:
- What does this brand claim, and does the site actually prove it? Name the proof (or its absence).
- Who really buys, at which moment, and what do they need to hear?
- Against named competitors, where does this brand win and lose? How should it win?
- How sophisticated is the market (Eugene Schwartz stage 1-5: 1 = first to market, simple claim works; 3 = claims saturated, need a new mechanism; 5 = buyers jaded, sell identity/experience)?
- What claims are saturated, and where is the white space?
- What on the website is costing them sales right now?
- The 3 highest-leverage moves, each tied to evidence.

Return JSON:
{
  "summary": "4-5 sentences: the honest read a founder would recognise — category, position, real strength, biggest gap, the opportunity",
  "snapshot": {"category":"","business_model":"","market":"","price_point":"e.g. ₹120-₹1,350; premium vs category","price_evidence":"where the price read comes from"},
  "positioning": {
    "claimed": "what the brand says it is",
    "proof_points": [{"insight":"proof that exists","evidence":"what/where","source":"page url or domain","basis":"site|web"}],
    "gaps": ["claims made without visible proof, or proof they have but don't use"],
    "verdict": "1-2 sentences: is the positioning distinct and believable?"
  },
  "audiences": [{"segment":"specific group","job_to_be_done":"what they hire the product for","trigger_moment":"the situation that starts the search","what_they_need_to_hear":"the message that moves them","basis":"site|web|inferred"}],
  "competitors": [{"name":"","website":"","flagship":"","price_point":"","positioning":"","strength":"","weakness":"","how_to_win":"specific move for this brand","basis":"web"}],
  "customer_voice": {
    "desires": [{"insight":"","evidence":"","source":"","basis":"web|inferred"}],
    "frustrations": [{"insight":"","evidence":"","source":"","basis":"web|inferred"}],
    "objections": [{"insight":"","evidence":"","source":"","basis":"web|inferred"}],
    "their_words": ["verbatim buyer phrases from the web research only"]
  },
  "market": {
    "sophistication": {"stage": 1, "meaning": "what this stage means for this brand's messaging"},
    "category_conventions": [""],
    "saturated_claims": ["claims too common to differentiate"],
    "whitespace": ["unclaimed positions this brand could credibly own"]
  },
  "reputation": {"summary":"","ratings":["only real numbers found, with platform"],"basis":"web|site|inferred"},
  "site_findings": [{"finding":"concrete issue seen on the site","impact":"high|medium|low","fix":"specific fix"}],
  "opportunities": [{"title":"short name","why":"the insight","play":"what to do in marketing, concretely","evidence":"what it rests on"}]
}
Sizes: 2-4 audiences, up to 6 competitors (only those in the market research), 3-5 site findings, exactly 3 opportunities.`;
}

/* ---------------------------- normalising ---------------------------- */

const str = (v: unknown, max = 600): string => (typeof v === "string" ? v.replace(/\*/g, "").trim().slice(0, max) : "");
const strList = (v: unknown, n = 8, max = 200): string[] =>
  Array.isArray(v) ? v.map((x) => str(x, max)).filter(Boolean).slice(0, n) : [];
const basisOf = (v: unknown, fallback: EvidenceBasis): EvidenceBasis =>
  v === "site" || v === "web" || v === "inferred" ? v : fallback;

function insights(v: unknown, fallback: EvidenceBasis, n = 6): ResearchInsight[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((x: any) => ({
      insight: str(x?.insight, 240),
      evidence: str(x?.evidence, 300),
      source: str(x?.source, 120) || undefined,
      basis: basisOf(x?.basis, fallback),
    }))
    .filter((x) => x.insight)
    .slice(0, n);
}

export function normalizeProfile(raw: any, site: SiteEvidence): BrandProfile {
  const pricePos = ["budget", "mid-range", "premium"].includes(raw?.price_positioning) ? raw.price_positioning : "unclear";
  const voice = ["Professional", "Playful", "Minimalist", "Bold"].includes(raw?.brand_voice) ? raw.brand_voice : "Professional";
  return {
    company_name: str(raw?.company_name, 80) || site.domain.split(".")[0],
    one_liner: str(raw?.one_liner, 200),
    what_they_sell: strList(raw?.what_they_sell),
    who_it_is_for: strList(raw?.who_it_is_for),
    category: str(raw?.category, 80),
    sub_category: str(raw?.sub_category, 80),
    business_model: str(raw?.business_model, 80),
    customer_type: str(raw?.customer_type, 10) || "B2C",
    country: str(raw?.country, 60),
    price_positioning: pricePos,
    claims_made: strList(raw?.claims_made, 10),
    value_proposition: str(raw?.value_proposition, 140),
    tagline: str(raw?.tagline, 120),
    brand_voice: voice,
    personality: str(raw?.personality, 30),
    brand_aesthetic: strList(raw?.brand_aesthetic, 6, 40),
    brand_tone: strList(raw?.brand_tone, 5, 40),
    brand_values: strList(raw?.brand_values, 8, 60),
    business_overview: str(raw?.business_overview, 300),
    visual_style: raw?.visual_style && typeof raw.visual_style === "object" ? raw.visual_style : {},
    typography_intent: raw?.typography_intent && typeof raw.typography_intent === "object" ? raw.typography_intent : {},
    product_images: strList(raw?.product_images, 6, 2000).filter((u) => /^https?:\/\//.test(u)),
  };
}

export function normalizeResearch(
  raw: any,
  ctx: { site: SiteEvidence; sources: ResearchSource[]; webStatus: BrandResearch["evidence"]["web_research"]; notes: string[] }
): BrandResearch {
  const stage = Number(raw?.market?.sophistication?.stage);
  const impact = (v: unknown) => (v === "high" || v === "medium" || v === "low" ? v : "medium");
  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    websiteUrl: ctx.site.url,
    summary: str(raw?.summary, 1200),
    snapshot: {
      category: str(raw?.snapshot?.category, 100),
      business_model: str(raw?.snapshot?.business_model, 100),
      market: str(raw?.snapshot?.market, 80),
      price_point: str(raw?.snapshot?.price_point, 160),
      price_evidence: str(raw?.snapshot?.price_evidence, 200),
    },
    positioning: {
      claimed: str(raw?.positioning?.claimed, 300),
      proof_points: insights(raw?.positioning?.proof_points, "site"),
      gaps: strList(raw?.positioning?.gaps, 6, 240),
      verdict: str(raw?.positioning?.verdict, 400),
    },
    audiences: Array.isArray(raw?.audiences)
      ? raw.audiences
          .map((a: any) => ({
            segment: str(a?.segment, 120),
            job_to_be_done: str(a?.job_to_be_done, 240),
            trigger_moment: str(a?.trigger_moment, 240),
            what_they_need_to_hear: str(a?.what_they_need_to_hear, 240),
            basis: basisOf(a?.basis, "inferred"),
          }))
          .filter((a: { segment: string }) => a.segment)
          .slice(0, 4)
      : [],
    competitors:
      ctx.webStatus === "unavailable" || !Array.isArray(raw?.competitors)
        ? []
        : raw.competitors
            .map((c: any) => ({
              name: str(c?.name, 80),
              website: str(c?.website, 120) || undefined,
              flagship: str(c?.flagship, 120) || undefined,
              price_point: str(c?.price_point, 80) || undefined,
              positioning: str(c?.positioning, 240),
              strength: str(c?.strength, 240),
              weakness: str(c?.weakness, 240),
              how_to_win: str(c?.how_to_win, 300),
              basis: "web" as const,
            }))
            .filter((c: ResearchCompetitor) => c.name)
            .slice(0, 6),
    customer_voice: {
      desires: insights(raw?.customer_voice?.desires, "inferred"),
      frustrations: insights(raw?.customer_voice?.frustrations, "inferred"),
      objections: insights(raw?.customer_voice?.objections, "inferred"),
      their_words: ctx.webStatus === "unavailable" ? [] : strList(raw?.customer_voice?.their_words, 10, 120),
    },
    market: {
      sophistication: {
        stage: Number.isFinite(stage) ? Math.min(5, Math.max(1, Math.round(stage))) : 3,
        meaning: str(raw?.market?.sophistication?.meaning, 400),
      },
      category_conventions: strList(raw?.market?.category_conventions, 6),
      saturated_claims: strList(raw?.market?.saturated_claims, 6),
      whitespace: strList(raw?.market?.whitespace, 5, 240),
    },
    reputation: {
      summary: str(raw?.reputation?.summary, 500),
      ratings: ctx.webStatus === "unavailable" ? [] : strList(raw?.reputation?.ratings, 5, 120),
      basis: basisOf(raw?.reputation?.basis, "inferred"),
    },
    site_findings: Array.isArray(raw?.site_findings)
      ? raw.site_findings
          .map((f: any) => ({ finding: str(f?.finding, 240), impact: impact(f?.impact), fix: str(f?.fix, 300) }))
          .filter((f: { finding: string }) => f.finding)
          .slice(0, 5)
      : [],
    opportunities: Array.isArray(raw?.opportunities)
      ? raw.opportunities
          .map((o: any) => ({ title: str(o?.title, 80), why: str(o?.why, 300), play: str(o?.play, 400), evidence: str(o?.evidence, 300) }))
          .filter((o: { title: string }) => o.title)
          .slice(0, 3)
      : [],
    sources: ctx.sources.slice(0, 20),
    evidence: {
      pages_read: ctx.site.pages.length,
      products_found: ctx.site.products.length,
      web_sources: ctx.sources.length,
      web_research: ctx.webStatus,
      notes: ctx.notes,
    },
  };
}

/* ------------------------------ pipeline ------------------------------ */

/** Fast step on its own: brand facts and identity from the site (no web search). */
export async function profileBrand(site: SiteEvidence, images: string[] = []): Promise<BrandProfile> {
  const raw = await generateResearchJson<any>(profilePrompt(site, images), {
    system: ANALYST_SYSTEM,
    temperature: 0.2,
    label: "brand-profile",
  });
  return normalizeProfile(raw, site);
}

async function timed<T>(timings: Record<string, number>, key: string, fn: () => Promise<T>): Promise<T> {
  const t = Date.now();
  try {
    return await fn();
  } finally {
    timings[key] = Date.now() - t;
  }
}

async function groundedJson(prompt: string, label: string) {
  const r = await groundedResearch(prompt, { label, timeoutMs: 70_000 });
  return { data: parseJsonLoose<Record<string, unknown>>(r.text), sources: r.sources };
}

export async function researchBrand(
  url: string,
  opts: { images?: string[]; site?: SiteEvidence; skipWeb?: boolean } = {}
): Promise<BrandResearchResult> {
  const timings: Record<string, number> = {};
  const site = opts.site ?? (await timed(timings, "crawl", () => crawlSite(url)));

  const webOff = opts.skipWeb === true;
  const [profile, market, customers] = await Promise.all([
    timed(timings, "profile", () => profileBrand(site, opts.images || [])),
    webOff
      ? Promise.resolve(null)
      : timed(timings, "market", () => groundedJson(marketPrompt(site), "brand-market")).catch((e) => {
          console.warn("[brandResearch] market research failed", (e as Error)?.message);
          return null;
        }),
    webOff
      ? Promise.resolve(null)
      : timed(timings, "customers", () => groundedJson(customerPrompt(site), "brand-customers")).catch((e) => {
          console.warn("[brandResearch] customer research failed", (e as Error)?.message);
          return null;
        }),
  ]);

  const notes: string[] = [];
  const marketOk = Boolean(market?.data);
  const customersOk = Boolean(customers?.data);
  if (!marketOk) notes.push("Competitor and reputation search was unavailable; those sections are limited.");
  if (!customersOk) notes.push("Customer-voice search was unavailable; customer insights are inferred from the site.");
  if (!site.products.length) notes.push("No product catalogue or prices could be read from the site.");
  const webStatus: BrandResearch["evidence"]["web_research"] =
    marketOk && customersOk ? "ok" : marketOk || customersOk ? "partial" : "unavailable";

  const sources: ResearchSource[] = [];
  const seen = new Set<string>();
  for (const s of [...(market?.sources || []), ...(customers?.sources || [])]) {
    if (seen.has(s.title)) continue;
    seen.add(s.title);
    sources.push(s);
  }

  let research: BrandResearch | null = null;
  try {
    const raw = await timed(timings, "synthesis", () =>
      generateResearchJson<any>(
        synthesisPrompt({ site, profile, market: market?.data, customers: customers?.data }),
        { system: ANALYST_SYSTEM, temperature: 0.35, label: "brand-synthesis", timeoutMs: 90_000 }
      )
    );
    research = normalizeResearch(raw, { site, sources, webStatus, notes });
  } catch (e) {
    console.warn("[brandResearch] synthesis failed", (e as Error)?.message);
  }

  return { site, profile, research, timings };
}

/** Short plain-text digest for downstream prompts (strategy, poster copy). */
export function researchDigest(r: BrandResearch | null | undefined, maxChars = 3500): string {
  if (!r) return "";
  const lines: string[] = [];
  if (r.summary) lines.push(`Read: ${r.summary}`);
  if (r.positioning.claimed) lines.push(`Claimed position: ${r.positioning.claimed}`);
  if (r.positioning.proof_points.length)
    lines.push(`Proof that exists: ${r.positioning.proof_points.map((p) => p.insight).join("; ")}`);
  if (r.audiences.length)
    lines.push(
      `Audiences: ${r.audiences.map((a) => `${a.segment} — trigger: ${a.trigger_moment}; needs to hear: ${a.what_they_need_to_hear}`).join(" || ")}`
    );
  if (r.competitors.length)
    lines.push(`Competitors: ${r.competitors.map((c) => `${c.name} (${c.price_point || "?"}; ${c.positioning}; weak: ${c.weakness})`).join(" || ")}`);
  const cv = r.customer_voice;
  if (cv.desires.length) lines.push(`Buyers want: ${cv.desires.map((d) => d.insight).join("; ")}`);
  if (cv.frustrations.length) lines.push(`Buyers are frustrated by: ${cv.frustrations.map((d) => d.insight).join("; ")}`);
  if (cv.objections.length) lines.push(`Objections: ${cv.objections.map((d) => d.insight).join("; ")}`);
  if (cv.their_words.length) lines.push(`Buyer phrases: ${cv.their_words.join(" | ")}`);
  lines.push(`Market sophistication: stage ${r.market.sophistication.stage} — ${r.market.sophistication.meaning}`);
  if (r.market.saturated_claims.length) lines.push(`Saturated claims to avoid: ${r.market.saturated_claims.join("; ")}`);
  if (r.market.whitespace.length) lines.push(`White space: ${r.market.whitespace.join("; ")}`);
  if (r.reputation.ratings.length) lines.push(`Ratings found: ${r.reputation.ratings.join("; ")}`);
  return lines.join("\n").slice(0, maxChars);
}
