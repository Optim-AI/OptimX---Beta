/**
 * "Fix a part" pricing — shared by the fix API and the Studio UI. Pure, no I/O.
 *
 * A bad moment in a generated ad is our mistake, so the first fixes are free.
 * Beyond the free allowance (or for a longer window) the fix uses Video Credits
 * at the same per-second rate as generation.
 */

import { VIDEO_CREDITS_PER_SECOND } from "@/lib/billing/video-credits";

/** Free fixes per original video (fixes of fixes count against the same video). */
export const FREE_FIXES_PER_VIDEO = 2;
/** A free fix may cover at most this many seconds. */
export const FREE_FIX_MAX_SECONDS = 5;
/** Shortest part a user can pick on the timeline. */
export const MIN_FIX_SECONDS = 1;
/** A paid fix is charged for at least this many seconds. */
export const MIN_BILLABLE_SECONDS = 2;
/** Longest part one fix may redo — about one clip from the video model (paid above FREE_FIX_MAX_SECONDS). */
export const MAX_FIX_SECONDS = 8;
export const FIX_CREDITS_PER_SECOND = VIDEO_CREDITS_PER_SECOND;

export type FixPrice =
  | { free: true; credits: 0; freeFixesLeftAfter: number }
  | { free: false; credits: number; reason: "free_fixes_used" | "too_long" };

/** Whole seconds billed for a window (rounded up, never below MIN_BILLABLE_SECONDS). */
export function fixBillableSeconds(startSeconds: number, endSeconds: number): number {
  return Math.max(MIN_BILLABLE_SECONDS, Math.ceil(endSeconds - startSeconds - 1e-6));
}

export function priceFix(params: {
  startSeconds: number;
  endSeconds: number;
  freeFixesUsed: number;
}): FixPrice {
  const seconds = fixBillableSeconds(params.startSeconds, params.endSeconds);
  const freeLeft = Math.max(0, FREE_FIXES_PER_VIDEO - params.freeFixesUsed);
  if (freeLeft > 0 && seconds <= FREE_FIX_MAX_SECONDS) {
    return { free: true, credits: 0, freeFixesLeftAfter: freeLeft - 1 };
  }
  return {
    free: false,
    credits: seconds * FIX_CREDITS_PER_SECOND,
    reason: freeLeft > 0 ? "too_long" : "free_fixes_used",
  };
}

/** One plain sentence for the confirm card. */
export function describeFixPrice(price: FixPrice, seconds: number): string {
  if (price.free) {
    const used = FREE_FIXES_PER_VIDEO - price.freeFixesLeftAfter;
    return `Free fix · ${used} of ${FREE_FIXES_PER_VIDEO}`;
  }
  if (price.reason === "too_long") {
    return `Fixes longer than ${FREE_FIX_MAX_SECONDS} seconds use credits. This ${seconds}-second fix uses ${price.credits} credits.`;
  }
  return `You've used your ${FREE_FIXES_PER_VIDEO} free fixes for this video. This fix uses ${price.credits} credits.`;
}
