-- Add RLS policies for user-uploads storage bucket
-- The bucket was created programmatically but had no RLS policies,
-- causing "new row violates row-level security policy" on upload.

-- Allow authenticated users to upload to user-uploads
CREATE POLICY "Allow authenticated users to upload to user-uploads"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'user-uploads');

-- Allow public read access to user-uploads
CREATE POLICY "Allow public read access to user-uploads"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'user-uploads');

-- Allow authenticated users to update their files in user-uploads
CREATE POLICY "Allow authenticated users to update their user-uploads"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'user-uploads')
WITH CHECK (bucket_id = 'user-uploads');

-- Allow authenticated users to delete their files in user-uploads
CREATE POLICY "Allow authenticated users to delete their user-uploads"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'user-uploads');
