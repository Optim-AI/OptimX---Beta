/** Validation for free-audit lead fields (no database imports, so it is easy to test). */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_CATEGORY_LENGTH = 80;

export function normalizeLeadEmail(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const email = raw.trim().toLowerCase();
  if (email.length > 254 || !EMAIL_RE.test(email)) return null;
  return email;
}

export function cleanLeadCategory(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const c = raw.trim().slice(0, MAX_CATEGORY_LENGTH);
  return c || null;
}

