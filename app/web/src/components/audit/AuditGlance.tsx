'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, ImageIcon } from 'lucide-react';
import { authFetch } from '@/lib/utils';
import { LINKS } from '@/content/site';
import type { PublicAudit } from '@/lib/audit/types';
import type { SampleAdState } from '@/lib/audit/sample-ad';

/**
 * The short version of a free audit: 3 findings, 3 angles to test and 1 sample ad,
 * then "Want the full pack?". The detailed audit follows below it on the page.
 */
export default function AuditGlance({ audit }: { audit: PublicAudit }) {
  const [sample, setSample] = useState<SampleAdState | null>(null);
  const started = useRef(false);

  // Ask for the sample ad once (the server generates it at most once per email lead).
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    let cancelled = false;
    setSample({ status: 'generating' });
    authFetch(`/api/audit/${audit.id}/sample-ad`, { method: 'POST' })
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setSample(d?.ok ? (d.sample as SampleAdState) : { status: 'failed' });
      })
      .catch(() => {
        if (!cancelled) setSample({ status: 'failed' });
      });
    return () => {
      cancelled = true;
    };
  }, [audit.id]);

  const findings = [
    ...(audit.insights?.opportunities ?? []).map((o) => ({ title: o.title, body: o.explanation })),
    ...(audit.insights?.themes ?? []).map((t) => ({ title: t.title, body: t.observation })),
  ].slice(0, 3);
  const angles = audit.ideas.slice(0, 3);
  const showSample = sample && sample.status !== 'none' && sample.status !== 'skipped';

  return (
    <section aria-labelledby="glance-title" className="ob-enter grid gap-4" style={{ '--d': '80ms' } as React.CSSProperties}>
      <h2 id="glance-title" className="sr-only">
        Your audit at a glance
      </h2>
      <div className={`grid gap-4 ${showSample ? 'lg:grid-cols-[1fr_1fr_minmax(0,0.8fr)]' : 'md:grid-cols-2'}`}>
        <div className="ob-glass rounded-[20px] p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent-on-ink">3 findings</p>
          <ol className="mt-3 space-y-3">
            {findings.length ? (
              findings.map((f, i) => (
                <li key={`${f.title}-${i}`} className="grid grid-cols-[1.25rem_1fr] gap-2">
                  <span className="font-display text-sm font-semibold text-accent-on-ink">{i + 1}</span>
                  <span>
                    <span className="block text-[15px] font-medium text-paper">{f.title}</span>
                    <span className="mt-0.5 block text-[13.5px] leading-snug text-paper/65">{f.body}</span>
                  </span>
                </li>
              ))
            ) : (
              <li className="text-sm text-paper/65">See the detailed findings below.</li>
            )}
          </ol>
        </div>
        <div className="ob-glass rounded-[20px] p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent-on-ink">3 angles to test</p>
          <ol className="mt-3 space-y-3">
            {angles.map((idea, i) => (
              <li key={`${idea.title}-${i}`} className="grid grid-cols-[1.25rem_1fr] gap-2">
                <span className="font-display text-sm font-semibold text-accent-on-ink">{i + 1}</span>
                <span>
                  <span className="block text-[15px] font-medium text-paper">{idea.title}</span>
                  <span className="mt-0.5 block text-[13.5px] leading-snug text-paper/65">“{idea.hook}”</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
        {showSample ? (
          <div className="ob-glass rounded-[20px] p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent-on-ink">1 sample ad</p>
            <div className="mt-3 overflow-hidden rounded-xl border border-paper/10 bg-paper/[0.04]">
              {sample.status === 'ready' ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={sample.url} alt={`Sample ad for ${audit.brand?.name || audit.host}: ${angles[0]?.title ?? ''}`} className="block aspect-[4/5] w-full object-cover" />
              ) : (
                <div className={`flex aspect-[4/5] flex-col items-center justify-center gap-2 p-4 text-center text-sm text-paper/65 ${sample.status === 'generating' ? 'ob-shimmer' : ''}`}>
                  <ImageIcon aria-hidden className="h-6 w-6 text-paper/40" />
                  {sample.status === 'generating' ? 'Making a sample ad from angle 1…' : "We couldn't make the sample ad this time."}
                </div>
              )}
            </div>
            {sample.status === 'ready' && angles[0] ? (
              <p className="mt-3 text-[13px] leading-snug text-paper/70">
                <span className="font-semibold text-accent-on-ink">Why this ad: </span>
                {angles[0].rationale}
              </p>
            ) : null}
            <p className="mt-2 text-[11.5px] text-paper/45">AI-generated sample concept. Your real ads use your own product photos.</p>
          </div>
        ) : null}
      </div>

      <div className="ob-glass flex flex-col gap-4 rounded-[20px] p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-display text-lg font-semibold text-paper">Want the full pack?</p>
          <p className="text-sm text-paper/65">Research, angles and ready-to-post ads for every idea.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={LINKS.startFree} className="ob-btn h-11 rounded-full px-5 text-sm font-semibold">
            Start free <ArrowRight aria-hidden className="h-4 w-4" />
          </Link>
          <Link
            href={LINKS.demo}
            className="inline-flex h-11 items-center rounded-full border border-paper/25 px-5 text-sm font-medium text-paper transition-colors hover:border-paper/50 hover:bg-paper/[0.06]"
          >
            Book a demo
          </Link>
        </div>
      </div>
    </section>
  );
}
