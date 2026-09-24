-- Phase 12.5 Live package — 99 postflight (READ ONLY)
-- MANUAL. Run after 01–07 apply to verify Live shape.
-- Contains SELECT only. No DDL. No DML.

-- ============================================================
-- TABLES
-- ============================================================
SELECT
  'table_exists' AS check_name,
  t.table_name,
  (to_regclass('public.' || t.table_name) IS NOT NULL) AS exists
FROM (VALUES
  ('credit_reservations'),
  ('generation_job_locks'),
  ('subscription_cycles')
) AS t(table_name)
ORDER BY t.table_name;

-- ============================================================
-- COLUMNS — subscriptions pending support + cancel_at_period_end
-- ============================================================
SELECT
  'subscriptions_status_check' AS check_name,
  c.conname,
  pg_get_constraintdef(c.oid) AS definition
FROM pg_constraint c
JOIN pg_class t ON c.conrelid = t.oid
JOIN pg_namespace n ON t.relnamespace = n.oid
WHERE n.nspname = 'public'
  AND t.relname = 'subscriptions'
  AND c.contype = 'c'
  AND pg_get_constraintdef(c.oid) ILIKE '%status%';

SELECT
  'subscriptions_cancel_at_period_end' AS check_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'subscriptions'
  AND column_name = 'cancel_at_period_end';

SELECT
  'subscriptions_pending_status_support' AS check_name,
  CASE
    WHEN pg_get_constraintdef(c.oid) ILIKE '%pending%' THEN true
    ELSE false
  END AS status_check_allows_pending,
  pg_get_constraintdef(c.oid) AS definition
FROM pg_constraint c
JOIN pg_class t ON c.conrelid = t.oid
JOIN pg_namespace n ON t.relnamespace = n.oid
WHERE n.nspname = 'public'
  AND t.relname = 'subscriptions'
  AND c.contype = 'c'
  AND pg_get_constraintdef(c.oid) ILIKE '%status%';

-- ============================================================
-- INDEXES / CONSTRAINTS
-- ============================================================
SELECT
  'required_indexes' AS check_name,
  expected.indexname,
  (i.indexname IS NOT NULL) AS present,
  i.tablename,
  i.indexdef
FROM (VALUES
  ('idx_payments_razorpay_payment_id_unique'),
  ('idx_credit_reservations_active_reference'),
  ('idx_credit_history_seconds_to_video_credits_v1'),
  ('idx_subscriptions_cancel_at_period_end'),
  ('idx_generation_job_locks_user'),
  ('idx_generation_job_locks_status'),
  ('idx_subscription_cycles_subscription'),
  ('idx_subscription_cycles_user'),
  ('idx_subscription_cycles_status')
) AS expected(indexname)
LEFT JOIN pg_indexes i
  ON i.schemaname = 'public' AND i.indexname = expected.indexname
ORDER BY expected.indexname;

SELECT
  'subscription_cycles_unique_constraints' AS check_name,
  c.conname,
  pg_get_constraintdef(c.oid) AS definition
FROM pg_constraint c
JOIN pg_class t ON c.conrelid = t.oid
JOIN pg_namespace n ON t.relnamespace = n.oid
WHERE n.nspname = 'public'
  AND t.relname = 'subscription_cycles'
  AND c.contype = 'u'
ORDER BY c.conname;

-- ============================================================
-- SECURITY — RLS + grants (including subscription_cycles)
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

SELECT
  'subscription_cycles_policies' AS check_name,
  pol.polname,
  pol.polcmd
FROM pg_policy pol
JOIN pg_class c ON c.oid = pol.polrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname = 'subscription_cycles'
ORDER BY pol.polname;

SELECT
  'dangerous_grants_anon_authenticated' AS check_name,
  table_name,
  grantee,
  string_agg(privilege_type, ', ' ORDER BY privilege_type) AS privileges
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN (
    'credit_history',
    'payments',
    'subscriptions',
    'webhook_events',
    'credit_reservations',
    'generation_job_locks',
    'subscription_cycles'
  )
  AND grantee IN ('anon', 'authenticated', 'public')
GROUP BY table_name, grantee
ORDER BY table_name, grantee;

SELECT
  'allowed_select_grants' AS check_name,
  table_name,
  grantee,
  string_agg(privilege_type, ', ' ORDER BY privilege_type) AS privileges
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN ('user_credits', 'plans', 'credit_packs')
  AND grantee IN ('anon', 'authenticated', 'public')
GROUP BY table_name, grantee
ORDER BY table_name, grantee;

-- ============================================================
-- CATALOG — exactly 3 canonical active plans with correct allotments
-- ============================================================
SELECT
  'canonical_active_plan_count' AS check_name,
  COUNT(*)::int AS active_canonical_count
FROM public.plans
WHERE id IN ('skalx_starter', 'skalx_growth', 'skalx_pro')
  AND is_active = true;

SELECT
  'canonical_plan_details' AS check_name,
  id,
  slug,
  billing_cycle,
  price_inr,
  image_credits,
  video_credits,
  razorpay_plan_id,
  display_order,
  is_active,
  (razorpay_plan_id IS NOT NULL AND btrim(razorpay_plan_id) <> '' AND razorpay_plan_id NOT LIKE '%LIVE_RAZORPAY%' AND razorpay_plan_id NOT LIKE '%<%') AS razorpay_id_ok,
  (razorpay_plan_id NOT LIKE 'plan_TfW%') AS not_test_plan_id
FROM public.plans
WHERE id IN ('skalx_starter', 'skalx_growth', 'skalx_pro')
ORDER BY display_order, id;

SELECT
  'canonical_plan_expectation_mismatches' AS check_name,
  p.id,
  p.price_inr,
  p.image_credits,
  p.video_credits,
  p.display_order,
  p.billing_cycle,
  p.slug,
  p.is_active
FROM public.plans p
JOIN (VALUES
  ('skalx_starter', 'skalx-starter', 3999, 50, 1200, 1),
  ('skalx_growth', 'skalx-growth', 6999, 150, 2400, 2),
  ('skalx_pro', 'skalx-pro', 12999, 300, 4800, 3)
) AS e(id, slug, price_inr, image_credits, video_credits, display_order)
  ON e.id = p.id
WHERE p.is_active IS DISTINCT FROM true
   OR p.slug IS DISTINCT FROM e.slug
   OR p.billing_cycle IS DISTINCT FROM 'monthly'
   OR p.price_inr IS DISTINCT FROM e.price_inr
   OR p.image_credits IS DISTINCT FROM e.image_credits
   OR p.video_credits IS DISTINCT FROM e.video_credits
   OR p.display_order IS DISTINCT FROM e.display_order
   OR p.razorpay_plan_id IS NULL
   OR btrim(p.razorpay_plan_id) = ''
   OR p.razorpay_plan_id LIKE '%LIVE_RAZORPAY%'
   OR p.razorpay_plan_id LIKE '%<%'
   OR p.razorpay_plan_id LIKE 'plan_TfW%';

SELECT
  'obsolete_still_active' AS check_name,
  id,
  slug
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
ORDER BY id;

SELECT
  'canonical_feature_flag_counts' AS check_name,
  plan_id,
  COUNT(*)::int AS flag_count
FROM public.plan_feature_flags
WHERE plan_id IN ('skalx_starter', 'skalx_growth', 'skalx_pro')
GROUP BY plan_id
ORDER BY plan_id;

-- ============================================================
-- DATA PRESERVATION — wallets / payments / webhooks
-- Compare these counts to preflight baselines captured before apply.
-- ============================================================
SELECT
  'preservation_counts' AS check_name,
  (SELECT COUNT(*)::bigint FROM public.user_credits) AS user_credits_rows,
  (SELECT COALESCE(SUM(video_credits_subscription), 0)::bigint FROM public.user_credits) AS sum_video_sub,
  (SELECT COALESCE(SUM(video_credits_addon), 0)::bigint FROM public.user_credits) AS sum_video_addon,
  (SELECT COALESCE(SUM(image_credits_subscription), 0)::bigint FROM public.user_credits) AS sum_image_sub,
  (SELECT COALESCE(SUM(image_credits_addon), 0)::bigint FROM public.user_credits) AS sum_image_addon,
  (SELECT COUNT(*)::bigint FROM public.payments) AS payments_rows,
  (SELECT COUNT(*)::bigint FROM public.webhook_events) AS webhook_events_rows,
  (SELECT COUNT(*)::bigint FROM public.subscriptions) AS subscriptions_rows,
  (SELECT COUNT(*)::bigint FROM public.credit_history) AS credit_history_rows;
