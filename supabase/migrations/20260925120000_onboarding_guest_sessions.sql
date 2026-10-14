-- Pre-auth onboarding session. Shadow profile_id lets existing brand snapshot,
-- preferences, locks, and poster generation run before an account exists.
-- Claim reassigns that work onto the real user.

CREATE TABLE IF NOT EXISTS onboarding_guest_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash text NOT NULL,
  profile_id uuid NOT NULL,
  claimed_by uuid,
  claimed_at timestamptz,
  expires_at timestamptz NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS onboarding_guest_sessions_token_hash_key
  ON onboarding_guest_sessions (token_hash);
CREATE UNIQUE INDEX IF NOT EXISTS onboarding_guest_sessions_profile_id_key
  ON onboarding_guest_sessions (profile_id);

-- Server-only table (Drizzle / service connection). Block Data API access.
ALTER TABLE onboarding_guest_sessions ENABLE ROW LEVEL SECURITY;
