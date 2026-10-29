/**
 * Best-effort in-memory rate limit for public lead forms (free-ad, contact).
 * Per server instance only — by design these forms store nothing in a database.
 */
const WINDOW_MS = 3600_000;
const buckets = new Map<string, number[]>();

export function isRateLimited(key: string, maxPerHour = 5): boolean {
  const now = Date.now();
  const hits = (buckets.get(key) || []).filter((t) => now - t < WINDOW_MS);
  const limited = hits.length >= maxPerHour;
  if (!limited) hits.push(now);
  buckets.set(key, hits);
  if (buckets.size > 5000) buckets.clear();
  return limited;
}
