-- Add missing columns to creative_studio_sessions table
-- This migration adds columns that were missing from the initial schema

-- Add session_type column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'creative_studio_sessions' AND column_name = 'session_type'
  ) THEN
    ALTER TABLE creative_studio_sessions ADD COLUMN session_type TEXT NOT NULL DEFAULT 'poster';
  END IF;
END $$;

-- Add phase column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'creative_studio_sessions' AND column_name = 'phase'
  ) THEN
    ALTER TABLE creative_studio_sessions ADD COLUMN phase TEXT;
  END IF;
END $$;

-- Add messages column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'creative_studio_sessions' AND column_name = 'messages'
  ) THEN
    ALTER TABLE creative_studio_sessions ADD COLUMN messages JSONB;
  END IF;
END $$;

-- Add poster_prompt column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'creative_studio_sessions' AND column_name = 'poster_prompt'
  ) THEN
    ALTER TABLE creative_studio_sessions ADD COLUMN poster_prompt TEXT;
  END IF;
END $$;

-- Add generated_posters column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'creative_studio_sessions' AND column_name = 'generated_posters'
  ) THEN
    ALTER TABLE creative_studio_sessions ADD COLUMN generated_posters JSONB;
  END IF;
END $$;

-- Add ad_builder_data column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'creative_studio_sessions' AND column_name = 'ad_builder_data'
  ) THEN
    ALTER TABLE creative_studio_sessions ADD COLUMN ad_builder_data JSONB;
  END IF;
END $$;

-- Add generated_videos column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'creative_studio_sessions' AND column_name = 'generated_videos'
  ) THEN
    ALTER TABLE creative_studio_sessions ADD COLUMN generated_videos JSONB;
  END IF;
END $$;

-- Create index on session_type for efficient filtering
CREATE INDEX IF NOT EXISTS idx_creative_studio_sessions_session_type 
ON creative_studio_sessions(session_type);
