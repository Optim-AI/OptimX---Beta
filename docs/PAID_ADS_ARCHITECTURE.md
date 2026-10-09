# Paid Ads Marketing Performance Layer

## Purpose

Unified connection + sync + metrics storage for **Meta Ads**, **Google Ads**, and **LinkedIn Ads**.

This is separate from:

- Supabase Auth / Google Sign-In
- Creative draft `campaigns` table
- Creative Intelligence Meta Ad Library scraping (`creative_intelligence_meta_ads`)

## Data model

| Table | Role |
|-------|------|
| `integrations` | Per-user OAuth credentials (encrypted at rest when key configured) |
| `ad_accounts` | Discovered advertising accounts; exactly one `is_selected` per integration |
| `ad_platform_entities` | Campaigns, ad sets/ad groups, ads, creatives, keywords, lead forms |
| `ad_metrics_daily` | Daily spend/impressions/clicks/conversions/ROAS facts |
| `ad_sync_runs` | Sync audit log |

## OAuth entrypoints

| Platform | Start | Callback | Selection UI |
|----------|-------|----------|--------------|
| Meta | `/api/meta/oauth/start` | `/api/meta/oauth/callback` | `/integrations/meta/select-assets` |
| Google Ads | `/api/ads/google/oauth/start` | `/api/ads/google/oauth/callback` | `/integrations/google-ads/select-account` |
| LinkedIn | `/api/ads/linkedin/oauth/start` | `/api/ads/linkedin/oauth/callback` | `/integrations/linkedin/select-account` |

Legacy cookie-based Google Ads routes under `/api/auth/google-ads/auth` and `/start` redirect to the new flow.

## APIs

- `GET /api/ads/status` — connection + health + selected account (no tokens)
- `POST /api/ads/sync` — manual sync; cron with `Authorization: Bearer $CRON_SECRET` + `{ cron: true }`
- `GET /api/ads/metrics?provider=&range=` — warehouse metrics
- `GET /api/integrations/metrics` — warehouse first, live Meta Graph fallback

## Token encryption

Set `INTEGRATION_TOKEN_ENCRYPTION_KEY` (or rely on `SESSION_SECRET`). Tokens are stored as `enc:v1:...` AES-256-GCM ciphertext.

## Applying the migration

```bash
# local
npx supabase db reset   # or migrate
# or apply SQL file:
# supabase/migrations/20261009120000_paid_ads_performance_layer.sql
```

Do not deploy this change set to production without a deliberate migration plan.
