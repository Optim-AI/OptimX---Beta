/**
 * Payment retry safety — LOCAL ONLY (localhost:54322). Razorpay is stubbed; no network calls.
 * Run: npx tsx lib/billing/payment-retry-safety.test.ts
 *
 * A: PAYG order whose earlier attempt failed still grants credits once on a successful retry.
 * B: invalid verify signature does not poison the order for the webhook.
 * C: payment.failed / subscription.pending on a never-paid checkout keeps it `pending`.
 * D: re-clicking Pay never cancels a pending checkout that Razorpay reports as paid.
 * E: an abandoned checkout (`cancelled`, future period end, never provisioned) is not entitlement.
 */

import 'dotenv/config';
import { config } from 'dotenv';
config({ path: '.env.local' });

import { randomUUID } from 'crypto';
import { Client } from 'pg';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`ASSERT: ${msg}`);
}

// Stub the lazily-created Razorpay client before any service touches it.
const remoteSubs = new Map<string, { status: string; paid_count: number }>();
const cancelled: string[] = [];
let createdCount = 0;
(globalThis as any).razorpay = {
  subscriptions: {
    fetch: async (id: string) => {
      const s = remoteSubs.get(id);
      if (!s) throw new Error('not found');
      return { id, ...s };
    },
    cancel: async (id: string) => {
      cancelled.push(id);
      return { id, status: 'cancelled' };
    },
    create: async () => {
      createdCount += 1;
      return { id: `sub_stub_${createdCount}_${Date.now()}`, short_url: null, customer_id: null };
    },
  },
};

async function main() {
  const u = new URL(process.env.DATABASE_URL!);
  assert(
    (u.hostname === 'localhost' || u.hostname === '127.0.0.1') && u.port === '54322',
    'Must target LOCAL localhost:54322'
  );
  console.log('=== payment retry safety tests (LOCAL) ===');

  const { PaymentsDAO } = await import('@/database/models/Payments.dao');
  const { PaymentService } = await import('@/lib/razorpay/payment.service');
  const { grantCreditsForCapturedPayment } = await import('@/lib/razorpay/credit-grant');
  const { WebhookService } = await import('@/lib/razorpay/webhook.service');
  const { SubscriptionService, PAYMENT_PROCESSING_ERROR } = await import(
    '@/lib/razorpay/subscription.service'
  );
  const { SubscriptionsDAO } = await import('@/database/models/Subscriptions.dao');

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  const userId = randomUUID();
  const email = `retry-safety-${userId.slice(0, 8)}@test.local`;

  const addonImage = async () =>
    (
      await client.query(`SELECT image_credits_addon FROM user_credits WHERE id = $1`, [userId])
    ).rows[0]?.image_credits_addon ?? 0;

  try {
    await client.query(
      `INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
       VALUES ($1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', $2, crypt('test', gen_salt('bf')), now(), '{}', '{}', now(), now())`,
      [userId, email]
    );
    await client.query(
      `INSERT INTO user_credits (id, credits, image_credits_subscription, image_credits_addon, video_credits_subscription, video_credits_addon, updated_at)
       VALUES ($1, 0, 0, 0, 0, 0, now())
       ON CONFLICT (id) DO UPDATE SET image_credits_addon = 0, updated_at = now()`,
      [userId]
    );

    // --- A: failed attempt then successful retry on the same order ---
    {
      const orderId = `order_retry_${userId.slice(0, 8)}`;
      const payment = await PaymentsDAO.create({
        userId,
        creditPackId: null,
        razorpayOrderId: orderId,
        amount: 118,
        currency: 'INR',
        status: 'created',
        paymentType: 'image_topup',
        metadata: { creditType: 'image', credits: 10 },
      });
      await WebhookService['handlePaymentFailed']({
        payment: { entity: { id: `pay_fail_${userId.slice(0, 8)}`, order_id: orderId } },
      });
      assert((await PaymentsDAO.getById(payment.id))?.status === 'failed', 'A: marked failed');

      const captured = await PaymentsDAO.captureIfCreated(payment.id, `pay_ok_${userId.slice(0, 8)}`);
      assert(captured, 'A: failed → captured allowed on retry');
      await grantCreditsForCapturedPayment(captured);
      assert((await addonImage()) === 10, 'A: credits granted once');

      const again = await PaymentsDAO.captureIfCreated(payment.id, `pay_ok_${userId.slice(0, 8)}`);
      assert(again === null, 'A: second capture is a no-op');
      assert((await addonImage()) === 10, 'A: no double grant');
      console.log('PASS A: retry after failed attempt grants exactly once');
    }

    // --- B: bad signature leaves order capturable ---
    {
      const orderId = `order_sig_${userId.slice(0, 8)}`;
      const payment = await PaymentsDAO.create({
        userId,
        creditPackId: null,
        razorpayOrderId: orderId,
        amount: 118,
        currency: 'INR',
        status: 'created',
        paymentType: 'image_topup',
        metadata: { creditType: 'image', credits: 5 },
      });
      const r = await PaymentService.verifyPayment({
        razorpayOrderId: orderId,
        razorpayPaymentId: 'pay_bogus',
        razorpaySignature: 'a'.repeat(64),
        userId,
      });
      assert(!r.success, 'B: bad signature rejected');
      assert((await PaymentsDAO.getById(payment.id))?.status === 'created', 'B: row untouched');
      console.log('PASS B: invalid signature does not poison the order');
    }

    // --- C: failure events on a never-paid checkout keep it pending ---
    const rpPending = `sub_pending_${userId.slice(0, 8)}`;
    const now = new Date();
    const end = new Date(now);
    end.setMonth(end.getMonth() + 1);
    const pendingRow = await SubscriptionsDAO.create({
      userId,
      planId: 'skalx_growth',
      status: 'pending',
      currentPeriodStart: now.toISOString(),
      currentPeriodEnd: end.toISOString(),
      nextResetDate: end.toISOString(),
      cancelAtPeriodEnd: false,
    });
    await SubscriptionsDAO.updateRazorpayIds(pendingRow.id, rpPending);
    {
      await WebhookService['handlePaymentFailed']({
        payment: { entity: { id: `pay_f2_${userId.slice(0, 8)}`, subscription_id: rpPending } },
      });
      await WebhookService['handleSubscriptionPastDue'](
        { subscription: { entity: { id: rpPending, status: 'pending' } } },
        'subscription.pending'
      );
      assert(
        (await SubscriptionsDAO.getById(pendingRow.id))?.status === 'pending',
        'C: stays pending'
      );
      console.log('PASS C: failed first attempt keeps checkout retryable');
    }

    // --- D: paid-on-Razorpay pending checkout is never replaced ---
    {
      remoteSubs.set(rpPending, { status: 'authenticated', paid_count: 0 });
      const r = await SubscriptionService.createSubscription({
        userId,
        email,
        planId: 'skalx_growth',
      });
      assert(!r.success && r.error === PAYMENT_PROCESSING_ERROR, `D: refused, got ${r.error}`);
      assert(
        (await SubscriptionsDAO.getById(pendingRow.id))?.status === 'pending',
        'D: paid checkout not cancelled'
      );
      assert(!cancelled.includes(rpPending), 'D: no Razorpay cancel');

      // Unpaid (still `created` on Razorpay) → replaced as before
      remoteSubs.set(rpPending, { status: 'created', paid_count: 0 });
      const r2 = await SubscriptionService.createSubscription({
        userId,
        email,
        planId: 'skalx_growth',
      });
      assert(r2.success, `D: unpaid checkout replaced, got ${r2.error}`);
      assert(
        (await SubscriptionsDAO.getById(pendingRow.id))?.status === 'cancelled',
        'D: unpaid checkout cancelled'
      );
      console.log('PASS D: only unpaid pending checkouts are replaced');
    }

    // --- E: an abandoned (cancelled, never paid) checkout does not unlock the app ---
    {
      // Any captured payment (step A's top-up) counts as paid; isolate the subscription rows.
      await client.query(`DELETE FROM payments WHERE user_id = $1`, [userId]);
      // Credits in the wallet (step A's top-up) also open the workspace (free-trial explorers).
      await client.query(
        `UPDATE user_credits SET credits = 0, image_credits_subscription = 0, image_credits_addon = 0,
           video_credits_subscription = 0, video_credits_addon = 0 WHERE id = $1`,
        [userId]
      );
      const { resolvePostAuthDestination } = await import('@/lib/auth/post-auth-destination');
      const d = await resolvePostAuthDestination(userId);
      assert(d.ok && d.destination === 'try', `E: unpaid user stays on /try, got ${JSON.stringify(d)}`);
      console.log('PASS E: abandoned checkout grants no workspace access');
    }

    console.log('\n=== All payment retry safety tests passed ===');
  } finally {
    try {
      await client.query(`DELETE FROM credit_history WHERE user_id = $1`, [userId]);
      await client.query(`DELETE FROM subscription_cycles WHERE user_id = $1`, [userId]);
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

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
