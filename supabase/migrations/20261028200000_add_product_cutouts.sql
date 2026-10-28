-- ============================================================
-- Product cut-outs: cache of background-removed product photos
-- ============================================================
-- One row per (user, source image bytes). Cut-outs cost a hosted API call,
-- so every poster that reuses the same product photo reuses the cut-out.
-- Server-only: RLS on, no policies, no anon/authenticated access.

CREATE TABLE IF NOT EXISTS public.product_cutouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_hash text NOT NULL,
  source_url text,
  cutout_url text,
  storage_path text,
  width integer,
  height integer,
  provider text NOT NULL,
  ok boolean NOT NULL,
  quality jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, source_hash)
);

ALTER TABLE public.product_cutouts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.product_cutouts FROM anon, authenticated;
