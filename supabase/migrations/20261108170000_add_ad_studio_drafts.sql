-- ============================================================
-- Ad Studio poster flow: draft posters, pay only for the ones kept
-- ============================================================
-- A project = one product + goal + formats (+ optional direction from the chat).
-- Each round draws ~8 draft posters (one per researched angle) WITHOUT charging.
-- Drafts live in a PRIVATE bucket; the browser only ever sees a watermarked,
-- low-resolution preview. Keeping a draft charges 1 image credit (once) and
-- publishes the full-quality image.

CREATE TABLE IF NOT EXISTS public.ad_studio_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scan_id uuid,
  product jsonb NOT NULL,
  product_slug text NOT NULL,
  goal text NOT NULL,
  offer_details text,
  formats text[] NOT NULL DEFAULT '{feed_4x5}',
  direction text,
  source text NOT NULL DEFAULT 'ad_studio' CHECK (source IN ('ad_studio', 'winner', 'brief')),
  source_ad_meta_id text,
  research jsonb,
  status text NOT NULL DEFAULT 'researching' CHECK (status IN ('researching', 'drawing', 'ready', 'failed')),
  rounds integer NOT NULL DEFAULT 0,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ad_studio_projects_user ON public.ad_studio_projects (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.ad_studio_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.ad_studio_projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  round integer NOT NULL,
  position integer NOT NULL,
  format text NOT NULL,
  angle jsonb NOT NULL,
  parent_draft_id uuid REFERENCES public.ad_studio_drafts(id) ON DELETE SET NULL,
  kind text NOT NULL DEFAULT 'original' CHECK (kind IN ('original', 'edit', 'format')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'drawing', 'ready', 'failed')),
  session_id uuid,
  storage_path text,
  preview_path text,
  error text,
  kept boolean NOT NULL DEFAULT false,
  kept_at timestamptz,
  credits_charged integer NOT NULL DEFAULT 0,
  final_url text,
  final_path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ad_studio_drafts_project ON public.ad_studio_drafts (project_id, round, position);
CREATE INDEX IF NOT EXISTS idx_ad_studio_drafts_user_created ON public.ad_studio_drafts (user_id, created_at DESC);

-- Private bucket for full-quality drafts and their watermarked previews.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('ad-drafts', 'ad-drafts', false, 20971520, ARRAY['image/png', 'image/jpeg', 'image/webp'])
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.ad_studio_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_studio_drafts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ad_studio_projects, public.ad_studio_drafts FROM anon, authenticated;
