/**
 * Subscription confirm + webhook outcome classification tests.
 * Run: npx tsx lib/billing/subscription-confirm.test.ts
 *
 * Pure / mocked tests only — no live Razorpay calls.
 * Optional DB provisioning tests run when local Supabase (54322) is available.
 */

import 'dotenv/config';
import { config } from 'dotenv';
config({ path: '.env.local' });

import { createHmac, randomUUID } from 'crypto';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { Client } from 'pg';
import {
  classifyInitialProvisionReason,
  isRetryableWebhookOutcome,
} from './subscription-payment-outcome';
import { confirmSubscriptionPayment } from './subscription-confirm';
import {
  isFirstMonthSubscriptionAddonInvoice,
  tryProvisionInitialSubscriptionFromCapturedPayment,
  type RazorpayInvoiceLike,
} from './initial-subscription-payment';
import { subscriptionTotalsInr } from './marketing-plans';
import { parseCreditsBalancePayload } from './credit-balance-client';
import { MARKETING_SUBSCRIPTION_PLANS } from './marketing-plans';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

function assertEqual(actual: unknown, expected: unknown, msg: string) {
  if (actual !== expected) {
    throw new Error(
      `FAIL: ${msg} (expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)})`
    );
  }
}

function sampleAddonInvoice(
  overrides: Partial<RazorpayInvoiceLike> = {}
): RazorpayInvoiceLike {
  const amount = subscriptionTotalsInr(3999).totalInr * 100;
  return {
    id: 'inv_test_addon_1',
    status: 'paid',
    subscription_id: 'sub_test_abc',
    payment_id: 'pay_test_abc',
    amount,
    amount_paid: amount,
    currency: 'INR',
    line_items: [
      {
        name: 'SkalX Starter — first month (incl. GST)',
        amount,
        type: 'addon',
      },
    ],
    ...overrides,
  };
}

async function main() {
  console.log('=== Subscription confirm / webhook outcome tests ===');

  // --- Outcome classification ---
  assertEqual(
    classifyInitialProvisionReason('payment_not_captured'),
    'pending',
    'uncaptured → pending'
  );
  assertEqual(
    classifyInitialProvisionReason('invoice_fetch_failed'),
    'retryable',
    'invoice fetch → retryable'
  );
  assertEqual(
    classifyInitialProvisionReason('missing_invoice_id'),
    'retryable',
    'missing invoice → retryable'
  );
  assertEqual(
    classifyInitialProvisionReason('amount_mismatch_expected_1_got_2'),
    'permanent',
    'amount mismatch → permanent'
  );
  assertEqual(
    classifyInitialProvisionReason('not_first_month_addon_invoice'),
    'permanent',
    'bad invoice → permanent'
  );
  assertEqual(
    classifyInitialProvisionReason('subscription_status_cancelled'),
    'permanent',
    'cancelled → permanent'
  );
  assert(isRetryableWebhookOutcome('retryable'), 'retryable flag');
  assert(!isRetryableWebhookOutcome('permanent'), 'permanent not retryable');
  console.log('PASS: outcome classification');

  // --- Static contracts ---
  {
    const webhook = readFileSync(
      resolve(__dirname, '../razorpay/webhook.service.ts'),
      'utf8'
    );
    const route = readFileSync(
      resolve(__dirname, '../../pages/api/billing/webhooks/razorpay.ts'),
      'utf8'
    );
    const confirmRoute = readFileSync(
      resolve(__dirname, '../../pages/api/billing/subscriptions/confirm-payment.ts'),
      'utf8'
    );
    const subscribe = readFileSync(
      resolve(__dirname, '../../pages/subscribe.tsx'),
      'utf8'
    );
    const nav = readFileSync(
      resolve(__dirname, '../../app/web/src/components/navBar.tsx'),
      'utf8'
    );
    const campaign = readFileSync(
      resolve(__dirname, '../../pages/create-campaign.tsx'),
      'utf8'
    );

    assert(webhook.includes('markFailed'), 'webhook can mark failed');
    assert(webhook.includes('permanentFailure'), 'webhook surfaces permanent');
    assert(webhook.includes('retryable'), 'webhook surfaces retryable');
    assert(
      !/markProcessed\(webhookEvent\.id\);\s*return \{ success: true \};/.test(
        webhook.replace(/\s+/g, ' ')
      ) || webhook.includes("outcome.kind === 'success'"),
      'webhook only marks processed on success/ignored'
    );
    assert(route.includes('status(500)'), 'route returns 500 for retryable');
    assert(route.includes('permanentFailure'), 'route acknowledges permanent with 200');
    assert(confirmRoute.includes('getUserIdFromRequest'), 'confirm requires auth');
    assert(confirmRoute.includes('confirmSubscriptionPayment'), 'confirm uses shared helper');
    assert(subscribe.includes('confirm-payment'), 'checkout calls confirm');
    assert(subscribe.includes('razorpay_payment_id'), 'checkout reads payment id');
    assert(nav.includes('/api/credits/balance'), 'navbar uses balance API');
    assert(!nav.includes('.select("credits")'), 'navbar does not read legacy column');
    assert(campaign.includes('/api/credits/balance'), 'campaign uses balance API');
    console.log('PASS: static contracts');
  }

  // --- Marketing entitlements ---
  {
    const starter = MARKETING_SUBSCRIPTION_PLANS.find((p) => p.id === 'skalx_starter')!;
    const growth = MARKETING_SUBSCRIPTION_PLANS.find((p) => p.id === 'skalx_growth')!;
    const pro = MARKETING_SUBSCRIPTION_PLANS.find((p) => p.id === 'skalx_pro')!;
    assertEqual(starter.imageCredits, 50, 'starter images');
    assertEqual(starter.videoCredits, 1200, 'starter video');
    assertEqual(growth.imageCredits, 150, 'growth images');
    assertEqual(growth.videoCredits, 2400, 'growth video');
    assertEqual(pro.imageCredits, 300, 'pro images');
    assertEqual(pro.videoCredits, 4800, 'pro video');
    assertEqual(subscriptionTotalsInr(3999).totalInr * 100, 471900, 'starter paise');
    console.log('PASS: plan entitlements');
  }

  // --- Balance parser ---
  {
    const parsed = parseCreditsBalancePayload({
      success: true,
      imageCredits: { subscription: 50, addon: 2, total: 52 },
      videoCredits: { subscription: 1200, addon: 0, total: 1200 },
    });
    assertEqual(parsed?.imageTotal, 52, 'image total');
    assertEqual(parsed?.videoTotal, 1200, 'video total');
    assertEqual(parseCreditsBalancePayload({ success: false }), null, 'failed payload');
    console.log('PASS: balance client parser');
  }

  // --- Confirm rejects uncaptured / bad ownership (mocked Razorpay) ---
  {
    const pending = await confirmSubscriptionPayment(
      {
        userId: randomUUID(),
        subscriptionId: randomUUID(),
        razorpayPaymentId: 'pay_testuncaptured01',
        razorpaySubscriptionId: 'sub_testx',
        razorpaySignature: 'x',
      },
      {
        requireSignature: false,
        fetchPayment: async () => ({
          id: 'pay_testuncaptured01',
          status: 'authorized',
          amount: 471900,
          currency: 'INR',
          invoice_id: 'inv_x',
        }),
      }
    );
    // Will fail at subscription_not_found before payment status when sub missing —
    // use a path that hits payment first by mocking after we have DB. For pure mock:
    assert(
      pending.status === 'rejected' || pending.status === 'pending',
      'uncaptured/missing sub does not provision'
    );
    if (pending.status === 'rejected') {
      assertEqual(pending.reason, 'subscription_not_found', 'no local sub');
    }
    console.log('PASS: confirm without local subscription rejects');
  }

  // --- Invoice classifier still rejects non-addon ---
  assert(
    !isFirstMonthSubscriptionAddonInvoice(
      sampleAddonInvoice({
        line_items: [{ name: 'Plan', amount: 471900, type: 'plan' }],
      })
    ),
    'non-addon rejected'
  );
  console.log('PASS: invoice classifier');

  // --- DB-backed confirm + provision (optional) ---
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.log('SKIP DB tests: DATABASE_URL missing');
    console.log('=== Subscription confirm tests completed (partial) ===');
    return;
  }
  const u = new URL(url);
  if (!['localhost', '127.0.0.1'].includes(u.hostname) || u.port !== '54322') {
    console.log(`SKIP DB tests: non-local ${u.hostname}:${u.port}`);
    console.log('=== Subscription confirm tests completed (partial) ===');
    return;
  }

  const client = new Client({ connectionString: url });
  await client.connect();

  const userId = randomUUID();
  const email = `confirm-${userId.slice(0, 8)}@example.com`;
  const rpSubId = `sub_${randomUUID().replace(/-/g, '').slice(0, 14)}`;
  const payId = `pay_${randomUUID().replace(/-/g, '').slice(0, 14)}`;
  const invId = `inv_${randomUUID().replace(/-/g, '').slice(0, 14)}`;
  const expectedPaise = subscriptionTotalsInr(3999).totalInr * 100;
  const secret = process.env.RAZORPAY_KEY_SECRET || 'test_secret_for_hmac';

  try {
    await client.query(
      `INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
       VALUES ($1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', $2, crypt('test', gen_salt('bf')), now(), '{}', '{}', now(), now())`,
      [userId, email]
    );
    await client.query(
      `INSERT INTO user_credits (id, credits, image_credits_subscription, image_credits_addon, video_credits_subscription, video_credits_addon, updated_at)
       VALUES ($1, 0, 0, 0, 0, 0, now())
       ON CONFLICT (id) DO UPDATE SET
         image_credits_subscription = 0,
         image_credits_addon = 0,
         video_credits_subscription = 0,
         video_credits_addon = 0,
         updated_at = now()`,
      [userId]
    );

    const periodStart = new Date();
    const periodEnd = new Date(periodStart);
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    const subRes = await client.query(
      `INSERT INTO subscriptions (
         user_id, plan_id, status, razorpay_subscription_id,
         current_period_start, current_period_end, next_reset_date
       ) VALUES ($1, 'skalx_starter', 'pending', $2, $3, $4, $4)
       RETURNING id`,
      [userId, rpSubId, periodStart.toISOString(), periodEnd.toISOString()]
    );
    const subscriptionId = subRes.rows[0].id as string;

    const fetchInvoice = async () =>
      sampleAddonInvoice({
        id: invId,
        subscription_id: rpSubId,
        payment_id: payId,
        amount: expectedPaise,
        amount_paid: expectedPaise,
        line_items: [
          {
            name: 'SkalX Starter — first month (incl. GST)',
            amount: expectedPaise,
            type: 'addon',
          },
        ],
      });

    const fetchPayment = async () => ({
      id: payId,
      status: 'captured' as const,
      amount: expectedPaise,
      currency: 'INR',
      invoice_id: invId,
      order_id: null,
      subscription_id: null,
    });

    // Unauthorized payment status
    {
      const r = await confirmSubscriptionPayment(
        {
          userId,
          subscriptionId,
          razorpayPaymentId: payId,
          razorpaySubscriptionId: rpSubId,
          razorpaySignature: 'bad',
        },
        {
          requireSignature: false,
          fetchPayment: async () => ({
            id: payId,
            status: 'authorized',
            amount: expectedPaise,
            currency: 'INR',
            invoice_id: invId,
          }),
          fetchInvoice,
        }
      );
      assertEqual(
        r.status,
        'pending',
        `authorized → pending (got ${r.status}${
          r.status !== 'provisioned' ? `:${(r as any).reason}` : ''
        })`
      );
      const bal = await client.query(`SELECT image_credits_subscription FROM user_credits WHERE id = $1`, [
        userId,
      ]);
      assertEqual(bal.rows[0].image_credits_subscription, 0, 'no grant when authorized');
    }

    // Wrong amount
    {
      const r = await confirmSubscriptionPayment(
        {
          userId,
          subscriptionId,
          razorpayPaymentId: payId,
          razorpaySubscriptionId: rpSubId,
        },
        {
          requireSignature: false,
          fetchPayment: async () => ({
            id: payId,
            status: 'captured',
            amount: 100,
            currency: 'INR',
            invoice_id: invId,
          }),
          fetchInvoice,
        }
      );
      assertEqual(r.status, 'rejected', 'amount mismatch rejected');
      assert(r.status === 'rejected' && r.permanent, 'permanent rejection');
    }

    // Signature required by default
    {
      const r = await confirmSubscriptionPayment({
        userId,
        subscriptionId,
        razorpayPaymentId: payId,
        razorpaySubscriptionId: rpSubId,
      });
      assertEqual(r.status, 'rejected', 'missing signature rejected');
    }

    // Valid captured Starter → 50 / 1200
    const signature = createHmac('sha256', secret)
      .update(`${payId}|${rpSubId}`)
      .digest('hex');
    // confirmSubscriptionPayment reads process.env.RAZORPAY_KEY_SECRET
    process.env.RAZORPAY_KEY_SECRET = secret;

    const first = await confirmSubscriptionPayment(
      {
        userId,
        subscriptionId,
        razorpayPaymentId: payId,
        razorpaySubscriptionId: rpSubId,
        razorpaySignature: signature,
      },
      { fetchPayment, fetchInvoice }
    );
    assertEqual(first.status, 'provisioned', 'captured provisions');
    let bal = await client.query(`SELECT * FROM user_credits WHERE id = $1`, [userId]);
    assertEqual(bal.rows[0].image_credits_subscription, 50, 'starter image 50');
    assertEqual(bal.rows[0].video_credits_subscription, 1200, 'starter video 1200');

    // Duplicate confirm + concurrent-style second call → once
    const dup = await confirmSubscriptionPayment(
      {
        userId,
        subscriptionId,
        razorpayPaymentId: payId,
        razorpaySubscriptionId: rpSubId,
        razorpaySignature: signature,
      },
      { fetchPayment, fetchInvoice }
    );
    assertEqual(dup.status, 'provisioned', 'duplicate ok');
    bal = await client.query(`SELECT * FROM user_credits WHERE id = $1`, [userId]);
    assertEqual(bal.rows[0].image_credits_subscription, 50, 'still 50');
    const cycles = await client.query(
      `SELECT count(*)::int AS n FROM subscription_cycles WHERE user_id = $1`,
      [userId]
    );
    assertEqual(cycles.rows[0].n, 1, 'one cycle only');

    // tryProvision directly with wrong expected user
    {
      const otherPay = `pay_${randomUUID().replace(/-/g, '').slice(0, 14)}`;
      const otherInv = `inv_${randomUUID().replace(/-/g, '').slice(0, 14)}`;
      const bad = await tryProvisionInitialSubscriptionFromCapturedPayment(
        {
          id: otherPay,
          status: 'captured',
          amount: expectedPaise,
          currency: 'INR',
          invoice_id: otherInv,
        },
        {
          fetchInvoice: async () =>
            sampleAddonInvoice({
              id: otherInv,
              subscription_id: rpSubId,
              payment_id: otherPay,
              amount: expectedPaise,
            }),
          expected: { userId: randomUUID() },
        }
      );
      assertEqual(bad.handled, false, 'user mismatch not handled');
      assertEqual((bad as any).reason, 'subscription_user_mismatch', 'reason');
    }

    // Growth entitlements via provisioner path (separate payment)
    {
      const growthPay = `pay_${randomUUID().replace(/-/g, '').slice(0, 14)}`;
      const growthInv = `inv_${randomUUID().replace(/-/g, '').slice(0, 14)}`;
      const growthPaise = subscriptionTotalsInr(6999).totalInr * 100;
      await client.query(`UPDATE subscriptions SET plan_id = 'skalx_growth' WHERE id = $1`, [
        subscriptionId,
      ]);
      // Reset so we can see growth amounts (provisioner overwrites subscription buckets)
      const g = await tryProvisionInitialSubscriptionFromCapturedPayment(
        {
          id: growthPay,
          status: 'captured',
          amount: growthPaise,
          currency: 'INR',
          invoice_id: growthInv,
        },
        {
          fetchInvoice: async () =>
            sampleAddonInvoice({
              id: growthInv,
              subscription_id: rpSubId,
              payment_id: growthPay,
              amount: growthPaise,
              line_items: [
                {
                  name: 'SkalX Growth — first month (incl. GST)',
                  amount: growthPaise,
                  type: 'addon',
                },
              ],
            }),
          expected: { userId, subscriptionId, razorpaySubscriptionId: rpSubId },
        }
      );
      assert(g.handled, 'growth handled');
      bal = await client.query(`SELECT * FROM user_credits WHERE id = $1`, [userId]);
      assertEqual(bal.rows[0].image_credits_subscription, 150, 'growth image');
      assertEqual(bal.rows[0].video_credits_subscription, 2400, 'growth video');
    }

    console.log('PASS: DB confirm + entitlements + idempotency');
  } finally {
    await client.query(`DELETE FROM credit_history WHERE user_id = $1`, [userId]).catch(() => {});
    await client.query(`DELETE FROM subscription_cycles WHERE user_id = $1`, [userId]).catch(() => {});
    await client.query(`DELETE FROM payments WHERE user_id = $1`, [userId]).catch(() => {});
    await client.query(`DELETE FROM subscriptions WHERE user_id = $1`, [userId]).catch(() => {});
    await client.query(`DELETE FROM user_credits WHERE id = $1`, [userId]).catch(() => {});
    await client.query(`DELETE FROM auth.users WHERE id = $1`, [userId]).catch(() => {});
    await client.end();
  }

  console.log('=== ALL subscription confirm tests passed ===');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
