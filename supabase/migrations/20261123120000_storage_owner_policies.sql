-- Security audit 2026-11-23: storage files can only be changed by their owner.
--
-- Before: any signed-in user could INSERT/UPDATE/DELETE any object in campaign-assets,
-- posters, videos and user-uploads (bucket-wide policies; Postgres ORs policies, so the
-- "own folder" ones did not help). Public buckets also accepted any file type and size.
--
-- After: signed-in users may write only inside their own folder, matching the paths
-- the app already uses from the browser:
--   campaign-assets: campaigns/<user id>/...
--   user-uploads:    <user id>/...
-- Server code uses the service role and is unaffected. Public read stays as it is.
-- Safe to run more than once.

-- 1. Remove every existing write policy for these buckets.
DROP POLICY IF EXISTS "Allow authenticated users to upload to campaign-assets" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to update their campaign-assets" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to delete their campaign-assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can insert into campaign-assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated update own campaign-assets" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated delete own campaign-assets" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to upload to posters" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to update their posters" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to delete their posters" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to upload to videos" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to update their videos" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to delete their videos" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to upload to user-uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to update their user-uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to delete their user-uploads" ON storage.objects;
DROP POLICY IF EXISTS "storage: allow own files" ON storage.objects;
DROP POLICY IF EXISTS "campaign-assets owner insert" ON storage.objects;
DROP POLICY IF EXISTS "campaign-assets owner update" ON storage.objects;
DROP POLICY IF EXISTS "campaign-assets owner delete" ON storage.objects;
DROP POLICY IF EXISTS "user-uploads owner insert" ON storage.objects;
DROP POLICY IF EXISTS "user-uploads owner update" ON storage.objects;
DROP POLICY IF EXISTS "user-uploads owner delete" ON storage.objects;

-- 2. Owner-only writes.
CREATE POLICY "campaign-assets owner insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'campaign-assets'
    AND (storage.foldername(name))[1] = 'campaigns'
    AND (storage.foldername(name))[2] = (select auth.uid())::text);

CREATE POLICY "campaign-assets owner update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'campaign-assets'
    AND (storage.foldername(name))[1] = 'campaigns'
    AND (storage.foldername(name))[2] = (select auth.uid())::text)
  WITH CHECK (bucket_id = 'campaign-assets'
    AND (storage.foldername(name))[1] = 'campaigns'
    AND (storage.foldername(name))[2] = (select auth.uid())::text);

CREATE POLICY "campaign-assets owner delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'campaign-assets'
    AND (storage.foldername(name))[1] = 'campaigns'
    AND (storage.foldername(name))[2] = (select auth.uid())::text);

CREATE POLICY "user-uploads owner insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'user-uploads' AND (storage.foldername(name))[1] = (select auth.uid())::text);

CREATE POLICY "user-uploads owner update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'user-uploads' AND (storage.foldername(name))[1] = (select auth.uid())::text)
  WITH CHECK (bucket_id = 'user-uploads' AND (storage.foldername(name))[1] = (select auth.uid())::text);

CREATE POLICY "user-uploads owner delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'user-uploads' AND (storage.foldername(name))[1] = (select auth.uid())::text);

-- 3. File type and size limits. No SVG anywhere (it can run scripts); nothing stored uses it.
UPDATE storage.buckets SET allowed_mime_types = ARRAY[
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'video/mp4', 'video/webm', 'video/quicktime'
]::text[]
WHERE id = 'campaign-assets';

UPDATE storage.buckets SET
  file_size_limit = 52428800, -- 50 MB
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif', 'video/mp4', 'video/webm', 'video/quicktime']::text[]
WHERE id = 'user-uploads';

UPDATE storage.buckets SET
  file_size_limit = 10485760, -- 10 MB, same as the agent's upload check
  allowed_mime_types = ARRAY['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'text/plain', 'text/csv', 'text/markdown']::text[]
WHERE id = 'agent-context';

-- Old empty buckets: images/videos only, sensible size.
UPDATE storage.buckets SET
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'video/mp4']::text[]
WHERE id IN ('Posters', 'Videos', 'posters', 'videos');

-- 4. Pin search_path on functions the advisor flagged.
DO $$
DECLARE f record;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('set_integrationsbeta_status', 'decrement_credit', 'handle_new_user_credits',
                        'upsert_profile', 'set_updated_at', 'handle_new_auth_user')
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = public, pg_temp', f.sig);
  END LOOP;
END $$;
