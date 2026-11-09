/**
 * Runs one AI analysis for a user's Meta data and stores it in ai_insights.
 *  - Gemini interprets a compact JSON summary + ad images; output is JSON checked against a schema
 *  - Zod-validated, then the number guard drops bullets citing numbers not in the input
 *  - One retry (same conversation) when parsing fails or the guard rejects too much
 *  - Skips when nothing changed since the last successful analysis (unless forced)
 */
import { geminiStructured, AI_TEXT_MODEL, type AiMessage, type AiPart, type StructuredClient } from '@/lib/ai/structured';
import { MetaConnectionDAO } from '@/database/models/MetaConnection.dao';
import { metaLog } from '@/lib/meta/log';
import { InsightsSchema } from './insights-schema';
import type { Insights } from './insights-types';
import { guardInsights, needsRetry, type GuardResult } from './number-guard';
import { buildAnalysisInput, type AnalysisInput } from './analysis-input';
import * as store from './insights-store';

const MAX_ATTEMPTS = 2;

export const SYSTEM_PROMPT = `You are SkalX's ad analyst for small Indian D2C brands. You read a JSON summary of one brand's Meta (Facebook and Instagram) ads and organic posts for the last 30 days, plus images of their top and bottom ads, and explain what is happening.

Who reads this: a busy business owner, often 40-60, not a marketer. Write short, plain sentences. Say "cost per purchase" instead of CPA. You may say "ROAS (sales for every ₹1 spent)" once.

Rules for numbers:
- Every claim must cite at least one number that appears in the input, written the same way (full digits with the currency, e.g. ₹1,30,380 or 2.37×). Do not write "lakh", "k" or "L".
- Never calculate new numbers. For comparisons use the *_vs_account_pct and *_change_pct fields. Rounding is fine.
- Never invent metrics, ads, competitors, customer quotes or results. If the input does not contain something, leave it out.

Rules for judgement:
- Each ad's "status" (winner / losing / steady / not_enough_data) and "fatiguing" flag come from fixed rules. Respect them: only call an ad a winner if its status is winner.
- If data_state is "limited", say early in the headline that it is early days and keep claims modest.
- Use ad_id values exactly as given. Put ad_ids on points about specific ads.
- Use the images to spot visual patterns (product close-up vs lifestyle, text on image, people, colours) only when you can actually see them.
- next_actions: 2 to 4, most important first. Use cta "make_more_like_this" with the ad_id for a winner worth scaling, "pause_in_ads_manager" with the ad_id for a losing or fatiguing ad (SkalX cannot pause ads itself), "test_new_angle" for new creative ideas, "fix_tracking" when purchases or purchase value are missing.
- angles_to_test: exactly 3. Each must come from the input: a past winner (name the ad), customer voice (quote their_words or a desire/frustration) or a competitor (name it and the gap). Hooks should sound like the brand, in simple English.
- Keep each list to at most 3 items (next_actions at most 4).`;

/** Used when the brand has no ad spend: the same output shape, about organic posts. */
export const POSTS_SYSTEM_PROMPT = `You are SkalX's social media analyst for small Indian D2C brands. This brand has no ad spend right now, so you read a JSON summary of its organic Facebook and Instagram posts from the last 90 days, plus images of its strongest and weakest posts, and explain what is working.

Who reads this: a busy business owner, often 40-60, not a marketer. Write short, plain sentences. Write reach as "reached 7 people" and engagement as "engagements" (likes, comments, saves and shares added up).
- Refer to a post by its "name" from the input (for example: Instagram reel “summer launch” (13 Oct)). Never write a post_id in any sentence.

Rules for numbers:
- Every claim must cite at least one number that appears in the input, written the same way. Do not write "lakh", "k" or "L".
- Never calculate new numbers. For comparisons use the *_vs_platform_avg_pct fields and the averages given. Rounding is fine.
- A negative *_pct means below average: write "100% below average", never "-100% below".
- Compare Instagram posts only with Instagram, and Facebook posts only with Facebook.
- Never invent metrics, posts, competitors, customer quotes or results. If the input does not contain something, leave it out.
- With only a few posts or small numbers, say early in the headline that it is early days and keep claims modest.

What to write:
- headline: one sentence on how their posts did, with one number.
- working / not_working: what kind of post does better or worse (format such as reel vs photo, topic or message in the caption, what the picture shows, day or time of posting). Put the post_id values the point is about in ad_ids, exactly as given.
- patterns: what the strongest posts have in common.
- Use the images only for what you can actually see (product close-up, people, text on image, colours).
- next_actions: 2 to 4, most important first, about what to post next and how. Use cta "test_new_angle" when the action is to turn a strong post or idea into a poster ad, otherwise "none". Never use "make_more_like_this", "pause_in_ads_manager" or "fix_tracking". ad_id is always null.
- angles_to_test: exactly 3 ideas for posts or ads. Each must come from the input: a strong post ("past_winner": name it by its caption), customer voice (quote their_words or a desire/frustration) or a competitor (name it and the gap). Hooks should sound like the brand, in simple English.
- Keep each list to at most 3 items (next_actions at most 4).`;

/** Posts mode: only actions that make sense without ads, and readable post names instead of raw ids. */
export function tidyForMode(out: Insights, input: Pick<AnalysisInput, 'mode' | 'labels'>): Insights {
  if (input.mode !== 'posts') return out;
  const labels = [...(input.labels ?? new Map<string, string>())].sort((a, b) => b[0].length - a[0].length);
  const name = (t: string) => labels.reduce((acc, [id, label]) => acc.split(id).join(label), t)
    // "Facebook post <id>" becomes "Facebook post Facebook photo (…)": keep only the name.
    .replace(/\b(?:(?:Instagram|Facebook)\s+)?(?:post|reel|photo|video|image)\s+(?=(?:Instagram|Facebook)\s)/gi, '')
    .replace(/\b(Instagram|Facebook)\s+(?=\1\s)/g, '')
    .replace(/-(\d+(?:\.\d+)?)%\s+below/g, '$1% below');
  return {
    headline: name(out.headline),
    working: out.working.map((p) => ({ ...p, point: name(p.point), evidence: name(p.evidence) })),
    not_working: out.not_working.map((p) => ({ ...p, point: name(p.point), evidence: name(p.evidence) })),
    patterns: out.patterns.map((p) => ({ point: name(p.point), evidence: name(p.evidence) })),
    next_actions: out.next_actions.map((a) => ({ ...a, action: name(a.action), why: name(a.why), ad_id: null, cta: a.cta === 'test_new_angle' ? a.cta : 'none' })),
    angles_to_test: out.angles_to_test.map((a) => ({ ...a, source_detail: name(a.source_detail), why: name(a.why), hook: name(a.hook) })),
  };
}

export type AnalyzeResult =
  | { status: 'skipped'; reason: 'not_connected' | 'no_data' | 'unchanged' | 'already_running' }
  | { status: 'succeeded'; insightId: string; dropped: number }
  | { status: 'failed'; insightId: string; error: string };

function userContent(input: AnalysisInput): AiPart[] {
  const parts: AiPart[] = [];
  for (const img of input.images) {
    parts.push({ text: `Image of ${img.label}, ad_id ${img.adId}:` });
    parts.push({ image: { mediaType: img.mediaType, data: img.data } });
  }
  parts.push({ text: `Here is the data (JSON):\n${JSON.stringify(input.json)}\n\nWrite the analysis.` });
  return parts;
}

function retryMessage(problem: string): string {
  return `Your answer can't be shown yet: ${problem}\nAnswer again following every rule. Only use numbers that appear in the data, written the same way.`;
}

function describeGuard(g: GuardResult): string {
  const lines = g.dropped.slice(0, 8).map((d) => `- ${d.section}: "${d.text.slice(0, 120)}" uses ${d.numbers.join(', ')}, which are not in the data.`);
  return `some statements use numbers that are not in the data:\n${lines.join('\n')}`;
}

export async function runAnalysis(params: {
  userId: string;
  trigger: 'sync' | 'manual';
  force?: boolean;
  deps?: { client?: StructuredClient; fetchImpl?: typeof fetch };
}): Promise<AnalyzeResult> {
  const conn = await MetaConnectionDAO.getByUser(params.userId);
  if (!conn || conn.status !== 'active') return { status: 'skipped', reason: 'not_connected' };
  if (await store.runningInsight(conn.id)) return { status: 'skipped', reason: 'already_running' };

  const input = await buildAnalysisInput(params.userId, { fetchImpl: params.deps?.fetchImpl });
  if (!input) return { status: 'skipped', reason: 'no_data' };

  const last = await store.latestInsight(conn.id, 'succeeded');
  if (!params.force && last?.inputHash === input.hash) return { status: 'skipped', reason: 'unchanged' };

  const row = await store.startInsightRun({ connectionId: conn.id, userId: params.userId, trigger: params.trigger, rangeDays: input.rangeDays });
  const client = params.deps?.client ?? geminiStructured;
  const messages: AiMessage[] = [{ role: 'user', parts: userContent(input) }];
  const usage = { input_tokens: 0, output_tokens: 0 };
  let model = AI_TEXT_MODEL();
  let attempts = 0;
  let lastProblem = '';

  try {
    while (attempts < MAX_ATTEMPTS) {
      attempts++;
      const response = await client.generate({
        system: input.mode === 'posts' ? POSTS_SYSTEM_PROMPT : SYSTEM_PROMPT, messages, schema: InsightsSchema, effort: 'medium', maxTokens: 16000, timeoutMs: 5 * 60 * 1000, label: 'meta-insights',
      });
      model = response.model;
      usage.input_tokens += response.usage.input_tokens;
      usage.output_tokens += response.usage.output_tokens;

      if (response.stop === 'refusal') throw new Error('The AI model declined the request');
      const parsed = response.data as Insights | null;
      if (!parsed) {
        lastProblem = response.stop === 'cut_off' ? 'the answer was cut off.' : 'the answer did not match the required JSON format.';
      } else {
        const guard = guardInsights(tidyForMode(parsed, input), input.json, input.adIds);
        if (!needsRetry(guard) || attempts === MAX_ATTEMPTS) {
          if (!guard.headlineOk) throw new Error('Headline cited numbers not in the data after retry');
          await store.finishInsightRun(row.id, {
            status: 'succeeded', output: guard.clean, dropped: guard.dropped, input: input.json, inputHash: input.hash,
            periodSince: input.period.since, periodUntil: input.period.until, model, attempts, usage,
          });
          metaLog.info('insights_succeeded', { userId: params.userId, mode: input.mode, attempts, dropped: guard.dropped.length, images: input.images.length, usage });
          return { status: 'succeeded', insightId: row.id, dropped: guard.dropped.length };
        }
        lastProblem = describeGuard(guard);
      }
      if (attempts < MAX_ATTEMPTS) {
        // Append-only: keep the assistant turn exactly as returned, then ask for a fix.
        messages.push({ role: 'model', parts: [{ text: response.text || '{}' }] });
        messages.push({ role: 'user', parts: [{ text: retryMessage(lastProblem) }] });
      }
    }
    throw new Error(`Analysis failed validation: ${lastProblem}`);
  } catch (err) {
    const message = (err as Error).message;
    await store.finishInsightRun(row.id, {
      status: 'failed', error: message.slice(0, 500), input: input.json, inputHash: input.hash, model, attempts, usage,
      periodSince: input.period.since, periodUntil: input.period.until,
    });
    metaLog.error('insights_failed', { userId: params.userId, attempts, message });
    return { status: 'failed', insightId: row.id, error: message };
  }
}
