-- ============================================================
-- Merge the Brand Guideline (profiles.brand_snapshot) into Brand Kits
-- ============================================================
-- 1. Brand kits gain an `identity` block (who the brand is: description,
--    audience, offering, tone, values …) alongside the visual design system.
-- 2. Each user's Brand Guideline is carried into their kits so nobody
--    re-enters anything:
--    - a kit with the same brand name exists → fill its empty identity;
--    - otherwise → create a kit from the guideline (default only if the
--      user has no kits yet, so an existing default is never overridden).
--    Empty placeholder guidelines ("My Brand", "Unknown Brand") are skipped.
-- profiles.brand_snapshot is kept as a read fallback and not modified.

ALTER TABLE public.brand_kits
  ADD COLUMN IF NOT EXISTS identity jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE OR REPLACE FUNCTION pg_temp.snapshot_identity(s jsonb) RETURNS jsonb
LANGUAGE sql IMMUTABLE AS $$
  SELECT jsonb_strip_nulls(jsonb_build_object(
    'description', left(coalesce(nullif(s->>'description', ''), s->>'business_overview', ''), 600),
    'tagline', left(coalesce(s->>'tagline', ''), 120),
    'industry', left(coalesce(s->>'industry', ''), 80),
    'offering', left(coalesce(s->>'offering', ''), 400),
    'audience', left(coalesce(s->>'audience', ''), 300),
    'valueProposition', left(coalesce(s->>'coreValueProp', ''), 300),
    'tone', left(coalesce(nullif(s->>'personality', ''), s->>'tone', ''), 160),
    'values', CASE WHEN jsonb_typeof(s->'brand_values') = 'array' THEN s->'brand_values' ELSE '[]'::jsonb END,
    'productCategory', s->>'productCategory',
    'pricePositioning', s->>'pricePositioning',
    'brandVoice', s->>'brandVoice',
    'aesthetic', CASE WHEN jsonb_typeof(s->'brand_aesthetic') = 'array' THEN s->'brand_aesthetic' END,
    'ctaPatterns', CASE WHEN jsonb_typeof(s->'ctaPatterns') = 'array' THEN s->'ctaPatterns' END
  ))
$$;

CREATE TEMP TABLE guideline_src AS
SELECT
  p.id AS user_id,
  p.brand_snapshot AS s,
  left(trim(p.brand_snapshot->>'name'), 80) AS name
FROM public.profiles p
WHERE p.brand_snapshot IS NOT NULL
  AND jsonb_typeof(p.brand_snapshot) = 'object'
  AND coalesce(trim(p.brand_snapshot->>'name'), '') <> ''
  AND EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p.id)
  AND NOT (
    lower(trim(p.brand_snapshot->>'name')) IN ('my brand', 'unknown brand')
    AND coalesce(p.brand_snapshot->>'description', '') = ''
    AND coalesce(p.brand_snapshot->>'offering', '') = ''
  );

-- Same-named kit already exists: fill only its empty identity.
UPDATE public.brand_kits k
SET identity = pg_temp.snapshot_identity(g.s),
    updated_at = now()
FROM guideline_src g
WHERE k.user_id = g.user_id
  AND lower(k.name) = lower(g.name)
  AND k.identity = '{}'::jsonb;

-- No same-named kit: create one from the guideline.
WITH src AS (
  SELECT g.*
  FROM guideline_src g
  WHERE NOT EXISTS (
    SELECT 1 FROM public.brand_kits k WHERE k.user_id = g.user_id AND lower(k.name) = lower(g.name)
  )
),
hexes AS (
  -- primaryColors[] in order, else the legacy colors{} object; valid 6-digit hex only
  SELECT src.user_id, lower(h.value) AS hex, h.ord
  FROM src
  CROSS JOIN LATERAL (
    SELECT value, ord FROM jsonb_array_elements_text(
      CASE WHEN jsonb_typeof(src.s->'primaryColors') = 'array' THEN src.s->'primaryColors' ELSE '[]'::jsonb END
    ) WITH ORDINALITY AS t(value, ord)
    UNION ALL
    SELECT value, ord + 100 FROM (
      SELECT src.s->'colors'->>'primary' AS value, 1 AS ord
      UNION ALL SELECT src.s->'colors'->>'secondary', 2
      UNION ALL SELECT src.s->'colors'->>'accent', 3
    ) legacy
  ) h
  WHERE h.value ~* '^#[0-9a-f]{6}$'
),
color_json AS (
  SELECT
    user_id,
    jsonb_agg(
      jsonb_build_object('hex', hex, 'role', CASE rn WHEN 1 THEN 'primary' WHEN 2 THEN 'secondary' ELSE 'accent' END)
      ORDER BY rn
    ) AS colors
  FROM (
    SELECT user_id, hex, row_number() OVER (PARTITION BY user_id ORDER BY min(ord)) AS rn
    FROM hexes
    GROUP BY user_id, hex
  ) ranked
  WHERE rn <= 5
  GROUP BY user_id
)
INSERT INTO public.brand_kits (user_id, name, website_url, is_default, logo, colors, fonts, guidelines, identity)
SELECT
  src.user_id,
  src.name,
  CASE WHEN src.s->>'website_url' ~* '^https?://' THEN left(src.s->>'website_url', 2000) END,
  NOT EXISTS (SELECT 1 FROM public.brand_kits k WHERE k.user_id = src.user_id),
  CASE
    WHEN coalesce(src.s->>'logo', '') ~* '^https?://' THEN jsonb_build_object('url', left(src.s->>'logo', 2000))
    WHEN coalesce(src.s->>'logo', '') ~* '^data:image/(svg\+xml|png|jpeg|webp);' AND length(src.s->>'logo') <= 200000
      THEN jsonb_build_object('url', src.s->>'logo')
    WHEN coalesce(src.s->>'logoUrl', '') ~* '^https?://' THEN jsonb_build_object('url', left(src.s->>'logoUrl', 2000))
  END,
  coalesce(color_json.colors, '[]'::jsonb),
  CASE
    WHEN coalesce(trim(src.s->>'primaryFont'), '') <> '' THEN jsonb_build_object(
      'heading', jsonb_build_object('family', left(trim(src.s->>'primaryFont'), 60), 'source', 'google'),
      'body', jsonb_build_object('family', left(trim(src.s->>'primaryFont'), 60), 'source', 'google')
    )
    ELSE '{}'::jsonb
  END,
  '{}'::jsonb,
  pg_temp.snapshot_identity(src.s)
FROM src
LEFT JOIN color_json ON color_json.user_id = src.user_id;

DROP TABLE guideline_src;
