-- SkalX Live package — 08 launch offer plan credits
-- Same change as: supabase/migrations/20261103120000_launch_offer_plan_credits.sql
-- MANUAL APPLY ONLY. Not wired into supabase db push / CI. Runs in one transaction.
-- Run after 06_production_plan_catalog.sql; idempotent (re-running sets the same values).
--
-- Changes ONLY image_credits, video_credits and description on the three canonical plans.
-- price_inr and razorpay_plan_id are NOT touched — existing Razorpay plans keep charging
-- the same amounts (₹4,719 / ₹8,259 / ₹15,339 incl. 18% GST).
--
-- Plan           price_inr  image  video  (capacity at 300 credits = 15s)
-- skalx_starter       3999    100   2400  120s  =  8 x 15s or 4 x 30s
-- skalx_growth        6999    250   4200  210s  = 14 x 15s or 7 x 30s
-- skalx_pro          12999    600   7800  390s  = 26 x 15s or 13 x 30s
--
-- Effect on existing subscribers: nothing changes in their current cycle. Each successful
-- Razorpay renewal provisions credits from the plans row at that moment
-- (lib/billing/subscription-entitlement.ts), so they receive the new amounts from their next
-- renewal. The subscription bucket is reset to the plan amount; add-on credits are kept.

BEGIN;

-- ============================================================
-- 0. Refuse apply unless all three plans exist at the expected prices
-- ============================================================
DO $$
DECLARE
  matching integer;
BEGIN
  SELECT count(*) INTO matching
  FROM public.plans p
  JOIN (VALUES
    ('skalx_starter', 3999),
    ('skalx_growth', 6999),
    ('skalx_pro', 12999)
  ) AS e(id, price_inr) ON e.id = p.id AND e.price_inr = p.price_inr;

  IF matching <> 3 THEN
    RAISE EXCEPTION
      'Refuse apply: expected skalx_starter/growth/pro at 3999/6999/12999, found % matching rows. Run 06_production_plan_catalog.sql first.',
      matching;
  END IF;
END $$;

-- ============================================================
-- 1. New monthly credits + descriptions (prices and Razorpay IDs untouched)
-- ============================================================
UPDATE public.plans AS p
SET
  image_credits = v.image_credits,
  video_credits = v.video_credits,
  description = v.description,
  updated_at = now()
FROM (VALUES
  ('skalx_starter', 3999, 100, 2400, '100 Image Credits and 2,400 Video Credits (120s capacity) per month'),
  ('skalx_growth', 6999, 250, 4200, '250 Image Credits and 4,200 Video Credits (210s capacity) per month'),
  ('skalx_pro', 12999, 600, 7800, '600 Image Credits and 7,800 Video Credits (390s capacity) per month')
) AS v(id, price_inr, image_credits, video_credits, description)
WHERE p.id = v.id
  AND p.price_inr = v.price_inr;

-- ============================================================
-- 2. Verify before commit
-- ============================================================
DO $$
DECLARE
  ok_rows integer;
BEGIN
  SELECT count(*) INTO ok_rows
  FROM public.plans p
  JOIN (VALUES
    ('skalx_starter', 3999, 100, 2400),
    ('skalx_growth', 6999, 250, 4200),
    ('skalx_pro', 12999, 600, 7800)
  ) AS e(id, price_inr, image_credits, video_credits)
    ON e.id = p.id
   AND e.price_inr = p.price_inr
   AND e.image_credits = p.image_credits
   AND e.video_credits = p.video_credits;

  IF ok_rows <> 3 THEN
    RAISE EXCEPTION 'Launch offer credits not applied to all three plans (% of 3); rolling back.', ok_rows;
  END IF;
END $$;

COMMIT;

-- Rollback (restores the previous credits; prices/IDs were never changed):
-- BEGIN;
-- UPDATE public.plans SET image_credits = 50,  video_credits = 1200, description = '50 Image Credits and 1,200 Video Credits (60s capacity) per month',  updated_at = now() WHERE id = 'skalx_starter';
-- UPDATE public.plans SET image_credits = 150, video_credits = 2400, description = '150 Image Credits and 2,400 Video Credits (120s capacity) per month', updated_at = now() WHERE id = 'skalx_growth';
-- UPDATE public.plans SET image_credits = 300, video_credits = 4800, description = '300 Image Credits and 4,800 Video Credits (240s capacity) per month', updated_at = now() WHERE id = 'skalx_pro';
-- COMMIT;
