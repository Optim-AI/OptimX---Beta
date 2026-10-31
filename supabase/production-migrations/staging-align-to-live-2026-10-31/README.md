# Staging align to Live (2026-10-31)

**Target:** SkalX - Staging only (`lgwobyuucvlvsfxapnwf`).  
**Do not run on Live.**

Brings Staging schema / storage / RLS in line with Live for:

- `marketing_audits`
- `trial_access_requests`
- `poster_carousel_campaigns` + `poster_carousel_slides`
- `brand_kits` (+ identity merge from guidelines)
- `product_cutouts`
- storage buckets `Posters`, `Videos`
- `campaign-assets` video MIME types
- same public-table RLS lock as Live
- revoke public EXECUTE on the four privileged functions

## Apply

1. Open Supabase → **SkalX - Staging** → SQL Editor.
2. Paste and run `01_align.sql` as one script.
3. Optionally run `99_postflight_readonly.sql` and confirm all rows look healthy.

Or with `psql` / node using the Staging database password from  
Settings → Database (the password in `scripts/sync-local-to-staging.sh` is stale).
