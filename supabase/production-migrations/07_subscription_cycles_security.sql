-- Phase 12.5 Live package — 07 subscription_cycles security
-- MANUAL APPLY ONLY. Not wired into supabase db push / CI.
--
-- The LOCAL subscription_cycles migration does not enable RLS.
-- Live currently has broad anon/authenticated grants on billing tables,
-- so this file must run immediately after 03_subscription_cycles.sql
-- (and after 02 foundation RLS pattern is established).
--
-- Pattern matches 02_billing_foundation.sql:
-- - ENABLE ROW LEVEL SECURITY
-- - REVOKE ALL from anon + authenticated
-- - Do NOT FORCE ROW LEVEL SECURITY
-- - No browser policies (app has no client access to this table)

ALTER TABLE public.subscription_cycles ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.subscription_cycles FROM anon, authenticated;

COMMENT ON TABLE public.subscription_cycles IS
  'One row per successful Razorpay subscription charge. Idempotent entitlement ledger. Server/service_role only; no browser policies.';
