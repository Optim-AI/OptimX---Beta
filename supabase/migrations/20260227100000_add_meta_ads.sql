-- Meta Ad Library ads for Creative Intelligence
-- Stores ads fetched from Meta Ad Library (via SearchAPI) for brand/competitor analysis

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
