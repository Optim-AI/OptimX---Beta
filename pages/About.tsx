"use client";

import React, { useEffect, useRef } from "react";
import Header from "../app/web/src/components/Header";
import Footer from "../app/web/src/components/Footer";
// **As requested** — importing from your relative file path
import colors from '@/lib/ui/colors';

const addAlpha = (hsl: string, alpha: number) => {
  if (!hsl) return hsl;
  if (hsl.startsWith("hsl(")) {
    return hsl.replace(/\)$/, ` / ${alpha})`);
  }
  return hsl;
};

export default function About() {
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    // Reveal function that's robust: tries class toggle, then inline styles as fallback.
    const reveal = (el: Element) => {
      // keep the class toggle for existing CSS-based animation
      try {
        el.classList.add("animate-in");
      } catch (e) {
        /* ignore */
      }

      // Inline fallback: ensure element becomes visible even if .animate-in CSS missing.
      const htmlEl = el as HTMLElement;
      htmlEl.style.transition = htmlEl.style.transition || "all 700ms ease-out";
      htmlEl.style.opacity = "1";
      htmlEl.style.transform = "translateY(0) translateZ(0)";
      htmlEl.style.pointerEvents = "auto";
    };

    // If IntersectionObserver is available, use it
    if ("IntersectionObserver" in window) {
      observerRef.current = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              reveal(entry.target);
              // optionally unobserve after reveal so we don't toggle repeatedly
              observerRef.current?.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.1 }
      );

      const elements = document.querySelectorAll(".fade-in-section");
      if (elements.length === 0) {
        // Nothing matched — reveal nothing to avoid surprises.
        return;
      }
      elements.forEach((el) => observerRef.current?.observe(el));
    } else {
      // No IntersectionObserver support — reveal all immediately
      const elements = document.querySelectorAll(".fade-in-section");
      elements.forEach((el) => reveal(el));
    }

    return () => {
      observerRef.current?.disconnect();
    };
  }, []);

  return (
    <div
      className="min-h-screen"
      style={{
        background: colors.background,
        color: colors.foreground,
      }}
    >
      <Header />

      <main className="pt-32 pb-20">
        {/* Hero Section */}
        <section className="py-24 px-4">
          <div
            className="container mx-auto max-w-5xl text-center fade-in-section opacity-0 transition-all duration-1000 ease-out translate-y-8"
            style={{ color: colors.foreground }}
          >
            <p
              className="text-sm uppercase tracking-[0.3em] mb-6 font-light"
              style={{ color: colors.mutedForeground }}
            >
              Who We Are
            </p>
            <h1
              className="text-5xl md:text-7xl font-light mb-8 leading-tight tracking-tight"
              style={{ color: colors.foreground }}
            >
              Building smarter marketing
              <br />
              <span className="font-normal" style={{ color: colors.foreground }}>
                for every small business
              </span>
            </h1>
            <p
              className="text-lg md:text-xl max-w-2xl mx-auto font-light leading-relaxed"
              style={{ color: colors.mutedForeground }}
            >
              We believe marketing should be simple, not overwhelming.
            </p>
          </div>
        </section>

        {/* Quote 1 */}
        <section className="py-20 px-4">
          <div
            className="container mx-auto max-w-3xl text-center fade-in-section opacity-0 transition-all duration-1000 ease-out translate-y-8"
            style={{ color: addAlpha(colors.foreground, 0.8) }}
          >
            <blockquote className="text-2xl md:text-3xl font-light italic leading-relaxed">
              "The best marketing doesn't feel like marketing at all."
            </blockquote>
          </div>
        </section>

        {/* Our Story */}
        <section className="py-24 px-4">
          <div
            className="container mx-auto max-w-4xl fade-in-section opacity-0 transition-all duration-1000 ease-out translate-y-8"
            style={{ color: colors.foreground }}
          >
            <div className="grid md:grid-cols-2 gap-16 items-start">
              <div>
                <h2
                  className="text-4xl md:text-5xl font-light mb-8 leading-tight"
                  style={{ color: colors.foreground }}
                >
                  Our Story
                </h2>
              </div>
              <div className="space-y-6">
                <p
                  className="text-lg font-light leading-relaxed"
                  style={{ color: colors.mutedForeground }}
                >
                  Every SMB owner dreams of growth, but most struggle with one
                  big hurdle:{" "}
                  <span style={{ color: colors.foreground, fontWeight: 400 }}>
                    marketing
                  </span>
                  . Running ads, posting across platforms, and tracking results
                  is overwhelming, expensive, and built for big brands — not the
                  local store down the street.
                </p>
                <p
                  className="text-lg font-light leading-relaxed"
                  style={{ color: colors.mutedForeground }}
                >
                  We saw countless SMBs losing time and money, stuck between
                  overpriced agencies and confusing tools. That's when the idea
                  for{" "}
                  <span style={{ color: colors.foreground, fontWeight: 400 }}>
                    Oli AI
                  </span>{" "}
                  was born — a simple, AI-powered platform that puts the power
                  of marketing back into the hands of small businesses.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Divider */}
        <div className="container mx-auto max-w-4xl px-4">
          <div
            className="h-px"
            style={{ background: addAlpha(colors.border, 0.5) }}
          />
        </div>

        {/* The Team */}
        <section className="py-24 px-4">
          <div
            className="container mx-auto max-w-4xl fade-in-section opacity-0 transition-all duration-1000 ease-out translate-y-8"
            style={{ color: colors.foreground }}
          >
            <h2
              className="text-3xl md:text-4xl font-light mb-16 text-center"
              style={{ color: colors.foreground }}
            >
              Behind Oli AI
            </h2>
            <div className="grid md:grid-cols-2 gap-12">
              <div
                className="space-y-4 p-8 rounded-2xl transition-all duration-500"
                style={{
                  background: addAlpha(colors.card, 0.5),
                  border: `1px solid ${addAlpha(colors.border, 0.5)}`,
                  borderRadius: "1.25rem",
                }}
              >
                <h3 className="text-2xl font-normal" style={{ color: colors.foreground }}>
                  Sudharsan AJ
                </h3>
                <p
                  className="text-sm uppercase tracking-wider"
                  style={{ color: colors.mutedForeground }}
                >
                  Founder
                </p>
                <p className="font-light leading-relaxed" style={{ color: colors.mutedForeground }}>
                  With a background in product, design, and user experience, I've worked closely with startups and small businesses. I've seen firsthand how much energy owners waste trying to make sense of marketing.
                </p>
              </div>

              <div
                className="space-y-4 p-8 rounded-2xl transition-all duration-500"
                style={{
                  background: addAlpha(colors.card, 0.5),
                  border: `1px solid ${addAlpha(colors.border, 0.5)}`,
                  borderRadius: "1.25rem",
                }}
              >
                <h3 className="text-2xl font-normal" style={{ color: colors.foreground }}>
                  Bharath Kumar Thulasidoss
                </h3>
                <p
                  className="text-sm uppercase tracking-wider"
                  style={{ color: colors.mutedForeground }}
                >
                  Technical Co-Founder
                </p>
                <p className="font-light leading-relaxed" style={{ color: colors.mutedForeground }}>
                  I’m a full-stack engineer with deep specialization in backend engineering. At Uber, I worked on building and scaling distributed systems, and today I focus on designing scalable architectures and shipping dependable, real-world products.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Quote 2 */}
        <section className="py-20 px-4">
          <div
            className="container mx-auto max-w-3xl text-center fade-in-section opacity-0 transition-all duration-1000 ease-out translate-y-8"
            style={{ color: addAlpha(colors.foreground, 0.8) }}
          >
            <blockquote className="text-2xl md:text-3xl font-light italic leading-relaxed">
              "Simplicity is the ultimate sophistication."
            </blockquote>
          </div>
        </section>

        {/* Journey */}
        <section className="py-24 px-4">
          <div
            className="container mx-auto max-w-4xl fade-in-section opacity-0 transition-all duration-1000 ease-out translate-y-8"
            style={{ color: colors.foreground }}
          >
            <div className="grid md:grid-cols-2 gap-16 items-start">
              <div>
                <h2
                  className="text-4xl md:text-5xl font-light mb-8 leading-tight"
                  style={{ color: colors.foreground }}
                >
                  Our Journey
                </h2>
              </div>
              <div className="space-y-6">
                <p className="text-lg font-light leading-relaxed" style={{ color: colors.mutedForeground }}>
                  Like many startups, Oli AI began as a simple idea on paper — one dashboard for everything. Along the way, we refined our product by listening to SMB owners:
                </p>
                <ul className="space-y-4 text-lg font-light" style={{ color: colors.mutedForeground }}>
                  <li className="flex items-start gap-3">
                    <span style={{ color: colors.primary, marginTop: 4 }}>•</span>
                    <span>Simplifying campaign creation with templates and AI</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span style={{ color: colors.primary, marginTop: 4 }}>•</span>
                    <span>Automating scheduling across multiple platforms</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <span style={{ color: colors.primary, marginTop: 4 }}>•</span>
                    <span>Building insights that connect directly to sales, not vanity likes</span>
                  </li>
                </ul>
                <p className="text-lg font-light leading-relaxed" style={{ color: colors.mutedForeground }}>
                  Today, Oli AI is on its way to becoming the{" "}
                  <span style={{ color: colors.foreground, fontWeight: 400 }}>
                    go-to marketing partner for SMBs
                  </span>
                  , already simplifying campaigns for businesses who once thought digital marketing was "too complicated."
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Divider */}
        <div className="container mx-auto max-w-4xl px-4">
          <div
            className="h-px"
            style={{ background: addAlpha(colors.border, 0.5) }}
          />
        </div>

        {/* Mission & Vision */}
        <section className="py-24 px-4">
          <div
            className="container mx-auto max-w-5xl fade-in-section opacity-0 transition-all duration-1000 ease-out translate-y-8"
            style={{ color: colors.foreground }}
          >
            <div className="text-center mb-20">
              <h2 className="text-4xl md:text-5xl font-light mb-8 leading-tight" style={{ color: colors.foreground }}>
                Mission & Vision
              </h2>
            </div>
            <div className="grid md:grid-cols-2 gap-16">
              <div
                className="space-y-6 p-10 rounded-3xl"
                style={{
                  background: `linear-gradient(135deg, ${addAlpha(
                    colors.primary,
                    0.05
                  )} 0%, ${addAlpha(colors.accent, 0.05)} 100%)`,
                }}
              >
                <h3 className="text-2xl font-normal mb-4" style={{ color: colors.foreground }}>
                  Our Mission
                </h3>
                <p className="text-lg font-light leading-relaxed" style={{ color: colors.mutedForeground }}>
                  Make modern marketing <span style={{ color: colors.foreground, fontWeight: 400 }}>effortless, affordable, and accessible</span> for every small business.
                </p>
              </div>
              <div
                className="space-y-6 p-10 rounded-3xl"
                style={{
                  background: `linear-gradient(135deg, ${addAlpha(
                    colors.accent,
                    0.05
                  )} 0%, ${addAlpha(colors.primary, 0.05)} 100%)`,
                }}
              >
                <h3 className="text-2xl font-normal mb-4" style={{ color: colors.foreground }}>
                  Our Vision
                </h3>
                <p className="text-lg font-light leading-relaxed" style={{ color: colors.mutedForeground }}>
                  Become the <span style={{ color: colors.foreground, fontWeight: 400 }}>default marketing tool for SMBs worldwide</span> — the way Google Ads became the standard for big brands, Oli AI will be for small businesses.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Final Quote */}
        <section className="py-20 px-4">
          <div
            className="container mx-auto max-w-3xl text-center fade-in-section opacity-0 transition-all duration-1000 ease-out translate-y-8"
            style={{ color: addAlpha(colors.foreground, 0.8) }}
          >
            <blockquote className="text-2xl md:text-3xl font-light italic leading-relaxed">
              "One simple platform, powered by AI, guiding owners to grow smarter without the chaos."
            </blockquote>
          </div>
        </section>

        {/* Closing CTA */}
        <section className="py-32 px-4">
          <div
            className="container mx-auto max-w-4xl text-center fade-in-section opacity-0 transition-all duration-1000 ease-out translate-y-8"
            style={{ color: colors.foreground }}
          >
            <div
              className="rounded-[3rem] p-16 md:p-24"
              style={{
                background: `linear-gradient(135deg, ${addAlpha(colors.primary, 0.1)} 0%, ${addAlpha(colors.accent, 0.05)} 50%, ${addAlpha(colors.primary, 0.05)} 100%)`,
              }}
            >
              <h2 className="text-4xl md:text-6xl font-light mb-8 leading-tight" style={{ color: colors.foreground }}>
                Let's Build Smarter
                <br />
                Campaigns Together
              </h2>
              <p className="text-lg md:text-xl mb-12 font-light max-w-2xl mx-auto leading-relaxed" style={{ color: colors.mutedForeground }}>
                Ready to transform your marketing approach? Join us in making marketing simple, powerful, and human.
              </p>
              <a
                href="/auth/signin"
                className="inline-block px-12 py-4 rounded-full text-lg font-normal transition-all duration-300"
                style={{
                  background: colors.primary,
                  color: colors.primaryForeground,
                  boxShadow: colors.shadowGlow,
                }}
              >
                Get Started
              </a>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
