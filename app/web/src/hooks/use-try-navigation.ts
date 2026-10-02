'use client';

import { useCallback, useState, type FormEvent } from 'react';
import { useRouter } from 'next/router';
import { classifyHeroInput } from '@/lib/onboarding/entry-input';

/**
 * Shared landing → /try navigation used by Hero and Final CTA.
 * Preserves URL / brand / empty entry behaviour.
 */
export function useTryNavigation() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [inputError, setInputError] = useState<string | null>(null);

  const goToTry = useCallback(
    (rawInput: string, e?: FormEvent) => {
      e?.preventDefault();
      if (submitting) return;
      const classified = classifyHeroInput(rawInput);
      if (!classified.ok) {
        setInputError(classified.error);
        return;
      }
      setInputError(null);
      setSubmitting(true);
      if (classified.entry.kind === 'website') {
        router.push(`/try?website=${encodeURIComponent(classified.entry.url)}`);
        return;
      }
      if (classified.entry.kind === 'brand') {
        router.push(`/try?brand=${encodeURIComponent(classified.entry.name)}`);
        return;
      }
      router.push('/try');
    },
    [router, submitting]
  );

  const clearError = useCallback(() => setInputError(null), []);

  return { goToTry, submitting, inputError, clearError, setInputError };
}
