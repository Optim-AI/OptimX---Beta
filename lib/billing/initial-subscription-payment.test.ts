/**
 * Phase 11.9 — initial subscription addon payment classification + provisioning tests.
 * Run: npx tsx lib/billing/initial-subscription-payment.test.ts
 *
 * Classification tests are pure. Provisioning tests require local Supabase (54322).
 */

import 'dotenv/config';
import { config } from 'dotenv';
config({ path: '.env.local' });

import { randomUUID } from 'crypto';
import { createHmac } from 'crypto';
import { Client } from 'pg';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
  isFirstMonthSubscriptionAddonInvoice,
  isPaymentCaptured,
  tryProvisionInitialSubscriptionFromCapturedPayment,
  type RazorpayInvoiceLike,
} from './initial-subscription-payment';
import { WebhookService } from '@/lib/razorpay/webhook.service';
import { subscriptionTotalsInr } from './marketing-plans';

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

function sampleAddonInvoice(overrides: Partial<RazorpayInvoiceLike> = {}): RazorpayInvoiceLike {
  return {
    id: 'inv_test_addon_1',
    status: 'paid',
    subscription_id: 'sub_test_abc',
    payment_id: 'pay_test_abc',
    amount: 471900,
    amount_paid: 471900,
    currency: 'INR',
    line_items: [
      {
        name: 'SkalX Starter — first month (incl. GST)',
        amount: 471900,
        type: 'addon',
      },
    ],
    ...overrides,
  };
}

async function main() {
  console.log('=== Phase 11.9 initial-subscription-payment tests ===');

  // --- Pure classification ---
  assert(isPaymentCaptured({ id: 'pay_x', status: 'captured' }), 'captured status');
  assert(isPaymentCaptured({ id: 'pay_x', captured: true }), 'captured flag');
  assert(!isPaymentCaptured({ id: 'pay_x', status: 'authorized' }), 'authorized alone');
  assert(
    isFirstMonthSubscriptionAddonInvoice(sampleAddonInvoice()),
    'first-month addon invoice'
  );
  assert(
    !isFirstMonthSubscriptionAddonInvoice(
      sampleAddonInvoice({
        line_items: [{ name: 'Monthly Plan', amount: 471900, type: 'plan' }],
      })
    ),
    'plan line is not first-month addon'
  );
  assert(
    !isFirstMonthSubscriptionAddonInvoice(
      sampleAddonInvoice({ subscription_id: null })
    ),
    'missing subscription_id'
  );
  console.log('PASS A0: classification helpers');

  // --- Static code contracts ---
  {
    const webhook = readFileSync(
      resolve(__dirname, '../razorpay/webhook.service.ts'),
      'utf8'
    );
    assert(
      webhook.includes('tryProvisionInitialSubscriptionFromCapturedPayment'),
      'webhook wires initial-sub path'
    );
    assert(
      webhook.includes("payment.paymentType !== 'image_topup'"),
      'PAYG type guard before grant'
    );
    assert(
      webhook.includes('handleSubscriptionCharged'),
      'renewal handler still present'
    );
    console.log('PASS A1: webhook contracts');
  }

  // --- Signature reject ---
  {
    const { RAZORPAY_WEBHOOK_SECRET } = await import('@/lib/razorpay/client');
    const body = JSON.stringify({ event: 'payment.captured' });
    assertEqual(
      WebhookService.verifySignature(body, 'deadbeef'),
      false,
      'invalid signature rejected'
    );
    if ((RAZORPAY_WEBHOOK_SECRET || '').trim()) {
      const good = createHmac('sha256', RAZORPAY_WEBHOOK_SECRET).update(body).digest('hex');
      assertEqual(WebhookService.verifySignature(body, good), true, 'valid signature accepted');
    }
    console.log('PASS G: signature verification');
  }

  const url = process.env.DATABASE_URL;
  if (!url) {
    console.log('SKIP DB tests: DATABASE_URL missing');
    return;
  }
  const u = new URL(url);
  if (!['localhost', '127.0.0.1'].includes(u.hostname) || u.port !== '54322') {
    console.log(`SKIP DB tests: non-local ${u.hostname}:${u.port}`);
    return;
  }

  const client = new Client({ connectionString: url });
  await client.connect();

  const userId = randomUUID();
  const email = `initial-sub-${userId.slice(0, 8)}@example.com`;
  const rpSubId = `sub_test_${randomUUID().replace(/-/g, '').slice(0, 10)}`;
  const payId = `pay_test_${randomUUID().replace(/-/g, '').slice(0, 14)}`;
  const invId = `inv_test_${randomUUID().replace(/-/g, '').slice(0, 14)}`;
  const expectedPaise = subscriptionTotalsInr(3999).totalInr * 100;

  try {
    await client.query(
      `INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
       VALUES ($1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', $2, crypt('test', gen_salt('bf')), now(), '{}', '{}', now(), now())`,
      [userId, email]
    );

    await client.query(
      `INSERT INTO user_credits (id, credits, image_credits_subscription, image_credits_addon, video_credits_subscription, video_credits_addon, updated_at)
       VALUES ($1, 0, 0, 3, 0, 111, now())
       ON CONFLICT (id) DO UPDATE SET
         image_credits_subscription = 0,
         image_credits_addon = 3,
         video_credits_subscription = 0,
         video_credits_addon = 111,
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

    // A: initial payment provisions 50/1200
    const first = await tryProvisionInitialSubscriptionFromCapturedPayment(
      {
        id: payId,
        status: 'captured',
        amount: expectedPaise,
        currency: 'INR',
        order_id: 'order_test_initial',
        invoice_id: invId,
        subscription_id: null,
      },
      { fetchInvoice }
    );
    assert(first.handled, 'A: handled');
    assert(first.handled && first.provisioned && first.created, 'A: provisioned');
    assertEqual(first.handled && first.subscriptionId, subscriptionId, 'A: sub id');

    let bal = await client.query(`SELECT * FROM user_credits WHERE id = $1`, [userId]);
    assertEqual(bal.rows[0].image_credits_subscription, 50, 'A: image 50');
    assertEqual(bal.rows[0].video_credits_subscription, 1200, 'A: video 1200');
    assertEqual(bal.rows[0].image_credits_addon, 3, 'A: addon image preserved');
    assertEqual(bal.rows[0].video_credits_addon, 111, 'A: addon video preserved');

    let sub = await client.query(`SELECT status FROM subscriptions WHERE id = $1`, [
      subscriptionId,
    ]);
    assertEqual(sub.rows[0].status, 'active', 'A: subscription active');

    const cycles = await client.query(
      `SELECT status, idempotency_key, image_credits_granted, video_credits_granted
       FROM subscription_cycles WHERE subscription_id = $1`,
      [subscriptionId]
    );
    assertEqual(cycles.rows.length, 1, 'A: one cycle');
    assertEqual(cycles.rows[0].status, 'provisioned', 'A: cycle provisioned');
    assertEqual(cycles.rows[0].idempotency_key, `sub_charge:${payId}`, 'A: idempotency key');
    assertEqual(cycles.rows[0].image_credits_granted, 50, 'A: cycle image');
    assertEqual(cycles.rows[0].video_credits_granted, 1200, 'A: cycle video');
    console.log('PASS A: initial addon payment → cycle #1 50/1200');

    // B: duplicate same payment — no second grant
    const histBefore = await client.query(
      `SELECT COUNT(*)::int AS c FROM credit_history WHERE user_id = $1 AND source = 'subscription_cycle'`,
      [userId]
    );
    const dup = await tryProvisionInitialSubscriptionFromCapturedPayment(
      {
        id: payId,
        status: 'captured',
        amount: expectedPaise,
        currency: 'INR',
        invoice_id: invId,
      },
      { fetchInvoice }
    );
    assert(dup.handled, 'B: handled');
    assert(dup.handled && !dup.provisioned && !dup.created, 'B: no second grant');
    const histAfter = await client.query(
      `SELECT COUNT(*)::int AS c FROM credit_history WHERE user_id = $1 AND source = 'subscription_cycle'`,
      [userId]
    );
    assertEqual(histAfter.rows[0].c, histBefore.rows[0].c, 'B: history unchanged');
    bal = await client.query(`SELECT * FROM user_credits WHERE id = $1`, [userId]);
    assertEqual(bal.rows[0].image_credits_subscription, 50, 'B: still 50');
    assertEqual(bal.rows[0].video_credits_subscription, 1200, 'B: still 1200');
    console.log('PASS B: duplicate payment.captured is idempotent');

    // F: ambiguous — no invoice id
    const amb = await tryProvisionInitialSubscriptionFromCapturedPayment({
      id: `pay_amb_${randomUUID().slice(0, 8)}`,
      status: 'captured',
      amount: expectedPaise,
      currency: 'INR',
      order_id: 'order_unknown',
      invoice_id: null,
    });
    assertEqual(amb.handled, false, 'F: not handled');
    assertEqual((amb as any).reason, 'missing_invoice_id', 'F: reason');
    console.log('PASS F: ambiguous payment does not grant');

    // F2: amount mismatch
    const badAmt = await tryProvisionInitialSubscriptionFromCapturedPayment(
      {
        id: `pay_bad_${randomUUID().slice(0, 8)}`,
        status: 'captured',
        amount: 100,
        currency: 'INR',
        invoice_id: invId,
      },
      {
        fetchInvoice: async () =>
          sampleAddonInvoice({
            id: invId,
            subscription_id: rpSubId,
            payment_id: `pay_bad`,
            amount: expectedPaise,
          }),
      }
    );
    assertEqual(badAmt.handled, false, 'F2: amount mismatch not handled');
    console.log('PASS F2: amount mismatch rejects');

    // C/D structural: PAYG path still first in webhook (code contract already + grant helper)
    const creditGrant = readFileSync(
      resolve(__dirname, '../razorpay/credit-grant.ts'),
      'utf8'
    );
    assert(
      creditGrant.includes("payment.paymentType !== 'image_topup'"),
      'C/D: PAYG grant still topup-only'
    );
    console.log('PASS C/D: PAYG grant helper unchanged (topup-only)');

    // E: subscription.charged path still present
    const webhook = readFileSync(
      resolve(__dirname, '../razorpay/webhook.service.ts'),
      'utf8'
    );
    assert(
      webhook.includes("case 'subscription.charged'"),
      'E: subscription.charged case'
    );
    assert(
      webhook.includes('provisionSubscriptionCycleForCharge'),
      'E: renewal uses provisioner'
    );
    console.log('PASS E: renewal path preserved');

    // H: webhook event id resolution still deterministic
    const eventId = WebhookService.resolveEventId({
      entity: 'event',
      account_id: 'acc_x',
      event: 'payment.captured',
      contains: ['payment'],
      payload: { payment: { entity: { id: payId } } },
      created_at: 1,
    } as any);
    assertEqual(eventId, `payment.captured:${payId}`, 'H: event id fallback');
    console.log('PASS H: webhook event id resolution');
  } finally {
    await client.query(`DELETE FROM credit_history WHERE user_id = $1`, [userId]).catch(() => {});
    await client.query(`DELETE FROM subscription_cycles WHERE user_id = $1`, [userId]).catch(() => {});
    await client.query(`DELETE FROM payments WHERE user_id = $1`, [userId]).catch(() => {});
    await client.query(`DELETE FROM subscriptions WHERE user_id = $1`, [userId]).catch(() => {});
    await client.query(`DELETE FROM user_credits WHERE id = $1`, [userId]).catch(() => {});
    await client.query(`DELETE FROM auth.users WHERE id = $1`, [userId]).catch(() => {});
    await client.end();
  }

  console.log('=== ALL Phase 11.9 tests passed ===');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
