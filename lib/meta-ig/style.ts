/**
 * "Read their style": Gemini looks at competitors' best recent posts (images + captions + stats)
 * and says what each one does, what works, and what this brand could borrow. Any sentence with a
 * number that isn't in the stats is dropped (same guard as AI insights).
 */
import * as z from 'zod/v4';
import { geminiStructured, type AiPart, type StructuredClient } from '@/lib/ai/structured';
import { collectNumbers, unsupportedNumbers } from '@/lib/meta-intel/number-guard';
import type { AccountStats, StyleRead } from './types';
import { engagement, formatOf } from './stats';

const MAX_IMAGES_PER_ACCOUNT = 3;
const MAX_IMAGE_BYTES = 3 * 1024 * 1024;

const StyleSchema = z.object({
  summary: z.string().describe('One or two plain sentences: what the best accounts in this space have in common.'),
  competitors: z.array(z.object({
    username: z.string(),
    style: z.string().describe('Their look and voice in one or two sentences: colours, people or product, text on image, format.'),
    what_works: z.array(z.string()).describe('Up to 3 things that get them the most engagement, citing the stats given.'),
    borrow: z.string().describe('One thing this brand could borrow, adapted to its own product.'),
  })),
  ideas: z.array(z.object({
    hook: z.string().describe('First line, in the brand voice.'),
    show: z.string().describe('What the post shows, using the brand’s real product.'),
    format: z.enum(['reel', 'post', 'carousel', 'story']),
  })).describe('3 post ideas for this brand.'),
});

export const STYLE_SYSTEM = `You study competitors' Instagram accounts for a small Indian brand and explain, simply, what their content looks like and what works.
- Use only the stats and posts given. Every number you write must appear in the input. Never estimate followers, reach or sales.
- Describe what you can actually see in the images (product close-ups, people, text on image, colours, food styling).
- Be specific and practical. The reader is a business owner, not a marketer.
- Never suggest copying another brand's content, name, logo or claims. Suggest adapting the idea to this brand's own product.`;

type ImageLoader = (url: string) => Promise<{ mediaType: string; data: string } | null>;

const defaultLoader: ImageLoader = async (url) => {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    const type = (res.headers.get('content-type') ?? '').split(';')[0].trim();
    if (!res.ok || !['image/jpeg', 'image/png', 'image/webp'].includes(type)) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return buf.length > MAX_IMAGE_BYTES ? null : { mediaType: type, data: buf.toString('base64') };
  } catch {
    return null;
  }
};

const summarise = (a: AccountStats) => ({
  username: a.username, is_this_brand: !!a.isYou, followers: a.followers, posts_per_week: a.postsPerWeek,
  avg_likes: a.avgLikes, avg_comments: a.avgComments, engagement_rate_pct: a.engagementRatePct,
  formats: a.formats.map((f) => ({ format: f.format, share_pct: f.pct, avg_engagements: f.avgEngagement })),
  top_posts: a.topPosts.map((p) => ({ format: formatOf(p), caption: p.caption?.slice(0, 220) ?? null, likes: p.likes, comments: p.comments, engagements: engagement(p) })),
});

export async function readStyle(params: {
  brand: { name: string | null; category: string | null; offering: string | null; tone: string | null };
  accounts: AccountStats[];
  deps?: { client?: StructuredClient; loadImage?: ImageLoader };
}): Promise<{ output: StyleRead; dropped: string[]; model: string; usage: unknown }> {
  const competitors = params.accounts.filter((a) => !a.isYou);
  if (!competitors.length) throw new Error('Add at least one competitor first.');
  const input = { brand: params.brand, accounts: params.accounts.map(summarise) };
  const load = params.deps?.loadImage ?? defaultLoader;
  const parts: AiPart[] = [];
  for (const a of competitors) {
    const imgs = (await Promise.all(a.topPosts.slice(0, MAX_IMAGES_PER_ACCOUNT).map((p) => (p.imageUrl ? load(p.imageUrl) : Promise.resolve(null))))).filter(Boolean) as { mediaType: string; data: string }[];
    imgs.forEach((img, i) => { parts.push({ text: `@${a.username}, top post ${i + 1}:` }); parts.push({ image: img }); });
  }
  parts.push({ text: `Stats and captions (JSON):\n${JSON.stringify(input)}\n\nRead their style.` });

  const res = await (params.deps?.client ?? geminiStructured).generate({
    system: STYLE_SYSTEM, messages: [{ role: 'user', parts }], schema: StyleSchema, effort: 'medium', maxTokens: 8000, timeoutMs: 120_000, label: 'ig-style',
  });
  if (!res.data) throw new Error(res.stop === 'refusal' ? 'The AI model declined this request.' : 'The style read didn’t come out right. Try again.');
  const pool = collectNumbers(input);
  const dropped: string[] = [];
  const ok = (t: string) => {
    if (unsupportedNumbers(t, pool).length) { dropped.push(t.slice(0, 200)); return false; }
    return true;
  };
  const known = new Set(competitors.map((a) => a.username.toLowerCase()));
  // After the check: write big counts the Indian way (66693 → 66,693). Years stay as they are.
  const fmt = (t: string) => t.replace(/\b\d{4,}\b/g, (n) => (/^(19|20)\d{2}$/.test(n) ? n : new Intl.NumberFormat('en-IN').format(Number(n))));
  const output: StyleRead = {
    summary: ok(res.data.summary) ? fmt(res.data.summary.slice(0, 400)) : '',
    competitors: res.data.competitors
      .filter((c) => known.has(c.username.replace(/^@/, '').toLowerCase()))
      .map((c) => ({
        username: c.username.replace(/^@/, ''),
        style: ok(c.style) ? fmt(c.style.slice(0, 400)) : '',
        what_works: c.what_works.filter(ok).slice(0, 3).map((w) => fmt(w.slice(0, 240))),
        borrow: ok(c.borrow) ? fmt(c.borrow.slice(0, 300)) : '',
      })),
    ideas: res.data.ideas.filter((i) => ok(`${i.hook} ${i.show}`)).slice(0, 3).map((i) => ({ hook: i.hook.slice(0, 160), show: i.show.slice(0, 300), format: i.format })),
  };
  return { output, dropped, model: res.model, usage: res.usage };
}
