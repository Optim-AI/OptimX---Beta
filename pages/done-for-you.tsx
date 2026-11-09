import React from 'react';
import Image from 'next/image';
import { Check, Minus } from 'lucide-react';
import PageSeo from '@/components/seo/PageSeo';
import { DFY_PAGE } from '@/content/pages';
import { SHOWCASE_ITEMS } from '@/content/showcase';
import MarketingLayout from '@/app/web/src/components/marketing/MarketingLayout';
import DoneForYouForm from '@/app/web/src/components/marketing/DoneForYouForm';
import Reveal from '@/app/web/src/components/marketing/Reveal';
import { Section, SectionHeading } from '@/app/web/src/components/marketing/kit/Section';
import { Eyebrow } from '@/app/web/src/components/marketing/ui';

export default function DoneForYouPage() {
  return (
    <MarketingLayout>
      <PageSeo
        title={DFY_PAGE.seoTitle}
        description={DFY_PAGE.seoDescription}
        path="/done-for-you"
        jsonLd={{
          '@type': 'Service',
          name: 'SkalX Done-for-you Studio',
          provider: { '@type': 'Organization', name: 'SkalX' },
          areaServed: 'IN',
          description: DFY_PAGE.seoDescription,
        }}
      />
      <section aria-labelledby="dfy-title" className="relative isolate">
        <div aria-hidden className="sx-grid-bg pointer-events-none absolute inset-0 -z-10" />
        <div className="mx-auto max-w-6xl px-4 pb-16 pt-10 sm:px-6 md:pb-20 md:pt-16">
          <Eyebrow>{DFY_PAGE.eyebrow}</Eyebrow>
          <h1 id="dfy-title" className="max-w-4xl font-display text-display font-semibold">
            {DFY_PAGE.title}
          </h1>
          <p className="mt-5 max-w-2xl text-lead text-ink-soft">{DFY_PAGE.sub}</p>
          <a href="#talk" className="mt-8 inline-flex min-h-12 items-center rounded-full bg-accent px-6 font-medium text-white hover:bg-accent-deep">
            {DFY_PAGE.formTitle}
          </a>
        </div>
      </section>

      <Section labelledBy="dfy-process" tone="deep" className="sx-sheet">
        <SectionHeading id="dfy-process" title={DFY_PAGE.processTitle} />
        <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {DFY_PAGE.process.map((s, i) => (
            <Reveal as="li" key={s.title} delay={i * 80} className="rounded-card border border-line bg-surface p-5">
              <span className="font-display text-sm font-semibold text-accent">0{i + 1}</span>
              <h3 className="mt-2 font-display text-lg font-semibold">{s.title}</h3>
              <p className="mt-1.5 text-[15px] text-ink-soft">{s.body}</p>
            </Reveal>
          ))}
        </ol>
      </Section>

      <Section labelledBy="dfy-deliverables" tone="paper" innerClassName="grid gap-10 md:grid-cols-2">
        <div>
          <SectionHeading id="dfy-deliverables" title={DFY_PAGE.deliverablesTitle} />
          <ul className="mt-6 space-y-3">
            {DFY_PAGE.deliverables.map((d) => (
              <li key={d} className="flex gap-3 text-[16px]">
                <Check aria-hidden className="mt-1 h-4 w-4 shrink-0 text-accent" />
                {d}
              </li>
            ))}
          </ul>
          <p className="mt-6 text-ink-soft">{DFY_PAGE.pricingNote}</p>
        </div>
        <div className="rounded-card border border-line bg-surface p-6">
          <h3 className="font-display text-h3 font-semibold">{DFY_PAGE.notIncludedTitle}</h3>
          <ul className="mt-4 space-y-3 text-ink-soft">
            {DFY_PAGE.notIncluded.map((n) => (
              <li key={n} className="flex gap-3">
                <Minus aria-hidden className="mt-1 h-4 w-4 shrink-0 text-ink-mute" />
                {n}
              </li>
            ))}
          </ul>
        </div>
      </Section>

      <Section labelledBy="dfy-samples" tone="surface">
        <SectionHeading id="dfy-samples" title={DFY_PAGE.samplesTitle} />
        <ul className="mt-8 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
          {SHOWCASE_ITEMS.map((s) => (
            <li key={s.id}>
              <div className={`relative overflow-hidden rounded-card shadow-card ${s.aspect === '4/5' ? 'aspect-[4/5]' : s.aspect === '1/1' ? 'aspect-square' : 'aspect-[9/16]'}`}>
                <Image src={s.image} alt={s.alt} fill sizes="(max-width: 768px) 50vw, 280px" className="object-cover" loading="lazy" />
              </div>
              <p className="mt-2 text-[13px] text-ink-mute">
                {s.format} · {s.brand}
              </p>
            </li>
          ))}
        </ul>
        <p className="mt-6 text-sm text-ink-mute">{DFY_PAGE.samplesNote}</p>
      </Section>

      <Section id="talk" labelledBy="dfy-form" tone="deep" className="sx-sheet" width="narrow">
        <SectionHeading id="dfy-form" title={DFY_PAGE.formTitle} />
        <div className="mt-8 rounded-card border border-line bg-surface p-5 sm:p-8">
          <DoneForYouForm />
        </div>
      </Section>
    </MarketingLayout>
  );
}
