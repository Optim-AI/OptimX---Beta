-- ============================================================
-- Social publishing history (Facebook Page posts first).
-- Separate from Meta Ads integrations (provider = meta) and
-- creative draft campaigns.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.social_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  integration_id uuid REFERENCES public.integrations(id) ON DELETE SET NULL,
  provider text NOT NULL DEFAULT 'meta-publish',
  destination_page_id text,
  destination_page_name text,
  source_image_id uuid,
  source_image_url text NOT NULL,
  source_image_path text,
  caption text,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'publishing', 'published', 'failed')),
  meta_post_id text,
  meta_photo_id text,
  permalink text,
  error_message text,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_social_posts_user_created
  ON public.social_posts (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_social_posts_user_status
  ON public.social_posts (user_id, status);

CREATE INDEX IF NOT EXISTS idx_social_posts_integration
  ON public.social_posts (integration_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_social_posts_meta_post
  ON public.social_posts (user_id, meta_post_id)
  WHERE meta_post_id IS NOT NULL;

COMMENT ON TABLE public.social_posts IS
  'Organic social publish history. Does not store access tokens.';

ALTER TABLE public.social_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS social_posts_select_own ON public.social_posts;
CREATE POLICY social_posts_select_own
  ON public.social_posts FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS social_posts_insert_own ON public.social_posts;
CREATE POLICY social_posts_insert_own
  ON public.social_posts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS social_posts_update_own ON public.social_posts;
CREATE POLICY social_posts_update_own
  ON public.social_posts FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS social_posts_delete_own ON public.social_posts;
CREATE POLICY social_posts_delete_own
  ON public.social_posts FOR DELETE
  USING (auth.uid() = user_id);
