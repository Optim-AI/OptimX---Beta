-- Poster Generation Sessions (structured creative state — Phase 2)
-- Separate from creative_studio_sessions (UI shell). Linked via studio_session_id.
-- Does NOT migrate or alter generated_posters on creative_studio_sessions.

CREATE TABLE IF NOT EXISTS poster_generation_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  studio_session_id uuid REFERENCES creative_studio_sessions(id) ON DELETE SET NULL,
  brand_id text,
  product_id text,
  status text NOT NULL DEFAULT 'draft',
  version integer NOT NULL DEFAULT 1,
  brief jsonb,
  strategy jsonb,
  concepts jsonb NOT NULL DEFAULT '[]'::jsonb,
  selected_concept_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  dna_by_concept_id jsonb NOT NULL DEFAULT '{}'::jsonb,
  specifications jsonb NOT NULL DEFAULT '[]'::jsonb,
  assets jsonb NOT NULL DEFAULT '[]'::jsonb,
  iterations jsonb NOT NULL DEFAULT '[]'::jsonb,
  trace jsonb NOT NULL DEFAULT '{}'::jsonb,
  error jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_poster_gen_sessions_user_id
  ON poster_generation_sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_poster_gen_sessions_studio_session_id
  ON poster_generation_sessions (studio_session_id);
CREATE INDEX IF NOT EXISTS idx_poster_gen_sessions_status
  ON poster_generation_sessions (status);
CREATE INDEX IF NOT EXISTS idx_poster_gen_sessions_updated_at
  ON poster_generation_sessions (updated_at DESC);

-- At most one poster-generation session per Brand Studio UI session (when linked)
CREATE UNIQUE INDEX IF NOT EXISTS idx_poster_gen_sessions_studio_session_unique
  ON poster_generation_sessions (studio_session_id)
  WHERE studio_session_id IS NOT NULL;

ALTER TABLE poster_generation_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own poster generation sessions"
  ON poster_generation_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own poster generation sessions"
  ON poster_generation_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own poster generation sessions"
  ON poster_generation_sessions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own poster generation sessions"
  ON poster_generation_sessions FOR DELETE
  USING (auth.uid() = user_id);
