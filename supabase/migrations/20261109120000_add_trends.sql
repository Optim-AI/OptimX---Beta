-- ============================================================
-- Trends: what's going viral, and how a brand can use it
-- ============================================================
-- trend_snapshots: one shared list per category per day (India), built from live
--   Google Search (Gemini grounding) and, when configured, YouTube's trending chart.
--   Every trend keeps the real source links it was found in.
-- brand_trend_ideas: one brand's fit + ready ideas for a snapshot.
-- Server-only (service role); no client access.

CREATE TABLE IF NOT EXISTS public.trend_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_key text NOT NULL,
  category_label text NOT NULL,
  region text NOT NULL DEFAULT 'IN',
  day date NOT NULL,
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'succeeded', 'failed')),
  trends jsonb NOT NULL DEFAULT '[]'::jsonb,
  queries jsonb NOT NULL DEFAULT '[]'::jsonb,
  model text,
  usage jsonb NOT NULL DEFAULT '{}'::jsonb,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);

-- One snapshot per category per day: concurrent requests reuse it.
CREATE UNIQUE INDEX IF NOT EXISTS trend_snapshots_category_day_key ON public.trend_snapshots (category_key, region, day);

CREATE TABLE IF NOT EXISTS public.brand_trend_ideas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  snapshot_id uuid REFERENCES public.trend_snapshots(id) ON DELETE SET NULL,
  trigger text NOT NULL DEFAULT 'manual' CHECK (trigger IN ('manual', 'schedule')),
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'succeeded', 'failed')),
  category_label text,
  output jsonb,
  model text,
  usage jsonb NOT NULL DEFAULT '{}'::jsonb,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_brand_trend_ideas_user_created ON public.brand_trend_ideas (user_id, created_at DESC);

ALTER TABLE public.trend_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brand_trend_ideas ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.trend_snapshots FROM anon, authenticated;
REVOKE ALL ON public.brand_trend_ideas FROM anon, authenticated;
