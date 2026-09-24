-- Phase 1 billing foundation gap closure
-- Date: 2026-03-25
--
-- DO NOT APPLY AUTOMATICALLY TO PRODUCTION.
-- Review, run duplicate pre-checks, then apply in a controlled window.
--
-- Why:
-- 1) Unique non-null razorpay_payment_id → subscription.charged cannot duplicate payments
-- 2) subscriptions.status CHECK must allow 'pending' (app already uses it)
-- 3) generation_job_locks → cross-instance commercial generation idempotency
-- 4) unique active reservation per (user, reference_id)
-- 5) RLS hardening for billing tables (service_role bypasses RLS in Supabase)
--
-- Affected tables:
--   payments, subscriptions, credit_reservations, generation_job_locks (new),
--   user_credits, credit_history, webhook_events, plans, credit_packs
--
-- Backward compatible:
--   - Additive indexes/tables and CHECK expansion are backward compatible
--   - RLS enable may break client direct writes (intentional); SELECT on own
--     user_credits is preserved for existing navBar reads
--
-- Rollback:
--   DROP INDEX idx_payments_razorpay_payment_id_unique;
--   DROP INDEX idx_credit_reservations_active_reference;
--   DROP TABLE generation_job_locks;
--   Restore prior subscriptions status CHECK (remove 'pending');
--   DISABLE ROW LEVEL SECURITY on listed tables / drop policies
--
-- PRE-CHECK (run before unique index — abort if any rows):
--   SELECT razorpay_payment_id, COUNT(*) AS c
--   FROM public.payments
--   WHERE razorpay_payment_id IS NOT NULL
--   GROUP BY razorpay_payment_id
--   HAVING COUNT(*) > 1;
--
-- PRE-CHECK pending status usage:
--   SELECT COUNT(*) FROM public.subscriptions WHERE status = 'pending';

-- ============================================================
-- 1. payments: unique razorpay_payment_id (non-null)
-- ============================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.payments
    WHERE razorpay_payment_id IS NOT NULL
    GROUP BY razorpay_payment_id
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Duplicate razorpay_payment_id values exist in payments. Resolve before applying idx_payments_razorpay_payment_id_unique.';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_razorpay_payment_id_unique
  ON public.payments (razorpay_payment_id)
  WHERE razorpay_payment_id IS NOT NULL;

-- ============================================================
-- 2. subscriptions.status: allow pending
-- ============================================================
DO $$
DECLARE
  conname text;
BEGIN
  SELECT c.conname INTO conname
  FROM pg_constraint c
  JOIN pg_class t ON c.conrelid = t.oid
  JOIN pg_namespace n ON t.relnamespace = n.oid
  WHERE n.nspname = 'public'
    AND t.relname = 'subscriptions'
    AND c.contype = 'c'
    AND pg_get_constraintdef(c.oid) ILIKE '%status%';

  IF conname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.subscriptions DROP CONSTRAINT %I', conname);
  END IF;
END $$;

ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_status_check
  CHECK (status IN ('pending', 'trialing', 'active', 'cancelled', 'expired', 'past_due'));

-- ============================================================
-- 3. generation_job_locks
-- ============================================================
CREATE TABLE IF NOT EXISTS public.generation_job_locks (
  lock_key text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('in_progress', 'completed', 'failed')),
  reservation_id uuid,
  result_summary jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_generation_job_locks_user
  ON public.generation_job_locks (user_id);
CREATE INDEX IF NOT EXISTS idx_generation_job_locks_status
  ON public.generation_job_locks (status);

-- ============================================================
-- 4. One active reservation per logical reference
-- ============================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.credit_reservations
    WHERE status = 'reserved' AND reference_id IS NOT NULL
    GROUP BY user_id, reference_id
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Duplicate active credit_reservations for same (user_id, reference_id). Resolve before unique index.';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_credit_reservations_active_reference
  ON public.credit_reservations (user_id, reference_id)
  WHERE status = 'reserved' AND reference_id IS NOT NULL;

-- ============================================================
-- 5. RLS — deny client writes on billing tables
--    service_role bypasses RLS; DATABASE_URL / postgres owner also bypasses
--    unless FORCE ROW LEVEL SECURITY (we do NOT force).
--
-- Production RLS state cannot be fully verified from repository code alone.
-- After apply, confirm in Supabase Dashboard → Authentication/Policies:
--   - RLS enabled on tables below
--   - No INSERT/UPDATE/DELETE policies for anon/authenticated on billing tables
--   - user_credits SELECT limited to auth.uid() = id
-- ============================================================

ALTER TABLE public.user_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generation_job_locks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_packs ENABLE ROW LEVEL SECURITY;

-- Drop prior policies if re-applying
DROP POLICY IF EXISTS "users_select_own_credits" ON public.user_credits;
DROP POLICY IF EXISTS "users_select_active_plans" ON public.plans;
DROP POLICY IF EXISTS "users_select_active_credit_packs" ON public.credit_packs;

-- Own balance read (navBar / client still selects credits column)
CREATE POLICY "users_select_own_credits"
  ON public.user_credits
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Public catalog reads
CREATE POLICY "users_select_active_plans"
  ON public.plans
  FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY "users_select_active_credit_packs"
  ON public.credit_packs
  FOR SELECT
  TO authenticated
  USING (is_active = true);

-- No INSERT/UPDATE/DELETE policies for authenticated/anon on billing tables:
-- with RLS enabled, missing policies deny those operations.
-- Explicitly revoke dangerous table grants for anon (defense in depth).
REVOKE INSERT, UPDATE, DELETE ON public.user_credits FROM anon, authenticated;
REVOKE ALL ON public.credit_history FROM anon, authenticated;
REVOKE ALL ON public.payments FROM anon, authenticated;
REVOKE ALL ON public.subscriptions FROM anon, authenticated;
REVOKE ALL ON public.webhook_events FROM anon, authenticated;
REVOKE ALL ON public.credit_reservations FROM anon, authenticated;
REVOKE ALL ON public.generation_job_locks FROM anon, authenticated;

-- Allow authenticated SELECT on own credits only (already via RLS); restore SELECT grant
GRANT SELECT ON public.user_credits TO authenticated;
GRANT SELECT ON public.plans TO authenticated;
GRANT SELECT ON public.credit_packs TO authenticated;

COMMENT ON TABLE public.generation_job_locks IS
  'Cross-instance commercial generation idempotency. Same lock_key → one in-progress job.';

COMMENT ON INDEX public.idx_payments_razorpay_payment_id_unique IS
  'Ensures one payments row per Razorpay payment id (subscription.charged safe).';
