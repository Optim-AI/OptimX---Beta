"use client";
import Link from "next/link";
import React, { useRef, useEffect, useState } from "react";
import {
  ArrowRight,
  Sparkles,
  CreditCard,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  FileText,
  ChevronDown,
  Link2,
  Shield,
} from "lucide-react";
import { Button } from "../app/web/src/components/ui/button";
import colors from "@/lib/ui/colors";

const TOC_ITEMS = [
  { id: "acceptance", label: "Acceptance of Terms" },
  { id: "about", label: "About SkalX AI" },
  { id: "eligibility", label: "Eligibility" },
  { id: "account-security", label: "Account & Security" },
  { id: "acceptable-use", label: "Acceptable Use" },
  { id: "third-party-api", label: "Third-Party API Compliance" },
  { id: "ai-usage", label: "AI Usage & Disclosure" },
  { id: "payments", label: "Payments & Subscriptions" },
  { id: "refund-cancellation", label: "Refund & Cancellation" },
  { id: "data-handling", label: "Data Handling & Security" },
  { id: "data-retention", label: "Data Retention" },
  { id: "intellectual-property", label: "Intellectual Property" },
  { id: "beta-disclaimer", label: "Beta Disclaimer" },
  { id: "data-analytics", label: "Data & Analytics" },
  { id: "termination", label: "Termination" },
  { id: "limitation-liability", label: "Limitation of Liability" },
  { id: "governing-law", label: "Governing Law" },
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
    const url = `${typeof window !== "undefined" ? window.location.origin : ""}/terms-and-conditions#${id}`;
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
  variant: "success" | "error" | "warning";
  children: React.ReactNode;
}) {
  const config = {
    success: {
      borderColor: "hsl(142 76% 36% / 0.5)",
      bgColor: "hsl(142 76% 36% / 0.08)",
      icon: CheckCircle2,
    },
    error: {
      borderColor: "hsl(0 84% 55% / 0.5)",
      bgColor: "hsl(0 84% 55% / 0.08)",
      icon: XCircle,
    },
    warning: {
      borderColor: "hsl(38 92% 50% / 0.5)",
      bgColor: "hsl(38 92% 50% / 0.08)",
      icon: AlertTriangle,
    },
  };
  const { borderColor, bgColor, icon: Icon } = config[variant];
  return (
    <div
      className="rounded-xl p-4 pl-5 border-l-4"
      style={{ borderLeftColor: borderColor, backgroundColor: bgColor }}
    >
      <div className="flex gap-3">
        <Icon className="h-5 w-5 shrink-0 mt-0.5" style={{ color: borderColor }} />
        <div>{children}</div>
      </div>
    </div>
  );
}

const TermsAndConditions: React.FC = () => {
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
      {/* Subtle flat background */}
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
        {/* Title + Meta */}
        <div className="mb-10">
          <h1
            className="text-[34px] sm:text-[36px] font-bold leading-tight mb-2"
            style={{ color: colors.foreground }}
          >
            Terms &amp; Conditions
          </h1>
          <div
            className="text-[15px]"
            style={{ color: colors.mutedForeground }}
          >
            SkalX AI — Last Updated: February 2026
          </div>
        </div>

        {/* Mobile TOC accordion */}
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
            <ChevronDown
              className={`h-5 w-5 transition-transform ${tocOpen ? "rotate-180" : ""}`}
            />
          </button>
          {tocOpen && (
            <nav
              className="mt-2 p-4 rounded-xl border"
              style={{
                background: colors.card,
                borderColor: withAlpha(colors.border, 0.5),
              }}
            >
              <ul className="space-y-1">
                {TOC_ITEMS.map(({ id, label }) => (
                  <li key={id}>
                    <button
                      type="button"
                      onClick={() => scrollTo(id)}
                      className={`block w-full text-left py-2 px-2 text-sm rounded transition-colors ${
                        activeSection === id
                          ? "font-medium"
                          : ""
                      }`}
                      style={{
                        color: activeSection === id ? colors.primary : colors.foreground,
                      }}
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
          {/* Desktop Sticky TOC */}
          <aside
            className="hidden lg:block w-full lg:w-[25%] shrink-0"
            style={{ maxWidth: 280 }}
          >
            <nav
              className="sticky top-24 space-y-1"
              style={{ paddingTop: 8 }}
            >
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
                  style={{
                    color: activeSection === id ? colors.primary : colors.mutedForeground,
                  }}
                >
                  {label}
                </a>
              ))}
            </nav>
          </aside>

          {/* Main content */}
          <div
            ref={contentRef}
            className="flex-1 min-w-0 space-y-12"
            style={{ maxWidth: 1100 }}
          >
            {/* Quick Summary */}
            <div
              className="rounded-[18px] p-6 sm:p-8 border shadow-lg"
              style={{
                background: withAlpha(colors.primary, 0.06),
                borderColor: withAlpha(colors.primary, 0.2),
              }}
            >
              <h3
                className="text-lg font-semibold mb-4"
                style={{ color: colors.foreground }}
              >
                Quick Summary
              </h3>
              <ul className="space-y-3">
                {[
                  { icon: FileText, text: "These Terms govern your use of SkalX AI and all related services." },
                  { icon: CheckCircle2, text: "You must be 18+ and use the platform for lawful business purposes." },
                  { icon: AlertTriangle, text: "AI-generated output requires human review before publishing." },
                  { icon: CreditCard, text: "Payments are final; approved refunds are issued as credit vouchers only." },
                  { icon: Shield, text: "Your data is handled securely and never sold." },
                  { icon: FileText, text: "Governed by the laws of India (Chennai jurisdiction)." },
                ].map(({ icon: Icon, text }) => (
                  <li key={text} className="flex items-start gap-3">
                    <Icon
                      className="h-5 w-5 shrink-0 mt-0.5"
                      style={{ color: colors.primary }}
                    />
                    <span
                      className="text-[15px] leading-[1.65]"
                      style={{ color: colors.foreground }}
                    >
                      {text}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* 1. Acceptance of Terms */}
            <SectionBlock>
              <SectionHeading
                id="acceptance"
                className="text-[22px] sm:text-[24px] font-semibold mb-6"
              >
                1. Acceptance of Terms
              </SectionHeading>
              <p
                className="text-[15px] leading-[1.7] mb-4"
                style={{ color: colors.foreground }}
              >
                These Terms of Service (&quot;Terms&quot;) govern your access to and use of SkalX AI&apos;s website, platform, and related services (&quot;Services&quot;).
              </p>
              <p
                className="text-[15px] leading-[1.7]"
                style={{ color: colors.foreground }}
              >
                By accessing or using the Services, you agree to these Terms. If you do not agree, you must discontinue use.
              </p>
            </SectionBlock>

            {/* 2. About SkalX AI */}
            <SectionBlock>
              <SectionHeading
                id="about"
                className="text-[22px] sm:text-[24px] font-semibold mb-6"
              >
                2. About SkalX AI
              </SectionHeading>
              <p
                className="text-[15px] leading-[1.7] mb-4"
                style={{ color: colors.foreground }}
              >
                SkalX AI is an AI-powered campaign creation and marketing automation platform that enables users to:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-[15px] leading-[1.7] mb-4">
                <li>Generate creatives (image/video)</li>
                <li>Create captions and ad copy</li>
                <li>Publish posts</li>
                <li>Run advertisements</li>
                <li>Analyze performance</li>
                <li>Receive AI insights</li>
              </ul>
              <p
                className="text-[15px] leading-[1.7]"
                style={{ color: colors.foreground }}
              >
                We integrate with Meta, Google, Razorpay, and other third-party providers.
              </p>
            </SectionBlock>

            {/* 3. Eligibility */}
            <SectionBlock>
              <SectionHeading
                id="eligibility"
                className="text-[22px] sm:text-[24px] font-semibold mb-6"
              >
                3. Eligibility
              </SectionHeading>
              <p
                className="text-[15px] leading-[1.7] mb-4"
                style={{ color: colors.foreground }}
              >
                You must:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-[15px] leading-[1.7]">
                <li>Be at least 18 years old</li>
                <li>Have authority to bind your business</li>
                <li>Use the Services for lawful purposes only</li>
              </ul>
            </SectionBlock>

            {/* 4. Account Registration & Security */}
            <SectionBlock>
              <SectionHeading
                id="account-security"
                className="text-[22px] sm:text-[24px] font-semibold mb-6"
              >
                4. Account Registration &amp; Security
              </SectionHeading>
              <p
                className="text-[15px] leading-[1.7] mb-4"
                style={{ color: colors.foreground }}
              >
                You are responsible for:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-[15px] leading-[1.7] mb-4">
                <li>Providing accurate registration details</li>
                <li>Safeguarding login credentials</li>
                <li>All activities conducted under your account</li>
              </ul>
              <p
                className="text-[15px] leading-[1.7]"
                style={{ color: colors.foreground }}
              >
                If you connect third-party platforms (Meta, Google), you authorize us to access required data solely to provide Services.
              </p>
            </SectionBlock>

            {/* 5. Acceptable Use */}
            <SectionBlock>
              <SectionHeading
                id="acceptable-use"
                className="text-[22px] sm:text-[24px] font-semibold mb-6"
              >
                5. Acceptable Use
              </SectionHeading>
              <p
                className="text-[15px] leading-[1.7] mb-4"
                style={{ color: colors.foreground }}
              >
                You agree NOT to:
              </p>
              <HighlightBox variant="error">
                <ul className="list-disc pl-5 space-y-1 text-[15px] leading-[1.7]">
                  <li>Reverse engineer or replicate the platform</li>
                  <li>Scrape, extract, or mass-download outputs</li>
                  <li>Upload illegal, infringing, violent, hateful, or harmful content</li>
                  <li>Violate Meta/Google advertising policies</li>
                  <li>Attempt to exploit glitches for refunds</li>
                  <li>Manipulate prompts to cause failures</li>
                  <li>Initiate fraudulent chargebacks</li>
                  <li>Interfere with security or infrastructure</li>
                </ul>
              </HighlightBox>
              <p
                className="text-[15px] leading-[1.7] mt-4"
                style={{ color: colors.foreground }}
              >
                Violation may result in suspension or permanent termination.
              </p>
            </SectionBlock>

            {/* 6. Third-Party API Compliance */}
            <SectionBlock>
              <SectionHeading
                id="third-party-api"
                className="text-[22px] sm:text-[24px] font-semibold mb-6"
              >
                6. Third-Party API Compliance
              </SectionHeading>
              <div
                className="border-t pt-5 mt-5"
                style={{ borderColor: withAlpha(colors.border, 0.4) }}
              >
                <h4
                  className="text-[18px] font-medium mb-3"
                  style={{ color: colors.foreground }}
                >
                  6.1 Meta Platform Data
                </h4>
                <p
                  className="text-[15px] leading-[1.7] mb-2"
                  style={{ color: colors.foreground }}
                >
                  We:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-[15px] leading-[1.7] mb-4">
                  <li>Use Meta data only for publishing, analytics, and insights</li>
                  <li>Encrypt and securely store tokens</li>
                  <li>Delete tokens upon revocation</li>
                  <li>Do NOT sell, rent, or share Meta data</li>
                  <li>Do NOT use Meta data for AI training</li>
                </ul>
                <p
                  className="text-[15px] leading-[1.7]"
                  style={{ color: colors.foreground }}
                >
                  Users may revoke access via Facebook Business Integrations.
                </p>
              </div>
              <div
                className="border-t pt-5 mt-5"
                style={{ borderColor: withAlpha(colors.border, 0.4) }}
              >
                <h4
                  className="text-[18px] font-medium mb-3"
                  style={{ color: colors.foreground }}
                >
                  6.2 Google API Data
                </h4>
                <p
                  className="text-[15px] leading-[1.7] mb-2"
                  style={{ color: colors.foreground }}
                >
                  Our use complies with Google API Services User Data Policy and Limited Use requirements.
                </p>
                <p
                  className="text-[15px] leading-[1.7] mb-2"
                  style={{ color: colors.foreground }}
                >
                  Google data is:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-[15px] leading-[1.7]">
                  <li>Used only for core features</li>
                  <li>Not sold</li>
                  <li>Not used for profiling</li>
                  <li>Stored securely</li>
                  <li>Deleted upon revocation</li>
                </ul>
              </div>
            </SectionBlock>

            {/* 7. AI Usage & Responsible Disclosure */}
            <SectionBlock>
              <SectionHeading
                id="ai-usage"
                className="text-[22px] sm:text-[24px] font-semibold mb-6"
              >
                7. AI Usage &amp; Responsible Disclosure
              </SectionHeading>
              <p
                className="text-[15px] leading-[1.7] mb-4"
                style={{ color: colors.foreground }}
              >
                SkalX AI uses AI systems for:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-[15px] leading-[1.7] mb-4">
                <li>Creative generation</li>
                <li>Caption generation</li>
                <li>Insights &amp; optimization</li>
                <li>Automation tasks</li>
              </ul>
              <p
                className="text-[15px] leading-[1.7] mb-4"
                style={{ color: colors.foreground }}
              >
                AI output:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-[15px] leading-[1.7] mb-4">
                <li>May be inaccurate or biased</li>
                <li>Requires human review</li>
                <li>Is used at your own discretion</li>
              </ul>
              <p
                className="text-[15px] leading-[1.7] mb-6"
                style={{ color: colors.foreground }}
              >
                We are not liable for business results or output accuracy.
              </p>
              <div
                className="border-t pt-5 mt-5"
                style={{ borderColor: withAlpha(colors.border, 0.4) }}
              >
                <h4
                  className="text-[18px] font-medium mb-3"
                  style={{ color: colors.foreground }}
                >
                  7.1 AI Providers
                </h4>
                <p
                  className="text-[15px] leading-[1.7]"
                  style={{ color: colors.foreground }}
                >
                  We may use third-party AI vendors (e.g., OpenAI). Vendor selection may change. Providers are selected based on privacy and security standards.
                </p>
              </div>
              <div
                className="border-t pt-5 mt-5"
                style={{ borderColor: withAlpha(colors.border, 0.4) }}
              >
                <h4
                  className="text-[18px] font-medium mb-3"
                  style={{ color: colors.foreground }}
                >
                  7.2 Data Sent to AI Providers
                </h4>
                <p
                  className="text-[15px] leading-[1.7] mb-2"
                  style={{ color: colors.foreground }}
                >
                  We send only the minimum necessary:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-[15px] leading-[1.7] mb-4">
                  <li>User prompts</li>
                  <li>Uploaded assets (when required)</li>
                  <li>Non-sensitive campaign metadata</li>
                </ul>
                <p
                  className="text-[15px] leading-[1.7] mb-2"
                  style={{ color: colors.foreground }}
                >
                  We do NOT send:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-[15px] leading-[1.7] mb-4">
                  <li>Access tokens</li>
                  <li>API secrets</li>
                  <li>Meta/Google private data (unless explicitly provided and consented)</li>
                </ul>
              </div>
              <div
                className="border-t pt-5 mt-5"
                style={{ borderColor: withAlpha(colors.border, 0.4) }}
              >
                <h4
                  className="text-[18px] font-medium mb-3"
                  style={{ color: colors.foreground }}
                >
                  7.3 AI Training Policy (Opt-In Only)
                </h4>
                <p
                  className="text-[15px] leading-[1.7] mb-4"
                  style={{ color: colors.foreground }}
                >
                  By default, we do NOT use private user content for training.
                </p>
                <p
                  className="text-[15px] leading-[1.7] mb-2"
                  style={{ color: colors.foreground }}
                >
                  If you explicitly opt in:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-[15px] leading-[1.7] mb-4">
                  <li>Anonymized examples may be used</li>
                  <li>You may withdraw consent anytime</li>
                  <li>Future datasets will exclude your data</li>
                </ul>
                <p
                  className="text-[15px] leading-[1.7]"
                  style={{ color: colors.foreground }}
                >
                  Meta/Google API data is NEVER used for training.
                </p>
              </div>
              <div
                className="border-t pt-5 mt-5"
                style={{ borderColor: withAlpha(colors.border, 0.4) }}
              >
                <h4
                  className="text-[18px] font-medium mb-3"
                  style={{ color: colors.foreground }}
                >
                  7.4 AI Logs &amp; Explainability
                </h4>
                <p
                  className="text-[15px] leading-[1.7]"
                  style={{ color: colors.foreground }}
                >
                  We retain limited generation logs (prompt, metadata, timestamps) for troubleshooting consistent with our retention policy.
                </p>
              </div>
            </SectionBlock>

            {/* 8. Payments, Credits & Subscriptions */}
            <SectionBlock>
              <SectionHeading
                id="payments"
                className="text-[22px] sm:text-[24px] font-semibold mb-6"
              >
                8. Payments, Credits &amp; Subscriptions
              </SectionHeading>
              <div
                className="border-b pb-5 mb-5"
                style={{ borderColor: withAlpha(colors.border, 0.4) }}
              >
                <h4
                  className="text-[18px] font-medium mb-3"
                  style={{ color: colors.foreground }}
                >
                  8.1 Credit-Based System
                </h4>
                <p
                  className="text-[15px] leading-[1.7]"
                  style={{ color: colors.foreground }}
                >
                  Credits are used for AI generation and features. Consumption varies by feature.
                </p>
              </div>
              <div>
                <h4
                  className="text-[18px] font-medium mb-3"
                  style={{ color: colors.foreground }}
                >
                  8.2 Subscriptions
                </h4>
                <p
                  className="text-[15px] leading-[1.7] mb-2"
                  style={{ color: colors.foreground }}
                >
                  We offer:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-[15px] leading-[1.7] mb-4">
                  <li>Monthly plans</li>
                  <li>3-month plans</li>
                </ul>
                <p
                  className="text-[15px] leading-[1.7]"
                  style={{ color: colors.foreground }}
                >
                  Subscriptions renew automatically unless canceled. Cancellation stops future billing but does not provide prorated refunds.
                </p>
              </div>
            </SectionBlock>

            {/* 9. Refund & Cancellation Policy */}
            <SectionBlock>
              <SectionHeading
                id="refund-cancellation"
                className="text-[22px] sm:text-[24px] font-semibold mb-6"
              >
                9. Refund &amp; Cancellation Policy
              </SectionHeading>
              <div
                className="border-t pt-5 mt-5"
                style={{ borderColor: withAlpha(colors.border, 0.4) }}
              >
                <h4
                  className="text-[18px] font-medium mb-3"
                  style={{ color: colors.foreground }}
                >
                  9.1 General Rule
                </h4>
                <p
                  className="text-[15px] leading-[1.7]"
                  style={{ color: colors.foreground }}
                >
                  All payments are final except in cases of verified technical malfunction. Refunds are issued only as credit vouchers. No cash refunds.
                </p>
              </div>
              <div
                className="border-t pt-5 mt-5"
                style={{ borderColor: withAlpha(colors.border, 0.4) }}
              >
                <h4
                  className="text-[18px] font-medium mb-3"
                  style={{ color: colors.foreground }}
                >
                  9.2 Eligible Cases
                </h4>
                <HighlightBox variant="success">
                  <p
                    className="text-[15px] leading-[1.7] mb-2"
                    style={{ color: colors.foreground }}
                  >
                    Refunds may be granted if:
                  </p>
                  <ul className="list-disc pl-5 space-y-1 text-[15px] leading-[1.7]">
                    <li>System error prevented generation</li>
                    <li>Credits deducted but output not delivered</li>
                    <li>Corrupted file due to internal malfunction</li>
                    <li>Payment processed but credits not credited</li>
                  </ul>
                </HighlightBox>
              </div>
              <div
                className="border-t pt-5 mt-5"
                style={{ borderColor: withAlpha(colors.border, 0.4) }}
              >
                <h4
                  className="text-[18px] font-medium mb-3"
                  style={{ color: colors.foreground }}
                >
                  9.3 Not Eligible
                </h4>
                <HighlightBox variant="error">
                  <p
                    className="text-[15px] leading-[1.7] mb-2"
                    style={{ color: colors.foreground }}
                  >
                    No refunds for:
                  </p>
                  <ul className="list-disc pl-5 space-y-1 text-[15px] leading-[1.7]">
                    <li>Dissatisfaction with output</li>
                    <li>Poor ad performance</li>
                    <li>Used credits</li>
                    <li>Subscription renewals</li>
                    <li>Third-party outages</li>
                    <li>Meta/Google rejection</li>
                  </ul>
                </HighlightBox>
              </div>
              <div
                className="border-t pt-5 mt-5"
                style={{ borderColor: withAlpha(colors.border, 0.4) }}
              >
                <h4
                  className="text-[18px] font-medium mb-3"
                  style={{ color: colors.foreground }}
                >
                  9.4 Reporting Requirement
                </h4>
                <HighlightBox variant="warning">
                  <p
                    className="text-[15px] leading-[1.7] mb-2"
                    style={{ color: colors.foreground }}
                  >
                    Refund requests must be submitted via the in-app &quot;Report Issue&quot; page with:
                  </p>
                  <ul className="list-disc pl-5 space-y-1 text-[15px] leading-[1.7] mb-4">
                    <li>Screenshot of error</li>
                    <li>Exact prompt used</li>
                    <li>Output file (if applicable)</li>
                    <li>Transaction reference</li>
                    <li>Issue description</li>
                  </ul>
                  <p
                    className="text-[15px] leading-[1.7]"
                    style={{ color: colors.foreground }}
                  >
                    Must be reported within 48 hours of generation OR 7 days of credit deduction.
                  </p>
                </HighlightBox>
              </div>
              <div
                className="border-t pt-5 mt-5"
                style={{ borderColor: withAlpha(colors.border, 0.4) }}
              >
                <h4
                  className="text-[18px] font-medium mb-3"
                  style={{ color: colors.foreground }}
                >
                  9.5 Refund Format
                </h4>
                <p
                  className="text-[15px] leading-[1.7] mb-2"
                  style={{ color: colors.foreground }}
                >
                  Approved refunds are issued as credit vouchers:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-[15px] leading-[1.7]">
                  <li>Equal to failed generation value</li>
                  <li>Non-transferable</li>
                  <li>Valid 60 days</li>
                  <li>Not convertible to cash</li>
                </ul>
              </div>
            </SectionBlock>

            {/* 10. Data Handling & Security */}
            <SectionBlock>
              <SectionHeading
                id="data-handling"
                className="text-[22px] sm:text-[24px] font-semibold mb-6"
              >
                10. Data Handling &amp; Security
              </SectionHeading>
              <p
                className="text-[15px] leading-[1.7] mb-2"
                style={{ color: colors.foreground }}
              >
                We store minimum necessary data:
              </p>
              <p
                className="text-[15px] font-medium mb-1 mt-4"
                style={{ color: colors.foreground }}
              >
                Personal:
              </p>
              <ul className="list-disc pl-6 space-y-1 text-[15px] leading-[1.7] mb-4">
                <li>Name, email, business info</li>
                <li>Uploaded assets</li>
              </ul>
              <p
                className="text-[15px] font-medium mb-1"
                style={{ color: colors.foreground }}
              >
                Operational:
              </p>
              <ul className="list-disc pl-6 space-y-1 text-[15px] leading-[1.7] mb-4">
                <li>Prompts</li>
                <li>Generated creatives</li>
                <li>Credit logs</li>
              </ul>
              <p
                className="text-[15px] font-medium mb-1"
                style={{ color: colors.foreground }}
              >
                We do NOT permanently store:
              </p>
              <ul className="list-disc pl-6 space-y-1 text-[15px] leading-[1.7] mb-4">
                <li>Meta ad data</li>
                <li>Instagram media fetched via API</li>
                <li>Google OAuth profile data</li>
              </ul>
              <p
                className="text-[15px] font-medium mb-1"
                style={{ color: colors.foreground }}
              >
                Security measures include:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-[15px] leading-[1.7]">
                <li>SSL/TLS encryption</li>
                <li>Encrypted token storage</li>
                <li>Role-based access control</li>
                <li>Database encryption</li>
                <li>Audit logs</li>
                <li>Rate limiting</li>
                <li>Daily encrypted backups</li>
              </ul>
            </SectionBlock>

            {/* 11. Data Retention */}
            <SectionBlock>
              <SectionHeading
                id="data-retention"
                className="text-[22px] sm:text-[24px] font-semibold mb-6"
              >
                11. Data Retention
              </SectionHeading>
              <ul className="list-disc pl-6 space-y-2 text-[15px] leading-[1.7] mb-4">
                <li>Account data: retained until deletion</li>
                <li>API tokens: deleted immediately upon revocation</li>
                <li>Analytics logs: 60–90 days</li>
                <li>Backups: 30-day rolling</li>
                <li>Support chats: 6 months</li>
              </ul>
              <p
                className="text-[15px] leading-[1.7]"
                style={{ color: colors.foreground }}
              >
                Deletion requests processed within 15 business days.
              </p>
            </SectionBlock>

            {/* 12. Intellectual Property */}
            <SectionBlock>
              <SectionHeading
                id="intellectual-property"
                className="text-[22px] sm:text-[24px] font-semibold mb-6"
              >
                12. Intellectual Property
              </SectionHeading>
              <p
                className="text-[15px] font-medium mb-1"
                style={{ color: colors.foreground }}
              >
                SkalX AI retains ownership of:
              </p>
              <ul className="list-disc pl-6 space-y-1 text-[15px] leading-[1.7] mb-4">
                <li>Software</li>
                <li>Infrastructure</li>
                <li>Branding</li>
                <li>UI/UX</li>
              </ul>
              <p
                className="text-[15px] font-medium mb-1"
                style={{ color: colors.foreground }}
              >
                Users retain ownership of:
              </p>
              <ul className="list-disc pl-6 space-y-1 text-[15px] leading-[1.7] mb-4">
                <li>Uploaded assets</li>
                <li>Prompts</li>
                <li>Generated creatives</li>
              </ul>
              <p
                className="text-[15px] leading-[1.7] mb-4"
                style={{ color: colors.foreground }}
              >
                We receive a limited license to process user content to operate the platform. Users may not replicate or resell core functionality.
              </p>
            </SectionBlock>

            {/* 13. Beta Disclaimer */}
            <SectionBlock>
              <SectionHeading
                id="beta-disclaimer"
                className="text-[22px] sm:text-[24px] font-semibold mb-6"
              >
                13. Beta Disclaimer
              </SectionHeading>
              <p
                className="text-[15px] leading-[1.7] mb-4"
                style={{ color: colors.foreground }}
              >
                The platform may operate in MVP/Beta phase.
              </p>
              <p
                className="text-[15px] leading-[1.7] mb-2"
                style={{ color: colors.foreground }}
              >
                You acknowledge:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-[15px] leading-[1.7]">
                <li>Possible bugs</li>
                <li>Incomplete features</li>
                <li>Service interruptions</li>
                <li>Inconsistent AI outputs</li>
              </ul>
            </SectionBlock>

            {/* 14. Data & Analytics */}
            <SectionBlock>
              <SectionHeading
                id="data-analytics"
                className="text-[22px] sm:text-[24px] font-semibold mb-6"
              >
                14. Data &amp; Analytics
              </SectionHeading>
              <p
                className="text-[15px] leading-[1.7]"
                style={{ color: colors.foreground }}
              >
                We may use anonymized data to improve features. We do not sell personal data.
              </p>
            </SectionBlock>

            {/* 15. Termination */}
            <SectionBlock>
              <SectionHeading
                id="termination"
                className="text-[22px] sm:text-[24px] font-semibold mb-6"
              >
                15. Termination
              </SectionHeading>
              <p
                className="text-[15px] leading-[1.7] mb-4"
                style={{ color: colors.foreground }}
              >
                We may suspend or terminate accounts for:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-[15px] leading-[1.7] mb-4">
                <li>Terms violations</li>
                <li>Abuse or fraud</li>
                <li>Chargeback abuse</li>
                <li>Security threats</li>
              </ul>
              <p
                className="text-[15px] leading-[1.7]"
                style={{ color: colors.foreground }}
              >
                Users may delete accounts at any time.
              </p>
            </SectionBlock>

            {/* 16. Limitation of Liability */}
            <SectionBlock>
              <SectionHeading
                id="limitation-liability"
                className="text-[22px] sm:text-[24px] font-semibold mb-6"
              >
                16. Limitation of Liability
              </SectionHeading>
              <p
                className="text-[15px] leading-[1.7] mb-4"
                style={{ color: colors.foreground }}
              >
                Services are provided &quot;as is.&quot; We are not liable for:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-[15px] leading-[1.7] mb-4">
                <li>Business losses</li>
                <li>Ad rejection</li>
                <li>AI inaccuracies</li>
                <li>Third-party outages</li>
              </ul>
              <p
                className="text-[15px] leading-[1.7]"
                style={{ color: colors.foreground }}
              >
                Total liability is limited to amounts paid in the last 3 months.
              </p>
            </SectionBlock>

            {/* 17. Governing Law */}
            <SectionBlock>
              <SectionHeading
                id="governing-law"
                className="text-[22px] sm:text-[24px] font-semibold mb-6"
              >
                17. Governing Law
              </SectionHeading>
              <p
                className="text-[15px] leading-[1.7]"
                style={{ color: colors.foreground }}
              >
                Governed by the laws of India. Jurisdiction: Chennai, Tamil Nadu.
              </p>
            </SectionBlock>

            {/* 18. Contact */}
            <SectionBlock>
              <SectionHeading
                id="contact"
                className="text-[22px] sm:text-[24px] font-semibold mb-6"
              >
                18. Contact
              </SectionHeading>
              <p
                className="text-[15px] leading-[1.7]"
                style={{ color: colors.foreground }}
              >
                Email: info@optimx.app
              </p>
            </SectionBlock>

            {/* Footer CTA */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pt-4">
              <div
                className="flex items-center gap-3 text-sm"
                style={{ color: colors.mutedForeground }}
              >
                <Sparkles className="h-4 w-4" style={{ color: colors.primary }} />
                <span>SkalX AI — Billing &amp; Support</span>
              </div>
              <Button
                size="sm"
                style={{
                  background: colors.gradientPrimary,
                  color: colors.primaryForeground,
                }}
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
              <span className="block py-2 text-[14px] rounded px-2 font-medium" style={{ color: colors.primary }}>
                Terms &amp; Conditions
              </span>
              <Link href="/privacy-policy" className="block py-2 text-[14px] rounded px-2 transition-colors hover:underline" style={{ color: colors.mutedForeground }}>
                Privacy Policy
              </Link>
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

export default TermsAndConditions;
