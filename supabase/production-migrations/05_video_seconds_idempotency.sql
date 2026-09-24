-- Phase 12.5 Live package — 05 video seconds migration idempotency index
-- Source of truth: supabase/migrations/20260326200000_video_seconds_migration_idempotency.sql
-- MANUAL APPLY ONLY. Not wired into supabase db push / CI.
-- Does NOT convert balances. Application/wallet scripts do that separately.

CREATE UNIQUE INDEX IF NOT EXISTS idx_credit_history_seconds_to_video_credits_v1
  ON public.credit_history (user_id)
  WHERE operation = 'migrate'
    AND source = 'seconds_to_video_credits_v1'
    AND credit_type = 'video';

COMMENT ON INDEX public.idx_credit_history_seconds_to_video_credits_v1 IS
  'At most one seconds→Video Credits migration marker per user (Phase 1C-1).';
