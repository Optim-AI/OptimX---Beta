"use client";
import Link from 'next/link';
import React, { useRef, useEffect } from "react";
import { Sparkles, ArrowRight } from "lucide-react";
import { Button } from "../app/web/src/components/ui/button";
import colors from "../lib/colors";

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

const CookiePolicy: React.FC = () => {
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

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        {/* Header with logo and name (no navbar) */}
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
          </div> */}
          <Link href="/" className="flex items-center space-x-1" style={{ color: colors.foreground }}>
                      <img src="/images/OptimX_Logo.svg" alt="OptimX Logo" className="h-10 w-auto" />
                      <span className="text-xl font-bold" style={{ lineHeight: 1 }}>
                        <span style={{ color: colors.foreground }}>Optim</span>
                        <span style={{ color: colors.primary }}>X</span>
                      </span>
                    </Link>

          {/* <div>
            <div className="text-2xl font-bold leading-tight flex items-baseline gap-1">
              <span style={{ color: colors.foreground }}>Optim</span>
              <span style={{ color: colors.primary, fontFamily: "inherit" }}>X</span>
            </div>
            <div className="text-sm text-[14px]" style={{ color: colors.mutedForeground }}>Cookie Policy</div>
          </div> */}
        </header>

        {/* Content Card */}
        <section className="max-w-5xl mx-auto mt-6">
          <div className="p-8 rounded-2xl glass-card border" style={{ borderColor: withAlpha(colors.border, 0.6), background: colors.card }}>
            <div className="mb-6">
              <h1 className="text-3xl font-extrabold mb-2" style={{ color: colors.foreground }}>Cookie Policy</h1>
              <div className="text-sm" style={{ color: colors.mutedForeground }}>Last Updated: 14th November, 2025</div>
            </div>

            <article className="prose prose-invert max-w-none" style={{ color: colors.foreground }}>
              <p>
                This Cookie Policy explains how OptimX ("we", "our", "us") uses cookies and similar tracking technologies on our website and services. By using OptimX, you consent to cookies as described here. If you do not agree, please manage your cookie settings or discontinue use.
              </p>

              <h3 className="font-bold mt-8">1. What are cookies?</h3>
              <p>Cookies are small text files placed on your device (computer, tablet, mobile) that help the site remember information about your visit. They are widely used to make websites work more efficiently and to provide information to site owners.</p>

              <h3 className="font-bold mt-8">2. Types of cookies we use</h3>
              <ul className="list-disc ml-4">
                <li><strong>Strictly necessary:</strong> Required for core platform operations (authentication, security, session management). These cannot be disabled if you wish to use OptimX.</li>
                <li><strong>Preferences:</strong> Remember choices you make (language, display preferences).</li>
                <li><strong>Analytics:</strong> Help us understand how the site is used (page views, events) so we can improve the product.</li>
                <li><strong>Marketing:</strong> Used to deliver and measure ads and retargeting (e.g., Meta pixel). These are only used for campaign delivery and reporting within your account and not for external profiling.</li>
              </ul>

              <h3 className="font-bold mt-8">3. Third-party cookies</h3>
              <p>We may use third-party services that set cookies, such as:</p>
              <ul className="list-disc ml-4">
                <li><strong>Google Analytics</strong> — analytics and product usage.
                </li>
                <li><strong>Meta (Facebook/Instagram) Pixel</strong> — used only when you connect and use our publishing/ads features.
                </li>
                <li><strong>Razorpay</strong> — payment provider; cookies used for payment flow are controlled by Razorpay.</li>
              </ul>

              <h3 className="font-bold mt-8">4. How we use cookies</h3>
              <ul className="list-disc ml-4">
                <li>Maintain sessions and authentication</li>
                <li>Remember user preferences</li>
                <li>Collect analytics and usage metrics</li>
                <li>Enable advertising features for campaigns you run (only within your account)</li>
              </ul>

              <h3 className="font-bold mt-8">5. Consent &amp; managing cookies</h3>
              <p>When you first visit OptimX, we show a cookie consent banner (where applicable). You can manage cookies via your browser settings or via the banner controls. Disabling non-essential cookies may reduce functionality.</p>

              <h3 className="font-bold mt-8">6. Do we use cookies for training AI?</h3>
              <p>No. We do not use Meta/Google API data or cookie-derived personal data to train our internal AI models unless you explicitly opt in as described in our AI Training Policy.</p>

              <h3 className="font-bold mt-8">7. Data sharing &amp; retention</h3>
              <p>
                Cookie and analytics data may be shared with our service providers (Google, Meta, Razorpay, analytics vendors) to operate features. Data retention follows our general retention policy: analytics logs kept for 60–90 days; cookies persist according to their lifespan (session or persistent). For more details, see our <a href="/pages/data-handling-security">Data Handling &amp; Security Standard</a> and <a href="/pages/privacy-policy">Privacy Policy</a>.
              </p>

              <h3 className="font-bold mt-8">8. Your choices</h3>
              <p>You can:</p>
              <ul className="list-disc ml-4">
                <li>Manage cookies via your browser settings (delete or block cookies)</li>
                <li>Use the cookie banner to opt-out of non-essential cookies</li>
                <li>Disconnect Meta/Google integrations in your account settings to stop related cookies originating from those integrations</li>
              </ul>

              <h3 className="font-bold mt-8">9. Changes to this policy</h3>
              <p>We may update this Cookie Policy. Changes will be posted with an updated "Last Updated" date. Continued use means acceptance of the updated policy.</p>

              <h3 className="font-bold mt-8">10. Contact</h3>
              <p>
                For questions about cookies or data practices, email us at <strong>info@optimx.app</strong> or write to:
                <br />
                OptimX, Thiruvanmiyur, Chennai, India
              </p>
            </article>

            <div className="mt-8 flex justify-between items-center">
              <div className="flex items-center gap-3 text-sm" style={{ color: colors.mutedForeground }}>
                <Sparkles className="h-4 w-4" style={{ color: colors.primary }} />
                <span>OptimX — Cookie &amp; Tracking</span>
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

export default CookiePolicy;
