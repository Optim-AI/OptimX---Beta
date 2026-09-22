-- Raise campaign-assets limit for Seedance commercial MP4s.
-- Local Storage API also reads supabase/config.toml ([storage] + [storage.buckets.campaign-assets]).
-- Bucket limit must be <= global storage file_size_limit.
--
-- Path used by app: campaign-assets / generated/videos/{uuid}_{ts}.mp4
-- (lib/creative-studio/video-delivery.ts)

UPDATE storage.buckets
SET
  file_size_limit = 209715200, -- 200 MiB
  allowed_mime_types = ARRAY[
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
    'video/mp4', 'video/webm', 'video/quicktime'
  ]::text[]
WHERE id = 'campaign-assets';
