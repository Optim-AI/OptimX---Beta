/**
 * Kept posters, ready to run: an SKX- ad name (so Meta results can be matched back) and
 * copy-ready headline + primary text. Copy comes from one small Claude call per keep, checked
 * for invented numbers; if Claude is unavailable or fails, it falls back to the poster's own
 * hook and message (never blank, never invented).
 */
import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import * as z from 'zod/v4';
import { slugPart } from '@/lib/test-packs/naming';
import { collectNumbers, unsupportedNumbers } from '@/lib/meta-intel/number-guard';
import { INSIGHTS_MODEL } from '@/lib/meta-intel/analyze';
import { metaLog } from '@/lib/meta/log';
import type { Product } from '@/app/web/src/components/creative-studio/types';
import type { AdFormat } from './options';
import type { DraftAngle } from './why';

export const FORMAT_NAME: Record<AdFormat, string> = { feed_4x5: 'Feed', square_1x1: 'Square', story_9x16: 'Story', wide_191x1: 'Wide' };
export const HEADLINE_MAX = 40;
export const PRIMARY_MAX = 220;

/** SKX-{Product}-{Angle}-{Format}, unique among `taken` (adds 2, 3… to the angle part). */
export function skxAdName(productName: string, angleName: string, format: string, taken: ReadonlySet<string>): string {
  const product = slugPart(productName, 24);
  const angle = slugPart(angleName || 'Poster', 20);
  const suffix = FORMAT_NAME[format as AdFormat] ?? 'Feed';
  let name = `SKX-${product}-${angle}-${suffix}`;
  for (let n = 2; taken.has(name.toLowerCase()); n++) name = `SKX-${product}-${angle.slice(0, 18)}${n}-${suffix}`;
  return name;
}

const clip = (s: string, n: number) => {
  const t = (s || '').replace(/\s+/g, ' ').trim();
  return t.length > n ? `${t.slice(0, n - 1).replace(/\s+\S*$/, '')}…` : t;
};

export type CopyItem = { id: string; angle: DraftAngle; format: string };
export type CopyResult = { headline: string; primaryText: string; source: 'claude' | 'fallback' };

/** Never blank, never invented: the poster's own hook and message. */
export function fallbackCopy(a: DraftAngle): CopyResult {
  return { headline: clip(a.title || a.angle, HEADLINE_MAX), primaryText: clip(a.message || a.why_it_wins || a.title, PRIMARY_MAX), source: 'fallback' };
}

const CopySchema = z.object({
  items: z.array(z.object({
    id: z.string(),
    headline: z.string().describe(`Ad headline, at most ${HEADLINE_MAX} characters.`),
    primary_text: z.string().describe(`Primary text, 1-2 short sentences, at most ${PRIMARY_MAX} characters, ends with a gentle call to action.`),
  })),
});

const COPY_SYSTEM = `You write Meta ad copy for small Indian D2C brands. For each poster, write a headline and primary text that match its angle.
- Simple, warm English for Indian shoppers. No jargon, no hashtags, at most one emoji.
- Never invent prices, discounts, ratings, awards, ingredients or numbers. Any number must appear in the input. If an offer is given, use it exactly.
- Return one item per poster id, in any order.`;

type ClaudeClient = Pick<Anthropic, 'beta'>;

export async function writeCopy(params: {
  product: Product;
  offer: string | null;
  brandName: string | null;
  items: CopyItem[];
  deps?: { client?: ClaudeClient };
}): Promise<Map<string, CopyResult>> {
  const out = new Map(params.items.map((i) => [i.id, fallbackCopy(i.angle)]));
  if (!params.items.length) return out;
  if (!params.deps?.client && !process.env.ANTHROPIC_API_KEY?.trim()) return out;

  const input = {
    brand: params.brandName,
    product: { name: params.product.product_name, price: params.product.price, benefit: params.product.short_benefit, description: params.product.description?.slice(0, 300) },
    offer: params.offer,
    posters: params.items.map((i) => ({ id: i.id, format: i.format, angle: i.angle.angle, hook: i.angle.title, message: i.angle.message, audience: i.angle.audience })),
  };
  try {
    const client = params.deps?.client ?? new Anthropic({ timeout: 60_000 });
    const res = await client.beta.messages.parse({
      model: INSIGHTS_MODEL,
      max_tokens: 4000,
      system: COPY_SYSTEM,
      thinking: { type: 'adaptive' },
      output_config: { effort: 'low', format: betaZodOutputFormat(CopySchema) },
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      messages: [{ role: 'user', content: `Write copy for these posters (JSON):\n${JSON.stringify(input)}` }],
    });
    const parsed = res.stop_reason === 'refusal' ? null : (res.parsed_output as z.infer<typeof CopySchema> | null);
    const pool = collectNumbers(input);
    for (const it of parsed?.items ?? []) {
      if (!out.has(it.id)) continue;
      const headline = clip(it.headline, HEADLINE_MAX);
      const primaryText = clip(it.primary_text, PRIMARY_MAX);
      if (!headline || !primaryText || unsupportedNumbers(`${headline} ${primaryText}`, pool).length) continue; // keep the fallback
      out.set(it.id, { headline, primaryText, source: 'claude' });
    }
  } catch (err) {
    metaLog.warn('ad_studio_copy_failed', { message: (err as Error).message });
  }
  return out;
}
