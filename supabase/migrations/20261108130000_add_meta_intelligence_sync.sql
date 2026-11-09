-- ============================================================
-- Meta Intelligence — Phase 2 (Data sync)
-- ============================================================
-- Everything synced from Meta hangs off meta_connections(id) with
-- ON DELETE CASCADE, so Disconnect / Meta's deletion callback removes it all.
-- Meta object ids are unique per connection (two SkalX users could link the
-- same ad account), so uniqueness is (connection_id, meta id[, date]).
-- Money columns are numeric in the ad account's currency (stored per row).
-- Server-only tables: RLS on, no policies, no anon/authenticated access.

CREATE TABLE IF NOT EXISTS public.meta_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid NOT NULL REFERENCES public.meta_connections(id) ON DELETE CASCADE,
  ad_account_id text NOT NULL,
  meta_id text NOT NULL,
  name text,
  objective text,
  status text,
  effective_status text,
  daily_budget numeric,
  lifetime_budget numeric,
  start_time timestamptz,
  stop_time timestamptz,
  created_time timestamptz,
  updated_time timestamptz,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  synced_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT meta_campaigns_conn_meta_id_key UNIQUE (connection_id, meta_id)
);

CREATE TABLE IF NOT EXISTS public.meta_adsets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid NOT NULL REFERENCES public.meta_connections(id) ON DELETE CASCADE,
  ad_account_id text NOT NULL,
  meta_id text NOT NULL,
  campaign_meta_id text,
  name text,
  status text,
  effective_status text,
  optimization_goal text,
  billing_event text,
  daily_budget numeric,
  lifetime_budget numeric,
  created_time timestamptz,
  updated_time timestamptz,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  synced_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT meta_adsets_conn_meta_id_key UNIQUE (connection_id, meta_id)
);

CREATE TABLE IF NOT EXISTS public.meta_creatives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid NOT NULL REFERENCES public.meta_connections(id) ON DELETE CASCADE,
  ad_account_id text NOT NULL,
  meta_id text NOT NULL,
  name text,
  object_type text,
  title text,
  body text,
  call_to_action_type text,
  image_hash text,
  video_id text,
  source_image_url text,
  stored_path text,
  stored_md5 text,
  image_stored_at timestamptz,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  synced_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT meta_creatives_conn_meta_id_key UNIQUE (connection_id, meta_id)
);

CREATE TABLE IF NOT EXISTS public.meta_ads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid NOT NULL REFERENCES public.meta_connections(id) ON DELETE CASCADE,
  ad_account_id text NOT NULL,
  meta_id text NOT NULL,
  adset_meta_id text,
  campaign_meta_id text,
  creative_meta_id text,
  name text,
  status text,
  effective_status text,
  created_time timestamptz,
  updated_time timestamptz,
  made_by_skalx boolean NOT NULL DEFAULT false,
  skx_reason text CHECK (skx_reason IS NULL OR skx_reason IN ('name_prefix', 'image_hash')),
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  synced_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT meta_ads_conn_meta_id_key UNIQUE (connection_id, meta_id)
);
CREATE INDEX IF NOT EXISTS idx_meta_ads_skx ON public.meta_ads (connection_id) WHERE made_by_skalx;

CREATE TABLE IF NOT EXISTS public.meta_ad_insights_daily (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid NOT NULL REFERENCES public.meta_connections(id) ON DELETE CASCADE,
  ad_account_id text NOT NULL,
  ad_meta_id text NOT NULL,
  adset_meta_id text,
  campaign_meta_id text,
  date date NOT NULL,
  currency text,
  spend numeric NOT NULL DEFAULT 0,
  impressions bigint NOT NULL DEFAULT 0,
  reach bigint,
  frequency numeric,
  clicks bigint,
  link_clicks bigint,
  ctr numeric,
  cpc numeric,
  cpm numeric,
  purchases numeric,
  revenue numeric,
  roas numeric,
  cpa numeric,
  purchase_source text,
  roas_source text CHECK (roas_source IS NULL OR roas_source IN ('meta', 'derived')),
  actions jsonb NOT NULL DEFAULT '[]'::jsonb,
  action_values jsonb NOT NULL DEFAULT '[]'::jsonb,
  synced_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT meta_ad_insights_daily_conn_ad_date_key UNIQUE (connection_id, ad_meta_id, date)
);
CREATE INDEX IF NOT EXISTS idx_meta_ad_insights_conn_date
  ON public.meta_ad_insights_daily (connection_id, date);

-- Organic posts (Instagram media + Facebook Page posts).
-- Named meta_organic_* because public.social_posts already exists (publishing log).
CREATE TABLE IF NOT EXISTS public.meta_organic_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid NOT NULL REFERENCES public.meta_connections(id) ON DELETE CASCADE,
  platform text NOT NULL CHECK (platform IN ('instagram', 'facebook')),
  account_meta_id text NOT NULL,
  meta_id text NOT NULL,
  media_type text,
  caption text,
  permalink text,
  thumbnail_url text,
  posted_at timestamptz,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  synced_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT meta_organic_posts_conn_meta_id_key UNIQUE (connection_id, meta_id)
);
CREATE INDEX IF NOT EXISTS idx_meta_organic_posts_conn_posted ON public.meta_organic_posts (connection_id, posted_at DESC);

-- Lifetime metrics as of `date` (one snapshot per post per sync day).
CREATE TABLE IF NOT EXISTS public.meta_organic_post_insights_daily (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid NOT NULL REFERENCES public.meta_connections(id) ON DELETE CASCADE,
  post_meta_id text NOT NULL,
  date date NOT NULL,
  views bigint,
  reach bigint,
  likes bigint,
  comments bigint,
  saves bigint,
  shares bigint,
  interactions bigint,
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  synced_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT meta_organic_post_insights_daily_conn_post_date_key UNIQUE (connection_id, post_meta_id, date)
);

CREATE TABLE IF NOT EXISTS public.sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid NOT NULL REFERENCES public.meta_connections(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('full', 'incremental')),
  trigger text NOT NULL CHECK (trigger IN ('initial', 'schedule', 'manual')),
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'running', 'succeeded', 'partial', 'failed')),
  range_since date,
  range_until date,
  counts jsonb NOT NULL DEFAULT '{}'::jsonb,
  errors jsonb NOT NULL DEFAULT '[]'::jsonb,
  data_changed boolean NOT NULL DEFAULT false,
  external_run_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  finished_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_sync_runs_conn_created ON public.sync_runs (connection_id, created_at DESC);
-- At most one queued/running sync per connection.
CREATE UNIQUE INDEX IF NOT EXISTS uq_sync_runs_one_active
  ON public.sync_runs (connection_id) WHERE status IN ('queued', 'running');

-- MD5 of images SkalX generated, to tag ads whose image came from SkalX.
CREATE TABLE IF NOT EXISTS public.skalx_asset_hashes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  md5 text NOT NULL,
  source text NOT NULL,
  storage_path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT skalx_asset_hashes_user_md5_key UNIQUE (user_id, md5)
);

-- Private bucket for copies of ad creative images.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('meta-creatives', 'meta-creatives', false, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.meta_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meta_adsets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meta_creatives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meta_ads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meta_ad_insights_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meta_organic_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meta_organic_post_insights_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skalx_asset_hashes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.meta_campaigns, public.meta_adsets, public.meta_creatives, public.meta_ads,
  public.meta_ad_insights_daily, public.meta_organic_posts, public.meta_organic_post_insights_daily,
  public.sync_runs, public.skalx_asset_hashes FROM anon, authenticated;
