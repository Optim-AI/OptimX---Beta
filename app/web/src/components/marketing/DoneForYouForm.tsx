'use client';

import React, { useId, useRef, useState } from 'react';
import {
  DFY_LIMITS,
  MONTHLY_CONTENT_OPTIONS,
  validateDfyRequest,
  type DfyField,
  type DfyRequest,
} from '@/lib/contact/done-for-you';

const EMPTY: DfyRequest = {
  name: '',
  email: '',
  phone: '',
  brandName: '',
  website: '',
  sells: '',
  monthlyContent: '',
  notes: '',
};

const ERROR_MESSAGE = 'Something went wrong. Please try again.';

const FIELDS: {
  name: DfyField;
  label: string;
  optional?: boolean;
  type?: 'text' | 'email' | 'tel';
  autoComplete?: string;
  kind?: 'textarea' | 'select';
  wide?: boolean;
}[] = [
  { name: 'name', label: 'Name', autoComplete: 'name' },
  { name: 'email', label: 'Work email', type: 'email', autoComplete: 'email' },
  { name: 'phone', label: 'Phone or WhatsApp', type: 'tel', autoComplete: 'tel' },
  { name: 'brandName', label: 'Brand name', autoComplete: 'organization' },
  { name: 'website', label: 'Website or Instagram', optional: true, autoComplete: 'url', wide: true },
  { name: 'sells', label: 'What do you sell?', wide: true },
  { name: 'monthlyContent', label: 'Monthly content needed', kind: 'select', wide: true },
  { name: 'notes', label: 'Anything else we should know?', optional: true, kind: 'textarea', wide: true },
];

const fieldClass = (invalid: boolean) =>
  `block w-full rounded-xl border bg-surface px-4 py-3 text-base text-ink placeholder:text-ink-mute disabled:opacity-60 ${
    invalid ? 'border-danger' : 'border-ink/25 hover:border-ink/50'
  }`;

/** "Done for you" enquiry form. Emails the support inbox via /api/done-for-you. */
export default function DoneForYouForm() {
  const uid = useId();
  const successRef = useRef<HTMLDivElement>(null);
  const [values, setValues] = useState<DfyRequest>(EMPTY);
  const [honeypot, setHoneypot] = useState('');
  const [errors, setErrors] = useState<Partial<Record<DfyField, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const inFlight = useRef(false);

  const idFor = (f: string) => `${uid}-${f}`;
  const focusFirstError = (errs: Partial<Record<DfyField, string>>) => {
    const first = FIELDS.find((f) => errs[f.name]);
    if (first) document.getElementById(idFor(first.name))?.focus();
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inFlight.current) return;
    setFormError(null);
    const checked = validateDfyRequest(values);
    if (!checked.ok) {
      setErrors(checked.errors);
      focusFirstError(checked.errors);
      return;
    }
    setErrors({});
    inFlight.current = true;
    setSubmitting(true);
    try {
      const res = await fetch('/api/done-for-you', {
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
        setFormError(ERROR_MESSAGE);
        return;
      }
      setDone(true);
      window.setTimeout(() => successRef.current?.focus(), 0);
    } catch {
      setFormError(ERROR_MESSAGE);
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div ref={successRef} tabIndex={-1} role="status" className="rounded-xl bg-accent-wash p-8 text-center outline-none">
        <p className="font-display text-2xl leading-snug">Thanks! We&apos;ve got your details and will be in touch soon.</p>
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
          'aria-invalid': Boolean(err),
          'aria-describedby': err ? `${id}-error` : undefined,
          'aria-required': !f.optional,
          disabled: submitting,
          className: fieldClass(Boolean(err)),
          onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
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
            {f.kind === 'textarea' ? (
              <textarea {...common} rows={4} maxLength={DFY_LIMITS[f.name]} />
            ) : f.kind === 'select' ? (
              <select {...common}>
                <option value="" disabled>
                  Choose one
                </option>
                {MONTHLY_CONTENT_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            ) : (
              <input
                {...common}
                type={f.type || 'text'}
                autoComplete={f.autoComplete}
                maxLength={DFY_LIMITS[f.name]}
              />
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
          aria-disabled={submitting}
          className="min-h-12 w-full rounded-full bg-ink px-6 text-base font-medium text-paper hover:bg-accent-deep disabled:opacity-60 sm:w-auto"
        >
          {submitting ? 'Sending…' : 'Send details'}
        </button>
      </div>
    </form>
  );
}
