-- Keep the financial ledger when an auth user is deleted.
-- payments, subscriptions, subscription_cycles, and credit_history currently
-- reference auth.users ON DELETE CASCADE, so deleting an account erases them.
-- Drop only those foreign keys. user_id stays NOT NULL and keeps the historical
-- auth uuid for reconciliation. No rows, tables, functions, triggers, or RLS
-- policies are removed.

ALTER TABLE public.payments
  DROP CONSTRAINT IF EXISTS payments_user_id_fkey;

ALTER TABLE public.subscriptions
  DROP CONSTRAINT IF EXISTS subscriptions_user_id_fkey;

ALTER TABLE public.subscription_cycles
  DROP CONSTRAINT IF EXISTS subscription_cycles_user_id_fkey;

ALTER TABLE public.credit_history
  DROP CONSTRAINT IF EXISTS credit_history_user_id_fkey;

COMMENT ON COLUMN public.payments.user_id IS
  'Historical auth.users id. Retained after the account is deleted; not a foreign key.';

COMMENT ON COLUMN public.subscriptions.user_id IS
  'Historical auth.users id. Retained after the account is deleted; not a foreign key.';

COMMENT ON COLUMN public.subscription_cycles.user_id IS
  'Historical auth.users id. Retained after the account is deleted; not a foreign key.';

COMMENT ON COLUMN public.credit_history.user_id IS
  'Historical auth.users id. Retained after the account is deleted; not a foreign key.';
