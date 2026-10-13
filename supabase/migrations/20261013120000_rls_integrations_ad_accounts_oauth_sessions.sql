-- ============================================================
-- PR C: RLS for credential-bearing integration tables
-- Tables: public.integrations, public.ad_accounts, public.oauth_sessions
--
-- Intent:
-- - Deny anonymous PostgREST access to tokens / OAuth session JSON
-- - Allow authenticated users to SELECT only their own integration rows
--   (needed for warehouse RLS EXISTS subqueries + legacy summaryMetrics)
-- - Allow authenticated users to SELECT only ad_accounts owned via their
--   integrations (no write policies — writes go through server DAOs)
-- - Deny all client roles on oauth_sessions (server DAO / postgres /
--   service_role only; oauth_sessions.data holds short-lived tokens)
--
-- Does NOT use FORCE ROW LEVEL SECURITY so table owner / DATABASE_URL
-- (postgres) and service_role continue to bypass RLS for OAuth callbacks,
-- finalize, token refresh, and Ads sync DAOs.
-- ============================================================

-- ---------------------------------------------------------------------------
-- integrations
-- ---------------------------------------------------------------------------
ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS integrations_select_own ON public.integrations;
CREATE POLICY integrations_select_own
  ON public.integrations
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- No INSERT/UPDATE/DELETE policies for authenticated/anon:
-- all mutations must use server DAOs (DATABASE_URL / service_role).

COMMENT ON TABLE public.integrations IS
  'Per-user provider credentials. RLS: authenticated SELECT own rows only; writes via server role.';

-- ---------------------------------------------------------------------------
-- ad_accounts (no user_id column — ownership via integrations)
-- ---------------------------------------------------------------------------
ALTER TABLE public.ad_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ad_accounts_select_own ON public.ad_accounts;
CREATE POLICY ad_accounts_select_own
  ON public.ad_accounts
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.integrations i
      WHERE i.id = ad_accounts.integration_id
        AND i.user_id = auth.uid()
    )
  );

COMMENT ON TABLE public.ad_accounts IS
  'Discovered/selected ad accounts. RLS: authenticated SELECT via owning integration; writes via server role.';

-- ---------------------------------------------------------------------------
-- oauth_sessions (user_id is text; data jsonb may contain tokens)
-- No policies for anon/authenticated → deny all PostgREST access when RLS on.
-- ---------------------------------------------------------------------------
ALTER TABLE public.oauth_sessions ENABLE ROW LEVEL SECURITY;

-- Explicitly drop any accidental client policies if re-applied
DROP POLICY IF EXISTS oauth_sessions_select_own ON public.oauth_sessions;
DROP POLICY IF EXISTS oauth_sessions_insert_own ON public.oauth_sessions;
DROP POLICY IF EXISTS oauth_sessions_update_own ON public.oauth_sessions;
DROP POLICY IF EXISTS oauth_sessions_delete_own ON public.oauth_sessions;

COMMENT ON TABLE public.oauth_sessions IS
  'Temporary OAuth selection sessions (may include tokens in data). RLS enabled with no client policies — server role only.';
