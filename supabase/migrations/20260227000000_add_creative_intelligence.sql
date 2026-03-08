-- Creative Intelligence tables
-- Stores brand analysis, competitors, review insights, hooks, strategies, and generated creatives

-- creative_intelligence_runs: Top-level run record
CREATE TABLE IF NOT EXISTS public.creative_intelligence_runs (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    brand_url text NOT NULL,
    competitor_urls text[],
    industry text,
    target_audience text,
    campaign_goal text,
    advanced_settings jsonb,
    status text NOT NULL DEFAULT 'pending', -- pending, running, completed, failed
    progress_step integer DEFAULT 0,
    progress_message text,
    error_message text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    CONSTRAINT creative_intelligence_runs_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_creative_intelligence_runs_user_id ON public.creative_intelligence_runs(user_id);
CREATE INDEX IF NOT EXISTS idx_creative_intelligence_runs_created_at ON public.creative_intelligence_runs(created_at DESC);

-- creative_intelligence_brands: Stage 1 output
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

-- creative_intelligence_competitors: Stage 2 output
CREATE TABLE IF NOT EXISTS public.creative_intelligence_competitors (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    run_id uuid NOT NULL REFERENCES public.creative_intelligence_runs(id) ON DELETE CASCADE,
    name text,
    domain text,
    core_positioning text,
    primary_hook text,
    pricing_tier text,
    weakness_detected text,
    saturation_level text, -- high, moderate, low
    raw_data jsonb,
    created_at timestamptz DEFAULT now(),
    CONSTRAINT creative_intelligence_competitors_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_creative_intelligence_competitors_run_id ON public.creative_intelligence_competitors(run_id);

-- creative_intelligence_reviews: Stage 3 output (clustered insights)
CREATE TABLE IF NOT EXISTS public.creative_intelligence_reviews (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    run_id uuid NOT NULL REFERENCES public.creative_intelligence_runs(id) ON DELETE CASCADE,
    cluster_type text NOT NULL, -- pain_points, desired_outcomes, emotional_patterns, complaints
    cluster_label text,
    frequency_pct numeric,
    sample_phrases jsonb,
    raw_clusters jsonb,
    created_at timestamptz DEFAULT now(),
    CONSTRAINT creative_intelligence_reviews_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_creative_intelligence_reviews_run_id ON public.creative_intelligence_reviews(run_id);

-- creative_intelligence_hooks: Stage 4 output
CREATE TABLE IF NOT EXISTS public.creative_intelligence_hooks (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    run_id uuid NOT NULL REFERENCES public.creative_intelligence_runs(id) ON DELETE CASCADE,
    hook_statement text NOT NULL,
    hook_type text, -- emotional, performance
    why_it_works text,
    supporting_review_phrase text,
    competitor_overlap_level text, -- high, moderate, low
    confidence_score integer,
    rank integer,
    created_at timestamptz DEFAULT now(),
    CONSTRAINT creative_intelligence_hooks_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_creative_intelligence_hooks_run_id ON public.creative_intelligence_hooks(run_id);

-- creative_intelligence_strategies: Market opportunities
CREATE TABLE IF NOT EXISTS public.creative_intelligence_strategies (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    run_id uuid NOT NULL REFERENCES public.creative_intelligence_runs(id) ON DELETE CASCADE,
    strategy_type text, -- underserved_angles, white_space, differentiation
    content jsonb NOT NULL,
    created_at timestamptz DEFAULT now(),
    CONSTRAINT creative_intelligence_strategies_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_creative_intelligence_strategies_run_id ON public.creative_intelligence_strategies(run_id);

-- creative_intelligence_creatives: Generated assets from hook selection
CREATE TABLE IF NOT EXISTS public.creative_intelligence_creatives (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    run_id uuid NOT NULL REFERENCES public.creative_intelligence_runs(id) ON DELETE CASCADE,
    hook_id uuid REFERENCES public.creative_intelligence_hooks(id) ON DELETE SET NULL,
    creative_type text NOT NULL, -- ad_concept, reel_script_15s, reel_script_30s, headline, cta, visual_direction
    content jsonb NOT NULL,
    created_at timestamptz DEFAULT now(),
    CONSTRAINT creative_intelligence_creatives_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_creative_intelligence_creatives_run_id ON public.creative_intelligence_creatives(run_id);
CREATE INDEX IF NOT EXISTS idx_creative_intelligence_creatives_hook_id ON public.creative_intelligence_creatives(hook_id);
