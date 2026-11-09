/**
 * Brief delivery channels. Email goes through Resend (lib/email/send.ts).
 * WhatsApp is a reserved hook: wire a provider here later; nothing calls it yet.
 */
import { sendOutboundEmail } from '@/lib/email/send';
import { renderBriefEmail } from './email';
import type { BriefContent } from './content';

export type BriefChannel = 'email' | 'whatsapp';

export type DeliveryResult = { channel: BriefChannel; status: 'sent' | 'skipped' | 'failed' | 'not_implemented'; reason?: string; at: string };

export type BriefRecipient = { email: string | null; phone?: string | null; brandName: string | null };

export function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || 'https://skalxai.app').replace(/\/$/, '');
}

export function briefLinks(content: BriefContent) {
  const base = appUrl();
  return {
    dashboard: `${base}/meta-intelligence`,
    pack: content.pack ? `${base}${content.pack.kind === 'posters' ? '/content-studio/posters/' : '/content-studio/test-pack/'}${content.pack.id}` : null,
    settings: `${base}/settings?tab=integrations`,
  };
}

export async function deliverBrief(
  channel: BriefChannel,
  content: BriefContent,
  to: BriefRecipient,
  deps: { send?: typeof sendOutboundEmail } = {},
): Promise<DeliveryResult> {
  const at = new Date().toISOString();
  if (channel === 'whatsapp') {
    // Hook for later: send `content.oneLine` + links via the WhatsApp Business API.
    return { channel, status: 'not_implemented', at };
  }
  if (!to.email) return { channel, status: 'skipped', reason: 'no_email', at };
  // FormSubmit (the fallback in send.ts) needs each recipient to confirm first, so only Resend is used for customers.
  if (!process.env.RESEND_API_KEY?.trim() && !deps.send) return { channel, status: 'skipped', reason: 'email_not_configured', at };
  const { subject, html, text } = renderBriefEmail(content, briefLinks(content), to.brandName);
  const res = await (deps.send ?? sendOutboundEmail)({ to: to.email, subject, html, text });
  return res.ok ? { channel, status: 'sent', at } : { channel, status: 'failed', reason: res.error.slice(0, 200), at };
}
