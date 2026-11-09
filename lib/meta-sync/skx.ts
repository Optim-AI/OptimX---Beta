/** Decides whether an ad was made with SkalX: `SKX-` name prefix, or its image matches one SkalX generated. */

export const SKX_PREFIX = /^\s*SKX-/i;

export type SkxInput = { adName: string | null | undefined; imageHash?: string | null; storedMd5?: string | null };
export type SkxResult = { made: boolean; reason: 'name_prefix' | 'image_hash' | null };

export function detectMadeBySkalx(input: SkxInput, skalxMd5s: ReadonlySet<string>): SkxResult {
  if (input.adName && SKX_PREFIX.test(input.adName)) return { made: true, reason: 'name_prefix' };
  const candidates = [input.imageHash, input.storedMd5].filter((h): h is string => !!h).map((h) => h.toLowerCase());
  if (candidates.some((h) => skalxMd5s.has(h))) return { made: true, reason: 'image_hash' };
  return { made: false, reason: null };
}
