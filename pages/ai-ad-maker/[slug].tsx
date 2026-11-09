import React from 'react';
import type { GetStaticPaths, GetStaticProps } from 'next';
import Link from 'next/link';
import { ArrowRight, Sparkles } from 'lucide-react';
import PageSeo from '@/components/seo/PageSeo';
import { SITE_ORIGIN, absoluteUrl } from '@/lib/seo/site';
import { USE_CASES, getUseCase, type UseCase } from '@/content/use-cases';
import { LINKS } from '@/content/site';
import MarketingLayout from '@/app/web/src/components/marketing/MarketingLayout';
import { CTAButton } from '@/app/web/src/components/marketing/kit/CTAButton';
import { FAQAccordion, faqJsonLd } from '@/app/web/src/components/marketing/kit/FAQAccordion';
import { Section, SectionHeading } from '@/app/web/src/components/marketing/kit/Section';
import { Eyebrow } from '@/app/web/src/components/marketing/ui';
import AuditForm from '@/app/web/src/components/marketing/home/AuditForm';

type Props = { slug: string };

/** /ai-ad-maker/[slug]: one template, unique copy per page from content/use-cases.ts. */
export default function UseCasePage({ slug }: Props) {
  const u = getUseCase(slug) as UseCase;
  const others = USE_CASES.filter((o) => o.slug !== slug);
  const path = `/ai-ad-maker/${slug}`;
  return (
    <MarketingLayout>
      <PageSeo
        title={u.seoTitle}
        description={u.seoDescription}
        path={path}
        ogImage={`${SITE_ORIGIN}/og?title=${encodeURIComponent(u.title)}&eyebrow=${encodeURIComponent(u.eyebrow)}`}
        jsonLd={[
          {
            '@type': 'WebPage',
            '@id': `${absoluteUrl(path)}#webpage`,
            url: absoluteUrl(path),
            name: u.seoTitle,
            description: u.seoDescription,
            isPartOf: { '@id': `${SITE_ORIGIN}/#website` },
            inLanguage: 'en',
          },
          faqJsonLd(u.faqs),
        ]}
      />

      <section aria-labelledby="uc-title" className="relative isolate">
        <div aria-hidden className="sx-grid-bg pointer-events-none absolute inset-0 -z-10" />
        <div className="mx-auto grid max-w-6xl items-start gap-10 px-4 pb-16 pt-10 sm:px-6 md:pb-20 md:pt-16 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <Eyebrow>{u.eyebrow}</Eyebrow>
            <h1 id="uc-title" className="font-display text-[clamp(2.25rem,5vw,4rem)] font-semibold leading-[1.02] tracking-[-0.035em]">
              {u.title}
            </h1>
            <div className="mt-6 space-y-4 text-lead text-ink-soft">
              {u.intro.map((p) => (
                <p key={p.slice(0, 24)}>{p}</p>
              ))}
            </div>
          </div>
          <div className="rounded-card border border-line bg-surface p-5 shadow-card lg:sticky lg:top-28 lg:col-span-5">
            <p className="mb-3 font-display text-[17px] font-semibold">Get your free brand audit</p>
            <AuditForm idPrefix={`uc-${slug}`} />
          </div>
        </div>
      </section>

      <Section labelledBy="uc-research" tone="deep" className="sx-sheet">
        <SectionHeading id="uc-research" title={u.researchTitle} />
        <ul className="mt-10 grid gap-4 sm:grid-cols-2">
          {u.research.map((r) => (
            <li key={r.title} className="rounded-card border border-line bg-surface p-5">
              <h3 className="font-display text-lg font-semibold">{r.title}</h3>
              <p className="mt-1.5 text-[15px] text-ink-soft">{r.body}</p>
            </li>
          ))}
        </ul>
      </Section>

      <Section labelledBy="uc-angles" tone="paper">
        <SectionHeading id="uc-angles" title={u.anglesTitle} sub="Illustrations of how a finding becomes an ad. Your audit finds your own." />
        <ul className="mt-10 grid gap-4 md:grid-cols-3">
          {u.angles.map((a) => (
            <li key={a.headline} className="flex flex-col rounded-card border border-line bg-surface p-5">
              <span className="self-start rounded-full border border-ink/15 bg-paper px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-ink-mute">
                Example · {a.format}
              </span>
              <p className="mt-4 font-display text-xl font-semibold leading-snug tracking-[-0.015em]">“{a.headline}”</p>
              <div className="mt-4 border-t border-line pt-4 text-[14px]">
                <p className="flex items-center gap-1.5 text-[11.5px] font-semibold uppercase tracking-[0.12em] text-accent">
                  <Sparkles aria-hidden className="h-3.5 w-3.5" /> Why this ad
                </p>
                <p className="mt-1.5 text-ink-soft">
                  <strong className="text-ink">Finding:</strong> {a.finding}
                </p>
                <p className="mt-1 text-ink-soft">
                  <strong className="text-ink">Angle:</strong> {a.angle}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </Section>

      <Section labelledBy="uc-steps" tone="surface">
        <SectionHeading id="uc-steps" title={u.stepsTitle} />
        <ol className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {u.steps.map((s, i) => (
            <li key={s} className="rounded-card border border-line bg-paper p-5">
              <span className="font-display text-sm font-semibold text-accent">0{i + 1}</span>
              <p className="mt-2 text-[15px]">{s}</p>
            </li>
          ))}
        </ol>
        <p className="mt-10 max-w-3xl font-display text-[clamp(1.2rem,2.2vw,1.6rem)] font-semibold leading-snug tracking-[-0.015em]">{u.closing}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <CTAButton href={LINKS.startFree} arrow>
            Start free
          </CTAButton>
          <CTAButton href={LINKS.demo} variant="secondary">
            Book a demo
          </CTAButton>
        </div>
      </Section>

      <Section labelledBy="uc-faq" tone="paper" innerClassName="grid gap-10 md:grid-cols-12">
        <div className="md:col-span-4">
          <SectionHeading id="uc-faq" title="Questions" />
        </div>
        <FAQAccordion items={u.faqs} className="md:col-span-8" />
      </Section>

      <Section labelledBy="uc-more" tone="deep" className="sx-sheet">
        <h2 id="uc-more" className="font-display text-h3 font-semibold">
          More ways to use SkalX
        </h2>
        <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {others.map((o) => (
            <li key={o.slug}>
              <Link href={`/ai-ad-maker/${o.slug}`} className="group flex items-center justify-between gap-3 rounded-card border border-line bg-surface p-4 font-medium transition-colors hover:border-ink/30">
                {o.eyebrow}
                <ArrowRight aria-hidden className="sx-btn-arrow h-4 w-4 shrink-0" />
              </Link>
            </li>
          ))}
        </ul>
      </Section>
    </MarketingLayout>
  );
}

export const getStaticPaths: GetStaticPaths = async () => ({
  paths: USE_CASES.map((u) => ({ params: { slug: u.slug } })),
  fallback: false,
});

export const getStaticProps: GetStaticProps<Props> = async ({ params }) => {
  const slug = String(params?.slug);
  if (!getUseCase(slug)) return { notFound: true };
  return { props: { slug } };
};
