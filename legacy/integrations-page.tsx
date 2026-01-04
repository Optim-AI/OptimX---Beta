"use client";

import React, { useEffect, useRef, useState } from "react";
import { CreditCard, Zap, Users, Settings, Database, CheckCircle2, XCircle, Link as LinkIcon, Globe, ZapOff, ArrowRight, Sparkles } from "lucide-react";
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

const INTEGRATIONS = [
  { id: "meta", name: "Meta (Facebook & Instagram)", icon: LinkIcon, description: "Publishing, ads, and insights for Facebook & Instagram" },
  { id: "google", name: "Google (Ads & Analytics)", icon: Globe, description: "Analytics, Ads, and OAuth-based integrations" },
  { id: "razorpay", name: "Razorpay", icon: CreditCard, description: "Payments & billing" },
  { id: "supabase", name: "Supabase", icon: Database, description: "Storage and database (optional)" },
  { id: "linkedin", name: "LinkedIn", icon: Users, description: "Organic posting & company analytics" },
];

const IntegrationsPage: React.FC = () => {
  const topRef = useRef<HTMLElement | null>(null);
  const [status, setStatus] = useState<Record<string, { connected: boolean; details?: string }>>({});
  const [loadingId, setLoadingId] = useState<string | null>(null);

  useEffect(() => {
    topRef.current?.scrollTo({ top: 0 });

    // fake load existing integration state (replace with real API call)
    const initial: Record<string, { connected: boolean; details?: string }> = {
      meta: { connected: false },
      google: { connected: false },
      razorpay: { connected: false },
      supabase: { connected: true, details: "Bucket: campaign-assets" },
      linkedin: { connected: false },
    };
    setStatus(initial);
  }, []);

  const handleConnect = async (id: string) => {
    setLoadingId(id);
    try {
      // placeholder - in real app redirect to OAuth or open popup
      await new Promise((r) => setTimeout(r, 900));
      setStatus((s) => ({ ...s, [id]: { connected: true, details: id === "supabase" ? "Bucket: campaign-assets" : "Connected" } }));
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingId(null);
    }
  };

  const handleDisconnect = async (id: string) => {
    setLoadingId(id);
    try {
      await new Promise((r) => setTimeout(r, 700));
      setStatus((s) => ({ ...s, [id]: { connected: false } }));
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingId(null);
    }
  };

  const handleTest = async (id: string) => {
    setLoadingId(id);
    try {
      await new Promise((r) => setTimeout(r, 700));
      // fake success
      alert(`${INTEGRATIONS.find((i) => i.id === id)?.name} connection OK`);
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <main ref={topRef} className="min-h-screen pb-24 pt-20 relative overflow-hidden" style={{ backgroundColor: colors.background, color: colors.foreground }}>
      <style jsx>{`
        .animation-float { animation: floatY 6s ease-in-out infinite alternate; }
        @keyframes floatY { from { transform: translateY(-8px);} to { transform: translateY(8px);} }
        .glass-card { backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); }
      `}</style>

      <div className="absolute inset-0" style={{ backgroundImage: `linear-gradient(135deg, ${colors.background} 0%, ${withAlpha("hsl(213 90% 96%)", 0.28)} 40%, ${colors.background} 100%)` }} />
      <div className="absolute inset-0" style={{ background: colors.gradientMesh, opacity: 0.35 }} />
      <div className="absolute -left-10 top-16 w-72 h-72 rounded-full blur-3xl animation-float" style={{ backgroundColor: withAlpha(colors.primary, 0.28) }} />
      <div className="absolute right-10 bottom-20 w-96 h-96 rounded-full blur-3xl animation-float" style={{ backgroundColor: withAlpha(colors.primary, 0.18), animationDelay: "2s" }} />

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <header className="flex items-center gap-3 py-6">
          {/* <div className="w-12 h-12 rounded-md flex items-center justify-center glass-card" style={{ background: colors.card, border: `1px solid ${colors.border}`, boxShadow: colors.shadowStrong }}>
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
            <div className="text-sm text-[14px]" style={{ color: colors.mutedForeground }}>Integrations</div>
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
            <div className="mb-6">
              <h1 className="text-4xl font-extrabold mb-2" style={{ color: colors.foreground }}>Integrations</h1>
              <p className="text-lg" style={{ color: colors.mutedForeground }}>Connect platforms to enable publishing, ads, analytics, and payments. Only connect services you trust.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {INTEGRATIONS.map((int) => {
                const Icon = int.icon as any;
                const st = status[int.id] ?? { connected: false };
                return (
                  <div key={int.id} className="p-4 rounded-lg border flex items-start justify-between" style={{ borderColor: withAlpha(colors.border, 0.6), background: colors.card }}>
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 rounded-md flex items-center justify-center" style={{ background: withAlpha(colors.primary, 0.06) }}>
                        <Icon className="h-6 w-6" style={{ color: colors.primary }} />
                      </div>
                      <div>
                        <div style={{ color: colors.foreground, fontWeight: 700 }}>{int.name}</div>
                        <div style={{ color: colors.mutedForeground, fontSize: 13 }}>{int.description}</div>
                        {st.details && <div style={{ color: colors.mutedForeground, fontSize: 13, marginTop: 6 }}>{st.details}</div>}
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      {st.connected ? (
                        <>
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-5 w-5" style={{ color: colors.primary }} />
                            <div style={{ color: colors.foreground, fontWeight: 700 }}>Connected</div>
                          </div>

                          <div className="flex gap-2 mt-2">
                            <Button size="sm" variant="outline" onClick={() => handleTest(int.id)}>Test</Button>
                            <Button size="sm" variant="ghost" onClick={() => handleDisconnect(int.id)}>
                              <span className="flex items-center gap-2"><XCircle className="h-4 w-4" /> Disconnect</span>
                            </Button>
                          </div>
                        </>
                      ) : (
                        <div className="flex flex-col gap-2 items-end">
                          <div style={{ color: colors.mutedForeground }}>Not connected</div>
                          <div className="flex gap-2 mt-2">
                            <Button size="sm" onClick={() => handleConnect(int.id)} disabled={loadingId === int.id} style={{ background: colors.gradientPrimary, color: colors.primaryForeground }}>
                              {loadingId === int.id ? "Connecting..." : "Connect"}
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => alert('Learn more about ' + int.name)}>Learn</Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-8">
              <h3 style={{ color: colors.foreground }}>Developer Integrations</h3>
              <p style={{ color: colors.mutedForeground }}>Use our API or webhooks to integrate deeper. See the <a href="/pages/api-docs">API docs</a> for details.</p>

              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-lg border" style={{ borderColor: withAlpha(colors.border, 0.6), background: colors.card }}>
                  <div className="flex items-center gap-3 mb-2"><Settings className="h-5 w-5" style={{ color: colors.primary }} /><div style={{ color: colors.foreground, fontWeight: 700 }}>Webhooks</div></div>
                  <div style={{ color: colors.mutedForeground }}>Register webhooks to receive events (generation.completed, campaign.published). Verify with X-OptimX-Signature header.</div>
                </div>

                <div className="p-4 rounded-lg border" style={{ borderColor: withAlpha(colors.border, 0.6), background: colors.card }}>
                  <div className="flex items-center gap-3 mb-2"><Zap className="h-5 w-5" style={{ color: colors.primary }} /><div style={{ color: colors.foreground, fontWeight: 700 }}>Zapier & Integrations</div></div>
                  <div style={{ color: colors.mutedForeground }}>Trigger workflows and automations via Zapier or direct webhooks.</div>
                </div>
              </div>
            </div>

            <div className="mt-8 flex justify-between items-center">
              <div className="flex items-center gap-3 text-sm" style={{ color: colors.mutedForeground }}>
                <Sparkles className="h-4 w-4" style={{ color: colors.primary }} />
                <span>OptimX — Integrations</span>
              </div>

              <div className="flex items-center gap-3">
                {/* <Button size="sm" variant="outline" asChild>
                  <a href="#top" onClick={(e) => { e.preventDefault(); topRef.current?.scrollTo({ top: 0, behavior: 'smooth' }); }}>Back to top</a>
                </Button> */}
                <Button size="sm" style={{ background: colors.gradientPrimary, color: colors.primaryForeground }}>
                  <a href="/auth/signin" className="flex items-center gap-2">Create Account <ArrowRight className="h-4 w-4" /></a>
                </Button>
              </div>
            </div>

          </div>
        </section>
      </div>
    </main>
  );
};

export default IntegrationsPage;
