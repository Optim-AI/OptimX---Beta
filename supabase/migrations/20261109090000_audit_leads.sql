-- Free brand audit leads: one free audit per email, plus the details sales follows up on.
-- Additive only. Server-only table (Drizzle / service connection), like marketing_audits.

CREATE TABLE IF NOT EXISTS public.audit_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  -- Lower-cased, trimmed email. One free audit per email.
  email_normalized text NOT NULL,
  category text,
  website_url text NOT NULL,
  normalized_host text NOT NULL,
  audit_id uuid REFERENCES public.marketing_audits(id) ON DELETE SET NULL,
  client_ip_hash text,
  -- One sample ad per lead (Nano Banana), generated once after the audit completes.
  sample_ad_status text CHECK (sample_ad_status IS NULL OR sample_ad_status IN ('generating', 'ready', 'failed', 'skipped')),
  sample_ad_url text,
  sample_ad_error text,
  sample_ad_started_at timestamptz,
  sample_ad_created_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_audit_leads_email_normalized
  ON public.audit_leads (email_normalized);
CREATE INDEX IF NOT EXISTS idx_audit_leads_created
  ON public.audit_leads (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_leads_audit
  ON public.audit_leads (audit_id);
CREATE INDEX IF NOT EXISTS idx_audit_leads_sample_created
  ON public.audit_leads (sample_ad_created_at DESC);

-- RLS on with no policies blocks Data API access for anon and authenticated roles.
ALTER TABLE public.audit_leads ENABLE ROW LEVEL SECURITY;
