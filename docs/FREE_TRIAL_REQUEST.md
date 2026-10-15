# Free Trial request (manual approval)

Request-based Free Trial card on `/pricing` (and `/try` pricing). Submitting a request **never** creates a subscription, assigns credits, or unlocks paid features.

On every new request (and on retry if notify previously failed), details are emailed to **info@skalxai.app** via [Resend](https://resend.com) when `RESEND_API_KEY` is set (FormSubmit is the fallback only if the key is missing).

After submit, the UI invites the visitor to **Explore SkalX** (`/try`). That path does **not** grant credits, a trial subscription, or paid entitlements — generation stays gated until purchase or manual approval.

## Email

- Destination: `info@skalxai.app` (override with `TRIAL_REQUEST_NOTIFY_EMAIL` if ever needed)
- Provider: Resend from `lib/email/send.ts` (`RESEND_API_KEY`, `RESEND_FROM_EMAIL`)
- From address must use a domain verified in Resend (default `SkalX AI <noreply@skalxai.app>`)
- Set the same env vars in Vercel/production — never commit the API key

The request row is always stored as `pending` even if email delivery fails (`notify_error` on the row).

## Migration

`supabase/migrations/20261014140000_trial_access_requests.sql`

Statuses: `pending` → `approved` | `rejected` | `activated` (operator-only; no public API to change status).

## Manual approval (operator)

1. Watch **info@skalxai.app** for “[SkalX AI] Free trial request …” emails.
2. Review rows in `trial_access_requests` (Studio / SQL) if needed.
3. Contact the prospect from **info@skalxai.app**.
4. Grant access only through your normal authenticated entitlement process.
5. Update `status`, `reviewed_at`, `reviewed_by`, and `notes` when done.

## Related

Free marketing audit (`docs/FREE_MARKETING_AUDIT.md`) remains a separate acquisition path and is unchanged by this card.
