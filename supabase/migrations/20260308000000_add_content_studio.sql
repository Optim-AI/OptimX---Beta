-- Content Studio tables: scans, campaigns, posters

-- content_studio_scans: stores website scan results (brand info + products)
CREATE TABLE IF NOT EXISTS content_studio_scans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  url text NOT NULL,
  brand_summary jsonb,
  products jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_content_studio_scans_user_id ON content_studio_scans (user_id);
CREATE INDEX IF NOT EXISTS idx_content_studio_scans_created_at ON content_studio_scans (created_at DESC);

-- content_studio_campaigns: stores generated campaigns per product
CREATE TABLE IF NOT EXISTS content_studio_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  scan_id uuid NOT NULL REFERENCES content_studio_scans(id) ON DELETE CASCADE,
  product_name text NOT NULL,
  campaign_name text,
  ads jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_content_studio_campaigns_scan_id ON content_studio_campaigns (scan_id);

-- content_studio_posters: stores generated poster image URLs
CREATE TABLE IF NOT EXISTS content_studio_posters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  scan_id uuid NOT NULL REFERENCES content_studio_scans(id) ON DELETE CASCADE,
  product_name text NOT NULL,
  angle jsonb,
  image_urls jsonb NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_content_studio_posters_scan_id ON content_studio_posters (scan_id);

-- RLS policies
ALTER TABLE content_studio_scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_studio_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_studio_posters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own scans" ON content_studio_scans
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own scans" ON content_studio_scans
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own scans" ON content_studio_scans
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own campaigns" ON content_studio_campaigns
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own campaigns" ON content_studio_campaigns
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own campaigns" ON content_studio_campaigns
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own posters" ON content_studio_posters
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own posters" ON content_studio_posters
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own posters" ON content_studio_posters
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own posters" ON content_studio_posters
  FOR DELETE USING (auth.uid() = user_id);
