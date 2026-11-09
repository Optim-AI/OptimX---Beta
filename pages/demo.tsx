import React from 'react';
import { Check } from 'lucide-react';
import PageSeo from '@/components/seo/PageSeo';
import { DEMO_PAGE } from '@/content/pages';
import { LINKS } from '@/content/site';
import MarketingLayout from '@/app/web/src/components/marketing/MarketingLayout';
import { CTAButton } from '@/app/web/src/components/marketing/kit/CTAButton';
import { Eyebrow } from '@/app/web/src/components/marketing/ui';

/** Calendly inline embed. `loading="lazy"` keeps it from blocking the first paint. */
function BookingEmbed() {
  const src = `${LINKS.bookDemo}?hide_gdpr_banner=1&background_color=fffcf6&primary_color=1d4ed8`;
  return (
    <div className="overflow-hidden rounded-card border border-line bg-surface shadow-card">
      <iframe title="Book a 15-minute SkalX demo" src={src} className="block h-[700px] w-full bg-surface" loading="lazy" />
      <p className="border-t border-line px-4 py-3 text-sm text-ink-soft">
        {DEMO_PAGE.fallback}{' '}
        <a href={LINKS.bookDemo} target="_blank" rel="noopener noreferrer" className="sx-link font-medium text-ink">
          {DEMO_PAGE.fallbackCta}
        </a>
      </p>
    </div>
  );
}

export default function DemoPage() {
  return (
    <MarketingLayout>
      <PageSeo title={DEMO_PAGE.seoTitle} description={DEMO_PAGE.seoDescription} path="/demo" />
      <section aria-labelledby="demo-title" className="relative isolate">
        <div aria-hidden className="sx-grid-bg pointer-events-none absolute inset-0 -z-10" />
        <div className="mx-auto grid max-w-6xl items-start gap-10 px-4 pb-20 pt-10 sm:px-6 md:pt-16 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <Eyebrow>{DEMO_PAGE.eyebrow}</Eyebrow>
            <h1 id="demo-title" className="font-display text-display font-semibold">
              {DEMO_PAGE.title}
            </h1>
            <p className="mt-5 text-lead text-ink-soft">{DEMO_PAGE.sub}</p>
            <ul className="mt-6 space-y-2.5">
              {DEMO_PAGE.points.map((p) => (
                <li key={p} className="flex gap-2.5 text-ink-soft">
                  <Check aria-hidden className="mt-1 h-4 w-4 shrink-0 text-accent" />
                  {p}
                </li>
              ))}
            </ul>
            <div className="mt-8 rounded-card border border-line bg-surface p-5">
              <p className="text-[15px] text-ink-soft">{DEMO_PAGE.orAudit}</p>
              <CTAButton href={LINKS.freeAudit} variant="secondary" size="md" arrow className="mt-3">
                {DEMO_PAGE.orAuditCta}
              </CTAButton>
            </div>
          </div>
          <div className="lg:col-span-7">
            <BookingEmbed />
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
