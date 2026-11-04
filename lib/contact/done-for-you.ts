/**
 * "Done for you" enquiry from the website pricing section.
 * Validation is shared by the form (client) and /api/done-for-you (server).
 * Delivery reuses the /Contact email path: support inbox, nothing stored.
 */

import { SITE_NAME, SITE_SUPPORT_EMAIL } from '@/lib/seo/site';
import { sendOutboundEmail, type OutboundEmailResult } from '@/lib/email/send';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?[0-9][0-9\s-]{6,18}[0-9]$/;

export const MONTHLY_CONTENT_OPTIONS = [
  'Up to 10 pieces',
  '10–25 pieces',
  '25–50 pieces',
  '50+ pieces',
  'Not sure yet',
] as const;

export const DFY_LIMITS = {
  name: 120,
  email: 254,
  phone: 22,
  brandName: 160,
  website: 300,
  sells: 1000,
  monthlyContent: 40,
  notes: 4000,
} as const;

export type DfyField = keyof typeof DFY_LIMITS;
export type DfyRequest = Record<DfyField, string>;

export type DfyValidation =
  | { ok: true; value: DfyRequest }
  | { ok: false; errors: Partial<Record<DfyField, string>> };

const trim = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

export function validateDfyRequest(body: unknown): DfyValidation {
  const raw = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const value: DfyRequest = {
    name: trim(raw.name),
    email: trim(raw.email).toLowerCase(),
    phone: trim(raw.phone),
    brandName: trim(raw.brandName),
    website: trim(raw.website),
    sells: trim(raw.sells),
    monthlyContent: trim(raw.monthlyContent),
    notes: trim(raw.notes),
  };
  const errors: Partial<Record<DfyField, string>> = {};

  if (!value.name) errors.name = 'Enter your name.';
  if (!value.email) errors.email = 'Enter your work email.';
  else if (!EMAIL_RE.test(value.email)) errors.email = 'Enter a valid email address.';
  if (!value.phone) errors.phone = 'Enter a phone or WhatsApp number.';
  else if (!PHONE_RE.test(value.phone)) errors.phone = 'Enter a valid number, e.g. +91 98765 43210.';
  if (!value.brandName) errors.brandName = 'Enter your brand name.';
  if (!value.sells) errors.sells = 'Tell us what you sell.';
  if (!value.monthlyContent) errors.monthlyContent = 'Choose how much content you need.';
  else if (!(MONTHLY_CONTENT_OPTIONS as readonly string[]).includes(value.monthlyContent)) {
    errors.monthlyContent = 'Choose one of the options.';
  }

  for (const field of Object.keys(DFY_LIMITS) as DfyField[]) {
    if (!errors[field] && value[field].length > DFY_LIMITS[field]) errors[field] = 'This is too long.';
  }

  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, value };
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function buildDfyEmail(data: DfyRequest, submittedAt: string) {
  const rows: [string, string][] = [
    ['Name', data.name],
    ['Work email', data.email],
    ['Phone / WhatsApp', data.phone],
    ['Brand', data.brandName],
    ['Website / Instagram', data.website || '(not provided)'],
    ['Sells', data.sells],
    ['Monthly content', data.monthlyContent],
    ['Notes', data.notes || '(none)'],
    ['Submitted', submittedAt],
  ];
  return {
    subject: `[${SITE_NAME}] Done for you — ${data.brandName} (${data.monthlyContent})`,
    text: ['New "Done for you" enquiry from the pricing section.', '', ...rows.map(([k, v]) => `${k}: ${v}`)].join('\n'),
    html: `<div style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;max-width:560px">
      <h2 style="margin:0 0 12px;font-size:18px">New "Done for you" enquiry</h2>
      <table style="border-collapse:collapse;width:100%;background:#f6f6f6;border-radius:8px">${rows
        .map(
          ([k, v]) =>
            `<tr><td style="padding:8px 12px;color:#888;vertical-align:top;width:140px">${esc(k)}</td><td style="padding:8px 12px;color:#111;white-space:pre-wrap">${esc(v)}</td></tr>`
        )
        .join('')}</table></div>`,
  };
}

/** Same inbox as /Contact (CONTACT_NOTIFY_EMAIL, else the support address). */
export async function notifyDfyEnquiry(data: DfyRequest): Promise<OutboundEmailResult> {
  const { subject, text, html } = buildDfyEmail(data, new Date().toISOString());
  return sendOutboundEmail({
    to: process.env.CONTACT_NOTIFY_EMAIL?.trim() || SITE_SUPPORT_EMAIL,
    subject,
    text,
    html,
    replyTo: data.email,
  });
}
