-- Run this in Supabase Dashboard > SQL Editor if creative_intelligence_facebook_pages does not exist
-- Creates: creative_intelligence_meta_ads, creative_intelligence_facebook_pages, creative_intelligence_google_ranks

-- Meta Ad Library ads
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

-- Facebook Business Page details
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
    rating numeric,
    reviews_count integer,
    price_range text,
    profile_photo_url text,
    raw_data jsonb,
    created_at timestamptz DEFAULT now(),
    CONSTRAINT creative_intelligence_facebook_pages_pkey PRIMARY KEY (id)
);
CREATE INDEX IF NOT EXISTS idx_creative_intelligence_facebook_pages_run_id ON public.creative_intelligence_facebook_pages(run_id);

-- Google Rank Tracking results
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

-- Competitor relevance columns (if not already applied)
ALTER TABLE public.creative_intelligence_competitors
  ADD COLUMN IF NOT EXISTS relevance_score integer,
  ADD COLUMN IF NOT EXISTS industry_match_confidence text,
  ADD COLUMN IF NOT EXISTS keyword_overlap_score integer;
