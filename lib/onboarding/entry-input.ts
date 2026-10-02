/**
 * Landing-page entry classification.
 * A brand name is never treated as a website URL.
 */

export type HeroEntry =
  | { kind: 'website'; url: string }
  | { kind: 'brand'; name: string }
  | { kind: 'empty' };

const BLOCKED_PROTOCOL = /^(javascript|data|file|ftp|ftps|mailto|blob):/i;

export function classifyHeroInput(
  raw: string
): { ok: true; entry: HeroEntry } | { ok: false; error: string } {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: true, entry: { kind: 'empty' } };

  if (BLOCKED_PROTOCOL.test(trimmed) || trimmed.includes('://') && !/^https?:\/\//i.test(trimmed)) {
    return { ok: false, error: 'Enter a website starting with https://, or a brand name.' };
  }

  const looksLikeUrl =
    /^https?:\/\//i.test(trimmed) ||
    /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?)+(?:[/?#].*)?$/i.test(
      trimmed
    );

  if (!looksLikeUrl) {
    if (trimmed.length > 80) {
      return { ok: false, error: 'That brand name is too long.' };
    }
    return { ok: true, entry: { kind: 'brand', name: trimmed } };
  }

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let parsed: URL;
  try {
    parsed = new URL(withProtocol);
  } catch {
    return { ok: false, error: 'That website address is not valid.' };
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, error: 'Only http and https websites are supported.' };
  }
  if (!parsed.hostname.includes('.')) {
    return { ok: false, error: 'Enter a full website address, or a brand name.' };
  }
  return { ok: true, entry: { kind: 'website', url: parsed.toString() } };
}

export function isLikelyWebsite(raw: string): boolean {
  const result = classifyHeroInput(raw);
  return result.ok && result.entry.kind === 'website';
}
