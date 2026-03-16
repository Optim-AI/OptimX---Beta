-- Enhance Creative Studio Sessions Table
-- Adds session_type, messages, phase, and generated outputs columns for modular architecture

-- Add session_type column (required for poster vs video differentiation)
ALTER TABLE creative_studio_sessions 
ADD COLUMN IF NOT EXISTS session_type TEXT NOT NULL DEFAULT 'poster';

-- Add poster-specific columns
ALTER TABLE creative_studio_sessions 
ADD COLUMN IF NOT EXISTS phase TEXT;

ALTER TABLE creative_studio_sessions 
ADD COLUMN IF NOT EXISTS messages JSONB;

ALTER TABLE creative_studio_sessions 
ADD COLUMN IF NOT EXISTS poster_prompt TEXT;

ALTER TABLE creative_studio_sessions 
ADD COLUMN IF NOT EXISTS generated_posters JSONB;

-- Add video-specific columns
ALTER TABLE creative_studio_sessions 
ADD COLUMN IF NOT EXISTS ad_builder_data JSONB;

ALTER TABLE creative_studio_sessions 
ADD COLUMN IF NOT EXISTS generated_videos JSONB;

-- Create index on session_type for efficient filtering
CREATE INDEX IF NOT EXISTS idx_creative_studio_sessions_type 
ON creative_studio_sessions(session_type);

-- Create composite index for user_id + session_type queries
CREATE INDEX IF NOT EXISTS idx_creative_studio_sessions_user_type 
ON creative_studio_sessions(user_id, session_type);

-- Add comment to table
COMMENT ON TABLE creative_studio_sessions IS 'Stores Creative Studio sessions for poster and video generation with full state persistence';

-- Add comments to columns
COMMENT ON COLUMN creative_studio_sessions.session_type IS 'Type of session: poster or video';
COMMENT ON COLUMN creative_studio_sessions.phase IS 'Current phase for poster sessions (input, analyzing, brand-review, product-input, poster-prompt, config, generating, ready)';
COMMENT ON COLUMN creative_studio_sessions.messages IS 'Array of chat messages for the session';
COMMENT ON COLUMN creative_studio_sessions.poster_prompt IS 'The prompt used for poster generation';
COMMENT ON COLUMN creative_studio_sessions.generated_posters IS 'Array of generated poster URLs/data';
COMMENT ON COLUMN creative_studio_sessions.ad_builder_data IS 'Video ad builder wizard state (product, setup, voiceover, etc.)';
COMMENT ON COLUMN creative_studio_sessions.generated_videos IS 'Array of generated video URLs/data';
