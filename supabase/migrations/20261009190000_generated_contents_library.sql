-- ============================================================
-- Generated Contents library enhancements
-- Extends user_generated_image for images + videos with RLS.
-- ============================================================

ALTER TABLE public.user_generated_image
  ADD COLUMN IF NOT EXISTS media_type text NOT NULL DEFAULT 'image'
  CHECK (media_type IN ('image', 'video'));

ALTER TABLE public.user_generated_image
  ADD COLUMN IF NOT EXISTS source text;

CREATE INDEX IF NOT EXISTS idx_user_generated_image_user_media
  ON public.user_generated_image (user_id, media_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_generated_image_user_created
  ON public.user_generated_image (user_id, created_at DESC);

-- Deduplicate retries that reuse the same storage path
CREATE UNIQUE INDEX IF NOT EXISTS uq_user_generated_image_user_path
  ON public.user_generated_image (user_id, image_path)
  WHERE image_path IS NOT NULL AND length(trim(image_path)) > 0;

COMMENT ON COLUMN public.user_generated_image.media_type IS
  'image | video — used by Generated Contents filters';

ALTER TABLE public.user_generated_image ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_generated_image_select_own ON public.user_generated_image;
CREATE POLICY user_generated_image_select_own
  ON public.user_generated_image FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS user_generated_image_insert_own ON public.user_generated_image;
CREATE POLICY user_generated_image_insert_own
  ON public.user_generated_image FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS user_generated_image_update_own ON public.user_generated_image;
CREATE POLICY user_generated_image_update_own
  ON public.user_generated_image FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS user_generated_image_delete_own ON public.user_generated_image;
CREATE POLICY user_generated_image_delete_own
  ON public.user_generated_image FOR DELETE
  USING (auth.uid() = user_id);
