-- ============================================================
-- PR W2.0: Meta Ads local draft persistence
--
-- Separate from creative `campaigns` and synced `ad_platform_entities`.
-- Stores SkalX-configured paid Ads drafts only. Does not prove Meta
-- campaign existence. Access tokens are never stored here.
--
-- Do not apply to production until reviewed.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.meta_ads_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  integration_id uuid NOT NULL REFERENCES public.integrations(id) ON DELETE CASCADE,
  -- RESTRICT: deleting an ad account must not silently orphan/drop drafts
  ad_account_id uuid NOT NULL REFERENCES public.ad_accounts(id) ON DELETE RESTRICT,

  status text NOT NULL DEFAULT 'draft'
    CHECK (
      status IN (
        'draft',
        'validating',
        'creating',
        'created_paused',
        'partial_failure',
        'failed',
        'archived'
      )
    ),

  name text,
  objective text,

  -- User-facing major units (e.g. 10.50 USD). Currency stamped from ad_accounts.
  daily_budget_major numeric,
  currency text NOT NULL,

  schedule_start timestamptz,
  schedule_end timestamptz,

  targeting jsonb NOT NULL DEFAULT '{}'::jsonb,
  placements jsonb NOT NULL DEFAULT '{}'::jsonb,

  source_image_id uuid,
  source_image_url text,
  primary_text text,
  headline text,
  destination_url text,
  call_to_action text,

  -- Nullable Meta Marketing API object ids (set only by trusted create path later)
  meta_campaign_id text,
  meta_adset_id text,
  meta_creative_id text,
  meta_ad_id text,

  idempotency_key text,
  create_attempt_id text,

  last_error_code text,
  last_error_message text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_on_meta_at timestamptz,

  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- Local-only statuses must not carry fabricated Meta object ids
  CONSTRAINT meta_ads_drafts_meta_ids_local_status_check CHECK (
    status IN ('creating', 'created_paused', 'partial_failure')
    OR (
      meta_campaign_id IS NULL
      AND meta_adset_id IS NULL
      AND meta_creative_id IS NULL
      AND meta_ad_id IS NULL
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_meta_ads_drafts_user_created
  ON public.meta_ads_drafts (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_meta_ads_drafts_user_status
  ON public.meta_ads_drafts (user_id, status);

CREATE INDEX IF NOT EXISTS idx_meta_ads_drafts_integration
  ON public.meta_ads_drafts (integration_id);

CREATE INDEX IF NOT EXISTS idx_meta_ads_drafts_ad_account
  ON public.meta_ads_drafts (ad_account_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_meta_ads_drafts_user_idempotency
  ON public.meta_ads_drafts (user_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

COMMENT ON TABLE public.meta_ads_drafts IS
  'Local Meta Ads campaign drafts (W2.0). Not creative campaigns. Not proof of Meta objects. No access tokens. RLS: own rows for authenticated; server DAOs use DATABASE_URL.';

COMMENT ON COLUMN public.meta_ads_drafts.currency IS
  'Stamped from selected ad_accounts.currency at write time — never trust client currency alone.';

COMMENT ON COLUMN public.meta_ads_drafts.daily_budget_major IS
  'Budget in major currency units (e.g. 10.50). Convert with Meta offset helpers before Graph writes.';

COMMENT ON COLUMN public.meta_ads_drafts.status IS
  'draft | validating | creating | created_paused | partial_failure | failed | archived. Local draft ≠ Meta campaign.';

-- ---------------------------------------------------------------------------
-- RLS: authenticated users may only touch their own drafts.
-- Mutations also go through server DAOs (DATABASE_URL / table owner bypasses
-- non-FORCE RLS) with application ownership checks.
-- ---------------------------------------------------------------------------
ALTER TABLE public.meta_ads_drafts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS meta_ads_drafts_select_own ON public.meta_ads_drafts;
CREATE POLICY meta_ads_drafts_select_own
  ON public.meta_ads_drafts FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS meta_ads_drafts_insert_own ON public.meta_ads_drafts;
CREATE POLICY meta_ads_drafts_insert_own
  ON public.meta_ads_drafts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS meta_ads_drafts_update_own ON public.meta_ads_drafts;
CREATE POLICY meta_ads_drafts_update_own
  ON public.meta_ads_drafts FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS meta_ads_drafts_delete_own ON public.meta_ads_drafts;
CREATE POLICY meta_ads_drafts_delete_own
  ON public.meta_ads_drafts FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
