-- Staging-only: align schema/storage/RLS to Live. DO NOT run on Live.
-- Idempotent where possible (IF NOT EXISTS / ON CONFLICT).

-- ========== 1. Missing tables ==========

-- Free marketing audit (pre-signup acquisition layer).
-- Owned by a profile id: the guest shadow profile from onboarding_guest_sessions
-- until claim, then the authenticated user. Additive only.

CREATE TABLE IF NOT EXISTS public.marketing_audits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  website_url text NOT NULL,
  normalized_host text NOT NULL,
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'running', 'completed', 'partial', 'failed')),
  stage text NOT NULL DEFAULT 'queued',
  attempt_count integer NOT NULL DEFAULT 0,
  lease_expires_at timestamptz,
  site jsonb,
  brand jsonb,
  competitors jsonb NOT NULL DEFAULT '[]'::jsonb,
  competitor_posts jsonb NOT NULL DEFAULT '[]'::jsonb,
  insights jsonb,
  ideas jsonb NOT NULL DEFAULT '[]'::jsonb,
  sources jsonb NOT NULL DEFAULT '[]'::jsonb,
  limitations jsonb NOT NULL DEFAULT '[]'::jsonb,
  selected_idea_index integer CHECK (selected_idea_index IS NULL OR selected_idea_index BETWEEN 0 AND 2),
  campaign_session_id uuid REFERENCES public.creative_studio_sessions(id) ON DELETE SET NULL,
  campaign_lock_at timestamptz,
  client_ip_hash text,
  error jsonb,
  claimed_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_marketing_audits_user_created
  ON public.marketing_audits (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_marketing_audits_ip_created
  ON public.marketing_audits (client_ip_hash, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_marketing_audits_user_host
  ON public.marketing_audits (user_id, normalized_host);

-- Server-only table (Drizzle / service connection), same as onboarding_guest_sessions.
-- RLS on with no policies blocks Data API access for anon and authenticated roles.
ALTER TABLE public.marketing_audits ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.marketing_audits FROM PUBLIC, anon, authenticated;

-- Manual free-trial access requests (sales review). Submitting a row never
-- creates a subscription, grants credits, or changes entitlements.

CREATE TABLE IF NOT EXISTS public.trial_access_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  email text NOT NULL,
  company_name text NOT NULL,
  website_url text,
  use_case text NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'activated')),
  client_ip_hash text,
  user_agent text,
  notify_sent_at timestamptz,
  notify_error text,
  reviewed_at timestamptz,
  reviewed_by text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trial_access_requests_email_created
  ON public.trial_access_requests (lower(email), created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trial_access_requests_status_created
  ON public.trial_access_requests (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trial_access_requests_ip_created
  ON public.trial_access_requests (client_ip_hash, created_at DESC);

-- Server-only (Drizzle / service role). No Data API policies for anon/authenticated.
ALTER TABLE public.trial_access_requests ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.trial_access_requests FROM PUBLIC, anon, authenticated;

-- Poster carousel campaigns (multi-slide poster generation).
-- Additive only: does not alter poster_generation_sessions or any existing data.
-- Slides are separate rows so each one can be claimed (lease), generated, charged,
-- and QC'd independently without overwriting concurrent progress on sibling slides.

CREATE TABLE IF NOT EXISTS poster_carousel_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  session_id uuid NOT NULL REFERENCES poster_generation_sessions(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'ready'
    CHECK (status IN ('planning', 'ready', 'generating', 'partial', 'completed', 'failed')),
  version integer NOT NULL DEFAULT 1,
  slide_count integer NOT NULL CHECK (slide_count BETWEEN 2 AND 10),
  aspect_ratio text NOT NULL,
  brief_id text NOT NULL,
  strategy_id text NOT NULL,
  story jsonb NOT NULL,
  shared_dna jsonb NOT NULL,
  campaign_checks jsonb NOT NULL DEFAULT '[]'::jsonb,
  last_export jsonb,
  generation_started_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_poster_carousel_campaigns_user
  ON poster_carousel_campaigns (user_id);
CREATE INDEX IF NOT EXISTS idx_poster_carousel_campaigns_session_created
  ON poster_carousel_campaigns (session_id, created_at DESC);

CREATE TABLE IF NOT EXISTS poster_carousel_slides (
  id text PRIMARY KEY,
  campaign_id uuid NOT NULL REFERENCES poster_carousel_campaigns(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  slide_index integer NOT NULL CHECK (slide_index BETWEEN 0 AND 9),
  status text NOT NULL DEFAULT 'planned'
    CHECK (status IN ('planned', 'generating', 'qc_pending', 'ready', 'needs_review', 'failed', 'unbilled')),
  generation_id text,
  lease_token text,
  lease_expires_at timestamptz,
  credits_charged integer NOT NULL DEFAULT 0 CHECK (credits_charged >= 0),
  data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_poster_carousel_slides_campaign_index
  ON poster_carousel_slides (campaign_id, slide_index);
CREATE INDEX IF NOT EXISTS idx_poster_carousel_slides_user
  ON poster_carousel_slides (user_id);
CREATE INDEX IF NOT EXISTS idx_poster_carousel_slides_generation
  ON poster_carousel_slides (generation_id);

ALTER TABLE poster_carousel_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE poster_carousel_slides ENABLE ROW LEVEL SECURITY;

-- Browser clients only ever read their own rows; all writes go through the server.
-- Drop first so a partial earlier run can be re-applied safely.
DROP POLICY IF EXISTS "Users can view own poster carousel campaigns" ON poster_carousel_campaigns;
DROP POLICY IF EXISTS "Users can view own poster carousel slides" ON poster_carousel_slides;

CREATE POLICY "Users can view own poster carousel campaigns"
  ON poster_carousel_campaigns FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view own poster carousel slides"
  ON poster_carousel_slides FOR SELECT
  USING (auth.uid() = user_id);

-- ============================================================
-- Brand Kits: a brand's own design system (logo, colours with roles,
-- fonts, rules) used to steer poster generation.
-- ============================================================
-- One user can own several kits (agencies manage multiple brands);
-- at most one kit per user is the default.
-- Accessed only from server code (service role / postgres), so RLS is on
-- with no policies and anon/authenticated have no table access.

CREATE TABLE IF NOT EXISTS public.brand_kits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  website_url text,
  is_default boolean NOT NULL DEFAULT false,
  logo jsonb,
  colors jsonb NOT NULL DEFAULT '[]'::jsonb,
  fonts jsonb NOT NULL DEFAULT '{}'::jsonb,
  guidelines jsonb NOT NULL DEFAULT '{}'::jsonb,
  extraction jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_brand_kits_user_id ON public.brand_kits (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_brand_kits_one_default_per_user
  ON public.brand_kits (user_id) WHERE is_default;

ALTER TABLE public.brand_kits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.brand_kits FROM anon, authenticated;

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

-- Staging SQL Editor uses pooled connections, so TEMP tables / pg_temp helpers
-- from earlier statements are not visible later. Keep this merge as plain CTEs.
-- Same-named kit already exists: fill only its empty identity.
WITH guideline_src AS (
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
    )
)
UPDATE public.brand_kits k
SET identity = jsonb_strip_nulls(jsonb_build_object(
      'description', left(coalesce(nullif(g.s->>'description', ''), g.s->>'business_overview', ''), 600),
      'tagline', left(coalesce(g.s->>'tagline', ''), 120),
      'industry', left(coalesce(g.s->>'industry', ''), 80),
      'offering', left(coalesce(g.s->>'offering', ''), 400),
      'audience', left(coalesce(g.s->>'audience', ''), 300),
      'valueProposition', left(coalesce(g.s->>'coreValueProp', ''), 300),
      'tone', left(coalesce(nullif(g.s->>'personality', ''), g.s->>'tone', ''), 160),
      'values', CASE WHEN jsonb_typeof(g.s->'brand_values') = 'array' THEN g.s->'brand_values' ELSE '[]'::jsonb END,
      'productCategory', g.s->>'productCategory',
      'pricePositioning', g.s->>'pricePositioning',
      'brandVoice', g.s->>'brandVoice',
      'aesthetic', CASE WHEN jsonb_typeof(g.s->'brand_aesthetic') = 'array' THEN g.s->'brand_aesthetic' END,
      'ctaPatterns', CASE WHEN jsonb_typeof(g.s->'ctaPatterns') = 'array' THEN g.s->'ctaPatterns' END
    )),
    updated_at = now()
FROM guideline_src g
WHERE k.user_id = g.user_id
  AND lower(k.name) = lower(g.name)
  AND k.identity = '{}'::jsonb;

-- No same-named kit: create one from the guideline.
WITH guideline_src AS (
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
    )
),
src AS (
  SELECT g.*
  FROM guideline_src g
  WHERE NOT EXISTS (
    SELECT 1 FROM public.brand_kits k WHERE k.user_id = g.user_id AND lower(k.name) = lower(g.name)
  )
),
hexes AS (
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
  jsonb_strip_nulls(jsonb_build_object(
    'description', left(coalesce(nullif(src.s->>'description', ''), src.s->>'business_overview', ''), 600),
    'tagline', left(coalesce(src.s->>'tagline', ''), 120),
    'industry', left(coalesce(src.s->>'industry', ''), 80),
    'offering', left(coalesce(src.s->>'offering', ''), 400),
    'audience', left(coalesce(src.s->>'audience', ''), 300),
    'valueProposition', left(coalesce(src.s->>'coreValueProp', ''), 300),
    'tone', left(coalesce(nullif(src.s->>'personality', ''), src.s->>'tone', ''), 160),
    'values', CASE WHEN jsonb_typeof(src.s->'brand_values') = 'array' THEN src.s->'brand_values' ELSE '[]'::jsonb END,
    'productCategory', src.s->>'productCategory',
    'pricePositioning', src.s->>'pricePositioning',
    'brandVoice', src.s->>'brandVoice',
    'aesthetic', CASE WHEN jsonb_typeof(src.s->'brand_aesthetic') = 'array' THEN src.s->'brand_aesthetic' END,
    'ctaPatterns', CASE WHEN jsonb_typeof(src.s->'ctaPatterns') = 'array' THEN src.s->'ctaPatterns' END
  ))
FROM src
LEFT JOIN color_json ON color_json.user_id = src.user_id;

-- ============================================================
-- Product cut-outs: cache of background-removed product photos
-- ============================================================
-- One row per (user, source image bytes). Cut-outs cost a hosted API call,
-- so every poster that reuses the same product photo reuses the cut-out.
-- Server-only: RLS on, no policies, no anon/authenticated access.

CREATE TABLE IF NOT EXISTS public.product_cutouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_hash text NOT NULL,
  source_url text,
  cutout_url text,
  storage_path text,
  width integer,
  height integer,
  provider text NOT NULL,
  ok boolean NOT NULL,
  quality jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, source_hash)
);

ALTER TABLE public.product_cutouts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.product_cutouts FROM anon, authenticated;


-- ========== 2. Storage buckets (match Live) ==========
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('Posters', 'Posters', true, null, null),
  ('Videos', 'Videos', true, null, null)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public;

UPDATE storage.buckets
SET
  file_size_limit = 209715200,
  allowed_mime_types = ARRAY[
    'image/jpeg','image/png','image/gif','image/webp','image/svg+xml',
    'video/mp4','video/webm','video/quicktime'
  ]::text[]
WHERE id = 'campaign-assets';

-- ========== 3. RLS lock (same as Live) ==========
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'app_settings',
    'ad_accounts',
    'integration_flags',
    'integrations',
    'profiles',
    'user_generated_images',
    'user_ui_state',
    'user_chats',
    'training_artifacts',
    'oauth_sessions',
    'vouchers',
    'creative_intelligence_reviews',
    'creative_intelligence_hooks',
    'creative_intelligence_strategies',
    'creative_intelligence_creatives',
    'creative_intelligence_meta_ads',
    'plan_feature_flags',
    'feature_keys',
    'creative_intelligence_facebook_pages',
    'creative_intelligence_google_ranks',
    'creative_intelligence_competitors',
    'creative_intelligence_runs',
    'creative_intelligence_brands',
    'reports',
    'marketing_audits',
    'trial_access_requests',
    'brand_kits',
    'product_cutouts',
    'content_studio_versions'
  ]
  LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon, authenticated', t);
    END IF;
  END LOOP;
END $$;

ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.integrationsbeta ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_generated_image ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.campaigns FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.integrationsbeta FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.user_generated_image FROM PUBLIC, anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.campaigns TO authenticated;
GRANT SELECT, INSERT ON TABLE public.integrationsbeta TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_generated_image TO authenticated;

DROP POLICY IF EXISTS "campaigns_owner_select" ON public.campaigns;
DROP POLICY IF EXISTS "campaigns_owner_insert" ON public.campaigns;
DROP POLICY IF EXISTS "campaigns_owner_update" ON public.campaigns;
DROP POLICY IF EXISTS "campaigns_owner_delete" ON public.campaigns;

CREATE POLICY "campaigns_owner_select" ON public.campaigns
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "campaigns_owner_insert" ON public.campaigns
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "campaigns_owner_update" ON public.campaigns
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "campaigns_owner_delete" ON public.campaigns
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "integrationsbeta_owner_select" ON public.integrationsbeta;
DROP POLICY IF EXISTS "integrationsbeta_owner_insert" ON public.integrationsbeta;

CREATE POLICY "integrationsbeta_owner_select" ON public.integrationsbeta
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "integrationsbeta_owner_insert" ON public.integrationsbeta
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "user_generated_image_owner_select" ON public.user_generated_image;
DROP POLICY IF EXISTS "user_generated_image_owner_insert" ON public.user_generated_image;
DROP POLICY IF EXISTS "user_generated_image_owner_update" ON public.user_generated_image;
DROP POLICY IF EXISTS "user_generated_image_owner_delete" ON public.user_generated_image;

CREATE POLICY "user_generated_image_owner_select" ON public.user_generated_image
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "user_generated_image_owner_insert" ON public.user_generated_image
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "user_generated_image_owner_update" ON public.user_generated_image
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "user_generated_image_owner_delete" ON public.user_generated_image
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

REVOKE EXECUTE ON FUNCTION public.decrement_credit(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.upsert_profile(uuid, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_auth_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user_credits() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.decrement_credit(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.upsert_profile(uuid, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.handle_new_auth_user() TO service_role, supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.handle_new_user_credits() TO service_role, supabase_auth_admin;
