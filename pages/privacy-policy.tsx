"use client";
import Link from 'next/link';
import React, { useRef, useEffect } from "react";
import { ArrowRight, Sparkles, User } from "lucide-react";
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

const PrivacyPolicy: React.FC = () => {
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
            <div className="text-sm text-[14px]" style={{ color: colors.mutedForeground }}>Privacy Policy</div>
          </div> */}

          <Link href="/" className="flex items-center space-x-1" style={{ color: colors.foreground }}>
                      <img src="/images/OptimX_Logo.svg" alt="OptimX Logo" className="h-10 w-auto" />
                      <span className="text-xl font-bold" style={{ lineHeight: 1 }}>
                        <span style={{ color: colors.foreground }}>Optim</span>
                        <span style={{ color: colors.primary }}>X</span>
                      </span>
                    </Link>
        </header>

        {/* Content Card */}
        <section className="max-w-5xl mx-auto mt-6">
          <div className="p-8 rounded-2xl glass-card border" style={{ borderColor: withAlpha(colors.border, 0.6), background: colors.card }}>
            <div className="mb-6">
              <h1 className="text-4xl font-extrabold mb-2" style={{ color: colors.foreground }}>Privacy Policy</h1>
              <div className="text-sm" style={{ color: colors.mutedForeground }}>Last Updated: 14th November, 2025</div>
            </div>

            <article className="prose prose-invert max-w-none" style={{ color: colors.foreground }}>
              <p>
                This Privacy Policy explains how OptimX ("we", "our", "us") collects, uses, stores, and protects your information when you use our website, app, and related services ("Services"). By using OptimX, you agree to the practices described here.
              </p>

              <h3 className="mt-8">1. Information We Collect</h3>
              <p>Information you provide</p>
              <ul className="list-disc ml-4">
                <li>name, email, phone</li>
                <li>business info</li>
                <li>payment info (processed by Razorpay)</li>
                <li>uploaded media (logos, images, captions, etc.)</li>
                <li>campaign inputs, AI prompts, generated content</li>
              </ul>

              <p><strong>Automatically collected</strong></p>
              <ul className="list-disc ml-4">
                <li>IP address</li>
                <li>device/browser info</li>
                <li>usage & analytics</li>
                <li>location (approximate/IP-based)</li>
                <li>cookies and tracking data</li>
              </ul>

              <p><strong>From third-party platforms</strong></p>
              <ul className="list-disc ml-4">
                <li>When you connect accounts:</li>
                <li>Meta: pages, ad accounts, insights, publishing permissions</li>
                <li>Google: OAuth profile info, access tokens</li>
                <li>Social platforms: login profile info</li>
              </ul>

              <h3 className="font-bold mt-8">2. How We Use Your Information</h3>
              <p>We use your data to:</p>
              <ul className="list-disc ml-4">
                <li>create campaigns</li>
                <li>generate AI creatives</li>
                <li>run and publish ads</li>
                <li>analyze campaign performance</li>
                <li>provide insights & recommendations</li>
                <li>improve product functionality</li>
                <li>ensure security & prevent fraud</li>
                <li>provide customer support</li>
              </ul>
              <p>We never use your Meta or Google data for advertising or profiling outside the platform.</p>

              <h3 className="font-bold mt-8">3. Meta API Data Usage (Mandatory Disclosure)</h3>
              <p>To comply with Meta Platform Policies:</p>
              <p>OptimX only uses Facebook/Instagram data to:</p>
              <ul className="list-disc ml-4">
                <li>publish posts or ads on your behalf</li>
                <li>fetch insights/performance data</li>
                <li>generate recommendations</li>
                <li>display analytics to you</li>
              </ul>

              <p>OptimX does NOT:</p>
              <ul className="list-disc ml-4">
                <li>sell, rent, or share your Meta data</li>
                <li>use Meta data to build user profiles</li>
                <li>store data longer than necessary</li>
                <li>use Meta data for unrelated advertising</li>
                <li>transfer Meta data to third parties except essential processors</li>
                <li>combine Meta data with external data sources for profiling</li>
              </ul>

              <p><strong>Token Handling</strong></p>
              <ul className="list-disc ml-4">
                <li>Access tokens are encrypted at rest</li>
                <li>Not shared with external parties</li>
                <li>Automatically deleted when revoked</li>
                <li>Used only to operate requested features</li>
              </ul>

              <p><strong>Revoking Access</strong></p>
              <p>You can revoke access anytime at: Facebook Settings → Business Integrations</p>

              <h3 className="font-bold mt-8">4. Google API Data Usage (Mandatory Limited Use Statement)</h3>
              <p>
                Our use of Google API data complies with the Google API Services User Data Policy, including the Limited Use requirements. Google data is used ONLY to provide core features (auth, publishing, analytics), never sold or shared, never used for advertising, profiling, or unrelated purposes, and stored securely only as long as required.
              </p>

              <h3 className="font-bold mt-8">5. AI Data Processing</h3>
              <p>
                OptimX uses AI providers (e.g., OpenAI) for generating captions, images, videos, analyzing post performance, and generating insights. We send only the minimum necessary information required for generation. We do not use personal data for training internal AI models. You are responsible for reviewing AI output before publishing.
              </p>

              <h4>5.1 AI Training Policy</h4>
              <p>
                OptimX may use user-generated content that you manually create, upload, or provide directly inside our platform (such as captions, prompts, uploaded images, and brand assets) to improve and fine-tune certain internal AI models. We do not use Meta API data, Instagram or Facebook insights or media, Google API data, Third-party platform data, or Social login data for any AI model training. Training data is used only with your explicit opt-in consent. You may withdraw your consent at any time, and we will exclude your data from future training datasets.
              </p>

              <h3 className="font-bold mt-8">6. Payments</h3>
              <p>Payments are processed securely by Razorpay. OptimX does not store card numbers or CVV.</p>

              <h3 className="font-bold mt-8">7. Data Sharing</h3>
              <p>We only share data with:</p>
              <ul className="list-disc ml-4">
                <li>AWS (hosting)</li>
                <li>Supabase (database)</li>
                <li>Meta & Google (API integrations)</li>
                <li>Razorpay (payments)</li>
                <li>Analytics providers (Google Analytics, Meta Analytics)</li>
              </ul>
              <p>All partners follow strict confidentiality and data-handling agreements.</p>

              <h3 className="font-bold mt-8">8. Data Storage &amp; Security</h3>
              <ul className="list-disc ml-4">
                <li>Encrypted tokens</li>
                <li>Encrypted database storage</li>
                <li>Role-based access</li>
                <li>Access logs & monitoring</li>
                <li>SSL-secured communication</li>
                <li>Regular security audits</li>
              </ul>

              <h3 className="font-bold mt-8">9. Data Retention</h3>
              <p>
                We keep your data only as long as needed: account lifetime, backup retention (limited duration). API tokens deleted immediately on revocation. You may request account deletion anytime.
              </p>

              <h3 className="font-bold mt-8">10. Your Rights</h3>
              <p>Depending on your region, you may have rights to access, correct, delete, restrict processing, revoke consent, or request account closure. Email: info@optimx.app</p>

              <h3 className="font-bold mt-8">11. Children’s Privacy</h3>
              <p>OptimX is not intended for users under 18.</p>

              <h3 className="font-bold mt-8">12. Beta Disclaimer</h3>
              <p>During the MVP/Beta phase: features may be incomplete, data accuracy may fluctuate, analytics may vary, outages may occur. Feedback is welcome to improve the platform.</p>

              <h3 className="font-bold mt-8">13. Updates to This Policy</h3>
              <p>We may update this Privacy Policy. Changes will be posted with an updated “Last Updated” date.</p>

              <h3 className="font-bold mt-8">14. Contact</h3>
              <p>
                Email: info@optimx.app
                <br />
                Address: Thiruvanmiyur, Chennai, India
              </p>
            </article>

            <div className="mt-8 flex justify-between items-center">
              <div className="flex items-center gap-3 text-sm" style={{ color: colors.mutedForeground }}>
                <Sparkles className="h-4 w-4" style={{ color: colors.primary }} />
                <span>OptimX — Privacy & Trust</span>
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

export default PrivacyPolicy;
