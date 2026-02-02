-- Creative Studio Sessions Table
-- Stores saved Creative Studio sessions for users

CREATE TABLE IF NOT EXISTS creative_studio_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  session_type TEXT NOT NULL DEFAULT 'poster', -- 'poster' or 'video'
  brand_snapshot JSONB NOT NULL,
  -- Poster-specific fields
  phase TEXT,
  messages JSONB,
  product_data JSONB,
  poster_prompt TEXT,
  config JSONB,
  generated_posters JSONB,
  -- Video-specific fields
  ad_builder_data JSONB,
  generated_videos JSONB,
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for efficient user-based queries
CREATE INDEX IF NOT EXISTS idx_creative_studio_sessions_user_id 
ON creative_studio_sessions(user_id);

-- Enable Row Level Security
ALTER TABLE creative_studio_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only access their own sessions
CREATE POLICY "Users can view own sessions"
  ON creative_studio_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sessions"
  ON creative_studio_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sessions"
  ON creative_studio_sessions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own sessions"
  ON creative_studio_sessions FOR DELETE
  USING (auth.uid() = user_id);
