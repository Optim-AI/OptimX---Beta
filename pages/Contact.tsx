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
      <section aria-labelledby="contact-title" className="mx-auto max-w-6xl px-4 pb-20 pt-10 sm:px-6 md:pb-28 md:pt-16">
        <div className="grid items-start gap-12 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <Eyebrow>Contact</Eyebrow>
            <h1
              id="contact-title"
              className="font-display text-[clamp(2.5rem,5vw,4rem)] font-medium leading-[1.04] tracking-[-0.02em]"
            >
              Talk to us.
            </h1>
            <p className="mt-5 text-lg text-ink-soft">
              Questions about SkalX, pricing or plans? Send a message and AJ will reply by email
              within one working day.
            </p>
            <dl className="mt-10 space-y-5 border-t border-line pt-8">
              <div>
                <dt className="text-sm uppercase tracking-[0.14em] text-ink-mute">Email</dt>
                <dd className="mt-1">
                  <a href={`mailto:${SITE_SUPPORT_EMAIL}`} className="text-lg font-medium underline underline-offset-4">
                    {SITE_SUPPORT_EMAIL}
                  </a>
                </dd>
              </div>
              <div>
                <dt className="text-sm uppercase tracking-[0.14em] text-ink-mute">Phone</dt>
                <dd className="mt-1">
                  <a href="tel:+919003815101" className="text-lg font-medium underline underline-offset-4">
                    +91 90038 15101
                  </a>
                </dd>
              </div>
              <div>
                <dt className="text-sm uppercase tracking-[0.14em] text-ink-mute">Rather talk?</dt>
                <dd className="mt-1">
                  <a href={bookingHref} className="text-lg font-medium underline underline-offset-4">
                    Book a 15-min call
                  </a>
                </dd>
              </div>
            </dl>
            <p className="mt-10 text-ink-soft">
              Want to see our work first?{" "}
              <Link href="/#start" className="font-medium text-ink underline underline-offset-4">
                Get a free ad for your brand
              </Link>
              .
            </p>
          </div>
          <div className="rounded-2xl border border-line bg-surface p-5 sm:p-8 lg:col-span-7">
            <h2 className="mb-6 font-display text-2xl font-medium">Send a message</h2>
            <ContactForm />
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
}
