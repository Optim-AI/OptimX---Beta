/**
 * Outbound email for trial requests via FormSubmit.co → info@skalxai.app.
 * No API key required. First delivery asks the inbox to confirm once.
 */

export type OutboundEmail = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
};

export type OutboundEmailResult =
  | { ok: true; provider: 'formsubmit' }
  | { ok: false; provider?: string; error: string };

/** Send via FormSubmit AJAX to the destination address. */
export async function sendOutboundEmail(input: OutboundEmail): Promise<OutboundEmailResult> {
  try {
    const res = await fetch(`https://formsubmit.co/ajax/${encodeURIComponent(input.to)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        _subject: input.subject,
        _template: 'table',
        _captcha: 'false',
        _replyto: input.replyTo || undefined,
        name: 'SkalX Free Trial',
        email: input.replyTo || 'noreply@skalxai.app',
        message: input.text,
      }),
    });
    const body = (await res.json().catch(() => null)) as {
      success?: string | boolean;
      message?: string;
    } | null;
    if (!res.ok) {
      return {
        ok: false,
        provider: 'formsubmit',
        error: (body?.message || `formsubmit_http_${res.status}`).slice(0, 300),
      };
    }
    return { ok: true, provider: 'formsubmit' };
  } catch (e) {
    return {
      ok: false,
      provider: 'formsubmit',
      error: ((e as Error)?.message || 'formsubmit_failed').slice(0, 300),
    };
  }
}
