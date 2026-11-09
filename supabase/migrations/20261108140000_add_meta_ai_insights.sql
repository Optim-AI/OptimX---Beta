-- ============================================================
-- Meta Intelligence — Phase 4 (AI analysis)
-- ============================================================
-- One row per analysis run. `input` is the compact JSON Claude saw (no image
-- bytes, no signed URLs) so every insight can be traced back to its numbers.
-- `dropped` lists bullets removed by the number guard.
-- Cascades from meta_connections, so Disconnect / data deletion removes it.

CREATE TABLE IF NOT EXISTS public.ai_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid NOT NULL REFERENCES public.meta_connections(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  trigger text NOT NULL CHECK (trigger IN ('sync', 'manual')),
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'succeeded', 'failed')),
  range_days integer NOT NULL,
  period_since date,
  period_until date,
  input_hash text,
  input jsonb,
  output jsonb,
  dropped jsonb NOT NULL DEFAULT '[]'::jsonb,
  model text,
  attempts integer NOT NULL DEFAULT 0,
  usage jsonb NOT NULL DEFAULT '{}'::jsonb,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_ai_insights_conn_created ON public.ai_insights (connection_id, created_at DESC);

ALTER TABLE public.ai_insights ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ai_insights FROM anon, authenticated;
