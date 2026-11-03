import React from 'react';
import { COMPARISON } from '@/lib/marketing/content';
import Reveal from './Reveal';
import { SectionHeading } from './ui';

export default function ComparisonSection() {
  const last = COMPARISON.columns.length - 1;
  return (
    <section id="compare" aria-labelledby="compare-title" className="sx-sheet bg-paper">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 md:py-32">
        <SectionHeading id="compare-title" index="05" eyebrow="Compare" title="SkalX vs. the usual options." />
        <Reveal variant="scale" className="mt-12 overflow-x-auto">
          <table className="w-full min-w-[340px] table-fixed border-collapse text-left text-[14px] sm:text-base">
            <caption className="sr-only">Freelancer, agency and SkalX compared</caption>
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
                      i === last ? 'rounded-t-[20px] bg-ink pt-5 font-display text-lg text-paper shadow-[0_-20px_40px_-30px_rgba(29,78,216,0.9)]' : 'text-ink-soft'
                    }`}
                  >
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COMPARISON.rows.map((row, r) => (
                <tr key={row.label} className="group border-t border-line transition-colors hover:bg-surface/70">
                  <th scope="row" className="py-5 pl-1 pr-2 align-top font-medium">
                    {row.label}
                  </th>
                  {row.values.map((v, i) => (
                    <td
                      key={i}
                      className={`px-2 py-5 align-top sm:px-4 ${
                        i === last
                          ? `bg-ink font-medium text-paper group-hover:bg-[#221d16] ${r === COMPARISON.rows.length - 1 ? 'rounded-b-[20px]' : ''}`
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
      </div>
    </section>
  );
}
