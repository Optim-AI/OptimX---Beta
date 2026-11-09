/**
 * Proposes test-pack angles with Gemini. Each angle names its source (a past winner,
 * customer voice or a competitor gap) and comes with copy-ready primary text and a
 * headline for both formats. Numbers in the copy must exist in the input (same guard
 * as AI insights). No predicted metrics.
 */
import * as z from 'zod/v4';
import { geminiStructured, type AiMessage, type AiPart, type StructuredClient } from '@/lib/ai/structured';
import { getUserBrand } from '@/lib/brand-kit/server';
import { getBrandResearch } from '@/lib/research/store';
import { collectNumbers, unsupportedNumbers } from '@/lib/meta-intel/number-guard';
import { metaLog } from '@/lib/meta/log';
import type { Product } from '@/app/web/src/components/creative-studio/types';
import type { PackAngle } from './types';

const Copy = z.object({
  primary_text: z.string().describe('Primary text for the ad, 1-3 short sentences, ready to paste. Max ~220 characters.'),
  headline: z.string().describe('Ad headline, max ~40 characters.'),
});

const AngleSchema = z.object({
  name: z.string().describe('2-4 word angle name, e.g. "Heritage recipe".'),
  hook: z.string().describe('The big line on the poster, max ~8 words.'),
  message: z.string().describe('What the ad says, one sentence.'),
  insight: z.string().describe('The customer truth it is built on.'),
  proof: z.string().describe('What the poster should show as proof (real product, real use).'),
  audience: z.string().describe('Who it is for, a few words.'),
  source: z.enum(['past_winner', 'customer_voice', 'competitor']),
  source_detail: z.string().describe('Which winning ad, which customer quote, or which competitor gap from the input.'),
  what_it_tests: z.string().describe('What this angle tests, as a question, e.g. "Does tradition beat discounts?"'),
  why_it_might_work: z.string().describe('One sentence grounded in the input. No predicted numbers.'),
  copy: z.object({ feed: Copy, story: Copy }),
});

export const ProposalSchema = z.object({ angles: z.array(AngleSchema) });

export const ANGLE_SYSTEM_PROMPT = `You are SkalX's creative strategist for small Indian D2C brands. You propose ad angles to test on Meta, for a business owner who is not a marketer.

Rules:
- Propose exactly the number of angles asked for. They must be clearly different from each other and from any angle listed under "avoid".
- Every angle must come from the input and say where: "past_winner" (build on the winning ad or a winning ad in the insights - name it), "customer_voice" (use a real quote, desire or frustration from customer_voice) or "competitor" (a gap or weakness of a named competitor). Only use a source type when the input contains material for it.
- Copy is for Indian shoppers: simple English, warm, specific. Feed copy can be a little longer; story copy is shorter and punchier.
- Never invent facts about the product: no prices, discounts, ratings, awards, certifications, ingredients or numbers that are not in the input. Any number you write must appear in the input.
- Never predict results (no "will double sales", no expected CTR or ROAS).
- what_it_tests is the question the test answers; why_it_might_work points to the evidence in the input.`;

export type WinnerContext = {
  adId: string;
  name: string | null;
  headline: string | null;
  primaryText: string | null;
  metrics: Record<string, number | null>;
  status: string;
  image?: { mediaType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'; data: string } | null;
};

export async function buildAngleInput(userId: string, product: Product, winner: WinnerContext | null, insightAngles: unknown[] | null) {
  const [{ snapshot }, research] = await Promise.all([
    getUserBrand(userId).catch(() => ({ snapshot: null })),
    getBrandResearch(userId).catch(() => null),
  ]);
  return {
    product: {
      name: product.product_name, price: product.price, description: product.description?.slice(0, 500),
      short_benefit: product.short_benefit, key_benefits: product.key_benefits?.slice(0, 6), audience: product.target_audience,
      use_cases: product.use_cases?.slice(0, 5), emotional_angles: product.emotional_angles?.slice(0, 5),
    },
    brand: snapshot ? { name: snapshot.name, tone: snapshot.tone, audience: snapshot.audience, value_prop: snapshot.coreValueProp ?? null } : null,
    winning_ad: winner ? { ad_id: winner.adId, name: winner.name, headline: winner.headline, primary_text: winner.primaryText, status: winner.status, results_last_30_days: winner.metrics } : null,
    insight_angles: insightAngles ?? [],
    customer_voice: research ? {
      their_words: research.customer_voice?.their_words?.slice(0, 8) ?? [],
      desires: research.customer_voice?.desires?.slice(0, 4).map((i) => i.insight) ?? [],
      frustrations: research.customer_voice?.frustrations?.slice(0, 4).map((i) => i.insight) ?? [],
      objections: research.customer_voice?.objections?.slice(0, 3).map((i) => i.insight) ?? [],
    } : null,
    competitors: research?.competitors?.slice(0, 4).map((c) => ({ name: c.name, positioning: c.positioning, weakness: c.weakness, how_to_win: c.how_to_win })) ?? [],
  };
}

export class NoAngleSourcesError extends Error {}

/** Which source types the input can support. */
export function availableSources(input: Awaited<ReturnType<typeof buildAngleInput>>): string[] {
  const out: string[] = [];
  if (input.winning_ad || (input.insight_angles?.length ?? 0) > 0) out.push('past_winner');
  const v = input.customer_voice;
  if (v && v.their_words.length + v.desires.length + v.frustrations.length > 0) out.push('customer_voice');
  if (input.competitors.length > 0) out.push('competitor');
  return out;
}

export function checkAngles(angles: PackAngle[], input: ReturnType<typeof buildAngleInput> extends Promise<infer T> ? T : never): string[] {
  const pool = collectNumbers(input);
  const problems: string[] = [];
  const hasWinner = !!input.winning_ad || (input.insight_angles?.length ?? 0) > 0;
  const hasVoice = !!input.customer_voice && (input.customer_voice.their_words.length + input.customer_voice.desires.length + input.customer_voice.frustrations.length) > 0;
  const hasCompetitors = input.competitors.length > 0;
  angles.forEach((a, i) => {
    const text = [a.hook, a.message, a.copy.feed.primary_text, a.copy.feed.headline, a.copy.story.primary_text, a.copy.story.headline].join(' ');
    const bad = unsupportedNumbers(text, pool);
    if (bad.length) problems.push(`Angle ${i + 1} ("${a.name}") uses numbers not in the input: ${bad.join(', ')}.`);
    if (a.source === 'past_winner' && !hasWinner) problems.push(`Angle ${i + 1} says past_winner but there is no winning ad in the input.`);
    if (a.source === 'customer_voice' && !hasVoice) problems.push(`Angle ${i + 1} says customer_voice but there is no customer voice in the input.`);
    if (a.source === 'competitor' && !hasCompetitors) problems.push(`Angle ${i + 1} says competitor but there are no competitors in the input.`);
  });
  return problems;
}

export async function proposeAngles(params: {
  userId: string;
  product: Product;
  winner: WinnerContext | null;
  insightAngles: unknown[] | null;
  count: number;
  avoid: string[];
  deps?: { client?: StructuredClient };
}): Promise<PackAngle[]> {
  const input = await buildAngleInput(params.userId, params.product, params.winner, params.insightAngles);
  const sources = availableSources(input);
  if (!sources.length) {
    throw new NoAngleSourcesError('SkalX needs something real to build angles on: run Brand Research (for customer quotes and competitors), or connect Meta so it can learn from your winning ads.');
  }
  const client = params.deps?.client ?? geminiStructured;
  const content: AiPart[] = [];
  if (params.winner?.image) {
    content.push({ text: `Image of the winning ad (ad_id ${params.winner.adId}):` });
    content.push({ image: { mediaType: params.winner.image.mediaType, data: params.winner.image.data } });
  }
  content.push({
    text: `Propose ${params.count} angle${params.count > 1 ? 's' : ''} to test for this product. Source types you can use: ${sources.join(', ')}.${params.avoid.length ? `\nAvoid these angles (already chosen): ${params.avoid.join('; ')}` : ''}\n\nInput (JSON):\n${JSON.stringify(input)}`,
  });
  const messages: AiMessage[] = [{ role: 'user', parts: content }];

  for (let attempt = 1; attempt <= 2; attempt++) {
    const res = await client.generate({
      system: ANGLE_SYSTEM_PROMPT, messages, schema: ProposalSchema, effort: 'medium', maxTokens: 16000, timeoutMs: 3 * 60 * 1000, label: 'test-pack-angles',
    });
    if (res.stop === 'refusal') throw new Error('The AI model declined to propose angles');
    const angles = ((res.data as { angles: PackAngle[] } | null)?.angles ?? []).slice(0, params.count);
    const problems = angles.length < params.count ? [`Only ${angles.length} of ${params.count} angles were returned.`] : checkAngles(angles, input);
    metaLog.info('angles_proposed', { userId: params.userId, attempt, problems: problems.length, usage: res.usage });
    if (!problems.length) return angles;
    if (attempt === 2) throw new Error(`Angle proposal failed checks: ${problems.join(' ')}`);
    messages.push({ role: 'model', parts: [{ text: res.text || '{}' }] });
    messages.push({ role: 'user', parts: [{ text: `Please fix these problems and answer again:\n${problems.map((p) => `- ${p}`).join('\n')}` }] });
  }
  throw new Error('unreachable');
}
