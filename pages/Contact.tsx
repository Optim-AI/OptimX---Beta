import React from "react";
import Link from "next/link";
import PageSeo from "@/components/seo/PageSeo";
import MarketingLayout from "@/app/web/src/components/marketing/MarketingLayout";
import ContactForm from "@/app/web/src/components/marketing/ContactForm";
import { Eyebrow } from "@/app/web/src/components/marketing/ui";
import { bookingHref } from "@/lib/marketing/content";
import { SITE_SUPPORT_EMAIL } from "@/lib/seo/site";

/**
 * Contact — messages are emailed to the support inbox via /api/contact (nothing stored).
 * SEO is applied via PageSeo (Pages Router). Do not use App Router `metadata` exports here.
 */
export default function Contact() {
  return (
    <MarketingLayout>
      <PageSeo
        title="Contact SkalX AI"
        description="Questions about SkalX, pricing or plans? Write to us and we'll reply within one working day."
        path="/Contact"
      />
      <section aria-labelledby="contact-title" className="relative isolate">
        <div aria-hidden className="sx-grid-bg pointer-events-none absolute inset-0 -z-10" />
        <div className="mx-auto grid max-w-6xl items-start gap-12 px-4 pb-24 pt-12 sm:px-6 md:pb-32 md:pt-20 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <Eyebrow index="01">Contact</Eyebrow>
            <h1
              id="contact-title"
              className="font-display text-[clamp(2.75rem,7vw,5.5rem)] font-semibold leading-[0.95] tracking-[-0.045em]"
            >
              Talk to us.
            </h1>
            <p className="mt-5 text-lg text-ink-soft">
              Questions about SkalX, pricing or plans? Send a message and AJ will reply by email
              within one working day.
            </p>
            <dl className="mt-10 divide-y divide-line border-y border-line">
              <div className="py-5">
                <dt className="text-sm uppercase tracking-[0.14em] text-ink-mute">Email</dt>
                <dd className="mt-1">
                  <a href={`mailto:${SITE_SUPPORT_EMAIL}`} className="sx-link text-lg font-medium">
                    {SITE_SUPPORT_EMAIL}
                  </a>
                </dd>
              </div>
              <div className="py-5">
                <dt className="text-sm uppercase tracking-[0.14em] text-ink-mute">Phone</dt>
                <dd className="mt-1">
                  <a href="tel:+919003815101" className="sx-link text-lg font-medium">
                    +91 90038 15101
                  </a>
                </dd>
              </div>
              <div className="py-5">
                <dt className="text-sm uppercase tracking-[0.14em] text-ink-mute">Rather talk?</dt>
                <dd className="mt-1">
                  <a href={bookingHref} className="sx-link text-lg font-medium">
                    Book a 15-min call
                  </a>
                </dd>
              </div>
            </dl>
            <p className="mt-10 text-ink-soft">
              Want to see our work first?{" "}
              <Link href="/#start" className="sx-link font-medium text-ink">
                Get a free ad for your brand
              </Link>
              .
            </p>
          </div>
          <div className="sx-crop rounded-[24px] border border-line bg-surface p-5 shadow-[0_40px_80px_-56px_rgba(23,20,15,0.6)] sm:p-8 lg:col-span-7 lg:mt-6">
            <h2 className="mb-6 font-display text-2xl font-semibold tracking-[-0.02em]">Send a message</h2>
            <ContactForm />
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
