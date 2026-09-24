-- Phase 12.5 Live package — 00 preflight (READ ONLY)
-- MANUAL. Safe to run against Live for diagnostics.
-- Contains SELECT / catalog queries only. No DDL. No DML.

-- ============================================================
-- A. Duplicate non-null payments.razorpay_payment_id
-- Expect: 0 rows
-- ============================================================
SELECT
  'duplicate_razorpay_payment_id' AS check_name,
  razorpay_payment_id,
  COUNT(*)::int AS duplicate_count
FROM public.payments
WHERE razorpay_payment_id IS NOT NULL
GROUP BY razorpay_payment_id
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC, razorpay_payment_id;

-- ============================================================
-- B. Invalid / unexpected subscription statuses
-- Expect: statuses only in known set; note any outside future CHECK
-- ============================================================
SELECT
  'subscription_status_distribution' AS check_name,
  status,
  COUNT(*)::int AS row_count
FROM public.subscriptions
GROUP BY status
ORDER BY row_count DESC, status;

SELECT
  'subscription_status_outside_target_check' AS check_name,
  id,
  status
FROM public.subscriptions
WHERE status IS NULL
   OR status NOT IN ('pending', 'trialing', 'active', 'cancelled', 'expired', 'past_due')
ORDER BY status, id;

-- ============================================================
-- C. Existing target tables
-- ============================================================
SELECT
  'target_table_exists' AS check_name,
  t.table_name,
  (to_regclass('public.' || t.table_name) IS NOT NULL) AS exists
FROM (VALUES
  ('credit_reservations'),
  ('generation_job_locks'),
  ('subscription_cycles')
) AS t(table_name)
ORDER BY t.table_name;

-- ============================================================
-- D. Canonical plans (expect none or incomplete before apply)
-- ============================================================
SELECT
  'canonical_plans' AS check_name,
  id,
  slug,
  is_active,
  price_inr,
  image_credits,
  video_credits,
  razorpay_plan_id,
  display_order,
  billing_cycle
FROM public.plans
WHERE id IN ('skalx_starter', 'skalx_growth', 'skalx_pro')
ORDER BY display_order, id;

-- ============================================================
-- E. Obsolete plans still active
-- ============================================================
SELECT
  'obsolete_active_plans' AS check_name,
  id,
  slug,
  is_active,
  price_inr,
  image_credits,
  video_credits
FROM public.plans
WHERE id IN (
  'free_trial',
  'basic_monthly',
  'basic_quarterly',
  'starter_monthly',
  'starter_quarterly',
  'lite_growth_monthly',
  'lite_growth_quarterly',
  'growth_pro_monthly',
  'growth_pro_quarterly'
)
  AND is_active = true
ORDER BY display_order, id;

-- ============================================================
-- F. User credit balances (aggregates only — no full UUIDs)
-- ============================================================
SELECT
  'user_credits_aggregates' AS check_name,
  COUNT(*)::int AS total_rows,
  COUNT(*) FILTER (WHERE COALESCE(video_credits_addon, 0) > 0)::int AS addon_video_nonzero,
  COUNT(*) FILTER (WHERE COALESCE(video_credits_subscription, 0) > 0)::int AS sub_video_nonzero,
  COALESCE(SUM(video_credits_subscription), 0)::bigint AS sum_video_sub,
  COALESCE(SUM(video_credits_addon), 0)::bigint AS sum_video_addon,
  COALESCE(SUM(image_credits_subscription), 0)::bigint AS sum_image_sub,
  COALESCE(SUM(image_credits_addon), 0)::bigint AS sum_image_addon,
  COALESCE(MIN(video_credits_addon), 0)::int AS min_video_addon,
  COALESCE(MAX(video_credits_addon), 0)::int AS max_video_addon
FROM public.user_credits;

SELECT
  'user_credits_video_addon_distribution' AS check_name,
  video_credits_addon AS addon_balance,
  COUNT(*)::int AS wallet_count
FROM public.user_credits
WHERE COALESCE(video_credits_addon, 0) > 0
GROUP BY video_credits_addon
ORDER BY addon_balance;

-- ============================================================
-- G. credit_history video entries (evidence for wallet review)
-- ============================================================
SELECT
  'credit_history_video_by_source' AS check_name,
  source,
  operation,
  COUNT(*)::int AS row_count,
  COALESCE(SUM(amount), 0)::bigint AS sum_amount
FROM public.credit_history
WHERE credit_type = 'video'
GROUP BY source, operation
ORDER BY row_count DESC, source, operation;

SELECT
  'credit_history_video_missing_metadata_unit' AS check_name,
  COUNT(*)::int AS rows_missing_unit
FROM public.credit_history
WHERE credit_type = 'video'
  AND operation IN ('add', 'reset')
  AND (
    metadata IS NULL
    OR metadata->>'unit' IS NULL
    OR btrim(metadata->>'unit') = ''
  );

SELECT
  'credit_history_migration_markers' AS check_name,
  COUNT(*)::int AS marker_count
FROM public.credit_history
WHERE operation = 'migrate'
  AND source = 'seconds_to_video_credits_v1'
  AND credit_type = 'video';

-- ============================================================
-- H. RLS state for billing-related tables
-- ============================================================
SELECT
  'rls_state' AS check_name,
  c.relname AS table_name,
  c.relrowsecurity AS rls_enabled,
  c.relforcerowsecurity AS rls_forced
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND c.relname IN (
    'user_credits',
    'credit_history',
    'payments',
    'subscriptions',
    'webhook_events',
    'credit_reservations',
    'generation_job_locks',
    'subscription_cycles',
    'plans',
    'credit_packs'
  )
ORDER BY c.relname;

-- ============================================================
-- I. Grants (anon / authenticated)
-- ============================================================
SELECT
  'table_grants' AS check_name,
  table_name,
  grantee,
  string_agg(privilege_type, ', ' ORDER BY privilege_type) AS privileges
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN (
    'user_credits',
    'credit_history',
    'payments',
    'subscriptions',
    'webhook_events',
    'credit_reservations',
    'generation_job_locks',
    'subscription_cycles',
    'plans',
    'credit_packs'
  )
  AND grantee IN ('anon', 'authenticated', 'public')
GROUP BY table_name, grantee
ORDER BY table_name, grantee;

-- ============================================================
-- J. Required feature flags / keys
-- ============================================================
SELECT
  'required_feature_keys' AS check_name,
  k.id AS feature_key,
  (fk.id IS NOT NULL) AS present
FROM (VALUES
  ('image_generation'),
  ('video_generation'),
  ('no_watermark'),
  ('fast_generation'),
  ('priority_generation'),
  ('basic_analytics'),
  ('advanced_analytics'),
  ('social_posting'),
  ('auto_scheduling'),
  ('brand_analysis'),
  ('competitive_analysis'),
  ('dashboard'),
  ('integrations'),
  ('create_campaigns'),
  ('campaign_library')
) AS k(id)
LEFT JOIN public.feature_keys fk ON fk.id = k.id
ORDER BY k.id;

-- ============================================================
-- K. Existing indexes / constraints of interest
-- ============================================================
SELECT
  'index_presence' AS check_name,
  i.indexname,
  i.tablename
FROM pg_indexes i
WHERE i.schemaname = 'public'
  AND i.indexname IN (
    'idx_payments_razorpay_payment_id_unique',
    'idx_credit_reservations_active_reference',
    'idx_credit_history_seconds_to_video_credits_v1',
    'idx_subscriptions_cancel_at_period_end',
    'subscription_cycles_idempotency_key_unique',
    'subscription_cycles_razorpay_payment_id_unique'
  )
ORDER BY i.indexname;

SELECT
  'subscriptions_columns' AS check_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'subscriptions'
  AND column_name IN ('status', 'cancel_at_period_end')
ORDER BY column_name;

SELECT
  'row_counts_preserve' AS check_name,
  (SELECT COUNT(*)::bigint FROM public.user_credits) AS user_credits_rows,
  (SELECT COUNT(*)::bigint FROM public.payments) AS payments_rows,
  (SELECT COUNT(*)::bigint FROM public.webhook_events) AS webhook_events_rows,
  (SELECT COUNT(*)::bigint FROM public.subscriptions) AS subscriptions_rows,
  (SELECT COUNT(*)::bigint FROM public.credit_history) AS credit_history_rows;
