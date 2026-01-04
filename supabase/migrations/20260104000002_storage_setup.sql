-- Migration: Setup storage buckets and RLS policies
-- Created: 2026-01-04

-- Create campaign-assets bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'campaign-assets',
  'campaign-assets',
  true,
  52428800, -- 50MB limit
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml']::text[];

-- Note: RLS on storage.objects is already enabled by default in Supabase

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow authenticated users to upload to campaign-assets" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read access to campaign-assets" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to update their campaign-assets" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to delete their campaign-assets" ON storage.objects;

-- Policy: Allow authenticated users to upload files
CREATE POLICY "Allow authenticated users to upload to campaign-assets"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'campaign-assets');

-- Policy: Allow public read access (since bucket is public)
CREATE POLICY "Allow public read access to campaign-assets"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'campaign-assets');

-- Policy: Allow authenticated users to update their own files
CREATE POLICY "Allow authenticated users to update their campaign-assets"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'campaign-assets')
WITH CHECK (bucket_id = 'campaign-assets');

-- Policy: Allow authenticated users to delete their own files
CREATE POLICY "Allow authenticated users to delete their campaign-assets"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'campaign-assets');
