-- Security Live package — 00 preflight (READ ONLY)
-- MANUAL. Safe to run against Live for diagnostics.
-- Contains SELECT / catalog queries only. No DDL. No DML.

-- ============================================================
-- A. Policy prerequisites — every row must say ok = true.
--    The owner policies compare user_id to auth.uid(), so both
--    columns must exist and be uuid.
-- ============================================================
SELECT 'auth_uid_function' AS check_name, EXISTS (
  SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'auth' AND p.proname = 'uid'
) AS ok
UNION ALL
SELECT 'campaigns_user_id_uuid', EXISTS (
  SELECT 1 FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'campaigns' AND column_name = 'user_id' AND data_type = 'uuid'
)
UNION ALL
SELECT 'integrationsbeta_user_id_uuid', EXISTS (
  SELECT 1 FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'integrationsbeta' AND column_name = 'user_id' AND data_type = 'uuid'
);

-- ============================================================
-- B. Current exposure (informational). Tables listed here with
--    rls_enabled = false and anon_has_access = true are what 01 closes.
--    Tables missing on Live are skipped by 01.
-- ============================================================
SELECT
  t.table_name,
  c.oid IS NOT NULL AS exists,
  coalesce(c.relrowsecurity, false) AS rls_enabled,
  CASE WHEN c.oid IS NULL THEN NULL ELSE has_table_privilege('anon', c.oid, 'SELECT') END AS anon_has_access
FROM (VALUES
  ('app_settings'), ('campaigns'), ('creative_intelligence_brands'), ('creative_intelligence_competitors'),
  ('creative_intelligence_creatives'), ('creative_intelligence_facebook_pages'), ('creative_intelligence_google_ranks'),
  ('creative_intelligence_hooks'), ('creative_intelligence_meta_ads'), ('creative_intelligence_reviews'),
  ('creative_intelligence_runs'), ('creative_intelligence_strategies'), ('feature_keys'), ('integration_flags'),
  ('integrationsbeta'), ('plan_feature_flags'), ('profiles'), ('reports'), ('subscription_cycles'),
  ('training_artifacts'), ('user_chats'), ('user_generated_images'), ('user_ui_state'), ('vouchers')
) AS t(table_name)
LEFT JOIN pg_class c ON c.relname = t.table_name AND c.relnamespace = 'public'::regnamespace
ORDER BY t.table_name;

-- ============================================================
-- C. Existing policies on these tables (informational) —
--    01 adds owner policies to campaigns and integrationsbeta only.
--    Any other existing policy keeps working after RLS is enabled.
-- ============================================================
SELECT tablename, policyname, cmd, roles
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
