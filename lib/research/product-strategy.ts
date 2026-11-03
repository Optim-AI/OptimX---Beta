/**
 * Product ad strategy — the brief a senior strategist would write for one product.
 *
 *   1. researchProductMarket   live web: what buyers compare it with, what they
 *                              praise/complain about, purchase moments, how rivals advertise
 *   2. writeStrategy           situation → insight → positioning → big idea →
 *                              evidence-led angles → objections → plan → measurement
 *
 * Saved brand research (brand-research.ts) is folded in when available. Output keeps
 * the old ad-angles shape ({ title, explanation }, campaign_plan) so existing UI and
 * saved versions keep working; the strategist's reasoning rides along in `brief`.
 */

import { generateResearchJson, groundedResearch, parseJsonLoose, type ResearchSource } from "./gemini";
import { researchDigest, type BrandResearch, type EvidenceBasis } from "./brand-research";

export type StrategyProductInput = {
  product_name?: string;
  description?: string;
  key_benefits?: string[];
  target_audience?: string;
  emotional_angles?: string[];
  use_cases?: string[];
  short_benefit?: string;
  price?: string | null;
  category?: string;
};

export type StrategyBrandInput = {
  name?: string;
  tone?: string;
  industry?: string;
  targetAudience?: string;
  website?: string;
};

export const AWARENESS_LEVELS = ["unaware", "problem-aware", "solution-aware", "product-aware", "most-aware"] as const;
export const FUNNEL_STAGES = ["Awareness", "Consideration", "Conversion"] as const;
export const PLAN_PLATFORMS = ["Instagram Reels", "Instagram Feed", "Facebook Feed"] as const;
export const PLAN_CONTENT_TYPES = ["UGC Video", "Cinematic Product Video", "Product Demo Video", "Carousel Ad", "Poster Ad"] as const;

export type StrategyAngle = {
  /** The hook as it would appear in the ad. */
  title: string;
  /** Kept for older UI and saved versions: message + insight in one paragraph. */
  explanation: string;
  angle: string;
  insight: string;
  evidence: string;
  basis: EvidenceBasis;
  audience: string;
  awareness: string;
  funnel: string;
  format: string;
  message: string;
  proof: string;
  why_it_wins: string;
  test: string;
};

export type StrategyPlanItem = {
  day: number;
  goal: string;
  platform: string;
  content_type: string;
  hook: string;
  description: string;
  angle?: string;
  rationale?: string;
};

export type StrategyBrief = {
  situation: {
    sophistication: { stage: number; implication: string };
    awareness: { level: string; implication: string };
    competitive_frame: string;
  };
  core_insight: { truth: string; tension: string; evidence: string; basis: EvidenceBasis };
  positioning: string;
  big_idea: { name: string; line: string; why: string };
  primary_audience: { who: string; moment: string; barrier: string };
  alternatives: Array<{ name: string; price?: string; claim?: string }>;
  objections: Array<{ objection: string; answer: string; proof: string }>;
  avoid: string[];
  measurement: { primary_kpi: string; early_signal: string; decision_rule: string };
  sources: ResearchSource[];
  research: "web" | "brand_research" | "product_only";
  /** True when the saved Brand Research was used (and the strategy kept to it). */
  alignedWithBrandResearch?: boolean;
};

export type ProductStrategy = {
  angles: StrategyAngle[];
  campaign_plan: StrategyPlanItem[];
  campaign_strategy: {
    product_category: string;
    target_audience: string;
    content_themes: string[];
    brief: StrategyBrief;
  };
};

const STRATEGIST_SYSTEM = `You are a senior brand strategist and performance creative lead. You have planned paid social for D2C and SaaS brands for 15 years.
You write strategy a CMO would sign off: specific, evidence-led, opinionated, honest.

How you think:
- Start from the buyer, not the product. Find the human truth and the tension current options leave unresolved.
- Read the market: how sophisticated it is (Schwartz stage 1-5) and how aware the buyer is (unaware → most-aware). These decide the message:
  stage 1-2: state the benefit plainly; stage 3: introduce a mechanism (why it works); stage 4: prove and elaborate the mechanism; stage 5: sell identity and experience.
  unaware/problem-aware: lead with the problem or moment; solution-aware: lead with the mechanism/difference; product-aware/most-aware: proof, offer, risk reversal.
- Position against a named alternative the buyer actually considers (a competitor, the category default, doing it at home, doing nothing).
- Every angle is built from a specific finding. Different angles must come from different findings — never from a fixed list of angle "types".
- Hooks carry a concrete noun from the research: a product detail, a price, a moment, a buyer phrase, a contrast with a named alternative.

Never:
- Put a product fact in a hook or message (numbers, ingredient counts, textures, certifications, results) unless it appears in the PRODUCT facts or the brand's own site evidence. Buyer opinions from the web are insight, not product claims.
- Name another company or its trademarks in hooks, messages or campaign copy. Competitors belong in the reasoning (insight, why_it_wins, positioning); in the ad, contrast with the category ("most protein bars", "sugar-alcohol bars").
- Invent statistics, ratings, review counts, customer counts, awards, or testimonials. First-person lines may only paraphrase buyer language found in the research and are never attributed to a named person.
- Use these: "elevate", "game-changer", "unlock", "revolutionize", "seamless", "look no further", "say goodbye to", "not all X are created equal", "finally, something that actually works", "I was skeptical", "your sign to", "stop scrolling".
- Lead with claims the research marks as saturated unless you give them a new mechanism or proof.
Plain text inside JSON strings. No markdown, no asterisks.`;

function productBlock(p: StrategyProductInput, b: StrategyBrandInput): string {
  const list = (v?: string[]) => (Array.isArray(v) && v.length ? v.join("; ") : "");
  return [
    `Product: ${p.product_name || "(unnamed)"}`,
    p.price ? `Price: ${p.price}` : "",
    p.category ? `Category: ${p.category}` : "",
    p.description ? `Description: ${p.description}` : "",
    list(p.key_benefits) ? `Benefits (from the product page): ${list(p.key_benefits)}` : "",
    p.short_benefit ? `One-line benefit: ${p.short_benefit}` : "",
    list(p.use_cases) ? `Use cases: ${list(p.use_cases)}` : "",
    p.target_audience ? `Stated audience: ${p.target_audience}` : "",
    `Brand: ${b.name || "(unknown)"}${b.website ? ` (${b.website})` : ""}`,
    b.industry ? `Industry: ${b.industry}` : "",
    b.tone ? `Brand tone: ${b.tone}` : "",
    b.targetAudience ? `Brand audience: ${b.targetAudience}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function productResearchPrompt(p: StrategyProductInput, b: StrategyBrandInput, market?: string, knownCompetitors: string[] = []): string {
  return `You are researching one product for an ad strategy. Use Google Search (Reddit, Amazon/Flipkart/G2 reviews, YouTube, forums, competitor sites).

${productBlock(p, b)}
${market ? `Market: ${market}` : ""}
${knownCompetitors.length ? `Competitors already identified for this brand: ${knownCompetitors.join(", ")}.` : ""}

Find:
1. 3-5 products a buyer would directly compare this with: brand, product, price, the main claim they advertise.${knownCompetitors.length ? " Start with the competing product from each already-identified competitor that sells one; add at most 2 other brands only if buyers clearly compare them." : ""}
2. What buyers of this kind of product praise, and what they complain about — specific, with where you saw it.
3. When and why people go looking for this kind of product (occasions, trigger moments), and what stops them buying.
4. How competitors advertise it: common hooks, claims and formats — and which are overused.
5. Exact phrases buyers use.

Return ONLY JSON:
{
  "alternatives": [{"name":"brand + product","price":"","claim":"","source":""}],
  "praise": [{"insight":"","evidence":"","source":""}],
  "complaints": [{"insight":"","evidence":"","source":""}],
  "triggers": [""],
  "barriers": [""],
  "competitor_ads": {"common_hooks":[""],"overused_claims":[""],"formats":[""]},
  "buyer_phrases": [""]
}
Only include what you found. Empty lists are fine.`;
}

function strategyPrompt(input: {
  product: StrategyProductInput;
  brand: StrategyBrandInput;
  productResearch: unknown;
  brandResearch: BrandResearch | null;
}): string {
  const { product, brand, productResearch, brandResearch } = input;
  const digest = researchDigest(brandResearch);
  const canonical = brandResearch
    ? `
=== CONSISTENCY WITH BRAND RESEARCH (the user already sees this research; do not contradict it) ===
- Market sophistication: the brand research says stage ${brandResearch.market.sophistication.stage}. Use the same stage unless this product sits in a clearly different sub-market; if so, say why in the implication.
- Competitors: ${brandResearch.competitors.map((c) => c.name).join(", ") || "(none)"}. When naming competitors in your reasoning, use these names; other brands only as product-level alternatives from the product research.
- Positioning must fit the brand's claimed position ("${brandResearch.positioning.claimed}") and may sharpen it for this product, not replace it.
- Saturated claims and white space from the brand research apply here too.`
    : "";
  return `Write the ad strategy for this product.

=== PRODUCT (from the brand's own site — basis "site") ===
${productBlock(product, brand)}

=== PRODUCT MARKET RESEARCH FROM THE WEB (basis "web") ===
${productResearch ? JSON.stringify(productResearch) : "(unavailable — insights from here on must be basis \"inferred\" unless they come from the product facts)"}

=== BRAND RESEARCH (earlier; site + web) ===
${digest || "(none)"}
${canonical}

Work through it in order, then return JSON:
1. Situation — market sophistication stage and what it means for the message; the buyer's dominant awareness level and what it means; the competitive frame (what they compare against, including non-obvious alternatives).
2. Core insight — one human truth about the buyer and the tension current options leave unresolved, with the evidence it rests on.
3. Positioning — "For [specific buyer] who [need], [product] is the [frame of reference] that [benefit], because [reason to believe]. Unlike [named alternative], it [difference]."
4. Big idea — a campaign platform: a name and one line that every ad can ladder up to.
5. Angles — exactly 5. Each from a DIFFERENT finding. At least two from what buyers say, one from a named competitor's weakness, one that uses proof the brand already has. Cover the funnel (awareness, consideration, conversion).
6. Objections — the 3 real reasons people don't buy, with the answer and the proof to show.
7. Avoid — claims and tropes that would make this look like every other ad in the category, and why.
8. Campaign plan — 6 posts over 2 weeks, sequenced by funnel, each using one of the angles (refer to it by its "angle" name) and saying why it sits there.
9. Measurement — the primary KPI, the early signal to watch in week 1, and the rule for killing or scaling an angle.

Return JSON:
{
  "situation": {
    "sophistication": {"stage": 3, "implication": ""},
    "awareness": {"level": "unaware|problem-aware|solution-aware|product-aware|most-aware", "implication": ""},
    "competitive_frame": ""
  },
  "core_insight": {"truth": "", "tension": "", "evidence": "", "basis": "site|web|inferred"},
  "positioning": "",
  "big_idea": {"name": "", "line": "", "why": ""},
  "primary_audience": {"who": "", "moment": "", "barrier": ""},
  "angles": [{
    "title": "the hook exactly as it would appear in the ad, max 10 words",
    "angle": "2-4 word name for the angle",
    "insight": "the specific finding it is built on",
    "evidence": "what/where — quote or paraphrase, with source",
    "basis": "site|web|inferred",
    "audience": "who this ad is for",
    "awareness": "unaware|problem-aware|solution-aware|product-aware|most-aware",
    "funnel": "Awareness|Consideration|Conversion",
    "format": "best format and why in a few words",
    "message": "what the ad says, one sentence",
    "proof": "what the ad shows to make it believable",
    "why_it_wins": "why this beats what competitors run",
    "test": "hypothesis and the metric that proves it"
  }],
  "objections": [{"objection": "", "answer": "", "proof": ""}],
  "avoid": [""],
  "campaign_plan": [{
    "day": 1,
    "goal": "Awareness|Consideration|Conversion",
    "platform": "Instagram Reels|Instagram Feed|Facebook Feed",
    "content_type": "UGC Video|Cinematic Product Video|Product Demo Video|Carousel Ad|Poster Ad",
    "hook": "",
    "description": "what the content shows, one sentence",
    "angle": "angle name it uses",
    "rationale": "why this post sits here in the sequence"
  }],
  "measurement": {"primary_kpi": "", "early_signal": "", "decision_rule": ""},
  "product_category": "",
  "target_audience": "one line",
  "content_themes": ["3-5 themes"]
}`;
}

/* ----------------------------- normalising ----------------------------- */

const BANNED = /\b(elevate|game[- ]changer|unlock|revolutioni[sz]e|seamless|look no further|say goodbye to|not all .{1,30} are created equal|finally,? something that actually works|i was skeptical|your sign to|stop scrolling)\b/i;

const s = (v: unknown, max = 500): string => (typeof v === "string" ? v.replace(/\*/g, "").trim().slice(0, max) : "");
const list = (v: unknown, n = 8, max = 240): string[] =>
  Array.isArray(v) ? v.map((x) => s(x, max)).filter(Boolean).slice(0, n) : [];
const basis = (v: unknown): EvidenceBasis => (v === "site" || v === "web" || v === "inferred" ? v : "inferred");
const oneOf = <T extends readonly string[]>(v: unknown, opts: T, fallback: T[number]): T[number] => {
  const hit = opts.find((o) => o.toLowerCase() === String(v ?? "").toLowerCase());
  return hit ?? fallback;
};

/** Models sometimes return the positioning template as an object; flatten it. */
function positioningText(v: unknown): string {
  if (typeof v === "string") return s(v, 600);
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    const statement = o.statement ?? o.positioning ?? o.text;
    if (typeof statement === "string") return s(statement, 600);
    return s(Object.values(o).filter((x) => typeof x === "string").join(" "), 600);
  }
  return "";
}

export function normalizeStrategy(
  raw: any,
  ctx: {
    sources: ResearchSource[];
    research: StrategyBrief["research"];
    alternatives: StrategyBrief["alternatives"];
    alignedWithBrandResearch?: boolean;
  }
): ProductStrategy {
  const angles: StrategyAngle[] = (Array.isArray(raw?.angles) ? raw.angles : [])
    .map((a: any) => {
      const message = s(a?.message, 300);
      const insight = s(a?.insight, 300);
      return {
        title: s(a?.title, 90),
        explanation: [message, insight && `Built on: ${insight}`].filter(Boolean).join(" "),
        angle: s(a?.angle, 40),
        insight,
        evidence: s(a?.evidence, 300),
        basis: basis(a?.basis),
        audience: s(a?.audience, 160),
        awareness: oneOf(a?.awareness, AWARENESS_LEVELS, "solution-aware"),
        funnel: oneOf(a?.funnel, FUNNEL_STAGES, "Consideration"),
        format: s(a?.format, 120),
        message,
        proof: s(a?.proof, 240),
        why_it_wins: s(a?.why_it_wins, 240),
        test: s(a?.test, 240),
      };
    })
    .filter((a: StrategyAngle) => a.title && !BANNED.test(a.title))
    .slice(0, 6);

  const campaign_plan: StrategyPlanItem[] = (Array.isArray(raw?.campaign_plan) ? raw.campaign_plan : [])
    .map((p: any, i: number) => ({
      day: Number.isFinite(Number(p?.day)) ? Number(p.day) : i + 1,
      goal: oneOf(p?.goal, FUNNEL_STAGES, "Consideration"),
      platform: oneOf(p?.platform, PLAN_PLATFORMS, "Instagram Feed"),
      content_type: oneOf(p?.content_type, PLAN_CONTENT_TYPES, "Poster Ad"),
      hook: s(p?.hook, 140),
      description: s(p?.description, 300),
      angle: s(p?.angle, 40) || undefined,
      rationale: s(p?.rationale, 240) || undefined,
    }))
    .filter((p: StrategyPlanItem) => p.hook)
    .slice(0, 8);

  const stage = Number(raw?.situation?.sophistication?.stage);
  const brief: StrategyBrief = {
    situation: {
      sophistication: {
        stage: Number.isFinite(stage) ? Math.min(5, Math.max(1, Math.round(stage))) : 3,
        implication: s(raw?.situation?.sophistication?.implication, 400),
      },
      awareness: {
        level: oneOf(raw?.situation?.awareness?.level, AWARENESS_LEVELS, "solution-aware"),
        implication: s(raw?.situation?.awareness?.implication, 400),
      },
      competitive_frame: s(raw?.situation?.competitive_frame, 400),
    },
    core_insight: {
      truth: s(raw?.core_insight?.truth, 400),
      tension: s(raw?.core_insight?.tension, 400),
      evidence: s(raw?.core_insight?.evidence, 400),
      basis: basis(raw?.core_insight?.basis),
    },
    positioning: positioningText(raw?.positioning),
    big_idea: { name: s(raw?.big_idea?.name, 60), line: s(raw?.big_idea?.line, 140), why: s(raw?.big_idea?.why, 400) },
    primary_audience: {
      who: s(raw?.primary_audience?.who, 200),
      moment: s(raw?.primary_audience?.moment, 240),
      barrier: s(raw?.primary_audience?.barrier, 240),
    },
    alternatives: ctx.alternatives,
    objections: (Array.isArray(raw?.objections) ? raw.objections : [])
      .map((o: any) => ({ objection: s(o?.objection, 200), answer: s(o?.answer, 300), proof: s(o?.proof, 240) }))
      .filter((o: { objection: string }) => o.objection)
      .slice(0, 4),
    avoid: list(raw?.avoid, 6),
    measurement: {
      primary_kpi: s(raw?.measurement?.primary_kpi, 160),
      early_signal: s(raw?.measurement?.early_signal, 240),
      decision_rule: s(raw?.measurement?.decision_rule, 300),
    },
    sources: ctx.sources.slice(0, 15),
    research: ctx.research,
    alignedWithBrandResearch: ctx.alignedWithBrandResearch ?? false,
  };

  return {
    angles,
    campaign_plan,
    campaign_strategy: {
      product_category: s(raw?.product_category, 80),
      target_audience: s(raw?.target_audience, 200) || brief.primary_audience.who,
      content_themes: list(raw?.content_themes, 5, 60),
      brief,
    },
  };
}

/* ------------------------------- pipeline ------------------------------- */

export async function buildProductStrategy(input: {
  product: StrategyProductInput;
  brand: StrategyBrandInput;
  brandResearch?: BrandResearch | null;
}): Promise<{ strategy: ProductStrategy; timings: Record<string, number> }> {
  const timings: Record<string, number> = {};
  const { product, brand } = input;
  const brandResearch = input.brandResearch ?? null;

  let t = Date.now();
  const grounded = await groundedResearch(
    productResearchPrompt(product, brand, brandResearch?.snapshot.market, brandResearch?.competitors.map((c) => c.name) ?? []),
    { label: "product-market", timeoutMs: 60_000 }
  ).catch((e) => {
    console.warn("[productStrategy] product research failed", (e as Error)?.message);
    return null;
  });
  timings.research = Date.now() - t;
  const productResearch = grounded ? parseJsonLoose<any>(grounded.text) : null;
  const ownBrand = (brand.name || "").toLowerCase().replace(/[^a-z0-9]/g, "");

  const alternatives: StrategyBrief["alternatives"] = (Array.isArray(productResearch?.alternatives) ? productResearch.alternatives : [])
    .map((a: any) => ({ name: s(a?.name, 100), price: s(a?.price, 60) || undefined, claim: s(a?.claim, 160) || undefined }))
    .filter((a: { name: string }) => a.name)
    // The brand's own products are not alternatives to compete against.
    .filter((a: { name: string }) => !ownBrand || !a.name.toLowerCase().replace(/[^a-z0-9]/g, "").includes(ownBrand))
    .slice(0, 5);

  t = Date.now();
  const raw = await generateResearchJson<any>(
    strategyPrompt({ product, brand, productResearch, brandResearch }),
    { system: STRATEGIST_SYSTEM, temperature: 0.6, label: "product-strategy", timeoutMs: 90_000 }
  );
  timings.strategy = Date.now() - t;

  const strategy = normalizeStrategy(raw, {
    sources: grounded?.sources ?? [],
    research: productResearch ? "web" : brandResearch ? "brand_research" : "product_only",
    alternatives,
    alignedWithBrandResearch: Boolean(brandResearch),
  });
  if (!strategy.angles.length) throw new Error("Strategy came back without usable angles");
  return { strategy, timings };
}
