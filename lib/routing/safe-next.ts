/**
 * Safe internal redirect targets for auth return URLs.
 * Rejects open redirects (external URLs, protocol-relative, etc.).
 */

export function getSafeNextPath(
  next: unknown,
  fallback = '/welcome'
): string {
  if (typeof next !== 'string') return fallback;
  const trimmed = next.trim();
  if (!trimmed.startsWith('/')) return fallback;
  if (trimmed.startsWith('//')) return fallback;
  if (trimmed.includes('://')) return fallback;
  return trimmed;
}

/**
 * Configured public site/app origin (no trailing slash).
 * Uses NEXT_PUBLIC_APP_URL / NEXT_PUBLIC_SITE_URL — same vars as Meta/Instagram OAuth.
 * Development may fall back to localhost; production requires configuration.
 */
export function getConfiguredSiteOrigin(): string {
  const configured = (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    ''
  )
    .trim()
    .replace(/\/$/, '');
  if (configured) return configured;
  if (process.env.NODE_ENV === 'development') {
    return 'http://localhost:3000';
  }
  throw new Error(
    'NEXT_PUBLIC_APP_URL or NEXT_PUBLIC_SITE_URL must be configured in production'
  );
}

type OriginRequest = {
  headers: {
    origin?: string | string[];
    host?: string | string[];
    'x-forwarded-proto'?: string | string[];
  };
};

/**
 * Resolve request origin for OAuth callbacks.
 * Prefers request headers; falls back to configured site URL.
 * Never falls back to hardcoded tunnels/ngrok.
 */
export function resolveRequestOrigin(req: OriginRequest): string {
  const originHeaderRaw = req.headers.origin;
  const originHeader = (
    Array.isArray(originHeaderRaw) ? originHeaderRaw[0] : originHeaderRaw || ''
  ).replace(/\/$/, '');
  if (originHeader) return originHeader;

  const hostRaw = req.headers.host;
  const host = (Array.isArray(hostRaw) ? hostRaw[0] : hostRaw || '').trim();
  if (host) {
    const forwardedRaw = req.headers['x-forwarded-proto'];
    const forwardedProto = (
      Array.isArray(forwardedRaw) ? forwardedRaw[0] : forwardedRaw || ''
    ).toLowerCase();
    const isLocal = host.includes('localhost') || host.includes('127.0.0.1');
    const proto =
      forwardedProto === 'https'
        ? 'https'
        : isLocal
          ? 'http'
          : 'https';
    return `${proto}://${host}`.replace(/\/$/, '');
  }

  return getConfiguredSiteOrigin();
}

/** Absolute URL for OAuth / magic-link emailRedirectTo. */
export function getAuthRedirectUrl(nextPath: string): string {
  const path = getSafeNextPath(nextPath, '/welcome');
  if (typeof window !== 'undefined') {
    return `${window.location.origin}${path}`;
  }
  return `${getConfiguredSiteOrigin()}${path}`;
}
