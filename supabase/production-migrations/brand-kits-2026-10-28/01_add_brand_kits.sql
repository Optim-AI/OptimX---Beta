-- Brand Kits Live package — 01 brand_kits table
-- MANUAL APPLY ONLY. Same SQL as supabase/migrations/20261028000000_add_brand_kits.sql.
-- Idempotent (IF NOT EXISTS). Runs in one transaction.

BEGIN;

-- ============================================================
-- Brand Kits: a brand's own design system (logo, colours with roles,
-- fonts, rules) used to steer poster generation.
-- ============================================================
-- One user can own several kits (agencies manage multiple brands);
-- at most one kit per user is the default.
-- Accessed only from server code (service role / postgres), so RLS is on
-- with no policies and anon/authenticated have no table access.

CREATE TABLE IF NOT EXISTS public.brand_kits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  website_url text,
  is_default boolean NOT NULL DEFAULT false,
  logo jsonb,
  colors jsonb NOT NULL DEFAULT '[]'::jsonb,
  fonts jsonb NOT NULL DEFAULT '{}'::jsonb,
  guidelines jsonb NOT NULL DEFAULT '{}'::jsonb,
  extraction jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_brand_kits_user_id ON public.brand_kits (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_brand_kits_one_default_per_user
  ON public.brand_kits (user_id) WHERE is_default;

ALTER TABLE public.brand_kits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.brand_kits FROM anon, authenticated;

COMMIT;
