# Staging database migrations (Supabase staging, used by demo.skalxai.app)

These migrations add the tables behind Meta Intelligence: Ad Performance, AI insights, test packs, the Monday brief, Ad Studio posters, Trends and the Instagram tabs. Run them on the **staging** Supabase project only, not production.

All ten files are safe to run twice. They use `IF NOT EXISTS`, `ON CONFLICT` or `DROP … IF EXISTS`, so a file that has already been applied changes nothing.

## The migrations, in order

All files are in `supabase/migrations/`. Run them in this order.

| # | File | What it adds |
|---|------|--------------|
| 1 | `20261108120000_add_meta_intelligence_connect.sql` | `meta_connections`, `meta_assets`, `meta_deletion_requests` (the Meta login and the chosen ad accounts/pages) |
| 2 | `20261108130000_add_meta_intelligence_sync.sql` | `sync_runs`, `meta_campaigns`, `meta_adsets`, `meta_ads`, `meta_creatives`, `meta_ad_insights_daily`, `meta_organic_posts`, `meta_organic_post_insights_daily`, `skalx_asset_hashes`, and the private bucket `meta-creatives` |
| 3 | `20261108140000_add_meta_ai_insights.sql` | `ai_insights` (the Gemini insights) |
| 4 | `20261108150000_add_test_packs.sql` | `test_packs`, `test_pack_variants`, and the private bucket `test-packs` |
| 5 | `20261108160000_add_weekly_briefs.sql` | `weekly_briefs` (the Monday brief), plus new columns on `meta_connections` and `test_packs` |
| 6 | `20261108170000_add_ad_studio_drafts.sql` | `ad_studio_projects`, `ad_studio_drafts`, and the private bucket `ad-drafts` |
| 7 | `20261108180000_ad_studio_kept_posters.sql` | Kept-poster index, and a column linking a brief to a poster project |
| 8 | `20261109090000_audit_leads.sql` | `audit_leads` (the free audit / sample ads form; from the other session) |
| 9 | `20261109120000_add_trends.sql` | `trend_snapshots`, `brand_trend_ideas` (Trends page) |
| 10 | `20261109130000_add_instagram_watch.sql` | `ig_watch_items`, `ig_hashtag_queries`, `ig_style_reads` (Instagram and Competitors tabs) |

Number 8 was not in the original list of nine. It's included because the deployed code uses it. If staging already has it, running it again does nothing.

## Before you start

1. Open the Supabase dashboard and confirm that the selected project is **staging**. The project name is at the top left.
2. Back up the database: **Database → Backups**. Or check that a recent daily backup exists.
3. Run this check in **SQL Editor** to see what staging already has:

```sql
select table_name from information_schema.tables
where table_schema = 'public' and table_name in (
  'meta_connections','meta_assets','meta_deletion_requests','sync_runs','meta_campaigns','meta_adsets',
  'meta_ads','meta_creatives','meta_ad_insights_daily','meta_organic_posts','meta_organic_post_insights_daily',
  'skalx_asset_hashes','ai_insights','test_packs','test_pack_variants','weekly_briefs','ad_studio_projects',
  'ad_studio_drafts','audit_leads','trend_snapshots','brand_trend_ideas','ig_watch_items','ig_hashtag_queries','ig_style_reads')
order by 1;
```

The new migrations also link to two older tables, `brand_kits` and `marketing_audits`, which must already exist. Check them with:

```sql
select table_name from information_schema.tables
where table_schema = 'public' and table_name in ('brand_kits','marketing_audits');
```

You should see both. If either is missing, stop and send the result back. It means staging is missing older migrations, or you're in the wrong project.

## How to run them (recommended: SQL Editor)

Repeat these steps for each file, 1 to 10, in order:

1. Open the file in Cursor and copy everything in it.
2. In the Supabase dashboard, go to **SQL Editor → New query**, paste, and click **Run**.
3. Wait for "Success. No rows returned". If you see an error, stop and send the error text back. Don't skip ahead to the next file.

Use the SQL Editor rather than `supabase db push`. `db push` would also try every older migration that staging's history table doesn't list, and it would point at whichever project the CLI is linked to.

### Prompt you can paste into Cursor

> Open these 10 files in `supabase/migrations/` in this exact order and show me each one's full contents, one at a time, so I can paste them into the Supabase SQL Editor for my **staging** project:
> 1. 20261108120000_add_meta_intelligence_connect.sql
> 2. 20261108130000_add_meta_intelligence_sync.sql
> 3. 20261108140000_add_meta_ai_insights.sql
> 4. 20261108150000_add_test_packs.sql
> 5. 20261108160000_add_weekly_briefs.sql
> 6. 20261108170000_add_ad_studio_drafts.sql
> 7. 20261108180000_ad_studio_kept_posters.sql
> 8. 20261109090000_audit_leads.sql
> 9. 20261109120000_add_trends.sql
> 10. 20261109130000_add_instagram_watch.sql
>
> Do not run `supabase db push`, do not link to any project, and do not edit the files.

If you'd rather Cursor runs them directly with `psql`, it needs the staging connection string (Supabase → **Connect** → Session pooler). Keep that string in your terminal only. Never paste it into chat. The command for each file, in order, is:

```bash
psql "$STAGING_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/<file>.sql
```

## After running: check it worked

In the SQL Editor, run:

```sql
select
  (select count(*) from information_schema.tables where table_schema = 'public' and table_name in (
    'meta_connections','meta_assets','meta_deletion_requests','sync_runs','meta_campaigns','meta_adsets',
    'meta_ads','meta_creatives','meta_ad_insights_daily','meta_organic_posts','meta_organic_post_insights_daily',
    'skalx_asset_hashes','ai_insights','test_packs','test_pack_variants','weekly_briefs','ad_studio_projects',
    'ad_studio_drafts','audit_leads','trend_snapshots','brand_trend_ideas','ig_watch_items','ig_hashtag_queries','ig_style_reads')
  ) as tables_found,           -- expect 24
  (select count(*) from storage.buckets where id in ('meta-creatives','test-packs','ad-drafts')) as buckets_found,  -- expect 3
  (select count(*) from storage.buckets where id in ('meta-creatives','test-packs','ad-drafts') and public) as public_buckets; -- expect 0
```

You should see **24, 3, 0**.

Optionally, run the full pre-launch check from your own terminal. First put staging's values in a local file such as `.env.staging`, which is not committed.

```bash
npm run meta:preflight -- --env .env.staging
```

## Vercel settings for demo.skalxai.app (Preview environment)

These aren't migrations, but the features need them on the same deployment:

- `GEMINI_API_KEY`, `CRON_SECRET`, plus the Meta values (`FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET`, `META_LOGIN_CONFIG_ID`, `INTEGRATION_TOKEN_ENCRYPTION_KEY`).
- To show Ad Performance and Trends on demo, set `NEXT_PUBLIC_AD_PERFORMANCE_LIVE=true` and `NEXT_PUBLIC_TRENDS_LIVE=true` for that environment, then redeploy.
