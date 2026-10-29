'use client';

import React, { useId, useRef, useState } from 'react';
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
  /** Spans both columns on wider screens. */
  wide?: boolean;
};

const FIELDS: FieldSpec[] = [
  { name: 'name', label: 'Name', autoComplete: 'name' },
  { name: 'brandName', label: 'Brand name', autoComplete: 'organization' },
  { name: 'brandLink', label: 'Website or Instagram handle', placeholder: 'yourbrand.com or @yourbrand', wide: true },
  { name: 'email', label: 'Email', type: 'email', autoComplete: 'email' },
  { name: 'whatsapp', label: 'WhatsApp number', optional: true, type: 'tel', autoComplete: 'tel', placeholder: '+91' },
  { name: 'notes', label: 'Anything we should know?', optional: true, multiline: true, wide: true },
];

function trackFreeAdRequested() {
  void import('@vercel/analytics')
    .then((m) => m.track('free_ad_requested'))
    .catch(() => undefined);
}

const fieldClass = (invalid: boolean) =>
  `block w-full rounded-xl border bg-surface px-4 py-3 text-base text-ink placeholder:text-ink-mute disabled:opacity-60 ${
    invalid ? 'border-danger' : 'border-ink/25 hover:border-ink/50'
  }`;

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
      <div ref={successRef} tabIndex={-1} role="status" className="rounded-xl bg-accent-wash p-8 text-center text-ink outline-none">
        <p className="font-display text-2xl leading-snug">Got it. I&apos;ll send your free ad within 2 working days.</p>
        <p className="mt-2 text-lg text-ink-soft">— AJ</p>
      </div>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="grid gap-5 text-ink sm:grid-cols-2"
      aria-describedby={formError ? idFor('form-error') : undefined}
    >
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
          className: fieldClass(Boolean(err)),
          onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
            setValues((v) => ({ ...v, [f.name]: e.target.value }));
            if (err) setErrors((prev) => ({ ...prev, [f.name]: undefined }));
          },
        };
        return (
          <div key={f.name} className={f.wide ? 'sm:col-span-2' : undefined}>
            <label htmlFor={id} className="mb-1.5 block text-[15px] font-medium">
              {f.label}
              {f.optional ? <span className="font-normal text-ink-mute"> (optional)</span> : null}
            </label>
            {f.multiline ? (
              <textarea {...common} rows={3} />
            ) : (
              <input {...common} type={f.type || 'text'} autoComplete={f.autoComplete} inputMode={f.type === 'tel' ? 'tel' : undefined} />
            )}
            {err ? (
              <p id={`${id}-error`} className="mt-1.5 text-sm text-danger">
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
        <p id={idFor('form-error')} role="alert" className="text-sm text-danger sm:col-span-2">
          {formError}
        </p>
      ) : null}

      <div className="sm:col-span-2">
        <button
          type="submit"
          disabled={submitting}
          className="min-h-12 w-full rounded-full bg-accent px-6 text-base font-medium text-white hover:bg-accent-deep disabled:opacity-60"
        >
          {submitting ? 'Sending…' : 'Get my free ad'}
        </button>
        <p className="mt-3 text-center text-sm text-ink-soft">No payment, no signup. Made for you by the founder.</p>
        {WHATSAPP_NUMBER ? (
          <p className="mt-2 text-center text-sm">
            <a
              href={`https://wa.me/${WHATSAPP_NUMBER}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-ink underline underline-offset-4"
            >
              Prefer WhatsApp? Chat with us
            </a>
          </p>
        ) : null}
      </div>
    </form>
  );
}
