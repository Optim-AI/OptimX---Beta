/**
 * Brand Kit → poster generation. Loading never blocks a poster: if the kit
 * can't be read, generation continues without it.
 */

import type { BrandKit } from "./types";

export type BrandKitGetter = (userId: string) => Promise<BrandKit | null>;

export const defaultBrandKitGetter: BrandKitGetter = async (userId) => {
  const { BrandKitDAO } = await import("@/database/models/BrandKit.dao");
  return BrandKitDAO.getDefault(userId);
};

export async function loadBrandKitForPosters(
  userId: string,
  getter: BrandKitGetter = defaultBrandKitGetter
): Promise<BrandKit | null> {
  try {
    return await getter(userId);
  } catch (e) {
    console.warn("[brandKit] could not load default kit; generating without it", {
      userId,
      error: (e as Error)?.message,
    });
    return null;
  }
}
