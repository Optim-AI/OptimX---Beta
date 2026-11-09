/**
 * Brand Research fact check, run after the AI writes the report.
 *
 * Numbers: every number must come from what SkalX actually read (the site crawl and the live
 * search results), with the same kind of unit (a price matches a price, a % matches a %).
 * A percentage must also appear near the same words in the evidence, so "100% homemade" in a
 * source can't back "100% bounce rate". Sentences that fail are removed; a price or rating that
 * fails is removed entirely. Small counts ("3 jars", "7 days") are allowed.
 *
 * Sources: a "source" the AI cites that isn't the brand's own site or one of the real search
 * results is dropped, and a "web" point without a real source becomes "inferred".
 */
import type { BrandResearch, EvidenceBasis, ResearchInsight } from './brand-research';
import type { ResearchSource } from './gemini';

type Kind = 'money' | 'percent' | 'rating' | 'plain';
type Token = { raw: string; value: number; decimals: number; kind: Kind; index: number };

const TOKEN_RE = /(₹|rs\.?\s?|inr\s?|\$|usd\s?)?(-?\d[\d,]*(?:\.\d+)?)\s?(%|\/\s?5|★|stars?\b|x\b|×|lakh|crore|k\b|m\b|bn\b)?/gi;
const FREE_INTEGER_MAX = 14;
const STOP = new Set(['with', 'that', 'this', 'from', 'than', 'their', 'there', 'about', 'which', 'have', 'into', 'more', 'less', 'over', 'your', 'they', 'were', 'been', 'will', 'just', 'only', 'also', 'percent']);

export function tokens(text: string): Token[] {
  const out: Token[] = [];
  for (const m of text.matchAll(TOKEN_RE)) {
    const clean = m[2].replace(/,/g, '');
    const value = Number(clean);
    if (!Number.isFinite(value)) continue;
    const pre = (m[1] || '').toLowerCase();
    const suf = (m[3] || '').toLowerCase();
    const kind: Kind = pre ? 'money' : suf === '%' ? 'percent' : /\/\s?5|★|star/.test(suf) ? 'rating' : 'plain';
    const dot = clean.indexOf('.');
    out.push({ raw: m[0].trim(), value, decimals: dot === -1 ? 0 : clean.length - dot - 1, kind, index: m.index ?? 0 });
  }
  return out;
}

const words = (s: string) => new Set((s.toLowerCase().match(/[a-z]{4,}/g) ?? []).filter((w) => !STOP.has(w)));

export type EvidenceIndex = { tokens: Token[]; text: string };

export function buildEvidence(texts: string[]): EvidenceIndex {
  const text = texts.filter(Boolean).join('\n');
  return { tokens: tokens(text), text };
}

const close = (a: number, b: number, decimals: number) =>
  Math.abs(Math.abs(a) - Math.abs(b)) <= Math.max(decimals === 0 ? 0.5 : 0.5 * 10 ** -decimals + 1e-9, 0.005 * Math.abs(b));

/** Is this number (with its unit and the sentence around it) backed by the evidence? */
export function supported(t: Token, sentence: string, ev: EvidenceIndex): boolean {
  if (t.kind === 'plain' && t.decimals === 0 && Math.abs(t.value) <= FREE_INTEGER_MAX) return true;
  // Years (2019, 2026…) are dates, not claims.
  if (t.kind === 'plain' && t.decimals === 0 && t.value >= 1990 && t.value <= 2100) return true;
  const matches = ev.tokens.filter((e) => close(t.value, e.value, t.decimals) && (t.kind === 'plain' || e.kind === t.kind || e.kind === 'plain'));
  if (!matches.length) return false;
  if (t.kind !== 'percent') return true;
  // A percentage must sit near the same words in the evidence.
  const mine = words(sentence);
  return matches.some((e) => {
    const around = words(ev.text.slice(Math.max(0, e.index - 80), e.index + 80));
    for (const w of mine) if (around.has(w)) return true;
    return false;
  });
}

/** Sentences end at . ! ? followed by a space, so decimals like 8.5% stay whole. */
const sentences = (text: string) => text.split(/(?<=[.!?])\s+/).filter((x) => x.trim());

export type VerifyStats = { removedStatements: number; unverifiedSources: number };

/** Keep only sentences whose numbers are all backed. */
export function cleanText(text: string, ev: EvidenceIndex, stats: VerifyStats): string {
  if (!text || !/\d/.test(text)) return text;
  const kept: string[] = [];
  for (const s of sentences(text)) {
    if (tokens(s).every((t) => supported(t, s, ev))) kept.push(s.trim());
    else stats.removedStatements++;
  }
  return kept.join(' ').trim();
}

/** All-or-nothing: for prices, ratings and quotes. */
export function keepIfBacked(text: string | undefined, ev: EvidenceIndex, stats: VerifyStats): string | undefined {
  if (!text || !/\d/.test(text)) return text;
  if (tokens(text).every((t) => supported(t, text, ev))) return text;
  stats.removedStatements++;
  return undefined;
}

const host = (s: string) => s.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split(/[/\s]/)[0];

export function realSourceHosts(siteUrl: string, sources: ResearchSource[]): Set<string> {
  return new Set([host(siteUrl), ...sources.map((s) => host(s.title)).filter((h) => h.includes('.'))]);
}

function checkSource(source: string | undefined, basis: EvidenceBasis, hosts: Set<string>, stats: VerifyStats): { source?: string; basis: EvidenceBasis } {
  if (!source) return { source, basis };
  const h = host(source);
  const real = [...hosts].some((r) => h === r || h.endsWith(`.${r}`) || r.endsWith(`.${h}`));
  if (real) return { source, basis };
  stats.unverifiedSources++;
  return { source: undefined, basis: basis === 'web' ? 'inferred' : basis };
}

export function verifyResearch(r: BrandResearch, input: { evidenceTexts: string[]; sources: ResearchSource[] }): { research: BrandResearch; stats: VerifyStats } {
  const ev = buildEvidence(input.evidenceTexts);
  const hosts = realSourceHosts(r.websiteUrl, input.sources);
  const stats: VerifyStats = { removedStatements: 0, unverifiedSources: 0 };
  const t = (s: string) => cleanText(s, ev, stats);
  const insight = (i: ResearchInsight): ResearchInsight | null => {
    const text = t(i.insight);
    if (!text) return null;
    const src = checkSource(i.source, i.basis, hosts, stats);
    return { insight: text, evidence: t(i.evidence), source: src.source, basis: src.basis };
  };
  const insights = (xs: ResearchInsight[]) => xs.map(insight).filter((x): x is ResearchInsight => !!x);
  const list = (xs: string[]) => xs.map(t).filter(Boolean);

  const out: BrandResearch = {
    ...r,
    summary: t(r.summary),
    snapshot: { ...r.snapshot, price_point: keepIfBacked(r.snapshot.price_point, ev, stats) ?? '', price_evidence: keepIfBacked(r.snapshot.price_evidence, ev, stats) ?? '' },
    positioning: { claimed: t(r.positioning.claimed), proof_points: insights(r.positioning.proof_points), gaps: list(r.positioning.gaps), verdict: t(r.positioning.verdict) },
    audiences: r.audiences.map((a) => ({ ...a, job_to_be_done: t(a.job_to_be_done), trigger_moment: t(a.trigger_moment), what_they_need_to_hear: t(a.what_they_need_to_hear) })),
    competitors: r.competitors.map((c) => ({
      ...c, price_point: keepIfBacked(c.price_point, ev, stats), positioning: t(c.positioning), strength: t(c.strength), weakness: t(c.weakness), how_to_win: t(c.how_to_win),
    })),
    customer_voice: {
      desires: insights(r.customer_voice.desires),
      frustrations: insights(r.customer_voice.frustrations),
      objections: insights(r.customer_voice.objections),
      their_words: r.customer_voice.their_words.map((w) => keepIfBacked(w, ev, stats)).filter((w): w is string => !!w),
    },
    market: {
      ...r.market,
      sophistication: { ...r.market.sophistication, meaning: t(r.market.sophistication.meaning) },
      category_conventions: list(r.market.category_conventions),
      saturated_claims: list(r.market.saturated_claims),
      whitespace: list(r.market.whitespace),
    },
    reputation: { ...r.reputation, summary: t(r.reputation.summary), ratings: r.reputation.ratings.map((x) => keepIfBacked(x, ev, stats)).filter((x): x is string => !!x) },
    site_findings: r.site_findings.map((f) => ({ ...f, finding: t(f.finding), fix: t(f.fix) })).filter((f) => f.finding),
    opportunities: r.opportunities.map((o) => ({ ...o, why: t(o.why), play: t(o.play), evidence: t(o.evidence) })).filter((o) => o.title && (o.why || o.play)),
  };
  const notes = [...r.evidence.notes];
  if (stats.removedStatements) notes.push(`SkalX removed ${stats.removedStatements} statement${stats.removedStatements === 1 ? '' : 's'} with numbers it couldn’t find in its sources.`);
  if (stats.unverifiedSources) notes.push(`${stats.unverifiedSources} point${stats.unverifiedSources === 1 ? '' : 's'} cited a source SkalX couldn’t confirm, so ${stats.unverifiedSources === 1 ? 'it is' : 'they are'} marked as SkalX’s own read.`);
  out.evidence = { ...r.evidence, notes };
  return { research: out, stats };
}
