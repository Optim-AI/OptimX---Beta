'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, X } from 'lucide-react';
import { ANNOUNCEMENT } from '@/content/announcement';

const storageKey = (id: string) => `skalx_announcement_dismissed_${id}`;

/** Dismissible strip above the nav. Content and on/off live in content/announcement.ts. */
export default function AnnouncementBar() {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    try {
      if (window.localStorage.getItem(storageKey(ANNOUNCEMENT.id))) setHidden(true);
    } catch {
      /* storage unavailable: keep showing */
    }
  }, []);

  if (!ANNOUNCEMENT.enabled || hidden) return null;

  const dismiss = () => {
    setHidden(true);
    try {
      window.localStorage.setItem(storageKey(ANNOUNCEMENT.id), '1');
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="relative bg-ink text-paper">
      <div className="mx-auto max-w-6xl px-11 py-2.5 text-center text-[13px] leading-snug sm:text-sm">
        <span>{ANNOUNCEMENT.text}</span>{' '}
        <Link
          href={ANNOUNCEMENT.href}
          className="group inline-flex items-center gap-1 whitespace-nowrap font-semibold text-accent-on-ink underline decoration-accent-on-ink/40 underline-offset-4 hover:decoration-accent-on-ink"
        >
          {ANNOUNCEMENT.linkLabel}
          <ArrowRight aria-hidden className="sx-btn-arrow h-3.5 w-3.5" />
        </Link>
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss announcement"
        className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-paper/70 transition-colors hover:bg-paper/10 hover:text-paper"
      >
        <X className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}
