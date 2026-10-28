-- Brand Kits Live package — 99 postflight (READ ONLY)
-- MANUAL. Run after 01–03 to verify Live shape.
-- Contains SELECT only. No DDL. No DML.

-- ============================================================
-- A. Tables, RLS and browser access — expect exists = true,
--    rls_enabled = true, anon/authenticated privileges = false
-- ============================================================
SELECT
  c.relname AS table_name,
  true AS exists,
  c.relrowsecurity AS rls_enabled,
  has_table_privilege('anon', c.oid, 'SELECT,INSERT,UPDATE,DELETE') AS anon_has_access,
  has_table_privilege('authenticated', c.oid, 'SELECT,INSERT,UPDATE,DELETE') AS authenticated_has_access
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname IN ('brand_kits', 'product_cutouts')
ORDER BY c.relname;

-- ============================================================
-- B. Columns the app reads — expect 1 row each
-- ============================================================
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (table_name, column_name) IN (
    ('brand_kits', 'identity'),
    ('brand_kits', 'is_default'),
    ('product_cutouts', 'source_hash')
  )
ORDER BY table_name, column_name;

-- ============================================================
-- C. Migrated kits — expect users_with_two_defaults = 0
-- ============================================================
SELECT
  count(*) AS kits,
  count(DISTINCT user_id) AS users_with_kits,
  count(*) FILTER (WHERE is_default) AS default_kits,
  (SELECT count(*) FROM (
     SELECT user_id FROM public.brand_kits WHERE is_default GROUP BY user_id HAVING count(*) > 1
   ) d) AS users_with_two_defaults
FROM public.brand_kits;

-- ============================================================
-- D. Guidelines not carried into a kit — expect 0
--    (a meaningful guideline whose user has no same-named kit)
-- ============================================================
SELECT count(*) AS guidelines_without_kit
FROM public.profiles p
WHERE jsonb_typeof(p.brand_snapshot) = 'object'
  AND coalesce(trim(p.brand_snapshot->>'name'), '') <> ''
  AND EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p.id)
  AND NOT (
    lower(trim(p.brand_snapshot->>'name')) IN ('my brand', 'unknown brand')
    AND coalesce(p.brand_snapshot->>'description', '') = ''
    AND coalesce(p.brand_snapshot->>'offering', '') = ''
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.brand_kits k
    WHERE k.user_id = p.id AND lower(k.name) = lower(left(trim(p.brand_snapshot->>'name'), 80))
  );
