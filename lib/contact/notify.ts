import { SITE_NAME, SITE_SUPPORT_EMAIL } from '@/lib/seo/site';
import { sendOutboundEmail, type OutboundEmailResult } from '@/lib/email/send';
import type { ContactRequest } from './validate';

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function buildContactEmail(data: ContactRequest, submittedAt: string) {
  const rows: [string, string][] = [
    ['Name', data.name],
    ['Business', data.businessName],
    ['Email', data.email],
    ['Phone', data.phone || '(not provided)'],
    ['Message', data.message],
    ['Submitted', submittedAt],
  ];
  return {
    subject: `[${SITE_NAME}] Contact — ${data.businessName}`,
    text: ['New message from skalxai.app/Contact.', '', ...rows.map(([k, v]) => `${k}: ${v}`)].join('\n'),
    html: `<div style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;max-width:560px">
      <h2 style="margin:0 0 12px;font-size:18px">New contact message</h2>
      <table style="border-collapse:collapse;width:100%;background:#f6f6f6;border-radius:8px">${rows
        .map(
          ([k, v]) =>
            `<tr><td style="padding:8px 12px;color:#888;vertical-align:top;width:120px">${esc(k)}</td><td style="padding:8px 12px;color:#111;white-space:pre-wrap">${esc(v)}</td></tr>`
        )
        .join('')}</table></div>`,
  };
}

/** Contact messages go to the support inbox. Nothing is stored. */
export async function notifyContactMessage(data: ContactRequest): Promise<OutboundEmailResult> {
  const { subject, text, html } = buildContactEmail(data, new Date().toISOString());
  return sendOutboundEmail({
    to: process.env.CONTACT_NOTIFY_EMAIL?.trim() || SITE_SUPPORT_EMAIL,
    subject,
    text,
    html,
    replyTo: data.email,
  });
}
