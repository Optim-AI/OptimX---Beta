-- Security Live package — 99 postflight (READ ONLY)
-- MANUAL. Run after 01. Contains SELECT only.

-- ============================================================
-- A. Expect: every existing table rls_enabled = true and
--    anon_has_access = false
-- ============================================================
SELECT
  c.relname AS table_name,
  c.relrowsecurity AS rls_enabled,
  has_table_privilege('anon', c.oid, 'SELECT,INSERT,UPDATE,DELETE') AS anon_has_access
FROM pg_class c
WHERE c.relnamespace = 'public'::regnamespace
  AND c.relname IN (
    'app_settings', 'campaigns', 'creative_intelligence_brands', 'creative_intelligence_competitors',
    'creative_intelligence_creatives', 'creative_intelligence_facebook_pages', 'creative_intelligence_google_ranks',
    'creative_intelligence_hooks', 'creative_intelligence_meta_ads', 'creative_intelligence_reviews',
    'creative_intelligence_runs', 'creative_intelligence_strategies', 'feature_keys', 'integration_flags',
    'integrationsbeta', 'plan_feature_flags', 'profiles', 'reports', 'subscription_cycles',
    'training_artifacts', 'user_chats', 'user_generated_images', 'user_ui_state', 'vouchers'
  )
ORDER BY rls_enabled, anon_has_access DESC, c.relname;

-- ============================================================
-- B. Expect 6 rows: 4 campaigns_owner_*, 2 integrationsbeta_owner_*
-- ============================================================
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND policyname IN (
    'campaigns_owner_select', 'campaigns_owner_insert', 'campaigns_owner_update', 'campaigns_owner_delete',
    'integrationsbeta_owner_select', 'integrationsbeta_owner_insert'
  )
ORDER BY tablename, policyname;

-- ============================================================
-- C. Public tables still open to anon (anything here was not in
--    this package's list — review, don't auto-fix)
-- ============================================================
SELECT c.relname AS still_open_to_anon
FROM pg_class c
WHERE c.relnamespace = 'public'::regnamespace
  AND c.relkind = 'r'
  AND NOT c.relrowsecurity
  AND has_table_privilege('anon', c.oid, 'SELECT')
ORDER BY 1;
