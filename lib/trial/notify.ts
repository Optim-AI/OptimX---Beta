import { SITE_NAME, SITE_SUPPORT_EMAIL } from '@/lib/seo/site';
import { sendOutboundEmail } from '@/lib/email/send';
import type { TrialRequestValidated } from './validate';

/** Always notify the SkalX sales inbox unless overridden. */
export function getTrialNotifyRecipient(): string {
  return (
    process.env.TRIAL_REQUEST_NOTIFY_EMAIL?.trim() ||
    SITE_SUPPORT_EMAIL ||
    'info@skalxai.app'
  );
}

function buildBodies(input: {
  id: string;
  data: TrialRequestValidated;
  createdAt: string;
}) {
  const subject = `[${SITE_NAME}] Free trial request — ${input.data.companyName}`;
  const lines = [
    'A new free trial request was submitted on skalxai.app.',
    '',
    `Request id: ${input.id}`,
    `Submitted: ${input.createdAt}`,
    `Status: pending (manual review required — do not auto-approve)`,
    '',
    `Name: ${input.data.fullName}`,
    `Email: ${input.data.email}`,
    `Company: ${input.data.companyName}`,
    `Website: ${input.data.websiteUrl || '(not provided)'}`,
    '',
    'Intended use case:',
    input.data.useCase,
    '',
    'Reply to this email to contact the prospect, or reply-to is set to their address.',
    'Grant access only after review through your normal operator process.',
  ];
  const text = lines.join('\n');
  const esc = (s: string) =>
    s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const row = (label: string, value: string) =>
    `<tr><td style="padding:8px 12px;color:#888;vertical-align:top;width:140px">${esc(label)}</td><td style="padding:8px 12px;color:#111">${esc(value)}</td></tr>`;

  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;max-width:560px">
      <h2 style="margin:0 0 12px;font-size:18px">New Free Trial request</h2>
      <p style="margin:0 0 16px;color:#444">Submitted on skalxai.app — status is <strong>pending</strong>.</p>
      <table style="border-collapse:collapse;width:100%;background:#f6f6f6;border-radius:8px">
        ${row('Request id', input.id)}
        ${row('Submitted', input.createdAt)}
        ${row('Name', input.data.fullName)}
        ${row('Email', input.data.email)}
        ${row('Company', input.data.companyName)}
        ${row('Website', input.data.websiteUrl || '(not provided)')}
        ${row('Use case', input.data.useCase)}
      </table>
      <p style="margin:16px 0 0;color:#666;font-size:13px">
        Contact them from info@skalxai.app after review. Do not treat this email as automatic access.
      </p>
    </div>
  `;

  return { subject, text, html };
}

export async function notifyTeamOfTrialRequest(input: {
  id: string;
  data: TrialRequestValidated;
  createdAt: string;
}): Promise<{ notified: boolean; provider?: string; skipped?: boolean; error?: string }> {
  const to = getTrialNotifyRecipient();
  const { subject, text, html } = buildBodies(input);
  const result = await sendOutboundEmail({
    to,
    subject,
    text,
    html,
    replyTo: input.data.email,
  });

  if (result.ok) {
    return { notified: true, provider: result.provider };
  }
  return { notified: false, error: result.error };
}
