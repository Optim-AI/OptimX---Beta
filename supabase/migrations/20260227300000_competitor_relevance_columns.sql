-- Add relevance scoring columns to creative_intelligence_competitors
ALTER TABLE public.creative_intelligence_competitors
  ADD COLUMN IF NOT EXISTS relevance_score integer,
  ADD COLUMN IF NOT EXISTS industry_match_confidence text,
  ADD COLUMN IF NOT EXISTS keyword_overlap_score integer;
