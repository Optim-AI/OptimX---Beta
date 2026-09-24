-- Replace obsolete subscription plan catalog with SkalX Starter / Growth / Pro
-- Date: 2026-03-25
--
-- SAFE for Staging/Live:
-- - Does NOT DELETE obsolete plan rows (preserves FK integrity if subscriptions reference them)
-- - Deactivates obsolete plans (is_active = false)
-- - Inserts three new canonical monthly plans with explicit Video Credits (no ×20 conversion)
--
-- Does NOT:
-- - grant subscription credits
-- - create subscription_cycles
-- - migrate wallet balances
-- - modify app_settings / credit_pricing
-- - create Razorpay plans (IDs mapped below are TEST plans billed at price_inr + 18% GST)

-- ============================================================
-- 1. Deactivate obsolete plans (keep rows for history / FKs)
-- ============================================================
UPDATE public.plans
SET is_active = false,
    updated_at = now()
WHERE id IN (
  'free_trial',
  'basic_monthly',
  'basic_quarterly',
  'starter_monthly',
  'starter_quarterly',
  'lite_growth_monthly',
  'lite_growth_quarterly',
  'growth_pro_monthly',
  'growth_pro_quarterly'
);

-- Explicit free-trial deactivation (same UPDATE set; documented for clarity)
UPDATE public.plans
SET is_active = false,
    updated_at = now()
WHERE id = 'free_trial';

-- ============================================================
-- 2. Insert canonical SkalX monthly plans
-- ============================================================
INSERT INTO public.plans (
  id,
  name,
  slug,
  description,
  billing_cycle,
  price_inr,
  image_credits,
  video_credits,
  razorpay_plan_id,
  is_active,
  display_order,
  created_at,
  updated_at
) VALUES
(
  'skalx_starter',
  'SkalX Starter',
  'skalx-starter',
  '50 Image Credits and 1,200 Video Credits (60s capacity) per month',
  'monthly',
  3999,
  50,
  1200,
  'plan_TfW39qLbzDnjH5',
  true,
  1,
  now(),
  now()
),
(
  'skalx_growth',
  'SkalX Growth',
  'skalx-growth',
  '150 Image Credits and 2,400 Video Credits (120s capacity) per month',
  'monthly',
  6999,
  150,
  2400,
  'plan_TfW3A8Q8VTSzmC',
  true,
  2,
  now(),
  now()
),
(
  'skalx_pro',
  'SkalX Pro',
  'skalx-pro',
  '300 Image Credits and 4,800 Video Credits (240s capacity) per month',
  'monthly',
  12999,
  300,
  4800,
  'plan_TfW3APs8puFarI',
  true,
  3,
  now(),
  now()
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  slug = EXCLUDED.slug,
  description = EXCLUDED.description,
  billing_cycle = EXCLUDED.billing_cycle,
  price_inr = EXCLUDED.price_inr,
  image_credits = EXCLUDED.image_credits,
  video_credits = EXCLUDED.video_credits,
  razorpay_plan_id = EXCLUDED.razorpay_plan_id,
  is_active = true,
  display_order = EXCLUDED.display_order,
  updated_at = now();

-- ============================================================
-- 3. Feature flags for new plans (do not modify old plan flags)
-- Tier progression based on generation capabilities:
--   Starter  = core image/video + watermark removal + standard fast queue
--   Growth   = Starter + social coming soon
--   Pro      = Growth + priority queue + more coming-soon analytics/scheduling
-- ============================================================

-- SkalX Starter
INSERT INTO public.plan_feature_flags (plan_id, feature_key, is_enabled, is_coming_soon) VALUES
('skalx_starter', 'image_generation', true, false),
('skalx_starter', 'video_generation', true, false),
('skalx_starter', 'no_watermark', true, false),
('skalx_starter', 'fast_generation', true, false),
('skalx_starter', 'priority_generation', false, false),
('skalx_starter', 'basic_analytics', false, true),
('skalx_starter', 'advanced_analytics', false, true),
('skalx_starter', 'social_posting', false, false),
('skalx_starter', 'auto_scheduling', false, false),
('skalx_starter', 'brand_analysis', false, false),
('skalx_starter', 'competitive_analysis', false, false),
('skalx_starter', 'dashboard', false, false),
('skalx_starter', 'integrations', false, false),
('skalx_starter', 'create_campaigns', false, false),
('skalx_starter', 'campaign_library', false, false)
ON CONFLICT (plan_id, feature_key) DO NOTHING;

-- SkalX Growth
INSERT INTO public.plan_feature_flags (plan_id, feature_key, is_enabled, is_coming_soon) VALUES
('skalx_growth', 'image_generation', true, false),
('skalx_growth', 'video_generation', true, false),
('skalx_growth', 'no_watermark', true, false),
('skalx_growth', 'fast_generation', true, false),
('skalx_growth', 'priority_generation', false, false),
('skalx_growth', 'basic_analytics', false, true),
('skalx_growth', 'advanced_analytics', false, true),
('skalx_growth', 'social_posting', false, true),
('skalx_growth', 'auto_scheduling', false, false),
('skalx_growth', 'brand_analysis', false, false),
('skalx_growth', 'competitive_analysis', false, false),
('skalx_growth', 'dashboard', false, false),
('skalx_growth', 'integrations', false, false),
('skalx_growth', 'create_campaigns', false, false),
('skalx_growth', 'campaign_library', false, false)
ON CONFLICT (plan_id, feature_key) DO NOTHING;

-- SkalX Pro
INSERT INTO public.plan_feature_flags (plan_id, feature_key, is_enabled, is_coming_soon) VALUES
('skalx_pro', 'image_generation', true, false),
('skalx_pro', 'video_generation', true, false),
('skalx_pro', 'no_watermark', true, false),
('skalx_pro', 'fast_generation', true, false),
('skalx_pro', 'priority_generation', true, false),
('skalx_pro', 'basic_analytics', false, true),
('skalx_pro', 'advanced_analytics', false, true),
('skalx_pro', 'social_posting', false, true),
('skalx_pro', 'auto_scheduling', false, true),
('skalx_pro', 'brand_analysis', false, true),
('skalx_pro', 'competitive_analysis', false, true),
('skalx_pro', 'dashboard', false, false),
('skalx_pro', 'integrations', false, false),
('skalx_pro', 'create_campaigns', false, false),
('skalx_pro', 'campaign_library', false, false)
ON CONFLICT (plan_id, feature_key) DO NOTHING;

COMMENT ON COLUMN public.plans.video_credits IS
  'SkalX Video Credits per billing period (100 credits = 5 seconds capacity).';
