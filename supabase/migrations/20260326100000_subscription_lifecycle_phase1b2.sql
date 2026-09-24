-- Phase 1B-2: subscription lifecycle — cancel_at_period_end
-- Date: 2026-03-26
--
-- LOCAL-first. Does NOT grant credits, alter plans, or migrate wallets.
-- Supports Razorpay cancel_at_cycle_end (SDK cancel(id, true)).

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS cancel_at_period_end boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.subscriptions.cancel_at_period_end IS
  'True when user requested cancellation; access remains until current_period_end. Set via Razorpay cancel(id, true).';

CREATE INDEX IF NOT EXISTS idx_subscriptions_cancel_at_period_end
  ON public.subscriptions (cancel_at_period_end)
  WHERE cancel_at_period_end = true;
