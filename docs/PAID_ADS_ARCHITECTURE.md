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

## Currency

- Selected `ad_accounts.currency` comes from Meta discovery (`me/adaccounts` → `currency`).
- Sync stamps that currency onto `ad_metrics_daily.currency` (never assume INR).
- Warehouse metrics expose `currency`, `mixed_currency`, and `spend_by_currency`; mixed known currencies refuse a single `total_spend`.
- Live reconciliation checklist: [META_ADS_LIVE_VERIFICATION.md](./META_ADS_LIVE_VERIFICATION.md).

## Selected ad-account isolation

- Sync stamps `ad_metrics_daily.ad_account_id` = selected `ad_accounts.id`.
- Warehouse aggregates **only** that account (spend, impressions, clicks, reach, conversions, ROAS, campaigns, time series). Sibling accounts are never combined — even when currency matches.
- No selected account → availability `unavailable` (do not guess).
- Rows with `ad_account_id IS NULL` are legacy / unattributable and are excluded from Analytics.
- Unique grain: `(integration_id, ad_account_id, entity_type, entity_external_id, metric_date)` via `20261013150000_ad_metrics_daily_account_grain.sql` (do not apply to production until reviewed).

## Analytics access (PR I)

Shared decision: `decideBasicAnalyticsAccess` / `FeatureService.resolveBasicAnalyticsAccess`.

| Cohort | How identified | `basic_analytics` |
|--------|----------------|-------------------|
| PAYG | Authenticated user with **zero** `subscriptions` rows | Allowed |
| Active / trialing subscriber | `status` in (`active`, `trialing`) | Plan flags: `enabled && !comingSoon` |
| Expired / cancelled / pending / past_due | Subscription history, no active/trialing row | Denied |
| Unauthenticated | No user id | 401 `missing_user` |

Do **not** treat “no active subscription” as PAYG.

- UI: `/analytics` uses `/api/features/access` + `isFeatureEntitled` (same flags). Overlay is not authorization.
- APIs: `GET /api/ads/metrics` and `GET /api/integrations/metrics` use `enforceBasicAnalyticsForMetricsApi`.
- Migration `20261013140000_enable_basic_analytics.sql` enables **only** `skalx_starter`, `skalx_growth`, `skalx_pro`. Legacy plans stay Coming Soon / disabled. `advanced_analytics` untouched.
- **Do not apply that migration to production until reviewed.** Staging: deploy app code first, then apply SQL, then verify PAYG + SkalX subscriber + legacy denial.
- Rollback (staging): set those three plans back to `is_enabled = false, is_coming_soon = true` for `basic_analytics`.
- Spend accuracy still requires Meta Ads Manager reconciliation (PR H).

## APIs

- `GET /api/ads/status` — connection + health + selected account (no tokens)
- `POST /api/ads/sync` — manual sync; cron with `Authorization: Bearer $CRON_SECRET` + `{ cron: true }`
- `GET /api/ads/metrics?provider=&range=` — warehouse metrics
- `GET /api/integrations/metrics` — warehouse first, live Meta Graph fallback

## Meta Graph write foundation (PR W1)

W1 adds **shared server-side infrastructure** for future Meta Marketing API
mutations. It does **not** create, activate, pause, or mutate live campaigns,
and it does **not** expose any public Graph write API route.

| Piece | Location | Role |
|-------|----------|------|
| `metaGraphPost` | `lib/ads/providers/meta/client.ts` | Form-encoded POST to configured Graph version; timeout; no automatic retries |
| `metaGraphUpload` | `lib/ads/providers/meta/client.ts` | **W2.4** Multipart POST for file uploads (e.g. Ad Images); timeout; no automatic retries; form-urlencoded `metaGraphPost` unchanged |
| Shared errors | `MetaGraphError` / `normalizeMetaGraphError` | Safe messages with `code`, `type`, `fbtrace_id`, HTTP status; tokens redacted |
| Budget units | `lib/ads/providers/meta/budget.ts` | Major ↔ Meta minor units with explicit currency exponents (never assume INR) |
| Write context (shape) | `lib/ads/providers/meta/write-context.ts` | Explicit provider `meta` + selected account + currency (not authorization) |
| Write context (trusted) | `lib/ads/providers/meta/load-write-context.ts` | **W1.3 / W2.3B** DB loader: auth user → `integrations` (`meta`) → `ad_accounts.is_selected` → **typed** credentials |

### Meta Ads token columns (PR W2.3B)

For `provider = meta` only (`integrations/store.ts` + OAuth finalize):

| DB column | SkalX meaning | Used for |
|-----------|---------------|----------|
| `access_token` | Facebook **Page** token | Page-scoped ops when required; exposed as `pageAccessToken` |
| `refresh_token` | **User** Ads token | `act_*` Marketing API (campaigns, ad sets, ads, insights); exposed as `userAccessToken` / `accessToken` |
| `page_id` | Selected Page id | `object_story_spec.page_id`; `assertMetaAdsPageBoundForCreative` |

Never relabel Page ↔ user. Organic `meta-publish` / `meta-instagram` are separate providers. Official Meta docs were HTTP 403 from this environment during W2.3B — confirm token types on staging with Access Token Debugger before create-paused.

### What W1 deliberately does not enable

- No campaign / ad set / ad create, update, pause, or budget-mutation endpoints
- No UI or schema migration for writes
- No OAuth scope changes
- No organic Facebook / Instagram publishing changes (`meta-publish`, `meta-instagram`)
- No `metaGraphPatch` helper yet — Meta Marketing updates typically use POST; add PATCH only when a documented endpoint requires it

### Rules for future write operations

1. Derive the user from verified server auth (e.g. `getUserIdFromRequest`). Never trust body `userId`.
2. Call **`loadMetaAdsWriteContext(authenticatedUserId)`** (W1.3). It loads `integrations` for that user with `provider = meta`, the row with `ad_accounts.is_selected = true`, and decrypts the Ads token via `revealTokens`. Do **not** accept a client-built write context.
3. Never use `meta-publish` / `meta-instagram`, first discovered account, or `integrations.ad_account_id` as a selection fallback.
4. `resolveMetaAdsWriteContext` remains a post-load shape guard (explicit `provider: "meta"` — W1.2); it is not tenant authorization by itself.
5. Never put `access_token` / `appsecret_proof` in Graph write `params`; the server token is authoritative (reserved keys rejected).
6. Convert budgets with `majorToMetaBudgetMinor` / `metaBudgetMinorToMajor` using the **selected account’s stored currency**. Unsupported currencies are rejected.
7. Keep insights / warehouse **spend** in major units (PR H). Do not run Analytics formatting through budget minor-unit helpers.
8. Do not auto-retry non-idempotent writes unless an explicit idempotency strategy makes retry safe.
9. Do not log access tokens or raw sensitive request payloads.

Server DAOs use `DATABASE_URL` (table owner; RLS not FORCE’d). Write authorization is enforced in application code by binding queries to the authenticated `user_id` and `provider = 'meta'`, matching Ads sync/status.

### Budget / currency (PR W1.4)

- Meta `daily_budget` / `lifetime_budget` are integers in **Meta offset units** for the ad account currency (Marketing API Currencies table), not raw ISO 4217 guesses.
- Allowlist: `META_BUDGET_CURRENCY_OFFSETS` in `lib/ads/providers/meta/budget.ts` (e.g. USD/INR offset **100**, JPY/IDR/HUF/TWD/CLP/KRW offset **1**).
- Ad Account discovery stores `currency` only — Meta does not expose a per-account offset on `me/adaccounts`; the static Meta table is the source of truth.
- Unknown or **unverified** codes (including ISO three-decimal currencies such as KWD that are absent from Meta’s ads currency table) are **rejected**.
- Excess fractional precision is rejected (no silent rounding); never default unknown codes to offset 100.
- Insights / warehouse **spend** stays major units (PR H); do not use budget helpers for Analytics formatting.
- Evidence: Meta Marketing API Currencies doc (`developers.facebook.com/docs/marketing-api/currencies`); live fetch may 403 — W1.4 used an archived snapshot of that page.

### Meta Ads local drafts (PR W2.0)

Table `meta_ads_drafts` stores **SkalX-configured** paid Ads drafts only:

- Separate from creative `campaigns` and synced `ad_platform_entities`.
- Ownership: `user_id`; integration must be `provider = meta` and owned by the user; `ad_account_id` must belong to that integration and be `is_selected`.
- `currency` is stamped from `ad_accounts.currency` (Meta offset allowlist) — never from client alone.
- Statuses: `draft` → `validating` / `creating` → `created_paused` | `partial_failure` | `failed` → `archived`. Local statuses must not carry Meta object ids (DB check + DAO).
- **No access tokens.** **No Graph calls in W2.0.** Meta ids remain null until a later create-paused PR.
- Migration: `supabase/migrations/20261013160000_meta_ads_drafts.sql` (**do not apply to production until reviewed**).
- DAO: `MetaAdsDraftDAO` (`database/models/MetaAdsDraft.dao.ts`).

### Meta Ads preflight + draft APIs (PR W2.1)

Read-only preflight and local draft CRUD. **No Meta campaign creation.** **No UI.**

| Method | Path | Role |
|--------|------|------|
| `GET` | `/api/ads/meta/preflight` | Integration health, selected account + currency allowlist, entitlement, Page binding, blockers |
| `GET` | `/api/ads/meta/drafts` | List owned drafts |
| `POST` | `/api/ads/meta/drafts` | Create local draft (server stamps currency + selected account) |
| `GET` | `/api/ads/meta/drafts/[id]` | Read owned draft (cross-user → **404**) |
| `PATCH` | `/api/ads/meta/drafts/[id]` | Update editable (`draft` / `failed`) content only |
| `POST` | `/api/ads/meta/drafts/[id]/archive` | Archive via documented status transitions |

**Auth:** `getUserIdFromRequest` only. Never trust body `userId`, `integrationId`, `adAccountId`, `currency`, `status`, or Meta object ids.

**Entitlement (fail closed — not Analytics):** There is **no** plan `FeatureKey` for Meta Ads create yet. Do **not** reuse `basic_analytics` or `create_campaigns`. W2.1 gate:

- Default denied unless `META_ADS_CREATE_ENABLED=true`.
- Optional `META_ADS_CREATE_USER_ALLOWLIST=uuid,uuid`.
- Logical feature id `meta_ads_create` (documented only; not in billing/plans this PR).

**Idempotency:** Unique partial index `uq_meta_ads_drafts_user_idempotency` on `(user_id, idempotency_key)` where key is not null. `MetaAdsDraftDAO.createIdempotent` looks up first, then inserts; on Postgres `23505` re-selects the winner. Repeated/concurrent creates with the same key return the existing local draft (`created: false`). Without a key, each POST inserts a new row.

**Page binding:** Meta OAuth finalize (`/api/meta/oauth/finalize`) requires an explicit `pageId` and stores `integrations.pageId` (plus encrypted page token). Preflight exposes `pageId` / `pageBound` without tokens. Missing Page blocks `canCreateOnMeta` but **not** local draft persistence (`canCreateLocalDraft`). W2.3+ create-paused must use that trusted Page id — never invent or pick an arbitrary Page.

**Before W2.2:** Add plan `meta_ads_create` (or equivalent) when billing is ready; keep env gate until then. Confirm Page token scopes cover Ads creative `object_story_spec` needs.

### Meta Ads draft UI (PR W2.2)

Local list + creation wizard. **No Meta Graph writes. No activation/pause on Meta.**

| Route | Component |
|-------|-----------|
| `/ads/meta/drafts` | `MetaAdsDraftsList` — preflight, blockers, draft table, archive |
| `/ads/meta/drafts/new` | `MetaAdsDraftWizard` — 5-step create |
| `/ads/meta/drafts/[id]` | `MetaAdsDraftWizard` — edit / reopen (editable when `draft` \| `failed`) |

Sidebar: **Campaigns → Meta Ads** (separate from Campaign Library, Generated Contents organic publish, and Analytics).

**First-release contract** (`lib/ads/meta/draft-contract.ts`, enforced in DAO validation):

- Objectives: `OUTCOME_AWARENESS` \| `OUTCOME_TRAFFIC` \| `OUTCOME_ENGAGEMENT`
- CTAs: `LEARN_MORE` \| `SHOP_NOW` \| `SIGN_UP` \| `CONTACT_US` \| `GET_QUOTE`
- Targeting: curated countries + age 18–65
- Placements: automatic **or** Facebook Feed only
- Destination: public `https://` URL

### Creative asset trust (PR W2.3C)

Library table: `user_generated_image` (`GeneratedImageDAO`). Ownership: `user_id` + `getByIdForUser`. Canonical fields: `image_path` (storage object), `image_url` (stored public URL from `getPublicUrl`).

On draft create/update, `resolveMetaAdsCreativeAsset` requires `sourceImageId`, loads the owned image row, rejects non-images / foreign / missing URLs, and **stamps `source_image_url` from the library row**. Browser `sourceImageUrl` is a mismatch check only — never authoritative. Metadata `creative.metaFetchableViaUrl` records whether Meta can URL-fetch (HTTPS public); localhost / signed URLs are not Meta-URL-ready (multipart may be used later). No new hosting service in W2.3C.

Create uses a client-held `idempotencyKey` for safe retries. Status labels always say **Draft — not on Meta** (or Failed / Archived) until a later create-on-Meta PR.

### Meta Ads image upload foundation (PR W2.4)

Internal-only byte upload path for future create-paused creatives. **No public API route. No live Meta calls in this PR. No campaign / creative / ad creation.**

| Piece | Location | Role |
|-------|----------|------|
| `metaGraphUpload` | `lib/ads/providers/meta/client.ts` | Multipart Graph POST; server token last; reserved auth keys rejected; finite timeout; **no auto-retry** |
| `uploadMetaAdsAdImage` | `lib/ads/meta/upload-ad-image.ts` | Trusted boundary: auth user → owned asset id → storage download → validate → `act_*/adimages` → image hash |
| Size / MIME | Same as Page publish | `META_ADS_ADIMAGE_MAX_BYTES` = `MAX_PUBLISH_IMAGE_BYTES` (10 MiB); magic-byte JPEG/PNG/GIF/WebP |

**Trust rules:** Never accept browser URLs, client storage paths, client tokens, or client ad-account ids as authoritative. Bytes come only from the owned library row’s storage object (same download pattern as Facebook Page publish). Write context supplies the **user** Ads token + selected `act_*`.

**Ambiguous outcomes:** Timeout / connection loss → `upload_outcome_uncertain` (`outcomeUncertain: true`). Do **not** automatically POST again. Future create-paused must reconcile with read-only `GET act_*/adimages` (deterministic upload filename embeds asset-id + content-sha prefix) before another upload.

**Docs uncertainty:** Official Meta HTML docs were HTTP 403 here. Multipart field `filename` + response `images[<name>].hash` come from secondary OpenAPI / community Marketing API examples — confirm on staging before create-paused.

### Meta Ads create-paused orchestrator (PR W2.5)

Server orchestration to create a **PAUSED** Traffic stack. **Never ACTIVE.** No organic publishing changes. No OAuth scope changes.

| Piece | Location |
|-------|----------|
| Gates | `lib/ads/meta/create-paused-gates.ts` — entitlement + `META_ADS_ADIMAGES_CONTRACT_APPROVED` + `META_ADS_CREATE_PAUSED_GRAPH_WRITES` (all fail-closed) |
| Traffic map | `lib/ads/meta/create-paused-traffic-map.ts` — `OUTCOME_TRAFFIC` only; `special_ad_categories: []`; ad set `LINK_CLICKS` / `IMPRESSIONS`; Page `object_story_spec` |
| Graph adapter | `lib/ads/meta/create-paused-graph.ts` — confirmed / rejected / uncertain; no auto-retry; image filename reconcile **not** trusted |
| Orchestrator | `lib/ads/meta/create-paused.ts` — claim → campaign → adset → image → creative → ad; persist each Meta id immediately |
| DAO | `claimForCreatePaused` (atomic `draft\|failed\|partial_failure` → `creating`) + `persistCreatePausedProgress` |
| API | `POST /api/ads/meta/drafts/[id]/create-paused` — staging only when all gates pass |

**Ambiguous POST:** timeout/network → `partial_failure` + `last_error_code=outcome_uncertain`. Do not re-POST. GET probes may run for diagnostics but **never auto-accept** an id (name+PAUSED is not attempt identity; limited pages ≠ global uniqueness; zero matches ≠ proof of failure). Image uncertain → stop (no filename reconcile).

**W2.5.1 durability:** Progress writes are atomic on `(id, user_id, status=creating, create_attempt_id)`. Ownership is touched before each Graph mutation. Stale `creating` may be reclaimed only when the lease expired **and** there is no unresolved uncertain step. Operator image resolve: `POST .../resolve-image` verifies hash on the selected act via GET adimages hashes, then records an audit event in metadata.

**Crash window:** Meta may accept a POST before SkalX persists the id. Resume uses stored ids first; otherwise operator resolution. Graph POSTs are **not** assumed idempotent.

**Unverified (staging):** adimages multipart contract, account budget minimums, placement field acceptance, `bid_strategy`, `special_ad_categories` `[]` vs `NONE`, Page token necessity for creatives, adimages GET-by-hashes response shape.

### Deprecated legacy route (disabled in PR W1.1)

`pages/api/auth/facebook/ads.ts` formerly created paused Meta campaigns with
first-account fallback and fixed ×100 budget conversion. As of **W1.1** the
handler returns **HTTP 410** with `error: legacy_meta_ads_write_disabled` and
performs **no** Graph or campaign-creation calls. The Integrations Instagram
“Run an Ad” UI that called it was removed. Do not restore that path; future
writes must use `lib/ads/providers/meta` with the selected Ads account.

## Token encryption

Set `INTEGRATION_TOKEN_ENCRYPTION_KEY` (or rely on `SESSION_SECRET`). Tokens are stored as `enc:v1:...` AES-256-GCM ciphertext.

## Applying the migration

Paid-ads warehouse schema (already in tree):

```bash
# local only
# supabase/migrations/20261009120000_paid_ads_performance_layer.sql
```

Analytics plan flags (PR I, **SkalX plans only**, not production):

```bash
# After application code is deployed to the target env:
# supabase/migrations/20261013140000_enable_basic_analytics.sql
```

Do not deploy this change set to production without a deliberate migration plan.
