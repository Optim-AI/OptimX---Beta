/** Validation for the /Contact form. Shared by the form (client) and /api/contact (server). */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?[0-9][0-9\s-]{6,18}[0-9]$/;

export const CONTACT_LIMITS = {
  name: 120,
  businessName: 160,
  email: 254,
  phone: 22,
  message: 4000,
} as const;

export type ContactField = keyof typeof CONTACT_LIMITS;
export type ContactRequest = Record<ContactField, string>;

export type ContactValidation =
  | { ok: true; value: ContactRequest }
  | { ok: false; errors: Partial<Record<ContactField, string>> };

const trim = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

export function validateContactRequest(body: unknown): ContactValidation {
  const raw = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const value: ContactRequest = {
    name: trim(raw.name),
    businessName: trim(raw.businessName),
    email: trim(raw.email).toLowerCase(),
    phone: trim(raw.phone),
    message: trim(raw.message),
  };
  const errors: Partial<Record<ContactField, string>> = {};

  if (!value.name) errors.name = 'Enter your name.';
  if (!value.businessName) errors.businessName = 'Enter your brand or business name.';
  if (!value.email) errors.email = 'Enter your email so we can reply.';
  else if (!EMAIL_RE.test(value.email)) errors.email = 'Enter a valid email address.';
  if (value.phone && !PHONE_RE.test(value.phone)) errors.phone = 'Enter a valid phone number, e.g. +91 98765 43210.';
  if (!value.message) errors.message = 'Tell us how we can help.';

  for (const field of Object.keys(CONTACT_LIMITS) as ContactField[]) {
    if (!errors[field] && value[field].length > CONTACT_LIMITS[field]) errors[field] = 'This is too long.';
  }

  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, value };
}
