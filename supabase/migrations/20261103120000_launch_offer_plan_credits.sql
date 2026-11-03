-- Launch offer: more monthly credits on the three canonical SkalX plans.
--
-- Changes ONLY image_credits, video_credits and description. Prices (price_inr) and
-- razorpay_plan_id are untouched, so existing Razorpay subscriptions keep charging the same.
--
-- Plan           price_inr  image  video  (capacity at 300 credits = 15s)
-- skalx_starter       3999    100   2400  120s  =  8 x 15s or 4 x 30s
-- skalx_growth        6999    250   4200  210s  = 14 x 15s or 7 x 30s
-- skalx_pro          12999    600   7800  390s  = 26 x 15s or 13 x 30s
--
-- Effect on existing subscribers: credits are granted per successful Razorpay charge from
-- the plans row at that moment (lib/billing/subscription-entitlement.ts), resetting the
-- subscription bucket and keeping add-on credits. Current balances are not changed; each
-- subscriber gets the new amounts from their next successful renewal.

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
