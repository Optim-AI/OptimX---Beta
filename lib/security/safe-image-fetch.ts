/**
 * Fetch an image from a user-supplied URL without letting the server reach private
 * networks: every hop (including redirects) must resolve to a public address, and
 * the body is capped in size.
 */
import { assertPublicHost, UnsafeUrlError } from "@/lib/audit/url-safety";

export { UnsafeUrlError };

export class ImageFetchError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "ImageFetchError";
  }
}

export type SafeImage = { buffer: Buffer; contentType: string; url: string };

/** Throws UnsafeUrlError for private/invalid hosts, ImageFetchError for bad responses. */
export async function assertPublicUrl(raw: string): Promise<URL> {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new UnsafeUrlError("invalid_url", "Invalid URL");
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") throw new UnsafeUrlError("protocol", "Invalid URL protocol");
  await assertPublicHost(u.hostname);
  return u;
}

/** fetch() that re-checks the host on every redirect hop. */
export async function safeFetch(
  raw: string,
  init: RequestInit = {},
  opts: { maxRedirects?: number; timeoutMs?: number } = {}
): Promise<Response> {
  const maxRedirects = opts.maxRedirects ?? 4;
  const signal = init.signal ?? AbortSignal.timeout(opts.timeoutMs ?? 30_000);
  let current = raw;
  for (let hop = 0; hop <= maxRedirects; hop++) {
    const u = await assertPublicUrl(current);
    const res = await fetch(u, { ...init, redirect: "manual", signal });
    const location = res.status >= 300 && res.status < 400 ? res.headers.get("location") : null;
    if (!location) return res;
    current = new URL(location, u).href;
  }
  throw new ImageFetchError(502, "Too many redirects");
}

export async function safeFetchImage(
  raw: string,
  opts: { maxBytes?: number; timeoutMs?: number; headers?: Record<string, string> } = {}
): Promise<SafeImage> {
  const maxBytes = opts.maxBytes ?? 15 * 1024 * 1024;
  const res = await safeFetch(raw, { headers: { Accept: "image/*", ...opts.headers } }, { timeoutMs: opts.timeoutMs });
  if (!res.ok) throw new ImageFetchError(res.status, `Failed to fetch image (${res.status})`);
  const contentType = res.headers.get("content-type") || "";
  if (Number(res.headers.get("content-length") || 0) > maxBytes) throw new ImageFetchError(413, "Image is too large");
  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.length > maxBytes) throw new ImageFetchError(413, "Image is too large");
  return { buffer, contentType, url: res.url || raw };
}
