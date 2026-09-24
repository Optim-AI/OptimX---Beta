# SkalX Live — Production Migration Package (Phase 12.5)

**PREPARE ONLY. DO NOT APPLY AUTOMATICALLY.**

This directory is isolated from `supabase/migrations/` so historical LOCAL migrations
are not rewritten and so nothing here is auto-applied by `supabase db push` / CI.

## Do not

- Apply to Live without an approved change window
- Substitute TEST Razorpay plan IDs (`plan_TfW*`)
- Run wallet conversion from this package (dry-run report only)
- Commit/push/deploy as part of Phase 12.5 (preparation only)

## Required Live inputs before apply

Replace placeholders in `06_production_plan_catalog.sql`:

- `<LIVE_RAZORPAY_PLAN_ID_STARTER>`
- `<LIVE_RAZORPAY_PLAN_ID_GROWTH>`
- `<LIVE_RAZORPAY_PLAN_ID_PRO>`

The catalog SQL raises an exception if any placeholder remains.

## Execution order (manual)

1. `00_preflight_readonly.sql` — read-only checks; abort on failures
2. `01_credit_reservations.sql`
3. `02_billing_foundation.sql`
4. `03_subscription_cycles.sql`
5. `04_subscription_lifecycle.sql`
6. `05_video_seconds_idempotency.sql`
7. `06_production_plan_catalog.sql` — only after Live Razorpay IDs are substituted
8. `07_subscription_cycles_security.sql`
9. `99_postflight_readonly.sql` — read-only verification

Wallet review (separate, still dry-run):

```bash
npx tsx scripts/production/dry-run-live-video-wallet-report.ts \
  --database-url "$LIVE_DATABASE_URL"
```

Mutation is intentionally disabled in this phase.
