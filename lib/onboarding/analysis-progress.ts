import { eq } from 'drizzle-orm';
import { db } from '@/database/client';
import { profiles } from '@/database/schema';
import type { BrandAnalysisStage } from './try-onboarding';

/** Merge a real analysis milestone into profiles.ui_preferences.onboarding. */
export async function writeAnalysisStage(
  userId: string,
  stage: BrandAnalysisStage
): Promise<void> {
  const [row] = await db
    .select({ uiPreferences: profiles.uiPreferences })
    .from(profiles)
    .where(eq(profiles.id, userId))
    .limit(1);
  if (!row) return;

  const existing = (row.uiPreferences as Record<string, unknown>) || {};
  const onboarding =
    existing.onboarding && typeof existing.onboarding === 'object'
      ? (existing.onboarding as Record<string, unknown>)
      : {};

  await db
    .update(profiles)
    .set({
      uiPreferences: {
        ...existing,
        onboarding: {
          ...onboarding,
          status: onboarding.status || 'analyzing',
          analysisStage: stage,
          updatedAt: new Date().toISOString(),
        },
      },
      updatedAt: new Date().toISOString(),
    })
    .where(eq(profiles.id, userId));
}
