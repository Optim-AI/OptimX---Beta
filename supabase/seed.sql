-- Supabase Seed Data
-- This file runs after migrations during `supabase db reset`
-- Add any test/dev data here

-- Example: Insert default app settings
INSERT INTO app_settings (key, value, created_at, updated_at) VALUES
  ('theme', '"light"'::jsonb, NOW(), NOW()),
  ('currency', '"USD"'::jsonb, NOW(), NOW())
ON CONFLICT (key) DO NOTHING;

