-- Poster carousel campaigns (multi-slide poster generation).
-- Additive only: does not alter poster_generation_sessions or any existing data.
-- Slides are separate rows so each one can be claimed (lease), generated, charged,
-- and QC'd independently without overwriting concurrent progress on sibling slides.

CREATE TABLE IF NOT EXISTS poster_carousel_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  session_id uuid NOT NULL REFERENCES poster_generation_sessions(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'ready'
    CHECK (status IN ('planning', 'ready', 'generating', 'partial', 'completed', 'failed')),
  version integer NOT NULL DEFAULT 1,
  slide_count integer NOT NULL CHECK (slide_count BETWEEN 2 AND 10),
  aspect_ratio text NOT NULL,
  brief_id text NOT NULL,
  strategy_id text NOT NULL,
  story jsonb NOT NULL,
  shared_dna jsonb NOT NULL,
  campaign_checks jsonb NOT NULL DEFAULT '[]'::jsonb,
  last_export jsonb,
  generation_started_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_poster_carousel_campaigns_user
  ON poster_carousel_campaigns (user_id);
CREATE INDEX IF NOT EXISTS idx_poster_carousel_campaigns_session_created
  ON poster_carousel_campaigns (session_id, created_at DESC);

CREATE TABLE IF NOT EXISTS poster_carousel_slides (
  id text PRIMARY KEY,
  campaign_id uuid NOT NULL REFERENCES poster_carousel_campaigns(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  slide_index integer NOT NULL CHECK (slide_index BETWEEN 0 AND 9),
  status text NOT NULL DEFAULT 'planned'
    CHECK (status IN ('planned', 'generating', 'qc_pending', 'ready', 'needs_review', 'failed', 'unbilled')),
  generation_id text,
  lease_token text,
  lease_expires_at timestamptz,
  credits_charged integer NOT NULL DEFAULT 0 CHECK (credits_charged >= 0),
  data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_poster_carousel_slides_campaign_index
  ON poster_carousel_slides (campaign_id, slide_index);
CREATE INDEX IF NOT EXISTS idx_poster_carousel_slides_user
  ON poster_carousel_slides (user_id);
CREATE INDEX IF NOT EXISTS idx_poster_carousel_slides_generation
  ON poster_carousel_slides (generation_id);

ALTER TABLE poster_carousel_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE poster_carousel_slides ENABLE ROW LEVEL SECURITY;

-- Browser clients only ever read their own rows; all writes go through the server.
CREATE POLICY "Users can view own poster carousel campaigns"
  ON poster_carousel_campaigns FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view own poster carousel slides"
  ON poster_carousel_slides FOR SELECT
  USING (auth.uid() = user_id);
