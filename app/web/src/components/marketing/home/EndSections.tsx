'use client';

import React, { useId, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Check } from 'lucide-react';
import {
  DONE_FOR_YOU,
  FAQS_BASE,
  FAQ_TITLE,
  FINAL_CTA,
  FOUNDER_FALLBACK,
  HOW_IT_WORKS,
  PLATFORMS,
  PRICING_TEASER,
} from '@/content/home';
import { PRICING_COPY, PRICING_PLANS } from '@/content/pricing';
import { LINKS } from '@/content/site';
import { permittedTestimonials } from '@/content/testimonials';
import { FOUNDER } from '@/lib/marketing/content';
import { PLAN_CARD_CAPABILITIES } from '@/lib/onboarding/plan-comparison';
import { FounderPhoto } from '../FounderNote';
import { DoneForYouView } from '../PricingModeToggle';
import Reveal from '../Reveal';
import { CTAButton } from '../kit/CTAButton';
import { FAQAccordion, type FAQItem } from '../kit/FAQAccordion';
import { PricingCard } from '../kit/PricingCard';
import { Section, SectionHeading } from '../kit/Section';
import { Toggle } from '../kit/Toggle';
import AuditForm from './AuditForm';

/** FAQ list with status-dependent answers filled in (Meta connection, CSV upload). */
export function getHomeFaqs(): FAQItem[] {
  return FAQS_BASE.map((f) => ({ q: f.q, a: f.a }));
}

/** Section 9: platforms the ads are sized for. Text labels only (no third-party logos). */
export function PlatformsSection() {
  return (
    <Section id="platforms" labelledBy="platforms-title" tone="paper">
      <SectionHeading id="platforms-title" eyebrow={PLATFORMS.eyebrow} title={PLATFORMS.title} sub={PLATFORMS.sub} />
      <ul className="mt-10 grid grid-cols-2 gap-3 md:grid-cols-3">
        {PLATFORMS.items.map((p) => (
          <li key={p.name} className="rounded-card border border-line bg-surface p-4 sm:p-5">
            <p className="text-[11.5px] font-medium uppercase tracking-[0.12em] text-ink-mute">{PLATFORMS.prefix}</p>
            <p className="mt-1 font-display text-[17px] font-semibold sm:text-lg">{p.name}</p>
            <p className="mt-0.5 text-sm text-ink-soft">{p.sizes}</p>
          </li>
        ))}
      </ul>
    </Section>
  );
}

/** Section 10: four numbered steps. */
export function HowItWorksSteps() {
  return (
    <Section id="how-it-works" labelledBy="how-title" tone="deep" className="sx-sheet">
      <SectionHeading id="how-title" eyebrow={HOW_IT_WORKS.eyebrow} title={HOW_IT_WORKS.title} />
      <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {HOW_IT_WORKS.steps.map((s, i) => (
          <Reveal as="li" key={s.title} delay={i * 90} className="rounded-card border border-line bg-surface p-6">
            <span className="sx-outline-num font-display text-5xl font-bold leading-none" style={{ transitionDelay: `${i * 90 + 200}ms` }}>
              {i + 1}
            </span>
            <h3 className="mt-4 font-display text-h3 font-semibold">{s.title}</h3>
            <p className="mt-1.5 text-[15px] text-ink-soft">{s.body}</p>
          </Reveal>
        ))}
      </ol>
    </Section>
  );
}

/** Section 11: Done-for-you Studio. */
export function DoneForYouSection() {
  return (
    <Section id="done-for-you" labelledBy="dfy-title" tone="ink" className="sx-sheet" innerClassName="grid items-center gap-10 lg:grid-cols-12">
      <div className="lg:col-span-7">
        <SectionHeading id="dfy-title" tone="ink" eyebrow={DONE_FOR_YOU.eyebrow} title={DONE_FOR_YOU.title} sub={DONE_FOR_YOU.sub} />
      </div>
      <div className="rounded-card border border-paper/15 bg-paper/[0.05] p-6 lg:col-span-5">
        <ul className="space-y-3">
          {DONE_FOR_YOU.bullets.map((b) => (
            <li key={b} className="flex gap-3 text-[16px]">
              <Check aria-hidden className="mt-1 h-4 w-4 shrink-0 text-accent-on-ink" />
              {b}
            </li>
          ))}
        </ul>
        <CTAButton href={LINKS.doneForYou} variant="onInk" arrow className="mt-6 w-full">
          {DONE_FOR_YOU.cta}
        </CTAButton>
      </div>
    </Section>
  );
}

/** Section 12: testimonials (permitted only); until then, a founder note with a call booking. */
export function TestimonialsSection() {
  const quotes = permittedTestimonials();
  if (quotes.length > 0) {
    return (
      <Section id="testimonials" labelledBy="testimonials-title" tone="paper">
        <h2 id="testimonials-title" className="font-display text-h2 font-semibold">
          What founders say
        </h2>
        <ul className="mt-10 grid gap-5 md:grid-cols-2">
          {quotes.map((t) => (
            <li key={t.name} className="rounded-card border border-line bg-surface p-6">
              <blockquote className="font-display text-xl leading-snug">“{t.quote}”</blockquote>
              <p className="mt-4 text-sm text-ink-soft">
                {t.name}, {t.role} · {t.company}
              </p>
            </li>
          ))}
        </ul>
      </Section>
    );
  }
  return (
    <Section id="founder" labelledBy="founder-title" tone="paper">
      <div className="grid items-start gap-8 rounded-panel border border-line bg-surface p-6 sm:p-8 md:grid-cols-[clamp(160px,18vw,220px)_minmax(0,1fr)] md:items-stretch md:gap-10">
        <FounderPhoto className="w-40 sm:w-48 md:aspect-auto md:h-full md:w-full" />
        <div className="min-w-0">
          <h2 id="founder-title" className="text-[12.5px] font-semibold uppercase tracking-[0.18em] text-accent">
            {FOUNDER_FALLBACK.eyebrow}
          </h2>
          <blockquote className="mt-4 text-balance font-display text-[clamp(1.25rem,2.4vw,1.75rem)] font-medium leading-[1.35] tracking-[-0.015em]">
            <p>{FOUNDER.note}</p>
          </blockquote>
          <p className="mt-4 font-medium">— {FOUNDER.name}, Founder</p>
          <CTAButton href={LINKS.demo} variant="secondary" size="md" arrow className="mt-6">
            {FOUNDER_FALLBACK.cta}
          </CTAButton>
        </div>
      </div>
    </Section>
  );
}

/** Section 13: pricing teaser with a Self-serve | Done-for-you toggle. */
export function PricingTeaserSection() {
  const [mode, setMode] = useState<'self' | 'dfy'>('self');
  const panelId = `${useId()}-pricing`;
  return (
    <Section id="pricing" labelledBy="pricing-title" tone="deep" className="sx-sheet">
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <SectionHeading id="pricing-title" eyebrow={PRICING_TEASER.eyebrow} title={PRICING_TEASER.title} />
        <Toggle<'self' | 'dfy'>
          label="Choose how you want to work"
          panelId={panelId}
          value={mode}
          onChange={setMode}
          options={[
            { id: 'self', label: PRICING_TEASER.toggle.selfServe },
            { id: 'dfy', label: PRICING_TEASER.toggle.doneForYou },
          ]}
        />
      </div>
      <div id={panelId} role="tabpanel" className="mt-10">
        {mode === 'self' ? (
          <>
            <ul className="grid gap-5 md:grid-cols-3">
              {PRICING_PLANS.map((p) => (
                <li key={p.id}>
                  <PricingCard plan={p} ctaHref={LINKS.pricing} features={PLAN_CARD_CAPABILITIES} />
                </li>
              ))}
            </ul>
            <div className="mt-5 flex flex-col items-start justify-between gap-4 rounded-card border border-line bg-surface p-5 sm:flex-row sm:items-center">
              <div>
                <p className="font-display text-lg font-semibold">{PRICING_COPY.customPlan.title}</p>
                <p className="text-[15px] text-ink-soft">{PRICING_COPY.customPlan.body}</p>
              </div>
              <CTAButton href={LINKS.contact} variant="secondary" size="md">
                {PRICING_COPY.customPlan.cta}
              </CTAButton>
            </div>
            <p className="mt-4 text-sm text-ink-soft">{PRICING_COPY.gstNote}</p>
          </>
        ) : (
          <DoneForYouView headingLevel="h3" />
        )}
      </div>
      <Link href={LINKS.pricing} className="group mt-6 inline-flex items-center gap-1.5 font-medium text-ink">
        <span className="sx-link">{PRICING_TEASER.seeAll}</span>
        <ArrowRight aria-hidden className="sx-btn-arrow h-4 w-4" />
      </Link>
    </Section>
  );
}

/** Section 14: FAQ (structured data is added by the page). */
export function FaqBlock() {
  return (
    <Section id="faq" labelledBy="faq-title" tone="paper" innerClassName="grid gap-10 md:grid-cols-12">
      <div className="md:col-span-4">
        <div className="md:sticky md:top-28">
          <SectionHeading id="faq-title" eyebrow={FAQ_TITLE.eyebrow} title={FAQ_TITLE.title} />
        </div>
      </div>
      <FAQAccordion items={getHomeFaqs()} className="md:col-span-8" />
    </Section>
  );
}

/** Section 15: final call to action, with the audit form. */
export function FinalCtaBand() {
  return (
    <section id="get-started" aria-labelledby="final-cta-title" className="sx-sheet relative isolate scroll-mt-24 overflow-hidden bg-ink text-paper">
      <div aria-hidden className="sx-glow pointer-events-none absolute inset-0 -z-10" />
      <div className="mx-auto grid max-w-6xl items-end gap-10 px-4 py-20 sm:px-6 md:grid-cols-12 md:py-28">
        <div className="md:col-span-6">
          <h2 id="final-cta-title" className="text-balance font-display text-h2 font-semibold">
            {FINAL_CTA.title}
          </h2>
          <CTAButton href={LINKS.demo} variant="ghostOnInk" className="mt-8">
            {FINAL_CTA.secondary}
          </CTAButton>
        </div>
        <div className="rounded-card border border-paper/15 bg-paper/[0.04] p-5 sm:p-7 md:col-span-6">
          <p className="mb-3 font-display text-[17px] font-semibold">{FINAL_CTA.primary}</p>
          <AuditForm idPrefix="final-audit" tone="ink" focusOnHash="get-started" />
        </div>
      </div>
    </section>
  );
}
