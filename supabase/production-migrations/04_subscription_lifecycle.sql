-- Phase 12.5 Live package — 04 subscription lifecycle
-- Source of truth: supabase/migrations/20260326100000_subscription_lifecycle_phase1b2.sql
-- MANUAL APPLY ONLY. Not wired into supabase db push / CI.

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS cancel_at_period_end boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.subscriptions.cancel_at_period_end IS
  'True when user requested cancellation; access remains until current_period_end. Set via Razorpay cancel(id, true).';

CREATE INDEX IF NOT EXISTS idx_subscriptions_cancel_at_period_end
  ON public.subscriptions (cancel_at_period_end)
  WHERE cancel_at_period_end = true;
