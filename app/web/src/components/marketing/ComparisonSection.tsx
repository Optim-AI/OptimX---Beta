import React from 'react';
import { ShieldCheck } from 'lucide-react';
import { COMPARISON, SPRINT } from '@/lib/marketing/content';
import Reveal from './Reveal';
import { SectionHeading } from './ui';

export function RiskReversal({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-start gap-4 rounded-2xl border border-accent/30 bg-accent-wash p-6 text-ink ${className}`}>
      <ShieldCheck aria-hidden className="mt-0.5 h-6 w-6 shrink-0 text-accent" />
      <p className="font-display text-xl leading-snug sm:text-2xl">{SPRINT.riskReversal}</p>
    </div>
  );
}

export default function ComparisonSection() {
  const last = COMPARISON.columns.length - 1;
  return (
    <section id="compare" aria-labelledby="compare-title">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 md:py-28">
        <SectionHeading id="compare-title" eyebrow="Compare" title="A sprint vs. the usual options." />
        <Reveal className="mt-10 overflow-x-auto">
          <table className="w-full min-w-[340px] table-fixed border-collapse text-left text-[14px] sm:text-base">
            <caption className="sr-only">Freelancer, agency and SkalX Sprint compared</caption>
            <colgroup>
              <col className="w-[28%]" />
              <col />
              <col />
              <col />
            </colgroup>
            <thead>
              <tr>
                <td />
                {COMPARISON.columns.map((c, i) => (
                  <th
                    key={c}
                    scope="col"
                    className={`px-2 pb-4 align-bottom font-semibold sm:px-4 ${
                      i === last ? 'rounded-t-2xl bg-ink pt-4 text-paper' : 'text-ink-soft'
                    }`}
                  >
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COMPARISON.rows.map((row, r) => (
                <tr key={row.label} className="border-t border-line">
                  <th scope="row" className="py-4 pr-2 align-top font-medium">
                    {row.label}
                  </th>
                  {row.values.map((v, i) => (
                    <td
                      key={i}
                      className={`px-2 py-4 align-top sm:px-4 ${
                        i === last
                          ? `bg-ink font-medium text-paper ${r === COMPARISON.rows.length - 1 ? 'rounded-b-2xl' : ''}`
                          : 'text-ink-soft'
                      }`}
                    >
                      {v}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </Reveal>
        <RiskReversal className="mt-10" />
      </div>
    </section>
  );
}
