import React from 'react';
import { BarChart3, Lightbulb, Plug, ShieldCheck, TrendingUp } from 'lucide-react';
import { AD_ANALYTICS } from '@/content/home';
import { LINKS } from '@/content/site';
import { CTAButton } from '../kit/CTAButton';
import { PlatformLogos } from '../kit/PlatformLogos';
import { Section, SectionHeading } from '../kit/Section';

/** Example dashboard numbers (fictional brand). Labelled "Example data" on screen. */
const KPIS = [
  { label: 'Spend', value: '₹2,40,000' },
  { label: 'Revenue', value: '₹8,64,000' },
  { label: 'ROAS', value: '3.6×', up: '+0.8×' },
  { label: 'ROI', value: '260%', up: '+34%' },
];
const ADS = [
  { name: 'Before / after, humid day', platform: 'Instagram Reels', roas: '5.2×', call: 'Scale', tone: 'bg-[#7ee2a8]/15 text-[#7ee2a8]' },
  { name: 'Founder story, 30s', platform: 'Google · YouTube', roas: '3.1×', call: 'Hold', tone: 'bg-white/10 text-white/80' },
  { name: '20% off, static', platform: 'Facebook Feed', roas: '0.9×', call: 'Pause', tone: 'bg-[#ffb08a]/15 text-[#ffb08a]' },
];
const BARS = [38, 44, 41, 52, 49, 58, 63, 60, 71, 68, 76, 82];

function DashboardMockup() {
  return (
    <div className="overflow-hidden rounded-panel border border-paper/10 bg-[#141414] shadow-frame">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-paper/10 px-4 py-3 sm:px-5">
        <span className="inline-flex items-center gap-2 text-[13px] font-medium text-paper">
          <BarChart3 aria-hidden className="h-4 w-4 text-accent-on-ink" /> All ad accounts · Last 30 days
        </span>
        <span className="rounded-full border border-paper/15 px-2 py-0.5 text-[11px] text-paper/55">Example data</span>
      </div>
      <div className="p-4 sm:p-5">
        <dl className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {KPIS.map((k) => (
            <div key={k.label} className="rounded-2xl border border-paper/10 bg-paper/[0.04] px-3.5 py-3">
              <dt className="text-[11.5px] text-paper/55">{k.label}</dt>
              <dd className="mt-1 flex items-baseline gap-1.5">
                <span className="font-display text-[19px] font-semibold text-paper sm:text-[21px]">{k.value}</span>
                {k.up ? <span className="text-[11px] font-medium text-[#7ee2a8]">{k.up}</span> : null}
              </dd>
            </div>
          ))}
        </dl>

        <div aria-hidden className="mt-4 flex h-20 items-end gap-1.5 rounded-2xl border border-paper/10 bg-paper/[0.03] px-3 pb-2 pt-3">
          {BARS.map((h, i) => (
            <span key={i} className="flex-1 rounded-t bg-accent-on-ink/70" style={{ height: `${h}%` }} />
          ))}
        </div>

        <table className="mt-4 w-full text-left text-[13px]">
          <caption className="sr-only">Example ads with ROAS and the suggested next step</caption>
          <thead>
            <tr className="text-[11px] uppercase tracking-[0.12em] text-paper/45">
              <th scope="col" className="pb-2 font-medium">Ad</th>
              <th scope="col" className="pb-2 font-medium">ROAS</th>
              <th scope="col" className="pb-2 text-right font-medium">Next step</th>
            </tr>
          </thead>
          <tbody>
            {ADS.map((a) => (
              <tr key={a.name} className="border-t border-paper/10">
                <td className="py-2.5 pr-2">
                  <span className="block text-paper">{a.name}</span>
                  <span className="block text-[11.5px] text-paper/50">{a.platform}</span>
                </td>
                <td className="py-2.5 font-medium text-paper">{a.roas}</td>
                <td className="py-2.5 text-right">
                  <span className={`rounded-full px-2.5 py-1 text-[11.5px] font-semibold ${a.tone}`}>{a.call}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <p className="mt-4 flex gap-2.5 rounded-2xl border border-accent-on-ink/30 bg-accent-on-ink/[0.08] px-3.5 py-3 text-[13px] leading-snug text-paper/85">
          <Lightbulb aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-accent-on-ink" />
          <span>
            <strong className="text-paper">Before/after Reels: 5.2×.</strong> Discount ads: 0.9×. Make 3 more like the winner.
          </span>
        </p>
      </div>
    </div>
  );
}

/** Ad performance analytics: connect ad accounts, see ROAS/ROI and what to do next. Light on words. */
export default function AdAnalyticsSection() {
  const icons = [Plug, BarChart3, TrendingUp];
  return (
    <Section id="ad-analytics" labelledBy="ad-analytics-title" tone="ink" className="sx-sheet" innerClassName="grid items-center gap-12 lg:grid-cols-12">
      <div className="lg:col-span-5">
        <SectionHeading id="ad-analytics-title" tone="ink" eyebrow={AD_ANALYTICS.eyebrow} title={AD_ANALYTICS.title} sub={AD_ANALYTICS.sub} />
        <PlatformLogos className="mt-8 text-paper/80" />
        <ol className="mt-10 flex flex-wrap items-center gap-x-2 gap-y-3 text-[14px] text-paper/85">
          {AD_ANALYTICS.steps.map((label, i) => {
            const Icon = icons[i];
            return (
              <li key={label} className="flex items-center gap-2">
                {i > 0 ? <span aria-hidden className="h-px w-3 bg-paper/25 sm:w-6" /> : null}
                <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                  <Icon aria-hidden className="h-4 w-4 text-accent-on-ink" />
                  {label}
                </span>
              </li>
            );
          })}
        </ol>
        <div className="mt-10 flex flex-col items-start gap-3">
          <CTAButton href={LINKS.startFree} arrow>
            {AD_ANALYTICS.cta}
          </CTAButton>
          <p className="inline-flex items-center gap-1.5 text-[13px] text-paper/55">
            <ShieldCheck aria-hidden className="h-3.5 w-3.5" /> {AD_ANALYTICS.readOnly}
          </p>
        </div>
      </div>
      <div className="lg:col-span-7">
        <DashboardMockup />
      </div>
    </Section>
  );
}
