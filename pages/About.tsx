import React from "react";
import Link from "next/link";
import Header from "../app/web/src/components/Header";
import Footer from "../app/web/src/components/Footer";
import colors from '@/lib/ui/colors';
import PageSeo from "@/components/seo/PageSeo";
import { SITE_SUPPORT_EMAIL } from "@/lib/seo/site";

const addAlpha = (hsl: string, alpha: number) => {
  if (!hsl) return hsl;
  if (hsl.startsWith("hsl(")) {
    return hsl.replace(/\)$/, ` / ${alpha})`);
  }
  return hsl;
};

// TODO: add AJ's LinkedIn profile URL; the link renders once this is set.
const FOUNDER_LINKEDIN_URL = "";

const SPRINT_ITEMS = [
  "Brand + 3-competitor snapshot",
  "1 campaign concept with 3 creative angles",
  "12 static ad creatives (4:5 feed + 9:16 story) with captions and hooks",
  "2 × 15-second video ads",
  "A 2-week posting calendar",
  "1 revision round (up to 3 assets)",
];

/**
 * About — founder-led, no traction claims. We have no paying customers yet;
 * do not add client counts, logos, results or "trusted by" copy here.
 */
export default function About() {
  const cardStyle = {
    background: addAlpha(colors.card, 0.5),
    border: `1px solid ${addAlpha(colors.border, 0.5)}`,
    borderRadius: "1.25rem",
  };

  return (
    <div
      className="min-h-screen"
      style={{
        background: colors.background,
        color: colors.foreground,
      }}
    >
      <PageSeo
        title="About SkalX AI"
        description="SkalX makes ad creatives for Indian D2C brands — 12 on-brand ads and 2 short video ads in 7 days. Built in Chennai by product designer AJ."
        path="/About"
      />
      <Header />

      <main className="pt-32 pb-20">
        <section className="py-16 md:py-24 px-4">
          <div className="container mx-auto max-w-4xl">
            <p
              className="text-sm uppercase tracking-[0.3em] mb-6 font-light"
              style={{ color: colors.mutedForeground }}
            >
              About SkalX
            </p>
            <h1
              className="text-4xl md:text-6xl font-light mb-12 leading-tight tracking-tight"
              style={{ color: colors.foreground }}
            >
              Good creative shouldn&apos;t need an agency budget.
            </h1>

            <div className="grid md:grid-cols-[200px_1fr] gap-8 md:gap-12 items-start">
              {/* TODO: replace with /public/images/founder-aj.jpg (800×800) via next/image */}
              <div
                role="img"
                aria-label="Photo of AJ, founder of SkalX (placeholder)"
                className="w-40 h-40 md:w-[200px] md:h-[200px] rounded-2xl flex items-center justify-center text-4xl font-light"
                style={{ ...cardStyle, color: colors.mutedForeground }}
              >
                AJ
              </div>
              <div className="space-y-6">
                <p className="text-xl md:text-2xl font-light leading-relaxed" style={{ color: colors.foreground }}>
                  Hi, I&apos;m AJ. I&apos;m a product designer from Chennai, and I built SkalX because
                  good creative shouldn&apos;t need an agency budget. We&apos;re early, and we&apos;re
                  taking on our first founding brands now — you&apos;ll work with me directly.
                </p>
                <p className="text-base" style={{ color: colors.mutedForeground }}>
                  Write to me at{" "}
                  <a href={`mailto:${SITE_SUPPORT_EMAIL}`} className="underline" style={{ color: colors.foreground }}>
                    {SITE_SUPPORT_EMAIL}
                  </a>
                  {FOUNDER_LINKEDIN_URL ? (
                    <>
                      {" "}or find me on{" "}
                      <a
                        href={FOUNDER_LINKEDIN_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline"
                        style={{ color: colors.foreground }}
                      >
                        LinkedIn
                      </a>
                    </>
                  ) : null}
                  .
                </p>
              </div>
            </div>
          </div>
        </section>

        <div className="container mx-auto max-w-4xl px-4">
          <div className="h-px" style={{ background: addAlpha(colors.border, 0.5) }} />
        </div>

        <section className="py-16 md:py-24 px-4">
          <div className="container mx-auto max-w-4xl grid md:grid-cols-2 gap-12 items-start">
            <div>
              <h2 className="text-3xl md:text-4xl font-light mb-6 leading-tight" style={{ color: colors.foreground }}>
                What we do
              </h2>
              <p className="text-lg font-light leading-relaxed" style={{ color: colors.mutedForeground }}>
                D2C ads go stale in a week or two, and every new SKU, city or quick-commerce launch
                needs its own set. We make those creatives for you with SkalX, our in-house tool,
                and deliver them in 7 days for a fixed price.
              </p>
            </div>
            <div className="p-8" style={cardStyle}>
              <h3 className="text-xl font-normal mb-4" style={{ color: colors.foreground }}>
                The Launch Creative Sprint
              </h3>
              <ul className="space-y-3 text-base font-light" style={{ color: colors.mutedForeground }}>
                {SPRINT_ITEMS.map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <span aria-hidden style={{ color: colors.primary }}>•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="py-16 md:py-24 px-4">
          <div className="container mx-auto max-w-4xl">
            <h2 className="text-3xl md:text-4xl font-light mb-12" style={{ color: colors.foreground }}>
              Who&apos;s behind SkalX
            </h2>
            <div className="grid md:grid-cols-2 gap-8">
              <div className="space-y-4 p-8" style={cardStyle}>
                <h3 className="text-2xl font-normal" style={{ color: colors.foreground }}>
                  Sudharsan AJ
                </h3>
                <p className="text-sm uppercase tracking-wider" style={{ color: colors.mutedForeground }}>
                  Founder
                </p>
                <p className="font-light leading-relaxed" style={{ color: colors.mutedForeground }}>
                  Product designer. Works with every founding brand directly, from brief to final files.
                </p>
              </div>
              <div className="space-y-4 p-8" style={cardStyle}>
                <h3 className="text-2xl font-normal" style={{ color: colors.foreground }}>
                  Bharath Kumar Thulasidoss
                </h3>
                <p className="text-sm uppercase tracking-wider" style={{ color: colors.mutedForeground }}>
                  Technical Co-Founder
                </p>
                <p className="font-light leading-relaxed" style={{ color: colors.mutedForeground }}>
                  I’m a full-stack engineer with deep specialization in backend engineering. At Uber, I worked on building and scaling distributed systems, and today I focus on designing scalable architectures and shipping dependable, real-world products.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="py-16 md:py-24 px-4">
          <div className="container mx-auto max-w-3xl text-center">
            <h2 className="text-3xl md:text-5xl font-light mb-6 leading-tight" style={{ color: colors.foreground }}>
              See it before you pay.
            </h2>
            <p className="text-lg md:text-xl mb-10 font-light" style={{ color: colors.mutedForeground }}>
              We&apos;ll make one ad for your brand, free.
            </p>
            <Link
              href="/free-ad"
              className="inline-block px-10 py-4 rounded-full text-lg font-normal"
              style={{
                background: colors.primary,
                color: colors.primaryForeground,
              }}
            >
              Get one free ad for your brand
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
