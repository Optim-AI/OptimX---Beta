-- ============================================================
-- Ad Studio versions: each product's angles, strategy and creatives
-- ============================================================
-- Defined in database/schema.ts but never had a migration, so databases built
-- from migrations (local, new environments) lacked it and Ad Studio lost its work
-- on refresh. Safe on databases that already have it (IF NOT EXISTS throughout).
-- Server-only: RLS on, no policies, no anon/authenticated access.

CREATE TABLE IF NOT EXISTS public.content_studio_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  scan_id uuid REFERENCES public.content_studio_scans(id) ON DELETE CASCADE,
  product_name text NOT NULL,
  version_number integer NOT NULL DEFAULT 1,
  ad_angles jsonb,
  campaign_plan jsonb,
  campaign_strategy jsonb,
  generated_posters jsonb,
  campaign jsonb,
  product_data jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cs_versions_user ON public.content_studio_versions (user_id);
CREATE INDEX IF NOT EXISTS idx_cs_versions_user_product ON public.content_studio_versions (user_id, product_name);
CREATE INDEX IF NOT EXISTS idx_cs_versions_scan ON public.content_studio_versions (scan_id);
CREATE INDEX IF NOT EXISTS idx_cs_versions_created ON public.content_studio_versions (created_at DESC);

ALTER TABLE public.content_studio_versions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.content_studio_versions FROM anon, authenticated;
