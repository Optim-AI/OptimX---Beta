-- Staging postflight (read-only). Expect still_missing empty, buckets present,
-- rls_off empty for the locked set, and fn anon/auth execute = false.

WITH need(name) AS (
  VALUES
    ('brand_kits'),
    ('product_cutouts'),
    ('marketing_audits'),
    ('trial_access_requests'),
    ('poster_carousel_campaigns'),
    ('poster_carousel_slides')
)
SELECT 'missing_tables' AS check_name,
       coalesce(json_agg(n.name ORDER BY n.name), '[]'::json) AS result
FROM need n
WHERE to_regclass('public.' || n.name) IS NULL

UNION ALL
SELECT 'buckets',
       coalesce(json_agg(b.name ORDER BY b.name), '[]'::json)
FROM storage.buckets b

UNION ALL
SELECT 'campaign_assets_mimes',
       to_json(allowed_mime_types)
FROM storage.buckets
WHERE id = 'campaign-assets'

UNION ALL
SELECT 'rls_off_public',
       coalesce(json_agg(c.relname ORDER BY c.relname), '[]'::json)
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND NOT c.relrowsecurity

UNION ALL
SELECT 'privileged_fn_public_exec',
       json_agg(json_build_object(
         'fn', p.proname,
         'anon', has_function_privilege('anon', p.oid, 'execute'),
         'authenticated', has_function_privilege('authenticated', p.oid, 'execute')
       ) ORDER BY p.proname)
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'decrement_credit',
    'upsert_profile',
    'handle_new_auth_user',
    'handle_new_user_credits'
  );
