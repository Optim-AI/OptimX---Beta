"use client";
import Link from "next/link";
import React, { useRef, useEffect, useState } from "react";
import {
  ArrowRight,
  Sparkles,
  CreditCard,
  AlertTriangle,
  CheckCircle2,
  FileText,
  ChevronDown,
  Link2,
  Shield,
} from "lucide-react";
import { Button } from "../app/web/src/components/ui/button";
import colors from "@/lib/ui/colors";

const TOC_ITEMS = [
  { id: "information-collect", label: "Information We Collect" },
  { id: "how-we-use", label: "How We Use" },
  { id: "meta-api", label: "Meta API Data" },
  { id: "google-api", label: "Google API Data" },
  { id: "ai-processing", label: "AI Data Processing" },
  { id: "payments", label: "Payments" },
  { id: "data-sharing", label: "Data Sharing" },
  { id: "storage-security", label: "Storage & Security" },
  { id: "data-retention", label: "Data Retention" },
  { id: "your-rights", label: "Your Rights" },
  { id: "childrens-privacy", label: "Children's Privacy" },
  { id: "beta-disclaimer", label: "Beta Disclaimer" },
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
    const url = `${typeof window !== "undefined" ? window.location.origin : ""}/privacy-policy#${id}`;
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

function HighlightBox({
  variant,
  children,
}: {
  variant: "success" | "warning";
  children: React.ReactNode;
}) {
  const config = {
    success: {
      borderColor: "hsl(142 76% 36% / 0.5)",
      bgColor: "hsl(142 76% 36% / 0.08)",
      icon: CheckCircle2,
    },
    warning: {
      borderColor: "hsl(38 92% 50% / 0.5)",
      bgColor: "hsl(38 92% 50% / 0.08)",
      icon: AlertTriangle,
    },
  };
  const { borderColor, icon: Icon } = config[variant];
  return (
    <div
      className="rounded-xl p-4 pl-5 border-l-4"
      style={{ borderLeftColor: borderColor, backgroundColor: config[variant].bgColor }}
    >
      <div className="flex gap-3">
        <Icon className="h-5 w-5 shrink-0 mt-0.5" style={{ color: borderColor }} />
        <div>{children}</div>
      </div>
    </div>
  );
}

const PrivacyPolicy: React.FC = () => {
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
            Privacy Policy
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
                  { icon: FileText, text: "We collect only the information necessary to operate and improve the platform." },
                  { icon: Shield, text: "We never sell your personal data." },
                  { icon: CreditCard, text: "Payment data processed by Razorpay; we do not store card details." },
                  { icon: CheckCircle2, text: "Meta and Google data used only for your campaigns." },
                  { icon: AlertTriangle, text: "Exercise your rights at info@optimx.app" },
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
              This Privacy Policy explains how SkalX AI (&quot;Company&quot;, &quot;we&quot;, &quot;our&quot;, or &quot;us&quot;) collects, uses, stores, and protects your information when you access our website, application, and related services (&quot;Services&quot;).
            </p>
            <p className="text-[15px] leading-[1.7]" style={{ color: colors.foreground }}>
              By using SkalX AI, you agree to this Privacy Policy.
            </p>

            <SectionBlock>
              <SectionHeading id="information-collect" className="text-[22px] sm:text-[24px] font-semibold mb-6">
                1. Information We Collect
              </SectionHeading>
              <p className="text-[15px] leading-[1.7] mb-4" style={{ color: colors.foreground }}>
                We collect only the information necessary to operate and improve the platform.
              </p>
              <div className="border-t pt-5 mt-5" style={{ borderColor: withAlpha(colors.border, 0.4) }}>
                <h4 className="text-[18px] font-medium mb-3" style={{ color: colors.foreground }}>
                  1.1 Information You Provide
                </h4>
                <p className="text-[15px] leading-[1.7] mb-2" style={{ color: colors.foreground }}>
                  When you register or use the Services, we may collect:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-[15px] leading-[1.7] mb-4">
                  <li>Name</li>
                  <li>Email address</li>
                  <li>Phone number (if provided)</li>
                  <li>Business information</li>
                  <li>Uploaded brand assets (logos, images, media)</li>
                  <li>Campaign inputs and AI prompts</li>
                  <li>Generated content</li>
                  <li>Support communications</li>
                </ul>
                <p className="text-[15px] leading-[1.7]" style={{ color: colors.foreground }}>
                  Payment information is processed securely by Razorpay. We do not store card numbers or CVV details.
                </p>
              </div>
              <div className="border-t pt-5 mt-5" style={{ borderColor: withAlpha(colors.border, 0.4) }}>
                <h4 className="text-[18px] font-medium mb-3" style={{ color: colors.foreground }}>
                  1.2 Information Collected Automatically
                </h4>
                <p className="text-[15px] leading-[1.7] mb-2" style={{ color: colors.foreground }}>
                  When you use the platform, we may automatically collect:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-[15px] leading-[1.7]">
                  <li>IP address</li>
                  <li>Device and browser information</li>
                  <li>Usage analytics and feature interactions</li>
                  <li>Approximate location (IP-based)</li>
                  <li>Cookie and tracking data</li>
                </ul>
              </div>
              <div className="border-t pt-5 mt-5" style={{ borderColor: withAlpha(colors.border, 0.4) }}>
                <h4 className="text-[18px] font-medium mb-3" style={{ color: colors.foreground }}>
                  1.3 Information from Third-Party Platforms
                </h4>
                <p className="text-[15px] leading-[1.7] mb-2" style={{ color: colors.foreground }}>
                  When you connect integrations, we may access:
                </p>
                <p className="text-[15px] font-medium mt-4 mb-1" style={{ color: colors.foreground }}>
                  Meta (Facebook/Instagram)
                </p>
                <ul className="list-disc pl-6 space-y-1 text-[15px] leading-[1.7] mb-4">
                  <li>Pages and ad account access</li>
                  <li>Publishing permissions</li>
                  <li>Insights and analytics data</li>
                </ul>
                <p className="text-[15px] font-medium mb-1" style={{ color: colors.foreground }}>
                  Google
                </p>
                <ul className="list-disc pl-6 space-y-1 text-[15px] leading-[1.7] mb-4">
                  <li>OAuth profile information</li>
                  <li>Access tokens</li>
                  <li>Publishing or analytics permissions</li>
                </ul>
                <p className="text-[15px] font-medium mb-1" style={{ color: colors.foreground }}>
                  Social Login Providers
                </p>
                <ul className="list-disc pl-6 space-y-1 text-[15px] leading-[1.7]">
                  <li>Basic profile information required for authentication</li>
                </ul>
              </div>
            </SectionBlock>

            <SectionBlock>
              <SectionHeading id="how-we-use" className="text-[22px] sm:text-[24px] font-semibold mb-6">
                2. How We Use Your Information
              </SectionHeading>
              <p className="text-[15px] leading-[1.7] mb-2" style={{ color: colors.foreground }}>
                We use your information to:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-[15px] leading-[1.7] mb-4">
                <li>Create and manage campaigns</li>
                <li>Generate AI creatives</li>
                <li>Run and publish advertisements</li>
                <li>Fetch analytics and insights</li>
                <li>Improve platform functionality</li>
                <li>Ensure platform security</li>
                <li>Prevent fraud or abuse</li>
                <li>Provide customer support</li>
              </ul>
              <p className="text-[15px] leading-[1.7]" style={{ color: colors.foreground }}>
                We do not use Meta or Google data for advertising outside your campaigns or for profiling unrelated to your use of the platform.
              </p>
            </SectionBlock>

            <SectionBlock>
              <SectionHeading id="meta-api" className="text-[22px] sm:text-[24px] font-semibold mb-6">
                3. Meta API Data Usage (Mandatory Disclosure)
              </SectionHeading>
              <p className="text-[15px] leading-[1.7] mb-4" style={{ color: colors.foreground }}>
                To comply with Meta Platform Policies:
              </p>
              <HighlightBox variant="success">
                <p className="text-[15px] font-medium mb-2" style={{ color: colors.foreground }}>
                  SkalX AI uses Meta data only to:
                </p>
                <ul className="list-disc pl-5 space-y-1 text-[15px] leading-[1.7] mb-4">
                  <li>Publish posts and ads on your behalf</li>
                  <li>Fetch performance insights</li>
                  <li>Generate analytics and recommendations</li>
                  <li>Display analytics within your account</li>
                </ul>
                <p className="text-[15px] font-medium mb-2" style={{ color: colors.foreground }}>
                  We do NOT:
                </p>
                <ul className="list-disc pl-5 space-y-1 text-[15px] leading-[1.7] mb-4">
                  <li>Sell or rent Meta data</li>
                  <li>Use Meta data to build external profiles</li>
                  <li>Use Meta data for unrelated advertising</li>
                  <li>Combine Meta data with external datasets for profiling</li>
                  <li>Store Meta data longer than necessary</li>
                </ul>
                <p className="text-[15px] font-medium mb-2" style={{ color: colors.foreground }}>
                  Token Handling
                </p>
                <ul className="list-disc pl-5 space-y-1 text-[15px] leading-[1.7] mb-2">
                  <li>Access tokens are encrypted at rest</li>
                  <li>Tokens are never shared with unauthorized third parties</li>
                  <li>Tokens are deleted immediately upon revocation</li>
                  <li>Tokens are used only to enable requested features</li>
                </ul>
                <p className="text-[15px] leading-[1.7] mt-3" style={{ color: colors.foreground }}>
                  You may revoke access anytime via: Facebook Settings → Business Integrations
                </p>
              </HighlightBox>
            </SectionBlock>

            <SectionBlock>
              <SectionHeading id="google-api" className="text-[22px] sm:text-[24px] font-semibold mb-6">
                4. Google API Data Usage (Limited Use Statement)
              </SectionHeading>
              <p className="text-[15px] leading-[1.7] mb-4" style={{ color: colors.foreground }}>
                Our use of Google API data complies with the Google API Services User Data Policy, including Limited Use requirements.
              </p>
              <p className="text-[15px] leading-[1.7] mb-2" style={{ color: colors.foreground }}>
                Google data is:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-[15px] leading-[1.7]">
                <li>Used only for authentication, publishing, and analytics</li>
                <li>Never sold or shared</li>
                <li>Never used for advertising or profiling</li>
                <li>Stored securely</li>
                <li>Deleted upon revocation or account deletion</li>
              </ul>
            </SectionBlock>

            <SectionBlock>
              <SectionHeading id="ai-processing" className="text-[22px] sm:text-[24px] font-semibold mb-6">
                5. AI Data Processing
              </SectionHeading>
              <p className="text-[15px] leading-[1.7] mb-4" style={{ color: colors.foreground }}>
                SkalX AI uses third-party AI providers to generate captions, images, videos, insights, and analytics.
              </p>
              <p className="text-[15px] leading-[1.7] mb-2" style={{ color: colors.foreground }}>
                When you request AI generation, we send only the minimum necessary information, such as:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-[15px] leading-[1.7] mb-4">
                <li>Prompts</li>
                <li>Uploaded assets</li>
                <li>Non-sensitive campaign metadata</li>
              </ul>
              <p className="text-[15px] leading-[1.7] mb-6" style={{ color: colors.foreground }}>
                We do not send private API tokens or confidential credentials to AI providers. You are responsible for reviewing AI-generated output before publishing.
              </p>
              <div className="border-t pt-5 mt-5" style={{ borderColor: withAlpha(colors.border, 0.4) }}>
                <h4 className="text-[18px] font-medium mb-3" style={{ color: colors.foreground }}>
                  5.1 AI Training Policy
                </h4>
                <p className="text-[15px] leading-[1.7] mb-4" style={{ color: colors.foreground }}>
                  By default, we do NOT use your private content for AI training.
                </p>
                <p className="text-[15px] leading-[1.7] mb-2" style={{ color: colors.foreground }}>
                  If you explicitly opt in:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-[15px] leading-[1.7] mb-4">
                  <li>Anonymized examples may be used to improve internal AI systems</li>
                  <li>You may withdraw consent at any time</li>
                  <li>Your data will be excluded from future training datasets</li>
                </ul>
                <p className="text-[15px] leading-[1.7]" style={{ color: colors.foreground }}>
                  Meta API data, Google API data, and third-party platform data are never used for AI training.
                </p>
              </div>
            </SectionBlock>

            <SectionBlock>
              <SectionHeading id="payments" className="text-[22px] sm:text-[24px] font-semibold mb-6">
                6. Payments
              </SectionHeading>
              <p className="text-[15px] leading-[1.7] mb-4" style={{ color: colors.foreground }}>
                Payments are securely processed by Razorpay.
              </p>
              <p className="text-[15px] leading-[1.7] mb-2" style={{ color: colors.foreground }}>
                SkalX AI does not store:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-[15px] leading-[1.7]">
                <li>Card numbers</li>
                <li>CVV</li>
                <li>Full payment credentials</li>
              </ul>
            </SectionBlock>

            <SectionBlock>
              <SectionHeading id="data-sharing" className="text-[22px] sm:text-[24px] font-semibold mb-6">
                7. Data Sharing
              </SectionHeading>
              <p className="text-[15px] leading-[1.7] mb-2" style={{ color: colors.foreground }}>
                We share data only with essential service providers required to operate the platform, such as:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-[15px] leading-[1.7] mb-4">
                <li>AWS (hosting infrastructure)</li>
                <li>Supabase (database services)</li>
                <li>Meta and Google (API integrations)</li>
                <li>Razorpay (payments)</li>
                <li>Analytics providers</li>
              </ul>
              <p className="text-[15px] leading-[1.7]" style={{ color: colors.foreground }}>
                All partners are subject to confidentiality and data-processing agreements. We do not sell personal data.
              </p>
            </SectionBlock>

            <SectionBlock>
              <SectionHeading id="storage-security" className="text-[22px] sm:text-[24px] font-semibold mb-6">
                8. Data Storage &amp; Security
              </SectionHeading>
              <p className="text-[15px] leading-[1.7] mb-2" style={{ color: colors.foreground }}>
                We implement industry-standard safeguards, including:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-[15px] leading-[1.7] mb-4">
                <li>SSL/TLS encryption</li>
                <li>Encrypted database storage</li>
                <li>Encrypted token storage</li>
                <li>Role-based access controls</li>
                <li>Access logs and monitoring</li>
                <li>Firewall and infrastructure protection</li>
                <li>Regular security audits</li>
              </ul>
              <p className="text-[15px] leading-[1.7]" style={{ color: colors.foreground }}>
                Access to sensitive data is restricted to authorized personnel only.
              </p>
            </SectionBlock>

            <SectionBlock>
              <SectionHeading id="data-retention" className="text-[22px] sm:text-[24px] font-semibold mb-6">
                9. Data Retention
              </SectionHeading>
              <p className="text-[15px] leading-[1.7] mb-2" style={{ color: colors.foreground }}>
                We retain data only as long as necessary:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-[15px] leading-[1.7] mb-4">
                <li>Account data: retained until account deletion</li>
                <li>Operational logs: limited retention</li>
                <li>API tokens: deleted immediately upon revocation</li>
                <li>Backups: retained on a limited rolling basis</li>
              </ul>
              <p className="text-[15px] leading-[1.7]" style={{ color: colors.foreground }}>
                You may request account deletion at any time. Deletion requests are processed within a reasonable timeframe, subject to legal obligations.
              </p>
            </SectionBlock>

            <SectionBlock>
              <SectionHeading id="your-rights" className="text-[22px] sm:text-[24px] font-semibold mb-6">
                10. Your Rights
              </SectionHeading>
              <p className="text-[15px] leading-[1.7] mb-2" style={{ color: colors.foreground }}>
                Depending on your jurisdiction, you may have the right to:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-[15px] leading-[1.7] mb-4">
                <li>Access your personal data</li>
                <li>Correct inaccurate data</li>
                <li>Request deletion</li>
                <li>Restrict or object to processing</li>
                <li>Withdraw consent (where applicable)</li>
                <li>Request account closure</li>
              </ul>
              <p className="text-[15px] leading-[1.7]" style={{ color: colors.foreground }}>
                To exercise these rights, contact: info@optimx.app
              </p>
            </SectionBlock>

            <SectionBlock>
              <SectionHeading id="childrens-privacy" className="text-[22px] sm:text-[24px] font-semibold mb-6">
                11. Children&apos;s Privacy
              </SectionHeading>
              <p className="text-[15px] leading-[1.7]" style={{ color: colors.foreground }}>
                SkalX AI is not intended for users under 18. We do not knowingly collect personal data from minors.
              </p>
            </SectionBlock>

            <SectionBlock>
              <SectionHeading id="beta-disclaimer" className="text-[22px] sm:text-[24px] font-semibold mb-6">
                12. Beta Disclaimer
              </SectionHeading>
              <p className="text-[15px] leading-[1.7] mb-2" style={{ color: colors.foreground }}>
                During MVP/Beta phases:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-[15px] leading-[1.7] mb-4">
                <li>Features may be incomplete</li>
                <li>Analytics may fluctuate</li>
                <li>Service interruptions may occur</li>
              </ul>
              <p className="text-[15px] leading-[1.7]" style={{ color: colors.foreground }}>
                We continuously improve platform reliability.
              </p>
            </SectionBlock>

            <SectionBlock>
              <SectionHeading id="policy-updates" className="text-[22px] sm:text-[24px] font-semibold mb-6">
                13. Updates to This Policy
              </SectionHeading>
              <p className="text-[15px] leading-[1.7]" style={{ color: colors.foreground }}>
                We may update this Privacy Policy periodically. Changes will be reflected with an updated &quot;Last Updated&quot; date. Continued use of the Services constitutes acceptance of the updated policy.
              </p>
            </SectionBlock>

            <SectionBlock>
              <SectionHeading id="contact" className="text-[22px] sm:text-[24px] font-semibold mb-6">
                14. Contact Information
              </SectionHeading>
              <p className="text-[15px] leading-[1.7]" style={{ color: colors.foreground }}>
                Email: info@optimx.app
              </p>
            </SectionBlock>

            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pt-4">
              <div className="flex items-center gap-3 text-sm" style={{ color: colors.mutedForeground }}>
                <Sparkles className="h-4 w-4" style={{ color: colors.primary }} />
                <span>SkalX AI — Privacy &amp; Trust</span>
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

          {/* Right: Policy pages navigation */}
          <aside className="hidden lg:block w-full shrink-0" style={{ maxWidth: 200 }}>
            <nav className="sticky top-24 space-y-2 rounded-xl border p-4" style={{ borderColor: withAlpha(colors.border, 0.5), background: colors.card }}>
              <div className="text-xs font-medium uppercase tracking-wider mb-3" style={{ color: colors.mutedForeground }}>Legal</div>
              <Link href="/terms-and-conditions" className="block py-2 text-[14px] rounded px-2 transition-colors hover:underline" style={{ color: colors.mutedForeground }}>
                Terms &amp; Conditions
              </Link>
              <span className="block py-2 text-[14px] rounded px-2 font-medium" style={{ color: colors.primary }}>
                Privacy Policy
              </span>
              <Link href="/cpolicy" className="block py-2 text-[14px] rounded px-2 transition-colors hover:underline" style={{ color: colors.mutedForeground }}>
                Cookie Policy
              </Link>
            </nav>
          </aside>
        </div>
      </div>
    </main>
  );
};

export default PrivacyPolicy;
