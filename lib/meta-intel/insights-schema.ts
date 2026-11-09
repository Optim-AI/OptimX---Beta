/** Zod schema for Claude's structured output (server-only). Kept in sync with insights-types.ts. */
import * as z from 'zod/v4';
import type { Insights } from './insights-types';

const Point = z.object({
  point: z.string().describe('One plain-language sentence.'),
  evidence: z.string().describe('The numbers from the input that back it up, written exactly as in the input.'),
  ad_ids: z.array(z.string()).describe('ad_id values from the input this point is about; empty if none.'),
});

export const InsightsSchema = z.object({
  headline: z.string().describe('One sentence: how the ads did in this period, with one number.'),
  working: z.array(Point).describe('Up to 3 things that are working.'),
  not_working: z.array(Point).describe('Up to 3 things that are not working.'),
  patterns: z.array(z.object({ point: z.string(), evidence: z.string() })).describe('Up to 3 patterns across ads (copy, visuals, format, SkalX vs others).'),
  next_actions: z.array(z.object({
    action: z.string().describe('What the owner should do next, as an instruction.'),
    why: z.string().describe('Why, citing a number from the input.'),
    cta: z.enum(['make_more_like_this', 'pause_in_ads_manager', 'test_new_angle', 'fix_tracking', 'none']),
    ad_id: z.string().nullable().describe('The ad this action is about, or null.'),
  })).describe('2 to 4 actions, most important first.'),
  angles_to_test: z.array(z.object({
    angle: z.string().describe('Short name of the angle.'),
    hook: z.string().describe('A first line for the ad, in the brand voice.'),
    source: z.enum(['past_winner', 'customer_voice', 'competitor']),
    source_detail: z.string().describe('Which winning ad, customer quote or competitor from the input this comes from.'),
    why: z.string(),
  })).describe('Exactly 3 new angles to test.'),
});

// Compile-time check that the schema and the shared type agree.
type _Check = z.infer<typeof InsightsSchema> extends Insights ? (Insights extends z.infer<typeof InsightsSchema> ? true : never) : never;
export const _schemaMatchesType: _Check = true;
