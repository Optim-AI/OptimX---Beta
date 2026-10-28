'use client';

import React, { useId, useRef, useState } from 'react';
import colors from '@/lib/ui/colors';
import { SITE_SUPPORT_EMAIL } from '@/lib/seo/site';
import {
  FREE_AD_LIMITS,
  validateFreeAdRequest,
  type FreeAdField,
  type FreeAdRequest,
} from '@/lib/free-ad/validate';

// TODO: WhatsApp click-to-chat — add the number (digits only, with country code) to show the button.
const WHATSAPP_NUMBER = '';

const EMPTY: FreeAdRequest = {
  name: '',
  brandName: '',
  brandLink: '',
  product: '',
  email: '',
  whatsapp: '',
  notes: '',
};

type FieldSpec = {
  name: FreeAdField;
  label: string;
  optional?: boolean;
  type?: 'text' | 'email' | 'tel';
  autoComplete?: string;
  placeholder?: string;
  multiline?: boolean;
};

const FIELDS: FieldSpec[] = [
  { name: 'name', label: 'Name', autoComplete: 'name' },
  { name: 'brandName', label: 'Brand name', autoComplete: 'organization' },
  { name: 'brandLink', label: 'Website or Instagram handle', placeholder: 'yourbrand.com or @yourbrand' },
  { name: 'product', label: 'Which product should we feature?', placeholder: 'e.g. Mango chilli trail mix, 200 g' },
  { name: 'email', label: 'Email', type: 'email', autoComplete: 'email' },
  { name: 'whatsapp', label: 'WhatsApp number', optional: true, type: 'tel', autoComplete: 'tel', placeholder: '+91' },
  { name: 'notes', label: 'Anything we should know?', optional: true, multiline: true },
];

function trackFreeAdRequested() {
  void import('@vercel/analytics')
    .then((m) => m.track('free_ad_requested'))
    .catch(() => undefined);
}

const inputStyle = (invalid: boolean): React.CSSProperties => ({
  width: '100%',
  background: 'hsl(0 0% 8%)',
  color: colors.foreground,
  border: `1px solid ${invalid ? colors.destructive : 'rgba(255,255,255,0.18)'}`,
  borderRadius: 12,
  padding: '12px 14px',
  fontSize: 16,
});

/** Free-ad request form. Emails the founder via /api/free-ad; stores nothing. */
export default function FreeAdForm() {
  const uid = useId();
  const successRef = useRef<HTMLDivElement>(null);
  const [values, setValues] = useState<FreeAdRequest>(EMPTY);
  const [honeypot, setHoneypot] = useState('');
  const [errors, setErrors] = useState<Partial<Record<FreeAdField, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const idFor = (f: string) => `${uid}-${f}`;

  const focusFirstError = (errs: Partial<Record<FreeAdField, string>>) => {
    const first = FIELDS.find((f) => errs[f.name]);
    if (first) document.getElementById(idFor(first.name))?.focus();
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setFormError(null);

    const checked = validateFreeAdRequest(values);
    if (!checked.ok) {
      setErrors(checked.errors);
      focusFirstError(checked.errors);
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      const res = await fetch('/api/free-ad', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...checked.value, company_url: honeypot }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        if (data?.errors) {
          setErrors(data.errors);
          focusFirstError(data.errors);
        }
        setFormError(
          (typeof data?.error === 'string' && data.error) ||
            `Something went wrong. Please try again, or email ${SITE_SUPPORT_EMAIL}.`
        );
        return;
      }
      trackFreeAdRequested();
      setDone(true);
      window.setTimeout(() => successRef.current?.focus(), 0);
    } catch {
      setFormError(`Network error. Check your connection and try again, or email ${SITE_SUPPORT_EMAIL}.`);
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div
        ref={successRef}
        tabIndex={-1}
        role="status"
        className="rounded-2xl p-8 text-center outline-none"
        style={{ background: 'hsl(0 0% 12%)', border: '1px solid rgba(255,255,255,0.12)' }}
      >
        <p className="text-xl leading-relaxed" style={{ color: colors.foreground }}>
          Got it. I&apos;ll send your free ad within 2 working days.
        </p>
        <p className="mt-2 text-lg" style={{ color: colors.mutedForeground }}>
          — AJ
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5" aria-describedby={formError ? idFor('form-error') : undefined}>
      {FIELDS.map((f) => {
        const err = errors[f.name];
        const id = idFor(f.name);
        const common = {
          id,
          name: f.name,
          value: values[f.name],
          maxLength: FREE_AD_LIMITS[f.name],
          'aria-invalid': Boolean(err),
          'aria-describedby': err ? `${id}-error` : undefined,
          'aria-required': !f.optional,
          disabled: submitting,
          placeholder: f.placeholder,
          className: 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[hsl(213_100%_65%)]',
          style: inputStyle(Boolean(err)),
          onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
            setValues((v) => ({ ...v, [f.name]: e.target.value }));
            if (err) setErrors((prev) => ({ ...prev, [f.name]: undefined }));
          },
        };
        return (
          <div key={f.name}>
            <label htmlFor={id} className="block text-sm font-medium mb-2" style={{ color: colors.foreground }}>
              {f.label}
              {f.optional ? (
                <span className="font-normal" style={{ color: colors.mutedForeground }}>
                  {' '}(optional)
                </span>
              ) : null}
            </label>
            {f.multiline ? (
              <textarea {...common} rows={4} />
            ) : (
              <input {...common} type={f.type || 'text'} autoComplete={f.autoComplete} inputMode={f.type === 'tel' ? 'tel' : undefined} />
            )}
            {err ? (
              <p id={`${id}-error`} className="mt-1.5 text-sm" style={{ color: 'hsl(0 90% 70%)' }}>
                {err}
              </p>
            ) : null}
          </div>
        );
      })}

      {/* Honeypot — hidden from people and assistive tech. */}
      <div aria-hidden="true" style={{ position: 'absolute', left: '-10000px', width: 1, height: 1, overflow: 'hidden' }}>
        <label htmlFor={idFor('company_url')}>Leave this empty</label>
        <input
          id={idFor('company_url')}
          name="company_url"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
        />
      </div>

      {formError ? (
        <p id={idFor('form-error')} role="alert" className="text-sm" style={{ color: 'hsl(0 90% 70%)' }}>
          {formError}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={submitting}
        className="w-full h-12 rounded-xl text-base font-medium disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        style={{ background: colors.gradientPrimary, color: colors.primaryForeground, border: 'none' }}
      >
        {submitting ? 'Sending…' : 'Get my free ad'}
      </button>

      <p className="text-sm text-center" style={{ color: colors.mutedForeground }}>
        No payment, no signup. Made for you by the founder.
      </p>

      {WHATSAPP_NUMBER ? (
        <p className="text-sm text-center">
          <a
            href={`https://wa.me/${WHATSAPP_NUMBER}`}
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
            style={{ color: colors.foreground }}
          >
            Prefer WhatsApp? Chat with us
          </a>
        </p>
      ) : null}
    </form>
  );
}
