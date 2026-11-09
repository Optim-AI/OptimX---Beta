/**
 * Finds what's trending in India for a category, with real sources for every trend.
 *
 * 1. Gemini with live Google Search writes a numbered list of trends ("### 1. …").
 * 2. Gemini's grounding data says which search results back which sentences; each trend
 *    keeps only the links that back its own text. A trend with no backing link is dropped.
 * 3. A second, structured call turns each block into fields (kind, stage, platforms…) and
 *    flags anything unsafe for brands (tragedy, politics, religion, crime…), which is dropped.
 * 4. Optional: YouTube's official "most popular in India" chart (needs YOUTUBE_API_KEY).
 * Links always come from Google's grounding data or YouTube, never from the AI's text.
 */
import { createHash } from 'crypto';
import * as z from 'zod/v4';
import { GEMINI_REST_BASE, getGeminiApiKey } from '@/lib/gemini-config';
import { fetchWithGeminiRateLimitRetry } from '@/lib/gemini-retry';
import { geminiStructured, type StructuredClient } from '@/lib/ai/structured';
import type { Trend, TrendSource } from './types';

const SEARCH_MODEL = () => process.env.RESEARCH_SEARCH_MODEL?.trim() || 'gemini-2.5-flash';
const MAX_TRENDS = 12;
const MAX_SOURCES_PER_TREND = 4;

export type GroundedBlocks = {
  blocks: { n: number; text: string; sources: TrendSource[] }[];
  queries: string[];
  model: string;
  usage: { input_tokens: number; output_tokens: number };
};

export function trendSearchPrompt(categoryLabel: string, today: string): string {
  return `Today is ${today}. Search the web for what is trending in India RIGHT NOW (the last 7 days), useful for a small brand that sells ${categoryLabel}.

Find ${MAX_TRENDS} different things, a mix of:
- viral moments, memes and content formats people in India are sharing on Instagram, YouTube and X this week
- news or talk about the ${categoryLabel} category in India this week
- big shared moments: cricket and other sport, films and OTT releases, music, celebrities
- festivals, holidays and shopping events in India in the next 30 days (with their dates)

Leave out deaths, accidents, disasters, crime, war, politics, elections, religious disputes and anything a brand should not joke about.

Write each one as its own block, exactly like this:
### 1. <short name>
What it is, why it is trending now (with the date or days), and where people are talking about it. 2-4 sentences.

Only include things you found in search results from the last 7 days (or, for events, announced dates). No introduction, no conclusion.`;
}

/** Split "### n. Title\nbody" blocks; returns [{n, text, start, end}]. */
export function splitBlocks(text: string): { n: number; text: string; start: number; end: number }[] {
  const re = /^#{2,4}\s*(\d{1,2})[.)]\s*(.+)$/gm;
  const heads: { n: number; idx: number }[] = [];
  for (let m = re.exec(text); m; m = re.exec(text)) heads.push({ n: Number(m[1]), idx: m.index });
  return heads.map((h, i) => {
    const end = i + 1 < heads.length ? heads[i + 1].idx : text.length;
    return { n: h.n, text: text.slice(h.idx, end).trim(), start: h.idx, end };
  }).filter((b) => b.text.length > 20);
}

type GroundingMeta = {
  groundingChunks?: { web?: { uri?: string; title?: string } }[];
  groundingSupports?: { segment?: { text?: string; startIndex?: number; endIndex?: number }; groundingChunkIndices?: number[] }[];
  webSearchQueries?: string[];
};

/** Attach to each block only the search results that back sentences inside it. */
export function attachSources(text: string, meta: GroundingMeta): GroundedBlocks['blocks'] {
  const blocks = splitBlocks(text);
  const chunks = meta.groundingChunks ?? [];
  const byBlock = new Map<number, Set<number>>();
  for (const sup of meta.groundingSupports ?? []) {
    const seg = sup.segment?.text?.trim();
    if (!seg || !sup.groundingChunkIndices?.length) continue;
    const at = text.indexOf(seg);
    const block = blocks.find((b) => at >= b.start && at < b.end) ?? blocks.find((b) => b.text.includes(seg));
    if (!block) continue;
    const set = byBlock.get(block.n) ?? new Set<number>();
    for (const i of sup.groundingChunkIndices) set.add(i);
    byBlock.set(block.n, set);
  }
  return blocks.map((b) => {
    const seen = new Set<string>();
    const sources: TrendSource[] = [];
    for (const i of byBlock.get(b.n) ?? []) {
      const w = chunks[i]?.web;
      if (!w?.uri) continue;
      const title = (w.title || '').trim() || 'Source';
      if (seen.has(title)) continue;
      seen.add(title);
      sources.push({ title, url: w.uri });
    }
    return { n: b.n, text: b.text, sources: sources.slice(0, MAX_SOURCES_PER_TREND) };
  });
}

export async function groundedTrendSearch(categoryLabel: string, today: string): Promise<GroundedBlocks> {
  const key = getGeminiApiKey();
  if (!key) throw new Error('GEMINI_API_KEY is not configured');
  const model = SEARCH_MODEL();
  const res = await fetchWithGeminiRateLimitRetry(`${GEMINI_REST_BASE}/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: trendSearchPrompt(categoryLabel, today) }] }],
      tools: [{ google_search: {} }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 8192, thinkingConfig: { thinkingBudget: 1024 } },
    }),
    signal: AbortSignal.timeout(120_000),
  }, { maxRetries: 2, operationLabel: 'trends-search' });
  if (!res.ok) throw new Error(`Trend search failed (${res.status}): ${(await res.text().catch(() => '')).slice(0, 200)}`);
  const json = (await res.json()) as any;
  const cand = json?.candidates?.[0];
  const text = ((cand?.content?.parts ?? []) as { text?: string; thought?: boolean }[]).filter((p) => !p.thought && p.text).map((p) => p.text).join('');
  const meta = (cand?.groundingMetadata ?? {}) as GroundingMeta;
  return {
    blocks: attachSources(text, meta),
    queries: meta.webSearchQueries ?? [],
    model,
    usage: { input_tokens: json?.usageMetadata?.promptTokenCount ?? 0, output_tokens: json?.usageMetadata?.candidatesTokenCount ?? 0 },
  };
}

const TrendFields = z.object({
  block: z.number().int().describe('The block number this describes.'),
  title: z.string().describe('Short name, max ~6 words.'),
  what: z.string().describe('What it is, 1-2 plain sentences for a business owner.'),
  why_now: z.string().describe('Why it is trending now, with the date or days from the block.'),
  kind: z.enum(['viral_moment', 'meme_format', 'news', 'festival_event', 'sport_entertainment', 'shopping']),
  stage: z.enum(['rising', 'peaking', 'fading', 'upcoming']).describe('From the block: upcoming = a future event; rising = just started; peaking = everywhere now; fading = past its peak.'),
  when: z.string().nullable().describe('Dates or period as the block states them, or null.'),
  last_date: z.string().nullable().describe('For a dated event or release: its last day as YYYY-MM-DD, only if the block states it. Otherwise null.'),
  platforms: z.array(z.string()).describe('Where people are talking about it, only if the block says so (Instagram, YouTube, X, news…).'),
  brand_safe: z.boolean().describe('false if it is about death, tragedy, disaster, crime, war, politics, religion disputes, or anything a brand should not joke about.'),
});
const TrendListSchema = z.object({ trends: z.array(TrendFields) });

const STRUCTURE_SYSTEM = `You turn research notes into a clean list of trends for small Indian brands.
- Use only what each block says. Do not add facts, numbers or dates that are not in the block.
- Keep the wording simple; the reader is a business owner, not a marketer.
- Mark brand_safe false for anything about death, tragedy, disaster, crime, war, politics, religion disputes, or anything a brand should not joke about.`;

/** Dates beat the model's guess: an event whose last day has passed is fading, whatever it said. */
export function stageFor(stage: Trend['stage'], lastDate: string | null, today: string): Trend['stage'] {
  if (lastDate && /^\d{4}-\d{2}-\d{2}$/.test(lastDate) && lastDate < today) return 'fading';
  return stage;
}

export async function structureTrends(blocks: GroundedBlocks['blocks'], today: string, client: StructuredClient = geminiStructured) {
  const withSources = blocks.filter((b) => b.sources.length > 0);
  if (!withSources.length) return { trends: [] as Trend[], usage: { input_tokens: 0, output_tokens: 0 }, model: null as string | null, dropped: blocks.length };
  const res = await client.generate({
    system: STRUCTURE_SYSTEM,
    messages: [{ role: 'user', parts: [{ text: `Today is ${today}. Blocks:\n\n${withSources.map((b) => b.text).join('\n\n')}` }] }],
    schema: TrendListSchema, effort: 'low', maxTokens: 8000, timeoutMs: 90_000, label: 'trends-structure',
  });
  const items = res.data?.trends ?? [];
  const trends: Trend[] = [];
  for (const it of items) {
    const block = withSources.find((b) => b.n === it.block);
    if (!block || !it.brand_safe) continue;
    trends.push({
      id: createHash('sha1').update(`${it.title.toLowerCase()}|${block.sources[0].url}`).digest('hex').slice(0, 12),
      title: it.title.slice(0, 80), what: it.what.slice(0, 400), whyNow: it.why_now.slice(0, 400),
      kind: it.kind, stage: stageFor(it.stage, it.last_date ?? null, today), when: it.when?.slice(0, 60) ?? null,
      platforms: it.platforms.slice(0, 4).map((p) => p.slice(0, 20)),
      sources: block.sources,
    });
  }
  return { trends: trends.slice(0, MAX_TRENDS), usage: res.usage, model: res.model, dropped: blocks.length - trends.length };
}

/** YouTube's official most-popular chart for India. Optional: needs YOUTUBE_API_KEY. */
export async function youtubeTrending(fetchImpl: typeof fetch = fetch, max = 5): Promise<Trend[]> {
  const key = process.env.YOUTUBE_API_KEY?.trim();
  if (!key) return [];
  const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&chart=mostPopular&regionCode=IN&maxResults=${max}&key=${encodeURIComponent(key)}`;
  const res = await fetchImpl(url, { signal: AbortSignal.timeout(20_000) }).catch(() => null);
  if (!res?.ok) return [];
  const json = (await res.json()) as { items?: { id: string; snippet?: { title?: string; channelTitle?: string; publishedAt?: string; thumbnails?: { medium?: { url?: string } } }; statistics?: { viewCount?: string } }[] };
  return (json.items ?? []).flatMap((v) => {
    const s = v.snippet;
    if (!s?.title) return [];
    const views = Number(v.statistics?.viewCount ?? 0);
    return [{
      id: `yt-${v.id}`,
      title: s.title.slice(0, 80),
      what: `A video by ${s.channelTitle ?? 'a creator'} on YouTube's trending list in India.`,
      whyNow: views ? `${new Intl.NumberFormat('en-IN').format(views)} views since ${(s.publishedAt ?? '').slice(0, 10)}.` : 'On YouTube’s trending list in India today.',
      kind: 'video' as const, stage: 'peaking' as const, when: null, platforms: ['YouTube'],
      sources: [{ title: 'YouTube', url: `https://www.youtube.com/watch?v=${v.id}` }],
      thumbnailUrl: s.thumbnails?.medium?.url ?? null,
    }];
  });
}
