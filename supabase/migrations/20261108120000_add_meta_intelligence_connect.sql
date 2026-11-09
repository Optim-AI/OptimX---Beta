-- ============================================================
-- Meta Intelligence — Phase 1 (Connect)
-- ============================================================
-- meta_connections: one read-only Meta connection per user (the brand).
--   The access token is stored AES-256-GCM encrypted (token_enc); it is
--   never returned to the browser.
-- meta_assets: ad accounts, Pages and Instagram accounts the token can see,
--   with the ones the user linked marked selected.
-- meta_deletion_requests: audit trail for Meta's data-deletion callback,
--   deauthorize callback and in-app Disconnect. Holds no Meta data itself.
--
-- Separate from the legacy `integrations` table (publishing flow), which is
-- left untouched.
-- Accessed only from server code (service role / postgres), so RLS is on with
-- no policies and anon/authenticated have no table access.

CREATE TABLE IF NOT EXISTS public.meta_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  brand_kit_id uuid REFERENCES public.brand_kits(id) ON DELETE SET NULL,
  meta_user_id text,
  meta_user_name text,
  business_id text,
  business_name text,
  token_enc text NOT NULL,
  token_type text NOT NULL DEFAULT 'user'
    CHECK (token_type IN ('system_user', 'user')),
  scopes text[] NOT NULL DEFAULT '{}',
  token_expires_at timestamptz,
  data_access_expires_at timestamptz,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'expired', 'revoked', 'error')),
  last_error text,
  last_checked_at timestamptz,
  last_sync_at timestamptz,
  capabilities jsonb NOT NULL DEFAULT '{}'::jsonb,
  connected_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT meta_connections_user_id_key UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_meta_connections_meta_user_id
  ON public.meta_connections (meta_user_id);
CREATE INDEX IF NOT EXISTS idx_meta_connections_status
  ON public.meta_connections (status);

CREATE TABLE IF NOT EXISTS public.meta_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid NOT NULL REFERENCES public.meta_connections(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('ad_account', 'page', 'ig_account')),
  meta_id text NOT NULL,
  name text,
  parent_meta_id text,
  currency text,
  timezone_name text,
  account_status integer,
  page_token_enc text,
  selected boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT meta_assets_connection_kind_meta_id_key UNIQUE (connection_id, kind, meta_id)
);

CREATE INDEX IF NOT EXISTS idx_meta_assets_user_id ON public.meta_assets (user_id);
CREATE INDEX IF NOT EXISTS idx_meta_assets_selected
  ON public.meta_assets (connection_id, kind) WHERE selected;

CREATE TABLE IF NOT EXISTS public.meta_deletion_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  confirmation_code text NOT NULL,
  source text NOT NULL CHECK (source IN ('meta_callback', 'deauthorize', 'user_disconnect')),
  meta_user_id text,
  user_id uuid,
  status text NOT NULL DEFAULT 'received'
    CHECK (status IN ('received', 'completed', 'no_data', 'failed')),
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  requested_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  CONSTRAINT meta_deletion_requests_code_key UNIQUE (confirmation_code)
);

ALTER TABLE public.meta_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meta_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meta_deletion_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.meta_connections FROM anon, authenticated;
REVOKE ALL ON public.meta_assets FROM anon, authenticated;
REVOKE ALL ON public.meta_deletion_requests FROM anon, authenticated;
