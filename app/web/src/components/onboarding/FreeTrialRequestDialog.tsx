'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/router';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/app/web/src/components/ui/dialog';
import colors from '@/lib/ui/colors';
import { FREE_TRIAL_CARD } from '@/lib/trial/validate';

/** Product exploration path — no credits or plan are granted by a trial request. */
const EXPLORE_PATH = '/try';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const empty = {
  fullName: '',
  email: '',
  companyName: '',
  websiteUrl: '',
  useCase: '',
};

const fieldBase: React.CSSProperties = {
  width: '100%',
  background: 'hsl(0 0% 8%)',
  color: colors.foreground,
  border: '1px solid rgba(255,255,255,0.14)',
  borderRadius: 12,
  padding: '0 14px',
  fontSize: 15,
  outline: 'none',
  transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
};

const fieldFocus: React.CSSProperties = {
  borderColor: 'hsl(213 100% 62% / 0.65)',
  boxShadow: '0 0 0 3px hsl(213 100% 55% / 0.18)',
};

/**
 * Request-only free trial form. Submission never starts checkout or grants access.
 */
export default function FreeTrialRequestDialog({ open, onOpenChange }: Props) {
  const router = useRouter();
  const [form, setForm] = useState(empty);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [doneMessage, setDoneMessage] = useState<string | null>(null);
  const [focused, setFocused] = useState<string | null>(null);

  const reset = () => {
    setForm(empty);
    setError(null);
    setDoneMessage(null);
    setSubmitting(false);
    setFocused(null);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const exploreProduct = () => {
    handleOpenChange(false);
    void router.push(EXPLORE_PATH);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/trial-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: form.fullName,
          email: form.email,
          companyName: form.companyName,
          websiteUrl: form.websiteUrl || undefined,
          useCase: form.useCase,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setError(data?.error || "We couldn't submit your request. Please try again.");
        setSubmitting(false);
        return;
      }
      setDoneMessage(
        typeof data.message === 'string'
          ? data.message
          : 'Thanks for your interest in SkalX! Your free trial request has been submitted. Our team will review your request and contact you through our official email with the next steps.'
      );
      setSubmitting(false);
    } catch {
      setError('Network error. Check your connection and try again.');
      setSubmitting(false);
    }
  };

  const fieldStyle = (id: string, multiline = false): React.CSSProperties => ({
    ...fieldBase,
    height: multiline ? undefined : 44,
    minHeight: multiline ? 112 : undefined,
    paddingTop: multiline ? 12 : undefined,
    paddingBottom: multiline ? 12 : undefined,
    resize: multiline ? 'vertical' : undefined,
    ...(focused === id ? fieldFocus : null),
    opacity: submitting ? 0.65 : 1,
  });

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: 13,
    fontWeight: 500,
    marginBottom: 8,
    color: colors.foreground,
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md sm:max-w-lg max-h-[90vh] overflow-y-auto p-0 gap-0 border-0">
        <style jsx>{`
          :global(.trial-request-field::placeholder) {
            color: hsl(0 0% 55%);
            opacity: 1;
          }
        `}</style>
        <div
          className="px-6 pt-6 pb-5 border-b"
          style={{ borderColor: 'rgba(255,255,255,0.08)' }}
        >
          <DialogHeader className="space-y-2 text-left">
            <DialogTitle className="text-xl">
              {doneMessage ? 'Request received' : 'Request Free Trial'}
            </DialogTitle>
            <DialogDescription className="text-sm leading-relaxed">
              {doneMessage
                ? 'You can explore SkalX now. Generating creatives still needs credits from a plan or purchase.'
                : `${FREE_TRIAL_CARD.supporting}. ${FREE_TRIAL_CARD.note}`}
            </DialogDescription>
          </DialogHeader>
        </div>

        {doneMessage ? (
          <div className="px-6 py-6 space-y-5">
            <p className="text-sm leading-relaxed" style={{ color: colors.mutedForeground }}>
              {doneMessage}
            </p>
            <p className="text-sm leading-relaxed" style={{ color: colors.mutedForeground }}>
              Your request does not unlock credits or paid features. Feel free to look around —
              we&apos;ll email you from info@skalxai.app after review.
            </p>
            <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-3 pt-1">
              <button
                type="button"
                onClick={() => handleOpenChange(false)}
                className="h-11 px-4 rounded-xl text-sm font-medium"
                style={{
                  background: 'transparent',
                  color: colors.mutedForeground,
                  border: '1px solid rgba(255,255,255,0.12)',
                }}
              >
                Stay on plans
              </button>
              <button
                type="button"
                onClick={exploreProduct}
                className="h-11 px-6 rounded-xl text-sm font-medium"
                style={{
                  background: colors.gradientPrimary,
                  color: colors.primaryForeground,
                  border: 'none',
                }}
              >
                Explore SkalX
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="px-6 py-5 space-y-4" noValidate>
            <div>
              <label htmlFor="trial-full-name" style={labelStyle}>
                Full name
              </label>
              <input
                id="trial-full-name"
                name="fullName"
                autoComplete="name"
                required
                value={form.fullName}
                onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
                onFocus={() => setFocused('fullName')}
                onBlur={() => setFocused(null)}
                disabled={submitting}
                className="trial-request-field"
                style={fieldStyle('fullName')}
              />
            </div>

            <div>
              <label htmlFor="trial-email" style={labelStyle}>
                Work email
              </label>
              <input
                id="trial-email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                onFocus={() => setFocused('email')}
                onBlur={() => setFocused(null)}
                disabled={submitting}
                className="trial-request-field"
                style={fieldStyle('email')}
              />
            </div>

            <div>
              <label htmlFor="trial-company" style={labelStyle}>
                Company or brand name
              </label>
              <input
                id="trial-company"
                name="companyName"
                autoComplete="organization"
                required
                value={form.companyName}
                onChange={(e) => setForm((f) => ({ ...f, companyName: e.target.value }))}
                onFocus={() => setFocused('company')}
                onBlur={() => setFocused(null)}
                disabled={submitting}
                className="trial-request-field"
                style={fieldStyle('company')}
              />
            </div>

            <div>
              <label htmlFor="trial-website" style={labelStyle}>
                Website{' '}
                <span style={{ color: colors.mutedForeground, fontWeight: 400 }}>(optional)</span>
              </label>
              <input
                id="trial-website"
                name="websiteUrl"
                type="text"
                inputMode="url"
                autoComplete="url"
                placeholder="yourbrand.com"
                value={form.websiteUrl}
                onChange={(e) => setForm((f) => ({ ...f, websiteUrl: e.target.value }))}
                onFocus={() => setFocused('website')}
                onBlur={() => setFocused(null)}
                disabled={submitting}
                className="trial-request-field"
                style={fieldStyle('website')}
              />
            </div>

            <div>
              <label htmlFor="trial-use-case" style={labelStyle}>
                Why do you want trial access?
              </label>
              <textarea
                id="trial-use-case"
                name="useCase"
                required
                rows={4}
                placeholder="Tell us briefly how you plan to use SkalX…"
                value={form.useCase}
                onChange={(e) => setForm((f) => ({ ...f, useCase: e.target.value }))}
                onFocus={() => setFocused('useCase')}
                onBlur={() => setFocused(null)}
                disabled={submitting}
                className="trial-request-field"
                style={fieldStyle('useCase', true)}
              />
            </div>

            {error && (
              <p role="alert" className="text-sm" style={{ color: colors.destructive }}>
                {error}
              </p>
            )}

            <div
              className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-3 pt-2"
            >
              <button
                type="button"
                onClick={() => handleOpenChange(false)}
                disabled={submitting}
                className="h-11 px-4 rounded-xl text-sm font-medium"
                style={{
                  background: 'transparent',
                  color: colors.mutedForeground,
                  border: '1px solid rgba(255,255,255,0.12)',
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="h-11 px-6 rounded-xl text-sm font-medium disabled:opacity-60"
                style={{
                  background: colors.gradientPrimary,
                  color: colors.primaryForeground,
                  border: 'none',
                }}
              >
                {submitting ? 'Submitting…' : 'Submit request'}
              </button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
