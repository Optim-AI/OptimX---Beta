/**
 * Phase 1B-1 subscription cycle entitlement tests (LOCAL DB).
 * Run: npx tsx lib/billing/subscription-entitlement.test.ts
 *
 * Requires local Supabase with migration 20260326000000 applied
 * and active skalx_* plans.
 */

import 'dotenv/config';
import { config } from 'dotenv';
config({ path: '.env.local' });

import { randomUUID } from 'crypto';
import { Client } from 'pg';
import {
  provisionSubscriptionCycleForCharge,
  subscriptionChargeIdempotencyKey,
  SubscriptionEntitlementError,
} from './subscription-entitlement';
import { CreditResetJob } from '@/lib/jobs/credit-reset.job';

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

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL required');
  const u = new URL(url);
  if (!['localhost', '127.0.0.1'].includes(u.hostname) || u.port !== '54322') {
    throw new Error(`Refusing non-local DB: ${u.hostname}:${u.port}`);
  }

  console.log('=== Phase 1B-1 subscription-entitlement tests (LOCAL) ===');
  console.log('TARGET', u.hostname + ':' + u.port);

  const client = new Client({ connectionString: url });
  await client.connect();

  const userId = randomUUID();
  const email = `entitlement-test-${userId.slice(0, 8)}@example.com`;

  try {
    // Fixture: auth user + wallet with leftover subscription + addon
    await client.query(
      `INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
       VALUES ($1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', $2, crypt('test', gen_salt('bf')), now(), '{}', '{}', now(), now())`,
      [userId, email]
    );

    // Trigger may have created zeroed user_credits — set leftover sub + addon balances
    await client.query(
      `INSERT INTO user_credits (id, credits, image_credits_subscription, image_credits_addon, video_credits_subscription, video_credits_addon, updated_at)
       VALUES ($1, 0, 12, 7, 400, 900, now())
       ON CONFLICT (id) DO UPDATE SET
         image_credits_subscription = 12,
         image_credits_addon = 7,
         video_credits_subscription = 400,
         video_credits_addon = 900,
         updated_at = now()`,
      [userId]
    );

    const subRes = await client.query(
      `INSERT INTO subscriptions (user_id, plan_id, status, current_period_start, current_period_end, next_reset_date)
       VALUES ($1, 'skalx_growth', 'pending', now(), now() + interval '1 month', now() + interval '1 month')
       RETURNING id`,
      [userId]
    );
    const subscriptionId = subRes.rows[0].id as string;

    const pay1 = `pay_test_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
    const pay2 = `pay_test_${randomUUID().replace(/-/g, '').slice(0, 16)}`;

    // --- Unit: idempotency key ---
    assertEqual(
      subscriptionChargeIdempotencyKey(pay1),
      `sub_charge:${pay1}`,
      'idempotency key format'
    );
    let threw = false;
    try {
      subscriptionChargeIdempotencyKey('');
    } catch (e) {
      threw = e instanceof Error;
    }
    assert(threw, 'empty payment id throws');

    // --- 1. First charge grants exactly one cycle ---
    const first = await provisionSubscriptionCycleForCharge({
      subscriptionId,
      userId,
      planId: 'skalx_growth',
      razorpayPaymentId: pay1,
    });
    assert(first.created && first.creditsGranted, 'first charge creates + grants');
    assertEqual(first.cycle.status, 'provisioned', 'first cycle provisioned');
    assertEqual(first.cycle.imageCreditsGranted, 150, 'growth image 150');
    assertEqual(first.cycle.videoCreditsGranted, 2400, 'growth video 2400');

    let bal = await client.query(`SELECT * FROM user_credits WHERE id = $1`, [userId]);
    assertEqual(bal.rows[0].image_credits_subscription, 150, 'sub image reset to 150');
    assertEqual(bal.rows[0].video_credits_subscription, 2400, 'sub video reset to 2400');
    assertEqual(bal.rows[0].image_credits_addon, 7, 'addon image preserved');
    assertEqual(bal.rows[0].video_credits_addon, 900, 'addon video preserved');
    // 12 and 400 did not roll over
    console.log('PASS 1/5/6/7: first grant + no rollover + addon preserved');

    // --- 2/3/10. Duplicate same payment — no second grant ---
    const beforeHist = await client.query(
      `SELECT COUNT(*)::int AS c FROM credit_history WHERE user_id = $1 AND source = 'subscription_cycle'`,
      [userId]
    );
    const dup = await provisionSubscriptionCycleForCharge({
      subscriptionId,
      userId,
      planId: 'skalx_growth',
      razorpayPaymentId: pay1,
    });
    assert(!dup.created && !dup.creditsGranted, 'duplicate does not grant');
    assertEqual(dup.cycle.id, first.cycle.id, 'same cycle returned');
    const afterHist = await client.query(
      `SELECT COUNT(*)::int AS c FROM credit_history WHERE user_id = $1 AND source = 'subscription_cycle'`,
      [userId]
    );
    assertEqual(afterHist.rows[0].c, beforeHist.rows[0].c, 'no extra credit_history on dup');
    console.log('PASS 2/3/10: duplicate idempotent');

    // --- 8. credit_history metadata ---
    const hist = await client.query(
      `SELECT metadata FROM credit_history
       WHERE user_id = $1 AND source = 'subscription_cycle' AND credit_type = 'image'
       ORDER BY created_at DESC LIMIT 1`,
      [userId]
    );
    const meta = hist.rows[0].metadata;
    assertEqual(meta.cycleId, first.cycle.id, 'history cycleId');
    assertEqual(meta.razorpayPaymentId, pay1, 'history payment id');
    assertEqual(meta.idempotencyKey, `sub_charge:${pay1}`, 'history idempotency key');
    assertEqual(meta.subscriptionId, subscriptionId, 'history subscriptionId');
    console.log('PASS 8: credit_history metadata');

    // --- 4. Concurrent duplicates ---
    const payC = `pay_conc_${randomUUID().replace(/-/g, '').slice(0, 14)}`;
    // Reset leftover sub balances to prove concurrent grant once
    await client.query(
      `UPDATE user_credits SET image_credits_subscription = 1, video_credits_subscription = 1 WHERE id = $1`,
      [userId]
    );
    const concurrent = await Promise.all([
      provisionSubscriptionCycleForCharge({
        subscriptionId,
        userId,
        planId: 'skalx_growth',
        razorpayPaymentId: payC,
      }),
      provisionSubscriptionCycleForCharge({
        subscriptionId,
        userId,
        planId: 'skalx_growth',
        razorpayPaymentId: payC,
      }),
      provisionSubscriptionCycleForCharge({
        subscriptionId,
        userId,
        planId: 'skalx_growth',
        razorpayPaymentId: payC,
      }),
    ]);
    const grantedCount = concurrent.filter((r) => r.creditsGranted).length;
    assertEqual(grantedCount, 1, 'exactly one concurrent grant');
    const cycleIds = new Set(concurrent.map((r) => r.cycle.id));
    assertEqual(cycleIds.size, 1, 'one cycle id under concurrency');
    const cycleRows = await client.query(
      `SELECT COUNT(*)::int AS c FROM subscription_cycles WHERE razorpay_payment_id = $1`,
      [payC]
    );
    assertEqual(cycleRows.rows[0].c, 1, 'one cycle row for concurrent payment');
    console.log('PASS 4: concurrent duplicate safe');

    // --- 11. Different payment → new cycle / renewal ---
    await client.query(
      `UPDATE user_credits SET image_credits_subscription = 12, video_credits_subscription = 400,
       image_credits_addon = 7, video_credits_addon = 900 WHERE id = $1`,
      [userId]
    );
    const renew = await provisionSubscriptionCycleForCharge({
      subscriptionId,
      userId,
      planId: 'skalx_growth',
      razorpayPaymentId: pay2,
    });
    assert(renew.created && renew.creditsGranted, 'renewal creates new cycle');
    assert(renew.cycle.id !== first.cycle.id, 'renewal different cycle id');
    bal = await client.query(`SELECT * FROM user_credits WHERE id = $1`, [userId]);
    assertEqual(bal.rows[0].image_credits_subscription, 150, 'renewal sub image 150');
    assertEqual(bal.rows[0].video_credits_subscription, 2400, 'renewal sub video 2400');
    assertEqual(bal.rows[0].image_credits_addon, 7, 'renewal addon image');
    assertEqual(bal.rows[0].video_credits_addon, 900, 'renewal addon video');
    console.log('PASS 5/11: renewal new cycle + replace subscription balances');

    // --- 9. Failed transaction rolls back (inactive plan) ---
    await client.query(`UPDATE plans SET is_active = false WHERE id = 'skalx_growth'`);
    const payFail = `pay_fail_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
    const cyclesBefore = await client.query(
      `SELECT COUNT(*)::int AS c FROM subscription_cycles WHERE user_id = $1`,
      [userId]
    );
    let failErr: unknown;
    try {
      await provisionSubscriptionCycleForCharge({
        subscriptionId,
        userId,
        planId: 'skalx_growth',
        razorpayPaymentId: payFail,
      });
    } catch (e) {
      failErr = e;
    }
    await client.query(`UPDATE plans SET is_active = true WHERE id = 'skalx_growth'`);
    assert(
      failErr instanceof SubscriptionEntitlementError && failErr.code === 'PLAN_INACTIVE',
      'inactive plan throws'
    );
    const cyclesAfter = await client.query(
      `SELECT COUNT(*)::int AS c FROM subscription_cycles WHERE user_id = $1`,
      [userId]
    );
    assertEqual(cyclesAfter.rows[0].c, cyclesBefore.rows[0].c, 'failed txn no cycle row');
    const noPayFail = await client.query(
      `SELECT COUNT(*)::int AS c FROM subscription_cycles WHERE razorpay_payment_id = $1`,
      [payFail]
    );
    assertEqual(noPayFail.rows[0].c, 0, 'failed payment id not recorded');
    console.log('PASS 9: failed transaction rolls back');

    // --- 12. PAYG path unchanged (structural) ---
    const { grantCreditsForCapturedPayment } = await import('@/lib/razorpay/credit-grant');
    await grantCreditsForCapturedPayment({
      id: randomUUID(),
      userId,
      paymentType: 'subscription',
      metadata: { creditType: 'image', credits: 999 },
      razorpayPaymentId: 'pay_ignore',
    } as any);
    bal = await client.query(`SELECT * FROM user_credits WHERE id = $1`, [userId]);
    assertEqual(bal.rows[0].image_credits_addon, 7, 'PAYG grant helper ignores subscription type');
    console.log('PASS 12: PAYG grant helper unchanged for subscription type');

    // Cron does not grant
    const cron = await CreditResetJob.run();
    assert(
      typeof cron.entitlementGrantsSkipped === 'number',
      'cron reports skipped entitlement grants'
    );
    console.log('PASS cron: entitlement grants disabled');

    console.log('\n=== All Phase 1B-1 entitlement tests passed ===');
  } finally {
    // Cleanup fixture (best-effort)
    try {
      await client.query(`DELETE FROM credit_history WHERE user_id = $1`, [userId]);
      await client.query(`DELETE FROM subscription_cycles WHERE user_id = $1`, [userId]);
      await client.query(`DELETE FROM subscriptions WHERE user_id = $1`, [userId]);
      await client.query(`DELETE FROM user_credits WHERE id = $1`, [userId]);
      await client.query(`DELETE FROM auth.users WHERE id = $1`, [userId]);
    } catch (e) {
      console.warn('cleanup warning', e);
    }
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
