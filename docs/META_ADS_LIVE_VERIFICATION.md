# Meta Ads — read-only live spend verification (PR H)

**Do not claim warehouse spend is accurate until this checklist passes.**

This exercise is **read-only**. Do not create, edit, pause, resume, or publish campaigns in Meta Ads Manager or via SkalX APIs.

## Preconditions

1. Meta app has Ads read permissions (`ads_read` / Marketing API insights) for a **test** ad account you control.
2. SkalX env has Meta OAuth configured (`FACEBOOK_*` / Meta Ads integration vars as used by `/api/meta/oauth/start`).
3. Database has `ad_accounts.currency` and `ad_metrics_daily.currency` columns (already in schema — **no new migration required for PR H**).
4. Local or staging app only — do not apply unverified schema changes to production for this test.

## Steps

### 1. Connect a test Meta Ads account

1. Sign in to SkalX as the test user.
2. Open **Integrations** → connect **Meta Ads** (OAuth start → Facebook login → grant Ads read access).
3. On **select assets / select account**, pick **one** advertising account.
4. Confirm the selected account’s **currency** in Meta Ads Manager (Account settings → Currency) matches what SkalX stored:
   - `GET /api/ads/status` → `selected.currency` (or accounts list `currency`).
   - DB: `ad_accounts.currency` for `is_selected = true`.

Record: `account_id`, `currency` (e.g. `INR` or `USD`), account name.

### 2. Sync a known date range

1. Choose a closed date range with known spend (e.g. last 7 complete days). Prefer dates that are fully attributed in Ads Manager (avoid “today” if delivery is still updating).
2. Trigger sync:

```bash
# Example — adjust host/auth as used in your environment
curl -X POST "$APP_ORIGIN/api/ads/sync" \
  -H "Authorization: Bearer $USER_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"provider":"meta","since":"YYYY-MM-DD","until":"YYYY-MM-DD"}'
```

Or use the Integrations UI sync control if present.

3. Confirm sync outcome:
   - Response / `ad_sync_runs.status` is `success` or `partial` (not silent success with empty failures).
   - `details.currency` matches the selected account currency.
   - `ad_metrics_daily` rows for that account have `currency` set to the same code.

### 3. Reconcile spend with Meta Ads Manager

Use **the same**:

| Dimension | Must match |
|-----------|------------|
| Ad account | Same `act_…` / account id as selected in SkalX |
| Currency | Account currency (do not convert) |
| Date range | Same `since`–`until` (inclusive), account timezone as in Ads Manager |
| Level | Account-level totals (SkalX warehouse aggregates `entity_type = account`) |
| Attribution / reporting | Ads Manager default account reporting; SkalX uses Meta insights daily breakdown |

In Ads Manager:

1. Open the test ad account.
2. Set the date picker to the exact `since`–`until` range.
3. View **Account** overview (or custom columns including Amount spent).
4. Note **Amount spent** in the account currency.

In SkalX:

1. Open **Analytics** with the same range (custom start/end).
2. Or `GET /api/ads/metrics?provider=meta&start=YYYY-MM-DD&end=YYYY-MM-DD`.
3. Compare `current.total_spend` and `current.currency` to Ads Manager Amount spent.

**Pass criteria**

- `current.currency` equals Ads Manager account currency.
- `|SkalX total_spend − Ads Manager Amount spent|` is within expected Meta attribution/rounding tolerance (document the delta; typically small for completed days).
- UI formats spend with that currency (not hardcoded INR).
- If multiple currencies ever appear in warehouse rows for the range, UI shows per-currency amounts and **does not** show a single blended total.

**Fail / do not claim accuracy if**

- Currency differs from Ads Manager.
- Spend differs beyond documented tolerance without explanation (timezone, partial sync, truncated pagination, wrong account).
- Sync was `error` / `partial` and levels failed (reconcile only after a clean `success` on account-level insights).

### 4. Optional non-INR check

Repeat steps 1–3 with a second test account billed in **USD** (or another non-INR currency). Confirm persistence, API `currency`, and Analytics formatting for that code.

## Out of scope

- Creating or mutating campaigns, ad sets, or ads.
- Enabling paid campaign creation in SkalX.
- Deploying or applying migrations to production as part of this verification.
