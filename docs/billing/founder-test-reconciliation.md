# Founder test purchase reconciliation (read-only)

**Status:** documentation only. Do not run backfills, resends, or grants from this file until an operator verifies each precondition.

Production project: **SkalX - Live**. These were founder test checkouts before external launch.

| Local subscription (IST) | Plan | Status (as of investigation) | Credits |
| --- | --- | --- | --- |
| 2026-10-13 12:13 | `skalx_starter` | `pending` | all zeros |
| 2026-10-14 21:36 | `skalx_starter` | `pending` | all zeros |

Neither purchase had a `payments` row, `subscription_cycles` row, or `webhook_events` row for the payment at investigation time.

## Do not auto-process

- **24 September 2026** `payment.captured` is already `processed` with no cycle. It requires a separate investigation and must not be recovered by replaying that event id.
- Do not insert into `user_credits` by hand.
- Do not create a second Razorpay charge.

## Preconditions (per October purchase)

Verify in Razorpay **Live** and Supabase before any confirm/resend:

1. Payment status is `captured` (not only authorized).
2. Amount is **471900** paise (₹4,719) and currency `INR`.
3. Payment has an `invoice_id`; invoice is `paid`, belongs to the same Razorpay subscription as the local `subscriptions.razorpay_subscription_id`, and includes an addon line whose name matches `/first\s*month/i`.
4. Local subscription is still `pending` (or `active` only if a prior partial attempt exists), `plan_id = skalx_starter`, and owned by the founder account.
5. No `subscription_cycles` row with `idempotency_key = sub_charge:{payment_id}` and no `payments.razorpay_payment_id` for that payment.
6. No `webhook_events` row for this payment’s event id in status `processed` or `pending` that finished without a grant. (Absence of any row is OK.)

## Safe recovery after deploy

After the confirmation endpoint and webhook fixes are deployed:

### Preferred: confirmation path

If the founder still has the Razorpay payment id (dashboard) and local `subscriptionId`:

1. Sign in as the same user.
2. Call `POST /api/billing/subscriptions/confirm-payment` with:
   - `subscriptionId` (local)
   - `razorpaySubscriptionId`
   - `razorpayPaymentId`
   - `razorpaySignature` from a legitimate Checkout response **or** use an ops-only path that fetches the payment server-side after dashboard verification (signature required by the public endpoint).
3. Expect `status: provisioned` and Brand Studio to show **50 images / 1,200 video**.
4. A second call must remain idempotent (`alreadyProvisioned` / same cycle).

If Checkout signature is unavailable, prefer Razorpay dashboard **resend** of `payment.captured` to the production webhook (below) rather than bypassing signature checks.

### Alternate: webhook resend

1. Confirm live webhook URL is `https://skalxai.app/api/billing/webhooks/razorpay` and secret matches production.
2. Resend the existing `payment.captured` event for that payment only.
3. Confirm DB: `webhook_events` processed, one `subscription_cycles` provisioned, subscription `active`, wallet 50 / 1200.

### After recovery

- Reload Brand Studio / Content Studio; balances come from `/api/credits/balance`.
- Do not expect legacy `user_credits.credits` to change; UI no longer uses that column for display.

## Verification SQL (read-only)

Run only selects. Do not update rows.

```sql
SELECT status, plan_id, created_at
FROM subscriptions
WHERE created_at > '2026-10-13'
ORDER BY created_at;

SELECT status, count(*) FROM subscription_cycles GROUP BY 1;
SELECT payment_type, status, count(*) FROM payments GROUP BY 1, 2;
```
