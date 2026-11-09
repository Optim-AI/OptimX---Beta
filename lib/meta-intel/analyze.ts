/**
 * Runs one AI analysis for a user's Meta data and stores it in ai_insights.
 *  - Claude interprets a compact JSON summary + ad images; output is strict JSON (structured outputs)
 *  - Zod-validated, then the number guard drops bullets citing numbers not in the input
 *  - One retry (same conversation) when parsing fails or the guard rejects too much
 *  - Skips when nothing changed since the last successful analysis (unless forced)
 */
import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { MetaConnectionDAO } from '@/database/models/MetaConnection.dao';
import { metaLog } from '@/lib/meta/log';
import { InsightsSchema } from './insights-schema';
import type { Insights } from './insights-types';
import { guardInsights, needsRetry, type GuardResult } from './number-guard';
import { buildAnalysisInput, ANALYSIS_RANGE_DAYS, type AnalysisInput } from './analysis-input';
import * as store from './insights-store';

export const INSIGHTS_MODEL = process.env.META_INSIGHTS_MODEL?.trim() || 'claude-opus-5-5';
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

type ClaudeClient = Pick<Anthropic, 'beta'>;

export type AnalyzeResult =
  | { status: 'skipped'; reason: 'not_connected' | 'no_data' | 'unchanged' | 'already_running' }
  | { status: 'succeeded'; insightId: string; dropped: number }
  | { status: 'failed'; insightId: string; error: string };

function userContent(input: AnalysisInput): Anthropic.Beta.BetaContentBlockParam[] {
  const blocks: Anthropic.Beta.BetaContentBlockParam[] = [];
  for (const img of input.images) {
    blocks.push({ type: 'text', text: `Image of ${img.label}, ad_id ${img.adId}:` });
    blocks.push({ type: 'image', source: { type: 'base64', media_type: img.mediaType, data: img.data } });
  }
  blocks.push({ type: 'text', text: `Here is the data (JSON):\n${JSON.stringify(input.json)}\n\nWrite the analysis.` });
  return blocks;
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
  deps?: { client?: ClaudeClient; fetchImpl?: typeof fetch };
}): Promise<AnalyzeResult> {
  const conn = await MetaConnectionDAO.getByUser(params.userId);
  if (!conn || conn.status !== 'active') return { status: 'skipped', reason: 'not_connected' };
  if (await store.runningInsight(conn.id)) return { status: 'skipped', reason: 'already_running' };

  const input = await buildAnalysisInput(params.userId, { fetchImpl: params.deps?.fetchImpl });
  if (!input) return { status: 'skipped', reason: 'no_data' };

  const last = await store.latestInsight(conn.id, 'succeeded');
  if (!params.force && last?.inputHash === input.hash) return { status: 'skipped', reason: 'unchanged' };

  const row = await store.startInsightRun({ connectionId: conn.id, userId: params.userId, trigger: params.trigger, rangeDays: ANALYSIS_RANGE_DAYS });
  const client = params.deps?.client ?? new Anthropic({ timeout: 5 * 60 * 1000 });
  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: 'user', content: userContent(input) }];
  const usage = { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0 };
  let model = INSIGHTS_MODEL;
  let attempts = 0;
  let lastProblem = '';

  try {
    while (attempts < MAX_ATTEMPTS) {
      attempts++;
      const response = await client.beta.messages.parse({
        model: INSIGHTS_MODEL,
        max_tokens: 16000,
        system: SYSTEM_PROMPT,
        thinking: { type: 'adaptive' },
        output_config: { effort: 'medium', format: betaZodOutputFormat(InsightsSchema) },
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        messages,
      });
      model = response.model;
      usage.input_tokens += response.usage.input_tokens;
      usage.output_tokens += response.usage.output_tokens;
      usage.cache_read_input_tokens += response.usage.cache_read_input_tokens ?? 0;

      if (response.stop_reason === 'refusal') {
        throw new Error(`Claude declined the request (${response.stop_details?.category ?? 'unknown'})`);
      }
      const parsed = response.stop_reason === 'max_tokens' ? null : (response.parsed_output as Insights | null);
      if (!parsed) {
        lastProblem = response.stop_reason === 'max_tokens' ? 'the answer was cut off.' : 'the answer did not match the required JSON format.';
      } else {
        const guard = guardInsights(parsed, input.json, input.adIds);
        if (!needsRetry(guard) || attempts === MAX_ATTEMPTS) {
          if (!guard.headlineOk) throw new Error('Headline cited numbers not in the data after retry');
          await store.finishInsightRun(row.id, {
            status: 'succeeded', output: guard.clean, dropped: guard.dropped, input: input.json, inputHash: input.hash,
            periodSince: input.dashboard.period.since, periodUntil: input.dashboard.period.until, model, attempts, usage,
          });
          metaLog.info('insights_succeeded', { userId: params.userId, attempts, dropped: guard.dropped.length, images: input.images.length, usage });
          return { status: 'succeeded', insightId: row.id, dropped: guard.dropped.length };
        }
        lastProblem = describeGuard(guard);
      }
      if (attempts < MAX_ATTEMPTS) {
        // Append-only: keep the assistant turn exactly as returned, then ask for a fix.
        messages.push({ role: 'assistant', content: response.content as unknown as Anthropic.Beta.BetaContentBlockParam[] });
        messages.push({ role: 'user', content: retryMessage(lastProblem) });
      }
    }
    throw new Error(`Analysis failed validation: ${lastProblem}`);
  } catch (err) {
    const message = err instanceof Anthropic.APIError ? `Claude API ${err.status}: ${err.message}` : (err as Error).message;
    await store.finishInsightRun(row.id, {
      status: 'failed', error: message.slice(0, 500), input: input.json, inputHash: input.hash, model, attempts, usage,
      periodSince: input.dashboard.period.since, periodUntil: input.dashboard.period.until,
    });
    metaLog.error('insights_failed', { userId: params.userId, attempts, message });
    return { status: 'failed', insightId: row.id, error: message };
  }
}
