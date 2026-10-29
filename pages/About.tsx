import React from "react";
import PageSeo from "@/components/seo/PageSeo";
import MarketingLayout from "@/app/web/src/components/marketing/MarketingLayout";
import { FounderContacts, FounderPhoto } from "@/app/web/src/components/marketing/FounderNote";
import { ButtonLink, Eyebrow } from "@/app/web/src/components/marketing/ui";
import { FOUNDER, PILLARS, STARTING_PRICE } from "@/lib/marketing/content";

/**
 * About — founder-led, no traction claims. We have no paying customers yet;
 * do not add client counts, logos, results or "trusted by" copy here.
 */
export default function About() {
  return (
    <MarketingLayout>
      <PageSeo
        title="About SkalX AI"
        description="SkalX takes Indian D2C brands from market research to ready-to-post ad creatives. Built in Chennai by product designer AJ."
        path="/About"
      />

      <section aria-labelledby="about-title" className="mx-auto max-w-6xl px-4 pb-20 pt-10 sm:px-6 md:pb-28 md:pt-16">
        <Eyebrow>About SkalX</Eyebrow>
        <h1
          id="about-title"
          className="max-w-4xl font-display text-[clamp(2.5rem,5.6vw,4.5rem)] font-medium leading-[1.02] tracking-[-0.02em]"
        >
          Good creative shouldn&apos;t need an agency budget.
        </h1>
        <div className="mt-14 grid items-start gap-8 md:grid-cols-12">
          <FounderPhoto className="w-40 sm:w-52 md:col-span-3 md:w-full" />
          <div className="md:col-span-8 md:col-start-5">
            <p className="font-display text-[clamp(1.5rem,2.8vw,2.1rem)] leading-snug">{FOUNDER.note}</p>
            <p className="mt-5 font-medium">— {FOUNDER.name}, Chennai</p>
            <div className="mt-2">
              <FounderContacts />
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="what-we-do" className="bg-paper-deep">
        <div className="mx-auto grid max-w-6xl gap-12 px-4 py-20 sm:px-6 md:grid-cols-12 md:py-28">
          <div className="md:col-span-5">
            <h2 id="what-we-do" className="font-display text-[clamp(2rem,4.2vw,3.1rem)] font-medium leading-[1.08]">
              What we do
            </h2>
            <p className="mt-5 text-lg text-ink-soft">
              D2C ads go stale in a week or two, and guessing what customers want wastes budget. SkalX reads what
              customers say about you and your competitors, turns it into a plan, then helps you create the ads and
              videos to match — on a monthly plan from {STARTING_PRICE}.
            </p>
          </div>
          <ol className="grid gap-4 md:col-span-6 md:col-start-7">
            {PILLARS.map((p, i) => (
              <li key={p.id} className="rounded-2xl border border-line bg-surface p-6">
                <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-accent">
                  <span aria-hidden>0{i + 1} · </span>
                  {p.title}
                </p>
                <h3 className="mt-1 font-display text-xl font-medium">{p.lead}</h3>
                <p className="mt-2 text-ink-soft">{p.points.join(" · ")}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section aria-labelledby="team-title">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 md:py-28">
          <h2 id="team-title" className="font-display text-[clamp(2rem,4.2vw,3.1rem)] font-medium leading-[1.08]">
            Who&apos;s behind SkalX
          </h2>
          <div className="mt-10 grid gap-5 md:grid-cols-2">
            <div className="rounded-2xl border border-line bg-surface p-7">
              <h3 className="font-display text-2xl font-medium">Sudharsan AJ</h3>
              <p className="mt-1 text-sm uppercase tracking-[0.14em] text-ink-mute">Founder</p>
              <p className="mt-4 text-ink-soft">
                Product designer. Designs SkalX and answers every message from founding brands personally.
              </p>
            </div>
            <div className="rounded-2xl border border-line bg-surface p-7">
              <h3 className="font-display text-2xl font-medium">Bharath Kumar Thulasidoss</h3>
              <p className="mt-1 text-sm uppercase tracking-[0.14em] text-ink-mute">Technical Co-Founder</p>
              <p className="mt-4 text-ink-soft">
                I&apos;m a full-stack engineer with deep specialization in backend engineering. At Uber, I worked on
                building and scaling distributed systems, and today I focus on designing scalable architectures and
                shipping dependable, real-world products.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="about-cta" className="bg-ink text-paper">
        <div className="mx-auto max-w-6xl px-4 py-20 text-center sm:px-6 md:py-24">
          <h2 id="about-cta" className="font-display text-[clamp(2.25rem,4.6vw,3.5rem)] font-medium leading-[1.05]">
            See it before you pay.
          </h2>
          <p className="mt-4 text-xl text-paper/80">We&apos;ll make one ad for your brand, free.</p>
          <ButtonLink href="/free-ad" variant="onInk" className="mt-8">
            Get one free ad for your brand
          </ButtonLink>
        </div>
      </section>
    </MarketingLayout>
  );
}
