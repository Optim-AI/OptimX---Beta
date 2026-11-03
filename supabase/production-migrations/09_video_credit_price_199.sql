-- SkalX Live package — 09 video add-on price ₹199 per 100 Video Credits
-- Same change as: supabase/migrations/20261103130000_video_credit_price_199.sql
-- MANUAL APPLY ONLY. Not wired into supabase db push / CI. Runs in one transaction. Idempotent.
--
-- The ₹199 default ships in code (VIDEO_CREDIT_BLOCK_PRICE_INR). A saved admin
-- app_settings.credit_pricing row overrides it at checkout, so this sets any saved
-- videoCreditBlockPriceInr to 199. If no row exists, nothing changes (code default applies).
-- Untouched: imageCreditPriceInr, minimum 600 credits, 300-credit step, GST, payments history.
-- Deploy the code and run this together.

BEGIN;

-- Show what is saved before the change (for the change log).
DO $$
DECLARE
  saved jsonb;
BEGIN
  SELECT value INTO saved FROM public.app_settings WHERE key = 'credit_pricing';
  IF saved IS NULL THEN
    RAISE NOTICE 'credit_pricing: no saved row — code default (₹199) applies; nothing to update.';
  ELSE
    RAISE NOTICE 'credit_pricing before: %', saved;
  END IF;
END $$;

UPDATE public.app_settings
SET
  value = jsonb_set(value, '{videoCreditBlockPriceInr}', '199'::jsonb),
  updated_at = now()
WHERE key = 'credit_pricing'
  AND jsonb_typeof(value) = 'object'
  AND value ? 'videoCreditBlockPriceInr'
  AND value->'videoCreditBlockPriceInr' IS DISTINCT FROM '199'::jsonb;

-- Verify before commit: a saved video price, if any, must now be 199.
DO $$
DECLARE
  saved jsonb;
BEGIN
  SELECT value INTO saved FROM public.app_settings WHERE key = 'credit_pricing';
  IF saved IS NOT NULL
     AND saved ? 'videoCreditBlockPriceInr'
     AND saved->'videoCreditBlockPriceInr' IS DISTINCT FROM '199'::jsonb THEN
    RAISE EXCEPTION 'credit_pricing.videoCreditBlockPriceInr is % after update; rolling back.',
      saved->'videoCreditBlockPriceInr';
  END IF;
  RAISE NOTICE 'credit_pricing after: %', saved;
END $$;

COMMIT;

-- Rollback (restore the previous ₹699 only if it was saved before):
-- UPDATE public.app_settings
-- SET value = jsonb_set(value, '{videoCreditBlockPriceInr}', '699'::jsonb), updated_at = now()
-- WHERE key = 'credit_pricing' AND value ? 'videoCreditBlockPriceInr';
