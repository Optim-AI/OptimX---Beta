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

const DataHandlingSecurity: React.FC = () => {
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
            <div className="text-sm text-[14px]" style={{ color: colors.mutedForeground }}>Data Handling &amp; Security Standard</div>
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
              <h1 className="text-4xl font-extrabold mb-2" style={{ color: colors.foreground }}>Data Handling &amp; Security Standard</h1>
              <div className="text-sm" style={{ color: colors.mutedForeground }}>Operational controls and retention — Last Updated: 14th November, 2025</div>
            </div>

            <article className="prose prose-invert max-w-none" style={{ color: colors.foreground }}>
              <h3 className="font-bold mt-8">1. Data We Store</h3>
              <p>
                We only store the minimum necessary to operate the platform.
              </p>

              <p><strong>Personal Data</strong></p>
              <ul className="list-disc ml-4">
                <li>Name, email, contact info</li>
                <li>Business profile details</li>
                <li>Uploaded brand assets (logos, product images)</li>
              </ul>

              <p><strong>Operational Data</strong></p>
              <ul className="list-disc ml-4">
                <li>Campaign drafts</li>
                <li>AI prompts and user-generated content</li>
                <li>Credit usage logs</li>
                <li>Activity logs</li>
                <li>Preferences/settings</li>
              </ul>

              <p><strong>Does NOT include:</strong></p>
              <ul className="ml-4">
                <li>❌ Meta ad data</li>
                <li>❌ Instagram media fetched through APIs</li>
                <li>❌ Google OAuth data</li>
                <li>❌ Social login data</li>
              </ul>

              <p>API-fetched data is processed in-memory and not stored unless required for core functionality (e.g., analytics).</p>

              <h3 className="font-bold mt-8">2. Token Storage &amp; Access</h3>
              <ul className="list-disc ml-4">
                <li>Access tokens (Meta, Google, Razorpay keys): Stored only in encrypted form</li>
                <li>Stored using industry-best practices (AES-256)</li>
                <li>Never shared with any third party</li>
                <li>Automatically deleted when a user disconnects integration, token expires and is replaced, or account is deleted</li>
                <li>Only backend systems—not frontend clients—can access these tokens.</li>
              </ul>

              <h3 className="font-bold mt-8">3. Data Processing</h3>
              <p>We process data strictly to:</p>
              <ul className="list-disc ml-4">
                <li>Publish posts</li>
                <li>Run ads</li>
                <li>Fetch analytics</li>
                <li>Provide insights</li>
                <li>Improve platform features</li>
                <li>Generate user-requested AI output</li>
              </ul>

              <p>We never use Meta/Google data for AI training or internal model development.</p>

              <h3 className="font-bold mt-8">4. Security Controls</h3>
              <ul className="list-disc ml-4">
                <li>SSL/TLS enforced</li>
                <li>Database encryption at rest</li>
                <li>Supabase RLS policies enabled</li>
                <li>Role-based access control</li>
                <li>API rate limiting</li>
                <li>Automatic session invalidation</li>
                <li>Audit logging of all sensitive actions</li>
                <li>Restricted admin access</li>
                <li>Daily encrypted backups</li>
                <li>Firewall &amp; WAF protection</li>
              </ul>

              <h3 className="font-bold mt-8">5. Data Retention</h3>
              <ul className="list-disc ml-4">
                <li>User account data: retained until deletion</li>
                <li>API tokens: deleted immediately upon revocation</li>
                <li>Analytics logs: 60–90 days</li>
                <li>Backups: 30 days rolling</li>
                <li>Support conversations: 6 months</li>
              </ul>

              <h3 className="font-bold mt-8">6. User Controls</h3>
              <p>Users can:</p>
              <ul className="list-disc ml-4">
                <li>Delete their account</li>
                <li>Disconnect their Meta/Google integrations</li>
                <li>Request deletion of all stored data</li>
                <li>Download their data (on request)</li>
              </ul>

              <p>Requests are processed via <strong>info@optimx.app</strong> within 15 days.</p>
            </article>

            <div className="mt-8 flex justify-between items-center">
              <div className="flex items-center gap-3 text-sm" style={{ color: colors.mutedForeground }}>
                <Sparkles className="h-4 w-4" style={{ color: colors.primary }} />
                <span>OptimX — Data Security</span>
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

export default DataHandlingSecurity;
