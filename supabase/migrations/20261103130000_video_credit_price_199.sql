-- Video add-on (PAYG) price: ₹699 → ₹199 per 100 Video Credits, before GST.
--
-- The new default lives in code (lib/billing/video-credits.ts VIDEO_CREDIT_BLOCK_PRICE_INR).
-- An admin-saved app_settings.credit_pricing row overrides that default at checkout
-- (lib/billing/pricing.server.ts), so update any saved video price to match.
-- Image pricing, minimum (600), step (300) and GST are untouched.
-- Past payments are not touched: each payment row keeps the amount it was charged.

UPDATE public.app_settings
SET
  value = jsonb_set(value, '{videoCreditBlockPriceInr}', '199'::jsonb),
  updated_at = now()
WHERE key = 'credit_pricing'
  AND jsonb_typeof(value) = 'object'
  AND value ? 'videoCreditBlockPriceInr'
  AND value->'videoCreditBlockPriceInr' IS DISTINCT FROM '199'::jsonb;
