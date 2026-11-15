/**
 * Small in-memory request limiter (fixed window per key).
 *
 * It lives in each server instance's memory, so on serverless it is a brake, not a wall:
 * a determined attacker spread over many instances gets more than the limit. It stops
 * the cheap abuse (password guessing, form spam, running up AI bills from one machine)
 * without a new service. Move to a shared store (Upstash/Redis) if abuse gets past it.
 */

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();
const MAX_KEYS = 20_000;

export type RateLimitResult = { ok: boolean; retryAfterSeconds: number };

export function rateLimit(key: string, limit: number, windowMs: number, now = Date.now()): RateLimitResult {
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    if (buckets.size >= MAX_KEYS) {
      for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
      if (buckets.size >= MAX_KEYS) buckets.clear();
    }
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterSeconds: 0 };
  }
  b.count += 1;
  if (b.count <= limit) return { ok: true, retryAfterSeconds: 0 };
  return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil((b.resetAt - now) / 1000)) };
}

type HeaderBag = { get(name: string): string | null } | Record<string, string | string[] | undefined>;

/** Caller's address as the platform reports it (Vercel sets x-forwarded-for). */
export function clientIp(headers: HeaderBag): string {
  const read = (name: string): string => {
    const v = typeof (headers as any).get === "function" ? (headers as any).get(name) : (headers as any)[name];
    return Array.isArray(v) ? v[0] || "" : v || "";
  };
  return read("x-forwarded-for").split(",")[0].trim() || read("x-real-ip").trim() || "unknown";
}

export const TOO_MANY_REQUESTS = "Too many attempts. Please wait a little and try again.";

/** For pages/api routes: returns true (and answers 429) when the caller is over the limit. */
export function limitedPagesApi(
  req: { headers: Record<string, string | string[] | undefined> },
  res: { setHeader(name: string, value: string): unknown; status(code: number): { json(body: unknown): unknown } },
  name: string,
  limit: number,
  windowMs: number,
  extraKey = ""
): boolean {
  const r = rateLimit(`${name}:${clientIp(req.headers)}:${extraKey}`, limit, windowMs);
  if (r.ok) return false;
  res.setHeader("Retry-After", String(r.retryAfterSeconds));
  res.status(429).json({ ok: false, error: TOO_MANY_REQUESTS, code: "RATE_LIMITED" });
  return true;
}

/** Test helper. */
export function resetRateLimits(): void {
  buckets.clear();
}
