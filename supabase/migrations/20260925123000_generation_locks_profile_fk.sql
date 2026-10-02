-- Onboarding guests use shadow profile rows (no auth.users entry).
-- Demo generation locks must accept those profile IDs.
-- Billing tables keep their auth.users FKs; guests never touch billing.

ALTER TABLE public.generation_job_locks
  DROP CONSTRAINT IF EXISTS generation_job_locks_user_id_fkey;

ALTER TABLE public.generation_job_locks
  ADD CONSTRAINT generation_job_locks_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

COMMENT ON CONSTRAINT generation_job_locks_user_id_fkey ON public.generation_job_locks IS
  'Locks belong to a profile (authenticated or guest shadow). Billing remains on auth.users.';
