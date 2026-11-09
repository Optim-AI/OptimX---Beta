-- ============================================================
-- Meta Intelligence — Phase 6 (Monday brief)
-- ============================================================
-- One brief per connection per week (Monday-Sunday in the ad account timezone),
-- shown on the dashboard and emailed Monday 9:00 local time.
-- delivery jsonb records each channel (email now; WhatsApp hook for later).

CREATE TABLE IF NOT EXISTS public.weekly_briefs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid NOT NULL REFERENCES public.meta_connections(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  week_start date NOT NULL,
  week_end date NOT NULL,
  status text NOT NULL DEFAULT 'building' CHECK (status IN ('building', 'ready', 'failed')),
  trigger text NOT NULL DEFAULT 'schedule' CHECK (trigger IN ('schedule', 'manual')),
  content jsonb,
  pack_id uuid REFERENCES public.test_packs(id) ON DELETE SET NULL,
  delivery jsonb NOT NULL DEFAULT '{}'::jsonb,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT weekly_briefs_conn_week_key UNIQUE (connection_id, week_start)
);
CREATE INDEX IF NOT EXISTS idx_weekly_briefs_user_week ON public.weekly_briefs (user_id, week_start DESC);

-- Opt-out for the Monday email (the brief still appears on the dashboard).
ALTER TABLE public.meta_connections ADD COLUMN IF NOT EXISTS brief_email_enabled boolean NOT NULL DEFAULT true;

-- Brief packs are 5 angles × feed only (5 ads); regular packs stay feed + story.
ALTER TABLE public.test_packs ADD COLUMN IF NOT EXISTS formats text[] NOT NULL DEFAULT '{feed,story}';
ALTER TABLE public.test_packs DROP CONSTRAINT IF EXISTS test_packs_source_check;
ALTER TABLE public.test_packs ADD CONSTRAINT test_packs_source_check CHECK (source IN ('product', 'winner', 'brief'));

ALTER TABLE public.weekly_briefs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.weekly_briefs FROM anon, authenticated;
