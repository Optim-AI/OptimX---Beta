/**
 * HttpOnly guest session for product-led onboarding.
 * A shadow profile row lets the existing snapshot, preferences, and poster
 * generation pipeline run before signup. Claim copies that state to the account.
 */

import { createHash, randomBytes, randomUUID } from 'crypto';
import type { NextApiRequest, NextApiResponse } from 'next';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { db } from '@/database/client';
import {
  creativeStudioSessions,
  generationJobLocks,
  onboardingGuestSessions,
  posterGenerationSessions,
  profiles,
  userGeneratedImage,
  userGeneratedImages,
} from '@/database/schema';
import {
  onboardingStatusRank,
  parseTryOnboarding,
  type TryOnboardingState,
} from './try-onboarding';

export const GUEST_COOKIE = 'skalx_try';
const MAX_AGE_SECONDS = 60 * 60 * 24 * 14;

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function readCookie(req: NextApiRequest, name: string): string | null {
  const header = req.headers.cookie ?? '';
  if (!header) return null;
  const match = header
    .split(';')
    .map((s) => s.trim())
    .find((s) => s.startsWith(`${name}=`));
  if (!match) return null;
  try {
    return decodeURIComponent(match.slice(name.length + 1));
  } catch {
    return null;
  }
}

function appendSetCookie(res: NextApiResponse, cookie: string) {
  const prev = res.getHeader('Set-Cookie');
  if (!prev) {
    res.setHeader('Set-Cookie', cookie);
    return;
  }
  if (Array.isArray(prev)) {
    res.setHeader('Set-Cookie', [...prev.map(String), cookie]);
    return;
  }
  res.setHeader('Set-Cookie', [String(prev), cookie]);
}

export function setGuestCookie(res: NextApiResponse, token: string) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  appendSetCookie(
    res,
    `${GUEST_COOKIE}=${encodeURIComponent(token)}; HttpOnly; Path=/; Max-Age=${MAX_AGE_SECONDS}; SameSite=Lax${secure}`
  );
}

export function clearGuestCookie(res: NextApiResponse) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  appendSetCookie(
    res,
    `${GUEST_COOKIE}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax${secure}`
  );
}

export type GuestSession = {
  id: string;
  profileId: string;
  claimedBy: string | null;
};

export async function readGuestSession(req: NextApiRequest): Promise<GuestSession | null> {
  const token = readCookie(req, GUEST_COOKIE);
  if (!token || token.length < 20) return null;
  const now = new Date().toISOString();
  const [row] = await db
    .select({
      id: onboardingGuestSessions.id,
      profileId: onboardingGuestSessions.profileId,
      claimedBy: onboardingGuestSessions.claimedBy,
    })
    .from(onboardingGuestSessions)
    .where(
      and(
        eq(onboardingGuestSessions.tokenHash, hashToken(token)),
        gt(onboardingGuestSessions.expiresAt, now),
        isNull(onboardingGuestSessions.claimedBy)
      )
    )
    .limit(1);
  if (!row) return null;
  return { id: row.id, profileId: row.profileId, claimedBy: row.claimedBy };
}

export async function ensureGuestSession(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<GuestSession> {
  const existing = await readGuestSession(req);
  if (existing) return existing;

  const token = randomBytes(32).toString('base64url');
  const profileId = randomUUID();
  const expiresAt = new Date(Date.now() + MAX_AGE_SECONDS * 1000).toISOString();
  const onboarding: TryOnboardingState = {
    status: 'brand_started',
    updatedAt: new Date().toISOString(),
  };

  await db.insert(profiles).values({
    id: profileId,
    uiPreferences: { guest: true, onboarding },
    updatedAt: new Date().toISOString(),
  });

  const [created] = await db
    .insert(onboardingGuestSessions)
    .values({
      tokenHash: hashToken(token),
      profileId,
      expiresAt,
      updatedAt: new Date().toISOString(),
    })
    .returning({
      id: onboardingGuestSessions.id,
      profileId: onboardingGuestSessions.profileId,
    });

  setGuestCookie(res, token);
  return { id: created.id, profileId: created.profileId, claimedBy: null };
}

async function reassignUserId(
  table: { userId: any },
  fromId: string,
  toId: string
) {
  await db
    .update(table as any)
    .set({ userId: toId })
    .where(eq((table as any).userId, fromId));
}

/**
 * Copy guest brand + onboarding onto the signed-in profile when the guest
 * flow is further along. Reassign generated assets. Never creates a second account.
 */
export async function claimGuestSession(
  req: NextApiRequest,
  res: NextApiResponse,
  realUserId: string
): Promise<{ claimed: boolean }> {
  const guest = await readGuestSession(req);
  if (!guest || guest.profileId === realUserId) {
    return { claimed: false };
  }

  const [guestProfile] = await db
    .select({
      brandSnapshot: profiles.brandSnapshot,
      uiPreferences: profiles.uiPreferences,
      businessName: profiles.businessName,
    })
    .from(profiles)
    .where(eq(profiles.id, guest.profileId))
    .limit(1);

  const [realProfile] = await db
    .select({
      brandSnapshot: profiles.brandSnapshot,
      uiPreferences: profiles.uiPreferences,
      businessName: profiles.businessName,
    })
    .from(profiles)
    .where(eq(profiles.id, realUserId))
    .limit(1);

  if (guestProfile && realProfile) {
    const guestPrefs = (guestProfile.uiPreferences as Record<string, unknown>) || {};
    const realPrefs = (realProfile.uiPreferences as Record<string, unknown>) || {};
    const guestOnboarding = parseTryOnboarding(guestPrefs);
    const realOnboarding = parseTryOnboarding(realPrefs);
    const guestRank = onboardingStatusRank(guestOnboarding?.status);
    const realRank = onboardingStatusRank(realOnboarding?.status);

    if (guestOnboarding && guestRank > realRank) {
      const mergedPrefs = {
        ...realPrefs,
        onboarding: {
          ...guestOnboarding,
          updatedAt: new Date().toISOString(),
        },
      };
      await db
        .update(profiles)
        .set({
          uiPreferences: mergedPrefs,
          brandSnapshot: guestProfile.brandSnapshot ?? realProfile.brandSnapshot,
          businessName: realProfile.businessName || guestProfile.businessName,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(profiles.id, realUserId));
    } else if (!realProfile.brandSnapshot && guestProfile.brandSnapshot) {
      await db
        .update(profiles)
        .set({
          brandSnapshot: guestProfile.brandSnapshot,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(profiles.id, realUserId));
    }
  }

  const moves: Array<Promise<unknown>> = [
    reassignUserId(posterGenerationSessions, guest.profileId, realUserId),
    reassignUserId(generationJobLocks, guest.profileId, realUserId),
    reassignUserId(creativeStudioSessions, guest.profileId, realUserId),
    reassignUserId(userGeneratedImage, guest.profileId, realUserId),
    reassignUserId(userGeneratedImages, guest.profileId, realUserId),
  ];
  await Promise.all(moves.map((p) => p.catch(() => undefined)));

  await db
    .update(onboardingGuestSessions)
    .set({
      claimedBy: realUserId,
      claimedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(onboardingGuestSessions.id, guest.id));

  clearGuestCookie(res);
  return { claimed: true };
}
