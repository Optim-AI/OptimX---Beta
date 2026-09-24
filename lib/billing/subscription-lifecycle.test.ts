/**
 * Phase 1B-2 subscription lifecycle tests — LOCAL ONLY
 *
 * Covers trial rejection, cancel-at-period-end, past_due, plan-change lock,
 * and charge-driven provisioning regressions.
 */

import 'dotenv/config';
import { config } from 'dotenv';
config({ path: '.env.local' });

import { randomUUID } from 'crypto';
import { Client } from 'pg';
import { SubscriptionService } from '@/lib/razorpay/subscription.service';
import { PlanChangeService } from '@/lib/razorpay/plan-change.service';
import { WebhookService } from '@/lib/razorpay/webhook.service';
import { SubscriptionsDAO } from '@/database/models/Subscriptions.dao';
import { provisionSubscriptionCycleForCharge } from '@/lib/billing/subscription-entitlement';
import { isCanonicalSubscriptionPlanId } from '@/lib/billing/canonical-plans';
import { grantCreditsForCapturedPayment } from '@/lib/razorpay/credit-grant';
import { CreditResetJob } from '@/lib/jobs/credit-reset.job';

function assert(cond: any, msg: string): asserts cond {
  if (!cond) throw new Error(`ASSERT: ${msg}`);
}

function assertLocal() {
  const u = new URL(process.env.DATABASE_URL!);
  assert(
    (u.hostname === 'localhost' || u.hostname === '127.0.0.1') && u.port === '54322',
    'Must target LOCAL localhost:54322'
  );
  console.log('TARGET', u.hostname + ':' + u.port);
}

async function main() {
  assertLocal();
  console.log('=== Phase 1B-2 subscription-lifecycle tests (LOCAL) ===');

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  const userId = randomUUID();
  const email = `lifecycle-${userId.slice(0, 8)}@test.local`;

  try {
    await client.query(
      `INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
       VALUES ($1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', $2, crypt('test', gen_salt('bf')), now(), '{}', '{}', now(), now())`,
      [userId, email]
    );
    await client.query(
      `INSERT INTO user_credits (id, credits, image_credits_subscription, image_credits_addon, video_credits_subscription, video_credits_addon, updated_at)
       VALUES ($1, 0, 0, 7, 0, 900, now())
       ON CONFLICT (id) DO UPDATE SET
         image_credits_subscription = 0,
         image_credits_addon = 7,
         video_credits_subscription = 0,
         video_credits_addon = 900,
         updated_at = now()`,
      [userId]
    );

    // --- 1: reject trial ---
    {
      const r = await SubscriptionService.createSubscription({
        userId,
        email,
        planId: 'free_trial',
      });
      assert(!r.success, '1: trial create must fail');
      assert(/trial/i.test(r.error || ''), `1: trial error message, got ${r.error}`);
      console.log('PASS 1: rejects trial billing cycle');
    }

    // --- 2: reject inactive ---
    {
      const r = await SubscriptionService.createSubscription({
        userId,
        email,
        planId: 'starter_monthly',
      });
      assert(!r.success, '2: inactive plan must fail');
      console.log('PASS 2: rejects inactive plan');
    }

    // --- 3: only canonical active ---
    {
      assert(isCanonicalSubscriptionPlanId('skalx_starter'), '3: starter canonical');
      assert(isCanonicalSubscriptionPlanId('skalx_growth'), '3: growth canonical');
      assert(isCanonicalSubscriptionPlanId('skalx_pro'), '3: pro canonical');
      assert(!isCanonicalSubscriptionPlanId('basic_monthly'), '3: legacy not canonical');
      const r = await SubscriptionService.createSubscription({
        userId,
        email,
        planId: 'growth_pro_monthly',
      });
      assert(!r.success, '3: legacy active=false must fail');
      console.log('PASS 3: only canonical active plans accepted');
    }

    // Create local active subscription fixture (no Razorpay call)
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);
    const razorpaySubId = `sub_test_${userId.slice(0, 8)}`;
    const [subRow] = (
      await client.query(
        `INSERT INTO subscriptions (
           user_id, plan_id, status, razorpay_subscription_id,
           current_period_start, current_period_end, next_reset_date, cancel_at_period_end
         ) VALUES ($1, 'skalx_growth', 'active', $2, $3, $4, $4, false)
         RETURNING id`,
        [userId, razorpaySubId, now.toISOString(), periodEnd.toISOString()]
      )
    ).rows;

    const subscriptionId = subRow.id as string;

    // --- 4: no credits on create (wallet still addon-only) ---
    {
      const bal = (
        await client.query(
          `SELECT image_credits_subscription, video_credits_subscription,
                  image_credits_addon, video_credits_addon
           FROM user_credits WHERE id = $1`,
          [userId]
        )
      ).rows[0];
      assert(bal.image_credits_subscription === 0, '4: no sub image on create');
      assert(bal.video_credits_subscription === 0, '4: no sub video on create');
      assert(bal.image_credits_addon === 7, '4: addon image preserved');
      assert(bal.video_credits_addon === 900, '4: addon video preserved');
      console.log('PASS 4: no credits granted on subscription creation');
    }

    // --- 5: activated alone grants nothing ---
    {
      await WebhookService['handleSubscriptionActivated']({
        subscription: { entity: { id: razorpaySubId, status: 'active' } },
      });
      const bal = (
        await client.query(
          `SELECT image_credits_subscription, video_credits_subscription FROM user_credits WHERE id = $1`,
          [userId]
        )
      ).rows[0];
      assert(bal.image_credits_subscription === 0, '5: activated no image grant');
      assert(bal.video_credits_subscription === 0, '5: activated no video grant');
      const cycles = (
        await client.query(`SELECT COUNT(*)::int AS c FROM subscription_cycles WHERE user_id = $1`, [
          userId,
        ])
      ).rows[0].c;
      assert(cycles === 0, '5: no cycle on activated');
      console.log('PASS 5: subscription.activated grants no credits');
    }

    // --- 6/7: charged once + duplicate ---
    const paymentId1 = `pay_life_${userId.slice(0, 8)}_1`;
    {
      const first = await provisionSubscriptionCycleForCharge({
        subscriptionId,
        userId,
        planId: 'skalx_growth',
        razorpayPaymentId: paymentId1,
      });
      assert(first.created && first.creditsGranted, '6: first charge creates cycle');
      const bal = (
        await client.query(
          `SELECT image_credits_subscription, video_credits_subscription,
                  image_credits_addon, video_credits_addon
           FROM user_credits WHERE id = $1`,
          [userId]
        )
      ).rows[0];
      assert(bal.image_credits_subscription === 150, '6: growth image');
      assert(bal.video_credits_subscription === 2400, '6: growth video');
      assert(bal.image_credits_addon === 7, '6/15: addon image preserved');
      assert(bal.video_credits_addon === 900, '6/15: addon video preserved');

      const dup = await provisionSubscriptionCycleForCharge({
        subscriptionId,
        userId,
        planId: 'skalx_growth',
        razorpayPaymentId: paymentId1,
      });
      assert(!dup.created && !dup.creditsGranted, '7: duplicate no re-grant');
      assert(dup.cycle.id === first.cycle.id, '7: same cycle returned');
      console.log('PASS 6/7/15: charged once; duplicate safe; addon preserved');
    }

    // --- 8/9: cancel request does not revoke access ---
    {
      // No razorpay call when we schedule via DAO; also exercise service without RP id
      await client.query(
        `UPDATE subscriptions SET razorpay_subscription_id = NULL WHERE id = $1`,
        [subscriptionId]
      );
      const cancel = await SubscriptionService.cancelSubscription(subscriptionId);
      assert(cancel.success, `8: cancel ok: ${cancel.error}`);
      assert(cancel.cancelAtPeriodEnd === true, '9: cancel_at_period_end true');

      const sub = await SubscriptionsDAO.getById(subscriptionId);
      assert(sub?.status === 'active', '8: status still active');
      assert(sub?.cancelAtPeriodEnd === true, '9: flag persisted');

      const bal = (
        await client.query(
          `SELECT image_credits_subscription, video_credits_subscription,
                  image_credits_addon FROM user_credits WHERE id = $1`,
          [userId]
        )
      ).rows[0];
      assert(bal.image_credits_subscription === 150, '8: sub credits not zeroed');
      assert(bal.video_credits_subscription === 2400, '8: video not zeroed');
      assert(bal.image_credits_addon === 7, '8: addon intact');
      console.log('PASS 8/9: cancel schedules period-end; access retained');

      // restore razorpay id for later webhook tests
      await client.query(
        `UPDATE subscriptions SET razorpay_subscription_id = $2 WHERE id = $1`,
        [subscriptionId, razorpaySubId]
      );
    }

    // --- 10: no renewal grant after cancel scheduled (simulate: we do not auto-grant;
    //          a NEW payment id would still provision if Razorpay charged — product relies
    //          on Razorpay not charging. Assert cancel flag blocks nothing incorrectly
    //          for SAME payment, and cron does not grant.) ---
    {
      const before = (
        await client.query(
          `SELECT COUNT(*)::int AS c FROM subscription_cycles WHERE user_id = $1`,
          [userId]
        )
      ).rows[0].c;
      const cron = await CreditResetJob.run();
      assert(
        cron.entitlementGrantsSkipped !== undefined,
        '10: cron reports skipped entitlements'
      );
      const after = (
        await client.query(
          `SELECT COUNT(*)::int AS c FROM subscription_cycles WHERE user_id = $1`,
          [userId]
        )
      ).rows[0].c;
      assert(after === before, '10: cron did not create cycles');
      const bal = (
        await client.query(
          `SELECT image_credits_subscription FROM user_credits WHERE id = $1`,
          [userId]
        )
      ).rows[0];
      assert(bal.image_credits_subscription === 150, '10: cron did not reset balances');
      console.log('PASS 10: no cron renewal grant after cancel scheduled');
    }

    // --- 11: failed payment / past_due does not provision ---
    {
      await WebhookService['handleSubscriptionPastDue'](
        { subscription: { entity: { id: razorpaySubId, status: 'pending' } } },
        'subscription.pending'
      );
      const sub = await SubscriptionsDAO.getById(subscriptionId);
      assert(sub?.status === 'past_due', '11: status past_due');
      const before = (
        await client.query(
          `SELECT COUNT(*)::int AS c FROM subscription_cycles WHERE user_id = $1`,
          [userId]
        )
      ).rows[0].c;
      // payment.failed must not create cycle
      await WebhookService['handlePaymentFailed']({
        payment: {
          entity: {
            id: `pay_fail_${userId.slice(0, 8)}`,
            subscription_id: razorpaySubId,
          },
        },
      });
      const after = (
        await client.query(
          `SELECT COUNT(*)::int AS c FROM subscription_cycles WHERE user_id = $1`,
          [userId]
        )
      ).rows[0].c;
      assert(after === before, '11: failed payment no cycle');
      console.log('PASS 11: past_due / failed payment does not provision');
    }

    // --- 12: successful retry provisions once ---
    {
      // Clear cancel flag so retry path is clean; still past_due
      await client.query(
        `UPDATE subscriptions SET cancel_at_period_end = false WHERE id = $1`,
        [subscriptionId]
      );
      const paymentId2 = `pay_life_${userId.slice(0, 8)}_retry`;
      const retry = await provisionSubscriptionCycleForCharge({
        subscriptionId,
        userId,
        planId: 'skalx_growth',
        razorpayPaymentId: paymentId2,
      });
      assert(retry.created && retry.creditsGranted, '12: retry provisions once');
      const sub = await SubscriptionsDAO.getById(subscriptionId);
      assert(sub?.status === 'active', '12: status active after charge');
      const dup = await provisionSubscriptionCycleForCharge({
        subscriptionId,
        userId,
        planId: 'skalx_growth',
        razorpayPaymentId: paymentId2,
      });
      assert(!dup.creditsGranted, '12: duplicate retry no grant');
      console.log('PASS 12: successful retry provisions exactly once');
    }

    // --- 13: plan change rejected ---
    {
      const r = await PlanChangeService.changePlan({
        userId,
        subscriptionId,
        newPlanId: 'skalx_pro',
      });
      assert(!r.success, '13: plan change blocked');
      assert(r.code === 'PLAN_CHANGE_UNAVAILABLE', '13: code set');
      console.log('PASS 13: unsupported plan change rejected');
    }

    // --- 14: PAYG helper ignores subscription payment type ---
    {
      const before = (
        await client.query(
          `SELECT image_credits_addon, video_credits_addon FROM user_credits WHERE id = $1`,
          [userId]
        )
      ).rows[0];
      await grantCreditsForCapturedPayment({
        id: randomUUID(),
        userId,
        amount: 100,
        currency: 'INR',
        status: 'captured',
        paymentType: 'subscription',
        creditPackId: null,
        razorpayPaymentId: `pay_ignore_${userId.slice(0, 8)}`,
        razorpayOrderId: null,
        subscriptionId,
        metadata: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as any);
      const after = (
        await client.query(
          `SELECT image_credits_addon, video_credits_addon FROM user_credits WHERE id = $1`,
          [userId]
        )
      ).rows[0];
      assert(after.image_credits_addon === before.image_credits_addon, '14: PAYG path ignores sub');
      assert(after.video_credits_addon === before.video_credits_addon, '14: video addon unchanged');
      console.log('PASS 14: PAYG credits unaffected by subscription payment type');
    }

    // --- cancelled webhook effective ---
    {
      await WebhookService['handleSubscriptionCancelled']({
        subscription: { entity: { id: razorpaySubId, status: 'cancelled' } },
      });
      const sub = await SubscriptionsDAO.getById(subscriptionId);
      assert(sub?.status === 'cancelled', 'cancelled webhook marks cancelled');
      const bal = (
        await client.query(
          `SELECT image_credits_addon, video_credits_addon FROM user_credits WHERE id = $1`,
          [userId]
        )
      ).rows[0];
      assert(bal.image_credits_addon === 7, 'cancelled does not destroy addon image');
      assert(bal.video_credits_addon === 900, 'cancelled does not destroy addon video');
      console.log('PASS: subscription.cancelled effective; addon preserved');
    }

    console.log('\n=== All Phase 1B-2 lifecycle tests passed ===');
  } finally {
    try {
      await client.query(`DELETE FROM credit_history WHERE user_id = $1`, [userId]);
      await client.query(`DELETE FROM subscription_cycles WHERE user_id = $1`, [userId]);
      await client.query(`DELETE FROM webhook_events WHERE payload::text LIKE $1`, [
        `%${userId}%`,
      ]);
      await client.query(`DELETE FROM payments WHERE user_id = $1`, [userId]);
      await client.query(`DELETE FROM subscriptions WHERE user_id = $1`, [userId]);
      await client.query(`DELETE FROM user_credits WHERE id = $1`, [userId]);
      await client.query(`DELETE FROM auth.users WHERE id = $1`, [userId]);
    } catch (e) {
      console.warn('cleanup warning', e);
    }
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
