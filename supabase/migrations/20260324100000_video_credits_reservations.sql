-- SkalX Video Credits: credit_reservations foundation
-- Date: 2026-03-24
--
-- Contains ONLY:
-- 1) public.credit_reservations + indexes
-- 2) credit_history operation CHECK extension
--
-- Does NOT:
-- - convert plans.video_credits
-- - migrate user wallet balances
-- - insert credit_pricing / app_settings
-- - provision subscriptions or cycles

-- ============================================================
-- credit_reservations
-- ============================================================
CREATE TABLE IF NOT EXISTS public.credit_reservations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    credit_type text NOT NULL CHECK (credit_type IN ('image', 'video')),
    amount integer NOT NULL CHECK (amount > 0),
    status text NOT NULL DEFAULT 'reserved'
        CHECK (status IN ('reserved', 'consumed', 'released')),
    purpose text NOT NULL,
    reference_id text,
    from_subscription integer NOT NULL DEFAULT 0,
    from_addon integer NOT NULL DEFAULT 0,
    metadata jsonb,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_credit_reservations_user
    ON public.credit_reservations(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_reservations_status
    ON public.credit_reservations(status);
CREATE INDEX IF NOT EXISTS idx_credit_reservations_reference
    ON public.credit_reservations(reference_id)
    WHERE reference_id IS NOT NULL;

-- ============================================================
-- Extend credit_history operations
-- ============================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'credit_history' AND constraint_name = 'credit_history_operation_check'
  ) THEN
    ALTER TABLE public.credit_history DROP CONSTRAINT credit_history_operation_check;
  END IF;
EXCEPTION WHEN undefined_object THEN
  NULL;
END $$;

ALTER TABLE public.credit_history DROP CONSTRAINT IF EXISTS credit_history_operation_check;
ALTER TABLE public.credit_history
  ADD CONSTRAINT credit_history_operation_check
  CHECK (operation IN ('add', 'deduct', 'reset', 'expire', 'reserve', 'release', 'consume', 'migrate'));
