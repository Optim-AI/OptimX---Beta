import React from 'react';
import { Layers, Repeat, Shuffle } from 'lucide-react';
import { PROBLEM } from '@/content/home';
import Reveal from '../Reveal';
import { Section, SectionHeading } from '../kit/Section';

const ICONS = [Shuffle, Repeat, Layers];

/** Section 2a: the business problem, three pain cards and a fair comparison table. */
export default function ProblemBlock() {
  const last = PROBLEM.table.columns.length - 1;
  return (
    <Section id="problem" labelledBy="problem-title" tone="paper">
      <SectionHeading id="problem-title" eyebrow={PROBLEM.eyebrow} title={PROBLEM.title} sub={PROBLEM.sub} />
      <ul className="mt-10 grid gap-4 md:grid-cols-3">
        {PROBLEM.cards.map((c, i) => {
          const Icon = ICONS[i];
          return (
            <Reveal as="li" key={c.title} delay={i * 90} className="rounded-card border border-line bg-surface p-6">
              <Icon aria-hidden className="h-5 w-5 text-danger" />
              <h3 className="mt-4 font-display text-h3 font-semibold">{c.title}</h3>
              <p className="mt-2 text-ink-soft">{c.body}</p>
            </Reveal>
          );
        })}
      </ul>

      <Reveal className="mt-12 overflow-x-auto">
        <table className="w-full min-w-[560px] table-fixed border-collapse text-left text-[14px] sm:text-[15px]">
          <caption className="sr-only">{PROBLEM.table.caption}</caption>
          <colgroup>
            <col className="w-[24%]" />
            <col />
            <col />
            <col className="w-[30%]" />
          </colgroup>
          <thead>
            <tr>
              <td />
              {PROBLEM.table.columns.map((c, i) => (
                <th
                  key={c}
                  scope="col"
                  className={`px-3 pb-3 align-bottom font-semibold ${i === last ? 'rounded-t-card bg-ink pt-4 font-display text-paper' : 'text-ink-soft'}`}
                >
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PROBLEM.table.rows.map((row, r) => (
              <tr key={row.label} className="border-t border-line">
                <th scope="row" className="py-4 pr-3 align-top font-medium">
                  {row.label}
                </th>
                {row.values.map((v, i) => (
                  <td
                    key={i}
                    className={`px-3 py-4 align-top ${
                      i === last ? `bg-ink font-medium text-paper ${r === PROBLEM.table.rows.length - 1 ? 'rounded-b-card' : ''}` : 'text-ink-soft'
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
    </Section>
  );
}
