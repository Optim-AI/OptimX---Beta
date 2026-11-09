import React from 'react';
import type { GetStaticPaths, GetStaticProps } from 'next';
import { Check } from 'lucide-react';
import PageSeo from '@/components/seo/PageSeo';
import { SOLUTIONS, type SolutionPage } from '@/content/pages';
import { LINKS } from '@/content/site';
import MarketingLayout from '@/app/web/src/components/marketing/MarketingLayout';
import Reveal from '@/app/web/src/components/marketing/Reveal';
import { CTAButton } from '@/app/web/src/components/marketing/kit/CTAButton';
import { Section, SectionHeading } from '@/app/web/src/components/marketing/kit/Section';
import { Eyebrow } from '@/app/web/src/components/marketing/ui';
import ThinkingStages from '@/app/web/src/components/marketing/home/ThinkingStages';
import Showcase from '@/app/web/src/components/marketing/home/Showcase';

type Props = { slug: SolutionPage['slug'] };

/** /solutions/d2c and /solutions/agencies: shared sections, page-specific copy from content/pages.ts. */
export default function SolutionPageView({ slug }: Props) {
  const page = SOLUTIONS[slug];
  return (
    <MarketingLayout>
      <PageSeo title={page.seoTitle} description={page.seoDescription} path={`/solutions/${slug}`} />
      <section aria-labelledby="solution-title" className="relative isolate">
        <div aria-hidden className="sx-grid-bg pointer-events-none absolute inset-0 -z-10" />
        <div className="mx-auto max-w-6xl px-4 pb-16 pt-10 sm:px-6 md:pb-20 md:pt-16">
          <Eyebrow>{page.eyebrow}</Eyebrow>
          <h1 id="solution-title" className="max-w-4xl font-display text-display font-semibold">
            {page.title}
          </h1>
          <p className="mt-5 max-w-2xl text-lead text-ink-soft">{page.sub}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <CTAButton href={LINKS.freeAudit} arrow>
              Get your free brand audit
            </CTAButton>
            <CTAButton href={LINKS.demo} variant="secondary">
              Book a demo
            </CTAButton>
          </div>
        </div>
      </section>

      <Section labelledBy="solution-problems" tone="paper">
        <SectionHeading id="solution-problems" title={page.problemsTitle} />
        <ul className="mt-10 grid gap-4 md:grid-cols-3">
          {page.problems.map((p, i) => (
            <Reveal as="li" key={p.title} delay={i * 90} className="rounded-card border border-line bg-surface p-6">
              <h3 className="font-display text-h3 font-semibold">{p.title}</h3>
              <p className="mt-2 text-ink-soft">{p.body}</p>
            </Reveal>
          ))}
        </ul>
      </Section>

      <ThinkingStages />

      <Section labelledBy="solution-how" tone="paper">
        <SectionHeading id="solution-how" title={page.howTitle} />
        <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {page.how.map((h) => (
            <li key={h.title} className="rounded-card border border-line bg-surface p-5">
              <h3 className="font-display text-lg font-semibold">{h.title}</h3>
              <p className="mt-1.5 text-[15px] text-ink-soft">{h.body}</p>
            </li>
          ))}
        </ul>
      </Section>

      <Showcase />

      <Section labelledBy="solution-fit" tone="ink" className="sx-sheet" innerClassName="grid items-center gap-10 md:grid-cols-2">
        <div>
          <SectionHeading id="solution-fit" tone="ink" title={page.fitTitle} />
          <ul className="mt-6 space-y-3">
            {page.fit.map((f) => (
              <li key={f} className="flex gap-3">
                <Check aria-hidden className="mt-1 h-4 w-4 shrink-0 text-accent-on-ink" />
                {f}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-card border border-paper/15 bg-paper/[0.05] p-6">
          <p className="font-display text-h3 font-semibold">{page.ctaTitle}</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <CTAButton href={LINKS.freeAudit} variant="onInk" arrow>
              Get your free brand audit
            </CTAButton>
            <CTAButton href={LINKS.demo} variant="ghostOnInk">
              Book a demo
            </CTAButton>
          </div>
        </div>
      </Section>
    </MarketingLayout>
  );
}

export const getStaticPaths: GetStaticPaths = async () => ({
  paths: Object.keys(SOLUTIONS).map((slug) => ({ params: { slug } })),
  fallback: false,
});

export const getStaticProps: GetStaticProps<Props> = async ({ params }) => {
  const slug = String(params?.slug) as SolutionPage['slug'];
  if (!SOLUTIONS[slug]) return { notFound: true };
  return { props: { slug } };
};
