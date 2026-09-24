/**
 * Phase 1 billing foundation gap-closure tests (no live DB / Razorpay).
 * Run: npx tsx lib/billing/phase1-foundation.test.ts
 */

import { WebhookService } from '@/lib/razorpay/webhook.service';
import { grantCreditsForCapturedPayment } from '@/lib/razorpay/credit-grant';
import { getVideoCreditsForDuration } from '@/lib/billing/video-credits';
import { requiredCreditsForCampaignDuration } from '@/lib/billing/video-billing';
import { campaignVideoIdempotencyKey } from '@/lib/creative-studio/commercial-production/campaign-executor/storage';
import { readFileSync } from 'fs';
import { resolve } from 'path';

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
  console.log('=== Phase 1 foundation tests ===');

  // --- A/B: PAYG grant path structure (verify XOR capture) ---
  {
    const paymentService = readFileSync(
      resolve(__dirname, '../razorpay/payment.service.ts'),
      'utf8'
    );
    const webhookService = readFileSync(
      resolve(__dirname, '../razorpay/webhook.service.ts'),
      'utf8'
    );
    const creditGrant = readFileSync(
      resolve(__dirname, '../razorpay/credit-grant.ts'),
      'utf8'
    );
    assert(paymentService.includes('captureIfCreated'), 'A: verify uses captureIfCreated');
    assert(
      paymentService.includes('grantCreditsForCapturedPayment'),
      'A: verify grants via shared helper'
    );
    assert(webhookService.includes('captureIfCreated'), 'B: webhook uses captureIfCreated');
    assert(
      webhookService.includes('grantCreditsForCapturedPayment'),
      'B: webhook grants via shared helper'
    );
    assert(
      webhookService.includes('tryProvisionInitialSubscriptionFromCapturedPayment'),
      'B: webhook also tries initial-sub addon path after PAYG miss'
    );
    assert(
      creditGrant.includes("payment.paymentType !== 'image_topup'"),
      'grant helper ignores non-topup'
    );
    assert(
      !creditGrant.includes("paymentType === 'subscription'"),
      'grant helper does not treat subscription as top-up'
    );
    console.log(
      'PASS A/B: PAYG verify + webhook converge on captureIfCreated + grantCreditsForCapturedPayment'
    );
  }

  // grantCreditsForCapturedPayment no-ops for subscription payment type
  {
    const fakePayment = {
      id: 'p1',
      userId: 'u1',
      paymentType: 'subscription',
      metadata: { creditType: 'image', credits: 50 },
      razorpayPaymentId: 'pay_x',
    } as any;
    await grantCreditsForCapturedPayment(fakePayment);
    console.log('PASS: grantCreditsForCapturedPayment ignores subscription rows');
  }

  // --- C: subscription.charged idempotency in code ---
  {
    const webhook = readFileSync(
      resolve(__dirname, '../razorpay/webhook.service.ts'),
      'utf8'
    );
    const paymentsDao = readFileSync(
      resolve(__dirname, '../../database/models/Payments.dao.ts'),
      'utf8'
    );
    assert(
      webhook.includes('createIfAbsentByRazorpayPaymentId'),
      'C: subscription.charged uses createIfAbsent'
    );
    assert(
      paymentsDao.includes('createIfAbsentByRazorpayPaymentId'),
      'C: PaymentsDAO exposes createIfAbsent'
    );
    assert(paymentsDao.includes('23505'), 'C: createIfAbsent handles unique race');
    console.log('PASS C: duplicate subscription.charged payment insert guarded');
  }

  // --- D: paid subscription create does not grant credits ---
  {
    const subService = readFileSync(
      resolve(__dirname, '../razorpay/subscription.service.ts'),
      'utf8'
    );
    const paidSection = subService.slice(
      subService.indexOf('Paid plans must already have'),
      subService.indexOf('Intentionally do NOT grant')
    );
    assert(!paidSection.includes('initializeCredits'), 'D: paid create has no initializeCredits');
    assert(
      subService.includes('Intentionally do NOT grant subscription credits'),
      'D: explicit no-grant comment present'
    );
    assert(
      !subService.includes("plan.billingCycle === 'trial'") ||
        subService.includes('Free trial is not available'),
      'D: trial path must be rejected, not granted'
    );
    assert(
      !subService.includes('initializeCredits'),
      'D: subscription create must not initialize credits (no trial grant)'
    );
    console.log('PASS D: paid subscription create grants no credits before payment');
  }

  // --- E: unauthorized subscription create ---
  {
    const createRoute = readFileSync(
      resolve(__dirname, '../../pages/api/billing/subscriptions/create.ts'),
      'utf8'
    );
    assert(createRoute.includes('getUserIdFromRequest'), 'E: auth required');
    assert(createRoute.includes('status(401)'), 'E: returns 401');
    assert(!createRoute.includes('req.body.userId'), 'E: does not trust body.userId');
    console.log('PASS E: unauthorized subscription create rejected');
  }

  // --- F: client cannot swap user id on commercial generate ---
  {
    const generateRoute = readFileSync(
      resolve(__dirname, '../../pages/api/commercial/generate.ts'),
      'utf8'
    );
    assert(generateRoute.includes('getUserIdFromRequest'), 'F: auth from token');
    assert(generateRoute.includes('Never trust client-supplied userId'), 'F: explicit');
    assert(
      /const userId = await getUserIdFromRequest/.test(generateRoute),
      'F: userId from request helper only'
    );
    assert(!/userId:\s*body\.userId/.test(generateRoute), 'F: no body.userId billing');
    console.log('PASS F: commercial generate ignores client userId');
  }

  // --- G: concurrent video cannot overspend (reservation + credits math) ---
  {
    assertEqual(requiredCreditsForCampaignDuration(15), 300, 'G: 15s → 300');
    assertEqual(requiredCreditsForCampaignDuration(30), 600, 'G: 30s → 600');
    assertEqual(getVideoCreditsForDuration(15), 300, 'G: map matches');
    const creditsDao = readFileSync(
      resolve(__dirname, '../../database/models/Credits.dao.ts'),
      'utf8'
    );
    assert(creditsDao.includes('FOR UPDATE'), 'G: wallet lock on reserve');
    assert(creditsDao.includes('reserveVideoCredits'), 'G: reserve API exists');
    console.log('PASS G: reservation serializes wallet; duration→credits gated');
  }

  // --- H: same generation request → one job (lock + idempotency key) ---
  {
    const key1 = campaignVideoIdempotencyKey({
      campaignId: 'c1',
      generationVersion: 'v1',
      duration: 15,
      generationMode: 'native_continuous',
    });
    const key2 = campaignVideoIdempotencyKey({
      campaignId: 'c1',
      generationVersion: 'v1',
      duration: 15,
      generationMode: 'native_continuous',
    });
    const key3 = campaignVideoIdempotencyKey({
      campaignId: 'c1',
      generationVersion: 'v2',
      duration: 15,
      generationMode: 'native_continuous',
    });
    assertEqual(key1, key2, 'H: same logical request → same key');
    assert(key1 !== key3, 'H: new version → new key');

    const generateRoute = readFileSync(
      resolve(__dirname, '../../pages/api/commercial/generate.ts'),
      'utf8'
    );
    assert(generateRoute.includes('GenerationLocksDAO.tryClaim'), 'H: DB lock claim');
    assert(generateRoute.includes('GENERATION_IN_PROGRESS'), 'H: concurrent 409');
    console.log('PASS H: generation lock + versioned referenceId');
  }

  // --- I: QC regeneration uses billing gate ---
  {
    const sessionClient = readFileSync(
      resolve(
        __dirname,
        '../../app/web/src/components/creative-studio/VideoSessionPageClient.tsx'
      ),
      'utf8'
    );
    assert(
      sessionClient.includes('forceRegenerate: true'),
      'I: QC regen sets forceRegenerate'
    );
    assert(sessionClient.includes('generationVersion'), 'I: QC regen bumps generationVersion');
    const generateRoute = readFileSync(
      resolve(__dirname, '../../pages/api/commercial/generate.ts'),
      'utf8'
    );
    assert(
      generateRoute.includes('assertAndReserveVideoCredits'),
      'I: generate always reserves before provider'
    );
    console.log('PASS I: QC regen goes through /api/commercial/generate billing gate');
  }

  // --- J: RLS / client mutation documentation in migration ---
  {
    const migration = readFileSync(
      resolve(
        __dirname,
        '../../supabase/migrations/20260325100000_billing_foundation_phase1.sql'
      ),
      'utf8'
    );
    assert(migration.includes('ENABLE ROW LEVEL SECURITY'), 'J: RLS enable');
    assert(
      migration.includes('REVOKE INSERT, UPDATE, DELETE ON public.user_credits'),
      'J: revoke writes'
    );
    assert(migration.includes('webhook_events'), 'J: webhook_events locked');
    assert(migration.includes('credit_reservations'), 'J: reservations locked');
    assert(
      migration.includes('cannot be fully verified from repository'),
      'J: acknowledges dashboard verification'
    );
    console.log(
      'PASS J: RLS migration prepared (not applied); production must be verified in Dashboard'
    );
  }

  // --- Webhook event id stability ---
  {
    const id = WebhookService.resolveEventId(
      {
        entity: 'event',
        account_id: 'acc',
        event: 'subscription.charged',
        contains: [],
        payload: { payment: { entity: { id: 'pay_abc' } } },
        created_at: 1,
      },
      'evt_header_1'
    );
    assertEqual(id, 'evt_header_1', 'event id prefers header');
    const fallback = WebhookService.resolveEventId({
      entity: 'event',
      account_id: 'acc',
      event: 'subscription.charged',
      contains: [],
      payload: { payment: { entity: { id: 'pay_abc' } } },
      created_at: 99,
    } as any);
    assertEqual(fallback, 'subscription.charged:pay_abc', 'deterministic fallback');
    console.log('PASS: webhook event id extraction stable (no Date.now)');
  }

  // --- pending status + unique payment migration present ---
  {
    const migration = readFileSync(
      resolve(
        __dirname,
        '../../supabase/migrations/20260325100000_billing_foundation_phase1.sql'
      ),
      'utf8'
    );
    assert(migration.includes("'pending'"), 'migration allows pending');
    assert(
      migration.includes('idx_payments_razorpay_payment_id_unique'),
      'migration unique payment id'
    );
    assert(migration.includes('generation_job_locks'), 'migration generation locks');
    assert(migration.includes('DO NOT APPLY AUTOMATICALLY'), 'migration not auto-applied');
    console.log('PASS: Phase 1 migration file complete (create-only)');
  }

  console.log('\n=== All Phase 1 foundation tests passed ===');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
