-- Free marketing audit (pre-signup acquisition layer).
-- Owned by a profile id: the guest shadow profile from onboarding_guest_sessions
-- until claim, then the authenticated user. Additive only.

CREATE TABLE IF NOT EXISTS public.marketing_audits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  website_url text NOT NULL,
  normalized_host text NOT NULL,
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'running', 'completed', 'partial', 'failed')),
  stage text NOT NULL DEFAULT 'queued',
  attempt_count integer NOT NULL DEFAULT 0,
  lease_expires_at timestamptz,
  site jsonb,
  brand jsonb,
  competitors jsonb NOT NULL DEFAULT '[]'::jsonb,
  competitor_posts jsonb NOT NULL DEFAULT '[]'::jsonb,
  insights jsonb,
  ideas jsonb NOT NULL DEFAULT '[]'::jsonb,
  sources jsonb NOT NULL DEFAULT '[]'::jsonb,
  limitations jsonb NOT NULL DEFAULT '[]'::jsonb,
  selected_idea_index integer CHECK (selected_idea_index IS NULL OR selected_idea_index BETWEEN 0 AND 2),
  campaign_session_id uuid REFERENCES public.creative_studio_sessions(id) ON DELETE SET NULL,
  campaign_lock_at timestamptz,
  client_ip_hash text,
  error jsonb,
  claimed_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_marketing_audits_user_created
  ON public.marketing_audits (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_marketing_audits_ip_created
  ON public.marketing_audits (client_ip_hash, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_marketing_audits_user_host
  ON public.marketing_audits (user_id, normalized_host);

-- Server-only table (Drizzle / service connection), same as onboarding_guest_sessions.
-- RLS on with no policies blocks Data API access for anon and authenticated roles.
ALTER TABLE public.marketing_audits ENABLE ROW LEVEL SECURITY;
