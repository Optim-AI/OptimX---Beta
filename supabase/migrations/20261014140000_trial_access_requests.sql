-- Manual free-trial access requests (sales review). Submitting a row never
-- creates a subscription, grants credits, or changes entitlements.

CREATE TABLE IF NOT EXISTS public.trial_access_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  email text NOT NULL,
  company_name text NOT NULL,
  website_url text,
  use_case text NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'activated')),
  client_ip_hash text,
  user_agent text,
  notify_sent_at timestamptz,
  notify_error text,
  reviewed_at timestamptz,
  reviewed_by text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_trial_access_requests_email_created
  ON public.trial_access_requests (lower(email), created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trial_access_requests_status_created
  ON public.trial_access_requests (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trial_access_requests_ip_created
  ON public.trial_access_requests (client_ip_hash, created_at DESC);

-- Server-only (Drizzle / service role). No Data API policies for anon/authenticated.
ALTER TABLE public.trial_access_requests ENABLE ROW LEVEL SECURITY;
