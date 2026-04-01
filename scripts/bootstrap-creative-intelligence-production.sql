-- =============================================================================
-- Creative Intelligence — full bootstrap for PRODUCTION (Supabase SQL Editor)
-- Use this when: relation "public.creative_intelligence_runs" does not exist
-- Safe to re-run: CREATE IF NOT EXISTS + ADD COLUMN IF NOT EXISTS
-- =============================================================================

-- 1) Core run + child tables
CREATE TABLE IF NOT EXISTS public.creative_intelligence_runs (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    brand_url text NOT NULL,
    competitor_urls text[],
    industry text,
    target_audience text,
    campaign_goal text,
    advanced_settings jsonb,
    status text NOT NULL DEFAULT 'pending',
    progress_step integer DEFAULT 0,
    progress_message text,
    error_message text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    CONSTRAINT creative_intelligence_runs_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_creative_intelligence_runs_user_id ON public.creative_intelligence_runs(user_id);
CREATE INDEX IF NOT EXISTS idx_creative_intelligence_runs_created_at ON public.creative_intelligence_runs(created_at DESC);

CREATE TABLE IF NOT EXISTS public.creative_intelligence_brands (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    run_id uuid NOT NULL REFERENCES public.creative_intelligence_runs(id) ON DELETE CASCADE,
    product_summary text,
    positioning_statement text,
    core_pains_addressed jsonb,
    emotional_tone text,
    target_persona_guess text,
    raw_analysis jsonb,
    created_at timestamptz DEFAULT now(),
    CONSTRAINT creative_intelligence_brands_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_creative_intelligence_brands_run_id ON public.creative_intelligence_brands(run_id);

CREATE TABLE IF NOT EXISTS public.creative_intelligence_competitors (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    run_id uuid NOT NULL REFERENCES public.creative_intelligence_runs(id) ON DELETE CASCADE,
    name text,
    domain text,
    core_positioning text,
    primary_hook text,
    pricing_tier text,
    weakness_detected text,
    saturation_level text,
    raw_data jsonb,
    created_at timestamptz DEFAULT now(),
    CONSTRAINT creative_intelligence_competitors_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_creative_intelligence_competitors_run_id ON public.creative_intelligence_competitors(run_id);

CREATE TABLE IF NOT EXISTS public.creative_intelligence_reviews (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    run_id uuid NOT NULL REFERENCES public.creative_intelligence_runs(id) ON DELETE CASCADE,
    cluster_type text NOT NULL,
    cluster_label text,
    frequency_pct integer,
    sample_phrases jsonb,
    raw_clusters jsonb,
    created_at timestamptz DEFAULT now(),
    CONSTRAINT creative_intelligence_reviews_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_creative_intelligence_reviews_run_id ON public.creative_intelligence_reviews(run_id);

CREATE TABLE IF NOT EXISTS public.creative_intelligence_hooks (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    run_id uuid NOT NULL REFERENCES public.creative_intelligence_runs(id) ON DELETE CASCADE,
    hook_statement text NOT NULL,
    hook_type text,
    why_it_works text,
    supporting_review_phrase text,
    competitor_overlap_level text,
    confidence_score integer,
    rank integer,
    created_at timestamptz DEFAULT now(),
    CONSTRAINT creative_intelligence_hooks_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_creative_intelligence_hooks_run_id ON public.creative_intelligence_hooks(run_id);

CREATE TABLE IF NOT EXISTS public.creative_intelligence_strategies (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    run_id uuid NOT NULL REFERENCES public.creative_intelligence_runs(id) ON DELETE CASCADE,
    strategy_type text,
    content jsonb NOT NULL,
    created_at timestamptz DEFAULT now(),
    CONSTRAINT creative_intelligence_strategies_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_creative_intelligence_strategies_run_id ON public.creative_intelligence_strategies(run_id);

CREATE TABLE IF NOT EXISTS public.creative_intelligence_creatives (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    run_id uuid NOT NULL REFERENCES public.creative_intelligence_runs(id) ON DELETE CASCADE,
    hook_id uuid REFERENCES public.creative_intelligence_hooks(id) ON DELETE SET NULL,
    creative_type text NOT NULL,
    content jsonb NOT NULL,
    created_at timestamptz DEFAULT now(),
    CONSTRAINT creative_intelligence_creatives_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_creative_intelligence_creatives_run_id ON public.creative_intelligence_creatives(run_id);
CREATE INDEX IF NOT EXISTS idx_creative_intelligence_creatives_hook_id ON public.creative_intelligence_creatives(hook_id);

-- 2) Meta / Facebook / Google intel (depends on runs)
CREATE TABLE IF NOT EXISTS public.creative_intelligence_meta_ads (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    run_id uuid NOT NULL REFERENCES public.creative_intelligence_runs(id) ON DELETE CASCADE,
    search_keyword text NOT NULL,
    page_name text,
    page_id text,
    body_text text,
    cta_text text,
    cta_type text,
    display_format text,
    platforms text[],
    image_url text,
    raw_data jsonb,
    created_at timestamptz DEFAULT now(),
    CONSTRAINT creative_intelligence_meta_ads_pkey PRIMARY KEY (id)
);
CREATE INDEX IF NOT EXISTS idx_creative_intelligence_meta_ads_run_id ON public.creative_intelligence_meta_ads(run_id);

CREATE TABLE IF NOT EXISTS public.creative_intelligence_facebook_pages (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    run_id uuid NOT NULL REFERENCES public.creative_intelligence_runs(id) ON DELETE CASCADE,
    source text NOT NULL,
    entity_name text,
    page_id text,
    page_name text,
    page_link text,
    followers_count integer,
    following_count integer,
    category text,
    address text,
    phone text,
    website text,
    ratings text,
    rating integer,
    reviews_count integer,
    price_range text,
    profile_photo_url text,
    raw_data jsonb,
    created_at timestamptz DEFAULT now(),
    CONSTRAINT creative_intelligence_facebook_pages_pkey PRIMARY KEY (id)
);
CREATE INDEX IF NOT EXISTS idx_creative_intelligence_facebook_pages_run_id ON public.creative_intelligence_facebook_pages(run_id);

CREATE TABLE IF NOT EXISTS public.creative_intelligence_google_ranks (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    run_id uuid NOT NULL REFERENCES public.creative_intelligence_runs(id) ON DELETE CASCADE,
    search_query text NOT NULL,
    brand_domain text,
    brand_position integer,
    competitor_ranks jsonb,
    organic_results jsonb,
    created_at timestamptz DEFAULT now(),
    CONSTRAINT creative_intelligence_google_ranks_pkey PRIMARY KEY (id)
);
CREATE INDEX IF NOT EXISTS idx_creative_intelligence_google_ranks_run_id ON public.creative_intelligence_google_ranks(run_id);

-- 3) Competitor scoring columns (additive)
ALTER TABLE public.creative_intelligence_competitors
  ADD COLUMN IF NOT EXISTS relevance_score integer,
  ADD COLUMN IF NOT EXISTS industry_match_confidence text,
  ADD COLUMN IF NOT EXISTS keyword_overlap_score integer;

-- 4) Persistence / UI extras (additive)
ALTER TABLE public.creative_intelligence_runs ADD COLUMN IF NOT EXISTS comparison_insights JSONB;
ALTER TABLE public.creative_intelligence_runs ADD COLUMN IF NOT EXISTS competitor_run_ids TEXT[];

ALTER TABLE public.creative_intelligence_brands ADD COLUMN IF NOT EXISTS products JSONB;

-- Requires public.profiles (standard Supabase). Skip if you use a different schema.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ui_preferences JSONB DEFAULT '{}';
