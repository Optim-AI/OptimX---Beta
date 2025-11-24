"use client";

import React, { useRef, useEffect } from "react";
import { 
  Instagram,
  Facebook,
  Linkedin,
  MessageCircle,
  Bell
} from "lucide-react";
import { Button } from "../app/web/src/components/ui/button";
import colors from "../lib/colors";
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

const Community: React.FC = () => {
  const topRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    topRef.current?.scrollTo({ top: 0 });
  }, []);

  // Company social links (update to real handles as needed)
  const handles = {
    instagram: "https://www.instagram.com/optimx.ai?igsh=MW4wcjN6NXByMmFqbg==",
    facebook: "https://www.facebook.com/share/1BNxZDcfRe/?mibextid=wwXIfr",
    linkedin: "https://www.linkedin.com/company/optimx-app",
    whatsapp: "https://wa.me/919003815101",
  } as const;

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
        .social-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; }
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
              <span style={{ color: colors.foreground }}>Optim</span>
              <span style={{ color: colors.primary, fontFamily: "inherit" }}>X</span>
            </div>
            <div className="text-sm text-[14px]" style={{ color: colors.mutedForeground }}>Community</div>
          </div> */}

          <Link href="/" className="flex items-center space-x-1" style={{ color: colors.foreground }}>
                      <img src="/images/OptimX_Logo.svg" alt="OptimX Logo" className="h-10 w-auto" />
                      <span className="text-xl font-bold" style={{ lineHeight: 1 }}>
                        <span style={{ color: colors.foreground }}>Optim</span>
                        <span style={{ color: colors.primary }}>X</span>
                      </span>
                    </Link>
        </header>

        <section className="max-w-6xl mx-auto mt-6">
          <div className="p-8 rounded-2xl glass-card border" style={{ borderColor: withAlpha(colors.border, 0.6), background: colors.card }}>
            <div className="mb-4">
              <h1 className="text-4xl font-extrabold mb-2" style={{ color: colors.foreground }}>Join the OptimX Community</h1>
              <p className="text-lg" style={{ color: colors.mutedForeground }}>
                Follow us, join discussions, get product updates, share feedback, and connect with other marketers and creators.
              </p>
            </div>

            <div className="mt-6 social-grid">
              {/* Primary social buttons */}
        
              <a href={handles.instagram} target="_blank" rel="noreferrer" className="flex items-center gap-3 p-4 rounded-lg border" style={{ borderColor: withAlpha(colors.border, 0.6), background: colors.card }}>
                <Instagram className="h-6 w-6" style={{ color: colors.primary }} />
                <div>
                  <div style={{ color: colors.foreground, fontWeight: 700 }}>Instagram</div>
                  <div style={{ color: colors.mutedForeground, fontSize: 13 }}>@optimx.app</div>
                </div>
              </a>

              <a href={handles.facebook} target="_blank" rel="noreferrer" className="flex items-center gap-3 p-4 rounded-lg border" style={{ borderColor: withAlpha(colors.border, 0.6), background: colors.card }}>
                <Facebook className="h-6 w-6" style={{ color: colors.primary }} />
                <div>
                  <div style={{ color: colors.foreground, fontWeight: 700 }}>Facebook</div>
                  <div style={{ color: colors.mutedForeground, fontSize: 13 }}>fb.com/optimx.app</div>
                </div>
              </a>

              <a href={handles.linkedin} target="_blank" rel="noreferrer" className="flex items-center gap-3 p-4 rounded-lg border" style={{ borderColor: withAlpha(colors.border, 0.6), background: colors.card }}>
                <Linkedin className="h-6 w-6" style={{ color: colors.primary }} />
                <div>
                  <div style={{ color: colors.foreground, fontWeight: 700 }}>LinkedIn</div>
                  <div style={{ color: colors.mutedForeground, fontSize: 13 }}>Company page</div>
                </div>
              </a>

              <a href={handles.whatsapp} target="_blank" rel="noreferrer" className="flex items-center gap-3 p-4 rounded-lg border" style={{ borderColor: withAlpha(colors.border, 0.6), background: colors.card }}>
                <Bell className="h-6 w-6" style={{ color: colors.primary }} />
                <div>
                  <div style={{ color: colors.foreground, fontWeight: 700 }}>WhatsApp</div>
                  <div style={{ color: colors.mutedForeground, fontSize: 13 }}>Message our support</div>
                </div>
              </a>

            </div>

            <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h3 style={{ color: colors.foreground }}>Community Guidelines</h3>
                <p style={{ color: colors.mutedForeground }}>
                  Be respectful. No abusive behaviour, spam, or promotion of illegal content. Share feedback, ask questions, and help each other grow.
                </p>
              </div>

              <div>
                <h3 style={{ color: colors.foreground }}>Need help?</h3>
                <p style={{ color: colors.mutedForeground }}>
                  Email: <strong>info@optimx.app</strong>
                  <br /> Join our Discord for real-time help and product announcements.
                </p>
                <div className="mt-3 flex gap-3">
                  <Button size="sm" variant="outline" asChild>
                    <a href={handles.discord} target="_blank" rel="noreferrer">Join Discord</a>
                  </Button>
                  <Button size="sm" style={{ background: colors.gradientPrimary, color: colors.primaryForeground }}>
                    <a href="/support" className="flex items-center gap-2">Contact Support</a>
                  </Button>
                </div>
              </div>
            </div>

            <div className="mt-8 flex justify-between items-center">
              <div className="flex items-center gap-3 text-sm" style={{ color: colors.mutedForeground }}>
                <Sparkles className="h-4 w-4" style={{ color: colors.primary }} />
                <span>OptimX — Connect &amp; Share</span>
              </div>

              <div className="flex items-center gap-3">
                {/* <Button size="sm" variant="outline" asChild>
                  <a href="#top" onClick={(e) => { e.preventDefault(); topRef.current?.scrollTo({ top: 0, behavior: 'smooth' }); }}>Back to top</a>
                </Button> */}
                <Button size="sm" style={{ background: colors.gradientPrimary, color: colors.primaryForeground }}>
                  <a href="/auth/signin" className="flex items-center gap-2">Start Free Trial</a>
                </Button>
              </div>
            </div>

          </div>
        </section>
      </div>
    </main>
  );
};

export default Community;
