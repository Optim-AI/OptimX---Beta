import { SITE_NAME, SITE_SUPPORT_EMAIL } from '@/lib/seo/site';
import { sendViaResendOnly, type OutboundEmailResult } from '@/lib/email/send';
import type { FreeAdRequest } from './validate';

/** Free-ad requests go to info@skalxai.app (override with FREE_AD_NOTIFY_EMAIL). Nothing is stored. */
export function getFreeAdNotifyRecipient(): string {
  return process.env.FREE_AD_NOTIFY_EMAIL?.trim() || SITE_SUPPORT_EMAIL;
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function buildFreeAdEmail(data: FreeAdRequest, submittedAt: string) {
  const rows: [string, string][] = [
    ['Name', data.name],
    ['Brand', data.brandName],
    ['Website / Instagram', data.brandLink],
    ['Email', data.email],
    ['WhatsApp', data.whatsapp || '(not provided)'],
    ['Notes', data.notes || '(none)'],
    ['Submitted', submittedAt],
  ];
  const subject = `[${SITE_NAME}] Free ad request — ${data.brandName}`;
  const text = [
    'New free-ad request from skalxai.app/free-ad.',
    '',
    ...rows.map(([k, v]) => `${k}: ${v}`),
    '',
    'Promised turnaround: within 2 working days. Reply-to is set to the requester.',
  ].join('\n');
  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;max-width:560px">
      <h2 style="margin:0 0 12px;font-size:18px">New free-ad request</h2>
      <p style="margin:0 0 16px;color:#444">Promised turnaround: within 2 working days.</p>
      <table style="border-collapse:collapse;width:100%;background:#f6f6f6;border-radius:8px">
        ${rows
          .map(
            ([k, v]) =>
              `<tr><td style="padding:8px 12px;color:#888;vertical-align:top;width:160px">${esc(k)}</td><td style="padding:8px 12px;color:#111;white-space:pre-wrap">${esc(v)}</td></tr>`
          )
          .join('')}
      </table>
    </div>
  `;
  return { subject, text, html };
}

export async function notifyFreeAdRequest(data: FreeAdRequest): Promise<OutboundEmailResult> {
  const { subject, text, html } = buildFreeAdEmail(data, new Date().toISOString());
  // Resend only — no FormSubmit fallback for free-ad requests.
  return sendViaResendOnly({
    to: getFreeAdNotifyRecipient(),
    subject,
    text,
    html,
    replyTo: data.email,
  });
}
