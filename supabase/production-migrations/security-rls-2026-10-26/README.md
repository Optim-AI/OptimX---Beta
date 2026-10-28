# Security (RLS) — Live migration package (2026-10-26)

**MANUAL APPLY ONLY.** Same SQL as `supabase/migrations/20261026000000_enable_rls_exposed_tables.sql`,
wrapped in one transaction. Do not use `supabase db push` for Live.

## What it does

24 public tables were readable and writable by anyone holding the public anon key
(`NEXT_PUBLIC_SUPABASE_ANON_KEY`) through the Supabase REST API — e.g. editing any profile or
inserting vouchers. This enables RLS on them and revokes anon access.

- Server code uses the service role / postgres connection, which bypasses RLS: unaffected.
- The browser queries two tables directly; they get owner-only policies:
  `campaigns` (select/insert/update/delete own rows) and `integrationsbeta` (select/insert own rows).
- Every other listed table becomes server-only.

## Execution order

Run each file as one execution (SQL Editor, or `psql "$LIVE_DATABASE_URL" -v ON_ERROR_STOP=1 -f <file>`).

1. `00_preflight_readonly.sql` — section A must be all `ok = true`. Section B shows today's exposure;
   section C lists existing policies (they keep working).
2. `01_enable_rls_exposed_tables.sql`
3. `99_postflight_readonly.sql` — expect every table `rls_enabled = true`, `anon_has_access = false`,
   6 owner policies, and no rows under `still_open_to_anon` (any row there is a table outside this
   list — review it separately).

Then, signed in on the live site, check the screens that read Supabase directly from the browser:
create campaign, image library, analytics, notifications, and the integrations beta request.

## Rollback

If a browser screen breaks, re-open only that table while you fix it, e.g.:

```sql
ALTER TABLE public.<table> DISABLE ROW LEVEL SECURITY;
```

## Verified

Dry-run on the local database inside a rolled-back transaction (RLS first switched off on
`profiles`/`campaigns` and anon re-granted, to simulate Live): prerequisites ok, applied twice
without error, all 24 tables secured, 6 policies present, nothing left open to anon.
