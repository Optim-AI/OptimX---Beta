-- ============================================================
-- Ad Studio poster flow — Part 4: kept posters ready to run on Meta
-- ============================================================
-- When a draft is kept it gets an SKX- ad name (so synced Meta ads can be matched back),
-- copy-ready primary text + headline, and its image fingerprint. Once the ad is live and
-- synced, matched_ad_meta_id links the poster to its real results.

ALTER TABLE public.ad_studio_drafts
  ADD COLUMN IF NOT EXISTS ad_name text,
  ADD COLUMN IF NOT EXISTS primary_text text,
  ADD COLUMN IF NOT EXISTS headline text,
  ADD COLUMN IF NOT EXISTS image_md5 text,
  ADD COLUMN IF NOT EXISTS matched_ad_meta_id text,
  ADD COLUMN IF NOT EXISTS matched_by text CHECK (matched_by IS NULL OR matched_by IN ('name', 'image')),
  ADD COLUMN IF NOT EXISTS matched_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_ad_studio_drafts_kept ON public.ad_studio_drafts (user_id) WHERE kept;

-- Monday brief now prepares a poster project (5 free drafts) instead of a test pack.
ALTER TABLE public.weekly_briefs ADD COLUMN IF NOT EXISTS poster_project_id uuid REFERENCES public.ad_studio_projects(id) ON DELETE SET NULL;
