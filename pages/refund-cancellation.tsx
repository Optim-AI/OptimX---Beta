"use client";
import Link from 'next/link';
import React, { useRef, useEffect } from "react";
import { ArrowRight, Sparkles } from "lucide-react";
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

const RefundCancellation: React.FC = () => {
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
        {/* Header with logo and name */}
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
              <span style={{ color: colors.foreground }}>Optim</span>
              <span style={{ color: colors.primary, fontFamily: "inherit" }}>X</span>
            </div>
            <div className="text-sm text-[14px]" style={{ color: colors.mutedForeground }}>Refund &amp; Cancellation Policy</div>
          </div> */}

          <Link href="/" className="flex items-center space-x-1" style={{ color: colors.foreground }}>
                      <img src="/images/OptimX_Logo.svg" alt="OptimX Logo" className="h-10 w-auto" />
                      <span className="text-xl font-bold" style={{ lineHeight: 1 }}>
                        <span style={{ color: colors.foreground }}>Optim</span>
                        <span style={{ color: colors.primary }}>X</span>
                      </span>
                    </Link>
        </header>

        <section className="max-w-5xl mx-auto mt-6">
          <div className="p-8 rounded-2xl glass-card border" style={{ borderColor: withAlpha(colors.border, 0.6), background: colors.card }}>
            <div className="mb-6">
              <h1 className="text-3xl font-extrabold mb-2" style={{ color: colors.foreground }}>Refund &amp; Cancellation Policy</h1>
              <div className="text-sm" style={{ color: colors.mutedForeground }}>Last Updated: 14th November, 2025</div>
            </div>

            <article className="prose prose-invert max-w-none" style={{ color: colors.foreground }}>
              <h3 className="font-bold mt-8">Refund Policy</h3>

              <p>
                We want every user to have a great experience with OptimX. However, due to the nature of AI credits and digital services:
              </p>

              <p><strong>Refunds are issued only for:</strong></p>
              <ul className="list-disc">
                <li>Unused AI credits</li>
                <li>Requested within 7 days of purchase</li>
              </ul>

              <p><strong>Refunds are NOT issued for:</strong></p>
              <ul className="list-disc">
                <li>Credits already consumed</li>
                <li>Subscription renewals already processed</li>
                <li>Partially used billing cycles</li>
                <li>Ads rejected by Meta/Google</li>
                <li>App downtime caused by third-party platforms (Meta, Google, Razorpay, AWS)</li>
                <li>User mistakes, misconfiguration, or accidental spending of credits</li>
              </ul>

              <p>
                Refunds, if approved, will be processed within 5–10 working days to the original payment method.
              </p>

              <h3>Cancellation Policy</h3>
              <p>Users may cancel their subscription at any time.</p>
              <ul className="list-disc">
                <li>Your plan remains active until the end of the billing cycle</li>
                <li>No partial refunds or prorated refunds are provided</li>
                <li>Remaining credits expire at the end of the cycle unless otherwise stated</li>
              </ul>

              <h3>Credit Expiry</h3>
              <p>Credits may have an expiration period depending on your plan. Expired credits cannot be reinstated or refunded.</p>

              <h3>Ad Spend</h3>
              <p>Ad spend paid directly to Meta/Google platforms is not refundable by OptimX.</p>

              <h3>How to Request a Refund</h3>
              <p>
                Email: info@optimx.app
              </p>
              <p>Please include:</p>
              <ul className="list-disc">
                <li>Registered email</li>
                <li>Payment ID</li>
                <li>Reason for refund request</li>
              </ul>
            </article>

            <div className="mt-8 flex justify-between items-center">
              <div className="flex items-center gap-3 text-sm" style={{ color: colors.mutedForeground }}>
                <Sparkles className="h-4 w-4" style={{ color: colors.primary }} />
                <span>OptimX — Billing & Support</span>
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

export default RefundCancellation;
