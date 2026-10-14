/**
 * Evidence grounding for audit output. AI text is accepted only after:
 * - evidence ids are intersected with ids we actually collected,
 * - sentences with metric claims not present in the evidence are dropped,
 * - exactly three ideas exist (deterministic fallback fills gaps).
 * Engagement highlights are computed from observed data, never from AI.
 */

import {
  IDEA_FORMATS,
  type AuditBrand,
  type AuditInsights,
  type AuditOpportunity,
  type AuditTheme,
  type CompetitorPost,
  type ContentIdea,
  type EngagementHighlight,
  type EngagementSignal,
  type IdeaFormat,
} from './types';

export type GroundingContext = {
  evidenceIds: Set<string>;
  observedNumbers: Set<string>;
};

const METRIC_RE =
  /(\d[\d,]*(?:\.\d+)?)\s*(%|percent|x\b|k\b|m\b|likes?|comments?|views?|followers?|shares?|impressions?|clicks?|conversions?|engagements?|sales|customers|users|orders|roas|ctr)/gi;
const MULTIPLIER_RE = /\b(\d+(?:\.\d+)?)\s*(?:x|times)\s+(?:more|higher|better|faster)/gi;

function canonicalNumber(raw: string): string {
  const n = Number(raw.replace(/,/g, ''));
  return Number.isFinite(n) ? String(n) : raw;
}

/** All numbers that appear in observed text, so the model may repeat them. */
export function collectObservedNumbers(texts: Array<string | null | undefined>): Set<string> {
  const out = new Set<string>();
  for (const t of texts) {
    if (!t) continue;
    for (const m of t.matchAll(/\d[\d,]*(?:\.\d+)?/g)) out.add(canonicalNumber(m[0]));
  }
  return out;
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+(?=[A-Z0-9"“'(])/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Drop sentences that assert metrics we did not observe. */
export function stripUnsupportedClaims(text: unknown, observed: Set<string>): string {
  if (typeof text !== 'string') return '';
  const kept: string[] = [];
  for (const sentence of splitSentences(text.trim())) {
    let supported = true;
    for (const re of [METRIC_RE, MULTIPLIER_RE]) {
      re.lastIndex = 0;
      for (const m of sentence.matchAll(re)) {
        if (!observed.has(canonicalNumber(m[1]))) {
          supported = false;
          break;
        }
      }
      if (!supported) break;
    }
    if (supported) kept.push(sentence);
  }
  return kept.join(' ').slice(0, 1200);
}

function cleanText(value: unknown, max = 400): string {
  if (typeof value !== 'string') return '';
  return value.replace(/\s+/g, ' ').trim().slice(0, max);
}

function groundIds(raw: unknown, ctx: GroundingContext): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const id of raw) {
    if (typeof id === 'string' && ctx.evidenceIds.has(id) && !out.includes(id)) out.push(id);
  }
  return out.slice(0, 8);
}

export function normalizeIdeaFormat(raw: unknown): IdeaFormat {
  const v = typeof raw === 'string' ? raw.toLowerCase() : '';
  if (/reel|video|short|tiktok|ugc/.test(v)) return 'Reel / short video';
  if (/carousel|slides?/.test(v)) return 'Carousel';
  if (/story|stories/.test(v)) return 'Story';
  return IDEA_FORMATS[0];
}

export function studioForFormat(format: IdeaFormat): ContentIdea['studio'] {
  return format === 'Reel / short video' ? 'video' : 'poster';
}

function sanitizeTheme(raw: any, ctx: GroundingContext): AuditTheme | null {
  const title = cleanText(raw?.title, 120);
  const observation = stripUnsupportedClaims(cleanText(raw?.observation, 600), ctx.observedNumbers);
  if (!title || !observation) return null;
  const evidenceIds = groundIds(raw?.evidence_ids ?? raw?.evidenceIds, ctx);
  return { title, observation, evidenceIds, basis: evidenceIds.length ? 'evidence' : 'inference' };
}

function sanitizeOpportunity(raw: any, ctx: GroundingContext): AuditOpportunity | null {
  const title = cleanText(raw?.title, 120);
  const explanation = stripUnsupportedClaims(cleanText(raw?.explanation, 600), ctx.observedNumbers);
  if (!title || !explanation) return null;
  const evidenceIds = groundIds(raw?.evidence_ids ?? raw?.evidenceIds, ctx);
  return { title, explanation, evidenceIds, basis: evidenceIds.length ? 'evidence' : 'inference' };
}

function sanitizeIdea(raw: any, ctx: GroundingContext): ContentIdea | null {
  const strip = (v: unknown, max: number) => stripUnsupportedClaims(cleanText(v, max), ctx.observedNumbers);
  const title = strip(raw?.title, 120);
  const hook = strip(raw?.hook, 240);
  const brief = strip(raw?.brief ?? raw?.creative_brief, 900);
  if (!title || !hook || !brief) return null;
  const format = normalizeIdeaFormat(raw?.format ?? raw?.suggested_format);
  return {
    title,
    hook,
    brief,
    format,
    audience: strip(raw?.audience, 240) || 'Your existing audience',
    rationale: strip(raw?.rationale, 600) || 'Fits the positioning observed on your website.',
    cta: strip(raw?.cta, 120) || 'Learn more',
    evidenceIds: groundIds(raw?.evidence_ids ?? raw?.evidenceIds, ctx),
    studio: studioForFormat(format),
  };
}

/** Business-specific ideas built only from the brand's own site copy. */
export function buildFallbackIdeas(brand: AuditBrand | null): ContentIdea[] {
  const name = brand?.name || 'your brand';
  const product = brand?.interpretation.products[0] || brand?.interpretation.productCategory || 'your flagship offer';
  const audience = brand?.interpretation.audience || 'People already searching for what you sell';
  const positioning =
    brand?.interpretation.positioning ||
    brand?.facts.find((f) => f.label === 'Meta description')?.value ||
    `what makes ${name} different`;
  const siteSource = brand?.facts[0]?.sourceId ? [brand.facts[0].sourceId] : [];
  const make = (
    title: string,
    hook: string,
    brief: string,
    format: IdeaFormat,
    rationale: string,
    cta: string
  ): ContentIdea => ({
    title,
    hook,
    brief,
    format,
    audience,
    rationale,
    cta,
    evidenceIds: siteSource,
    studio: studioForFormat(format),
  });
  return [
    make(
      `Why ${name}: the 3-reason carousel`,
      `Still deciding on ${product}? Here's what sets ${name} apart.`,
      `A 4–5 slide carousel. Slide 1: the hook. Slides 2–4: one reason each, taken from your own positioning (“${positioning.slice(0, 140)}”). Final slide: product shot and CTA.`,
      'Carousel',
      'Built from the positioning stated on your website; turns your existing message into a scroll-stopping format.',
      'Shop now'
    ),
    make(
      `${product} in 15 seconds`,
      `This is what ${product} looks like in real life.`,
      `A short vertical video: open on the product in use, show the key benefit within the first 3 seconds, close on the ${name} logo and CTA. Keep on-screen text under 8 words per frame.`,
      'Reel / short video',
      'Short product-in-use video is a low-effort way to show the offer described on your site.',
      'See it in action'
    ),
    make(
      `Answer the #1 question about ${product}`,
      `“Is ${product} right for me?” — let's answer that honestly.`,
      `A clean static post that names the most common buying question for ${audience.toLowerCase()} and answers it in two lines using claims already on your website. Add a product image and a single CTA.`,
      'Static post',
      'Addresses purchase hesitation directly using only claims your site already makes.',
      'Find your fit'
    ),
  ];
}

/**
 * Accept AI analysis only in grounded form. Always returns exactly three ideas.
 */
export function sanitizeAnalysis(
  raw: any,
  ctx: GroundingContext,
  brand: AuditBrand | null,
  posts: CompetitorPost[]
): { insights: AuditInsights; ideas: ContentIdea[]; usedFallbackIdeas: boolean } {
  const themes = (Array.isArray(raw?.themes) ? raw.themes : [])
    .map((t: any) => sanitizeTheme(t, ctx))
    .filter(Boolean)
    .slice(0, 5) as AuditTheme[];
  const opportunities = (Array.isArray(raw?.opportunities) ? raw.opportunities : [])
    .map((o: any) => sanitizeOpportunity(o, ctx))
    .filter(Boolean)
    .slice(0, 4) as AuditOpportunity[];

  const ideas: ContentIdea[] = [];
  for (const candidate of Array.isArray(raw?.ideas) ? raw.ideas : []) {
    const idea = sanitizeIdea(candidate, ctx);
    if (idea && !ideas.some((i) => i.title.toLowerCase() === idea.title.toLowerCase())) ideas.push(idea);
    if (ideas.length === 3) break;
  }
  const usedFallbackIdeas = ideas.length < 3;
  if (usedFallbackIdeas) {
    for (const f of buildFallbackIdeas(brand)) {
      if (ideas.length === 3) break;
      if (!ideas.some((i) => i.format === f.format)) ideas.push(f);
    }
    for (const f of buildFallbackIdeas(brand)) {
      if (ideas.length === 3) break;
      if (!ideas.some((i) => i.title === f.title)) ideas.push(f);
    }
  }

  return {
    insights: {
      summary: stripUnsupportedClaims(cleanText(raw?.summary, 700), ctx.observedNumbers),
      themes,
      opportunities,
      engagementHighlights: computeEngagementHighlights(posts),
      generatedBy: raw && (themes.length || opportunities.length) ? 'ai' : 'fallback',
    },
    ideas: ideas.slice(0, 3),
    usedFallbackIdeas,
  };
}

function engagementScore(e: EngagementSignal | null): number {
  if (!e) return 0;
  return (e.likes || 0) + (e.comments || 0) * 3 + (e.views || 0) * 0.05;
}

export function computeEngagementHighlights(posts: CompetitorPost[]): EngagementHighlight[] {
  return posts
    .filter((p) => p.engagement && engagementScore(p.engagement) > 0)
    .sort((a, b) => engagementScore(b.engagement) - engagementScore(a.engagement))
    .slice(0, 3)
    .map((p) => ({
      postId: p.id,
      competitorName: p.competitorName,
      platform: p.platform,
      url: p.url,
      engagement: p.engagement as EngagementSignal,
      publishedAt: p.publishedAt,
    }));
}

function parseCount(raw: string, suffix?: string): number {
  const base = Number(raw.replace(/,/g, ''));
  if (!Number.isFinite(base)) return 0;
  const s = (suffix || '').toLowerCase();
  if (s === 'k') return Math.round(base * 1_000);
  if (s === 'm') return Math.round(base * 1_000_000);
  return Math.round(base);
}

/** Engagement as printed in a search snippet, e.g. "1,204 likes, 37 comments". */
export function parseEngagementFromSnippet(snippet: string | null | undefined): EngagementSignal | null {
  if (!snippet) return null;
  const out: EngagementSignal = {};
  const likes = snippet.match(/(\d[\d,]*(?:\.\d+)?)\s*([km])?\+?\s*likes?\b/i);
  const comments = snippet.match(/(\d[\d,]*(?:\.\d+)?)\s*([km])?\+?\s*comments?\b/i);
  const views = snippet.match(/(\d[\d,]*(?:\.\d+)?)\s*([km])?\+?\s*views?\b/i);
  if (likes) out.likes = parseCount(likes[1], likes[2]);
  if (comments) out.comments = parseCount(comments[1], comments[2]);
  if (views) out.views = parseCount(views[1], views[2]);
  return Object.keys(out).length ? out : null;
}

const MONTHS = 'Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec';

/**
 * Publication date from a provider date field or snippet text.
 * Returns null rather than guessing.
 */
export function parsePublishedDate(
  raw: string | number | null | undefined,
  now: Date = new Date()
): { iso: string; label: string } | null {
  if (raw == null || raw === '') return null;
  if (typeof raw === 'number') {
    const ms = raw > 1e12 ? raw : raw * 1000;
    const d = new Date(ms);
    return Number.isFinite(d.getTime()) ? { iso: d.toISOString(), label: d.toISOString().slice(0, 10) } : null;
  }
  const text = String(raw).trim();
  const rel = text.match(/\b(\d+)\s+(minute|hour|day|week|month)s?\s+ago\b/i);
  if (rel) {
    const n = Number(rel[1]);
    const unitMs: Record<string, number> = {
      minute: 60_000,
      hour: 3_600_000,
      day: 86_400_000,
      week: 7 * 86_400_000,
      month: 30 * 86_400_000,
    };
    const d = new Date(now.getTime() - n * unitMs[rel[2].toLowerCase()]);
    return { iso: d.toISOString(), label: rel[0] };
  }
  const iso = text.match(/\b(\d{4}-\d{2}-\d{2})(?:[T ][\d:.]+Z?(?:[+-]\d{2}:?\d{2})?)?\b/);
  if (iso) {
    const d = new Date(iso[0].includes('T') || iso[0].includes(' ') ? iso[0].replace(' ', 'T') : `${iso[1]}T00:00:00Z`);
    if (Number.isFinite(d.getTime())) return { iso: d.toISOString(), label: iso[1] };
  }
  const named = text.match(new RegExp(`\\b(${MONTHS})[a-z]*\\.?\\s+(\\d{1,2}),?\\s+(\\d{4})\\b`, 'i'));
  if (named) {
    const d = new Date(`${named[1]} ${named[2]}, ${named[3]} UTC`);
    if (Number.isFinite(d.getTime())) return { iso: d.toISOString(), label: named[0] };
  }
  const dayFirst = text.match(new RegExp(`\\b(\\d{1,2})\\s+(${MONTHS})[a-z]*\\.?,?\\s+(\\d{4})\\b`, 'i'));
  if (dayFirst) {
    const d = new Date(`${dayFirst[2]} ${dayFirst[1]}, ${dayFirst[3]} UTC`);
    if (Number.isFinite(d.getTime())) return { iso: d.toISOString(), label: dayFirst[0] };
  }
  return null;
}
