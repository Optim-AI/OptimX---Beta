"use client";

import React, { useRef, useEffect } from "react";
import { Code, Server, Clipboard, BookOpen, Zap, ArrowRight } from "lucide-react";
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

const ApiDocs: React.FC = () => {
  const topRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    topRef.current?.scrollTo({ top: 0 });
  }, []);

  return (
    <main ref={topRef} className="min-h-screen pb-24 pt-20 relative overflow-hidden" style={{ backgroundColor: colors.background, color: colors.foreground }}>
      <style jsx>{`
        .animation-float { animation: floatY 6s ease-in-out infinite alternate; }
        @keyframes floatY { from { transform: translateY(-8px);} to { transform: translateY(8px);} }
        .glass-card { backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); }
        .code-block { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, "Roboto Mono", "Courier New", monospace; font-size: 13px; }
      `}</style>

      {/* Background layers + orbs */}
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
              <span style={{ color: colors.foreground }}>SkalX AI</span>
            </div>
            <div className="text-sm text-[14px]" style={{ color: colors.mutedForeground }}>API Documentation</div>
          </div> */}

          <Link href="/" className="flex items-center space-x-1" style={{ color: colors.foreground }}>
                      <img src="/images/Oli_AI_Logo.svg" alt="SkalX AI Logo" className="h-10 w-auto" />
<span className="text-xl font-bold" style={{ lineHeight: 1 }}>
                      <span style={{ color: colors.foreground }}>SkalX AI</span>
                    </span>
                    </Link>
        </header>

        <section className="max-w-6xl mx-auto mt-6">
          <div className="p-8 rounded-2xl glass-card border" style={{ borderColor: withAlpha(colors.border, 0.6), background: colors.card }}>
            <div className="mb-6">
              <h1 className="text-4xl font-extrabold mb-2" style={{ color: colors.foreground }}>SkalX AI API</h1>
              <p className="text-lg" style={{ color: colors.mutedForeground }}>RESTful endpoints to integrate with SkalX AI programmatically. Use your API token (found in the dashboard) to authenticate requests.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="p-4 rounded-lg" style={{ background: colors.card, border: `1px solid ${withAlpha(colors.border, 0.06)}` }}>
                <div className="flex items-center gap-3 mb-2"><Server className="h-5 w-5" style={{ color: colors.primary }} /><div style={{ color: colors.foreground, fontWeight: 700 }}>Base URL</div></div>
                <div className="text-sm code-block" style={{ color: colors.mutedForeground }}>https://api.optimx.app/v1</div>
              </div>

              <div className="p-4 rounded-lg" style={{ background: colors.card, border: `1px solid ${withAlpha(colors.border, 0.06)}` }}>
                <div className="flex items-center gap-3 mb-2"><Code className="h-5 w-5" style={{ color: colors.primary }} /><div style={{ color: colors.foreground, fontWeight: 700 }}>Auth</div></div>
                <div className="text-sm" style={{ color: colors.mutedForeground }}>Bearer token in <code>Authorization</code> header. Example: <span className="code-block">Authorization: Bearer &lt;API_KEY&gt;</span></div>
              </div>

              <div className="p-4 rounded-lg" style={{ background: colors.card, border: `1px solid ${withAlpha(colors.border, 0.06)}` }}>
                <div className="flex items-center gap-3 mb-2"><Clipboard className="h-5 w-5" style={{ color: colors.primary }} /><div style={{ color: colors.foreground, fontWeight: 700 }}>Rate Limits</div></div>
                <div className="text-sm" style={{ color: colors.mutedForeground }}>100 requests per minute per API key. 429 responses include <code>Retry-After</code>.</div>
              </div>
            </div>

            <div className="space-y-6">
              <section>
                <h3 style={{ color: colors.foreground }}>Authentication</h3>
                <p style={{ color: colors.mutedForeground }}>Obtain your API key from Dashboard → Settings → API. Keep it secret. Example request:</p>
                <pre className="p-4 rounded-md code-block" style={{ background: withAlpha(colors.primary, 0.03), color: colors.foreground }}>
{`curl -X GET \
  "https://api.optimx.app/v1/me" \
  -H "Authorization: Bearer <API_KEY>"`}
                </pre>
              </section>

              <section>
                <h3 style={{ color: colors.foreground }}>Endpoints</h3>

                <h4 style={{ color: colors.foreground }}>GET /v1/me</h4>
                <div style={{ color: colors.mutedForeground }}>Returns authenticated user profile.</div>
                <pre className="p-3 rounded-md code-block" style={{ background: withAlpha(colors.primary, 0.03), color: colors.foreground }}>
{`200 OK
{
  "id": "user_123",
  "email": "user@example.com",
  "name": "Acme Co"
}`}
                </pre>

                <h4 style={{ color: colors.foreground }}>POST /v1/generate</h4>
                <div style={{ color: colors.mutedForeground }}>Generate AI images or captions. Body: <code>{`{ type: "image" | "caption", prompt: string, options?: object }`}</code></div>
                <pre className="p-3 rounded-md code-block" style={{ background: withAlpha(colors.primary, 0.03), color: colors.foreground }}>
{`POST /v1/generate
Authorization: Bearer <API_KEY>
Content-Type: application/json

{
  "type": "image",
  "prompt": "A vibrant ad creative for a summer sale, 1080x1080",
  "options": { "aspect": "1:1" }
}`}
                </pre>

                <h4 style={{ color: colors.foreground }}>POST /v1/campaigns</h4>
                <div style={{ color: colors.mutedForeground }}>Create a campaign record. Includes campaign metadata and optionally references to generated assets.</div>
                <pre className="p-3 rounded-md code-block" style={{ background: withAlpha(colors.primary, 0.03), color: colors.foreground }}>
{`POST /v1/campaigns
Authorization: Bearer <API_KEY>
Content-Type: application/json

{
  "name": "June Promo",
  "objective": "LINK_CLICKS",
  "budget": 5000,
  "assets": ["https://.../image1.png"]
}`}
                </pre>

                <h4 style={{ color: colors.foreground }}>POST /v1/publish/facebook</h4>
                <div style={{ color: colors.mutedForeground }}>Server-side endpoint to run Meta campaigns and publish creatives. Accepts sanitized adAccountId, creative URLs, targeting, and scheduling. Requires connected Meta integration.</div>
              </section>

              <section>
                <h3 style={{ color: colors.foreground }}>File Uploads</h3>
                <p style={{ color: colors.mutedForeground }}>Upload images using a multipart POST to <code>/v1/uploads</code>. We store files in the <code>campaign-assets</code> bucket. Example:</p>
                <pre className="p-3 rounded-md code-block" style={{ background: withAlpha(colors.primary, 0.03), color: colors.foreground }}>
{`curl -X POST "https://api.optimx.app/v1/uploads" \
  -H "Authorization: Bearer <API_KEY>" \
  -F "file=@./creative.png"`}
                </pre>
              </section>

              <section>
                <h3 style={{ color: colors.foreground }}>Errors</h3>
                <div style={{ color: colors.mutedForeground }}>Standard JSON error responses:</div>
                <pre className="p-3 rounded-md code-block" style={{ background: withAlpha(colors.primary, 0.03), color: colors.foreground }}>
{`400 Bad Request
{
  "error": "invalid_input",
  "message": "Prompt is required"
}

429 Too Many Requests
{
  "error": "rate_limited",
  "message": "Rate limit exceeded"
}`}
                </pre>
              </section>

              <section>
                <h3 style={{ color: colors.foreground }}>Webhooks</h3>
                <p style={{ color: colors.mutedForeground }}>Register a webhook via <code>POST /v1/webhooks</code>. Events include <code>generation.completed</code>, <code>campaign.published</code>, and <code>insight.updated</code>. Verify signatures using the <code>X-OliAI-Signature</code> header.</p>
              </section>

              <section>
                <h3 style={{ color: colors.foreground }}>Security &amp; Best Practices</h3>
                <ul style={{ color: colors.mutedForeground }}>
                  <li>Rotate API keys periodically.</li>
                  <li>Keep tokens secret and never embed them in client-side code.</li>
                  <li>Validate webhook signatures before processing.</li>
                  <li>Respect rate limits and use exponential backoff on 429 responses.</li>
                </ul>
              </section>

              <section>
                <h3 style={{ color: colors.foreground }}>Support & Contact</h3>
                <p style={{ color: colors.mutedForeground }}>If you need API access, key rotation, or have issues, contact <strong>info@optimx.app</strong>. For urgent incidents, use the support ticketing system via the dashboard.</p>
              </section>

            </div>

            <div className="mt-8 flex justify-between items-center">
              <div className="flex items-center gap-3 text-sm" style={{ color: colors.mutedForeground }}>
                <Zap className="h-4 w-4" style={{ color: colors.primary }} />
                <span>SkalX AI — API & Integrations</span>
              </div>

              <div className="flex items-center gap-3">
                {/* <Button size="sm" variant="outline" asChild>
                  <a href="#top" onClick={(e) => { e.preventDefault(); topRef.current?.scrollTo({ top: 0, behavior: 'smooth' }); }}>Back to top</a>
                </Button> */}
                <Button size="sm" style={{ background: colors.gradientPrimary, color: colors.primaryForeground }}>
                  <a href="/auth/signin" className="flex items-center gap-2">Get started <ArrowRight className="h-4 w-4" /></a>
                </Button>
              </div>
            </div>

          </div>
        </section>
      </div>
    </main>
  );
};

export default ApiDocs;
