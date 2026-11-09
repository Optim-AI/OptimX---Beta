'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { ArrowRight } from 'lucide-react';
import { authFetch } from '@/lib/utils';
import { trackAuditEvent } from '@/lib/audit/analytics';
import { AUDIT_FORM } from '@/content/home';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Free brand audit form: step 1 website, step 2 email + category.
 * POST /api/audit → /audit/:id. One audit per email (the API returns the existing audit
 * when an email has already been used).
 */
export default function AuditForm({
  idPrefix,
  tone = 'paper',
  focusOnHash,
}: {
  /** Unique per instance (the page renders the form twice). */
  idPrefix: string;
  tone?: 'paper' | 'ink';
  /** Focus the URL input when location.hash matches (e.g. "start" for /#start). */
  focusOnHash?: string;
}) {
  const router = useRouter();
  const urlRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<1 | 2>(1);
  const [url, setUrl] = useState('');
  const [email, setEmail] = useState('');
  const [category, setCategory] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ink = tone === 'ink';

  useEffect(() => {
    if (!focusOnHash) return;
    const focusIfTargeted = () => {
      if (window.location.hash === `#${focusOnHash}`) window.setTimeout(() => urlRef.current?.focus({ preventScroll: true }), 300);
    };
    focusIfTargeted();
    window.addEventListener('hashchange', focusIfTargeted);
    router.events.on('hashChangeComplete', focusIfTargeted);
    return () => {
      window.removeEventListener('hashchange', focusIfTargeted);
      router.events.off('hashChangeComplete', focusIfTargeted);
    };
  }, [focusOnHash, router.events]);

  useEffect(() => {
    if (step === 2) emailRef.current?.focus();
  }, [step]);

  const toStep2 = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) {
      setError('Paste your website address to get started.');
      urlRef.current?.focus();
      return;
    }
    setError(null);
    setStep(2);
    trackAuditEvent('audit_form_step2', {});
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (!EMAIL_RE.test(email.trim())) {
      setError('Enter a valid email address.');
      emailRef.current?.focus();
      return;
    }
    if (!category) {
      setError('Pick the category closest to your brand.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await authFetch('/api/audit', {
        method: 'POST',
        body: JSON.stringify({ url: url.trim(), email: email.trim(), category }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok || !data.audit?.id) {
        setError(
          (typeof data?.error === 'string' && data.error) ||
            "We couldn't start your audit. Please try again."
        );
        setSubmitting(false);
        return;
      }
      if (!data.reused) trackAuditEvent('audit_started', { host: data.audit.host });
      router.push(`/audit/${data.audit.id}`);
    } catch {
      setError('Network error. Check your connection and try again.');
      setSubmitting(false);
    }
  };

  const errId = `${idPrefix}-error`;
  const field = `min-h-12 w-full rounded-full border px-5 text-base ${
    ink ? 'border-paper/25 bg-paper/[0.06] text-paper placeholder:text-paper/50' : 'border-ink/20 bg-surface text-ink placeholder:text-ink-mute'
  }`;
  const label = `mb-1.5 block text-sm font-medium ${ink ? 'text-paper' : 'text-ink'}`;
  const button = `group inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-full px-6 font-medium transition-[background-color,transform] active:scale-[0.98] disabled:opacity-60 ${
    ink ? 'bg-paper text-ink hover:bg-white' : 'bg-accent text-white shadow-[0_10px_24px_-12px_rgba(29,78,216,0.8)] hover:bg-accent-deep'
  }`;

  return (
    <div>
      {step === 1 ? (
        <form onSubmit={toStep2} noValidate>
          <label htmlFor={`${idPrefix}-url`} className={label}>
            {AUDIT_FORM.urlLabel}
          </label>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              ref={urlRef}
              id={`${idPrefix}-url`}
              type="text"
              inputMode="url"
              autoComplete="url"
              autoCapitalize="none"
              spellCheck={false}
              placeholder={AUDIT_FORM.urlPlaceholder}
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                if (error) setError(null);
              }}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? errId : undefined}
              className={`${field} flex-1`}
            />
            <button type="submit" className={button}>
              {AUDIT_FORM.next}
              <ArrowRight aria-hidden className="sx-btn-arrow h-4 w-4" />
            </button>
          </div>
        </form>
      ) : (
        <form onSubmit={submit} noValidate className="sx-reveal">
          <p className={`mb-3 text-sm ${ink ? 'text-paper/70' : 'text-ink-soft'}`}>
            Auditing <strong className={ink ? 'text-paper' : 'text-ink'}>{url.trim()}</strong>{' '}
            <button type="button" onClick={() => setStep(1)} className="underline underline-offset-4">
              Change
            </button>
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor={`${idPrefix}-email`} className={label}>
                {AUDIT_FORM.emailLabel}
              </label>
              <input
                ref={emailRef}
                id={`${idPrefix}-email`}
                type="email"
                autoComplete="email"
                placeholder={AUDIT_FORM.emailPlaceholder}
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (error) setError(null);
                }}
                aria-describedby={error ? errId : undefined}
                className={field}
              />
            </div>
            <div>
              <label htmlFor={`${idPrefix}-category`} className={label}>
                {AUDIT_FORM.categoryLabel}
              </label>
              <select
                id={`${idPrefix}-category`}
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value);
                  if (error) setError(null);
                }}
                className={`${field} appearance-none bg-[length:16px] bg-[right_1.1rem_center] bg-no-repeat pr-10`}
                style={{
                  backgroundImage:
                    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%236b6357' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
                }}
              >
                <option value="" disabled>
                  Choose one
                </option>
                {AUDIT_FORM.categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <button type="submit" disabled={submitting} className={`${button} mt-3 w-full sm:w-auto`}>
            {submitting ? AUDIT_FORM.submitting : AUDIT_FORM.submit}
            {submitting ? null : <ArrowRight aria-hidden className="sx-btn-arrow h-4 w-4" />}
          </button>
          <p className={`mt-2 text-xs ${ink ? 'text-paper/60' : 'text-ink-mute'}`}>{AUDIT_FORM.privacy}</p>
        </form>
      )}
      {error ? (
        <p id={errId} role="alert" className={`mt-2 text-sm ${ink ? 'text-[#ffb4ab]' : 'text-danger'}`}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
