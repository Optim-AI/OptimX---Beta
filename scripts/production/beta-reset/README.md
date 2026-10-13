# SkalX production user reset

Removes the 23 auth users listed in `manifest.json` from **SkalX - Live** (`jjfoymnhchfpjstomipr`) and their application data. Payment, subscription, cycle, purchase-history, and webhook rows stay. The schema is not dropped.

`npm run db:reset:production` drops every public table. Do not use it.

## Blocker before execute

`payments`, `subscriptions`, `subscription_cycles`, and `credit_history` reference `auth.users` with `ON DELETE CASCADE`. Deleting an account today would erase that ledger.

Apply this migration first. It drops only those four foreign keys and leaves `user_id` filled with the historical auth uuid:

`supabase/migrations/20261010120000_preserve_financial_rows_on_auth_delete.sql`

Execute refuses while those cascades still exist.

## What is removed

The manifest ids only. A newer signup that is not in the manifest is kept.

Also removed for those ids: profiles, credit wallets, vouchers, campaigns, creative-studio and content-studio rows, creative-intelligence runs, reports, and storage objects whose path contains that user id and no other user id.

## What stays

- The 5 payment rows, 3 subscription rows, 1 subscription cycle, and 1,458 webhook events
- 3 plans, 5 credit packs, 15 feature keys, 45 plan feature flags, and app settings
- 366 storage objects whose folder id is not one of the 23 users

## Razorpay

Do not capture or refund anything from this workflow. The reset script does not call Razorpay.

Both Razorpay subscriptions for designeraj0@gmail.com already have a processed `subscription.cancelled` webhook (24 Sep 2026 and 26 Sep 2026). Deleting the auth user does not cancel a provider subscription; these two are already cancelled in that ledger. The paid Starter period in our database runs through 24 Oct 2026 and the cycle row is kept.

The INR 590 image order for ajs.sudhar@gmail.com is still `created` locally, with no payment id and no webhook. It was created on 25 Feb 2026. Do not capture it. This workspace only has a Razorpay **test** key, and that key cannot see these production ids. Re-check with the live key before execute:

```bash
RAZORPAY_KEY_ID=rzp_live_... RAZORPAY_KEY_SECRET=... \
  npx tsx scripts/production/beta-reset/razorpay-preflight.ts
```

## Dry run

Does not read `.env.local`. The workspace URL is localhost, so pass the live database URL.

```bash
npx tsx scripts/production/beta-reset/dry-run.ts \
  --database-url "$DATABASE_URL" \
  --out scripts/production/beta-reset/out/dry-run.json
```

Copy the snapshot hash. Do not reuse a hash from before this manifest.

## Execute

Only after the migration is applied and the dry-run hash has been reviewed.

```bash
SUPABASE_URL="https://jjfoymnhchfpjstomipr.supabase.co" \
SUPABASE_SERVICE_ROLE_KEY="$SUPABASE_SERVICE_ROLE_KEY" \
npx tsx scripts/production/beta-reset/execute.ts \
  --database-url "$DATABASE_URL" \
  --execute \
  --confirm-project jjfoymnhchfpjstomipr \
  --snapshot <hash-from-the-new-dry-run>
```

Auth users are deleted with `DELETE /auth/v1/admin/users/{id}`. If that call fails partway, rerun the same command with `--resume`. Issued access tokens stay valid until they expire.

Confirm the Supabase dashboard has no Database Webhook on `auth.users` delete before executing, so the admin delete does not fan out to email or other services.
