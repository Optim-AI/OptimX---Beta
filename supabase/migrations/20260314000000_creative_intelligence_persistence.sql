-- Creative Intelligence: Session Persistence, Product Storage, UI Preferences
-- 1. Add comparison_insights and competitor_run_ids to creative_intelligence_runs
ALTER TABLE creative_intelligence_runs ADD COLUMN IF NOT EXISTS comparison_insights JSONB;
ALTER TABLE creative_intelligence_runs ADD COLUMN IF NOT EXISTS competitor_run_ids TEXT[];

-- 2. Add products to creative_intelligence_brands
ALTER TABLE creative_intelligence_brands ADD COLUMN IF NOT EXISTS products JSONB;

-- 3. Add ui_preferences to profiles for guideline_seen, etc.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS ui_preferences JSONB DEFAULT '{}';
