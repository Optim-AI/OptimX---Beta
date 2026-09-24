-- Phase 1C-1: durable idempotency for video seconds → credits wallet migration
-- Date: 2026-03-26
--
-- LOCAL-first. Does NOT convert balances (application script does).
-- Prevents duplicate migration markers per user.

CREATE UNIQUE INDEX IF NOT EXISTS idx_credit_history_seconds_to_video_credits_v1
  ON public.credit_history (user_id)
  WHERE operation = 'migrate'
    AND source = 'seconds_to_video_credits_v1'
    AND credit_type = 'video';

COMMENT ON INDEX public.idx_credit_history_seconds_to_video_credits_v1 IS
  'At most one seconds→Video Credits migration marker per user (Phase 1C-1).';
