import React from "react";
import PageSeo from "@/components/seo/PageSeo";
import MarketingLayout from "@/app/web/src/components/marketing/MarketingLayout";
import { FounderContacts, FounderPhoto, FounderSignature } from "@/app/web/src/components/marketing/FounderNote";
import Reveal from "@/app/web/src/components/marketing/Reveal";
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

      <section aria-labelledby="about-title" className="relative isolate">
        <div aria-hidden className="sx-grid-bg pointer-events-none absolute inset-0 -z-10" />
        <div className="mx-auto max-w-6xl px-4 pb-24 pt-12 sm:px-6 md:pb-32 md:pt-20">
          <Eyebrow index="01">About SkalX</Eyebrow>
          <h1
            id="about-title"
            className="max-w-5xl text-balance font-display text-[clamp(2.75rem,7vw,5.75rem)] font-semibold leading-[0.95] tracking-[-0.045em]"
          >
            Good creative shouldn&apos;t need an agency budget.
          </h1>
          <Reveal className="mt-16 grid items-start gap-8 md:grid-cols-[clamp(200px,20vw,260px)_minmax(0,1fr)] md:items-stretch md:gap-12">
            <div className="sx-crop w-48 sm:w-56 md:h-full md:w-full">
              <FounderPhoto className="md:aspect-auto md:h-full md:w-full" />
            </div>
            <div className="min-w-0">
              <p className="text-balance font-display text-[clamp(1.5rem,2.8vw,2.1rem)] font-medium leading-[1.3] tracking-[-0.015em]">{FOUNDER.note}</p>
              <FounderSignature />
              <div className="mt-2">
                <FounderContacts />
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <section aria-labelledby="what-we-do" className="sx-sheet bg-paper-deep">
        <div className="mx-auto grid max-w-6xl gap-12 px-4 py-20 sm:px-6 md:grid-cols-12 md:py-32">
          <div className="md:col-span-5">
            <div className="md:sticky md:top-32">
              <h2 id="what-we-do" className="font-display text-[clamp(2.1rem,4.6vw,3.6rem)] font-semibold leading-[1.02] tracking-[-0.03em]">
                What we do
              </h2>
              <p className="mt-5 text-lg text-ink-soft">
                D2C ads go stale in a week or two, and guessing what customers want wastes budget. SkalX reads what
                customers say about you and your competitors, turns it into a plan, then helps you create the ads and
                videos to match — on a monthly plan from {STARTING_PRICE}.
              </p>
            </div>
          </div>
          <ol className="grid gap-4 md:col-span-6 md:col-start-7">
            {PILLARS.map((p, i) => (
              <Reveal as="li" key={p.id} delay={i * 110} className="sx-lift rounded-[20px] border border-line bg-surface p-7 hover:border-ink/30">
                <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-accent">
                  <span aria-hidden>0{i + 1} · </span>
                  {p.title}
                </p>
                <h3 className="mt-1.5 font-display text-xl font-semibold tracking-[-0.015em]">{p.lead}</h3>
                <p className="mt-2 text-ink-soft">{p.points.join(" · ")}</p>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      <section aria-labelledby="team-title" className="sx-sheet bg-paper">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 md:py-32">
          <h2 id="team-title" className="font-display text-[clamp(2.1rem,4.6vw,3.6rem)] font-semibold leading-[1.02] tracking-[-0.03em]">
            Who&apos;s behind SkalX
          </h2>
          <div className="mt-12 grid gap-5 md:grid-cols-2">
            <div className="sx-lift group rounded-[20px] border border-line bg-surface p-8 hover:border-ink/30">
              <h3 className="font-display text-2xl font-semibold tracking-[-0.02em]">Sudharsan AJ</h3>
              <p className="mt-1 text-sm uppercase tracking-[0.14em] text-ink-mute">Founder</p>
              <p className="mt-4 text-ink-soft">
                Product designer. Designs SkalX and answers every message from founding brands personally.
              </p>
            </div>
            <div className="sx-lift group rounded-[20px] border border-line bg-surface p-8 hover:border-ink/30">
              <h3 className="font-display text-2xl font-semibold tracking-[-0.02em]">Bharath Kumar Thulasidoss</h3>
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

      <section aria-labelledby="about-cta" className="sx-sheet relative isolate overflow-hidden bg-ink text-paper">
        <div aria-hidden className="sx-glow pointer-events-none absolute inset-0 -z-10" />
        <div aria-hidden className="sx-grid-bg-ink pointer-events-none absolute inset-0 -z-10" />
        <div className="mx-auto max-w-6xl px-4 py-24 text-center sm:px-6 md:py-36">
          <h2 id="about-cta" className="text-balance font-display text-[clamp(2.75rem,7vw,5.75rem)] font-semibold leading-[0.95] tracking-[-0.045em]">
            See it before you pay.
          </h2>
          <p className="mt-4 text-xl text-paper/80">Paste your website and get free market research and 3 ad ideas for your brand.</p>
          <ButtonLink href="/#start" variant="onInk" className="mt-10" arrow>
            Get a free ad
          </ButtonLink>
        </div>
      </section>
    </MarketingLayout>
  );
}
