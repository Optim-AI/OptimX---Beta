// lib/jobs/credit-reset.job.ts
// Scheduled job for monthly credit resets

import { SubscriptionsDAO } from '@/database/models/Subscriptions.dao';
import { CreditsDAO } from '@/database/models/Credits.dao';

interface ResetResult {
  totalProcessed: number;
  successful: number;
  failed: number;
  trialsExpired: number;
  errors: string[];
}

/**
 * Monthly Credit Reset Job
 * 
 * This job should be run daily (e.g., via cron at 00:00 UTC)
 * It will:
 * 1. Find all active subscriptions due for credit reset
 * 2. Reset subscription credits to plan defaults
 * 3. Update next_reset_date
 * 4. Expire any trials past their end date
 */
export class CreditResetJob {
  /**
   * Run the credit reset job
   */
  static async run(): Promise<ResetResult> {
    const result: ResetResult = {
      totalProcessed: 0,
      successful: 0,
      failed: 0,
      trialsExpired: 0,
      errors: [],
    };

    console.log('[CreditResetJob] Starting credit reset job...');
    const now = new Date();

    try {
      // 1. Expire trials first
      const expiredTrials = await SubscriptionsDAO.getExpiredTrials(now);
      console.log(`[CreditResetJob] Found ${expiredTrials.length} expired trials`);

      for (const trial of expiredTrials) {
        try {
          // Expire the trial subscription
          await SubscriptionsDAO.expireTrial(trial.id);
          
          // Zero out subscription credits
          await CreditsDAO.expireAllCredits(trial.userId);
          
          result.trialsExpired++;
          console.log(`[CreditResetJob] Expired trial for user ${trial.userId}`);
        } catch (error: any) {
          result.errors.push(`Failed to expire trial ${trial.id}: ${error.message}`);
          console.error(`[CreditResetJob] Failed to expire trial ${trial.id}:`, error);
        }
      }

      // 2. Process credit resets for active subscriptions
      const subscriptionsDueForReset = await SubscriptionsDAO.getDueForReset(now);
      console.log(`[CreditResetJob] Found ${subscriptionsDueForReset.length} subscriptions due for reset`);

      for (const subscription of subscriptionsDueForReset) {
        result.totalProcessed++;

        try {
          // Skip trials - they don't get resets
          if (subscription.status === 'trialing') {
            continue;
          }

          const plan = subscription.plan;

          // Reset subscription credits to plan defaults
          const resetResult = await CreditsDAO.resetSubscriptionCredits(
            subscription.userId,
            plan.imageCredits,
            plan.videoCredits
          );

          if (!resetResult.success) {
            throw new Error(resetResult.error || 'Failed to reset credits');
          }

          // Calculate next reset date (1 month from now)
          const nextReset = new Date(now);
          nextReset.setMonth(nextReset.getMonth() + 1);

          // Update subscription's next reset date
          await SubscriptionsDAO.updateNextResetDate(subscription.id, nextReset);

          result.successful++;
          console.log(`[CreditResetJob] Reset credits for user ${subscription.userId} - ` +
            `Image: ${plan.imageCredits}, Video: ${plan.videoCredits}`);

        } catch (error: any) {
          result.failed++;
          result.errors.push(`Failed to reset subscription ${subscription.id}: ${error.message}`);
          console.error(`[CreditResetJob] Failed to reset subscription ${subscription.id}:`, error);
        }
      }

      console.log(`[CreditResetJob] Completed. Processed: ${result.totalProcessed}, ` +
        `Successful: ${result.successful}, Failed: ${result.failed}, ` +
        `Trials Expired: ${result.trialsExpired}`);

    } catch (error: any) {
      console.error('[CreditResetJob] Job failed with error:', error);
      result.errors.push(`Job failed: ${error.message}`);
    }

    return result;
  }
}
