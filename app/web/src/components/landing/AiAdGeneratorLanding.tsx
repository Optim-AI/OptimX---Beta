"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "../ui/accordion";
import { Button } from "../ui/button";
import CreativeShowcase from "../CreativeShowcase";
import { useScrollAnimation } from "../../hooks/use-scroll-animation";
import colors from "@/lib/ui/colors";
import { AI_AD_GENERATOR_FAQS } from "@/lib/seo/ai-ad-generator";
import {
  Clapperboard,
  Compass,
  LayoutTemplate,
  Link as LinkIcon,
  Palette,
  Sparkles,
  Store,
  User,
  Users,
} from "lucide-react";

function withAlpha(token: string, alpha: number) {
  const hslMatch = token.match(/hsl\(\s*([\d.]+)\s+([\d.]+)%\s+([\d.]+)%\s*\)/i);
  if (hslMatch) {
    const [, h, s, l] = hslMatch;
    return `hsla(${h}, ${s}%, ${l}%, ${alpha})`;
  }
  return token;
}

const STEPS = [
  {
    number: "1",
    icon: LinkIcon,
    title: "Share your brand",
    description:
      "Paste your website URL, enter your brand name, or upload a product image to begin.",
  },
  {
    number: "2",
    icon: Sparkles,
    title: "SkalX learns your brand",
    description:
      "SkalX analyzes brand signals like offering, audience cues, colors, and visual style.",
  },
  {
    number: "3",
    icon: LayoutTemplate,
    title: "Generate ad creatives",
    description:
      "Create on-brand posters, ad creatives, and short marketing videos for your campaigns.",
  },
] as const;

const CAPABILITIES = [
  {
    icon: LayoutTemplate,
    title: "AI ad generator",
    desc: "Build scroll-stopping ad visuals and copy for campaign-ready assets.",
  },
  {
    icon: Palette,
    title: "AI poster generator",
    desc: "Generate on-brand poster creatives from your brand kit and product imagery.",
  },
  {
    icon: Clapperboard,
    title: "AI video ad generator",
    desc: "Produce short-form marketing videos from your product and brand context.",
  },
  {
    icon: Compass,
    title: "Campaign concepts",
    desc: "Shape campaign angles and creative direction before you generate.",
  },
] as const;

const USE_CASES = [
  {
    icon: User,
    title: "Solo founders",
    desc: "Create campaign-ready marketing without building a full creative team.",
  },
  {
    icon: Store,
    title: "D2C brands",
    desc: "Turn products into consistent, on-brand creatives at scale.",
  },
  {
    icon: Users,
    title: "In-house marketing teams",
    desc: "Move from brief to campaign without juggling disconnected tools.",
  },
] as const;

/**
 * SEO + GEO landing content for /ai-ad-generator.
 * Copy stays within verified SkalX capabilities (Brand Studio, Ad Studio, try flow).
 */
const AiAdGeneratorLanding: React.FC = () => {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const { elementRef: howRef, isVisible: howVisible } = useScrollAnimation({ threshold: 0.1 });
  const { elementRef: capRef, isVisible: capVisible } = useScrollAnimation({ threshold: 0.1 });
  const { elementRef: useRefAnim, isVisible: useVisible } = useScrollAnimation({
    threshold: 0.1,
  });
  const { elementRef: aboutRef, isVisible: aboutVisible } = useScrollAnimation({
    threshold: 0.1,
  });
  const { elementRef: faqRef, isVisible: faqVisible } = useScrollAnimation({ threshold: 0.1 });
  const { elementRef: ctaRef, isVisible: ctaVisible } = useScrollAnimation({ threshold: 0.2 });

  const goToTry = (e?: React.FormEvent) => {
    e?.preventDefault();
    const trimmed = url.trim();
    if (trimmed) {
      const looksLikeUrl =
        /^https?:\/\//i.test(trimmed) || /^[a-z0-9.-]+\.[a-z]{2,}/i.test(trimmed);
      if (looksLikeUrl) {
        const withProtocol = /^https?:\/\//i.test(trimmed)
          ? trimmed
          : `https://${trimmed}`;
        router.push(`/try?website=${encodeURIComponent(withProtocol)}`);
        return;
      }
      router.push(`/try?brand=${encodeURIComponent(trimmed)}`);
      return;
    }
    router.push("/try");
  };

  return (
    <>
      <section
        className="pt-28 pb-16 min-h-[78vh] flex flex-col items-center justify-center relative overflow-hidden"
        style={{ backgroundColor: "#121212", color: colors.foreground }}
      >
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.35]"
          style={{ background: colors.gradientMesh }}
          aria-hidden
        />
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10 w-full max-w-5xl text-center">
          <p
            className="text-2xl sm:text-3xl md:text-4xl font-normal tracking-tight mb-4"
            style={{ color: colors.foreground }}
          >
            SkalX AI
          </p>
          <h1
            className="text-4xl sm:text-5xl md:text-[52px] font-normal leading-tight tracking-tight mb-5"
            style={{ color: colors.foreground }}
          >
            Create Ads for Your Brand with AI
          </h1>
          <p
            className="text-lg sm:text-xl font-extralight max-w-2xl mx-auto mb-10"
            style={{ color: colors.mutedForeground }}
          >
            An AI advertising generator that understands your brand and creates campaign-ready
            ad creatives, posters, and short video ads.
          </p>

          <form
            onSubmit={goToTry}
            className="p-6 sm:p-8 mb-4 mx-auto w-full max-w-2xl rounded-[20px]"
            style={{
              background: `linear-gradient(135deg, ${withAlpha(colors.card, 0.85)} 0%, ${withAlpha(colors.card, 0.92)} 100%)`,
              border: "1px solid rgba(97, 97, 97, 1)",
              backdropFilter: "blur(20px)",
            }}
          >
            <label htmlFor="ai-ad-brand-input" className="sr-only">
              Website URL or brand name
            </label>
            <input
              id="ai-ad-brand-input"
              type="text"
              placeholder="Paste your website URL or brand name..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full h-12 rounded-[18px] px-4 text-base outline-none mb-5"
              style={{
                backgroundColor: colors.card,
                border: `1px solid ${colors.input}`,
                color: colors.foreground,
              }}
            />
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Button
                type="submit"
                variant="hero"
                size="lg"
                className="px-8 py-4 text-base rounded-xl w-full sm:w-auto min-w-[160px]"
                style={{
                  background: colors.gradientPrimary,
                  color: colors.primaryForeground,
                  boxShadow: colors.shadowGlow,
                }}
              >
                Try Now →
              </Button>
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="px-8 py-4 text-base rounded-xl w-full sm:w-auto min-w-[160px]"
                onClick={() => {
                  document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" });
                }}
                style={{ borderColor: colors.border, color: colors.foreground }}
              >
                See How It Works
              </Button>
            </div>
          </form>
          <Link href="/try" className="text-sm font-medium" style={{ color: colors.primary }}>
            Or continue without entering a URL →
          </Link>
        </div>
      </section>

      <CreativeShowcase />

      <section id="how-it-works" className="py-24 relative overflow-hidden section-solid">
        <div className="grain-overlay" />
        <div
          ref={howRef}
          className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10 max-w-6xl"
          style={{
            opacity: howVisible ? 1 : 0,
            transform: howVisible ? "translateY(0)" : "translateY(20px)",
            transition:
              "opacity 0.7s cubic-bezier(0.16,1,0.3,1), transform 0.7s cubic-bezier(0.16,1,0.3,1)",
          }}
        >
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2
              className="text-4xl md:text-[46px] font-normal leading-tight mb-4"
              style={{ color: colors.foreground }}
            >
              How the SkalX AI ad generator works
            </h2>
            <p className="text-xl font-extralight" style={{ color: colors.mutedForeground }}>
              From brand context to campaign-ready creatives in three steps.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {STEPS.map((step) => {
              const Icon = step.icon;
              return (
                <div key={step.number} className="text-center md:text-left">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center mb-5 mx-auto md:mx-0"
                    style={{ backgroundColor: "hsl(213 100% 55% / 0.12)" }}
                  >
                    <Icon className="h-6 w-6" style={{ color: colors.primary }} />
                  </div>
                  <p className="text-sm mb-2" style={{ color: colors.primary }}>
                    Step {step.number}
                  </p>
                  <h3 className="text-xl font-medium mb-3" style={{ color: colors.foreground }}>
                    {step.title}
                  </h3>
                  <p className="text-sm leading-relaxed" style={{ color: colors.mutedForeground }}>
                    {step.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section id="capabilities" className="py-24 relative overflow-hidden section-solid">
        <div className="grain-overlay" />
        <div
          ref={capRef}
          className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10 max-w-6xl"
          style={{
            opacity: capVisible ? 1 : 0,
            transform: capVisible ? "translateY(0)" : "translateY(20px)",
            transition:
              "opacity 0.7s cubic-bezier(0.16,1,0.3,1), transform 0.7s cubic-bezier(0.16,1,0.3,1)",
          }}
        >
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2
              className="text-4xl md:text-[46px] font-normal leading-tight mb-4"
              style={{ color: colors.foreground }}
            >
              AI ad creative capabilities
            </h2>
            <p className="text-xl font-extralight" style={{ color: colors.mutedForeground }}>
              Verified creative tools inside SkalX — posters, ads, video, and campaign direction.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {CAPABILITIES.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="flex gap-4 p-2">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: "hsl(213 100% 55% / 0.12)" }}
                  >
                    <Icon className="h-5 w-5" style={{ color: colors.primary }} />
                  </div>
                  <div>
                    <h3 className="text-lg font-medium mb-1" style={{ color: colors.foreground }}>
                      {item.title}
                    </h3>
                    <p className="text-sm leading-relaxed" style={{ color: colors.mutedForeground }}>
                      {item.desc}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section id="use-cases" className="py-24 relative overflow-hidden section-solid">
        <div className="grain-overlay" />
        <div
          ref={useRefAnim}
          className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10 max-w-5xl"
          style={{
            opacity: useVisible ? 1 : 0,
            transform: useVisible ? "translateY(0)" : "translateY(20px)",
            transition:
              "opacity 0.7s cubic-bezier(0.16,1,0.3,1), transform 0.7s cubic-bezier(0.16,1,0.3,1)",
          }}
        >
          <div className="text-center mb-16">
            <h2
              className="text-4xl md:text-[46px] font-normal leading-tight"
              style={{ color: colors.foreground }}
            >
              Who uses an AI ad creative generator
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {USE_CASES.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="text-center">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-5"
                    style={{ backgroundColor: "hsl(213 100% 55% / 0.12)" }}
                  >
                    <Icon className="h-6 w-6" style={{ color: colors.primary }} />
                  </div>
                  <h3 className="text-xl font-medium mb-3" style={{ color: colors.foreground }}>
                    {item.title}
                  </h3>
                  <p className="text-sm leading-relaxed" style={{ color: colors.mutedForeground }}>
                    {item.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section id="about-skalx" className="py-24 relative overflow-hidden section-solid">
        <div className="grain-overlay" />
        <div
          ref={aboutRef}
          className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10 max-w-3xl text-center"
          style={{
            opacity: aboutVisible ? 1 : 0,
            transform: aboutVisible ? "translateY(0)" : "translateY(20px)",
            transition:
              "opacity 0.7s cubic-bezier(0.16,1,0.3,1), transform 0.7s cubic-bezier(0.16,1,0.3,1)",
          }}
        >
          <p
            className="text-sm uppercase tracking-[0.25em] mb-4 font-light"
            style={{ color: colors.mutedForeground }}
          >
            About SkalX AI
          </p>
          <h2
            className="text-4xl md:text-[46px] font-normal leading-tight mb-6"
            style={{ color: colors.foreground }}
          >
            Your AI marketing partner for ad creatives
          </h2>
          <p
            className="text-lg font-extralight leading-relaxed mb-6"
            style={{ color: colors.mutedForeground }}
          >
            SkalX AI helps growing brands create marketing creatives without expanding headcount.
            It combines brand understanding with creative generation so you can move from brand
            context to posters, ad creatives, and short video ads faster.
          </p>
          <p className="text-sm" style={{ color: colors.mutedForeground }}>
            Learn more on the{" "}
            <Link href="/About" style={{ color: colors.primary }}>
              About
            </Link>{" "}
            page, visit the{" "}
            <Link href="/" style={{ color: colors.primary }}>
              homepage
            </Link>
            , or{" "}
            <Link href="/Contact" style={{ color: colors.primary }}>
              contact us
            </Link>
            .
          </p>
        </div>
      </section>

      <section id="faq" className="py-24 relative overflow-hidden section-solid">
        <div className="grain-overlay" />
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div
            ref={faqRef}
            className="text-center max-w-4xl mx-auto mb-16"
            style={{
              opacity: faqVisible ? 1 : 0,
              transform: faqVisible ? "translateY(0)" : "translateY(20px)",
              transition:
                "opacity 0.7s cubic-bezier(0.16,1,0.3,1), transform 0.7s cubic-bezier(0.16,1,0.3,1)",
            }}
          >
            <h2
              className="text-4xl md:text-[46px] font-normal mb-6"
              style={{ color: colors.foreground }}
            >
              Frequently asked questions
            </h2>
            <p className="text-xl font-extralight" style={{ color: colors.mutedForeground }}>
              Straight answers about SkalX as an AI ad generator. More help in the{" "}
              <Link href="/help-center" style={{ color: colors.primary }}>
                Help Center
              </Link>
              .
            </p>
          </div>
          <div className="max-w-4xl mx-auto">
            <Accordion type="single" collapsible className="space-y-4">
              {AI_AD_GENERATOR_FAQS.map((faq, index) => (
                <AccordionItem
                  key={faq.question}
                  value={`item-${index}`}
                  className="rounded-[18px] px-6 overflow-hidden border-none"
                  style={{
                    background: "hsl(0 0% 15% / 0.4)",
                    backdropFilter: "blur(16px)",
                    WebkitBackdropFilter: "blur(16px)",
                    border: "1px solid rgba(255,255,255,0.06)",
                    borderBottom: "none",
                  }}
                >
                  <AccordionTrigger
                    className="text-left py-6 text-lg font-normal hover:no-underline"
                    style={{ color: colors.foreground }}
                  >
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent
                    className="pb-6 leading-relaxed"
                    style={{ color: colors.mutedForeground }}
                  >
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </div>
      </section>

      <section className="py-24 relative overflow-hidden section-solid">
        <div className="grain-overlay" />
        <div
          ref={ctaRef}
          className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center max-w-3xl"
          style={{
            opacity: ctaVisible ? 1 : 0,
            transform: ctaVisible ? "translateY(0)" : "translateY(20px)",
            transition:
              "opacity 0.7s cubic-bezier(0.16,1,0.3,1), transform 0.7s cubic-bezier(0.16,1,0.3,1)",
          }}
        >
          <h2
            className="text-4xl md:text-5xl font-normal mb-6 leading-tight"
            style={{ color: colors.foreground }}
          >
            Start creating ads with AI
          </h2>
          <p className="text-xl mb-10 font-extralight" style={{ color: colors.mutedForeground }}>
            Tell SkalX about your brand. We&apos;ll take it from there.
          </p>
          <Button
            variant="hero"
            size="lg"
            className="px-10 py-6 text-lg btn-premium"
            asChild
            style={{
              background: colors.gradientPrimary,
              color: colors.primaryForeground,
              boxShadow: "0 0 32px hsl(213 100% 55% / 0.35)",
            }}
          >
            <Link href="/try">Try Now →</Link>
          </Button>
          <div className="mt-4">
            <Link href="/Contact" className="text-sm" style={{ color: colors.mutedForeground }}>
              Talk to Sales
            </Link>
          </div>
        </div>
      </section>
    </>
  );
};

export default AiAdGeneratorLanding;
