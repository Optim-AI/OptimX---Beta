/**
 * Classification + conversion helpers for legacy video wallet migration.
 *
 * Old unit: seconds
 * New unit: SkalX Video Credits (rate = 20)
 *
 * Never classify by amount magnitude alone.
 */

import { SECONDS_TO_CREDITS_RATE } from './video-credits';

export const VIDEO_SECONDS_MIGRATION_SOURCE = 'seconds_to_video_credits_v1' as const;
export const VIDEO_SECONDS_MIGRATION_VERSION = 'v1' as const;
export const VIDEO_SECONDS_CONVERSION_RATE = SECONDS_TO_CREDITS_RATE;

/** History sources that prove the balance was granted as Video Credits. */
export const VIDEO_CREDITS_GRANT_SOURCES = [
  'subscription_cycle',
  'subscription_cycle_provision',
] as const;

export type VideoWalletClassifyDecision =
  | 'migrate_legacy_seconds'
  | 'skip_zero'
  | 'skip_already_migrated'
  | 'skip_already_video_credits'
  | 'skip_ambiguous';

export interface VideoHistoryEvidence {
  creditType: string;
  operation: string;
  source: string;
  amount: number;
  metadata?: Record<string, unknown> | null;
}

export interface ClassifyVideoWalletInput {
  videoCreditsSubscription: number;
  videoCreditsAddon: number;
  history: VideoHistoryEvidence[];
  /** True if a seconds_to_video_credits_v1 migrate marker already exists */
  hasMigrationMarker: boolean;
}

export interface ClassifyVideoWalletResult {
  decision: VideoWalletClassifyDecision;
  reason: string;
}

function metaUnit(metadata: Record<string, unknown> | null | undefined): string | null {
  if (!metadata || typeof metadata !== 'object') return null;
  const unit = metadata.unit;
  if (typeof unit === 'string' && unit.trim()) return unit.trim();
  return null;
}

function isVideoGrant(row: VideoHistoryEvidence): boolean {
  if (row.creditType !== 'video') return false;
  return row.operation === 'add' || row.operation === 'reset';
}

/**
 * Evidence the wallet (or part of it) was already denominated in Video Credits.
 */
export function hasVideoCreditsDenominationEvidence(
  history: VideoHistoryEvidence[]
): boolean {
  for (const row of history) {
    if (row.creditType !== 'video') continue;

    if (row.source === VIDEO_SECONDS_MIGRATION_SOURCE) return true;

    if (
      (VIDEO_CREDITS_GRANT_SOURCES as readonly string[]).includes(row.source)
    ) {
      return true;
    }

    const unit = metaUnit(row.metadata);
    if (unit === 'video_credits') return true;

    // New welcome path always tags unit=video_credits; also treat explicit flag
    if (row.source === 'welcome_bonus' && unit === 'video_credits') return true;
  }
  return false;
}

/**
 * Positive evidence of legacy second-denominated grants (not magnitude alone).
 * Requires grant rows whose metadata does NOT claim video_credits.
 */
export function hasLegacySecondsEvidence(history: VideoHistoryEvidence[]): boolean {
  const legacyGrantSources = new Set([
    'addon_purchase',
    'subscription_init',
    'subscription_reset',
    'welcome_bonus', // only counts when unit !== video_credits (checked below)
    'trial_grant',
    'admin_grant',
  ]);

  for (const row of history) {
    if (!isVideoGrant(row)) continue;
    if (!legacyGrantSources.has(row.source)) continue;

    const unit = metaUnit(row.metadata);
    if (unit === 'video_credits') continue;

    // Positive legacy evidence: grant without video_credits unit tag
    return true;
  }
  return false;
}

/**
 * Classify whether a wallet may be safely converted with ×20.
 */
export function classifyVideoWalletForSecondsMigration(
  input: ClassifyVideoWalletInput
): ClassifyVideoWalletResult {
  const sub = Number(input.videoCreditsSubscription) || 0;
  const addon = Number(input.videoCreditsAddon) || 0;
  const total = sub + addon;

  if (input.hasMigrationMarker) {
    return {
      decision: 'skip_already_migrated',
      reason: 'Migration marker seconds_to_video_credits_v1 already present',
    };
  }

  if (total === 0) {
    return { decision: 'skip_zero', reason: 'No video balance to convert' };
  }

  const videoHistory = input.history.filter((h) => h.creditType === 'video');

  if (hasVideoCreditsDenominationEvidence(videoHistory)) {
    return {
      decision: 'skip_already_video_credits',
      reason:
        'History shows Video Credits denomination (welcome_bonus/cycle/PAYG unit tag or cycle source)',
    };
  }

  if (videoHistory.length === 0) {
    return {
      decision: 'skip_ambiguous',
      reason: 'Non-zero video balance with no video credit_history — cannot classify',
    };
  }

  if (!hasLegacySecondsEvidence(videoHistory)) {
    return {
      decision: 'skip_ambiguous',
      reason: 'No positive legacy-seconds grant evidence; refusing to guess',
    };
  }

  return {
    decision: 'migrate_legacy_seconds',
    reason: 'Legacy seconds grant evidence present; no Video Credits denomination evidence',
  };
}

export function convertSecondsBalancesToVideoCredits(
  subscriptionSeconds: number,
  addonSeconds: number,
  rate: number = VIDEO_SECONDS_CONVERSION_RATE
): { subscription: number; addon: number } {
  if (!Number.isInteger(rate) || rate < 1) {
    throw new Error('Invalid conversion rate');
  }
  return {
    subscription: Math.floor(subscriptionSeconds) * rate,
    addon: Math.floor(addonSeconds) * rate,
  };
}
