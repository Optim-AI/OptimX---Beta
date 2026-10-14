/**
 * Client helpers for authoritative credit balances (image + video split).
 * Prefer /api/credits/balance over the legacy user_credits.credits column.
 */

export type AuthoritativeCreditBalance = {
  imageTotal: number;
  videoTotal: number;
  imageSubscription: number;
  imageAddon: number;
  videoSubscription: number;
  videoAddon: number;
};

export function parseCreditsBalancePayload(data: any): AuthoritativeCreditBalance | null {
  if (!data || data.success === false) return null;
  const image = data.imageCredits;
  const video = data.videoCredits;
  if (!image || !video) return null;
  return {
    imageTotal: Number(image.total ?? 0),
    videoTotal: Number(video.total ?? 0),
    imageSubscription: Number(image.subscription ?? 0),
    imageAddon: Number(image.addon ?? 0),
    videoSubscription: Number(video.subscription ?? 0),
    videoAddon: Number(video.addon ?? 0),
  };
}
