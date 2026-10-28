/** Validation for "Get one free ad" requests. Shared by the form (client) and /api/free-ad (server). */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const WHATSAPP_RE = /^\+?[0-9][0-9\s-]{6,18}[0-9]$/;

export const FREE_AD_LIMITS = {
  name: 120,
  brandName: 160,
  brandLink: 300,
  product: 300,
  email: 254,
  whatsapp: 22,
  notes: 2000,
} as const;

export type FreeAdField =
  | 'name'
  | 'brandName'
  | 'brandLink'
  | 'product'
  | 'email'
  | 'whatsapp'
  | 'notes';

export type FreeAdRequest = Record<FreeAdField, string>;

export type FreeAdValidation =
  | { ok: true; value: FreeAdRequest }
  | { ok: false; errors: Partial<Record<FreeAdField, string>> };

function trim(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function validateFreeAdRequest(body: unknown): FreeAdValidation {
  const raw = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const value: FreeAdRequest = {
    name: trim(raw.name),
    brandName: trim(raw.brandName),
    brandLink: trim(raw.brandLink),
    product: trim(raw.product),
    email: trim(raw.email).toLowerCase(),
    whatsapp: trim(raw.whatsapp),
    notes: trim(raw.notes),
  };
  const errors: Partial<Record<FreeAdField, string>> = {};

  if (!value.name) errors.name = 'Enter your name.';
  if (!value.brandName) errors.brandName = 'Enter your brand name.';
  if (!value.brandLink) errors.brandLink = 'Add your website or Instagram handle.';
  if (!value.product) errors.product = 'Tell us which product to feature.';
  if (!value.email) errors.email = 'Enter your email.';
  else if (!EMAIL_RE.test(value.email)) errors.email = 'Enter a valid email address.';
  if (value.whatsapp && !WHATSAPP_RE.test(value.whatsapp)) {
    errors.whatsapp = 'Enter a valid phone number, e.g. +91 98765 43210.';
  }

  for (const field of Object.keys(FREE_AD_LIMITS) as FreeAdField[]) {
    if (!errors[field] && value[field].length > FREE_AD_LIMITS[field]) {
      errors[field] = 'This is too long.';
    }
  }

  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, value };
}
