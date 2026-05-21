"use client";

import React, { useRef, useEffect } from "react";
import { Sparkles, Zap, Info, ShieldCheck, Mail, ArrowRight } from "lucide-react";
import { Button } from "../app/web/src/components/ui/button";
import colors from '@/lib/ui/colors';
import Link from 'next/link';

function withAlpha(token: string, alpha: number) {
  const hslMatch = token.match(/hsl\(\s*([\d.]+)\s+([\d.]+)%\s+([\d.]+)%\s*\)/i);
  if (hslMatch) {
    const [, h, s, l] = hslMatch;
    return `hsla(${h}, ${s}%, ${l}%, ${alpha})`;
  }
  if (/rgba?\(|hsla?\(/i.test(token)) return token;
  return token;
}

const AIUseDisclosure: React.FC = () => {
  const topRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    topRef.current?.scrollTo({ top: 0 });
  }, []);


  ///just some comments

  return (
    <main
      ref={topRef}
      className="min-h-screen pb-24 pt-20 relative overflow-hidden"
      style={{ backgroundColor: colors.background, color: colors.foreground }}
    >
      <style jsx>{`
        .animation-float { animation: floatY 6s ease-in-out infinite alternate; }
        @keyframes floatY { from { transform: translateY(-8px);} to { transform: translateY(8px);} }
        .glass-card { backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); }
      `}</style>

      {/* Background layers + orbs */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `linear-gradient(135deg, ${colors.background} 0%, ${withAlpha("hsl(213 90% 96%)", 0.28)} 40%, ${colors.background} 100%)`,
        }}
      />
      <div className="absolute inset-0" style={{ background: colors.gradientMesh, opacity: 0.35 }} />

      <div
        className="absolute -left-10 top-16 w-72 h-72 rounded-full blur-3xl animation-float"
        style={{ backgroundColor: withAlpha(colors.primary, 0.28) }}
      />
      <div
        className="absolute right-10 bottom-20 w-96 h-96 rounded-full blur-3xl animation-float"
        style={{ backgroundColor: withAlpha(colors.primary, 0.18), animationDelay: "2s" }}
      />

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <header className="flex items-center gap-3 py-6">
          {/* <div
            className="w-12 h-12 rounded-md flex items-center justify-center glass-card"
            style={{ background: colors.card, border: `1px solid ${colors.border}`, boxShadow: colors.shadowStrong }}
          >
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
              <rect x="2" y="2" width="20" height="20" rx="6" fill={colors.primary} />
              <path d="M7 12h10" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M7 8h10" stroke={withAlpha("white", 0.85)} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>

          <div>
            <div className="text-2xl font-bold leading-tight flex items-baseline gap-1">
              <span style={{ color: colors.foreground }}>SkalX AI</span>
            </div>
            <div className="text-sm text-[14px]" style={{ color: colors.mutedForeground }}>AI Use Disclosure</div>
          </div> */}

          <Link href="/" className="flex items-center space-x-1" style={{ color: colors.foreground }}>
                      <img src="/images/Oli_AI_Logo.svg" alt="SkalX AI Logo" className="h-10 w-auto" />
<span className="text-xl font-bold" style={{ lineHeight: 1 }}>
                      <span style={{ color: colors.foreground }}>SkalX AI</span>
                    </span>
                    </Link>
        </header>

        <section className="max-w-8xl mx-auto mt-6">
          <div className="p-8 rounded-2xl glass-card border" style={{ borderColor: withAlpha(colors.border, 0.6), background: colors.card }}>
            <div className="mb-6">
              <h1 className="text-3xl font-extrabold mb-2" style={{ color: colors.foreground }}>AI Use &amp; Responsible Disclosure</h1>
              <div className="text-sm" style={{ color: colors.mutedForeground }}>Last Updated: 14th November, 2025</div>
            </div>

            <article className="prose prose-invert max-w-none" style={{ color: colors.foreground }}>
              <p>
                SkalX AI uses artificial intelligence ("AI") and machine learning technologies to provide content generation, recommendations, and analytics features. This page explains how we use AI, what data may be sent to AI providers, your choices, and our commitments to responsible AI usage.
              </p>

              <h3 className="font-bold mt-8">1. How we use AI</h3>
              <ul className="list-disc ml-4">
                <li>Generate image creatives and variants for campaigns.</li>
                <li>Create and suggest captions, headlines, and ad copy.</li>
                <li>Analyze performance data and generate insights and Optimisation recommendations.</li>
                <li>Automate mundane tasks such as resizing creatives and formatting captions for platforms.</li>
              </ul>

              <h3 className="font-bold mt-8">2. AI providers</h3>
              <p>
                We may use third-party AI service providers (for example, OpenAI or other providers) to perform generation and analysis tasks. Provider choices may change over time; we select vendors that meet our security, privacy, and compliance requirements.
              </p>

              <h3 className="font-bold mt-8">3. What data we send to AI providers</h3>
              <p>
                When you request AI generation, we send the minimum required information to the provider to fulfill the request. This may include:
              </p>
              <ul className="list-disc ml-4">
                <li>Prompts or instructions you provide.</li>
                <li>Uploaded images or references when you request image edits or style transfer.</li>
                <li>Non-sensitive campaign metadata (format, aspect ratio, target platform) necessary to generate the output.</li>
              </ul>

              <p>
                We do NOT send platform-specific private tokens (such as your Meta or Google access tokens) or other secrets to AI providers. We also do not send data fetched from Meta/Google APIs unless you explicitly provide it inside the platform and opt-in for processing.
              </p>

              <h3 className="font-bold mt-8">4. AI Training &amp; Model Improvement (Opt-in)</h3>
              <p>
                By default, SkalX AI DOES NOT use your private content (uploaded images, captions, prompts, or campaign data) to train our internal AI models. We may, however, offer an explicit opt-in program where users can choose to allow anonymized examples of their content to be used to improve certain internal models. This opt-in is clearly presented and requires affirmative consent.
              </p>

              <p>
                If you opt in, you may withdraw consent at any time; we will exclude your data from future training datasets and efforts. Requests to opt-out or delete training contributions can be made via <strong>info@skalxai.app</strong>.
              </p>

              <h3 className="font-bold mt-8">5. Sensitive data &amp; prohibited uses</h3>
              <p>
                Do not submit highly sensitive personal data (such as medical records, government ID numbers, banking credentials, or extremely private information) into AI prompts. You are responsible for ensuring that data you provide complies with applicable laws and platform policies.
              </p>

              <h3 className="font-bold mt-8">6. Quality, accuracy &amp; human review</h3>
              <p>
                AI-generated content may be inaccurate, biased, or inappropriate. You must review and approve any AI-generated output before publishing. SkalX AI is not liable for damages resulting from your use of AI-generated content beyond the limits set in our Terms &amp; Conditions.
              </p>

              <h3 className="font-bold mt-8">7. Explainability &amp; logs</h3>
              <p>
                For auditing and support purposes, we retain generation logs (prompt, anonymized metadata, timestamps) for a limited duration consistent with our retention policy. These logs help us troubleshoot issues and investigate misuse. We do not retain full user secrets in these logs.
              </p>

              <h3 className="font-bold mt-8">8. Security &amp; minimization</h3>
              <ul className="list-disc ml-4">
                <li>We transmit data to AI providers over encrypted channels (HTTPS/TLS).</li>
                <li>We minimize the data sent — only what is necessary for the requested operation.</li>
                <li>Access to AI-request logs is restricted to authorized engineers and support staff for troubleshooting.</li>
              </ul>

              <h3 className="font-bold mt-8">9. Your choices</h3>
              <ul className="list-disc ml-4">
                <li>You can choose not to use AI features. Manual upload and publishing workflows remain available.</li>
                <li>You can opt into the training program (explicit consent) and withdraw later via <strong>info@skalxai.app</strong>.</li>
                <li>You can request deletion of AI generation logs related to your account; contact support for assistance.</li>
              </ul>

              <h3 className="font-bold mt-8">10. Contact &amp; concerns</h3>
              <p>
                If you have questions about how we use AI, want to opt-out of training, or request deletion of data used for model improvement, email us at <strong>info@skalxai.app</strong>. For urgent security concerns, contact us via the support channel in the dashboard.
              </p>

            </article>

            <div className="mt-8 flex justify-between items-center">
              <div className="flex items-center gap-3 text-sm" style={{ color: colors.mutedForeground }}>
                <ShieldCheck className="h-4 w-4" style={{ color: colors.primary }} />
                <span>SkalX AI — Responsible AI</span>
              </div>

              <div className="flex items-center gap-3">
                {/* <Button size="sm" variant="outline" asChild>
                  <a href="#top" onClick={(e) => { e.preventDefault(); topRef.current?.scrollTo({ top: 0, behavior: 'smooth' }); }}>Back to top</a>
                </Button> */}
                <Button size="sm" style={{ background: colors.gradientPrimary, color: colors.primaryForeground }}>
                  <a href="/auth/signin" className="flex items-center gap-2">Get Started <ArrowRight className="h-4 w-4" /></a>
                </Button>
              </div>
            </div>

          </div>
        </section>
      </div>
    </main>
  );
};

export default AIUseDisclosure;
