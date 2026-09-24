-- Phase 12.5 Live package — 03 subscription_cycles
-- Source of truth: supabase/migrations/20260326000000_subscription_cycles.sql
-- MANUAL APPLY ONLY. Not wired into supabase db push / CI.
-- RLS / grants for this table are applied in 07_subscription_cycles_security.sql.

CREATE TABLE IF NOT EXISTS public.subscription_cycles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id uuid NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    plan_id text NOT NULL REFERENCES public.plans(id),
    razorpay_payment_id text NOT NULL,
    period_start timestamptz NOT NULL,
    period_end timestamptz NOT NULL,
    image_credits_granted integer NOT NULL CHECK (image_credits_granted >= 0),
    video_credits_granted integer NOT NULL CHECK (video_credits_granted >= 0),
    status text NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'provisioned', 'failed')),
    idempotency_key text NOT NULL,
    metadata jsonb,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    CONSTRAINT subscription_cycles_idempotency_key_unique UNIQUE (idempotency_key),
    CONSTRAINT subscription_cycles_razorpay_payment_id_unique UNIQUE (razorpay_payment_id)
);

CREATE INDEX IF NOT EXISTS idx_subscription_cycles_subscription
    ON public.subscription_cycles (subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscription_cycles_user
    ON public.subscription_cycles (user_id);
CREATE INDEX IF NOT EXISTS idx_subscription_cycles_status
    ON public.subscription_cycles (status);

COMMENT ON TABLE public.subscription_cycles IS
  'One row per successful Razorpay subscription charge. Idempotent entitlement ledger.';

COMMENT ON COLUMN public.subscription_cycles.idempotency_key IS
  'Durable key, typically sub_charge:{razorpay_payment_id}. Never Date.now().';
