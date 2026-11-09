/**
 * Fits the day's trends to one brand: how well each fits (high / medium / low / skip, with the
 * reason) and 2-3 ready ideas (hook, what to show, a short script for reels).
 * Ideas may not invent prices, discounts or other numbers: any idea with a number that isn't in
 * the brand's own data or the trend is dropped.
 */
import * as z from 'zod/v4';
import { getUserBrand } from '@/lib/brand-kit/server';
import { getBrandResearch } from '@/lib/research/store';
import { collectNumbers, unsupportedNumbers } from '@/lib/meta-intel/number-guard';
import { geminiStructured, type StructuredClient } from '@/lib/ai/structured';
import type { BrandTrend, Trend, TrendIdea } from './types';

const cut = (s: string | null | undefined, n: number) => (s ? (s.length > n ? `${s.slice(0, n - 1)}…` : s) : null);

export type BrandContext = {
  name: string | null;
  category: string;
  offering: string | null;
  audience: string | null;
  tone: string | null;
  value_prop: string | null;
  customer_words: string[];
  desires: string[];
};

/** The brand's category label (for the shared daily trend list) and the context ideas are written from. */
export async function brandContext(userId: string): Promise<BrandContext | null> {
  const [{ snapshot }, research] = await Promise.all([
    getUserBrand(userId).catch(() => ({ snapshot: null })),
    getBrandResearch(userId).catch(() => null),
  ]);
  const category = (research?.snapshot?.category || snapshot?.industry || snapshot?.offering || '').trim();
  if (!category) return null;
  return {
    name: snapshot?.name ?? null,
    category: category.slice(0, 80),
    offering: cut(snapshot?.offering, 240),
    audience: cut(snapshot?.audience, 200),
    tone: cut(snapshot?.tone, 120),
    value_prop: cut(snapshot?.coreValueProp, 160),
    customer_words: research?.customer_voice?.their_words?.slice(0, 6) ?? [],
    desires: research?.customer_voice?.desires?.slice(0, 3).map((i) => i.insight) ?? [],
  };
}

/** Same category → same shared list: "Pickles & Condiments" and "pickles and condiments" match. */
export function categoryKey(label: string): string {
  return label.toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, '-').slice(0, 60) || 'general';
}

const Idea = z.object({
  format: z.enum(['poster', 'reel', 'story', 'post']),
  hook: z.string().describe('The first line people see, in the brand voice, max ~12 words.'),
  show: z.string().describe('What the poster or video shows, 1-2 sentences. Use the real product.'),
  script: z.array(z.string()).describe('For reel or story: 3-5 short beats in order. Empty for poster or post.'),
});
const FitItem = z.object({
  trend_id: z.string(),
  fit: z.enum(['high', 'medium', 'low', 'skip']).describe('skip if the brand should not use it at all.'),
  reason: z.string().describe('One plain sentence: why it fits this brand (or why not).'),
  ideas: z.array(Idea).describe('2-3 ideas for high and medium fit; 1 for low; none for skip.'),
});
const FitSchema = z.object({ items: z.array(FitItem) });

export const FIT_SYSTEM = `You help small Indian D2C brands join what is trending, in a way that feels natural and sells their product.

For each trend, decide how well it fits THIS brand and its buyers:
- high: the brand's buyers care about it and the product can be shown naturally.
- medium: it can work with a clever, light link to the product.
- low: a stretch; one idea at most.
- skip: unrelated, risky, or it would look forced or insensitive.

Ideas:
- Write in simple, warm English (a little Hinglish is fine if it suits the brand). Hooks sound like the brand.
- Every idea shows the real product. Be specific about what is on screen.
- Prefer reels for meme and video formats, posters for festivals and quick moments.
- Never invent prices, discounts, offers, ratings, awards or numbers. Never use a celebrity's name, face or a film's footage as if they endorse the brand.
- Never make fun of a group of people. No politics or religion.`;

export function checkIdeas(ideas: TrendIdea[], pool: readonly number[]): TrendIdea[] {
  return ideas.filter((i) => !unsupportedNumbers([i.hook, i.show, ...i.script].join(' '), pool).length);
}

export async function fitTrends(ctx: BrandContext, trends: Trend[], client: StructuredClient = geminiStructured) {
  if (!trends.length) return { trends: [] as BrandTrend[], skipped: 0, usage: { input_tokens: 0, output_tokens: 0 }, model: null as string | null };
  const input = {
    brand: ctx,
    trends: trends.map((t) => ({ trend_id: t.id, title: t.title, what: t.what, why_now: t.whyNow, kind: t.kind, when: t.when })),
  };
  const res = await client.generate({
    system: FIT_SYSTEM,
    messages: [{ role: 'user', parts: [{ text: `Fit these trends to the brand (JSON):\n${JSON.stringify(input)}` }] }],
    schema: FitSchema, effort: 'medium', maxTokens: 16000, timeoutMs: 3 * 60_000, label: 'trends-fit',
  });
  const pool = collectNumbers(input);
  const byId = new Map(trends.map((t) => [t.id, t]));
  const out: BrandTrend[] = [];
  for (const it of res.data?.items ?? []) {
    const t = byId.get(it.trend_id);
    if (!t || it.fit === 'skip') continue;
    const ideas = checkIdeas(it.ideas.map((i) => ({
      format: i.format, hook: i.hook.slice(0, 160), show: i.show.slice(0, 400),
      script: i.format === 'reel' || i.format === 'story' ? i.script.slice(0, 6).map((s) => s.slice(0, 200)) : [],
    })), pool).slice(0, 3);
    if (!ideas.length) continue;
    out.push({ ...t, fit: it.fit, fitReason: it.reason.slice(0, 300), ideas });
  }
  const rank = { high: 0, medium: 1, low: 2 } as const;
  out.sort((a, b) => rank[a.fit] - rank[b.fit]);
  return { trends: out, skipped: trends.length - out.length, usage: res.usage, model: res.model };
}
