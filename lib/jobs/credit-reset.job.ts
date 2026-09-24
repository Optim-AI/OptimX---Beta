// lib/jobs/credit-reset.job.ts
// Scheduled job — Phase 1B-2 lifecycle cleanup.
// Does NOT grant subscription credits (charge-driven via subscription_cycles).
// Does NOT reset subscription balances on calendar dates.
// Does NOT revoke paid access before current_period_end.

import { SubscriptionsDAO } from '@/database/models/Subscriptions.dao';
import { CreditsDAO } from '@/database/models/Credits.dao';

interface ResetResult {
  totalProcessed: number;
  successful: number;
  failed: number;
  trialsExpired: number;
  periodEndCancellations: number;
  entitlementGrantsSkipped: number;
  errors: string[];
}

/**
 * Credit / subscription cleanup job (daily cron).
 *
 * Responsibilities (Phase 1B-2):
 * 1. Finalize cancel_at_period_end after current_period_end (webhook safety net).
 *    Does not zero addon credits. Does not touch active paid wallets mid-period.
 * 2. Expire historical legacy trialing rows past trial_ends_at (product is obsolete).
 * 3. Log skipped calendar entitlement resets (must never grant).
 */
export class CreditResetJob {
  static async run(): Promise<ResetResult> {
    const result: ResetResult = {
      totalProcessed: 0,
      successful: 0,
      failed: 0,
      trialsExpired: 0,
      periodEndCancellations: 0,
      entitlementGrantsSkipped: 0,
      errors: [],
    };

    console.log(
      '[CreditResetJob] Starting (no entitlement grants; period-end cancel finalize + legacy trial cleanup)'
    );
    const now = new Date();

    try {
      // --- Period-end cancellation finalize (safety net if webhook missed) ---
      const dueCancel = await SubscriptionsDAO.getDueForPeriodEndCancel(now);
      for (const sub of dueCancel) {
        try {
          await SubscriptionsDAO.updateStatus(sub.id, 'cancelled');
          result.periodEndCancellations++;
          result.successful++;
          console.log(
            `[CreditResetJob] Finalized cancel_at_period_end for subscription ${sub.id}`
          );
        } catch (error: any) {
          result.failed++;
          result.errors.push(`Failed period-end cancel ${sub.id}: ${error.message}`);
          console.error(`[CreditResetJob] Failed period-end cancel ${sub.id}:`, error);
        }
      }

      // --- Legacy trial cleanup only (historical rows; new creates reject trial) ---
      const expiredTrials = await SubscriptionsDAO.getExpiredTrials(now);
      console.log(`[CreditResetJob] Found ${expiredTrials.length} expired legacy trials`);

      for (const trial of expiredTrials) {
        try {
          await SubscriptionsDAO.expireTrial(trial.id);
          // Zeros subscription buckets only; addon/PAYG preserved
          await CreditsDAO.expireAllCredits(trial.userId);
          result.trialsExpired++;
          result.successful++;
          console.log(`[CreditResetJob] Expired legacy trial for user ${trial.userId}`);
        } catch (error: any) {
          result.failed++;
          result.errors.push(`Failed to expire trial ${trial.id}: ${error.message}`);
          console.error(`[CreditResetJob] Failed to expire trial ${trial.id}:`, error);
        }
      }

      // Calendar entitlement reset path remains disabled
      const due = await SubscriptionsDAO.getDueForReset(now);
      result.entitlementGrantsSkipped = due.length;
      result.totalProcessed =
        dueCancel.length + expiredTrials.length + due.length;
      if (due.length > 0) {
        console.log(
          `[CreditResetJob] Skipping ${due.length} calendar entitlement reset(s); ` +
            `provisioning is charge-driven via subscription_cycles`
        );
      }

      console.log(
        `[CreditResetJob] Completed. periodEndCancellations=${result.periodEndCancellations}, ` +
          `trialsExpired=${result.trialsExpired}, entitlementGrantsSkipped=${result.entitlementGrantsSkipped}`
      );
    } catch (error: any) {
      console.error('[CreditResetJob] Job failed with error:', error);
      result.errors.push(`Job failed: ${error.message}`);
    }

    return result;
  }
}
