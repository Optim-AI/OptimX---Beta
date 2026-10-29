'use client';

import React, { useId, useRef, useState } from 'react';
import { SITE_SUPPORT_EMAIL } from '@/lib/seo/site';
import {
  CONTACT_LIMITS,
  validateContactRequest,
  type ContactField,
  type ContactRequest,
} from '@/lib/contact/validate';

const EMPTY: ContactRequest = { name: '', businessName: '', email: '', phone: '', message: '' };

const FIELDS: {
  name: ContactField;
  label: string;
  optional?: boolean;
  type?: 'text' | 'email' | 'tel';
  autoComplete?: string;
  multiline?: boolean;
}[] = [
  { name: 'name', label: 'Name', autoComplete: 'name' },
  { name: 'businessName', label: 'Brand or business', autoComplete: 'organization' },
  { name: 'email', label: 'Email', type: 'email', autoComplete: 'email' },
  { name: 'phone', label: 'Phone or WhatsApp', optional: true, type: 'tel', autoComplete: 'tel' },
  { name: 'message', label: 'How can we help?', multiline: true },
];

const fieldClass = (invalid: boolean) =>
  `block w-full rounded-xl border bg-surface px-4 py-3 text-base text-ink placeholder:text-ink-mute disabled:opacity-60 ${
    invalid ? 'border-danger' : 'border-ink/25 hover:border-ink/50'
  }`;

/** Contact form. Emails the support inbox via /api/contact; stores nothing. */
export default function ContactForm() {
  const uid = useId();
  const successRef = useRef<HTMLDivElement>(null);
  const [values, setValues] = useState<ContactRequest>(EMPTY);
  const [honeypot, setHoneypot] = useState('');
  const [errors, setErrors] = useState<Partial<Record<ContactField, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const idFor = (f: string) => `${uid}-${f}`;
  const focusFirstError = (errs: Partial<Record<ContactField, string>>) => {
    const first = FIELDS.find((f) => errs[f.name]);
    if (first) document.getElementById(idFor(first.name))?.focus();
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setFormError(null);
    const checked = validateContactRequest(values);
    if (!checked.ok) {
      setErrors(checked.errors);
      focusFirstError(checked.errors);
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      const res = await fetch('/api/contact', {
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
      <div ref={successRef} tabIndex={-1} role="status" className="rounded-xl bg-accent-wash p-8 text-center outline-none">
        <p className="font-display text-2xl leading-snug">Thanks — your message is in.</p>
        <p className="mt-2 text-ink-soft">We&apos;ll reply by email within one working day.</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-5 sm:grid-cols-2">
      {FIELDS.map((f) => {
        const err = errors[f.name];
        const id = idFor(f.name);
        const common = {
          id,
          name: f.name,
          value: values[f.name],
          maxLength: CONTACT_LIMITS[f.name],
          'aria-invalid': Boolean(err),
          'aria-describedby': err ? `${id}-error` : undefined,
          'aria-required': !f.optional,
          disabled: submitting,
          className: fieldClass(Boolean(err)),
          onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
            setValues((v) => ({ ...v, [f.name]: e.target.value }));
            if (err) setErrors((prev) => ({ ...prev, [f.name]: undefined }));
          },
        };
        return (
          <div key={f.name} className={f.multiline ? 'sm:col-span-2' : undefined}>
            <label htmlFor={id} className="mb-1.5 block text-[15px] font-medium">
              {f.label}
              {f.optional ? <span className="font-normal text-ink-mute"> (optional)</span> : null}
            </label>
            {f.multiline ? (
              <textarea {...common} rows={5} />
            ) : (
              <input {...common} type={f.type || 'text'} autoComplete={f.autoComplete} />
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
        <p role="alert" className="text-sm text-danger sm:col-span-2">
          {formError}
        </p>
      ) : null}

      <div className="sm:col-span-2">
        <button
          type="submit"
          disabled={submitting}
          className="min-h-12 w-full rounded-full bg-ink px-6 text-base font-medium text-paper hover:bg-accent-deep disabled:opacity-60 sm:w-auto"
        >
          {submitting ? 'Sending…' : 'Send message'}
        </button>
      </div>
    </form>
  );
}
