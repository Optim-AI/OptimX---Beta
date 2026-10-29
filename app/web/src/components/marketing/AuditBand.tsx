'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/router';
import { authFetch } from '@/lib/utils';
import { trackAuditEvent } from '@/lib/audit/analytics';

/**
 * Secondary door-opener: the existing free marketing audit.
 * Same request/response handling as the former hero form (POST /api/audit → /audit/:id).
 */
export default function AuditBand() {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startAudit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    const trimmed = url.trim();
    if (!trimmed) {
      setError('Enter your website address to get your audit.');
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
                : "We couldn't start your audit. Please try again.");
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

  return (
    <section id="audit" aria-labelledby="audit-title" className="border-y border-line bg-paper-deep">
      <div className="mx-auto grid max-w-6xl items-center gap-8 px-4 py-14 sm:px-6 md:grid-cols-12">
        <div className="md:col-span-5">
          <h2 id="audit-title" className="font-display text-2xl font-medium leading-tight sm:text-3xl">
            Not ready? Get a free marketing audit of your website.
          </h2>
          <p className="mt-2 text-ink-soft">See what competitors post and what to make next. No signup or card needed.</p>
        </div>
        <form onSubmit={startAudit} noValidate className="md:col-span-6 md:col-start-7">
          <label htmlFor="hero-brand-input" className="mb-2 block text-sm font-medium">
            Your website
          </label>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              id="hero-brand-input"
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
              aria-describedby={error ? 'audit-error' : undefined}
              disabled={submitting}
              className={`min-h-12 w-full flex-1 rounded-full border bg-surface px-5 text-base text-ink placeholder:text-ink-mute ${
                error ? 'border-danger' : 'border-ink/25'
              }`}
            />
            <button
              type="submit"
              disabled={submitting}
              className="min-h-12 shrink-0 rounded-full bg-ink px-6 font-medium text-paper hover:bg-accent-deep disabled:opacity-60"
            >
              {submitting ? 'Starting your audit…' : 'Get my free audit'}
            </button>
          </div>
          {error ? (
            <p id="audit-error" role="alert" className="mt-2 text-sm text-danger">
              {error}
            </p>
          ) : null}
        </form>
      </div>
    </section>
  );
}
