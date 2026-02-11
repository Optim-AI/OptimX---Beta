# Production Readiness Checklist — OptimX / Oli AI

This document summarizes the production readiness audit and what must be done before go-live.

---

## Executive summary

| Area              | Status   | Notes |
|-------------------|----------|--------|
| Build             | ✅ Ready | Build passes after type fix in `buy-credits.tsx`. |
| Security (secrets)| ✅ Fixed | Google Ads credentials moved to env; test/debug APIs blocked in prod. |
| Auth & API        | ✅ Good  | Critical APIs use `getUserIdFromRequest`; Razorpay webhook verified. |
| Billing           | ✅ Good  | Webhook signature verification; cron job protected by `CRON_SECRET`. |
| Database          | ✅ Good  | Migrations present; RLS on creative_studio_sessions and storage. |
| Config & Deploy   | ⚠️ Checklist | See deployment checklist below. |
| Testing           | ❌ Missing | No automated test suite. |
| Monitoring        | ⚠️ Optional | Sentry/LogRocket suggested in DEPLOYMENT.md. |

**Verdict:** The app can go live after completing the **Pre-launch checklist** below. Remaining items are config, operational, and quality (tests/monitoring).

---

## Fixes applied in this audit

1. **Type error (build)**  
   - `pages/buy-credits.tsx`: `quantity` state typed as `number` so it can be set to both default image (50) and video (60) quantities.

2. **Security — Google Ads**  
   - `pages/api/auth/google-ads/profile.ts`, `runCampaign.ts`, `clientAccounts.ts`: Removed hardcoded client ID, client secret, and developer token. All now use:
     - `GOOGLE_ADS_CLIENT_ID`
     - `GOOGLE_ADS_CLIENT_SECRET`
     - `GOOGLE_ADS_DEVELOPER_TOKEN`
     - `GOOGLE_ADS_MANAGER_ID` (added to `.env.example`; required for runCampaign and clientAccounts).

3. **Security — Debug/test endpoints**  
   - `pages/api/test-db.ts`: Returns 404 in production (no DB probing or URL logging).
   - `pages/api/debugger.ts`: Returns 404 in production.

4. **Test APIs**  
   - `/api/testing/*` (create-test-subscription, add-test-credits, etc.) already return 403 in production. No change needed.

---

## Pre-launch checklist

### 1. Environment variables (production)

- [ ] Set **all** variables from `.env.example` in the production environment (Vercel/hosting).
- [ ] **Admin:** Change `ADMIN_USERNAME` and `ADMIN_PASSWORD` from defaults (`admin` / `admin123`).
- [ ] **Razorpay:** Use **live** keys and live webhook secret (`RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `NEXT_PUBLIC_RAZORPAY_KEY_ID`).
- [ ] **Cron:** Set `CRON_SECRET` and configure the credit-reset cron to send `x-cron-secret` (or `?secret=`) so the job is protected.
- [ ] **Google Ads:** Set `GOOGLE_ADS_MANAGER_ID` (manager account ID) for production.
- [ ] **URLs:** Set `NEXT_PUBLIC_APP_URL` and `NEXT_PUBLIC_SITE_URL` to the production domain.

### 2. OAuth / third-party

- [ ] **Google Ads:** Add production redirect URI in Google Cloud Console (e.g. `https://yourdomain.com/api/auth/google-ads/callback`).
- [ ] **Meta:** Add production redirect URI and app domain in Facebook App Dashboard; complete App Review if using advanced permissions.
- [ ] **Razorpay:** Configure webhook URL in Razorpay Dashboard (e.g. `https://yourdomain.com/api/billing/webhooks/razorpay`) and use the same secret in `RAZORPAY_WEBHOOK_SECRET`.

### 3. Scripts and secrets (no hardcoded credentials)

- [ ] **`scripts/sync-local-to-staging.sh`** contains a hardcoded staging DB password. Before running in any shared environment, switch to env vars (e.g. `STAGING_DB_PASSWORD`) and ensure the script is not committed with real credentials.

### 4. Optional hardening

- [ ] **Security headers:** Add `next.config.ts` headers (e.g. X-Frame-Options, X-Content-Type-Options, CSP) if required by policy.
- [ ] **TLS:** If `NODE_TLS_REJECT_UNAUTHORIZED=0` is set anywhere (e.g. in a script or env), remove it for production.
- [ ] **Test pages:** Consider hiding or removing the “Test billing” link on the pricing page in production (e.g. `process.env.NODE_ENV !== 'production'`), or leave as-is (test APIs already return 403 in prod).

### 5. Post-launch

- [ ] **Cron:** Schedule `POST /api/billing/jobs/credit-reset` (e.g. Vercel Cron or external scheduler) with `CRON_SECRET`.
- [ ] **Monitoring:** Enable error tracking (e.g. Sentry) and optionally RUM (e.g. Vercel Analytics), as in DEPLOYMENT.md.
- [ ] **Uptime:** Configure uptime checks for the main app and, if needed, health/dashboard endpoints.

---

## What was verified

- **Build:** `npm run build` succeeds.
- **Secrets:** No Google Ads credentials in code; env used. Test/debug routes disabled in production.
- **Auth:** Billing, credits, profile, campaigns, creative studio, and integrations APIs use `getUserIdFromRequest` or equivalent.
- **Billing:** Razorpay webhook uses raw body and signature verification; credit-reset job checks `CRON_SECRET` when set.
- **Database:** Supabase migrations present; RLS on `creative_studio_sessions` and storage buckets.
- **Legal pages:** Privacy policy, terms, cookie policy, refund-cancellation, and data-handling-security pages exist.

---

## Not in scope / future work

- **Automated tests:** No Jest/Vitest or E2E tests found. Adding tests for critical flows (auth, billing, credits) is recommended.
- **RLS coverage:** Not all tables were audited for RLS; consider reviewing other user-scoped tables.
- **Rate limiting:** Not verified; consider adding for auth and payment APIs in high-traffic scenarios.

---

## Quick reference

| Item              | Location / Action |
|-------------------|-------------------|
| Env template      | `.env.example` |
| Deployment steps  | `docs/DEPLOYMENT.md` |
| Razorpay setup    | `docs/RAZORPAY_SETUP.md` |
| Supabase local    | `docs/SUPABASE_LOCAL_SETUP.md` |

---

*Last updated: Production readiness audit — build, security fixes, and checklist.*
