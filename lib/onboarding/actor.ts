import type { NextApiRequest } from 'next';
import { getUserIdFromRequest } from '@/auth/request';
import { readGuestSession } from './guest-session';

export type OnboardingActor = {
  userId: string;
  guest: boolean;
};

/**
 * Authenticated user, otherwise an unclaimed guest onboarding session.
 * Do not use this for billing or account routes.
 */
export async function getOnboardingActor(
  req: NextApiRequest
): Promise<OnboardingActor | null> {
  const userId = await getUserIdFromRequest(req);
  if (userId) return { userId, guest: false };
  try {
    const guest = await readGuestSession(req);
    if (guest) return { userId: guest.profileId, guest: true };
  } catch {
    return null;
  }
  return null;
}
