-- Run once on production when tables ALREADY exist (additive columns only).
-- If you get: relation "public.creative_intelligence_runs" does not exist
-- use scripts/bootstrap-creative-intelligence-production.sql instead (full create).

ALTER TABLE public.creative_intelligence_runs ADD COLUMN IF NOT EXISTS comparison_insights JSONB;
ALTER TABLE public.creative_intelligence_runs ADD COLUMN IF NOT EXISTS competitor_run_ids TEXT[];

ALTER TABLE public.creative_intelligence_brands ADD COLUMN IF NOT EXISTS products JSONB;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ui_preferences JSONB DEFAULT '{}';
