/** Shape of an AI insights result (shared by server and browser; no runtime deps). */
export type InsightPoint = { point: string; evidence: string; ad_ids: string[] };
export type InsightPattern = { point: string; evidence: string };
export type InsightCta = 'make_more_like_this' | 'pause_in_ads_manager' | 'test_new_angle' | 'fix_tracking' | 'none';
export type InsightAction = { action: string; why: string; cta: InsightCta; ad_id: string | null };
export type AngleSource = 'past_winner' | 'customer_voice' | 'competitor';
export type InsightAngle = { angle: string; hook: string; source: AngleSource; source_detail: string; why: string };

export type Insights = {
  headline: string;
  working: InsightPoint[];
  not_working: InsightPoint[];
  patterns: InsightPattern[];
  next_actions: InsightAction[];
  angles_to_test: InsightAngle[];
};

export const INSIGHT_LIMITS = { working: 3, not_working: 3, patterns: 3, next_actions: 4, angles_to_test: 3 } as const;
