"use client";
import Link from "next/link";
import React, { useRef, useEffect, useState } from "react";
import {
  ArrowRight,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  FileText,
  ChevronDown,
  Link2,
  Shield,
} from "lucide-react";
import { Button } from "app/web/src/components/ui/button";
import colors from "@/lib/ui/colors";

const TOC_ITEMS = [
  { id: "what-are-cookies", label: "What Are Cookies?" },
  { id: "types-of-cookies", label: "Types of Cookies" },
  { id: "third-party", label: "Third-Party Cookies" },
  { id: "how-we-use", label: "How We Use Cookies" },
  { id: "ai-training", label: "AI Training & Cookies" },
  { id: "data-retention", label: "Data Retention" },
  { id: "managing-cookies", label: "Managing Cookies" },
  { id: "policy-updates", label: "Policy Updates" },
  { id: "contact", label: "Contact" },
] as const;

function withAlpha(token: string, alpha: number) {
  const hslMatch = token.match(/hsl\(\s*([\d.]+)\s+([\d.]+)%\s+([\d.]+)%\s*\)/i);
  if (hslMatch) {
    const [, h, s, l] = hslMatch;
    return `hsla(${h}, ${s}%, ${l}%, ${alpha})`;
  }
  if (/rgba?\(|hsla?\(/i.test(token)) return token;
  return token;
}

function SectionHeading({
  id,
  children,
  className = "",
}: {
  id: string;
  children: React.ReactNode;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const copyLink = () => {
    const url = `${typeof window !== "undefined" ? window.location.origin : ""}/cookiepolicy#${id}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className={`group flex items-center gap-2 ${className}`}>
      <h2 id={id} className="scroll-mt-28">
        {children}
      </h2>
      <button
        type="button"
        onClick={copyLink}
        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-white/10"
        aria-label="Copy link to section"
      >
        <Link2 className="h-4 w-4" style={{ color: colors.mutedForeground }} />
      </button>
      {copied && (
        <span className="text-xs" style={{ color: colors.mutedForeground }}>
          Copied
        </span>
      )}
    </div>
  );
}

function SectionBlock({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-[18px] p-6 sm:p-8 border ${className}`}
      style={{
        background: colors.card,
        borderColor: withAlpha(colors.border, 0.5),
      }}
    >
      {children}
    </div>
  );
}

const CookiePolicy: React.FC = () => {
  const topRef = useRef<HTMLElement | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [activeSection, setActiveSection] = useState<string>(TOC_ITEMS[0].id);
  const [tocOpen, setTocOpen] = useState(false);

  useEffect(() => {
    topRef.current?.scrollTo({ top: 0 });
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
            break;
          }
        }
      },
      { rootMargin: "-80px 0px -70% 0px", threshold: 0 }
    );
    TOC_ITEMS.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    setTocOpen(false);
  };

  return (
    <main
      ref={topRef}
      className="min-h-screen pb-24 pt-20 relative"
      style={{ backgroundColor: colors.background, color: colors.foreground }}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `linear-gradient(180deg, ${colors.background} 0%, ${withAlpha(colors.card, 0.3)} 50%, ${colors.background} 100%)`,
          opacity: 0.6,
        }}
      />

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10 max-w-[1600px]">
        <header className="flex items-center gap-3 py-6">
          <Link href="/" className="flex items-center" style={{ color: colors.foreground }}>
            <img src="/images/SkalX_Logo.png" alt="SkalX AI Logo" className="h-8 w-auto object-contain" />
          </Link>
        </header>
        <div className="mb-10">
          <h1
            className="text-[34px] sm:text-[36px] font-bold leading-tight mb-2"
            style={{ color: colors.foreground }}
          >
            Cookie Policy
          </h1>
          <div className="text-[15px]" style={{ color: colors.mutedForeground }}>
            Last Updated: February 2026
          </div>
        </div>

        <div className="lg:hidden mb-8">
          <button
            type="button"
            onClick={() => setTocOpen(!tocOpen)}
            className="w-full flex items-center justify-between gap-2 p-4 rounded-xl border transition-colors"
            style={{
              background: colors.card,
              borderColor: withAlpha(colors.border, 0.5),
              color: colors.foreground,
            }}
          >
            <span className="text-sm font-medium">Table of Contents</span>
            <ChevronDown className={`h-5 w-5 transition-transform ${tocOpen ? "rotate-180" : ""}`} />
          </button>
          {tocOpen && (
            <nav
              className="mt-2 p-4 rounded-xl border"
              style={{ background: colors.card, borderColor: withAlpha(colors.border, 0.5) }}
            >
              <ul className="space-y-1">
                {TOC_ITEMS.map(({ id, label }) => (
                  <li key={id}>
                    <button
                      type="button"
                      onClick={() => scrollTo(id)}
                      className={`block w-full text-left py-2 px-2 text-sm rounded transition-colors ${
                        activeSection === id ? "font-medium" : ""
                      }`}
                      style={{ color: activeSection === id ? colors.primary : colors.foreground }}
                    >
                      {label}
                    </button>
                  </li>
                ))}
              </ul>
            </nav>
          )}
        </div>

        <div className="flex flex-col lg:flex-row gap-10 lg:gap-12">
          <aside className="hidden lg:block w-full lg:w-[25%] shrink-0" style={{ maxWidth: 280 }}>
            <nav className="sticky top-24 space-y-1" style={{ paddingTop: 8 }}>
              {TOC_ITEMS.map(({ id, label }) => (
                <a
                  key={id}
                  href={`#${id}`}
                  onClick={(e) => {
                    e.preventDefault();
                    scrollTo(id);
                  }}
                  className={`block py-2 text-[14px] rounded px-2 transition-colors hover:underline ${
                    activeSection === id ? "font-medium" : ""
                  }`}
                  style={{ color: activeSection === id ? colors.primary : colors.mutedForeground }}
                >
                  {label}
                </a>
              ))}
            </nav>
          </aside>

          <div ref={contentRef} className="flex-1 min-w-0 space-y-12" style={{ maxWidth: 1100 }}>
            <div
              className="rounded-[18px] p-6 sm:p-8 border shadow-lg"
              style={{
                background: withAlpha(colors.primary, 0.06),
                borderColor: withAlpha(colors.primary, 0.2),
              }}
            >
              <h3 className="text-lg font-semibold mb-4" style={{ color: colors.foreground }}>
                Quick Summary
              </h3>
              <ul className="space-y-3">
                {[
                  { icon: FileText, text: "Cookies help the site function and remember preferences." },
                  { icon: CheckCircle2, text: "Strictly necessary cookies cannot be disabled." },
                  { icon: Shield, text: "Marketing cookies used only for your campaign measurement." },
                  { icon: AlertTriangle, text: "Manage via browser settings or cookie consent banner." },
                ].map(({ icon: Icon, text }) => (
                  <li key={text} className="flex items-start gap-3">
                    <Icon className="h-5 w-5 shrink-0 mt-0.5" style={{ color: colors.primary }} />
                    <span className="text-[15px] leading-[1.65]" style={{ color: colors.foreground }}>
                      {text}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <p className="text-[15px] leading-[1.7]" style={{ color: colors.foreground }}>
              This Cookie Policy explains how SkalX AI (&quot;we&quot;, &quot;our&quot;, or &quot;us&quot;) uses cookies and similar tracking technologies when you access our website and Services.
            </p>
            <p className="text-[15px] leading-[1.7]" style={{ color: colors.foreground }}>
              By using SkalX AI, you agree to the use of cookies as described in this policy. You may manage your preferences as outlined below.
            </p>

            <SectionBlock>
              <SectionHeading id="what-are-cookies" className="text-[22px] sm:text-[24px] font-semibold mb-6">
                1. What Are Cookies?
              </SectionHeading>
              <p className="text-[15px] leading-[1.7] mb-4" style={{ color: colors.foreground }}>
                Cookies are small text files placed on your device (computer, tablet, or mobile device) when you visit a website. They help websites function properly, remember preferences, and collect information about usage.
              </p>
              <p className="text-[15px] leading-[1.7] mb-2" style={{ color: colors.foreground }}>
                Cookies may be:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-[15px] leading-[1.7]">
                <li>Session cookies (deleted when you close your browser)</li>
                <li>Persistent cookies (stored for a defined period)</li>
              </ul>
            </SectionBlock>

            <SectionBlock>
              <SectionHeading id="types-of-cookies" className="text-[22px] sm:text-[24px] font-semibold mb-6">
                2. Types of Cookies We Use
              </SectionHeading>
              <div className="border-t pt-5 mt-5" style={{ borderColor: withAlpha(colors.border, 0.4) }}>
                <h4 className="text-[18px] font-medium mb-3" style={{ color: colors.foreground }}>
                  2.1 Strictly Necessary Cookies
                </h4>
                <p className="text-[15px] leading-[1.7] mb-2" style={{ color: colors.foreground }}>
                  These are required for core functionality, including:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-[15px] leading-[1.7] mb-4">
                  <li>Authentication</li>
                  <li>Session management</li>
                  <li>Security verification</li>
                  <li>Fraud prevention</li>
                </ul>
                <p className="text-[15px] leading-[1.7]" style={{ color: colors.foreground }}>
                  These cookies cannot be disabled if you wish to use the platform.
                </p>
              </div>
              <div className="border-t pt-5 mt-5" style={{ borderColor: withAlpha(colors.border, 0.4) }}>
                <h4 className="text-[18px] font-medium mb-3" style={{ color: colors.foreground }}>
                  2.2 Preference Cookies
                </h4>
                <p className="text-[15px] leading-[1.7] mb-2" style={{ color: colors.foreground }}>
                  These cookies remember choices you make, such as:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-[15px] leading-[1.7]">
                  <li>Language settings</li>
                  <li>Display preferences</li>
                  <li>Dashboard configuration</li>
                </ul>
              </div>
              <div className="border-t pt-5 mt-5" style={{ borderColor: withAlpha(colors.border, 0.4) }}>
                <h4 className="text-[18px] font-medium mb-3" style={{ color: colors.foreground }}>
                  2.3 Analytics Cookies
                </h4>
                <p className="text-[15px] leading-[1.7] mb-2" style={{ color: colors.foreground }}>
                  These help us understand how users interact with the platform, including:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-[15px] leading-[1.7] mb-4">
                  <li>Page visits</li>
                  <li>Feature usage</li>
                  <li>Error reporting</li>
                  <li>Performance monitoring</li>
                </ul>
                <p className="text-[15px] leading-[1.7]" style={{ color: colors.foreground }}>
                  Analytics data helps us improve platform functionality and user experience.
                </p>
              </div>
              <div className="border-t pt-5 mt-5" style={{ borderColor: withAlpha(colors.border, 0.4) }}>
                <h4 className="text-[18px] font-medium mb-3" style={{ color: colors.foreground }}>
                  2.4 Marketing &amp; Advertising Cookies
                </h4>
                <p className="text-[15px] leading-[1.7] mb-2" style={{ color: colors.foreground }}>
                  These may include:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-[15px] leading-[1.7] mb-4">
                  <li>Meta (Facebook/Instagram) Pixel</li>
                  <li>Advertising performance tracking tools</li>
                </ul>
                <p className="text-[15px] leading-[1.7] mb-2" style={{ color: colors.foreground }}>
                  Marketing cookies are used only to:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-[15px] leading-[1.7] mb-4">
                  <li>Measure performance of campaigns you run</li>
                  <li>Enable retargeting within your account</li>
                </ul>
                <p className="text-[15px] leading-[1.7]" style={{ color: colors.foreground }}>
                  We do not use marketing cookies for unrelated profiling or selling user data.
                </p>
              </div>
            </SectionBlock>

            <SectionBlock>
              <SectionHeading id="third-party" className="text-[22px] sm:text-[24px] font-semibold mb-6">
                3. Third-Party Cookies
              </SectionHeading>
              <p className="text-[15px] leading-[1.7] mb-2" style={{ color: colors.foreground }}>
                Some cookies are set by third-party service providers, including:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-[15px] leading-[1.7] mb-4">
                <li>Google Analytics — usage analytics</li>
                <li>Meta Pixel — campaign performance tracking</li>
                <li>Razorpay — payment processing flows</li>
              </ul>
              <p className="text-[15px] leading-[1.7]" style={{ color: colors.foreground }}>
                These third parties control their own cookies according to their respective privacy policies.
              </p>
            </SectionBlock>

            <SectionBlock>
              <SectionHeading id="how-we-use" className="text-[22px] sm:text-[24px] font-semibold mb-6">
                4. How We Use Cookies
              </SectionHeading>
              <p className="text-[15px] leading-[1.7] mb-2" style={{ color: colors.foreground }}>
                We use cookies to:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-[15px] leading-[1.7]">
                <li>Maintain secure login sessions</li>
                <li>Authenticate users</li>
                <li>Remember preferences</li>
                <li>Monitor usage patterns</li>
                <li>Improve performance</li>
                <li>Enable advertising and campaign measurement features</li>
              </ul>
            </SectionBlock>

            <SectionBlock>
              <SectionHeading id="ai-training" className="text-[22px] sm:text-[24px] font-semibold mb-6">
                5. AI Training &amp; Cookies
              </SectionHeading>
              <p className="text-[15px] leading-[1.7]" style={{ color: colors.foreground }}>
                We do not use cookie-derived personal data or Meta/Google API data to train our internal AI models unless you explicitly opt into our AI Training Program.
              </p>
            </SectionBlock>

            <SectionBlock>
              <SectionHeading id="data-retention" className="text-[22px] sm:text-[24px] font-semibold mb-6">
                6. Data Retention
              </SectionHeading>
              <p className="text-[15px] leading-[1.7] mb-2" style={{ color: colors.foreground }}>
                Cookie retention depends on the cookie type:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-[15px] leading-[1.7] mb-4">
                <li>Session cookies expire when your browser closes</li>
                <li>Persistent cookies remain for a defined period</li>
                <li>Analytics logs are retained for approximately 60–90 days</li>
              </ul>
              <p className="text-[15px] leading-[1.7]" style={{ color: colors.foreground }}>
                For more details, refer to our Privacy Policy and Data Retention section in our Terms of Service.
              </p>
            </SectionBlock>

            <SectionBlock>
              <SectionHeading id="managing-cookies" className="text-[22px] sm:text-[24px] font-semibold mb-6">
                7. Managing Cookies
              </SectionHeading>
              <p className="text-[15px] leading-[1.7] mb-2" style={{ color: colors.foreground }}>
                You can control cookies by:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-[15px] leading-[1.7] mb-4">
                <li>Adjusting browser settings (block or delete cookies)</li>
                <li>Using the cookie consent banner (where applicable)</li>
                <li>Disconnecting Meta or Google integrations within your account</li>
              </ul>
              <p className="text-[15px] leading-[1.7]" style={{ color: colors.foreground }}>
                Disabling certain cookies may limit platform functionality.
              </p>
            </SectionBlock>

            <SectionBlock>
              <SectionHeading id="policy-updates" className="text-[22px] sm:text-[24px] font-semibold mb-6">
                8. Changes to This Policy
              </SectionHeading>
              <p className="text-[15px] leading-[1.7]" style={{ color: colors.foreground }}>
                We may update this Cookie Policy from time to time. Updates will be reflected with a revised &quot;Last Updated&quot; date. Continued use of the Services constitutes acceptance of the updated policy.
              </p>
            </SectionBlock>

            <SectionBlock>
              <SectionHeading id="contact" className="text-[22px] sm:text-[24px] font-semibold mb-6">
                9. Contact
              </SectionHeading>
              <p className="text-[15px] leading-[1.7]" style={{ color: colors.foreground }}>
                For questions regarding this Cookie Policy or data practices:
              </p>
              <p className="text-[15px] leading-[1.7] mt-2" style={{ color: colors.foreground }}>
                Email: info@skalxai.app
              </p>
            </SectionBlock>

            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pt-4">
              <div className="flex items-center gap-3 text-sm" style={{ color: colors.mutedForeground }}>
                <Sparkles className="h-4 w-4" style={{ color: colors.primary }} />
                <span>SkalX AI — Cookie &amp; Tracking</span>
              </div>
              <Button
                size="sm"
                style={{ background: colors.gradientPrimary, color: colors.primaryForeground }}
                asChild
              >
                <a href="/auth/signin" className="flex items-center gap-2">
                  Get Started <ArrowRight className="h-4 w-4" />
                </a>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
};

export default CookiePolicy;
