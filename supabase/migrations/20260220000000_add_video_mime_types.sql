-- Migration: Add video MIME types to campaign-assets storage bucket
-- Created: 2026-02-20

-- Update campaign-assets bucket to also allow video uploads
UPDATE storage.buckets
SET
  allowed_mime_types = ARRAY[
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
    'video/mp4', 'video/webm', 'video/quicktime'
  ]::text[],
  file_size_limit = 104857600 -- 100MB to accommodate video files
WHERE id = 'campaign-assets';
