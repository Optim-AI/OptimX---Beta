-- Brand Kits Live package — 00 preflight (READ ONLY)
-- MANUAL. Safe to run against Live for diagnostics.
-- Contains SELECT / catalog queries only. No DDL. No DML.

-- ============================================================
-- A. Prerequisites — every row must say ok = true
-- ============================================================
SELECT 'auth_users_table' AS check_name, to_regclass('auth.users') IS NOT NULL AS ok
UNION ALL
SELECT 'profiles_table', to_regclass('public.profiles') IS NOT NULL
UNION ALL
SELECT 'profiles_brand_snapshot_is_jsonb', EXISTS (
  SELECT 1 FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'profiles'
    AND column_name = 'brand_snapshot' AND data_type = 'jsonb'
)
UNION ALL
SELECT 'gen_random_uuid_available', EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'gen_random_uuid')
UNION ALL
SELECT 'roles_anon_authenticated_exist',
  (SELECT count(*) FROM pg_roles WHERE rolname IN ('anon', 'authenticated')) = 2;

-- ============================================================
-- B. Target tables — expect exists = false on a first apply
--    (true is fine: every step is idempotent)
-- ============================================================
SELECT
  'target_table_exists' AS check_name,
  t.table_name,
  (to_regclass('public.' || t.table_name) IS NOT NULL) AS exists
FROM (VALUES ('brand_kits'), ('product_cutouts')) AS t(table_name)
ORDER BY t.table_name;

-- ============================================================
-- C. What 02 will migrate (informational)
--    guidelines_to_carry_over ≈ kits that 02 creates on a first apply
-- ============================================================
SELECT
  'brand_guidelines' AS check_name,
  count(*) FILTER (WHERE p.brand_snapshot IS NOT NULL) AS profiles_with_guideline,
  count(*) FILTER (
    WHERE jsonb_typeof(p.brand_snapshot) = 'object'
      AND coalesce(trim(p.brand_snapshot->>'name'), '') <> ''
      AND EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p.id)
      AND NOT (
        lower(trim(p.brand_snapshot->>'name')) IN ('my brand', 'unknown brand')
        AND coalesce(p.brand_snapshot->>'description', '') = ''
        AND coalesce(p.brand_snapshot->>'offering', '') = ''
      )
  ) AS guidelines_to_carry_over,
  count(*) FILTER (WHERE jsonb_typeof(p.brand_snapshot) IS DISTINCT FROM 'object' AND p.brand_snapshot IS NOT NULL) AS non_object_guidelines_skipped
FROM public.profiles p;
