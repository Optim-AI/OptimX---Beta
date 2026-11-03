'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { useRouter } from 'next/router';
import { authFetch } from '@/lib/utils';
import { trackAuditEvent } from '@/lib/audit/analytics';
import { SIGNUP_HREF } from '@/lib/marketing/content';

type Props = {
  /** Unique input id (the page can render this twice). */
  inputId: string;
  /** Dark band styling. */
  onInk?: boolean;
  /** Focus the input when the URL hash matches (e.g. "start" for /#start). */
  focusOnHash?: string;
};

/**
 * "Get a free ad": paste a website → POST /api/audit → /audit/:id
 * (research + 3 ideas → pick one → sign-up → onboarding pricing).
 * Request/response handling is the same as the former hero audit form.
 */
export default function StartForm({ inputId, onInk = false, focusOnHash }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!focusOnHash) return;
    const focusIfTargeted = () => {
      if (window.location.hash === `#${focusOnHash}`) {
        window.setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 300);
      }
    };
    focusIfTargeted();
    window.addEventListener('hashchange', focusIfTargeted);
    router.events.on('hashChangeComplete', focusIfTargeted);
    return () => {
      window.removeEventListener('hashchange', focusIfTargeted);
      router.events.off('hashChangeComplete', focusIfTargeted);
    };
  }, [focusOnHash, router.events]);

  const start = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    const trimmed = url.trim();
    if (!trimmed) {
      setError('Paste your website address to get started.');
      inputRef.current?.focus();
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await authFetch('/api/audit', {
        method: 'POST',
        body: JSON.stringify({ url: trimmed }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok || !data.audit?.id) {
        const code = typeof data?.code === 'string' ? data.code : '';
        const msg =
          (typeof data?.error === 'string' && data.error) ||
          (code === 'rate_limited'
            ? "You've run several audits recently. Please try again later."
            : code === 'audit_storage_unavailable'
              ? 'Audit storage is temporarily unavailable. Please try again in a few minutes.'
              : code === 'dns' || code === 'private_address'
                ? "We couldn't reach that website. Check the address and try again."
                : "We couldn't start your research. Please try again.");
        setError(msg);
        setSubmitting(false);
        return;
      }
      if (!data.reused) trackAuditEvent('audit_started', { host: data.audit.host });
      // Keep submitting=true until navigation; prevents double-create on double-click.
      router.push(`/audit/${data.audit.id}`);
    } catch {
      setError('Network error. Check your connection and try again.');
      setSubmitting(false);
    }
  };

  const errorId = `${inputId}-error`;
  return (
    <div>
      <form onSubmit={start} noValidate>
        <label htmlFor={inputId} className={`mb-2 block text-sm font-medium ${onInk ? 'text-paper' : ''}`}>
          Your website
        </label>
        <div
          className={`flex flex-col gap-3 sm:flex-row sm:gap-0 sm:rounded-full sm:border sm:p-1.5 sm:transition-[border-color,box-shadow] ${
            onInk
              ? 'sm:border-paper/25 sm:bg-paper/[0.06] sm:focus-within:border-paper/60'
              : `sm:bg-surface sm:shadow-[0_18px_40px_-28px_rgba(23,20,15,0.45)] sm:focus-within:border-accent ${error ? 'sm:border-danger' : 'sm:border-ink/20'}`
          }`}
        >
          <input
            ref={inputRef}
            id={inputId}
            type="text"
            inputMode="url"
            autoComplete="url"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="yourbrand.com"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              if (error) setError(null);
            }}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? errorId : undefined}
            disabled={submitting}
            className={`min-h-12 w-full flex-1 rounded-full border bg-surface px-5 text-base text-ink placeholder:text-ink-mute sm:min-h-11 sm:border-transparent sm:focus-visible:!outline-offset-[-2px] ${
              onInk ? 'sm:bg-transparent sm:text-paper sm:placeholder:text-paper/60' : 'sm:bg-transparent'
            } ${error ? 'border-danger' : 'border-ink/25'}`}
          />
          <button
            type="submit"
            disabled={submitting}
            className={`group inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-full px-6 font-medium transition-[background-color,transform] active:scale-[0.98] disabled:opacity-60 sm:min-h-11 ${
              onInk ? 'bg-paper text-ink hover:bg-white' : 'bg-accent text-white hover:bg-accent-deep'
            }`}
          >
            {submitting ? 'Starting…' : 'Get a free ad'}
            {submitting ? null : <ArrowRight aria-hidden className="sx-btn-arrow h-4 w-4" />}
          </button>
        </div>
        {error ? (
          <p id={errorId} role="alert" className={`mt-2 text-sm ${onInk ? 'text-[#ffb4ab]' : 'text-danger'}`}>
            {error}
          </p>
        ) : null}
      </form>
      <p className={`mt-3 text-sm ${onInk ? 'text-paper/75' : 'text-ink-mute'}`}>
        Free: market research and 3 ad ideas for your brand. No signup or card needed.
      </p>
      <p className="mt-3">
        <Link
          href={SIGNUP_HREF}
          className={`sx-link text-[15px] font-medium ${onInk ? 'text-paper' : 'text-ink'}`}
        >
          or sign up and explore →
        </Link>
      </p>
    </div>
  );
}
