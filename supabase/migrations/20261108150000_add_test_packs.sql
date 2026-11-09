-- ============================================================
-- Meta Intelligence — Phase 5 (Ad Studio test packs)
-- ============================================================
-- A test pack = 3 approved angles × 2 formats (feed 4:5, story 9:16) = 6 variants,
-- generated with the existing poster pipeline (1 image credit per successful poster).
-- Packs are the user's creative work: they survive a Meta disconnect
-- (connection_id is set null), and cascade only with the user.

CREATE TABLE IF NOT EXISTS public.test_packs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  connection_id uuid REFERENCES public.meta_connections(id) ON DELETE SET NULL,
  source text NOT NULL CHECK (source IN ('product', 'winner')),
  source_ad_meta_id text,
  source_ad_snapshot jsonb,
  product jsonb NOT NULL,
  product_slug text NOT NULL,
  angles jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'generating', 'ready', 'partial', 'failed')),
  credits_estimated integer NOT NULL DEFAULT 0,
  credits_charged integer NOT NULL DEFAULT 0,
  test_plan jsonb,
  zip_path text,
  zip_built_at timestamptz,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_test_packs_user_created ON public.test_packs (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.test_pack_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pack_id uuid NOT NULL REFERENCES public.test_packs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  position integer NOT NULL,
  angle_index integer NOT NULL,
  format text NOT NULL CHECK (format IN ('feed', 'story')),
  ad_name text NOT NULL,
  hook text,
  primary_text text,
  headline text,
  what_it_tests text,
  why_it_might_work text,
  test_first boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'generating', 'ready', 'failed')),
  image_url text,
  storage_path text,
  image_md5 text,
  session_id uuid,
  error text,
  matched_ad_meta_id text,
  matched_by text CHECK (matched_by IS NULL OR matched_by IN ('name', 'image')),
  matched_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT test_pack_variants_pack_angle_format_key UNIQUE (pack_id, angle_index, format)
);
CREATE INDEX IF NOT EXISTS idx_test_pack_variants_user ON public.test_pack_variants (user_id);
CREATE INDEX IF NOT EXISTS idx_test_pack_variants_ad_name ON public.test_pack_variants (user_id, lower(ad_name));

-- Private bucket for generated ZIP downloads.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('test-packs', 'test-packs', false, 104857600, ARRAY['application/zip'])
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.test_packs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_pack_variants ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.test_packs, public.test_pack_variants FROM anon, authenticated;
