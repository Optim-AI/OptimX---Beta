-- PR I: Enable basic_analytics for canonical SkalX subscription plans only.
--
-- Scope: skalx_starter, skalx_growth, skalx_pro
-- Does NOT touch advanced_analytics, dashboard, create_campaigns, or legacy plans
-- (free_trial, basic_*, starter_*, lite_growth_*, growth_pro_*).
--
-- Prerequisites: plan_feature_flags rows exist (20260325200000_replace_subscription_plan_catalog.sql).
-- Safe to rerun: WHERE is_coming_soon = true; already-enabled rows are skipped.
-- Do NOT apply to production until reviewed.
--
-- Deployment order (staging first):
--   1. Ship application code that uses decideBasicAnalyticsAccess
--      (PAYG = zero subscription rows; subscribers = plan flags).
--   2. Apply this migration on staging.
--   3. Verify PAYG, skalx_* subscriber, legacy/trial, unauthenticated.
--
-- Rollback (staging only, if needed):
--   UPDATE public.plan_feature_flags
--   SET is_enabled = false, is_coming_soon = true
--   WHERE feature_key = 'basic_analytics'
--     AND plan_id IN ('skalx_starter', 'skalx_growth', 'skalx_pro');

UPDATE public.plan_feature_flags
SET
  is_enabled = true,
  is_coming_soon = false
WHERE feature_key = 'basic_analytics'
  AND is_coming_soon = true
  AND plan_id IN ('skalx_starter', 'skalx_growth', 'skalx_pro');
