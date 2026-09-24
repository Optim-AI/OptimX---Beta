-- Phase 12.5 Live package — 06 production plan catalog
-- Adapted from: supabase/migrations/20260325200000_replace_subscription_plan_catalog.sql
-- MANUAL APPLY ONLY. Not wired into supabase db push / CI.
--
-- IMPORTANT:
-- - Do NOT use TEST Razorpay IDs (plan_TfW*).
-- - Substitute Live IDs for the three placeholders below before apply.
-- - Guard below raises if any placeholder remains.
--
-- Placeholders (replace in this file before applying):
--   plan_TfpbnCz0xrYHt
--   plan_Tfpbym09ti8H5x
--   plan_Tfpd6nPP5kdPx2
--
-- Plan IDs (canonical, preserve):
--   skalx_starter / skalx_growth / skalx_pro
-- Slugs (repo source of truth):
--   skalx-starter / skalx-growth / skalx-pro

-- ============================================================
-- 0. Refuse apply while Live Razorpay placeholders remain
-- ============================================================
DO $$
DECLARE
  starter_id text := 'plan_TfpbnCz0xrYHt';
  growth_id text := 'plan_Tfpbym09ti8H5x';
  pro_id text := 'plan_Tfpd6nPP5kdPx2';
BEGIN
  IF starter_id LIKE '%<%'
     OR starter_id LIKE '%>%'
     OR starter_id LIKE '%LIVE_RAZORPAY%'
     OR growth_id LIKE '%<%'
     OR growth_id LIKE '%>%'
     OR growth_id LIKE '%LIVE_RAZORPAY%'
     OR pro_id LIKE '%<%'
     OR pro_id LIKE '%>%'
     OR pro_id LIKE '%LIVE_RAZORPAY%'
  THEN
    RAISE EXCEPTION
      'Refuse apply: replace <LIVE_RAZORPAY_PLAN_ID_STARTER|GROWTH|PRO> with real Live Razorpay plan IDs before running 06_production_plan_catalog.sql';
  END IF;

  IF starter_id LIKE 'plan_TfW%'
     OR growth_id LIKE 'plan_TfW%'
     OR pro_id LIKE 'plan_TfW%'
  THEN
    RAISE EXCEPTION
      'Refuse apply: TEST Razorpay plan IDs (plan_TfW*) must not be used on Live';
  END IF;

  IF starter_id IS NULL OR btrim(starter_id) = ''
     OR growth_id IS NULL OR btrim(growth_id) = ''
     OR pro_id IS NULL OR btrim(pro_id) = ''
  THEN
    RAISE EXCEPTION 'Refuse apply: Live Razorpay plan IDs must be non-empty';
  END IF;

  IF starter_id = growth_id OR starter_id = pro_id OR growth_id = pro_id THEN
    RAISE EXCEPTION 'Refuse apply: Live Razorpay plan IDs must be distinct';
  END IF;
END $$;

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

UPDATE public.plans
SET is_active = false,
    updated_at = now()
WHERE id = 'free_trial';

-- ============================================================
-- 2. Upsert canonical SkalX monthly plans (no duplicate IDs)
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
  'plan_TfpbnCz0xrYHt',
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
  'plan_Tfpbym09ti8H5x',
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
  'plan_Tfpd6nPP5kdPx2',
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
-- 3. Feature flags for canonical plans (do not modify old flags)
-- Live feature_keys already include all keys referenced below.
-- ============================================================

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
