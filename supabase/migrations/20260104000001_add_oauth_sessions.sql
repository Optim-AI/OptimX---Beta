-- Add OAuth Sessions Table
-- This table stores temporary OAuth session data during the OAuth flow
-- Created: 2026-01-04

CREATE TABLE IF NOT EXISTS public.oauth_sessions (
    id text PRIMARY KEY NOT NULL,
    user_id text NOT NULL,
    provider text NOT NULL,
    data jsonb NOT NULL,
    expires_at timestamptz NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS oauth_sessions_user_id_idx ON public.oauth_sessions USING btree (user_id);
CREATE INDEX IF NOT EXISTS oauth_sessions_provider_idx ON public.oauth_sessions USING btree (provider);
CREATE INDEX IF NOT EXISTS oauth_sessions_expires_at_idx ON public.oauth_sessions USING btree (expires_at);

-- Comment
COMMENT ON TABLE public.oauth_sessions IS 'Temporary storage for OAuth session data during authentication flows';
