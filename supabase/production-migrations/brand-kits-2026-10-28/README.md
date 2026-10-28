# Brand Kits — Live migration package (2026-10-28)

**MANUAL APPLY ONLY.** Same SQL as these local migrations, wrapped in transactions:

- `supabase/migrations/20261028000000_add_brand_kits.sql`
- `supabase/migrations/20261028100000_merge_brand_guideline_into_brand_kit.sql`
- `supabase/migrations/20261028200000_add_product_cutouts.sql`

Do **not** use `supabase db push` for Live: it would push every local migration Live hasn't
recorded, not just these three.

Apply **before** deploying the code that reads Brand Kits. The app falls back to the
saved brand guideline if the tables are missing, but kits won't work until this runs.

## Execution order

Run each file as one execution (Supabase Dashboard → SQL Editor → paste the whole file → Run,
or `psql "$LIVE_DATABASE_URL" -v ON_ERROR_STOP=1 -f <file>`).

1. `00_preflight_readonly.sql` — read-only. Every prerequisite row must be `ok = true`;
   note `guidelines_to_carry_over` (≈ kits step 02 will create).
2. `01_add_brand_kits.sql` — creates `brand_kits` (RLS on, no browser access).
3. `02_merge_brand_guideline_into_brand_kit.sql` — adds `identity` and copies each user's
   brand guideline into a kit. `profiles.brand_snapshot` is not modified.
4. `03_add_product_cutouts.sql` — creates `product_cutouts` (only used when
   `POSTER_TEMPLATES` is on).
5. `99_postflight_readonly.sql` — read-only. Expect: both tables exist with
   `rls_enabled = true` and no anon/authenticated access; `users_with_two_defaults = 0`;
   `guidelines_without_kit = 0`.

Every step is idempotent: re-running any file creates nothing twice.

## Rollback

Code deployed with this package tolerates the tables being absent, so rolling back is:

```sql
BEGIN;
DROP TABLE IF EXISTS public.product_cutouts;
DROP TABLE IF EXISTS public.brand_kits;
COMMIT;
```

This discards kits users created or edited after the migration; brand guidelines in
`profiles.brand_snapshot` are untouched.

## Verified

Dry-run on a local copy (fresh apply, then a full re-run, then postflight, all inside a
rolled-back transaction): prerequisites ok, 2 of 4 guidelines carried over (2 empty
placeholders skipped), re-run created nothing, RLS on, no browser access, no duplicate defaults.
