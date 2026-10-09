-- ============================================================
-- Paid Ads Marketing Performance Data Layer
-- Extends existing integrations / ad_accounts without replacing
-- creative `campaigns` drafts or Creative Intelligence tables.
-- ============================================================

-- Enhance ad_accounts for multi-platform selection
ALTER TABLE public.ad_accounts
  ADD COLUMN IF NOT EXISTS provider text,
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS currency text,
  ADD COLUMN IF NOT EXISTS timezone text,
  ADD COLUMN IF NOT EXISTS status text,
  ADD COLUMN IF NOT EXISTS is_selected boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS metadata jsonb;

-- Backfill provider from parent integration when possible
UPDATE public.ad_accounts a
SET provider = i.provider
FROM public.integrations i
WHERE a.integration_id = i.id
  AND (a.provider IS NULL OR a.provider = '');

CREATE UNIQUE INDEX IF NOT EXISTS uq_ad_accounts_integration_account
  ON public.ad_accounts (integration_id, account_id);

CREATE INDEX IF NOT EXISTS idx_ad_accounts_provider
  ON public.ad_accounts (provider);

CREATE INDEX IF NOT EXISTS idx_ad_accounts_selected
  ON public.ad_accounts (integration_id, is_selected)
  WHERE is_selected = true;

-- Optional token ciphertext marker / encryption metadata on integrations
ALTER TABLE public.integrations
  ADD COLUMN IF NOT EXISTS token_encrypted boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS sync_status text DEFAULT 'idle',
  ADD COLUMN IF NOT EXISTS sync_error_message text;

COMMENT ON COLUMN public.integrations.token_encrypted IS
  'True when access_token/refresh_token values are AES-GCM ciphertext (enc:v1:...)';
COMMENT ON COLUMN public.integrations.sync_status IS
  'idle | syncing | success | error';

-- Platform advertising entities (NOT creative drafts in public.campaigns)
CREATE TABLE IF NOT EXISTS public.ad_platform_entities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id uuid NOT NULL REFERENCES public.integrations(id) ON DELETE CASCADE,
  ad_account_id uuid REFERENCES public.ad_accounts(id) ON DELETE CASCADE,
  provider text NOT NULL,
  entity_type text NOT NULL, -- campaign | adset | ad_group | ad | creative | keyword | lead_form | page
  external_id text NOT NULL,
  parent_external_id text,
  name text,
  status text,
  objective text,
  daily_budget numeric,
  lifetime_budget numeric,
  currency text,
  raw jsonb,
  metadata jsonb,
  first_seen_at timestamptz DEFAULT now(),
  last_seen_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT ad_platform_entities_type_check CHECK (
    entity_type IN (
      'campaign', 'adset', 'ad_group', 'ad', 'creative',
      'keyword', 'lead_form', 'page', 'business', 'customer'
    )
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_ad_platform_entities_ext
  ON public.ad_platform_entities (integration_id, entity_type, external_id);

CREATE INDEX IF NOT EXISTS idx_ad_platform_entities_account
  ON public.ad_platform_entities (ad_account_id);

CREATE INDEX IF NOT EXISTS idx_ad_platform_entities_parent
  ON public.ad_platform_entities (integration_id, parent_external_id);

CREATE INDEX IF NOT EXISTS idx_ad_platform_entities_provider_type
  ON public.ad_platform_entities (provider, entity_type);

-- Daily metrics fact table (unified across Meta / Google / LinkedIn)
CREATE TABLE IF NOT EXISTS public.ad_metrics_daily (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id uuid NOT NULL REFERENCES public.integrations(id) ON DELETE CASCADE,
  ad_account_id uuid REFERENCES public.ad_accounts(id) ON DELETE CASCADE,
  provider text NOT NULL,
  entity_type text NOT NULL DEFAULT 'account', -- account | campaign | adset | ad_group | ad | creative | keyword
  entity_external_id text NOT NULL,
  metric_date date NOT NULL,
  spend numeric DEFAULT 0,
  impressions bigint DEFAULT 0,
  reach bigint DEFAULT 0,
  frequency numeric,
  clicks bigint DEFAULT 0,
  ctr numeric,
  cpc numeric,
  cpm numeric,
  conversions numeric DEFAULT 0,
  conversion_value numeric DEFAULT 0,
  cpa numeric,
  cpl numeric,
  roas numeric,
  currency text,
  raw jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_ad_metrics_daily_grain
  ON public.ad_metrics_daily (
    integration_id, entity_type, entity_external_id, metric_date
  );

CREATE INDEX IF NOT EXISTS idx_ad_metrics_daily_account_date
  ON public.ad_metrics_daily (ad_account_id, metric_date DESC);

CREATE INDEX IF NOT EXISTS idx_ad_metrics_daily_provider_date
  ON public.ad_metrics_daily (provider, metric_date DESC);

CREATE INDEX IF NOT EXISTS idx_ad_metrics_daily_entity
  ON public.ad_metrics_daily (entity_type, entity_external_id);

-- Sync run audit log
CREATE TABLE IF NOT EXISTS public.ad_sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id uuid NOT NULL REFERENCES public.integrations(id) ON DELETE CASCADE,
  ad_account_id uuid REFERENCES public.ad_accounts(id) ON DELETE SET NULL,
  provider text NOT NULL,
  trigger_source text NOT NULL DEFAULT 'manual', -- manual | cron | reconnect
  status text NOT NULL DEFAULT 'running', -- running | success | partial | error
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  since_date date,
  until_date date,
  entities_upserted integer DEFAULT 0,
  metrics_upserted integer DEFAULT 0,
  error_message text,
  details jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ad_sync_runs_integration
  ON public.ad_sync_runs (integration_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_ad_sync_runs_status
  ON public.ad_sync_runs (status, started_at DESC);

-- RLS: service role / server DAO access; mirror integrations pattern
ALTER TABLE public.ad_platform_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_metrics_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_sync_runs ENABLE ROW LEVEL SECURITY;

-- Policies: authenticated users can read their own rows via integration ownership
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'ad_platform_entities' AND policyname = 'ad_platform_entities_select_own'
  ) THEN
    CREATE POLICY ad_platform_entities_select_own ON public.ad_platform_entities
      FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.integrations i
          WHERE i.id = ad_platform_entities.integration_id
            AND i.user_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'ad_metrics_daily' AND policyname = 'ad_metrics_daily_select_own'
  ) THEN
    CREATE POLICY ad_metrics_daily_select_own ON public.ad_metrics_daily
      FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.integrations i
          WHERE i.id = ad_metrics_daily.integration_id
            AND i.user_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'ad_sync_runs' AND policyname = 'ad_sync_runs_select_own'
  ) THEN
    CREATE POLICY ad_sync_runs_select_own ON public.ad_sync_runs
      FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.integrations i
          WHERE i.id = ad_sync_runs.integration_id
            AND i.user_id = auth.uid()
        )
      );
  END IF;
END $$;
