/**
 * Video generation billing gate — reserve / consume / release SkalX Video Credits.
 * Does not call Runway. Does not know about provider tokens.
 */

import { CreditsDAO } from '@/database/models/Credits.dao';
import {
  getVideoCreditsForDuration,
  isVideoGenerationDuration,
  type VideoGenerationDuration,
} from '@/lib/billing/video-credits';

export class VideoBillingError extends Error {
  code: 'INSUFFICIENT_CREDITS' | 'INVALID_DURATION' | 'RESERVE_FAILED' | 'AUTH_REQUIRED';
  requiredCredits?: number;
  availableCredits?: number;
  durationSeconds?: number;

  constructor(
    code: VideoBillingError['code'],
    message: string,
    extras?: Partial<VideoBillingError>
  ) {
    super(message);
    this.name = 'VideoBillingError';
    this.code = code;
    Object.assign(this, extras);
  }
}

export function requiredCreditsForCampaignDuration(durationSeconds: number): number {
  if (!isVideoGenerationDuration(durationSeconds)) {
    throw new VideoBillingError(
      'INVALID_DURATION',
      `Unsupported duration ${durationSeconds}s. Choose 15s or 30s.`,
      { durationSeconds }
    );
  }
  return getVideoCreditsForDuration(durationSeconds as VideoGenerationDuration);
}

export async function assertAndReserveVideoCredits(params: {
  userId: string;
  durationSeconds: number;
  referenceId: string;
}): Promise<{
  reservationId: string;
  requiredCredits: number;
  fromSubscription: number;
  fromAddon: number;
}> {
  const requiredCredits = requiredCreditsForCampaignDuration(params.durationSeconds);

  const balance = await CreditsDAO.getFullBalance(params.userId);
  const available = balance?.videoCredits.total ?? 0;
  if (available < requiredCredits) {
    throw new VideoBillingError(
      'INSUFFICIENT_CREDITS',
      `You need ${requiredCredits} Video Credits to generate a ${params.durationSeconds}-second video.`,
      {
        requiredCredits,
        availableCredits: available,
        durationSeconds: params.durationSeconds,
      }
    );
  }

  const reserved = await CreditsDAO.reserveVideoCredits({
    userId: params.userId,
    amount: requiredCredits,
    purpose: 'video_generation',
    referenceId: params.referenceId,
    metadata: {
      durationSeconds: params.durationSeconds,
      requiredCredits,
    },
  });

  if (!reserved.success || !reserved.reservationId) {
    throw new VideoBillingError(
      'RESERVE_FAILED',
      reserved.error || 'Failed to reserve video credits',
      { requiredCredits, availableCredits: available, durationSeconds: params.durationSeconds }
    );
  }

  return {
    reservationId: reserved.reservationId,
    requiredCredits,
    fromSubscription: Number(reserved.fromSubscription ?? 0),
    fromAddon: Number(reserved.fromAddon ?? 0),
  };
}

export async function finalizeVideoReservation(params: {
  userId: string;
  reservationId: string;
  success: boolean;
}): Promise<void> {
  if (params.success) {
    const result = await CreditsDAO.consumeReservation(
      params.reservationId,
      params.userId
    );
    if (!result.success) {
      throw new VideoBillingError(
        'RESERVE_FAILED',
        result.error || 'Failed to finalize video credit reservation'
      );
    }
  } else {
    const result = await CreditsDAO.releaseReservation(
      params.reservationId,
      params.userId
    );
    if (!result.success) {
      throw new VideoBillingError(
        'RESERVE_FAILED',
        result.error || 'Failed to release video credit reservation'
      );
    }
  }
}
