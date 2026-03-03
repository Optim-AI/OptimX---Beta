-- Facebook Business Page and Google Rank Tracking data for Creative Intelligence

-- Facebook Business Page details (brand + competitors)
CREATE TABLE IF NOT EXISTS public.creative_intelligence_facebook_pages (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    run_id uuid NOT NULL REFERENCES public.creative_intelligence_runs(id) ON DELETE CASCADE,
    source text NOT NULL, -- 'brand' | 'competitor'
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

-- Google Rank Tracking results (brand + competitor visibility)
CREATE TABLE IF NOT EXISTS public.creative_intelligence_google_ranks (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    run_id uuid NOT NULL REFERENCES public.creative_intelligence_runs(id) ON DELETE CASCADE,
    search_query text NOT NULL,
    brand_domain text,
    brand_position integer,
    competitor_ranks jsonb, -- [{domain, position, title, link}]
    organic_results jsonb,
    created_at timestamptz DEFAULT now(),
    CONSTRAINT creative_intelligence_google_ranks_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_creative_intelligence_google_ranks_run_id ON public.creative_intelligence_google_ranks(run_id);
