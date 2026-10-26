-- ============================================================
-- Enable RLS on public tables that were reachable with the anon key
-- ============================================================
-- These tables had RLS disabled while `anon` and `authenticated` held
-- table grants, so anyone with NEXT_PUBLIC_SUPABASE_ANON_KEY could read
-- and modify them through PostgREST (e.g. edit profiles, insert vouchers).
--
-- Server code uses the service role / postgres connection, which bypasses
-- RLS, so it is unaffected. Only two tables are queried directly from the
-- browser and get owner-scoped policies:
--   - campaigns         (create-campaign, image-library, analytics, notifications)
--   - integrationsbeta  (integrations, integrationsbeta)
-- Every other table is server-only: RLS on with no policies denies anon and
-- authenticated access.

-- 1. Enable RLS and remove anonymous access
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'app_settings',
    'campaigns',
    'creative_intelligence_brands',
    'creative_intelligence_competitors',
    'creative_intelligence_creatives',
    'creative_intelligence_facebook_pages',
    'creative_intelligence_google_ranks',
    'creative_intelligence_hooks',
    'creative_intelligence_meta_ads',
    'creative_intelligence_reviews',
    'creative_intelligence_runs',
    'creative_intelligence_strategies',
    'feature_keys',
    'integration_flags',
    'integrationsbeta',
    'plan_feature_flags',
    'profiles',
    'reports',
    'subscription_cycles',
    'training_artifacts',
    'user_chats',
    'user_generated_images',
    'user_ui_state',
    'vouchers'
  ]
  LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
      EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
    END IF;
  END LOOP;
END $$;

-- 2. campaigns: signed-in users manage only their own rows
DROP POLICY IF EXISTS "campaigns_owner_select" ON public.campaigns;
DROP POLICY IF EXISTS "campaigns_owner_insert" ON public.campaigns;
DROP POLICY IF EXISTS "campaigns_owner_update" ON public.campaigns;
DROP POLICY IF EXISTS "campaigns_owner_delete" ON public.campaigns;

CREATE POLICY "campaigns_owner_select" ON public.campaigns
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "campaigns_owner_insert" ON public.campaigns
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "campaigns_owner_update" ON public.campaigns
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "campaigns_owner_delete" ON public.campaigns
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- 3. integrationsbeta: users submit and read their own beta request.
--    No update/delete: status is changed by admins via the service role.
DROP POLICY IF EXISTS "integrationsbeta_owner_select" ON public.integrationsbeta;
DROP POLICY IF EXISTS "integrationsbeta_owner_insert" ON public.integrationsbeta;

CREATE POLICY "integrationsbeta_owner_select" ON public.integrationsbeta
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "integrationsbeta_owner_insert" ON public.integrationsbeta
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
