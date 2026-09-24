# SkalX Video Credits — rollout notes

## Model (customer-facing)

| Unit | Rule |
|------|------|
| Image credit | 1 successful image = 1 credit · ₹10 · min buy 10 |
| Video credit | 100 credits = 5 sec · ₹699 / 100 · min buy 600 · then +300 (600, 900, 1200, …) |
| 15s generate | 300 Video Credits |
| 30s generate | 600 Video Credits |

Provider tokens / Runway cost stay internal.

## Migration formula (existing wallets)

`new_video_credits = old_video_seconds × 20`

Do **not** run balance migration until generation billing is verified on staging.

```bash
# Dry run
npx tsx scripts/migrate-video-seconds-to-credits.ts --dry-run

# Apply once (idempotent per user via credit_history)
npx tsx scripts/migrate-video-seconds-to-credits.ts --execute
```

## Schema migration

Apply `supabase/migrations/20260324100000_video_credits_reservations.sql`:

- Creates `credit_reservations`
- Extends `credit_history` operations
- Converts **plan** `video_credits` from seconds → credits (×20 when value &lt; 100)
- Seeds default `credit_pricing` if missing

## Vouchers

Existing video vouchers whose `credits` were issued as **seconds** must be multiplied by 20 before redeem, or re-issued. New vouchers must store Video Credits (e.g. 600 for 30s capacity). Historical payment rows are left unchanged.

## Recommended order

1. Deploy code (billing hardening + gates) with migration SQL for reservations/plans
2. Staging: purchase 600 credits, generate 15s/30s, fail a generation and confirm release
3. Freeze video purchases briefly
4. Run balance migration script
5. Update admin `credit_pricing` to `{ imageCreditPriceInr: 10, videoCreditBlockPriceInr: 699 }`
6. Unfreeze purchases
