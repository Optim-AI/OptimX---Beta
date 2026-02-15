"use client";
import Link from 'next/link';
import React, { useRef, useEffect } from "react";
import { ArrowRight, Sparkles, CheckCircle2, User } from "lucide-react";
import { Button } from "../app/web/src/components/ui/button";
import colors from '@/lib/ui/colors';

/** Convert "hsl(H S% L%)" -> "hsla(H, S%, L%, a)" for inline usage */
function withAlpha(token: string, alpha: number) {
  const hslMatch = token.match(/hsl\(\s*([\d.]+)\s+([\d.]+)%\s+([\d.]+)%\s*\)/i);
  if (hslMatch) {
    const [, h, s, l] = hslMatch;
    return `hsla(${h}, ${s}%, ${l}%, ${alpha})`;
  }
  if (/rgba?\(|hsla?\(/i.test(token)) return token;
  return token;
}

const TermsAndConditions: React.FC = () => {
  const topRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!topRef.current) return;
    topRef.current.scrollTo({ top: 0 });
  }, []);

  return (
    <main
      ref={topRef}
      className="min-h-screen pb-24 pt-20 relative overflow-hidden"
      style={{ backgroundColor: colors.background, color: colors.foreground }}
    >
      <style jsx>{`
        .animation-float { animation: floatY 6s ease-in-out infinite alternate; }
        @keyframes floatY { from { transform: translateY(-8px);} to { transform: translateY(8px);} }
        .reveal-left { display:inline-block; transform-origin:left; transform:scaleX(0); opacity:0; animation: revealLeft 0.7s cubic-bezier(0.2,0.9,0.2,1) forwards; }
        @keyframes revealLeft { to { transform: scaleX(1); opacity:1; } }
        .glass-card { backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); }
      `}</style>

      {/* Background layers + orbs (matching Hero theme) */}
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
      <div
        className="absolute inset-0 flex items-start justify-center pointer-events-none"
        style={{ opacity: 0.05 }}
      >
        <div
          className="w-[600px] h-[600px] rounded-full blur-3xl animation-float"
          style={{
            backgroundImage: `linear-gradient(90deg, ${withAlpha(colors.primary, 0.06)} 0%, ${withAlpha(colors.primaryGlow ?? colors.primary, 0.04)} 100%)`,
            marginTop: "6rem",
          }}
        />
      </div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Header with logo and name (no navbar) */}
        <header className="flex items-center gap-3 py-6">
          {/* Inline logo (simple mark) */}
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
            <div className="text-sm text-[14px]" style={{ color: colors.mutedForeground }}>Terms &amp; Conditions</div>
          </div> */}

          <Link href="/" className="flex items-center space-x-1" style={{ color: colors.foreground }}>
                      <img src="/images/Oli_AI_Logo.svg" alt="SkalX AI Logo" className="h-10 w-auto" />
                      <span className="text-xl font-bold" style={{ lineHeight: 1 }}>
                        <span style={{ color: colors.foreground }}>SkalX AI</span>
                      </span>
                    </Link>
        </header>

        {/* Content Card */}
        <section className="max-w-8xl mx-auto mt-6">
          <div className="p-8 rounded-2xl glass-card border" style={{ borderColor: withAlpha(colors.border, 0.6), background: colors.card }}>
            <div className="mb-6">
              <h1 className="text-4xl font-extrabold mb-2" style={{ color: colors.foreground }}>Terms &amp; Conditions</h1>
              <div className="text-sm" style={{ color: colors.mutedForeground }}>Last Updated: 14th November, 2025</div>
            </div>

            <article className="prose prose-invert max-w-none" style={{ color: colors.foreground }}>
              <h2 className="font-bold">Welcome to SkalX AI</h2>
              <p>
              SkalX AI ("Company", "we", "our", "us"). These Terms &amp; Conditions ("Terms") govern your access and use of the SkalX AI app, website, and all related services ("Services"). By accessing or using SkalX AI, you agree to these Terms. If you do not agree, do not use SkalX AI.
              </p>

              <h3 className="font-bold mt-8">1. About SkalX AI</h3>
              <p>
                SkalX AI is an AI-powered campaign creation and marketing automation platform that helps businesses:
              </p>
              <ul className="list-disc ml-4">
                <li>generate creatives and captions</li>
                <li>publish posts</li>
                <li>run ads</li>
                <li>analyze performance</li>
                <li>receive AI insights and recommendations</li>
              </ul>
              <p>
                SkalX AI integrates with third-party services including Meta, Google, and Razorpay.
              </p>

              <h3 className="font-bold mt-8">2. Eligibility</h3>
              <p>You must:</p>
              <ul className="list-disc ml-4">
                <li>be at least 18 years old</li>
                <li>have legal authority to enter this agreement</li>
                <li>use SkalX AI only for lawful business purposes</li>
              </ul>

              <h3 className="font-bold mt-8">3. Account Registration</h3>
              <p>
                You must provide accurate information. You are responsible for safeguarding your login credentials, maintaining account security, and all actions taken through your account. If you connect Meta, Google, or other social accounts, you authorize SkalX AI to access the necessary data to provide services.
              </p>

              <h3 className="font-bold mt-8">4. Use of Services</h3>
              <p>You agree not to:</p>
              <ul className="list-disc ml-4">
                <li>misuse, reverse engineer, or attempt unauthorized access</li>
                <li>interfere with service operations</li>
                <li>publish harmful, unlawful, misleading, or abusive content</li>
                <li>use SkalX AI to violate advertising policies of Meta/Google</li>
                <li>use AI-generated content for illegal or harmful purposes</li>
              </ul>
              <p><strong>SkalX AI may suspend or terminate your access for violations.</strong></p>

              <h3 className="font-bold mt-8">5. Meta API &amp; Google API Compliance</h3>
              <p>By connecting Meta or Google accounts, you acknowledge:</p>
              <p><strong>We do NOT:</strong></p>
              <ul className="list-disc ml-4">
                <li>sell or share your Meta/Google data</li>
                <li>use your data for advertising outside your campaigns</li>
                <li>store your data longer than necessary</li>
                <li>use your data for training internal AI models</li>
                <li>transfer your data to data brokers</li>
              </ul>

              <p><strong>We DO:</strong></p>
              <ul className="list-disc ml-4">
                <li>use Meta/Google data only to provide analytics, insights, and publishing</li>
                <li>store access tokens securely and in encrypted form</li>
                <li>delete your data promptly when you disconnect or request deletion</li>
              </ul>

              <p><strong>Revoking Access</strong></p>
              <p>
                You may revoke SkalX AI’s access anytime through: Facebook Settings → Business Integrations or Google Account → Security → Third-party Access
              </p>

              <h3 className="font-bold mt-8">6. AI Usage</h3>
              <p>
                SkalX AI uses AI to generate text, images, recommendations, and insights. You understand and agree that AI output may contain inaccuracies. You must review and approve AI-generated content. You are responsible for final published content. SkalX AI is not liable for errors in AI-generated output.
              </p>

              <h4 className="font-bold">6.1 AI Training Policy</h4>
              <p>
                SkalX AI may use user-generated content that you manually create, upload, or provide directly inside our platform (such as captions, prompts, uploaded images, and brand assets) to improve and fine-tune certain internal AI models. We do not use Meta API data, Instagram or Facebook insights or media, Google API data, Third-party platform data, or Social login data for any AI model training. Training data is used only with your explicit opt-in consent. You may withdraw your consent at any time, and we will exclude your data from future training datasets.
              </p>

              <h3 className="font-bold mt-8">7. Payments, Credits &amp; Refunds</h3>
              <p>
                <strong>Credits:</strong> SkalX AI uses a credit-based system for AI generation and campaign actions. Credit consumption varies by feature.
              </p>
              <p>
                <strong>Billing:</strong> Payments are processed via Razorpay. SkalX AI does not store card details.
              </p>
              <p>
                <strong>Refunds:</strong> Refunds apply ONLY to unused credits within 7 days of purchase. No refunds for used credits, subscription cycles already billed, campaigns rejected by Meta/Google, or delays caused by third-party outages.
              </p>
              <p>
                <strong>Cancellation:</strong> You may cancel anytime, but partial-month refunds are not provided.
              </p>

              <h3 className="font-bold mt-8">8. Intellectual Property</h3>
              <p>
                All software, branding, UI, and platform assets belong to SkalX AI. Users own their uploaded content. AI-generated content is licensed to users for business use.
              </p>

              <h3 className="font-bold mt-8">9. Beta Disclaimer</h3>
              <p>
                SkalX AI is currently in its MVP/Beta phase. You acknowledge that the service may contain bugs, experience outages, produce inconsistent AI results, and have incomplete features. We appreciate feedback to improve the platform.
              </p>

              <h3 className="font-bold mt-8">10. Data &amp; Analytics</h3>
              <p>
                We may analyze anonymized usage data to improve features. We do not sell user data, share personal data with advertisers, or use campaign data for profiling outside your use-case.
              </p>

              <h3 className="font-bold mt-8">11. Termination</h3>
              <p>
                We may suspend or terminate your account if you violate Terms, your actions threaten system integrity, or required third-party permissions are revoked. You may delete your account anytime by contacting support.
              </p>

              <h3 className="font-bold mt-8">12. Limitation of Liability</h3>
              <p>
                SkalX AI is provided “as is.” We are not liable for business losses, ad rejections by Meta/Google, inaccuracies in AI output, service interruptions caused by third-party APIs, or data loss due to technical issues. Total liability is limited to the amount paid in the last 3 months.
              </p>

              <h3 className="font-bold mt-8">13. Governing Law</h3>
              <p>These Terms are governed by the laws of India, and disputes will be resolved in Chennai, Tamil Nadu.</p>

              <h3 className="font-bold mt-8">14. Changes to Terms</h3>
              <p>We may update these Terms periodically. Continued use of the platform means acceptance of updated Terms.</p>

              <h3 className="font-bold mt-8">15. Contact</h3>
              <p>
                support: info@optimx.app
                <br />
                Address: Thiruvanmiyur, Chennai, India.
              </p>
            </article>

            <div className="mt-8 flex justify-between items-center">
              <div className="flex items-center gap-3 text-sm" style={{ color: colors.mutedForeground }}>
                <Sparkles className="h-4 w-4" style={{ color: colors.primary }} />
                <span>SkalX AI — Marketing Made Simple, For Everyone.</span>
              </div>

              <div className="flex items-center gap-3">
                {/* <Button size="sm" variant="outline" asChild>
                  <a href="#top" onClick={(e) => { e.preventDefault(); topRef.current?.scrollTo({ top: 0, behavior: 'smooth' }); }}>Back to top</a>
                </Button> */}
                <Button size="sm" style={{ background: colors.gradientPrimary, color: colors.primaryForeground }}>
                  <a href="/auth/signin" className="flex items-center gap-2">Start Free Trial <ArrowRight className="h-4 w-4" /></a>
                </Button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
};

export default TermsAndConditions;
