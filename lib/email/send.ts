/**
 * Outbound email for trial requests → info@skalxai.app.
 * Prefers Resend when RESEND_API_KEY is set; otherwise FormSubmit fallback.
 * Server-only — never expose the API key to the browser.
 */

export type OutboundEmail = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
};

export type OutboundEmailResult =
  | { ok: true; provider: 'resend' | 'formsubmit' }
  | { ok: false; provider?: string; error: string };

function getResendApiKey(): string | undefined {
  const key = process.env.RESEND_API_KEY?.trim();
  return key || undefined;
}

/** From address — must be a Resend-verified domain (or onboarding@resend.dev for tests). */
export function getResendFromAddress(): string {
  return (
    process.env.RESEND_FROM_EMAIL?.trim() ||
    process.env.EMAIL_FROM?.trim() ||
    'SkalX AI <noreply@skalxai.app>'
  );
}

async function sendViaResend(
  apiKey: string,
  input: OutboundEmail
): Promise<OutboundEmailResult> {
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: getResendFromAddress(),
        to: [input.to],
        subject: input.subject,
        text: input.text,
        html: input.html || undefined,
        reply_to: input.replyTo || undefined,
      }),
    });
    const body = (await res.json().catch(() => null)) as {
      id?: string;
      message?: string;
      name?: string;
    } | null;
    if (!res.ok) {
      return {
        ok: false,
        provider: 'resend',
        error: (body?.message || body?.name || `resend_http_${res.status}`).slice(0, 300),
      };
    }
    return { ok: true, provider: 'resend' };
  } catch (e) {
    return {
      ok: false,
      provider: 'resend',
      error: ((e as Error)?.message || 'resend_failed').slice(0, 300),
    };
  }
}

async function sendViaFormSubmit(input: OutboundEmail): Promise<OutboundEmailResult> {
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

/** Send email. Uses Resend when configured; FormSubmit otherwise. */
export async function sendOutboundEmail(input: OutboundEmail): Promise<OutboundEmailResult> {
  const apiKey = getResendApiKey();
  if (apiKey) {
    return sendViaResend(apiKey, input);
  }
  return sendViaFormSubmit(input);
}

/** Send through Resend only (no FormSubmit fallback). Fails clearly when RESEND_API_KEY is missing. */
export async function sendViaResendOnly(input: OutboundEmail): Promise<OutboundEmailResult> {
  const apiKey = getResendApiKey();
  if (!apiKey) {
    return { ok: false, provider: 'resend', error: 'RESEND_API_KEY is not set' };
  }
  return sendViaResend(apiKey, input);
}
