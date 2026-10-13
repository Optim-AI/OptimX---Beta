-- Scope ad_metrics_daily unique grain by ad_account_id so multi-account
-- integrations never share / overwrite metric rows across accounts.
--
-- Prerequisites: 20261009120000_paid_ads_performance_layer.sql (table exists).
-- Safe to rerun: DROP IF EXISTS + CREATE IF NOT EXISTS.
-- Do NOT apply to production until reviewed.
--
-- Rollout (staging):
--   1. Deploy app that upserts/reads with ad_account_id in the grain.
--   2. Apply this migration.
--   3. Re-sync selected Meta ad accounts so new rows use the stamped account id.
--
-- Legacy rows with NULL ad_account_id:
--   Remain readable only if explicitly queried without account filter.
--   Analytics warehouse REQUIRES a selected ad_accounts.id and excludes NULL
--   ad_account_id rows — those totals are treated as unattributable.
--
-- Rollback (staging only):
--   DROP INDEX IF EXISTS public.uq_ad_metrics_daily_grain;
--   CREATE UNIQUE INDEX uq_ad_metrics_daily_grain
--     ON public.ad_metrics_daily (
--       integration_id, entity_type, entity_external_id, metric_date
--     );
--   (May fail if two accounts already share the old grain.)

DROP INDEX IF EXISTS public.uq_ad_metrics_daily_grain;

CREATE UNIQUE INDEX IF NOT EXISTS uq_ad_metrics_daily_grain
  ON public.ad_metrics_daily (
    integration_id,
    ad_account_id,
    entity_type,
    entity_external_id,
    metric_date
  );
