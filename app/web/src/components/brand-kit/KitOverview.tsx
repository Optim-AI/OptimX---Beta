// Saved Brand Kit at a glance: identity, colours, type, voice, rules, preview and where to use it.
import React from "react";
import Link from "next/link";
import { ArrowRight, Camera, Check, Globe, Image as ImageIcon, Orbit, Pencil, RefreshCw, Star } from "lucide-react";
import colors from "@/lib/ui/colors";
import type { BrandColorRole, BrandKitInput } from "@/lib/brand-kit/types";

const ROLE_LABELS: Record<BrandColorRole, string> = {
  primary: "Primary",
  secondary: "Secondary",
  accent: "Accent",
  background: "Background",
  text: "Text",
};

const card: React.CSSProperties = { background: colors.card, border: `1px solid ${colors.border}` };

function readableOn(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return "#111111";
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16));
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? "#111111" : "#ffffff";
}

function Card(props: { title: string; action?: React.ReactNode; className?: string; children: React.ReactNode }) {
  return (
    <section className={`rounded-2xl p-5 ${props.className || ""}`} style={card}>
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide" style={{ color: colors.mutedForeground }}>{props.title}</h2>
        {props.action}
      </div>
      {props.children}
    </section>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  if (!value?.trim()) return null;
  return (
    <div>
      <dt className="text-[11px] font-medium" style={{ color: colors.mutedForeground }}>{label}</dt>
      <dd className="mt-0.5 text-sm leading-relaxed" style={{ color: colors.foreground }}>{value}</dd>
    </div>
  );
}

const NEXT_STEPS = [
  { href: "/photo-studio", label: "Photo Studio", hint: "Product photos in your brand colours", Icon: Camera },
  { href: "/brand-studio", label: "Brand Studio", hint: "Posters and videos with your logo and type", Icon: Orbit },
  { href: "/content-studio", label: "Ad Studio", hint: "Ad strategy and creatives for each product", Icon: ImageIcon },
];

export function KitOverview(props: {
  kit: BrandKitInput & { id: string | null };
  justCreated: boolean;
  preview: React.ReactNode;
  onEdit: (section?: string) => void;
  onReimport: () => void;
}) {
  const { kit } = props;
  const heading = kit.fonts.heading?.family || null;
  const body = kit.fonts.body?.family || null;
  const id = kit.identity;
  const rules = [
    ["Always include", kit.guidelines.mustInclude],
    ["Do", kit.guidelines.dos],
    ["Don't", kit.guidelines.donts],
  ] as const;
  const hasRules = rules.some(([, list]) => list.length > 0);
  const editLink = (section: string) => (
    <button type="button" onClick={() => props.onEdit(section)} className="inline-flex items-center gap-1 text-xs" style={{ color: colors.primary }}>
      <Pencil className="h-3 w-3" /> Edit
    </button>
  );

  return (
    <div className="space-y-5">
      {props.justCreated && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl px-5 py-4" style={{ background: `${colors.primary}14`, border: `1px solid ${colors.primary}55` }}>
          <span className="flex h-8 w-8 items-center justify-center rounded-full" style={{ background: colors.primary }}>
            <Check className="h-4 w-4 text-white" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold" style={{ color: colors.foreground }}>Your Brand Kit is ready</p>
            <p className="text-xs" style={{ color: colors.mutedForeground }}>
              Everything you create now uses this logo, these colours, fonts and rules. Pick where to start below.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-5">
          {/* Identity */}
          <section className="rounded-2xl p-5" style={card}>
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
              <div className="flex h-24 w-full shrink-0 items-center justify-center rounded-xl p-3 sm:w-36" style={{ background: "#f4f4f5" }}>
                {kit.logo?.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={kit.logo.url} alt={`${kit.name} logo`} className="max-h-full max-w-full object-contain" />
                ) : (
                  <span className="text-xs text-zinc-500">No logo yet</span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-semibold" style={{ color: colors.foreground, fontFamily: heading ? `"${heading}", system-ui, sans-serif` : undefined }}>{kit.name}</h2>
                  {kit.isDefault && (
                    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px]" style={{ background: colors.secondary, color: colors.mutedForeground }}>
                      <Star className="h-3 w-3" /> Default kit
                    </span>
                  )}
                </div>
                {id.tagline && <p className="mt-1 text-sm italic" style={{ color: colors.foreground }}>{id.tagline}</p>}
                {kit.websiteUrl && (
                  <p className="mt-1 inline-flex items-center gap-1 text-xs" style={{ color: colors.mutedForeground }}>
                    <Globe className="h-3 w-3" /> {kit.websiteUrl.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 gap-2">
                <button type="button" onClick={props.onReimport} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs"
                  style={{ border: `1px solid ${colors.border}`, color: colors.foreground }}>
                  <RefreshCw className="h-3.5 w-3.5" /> Update from website
                </button>
                <button type="button" onClick={() => props.onEdit()} className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium"
                  style={{ background: colors.primary, color: colors.primaryForeground }}>
                  <Pencil className="h-3.5 w-3.5" /> Edit kit
                </button>
              </div>
            </div>
          </section>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <Card title="Colours" action={editLink("kit-colours")}>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {kit.colors.map((c, i) => (
                  <div key={`${c.hex}-${i}`} className="overflow-hidden rounded-xl" style={{ border: `1px solid ${colors.border}` }}>
                    <div className="flex h-16 items-end p-2" style={{ background: c.hex }}>
                      <span className="text-[10px] font-medium" style={{ color: readableOn(c.hex) }}>{ROLE_LABELS[c.role]}</span>
                    </div>
                    <p className="px-2 py-1.5 font-mono text-[11px] uppercase" style={{ color: colors.mutedForeground }}>{c.hex}</p>
                  </div>
                ))}
              </div>
            </Card>

            <Card title="Typography" action={editLink("kit-typography")}>
              <div className="space-y-4">
                <div>
                  <p className="text-3xl font-bold leading-tight" style={{ color: colors.foreground, fontFamily: heading ? `"${heading}", system-ui, sans-serif` : undefined }}>Aa Headline</p>
                  <p className="mt-1 text-xs" style={{ color: colors.mutedForeground }}>Headlines · {heading || "Not set"}</p>
                </div>
                <div>
                  <p className="text-sm leading-relaxed" style={{ color: colors.foreground, fontFamily: body ? `"${body}", sans-serif` : undefined }}>
                    Supporting lines, buttons and captions are set in this font.
                  </p>
                  <p className="mt-1 text-xs" style={{ color: colors.mutedForeground }}>Body and buttons · {body || "Not set"}</p>
                </div>
              </div>
            </Card>
          </div>

          <Card title="About the brand" action={editLink("kit-about")}>
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Fact label="What the brand does" value={id.description} />
              <Fact label="What you sell" value={id.offering} />
              <Fact label="Who it's for" value={id.audience} />
              <Fact label="Main promise" value={id.valueProposition} />
              <Fact label="Tone of voice" value={id.tone} />
              <Fact label="Industry" value={id.industry} />
            </dl>
            {id.values.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {id.values.map((v) => (
                  <span key={v} className="rounded-full px-2.5 py-1 text-xs" style={{ background: colors.secondary, color: colors.foreground }}>{v}</span>
                ))}
              </div>
            )}
            {!id.description && !id.offering && !id.audience && (
              <p className="text-sm" style={{ color: colors.mutedForeground }}>Tell us what you do and who it&apos;s for, so captions and ad copy sound like you.</p>
            )}
          </Card>

          {hasRules && (
            <Card title="Brand rules" action={editLink("kit-rules")}>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {rules.map(([label, list]) =>
                  list.length ? (
                    <div key={label}>
                      <p className="text-[11px] font-medium" style={{ color: colors.mutedForeground }}>{label}</p>
                      <ul className="mt-1 space-y-1">
                        {list.map((r) => <li key={r} className="text-sm" style={{ color: colors.foreground }}>{r}</li>)}
                      </ul>
                    </div>
                  ) : null
                )}
              </div>
            </Card>
          )}
        </div>

        <aside className="space-y-5 lg:sticky lg:top-6 lg:self-start">
          <div>
            <p className="mb-2 text-xs font-medium" style={{ color: colors.mutedForeground }}>Preview</p>
            {props.preview}
          </div>
          <section className="rounded-2xl p-4" style={card}>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide" style={{ color: colors.mutedForeground }}>Create with this kit</p>
            <div className="space-y-2">
              {NEXT_STEPS.map(({ href, label, hint, Icon }) => (
                <Link key={href} href={href} className="group flex items-center gap-3 rounded-xl p-2.5 transition-colors" style={{ background: colors.secondary }}>
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: colors.card, color: colors.primary }}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium" style={{ color: colors.foreground }}>{label}</span>
                    <span className="block truncate text-[11px]" style={{ color: colors.mutedForeground }}>{hint}</span>
                  </span>
                  <ArrowRight className="h-4 w-4 shrink-0 opacity-60 transition-transform group-hover:translate-x-0.5" style={{ color: colors.foreground }} />
                </Link>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

/** First-time setup: what to do, step by step. */
export function SetupGuide(props: { step: 1 | 2 | 3; importing: boolean }) {
  const steps = [
    { n: 1, title: "Paste your website", body: "We read it to find your logo, colours and fonts, and to learn what you sell and who it's for." },
    { n: 2, title: "Check what we found", body: "Swap the logo, give each colour a role, change the fonts, and fix anything about the brand." },
    { n: 3, title: "Save your kit", body: "Photo Studio, Brand Studio and Ad Studio use it for everything you create." },
  ] as const;
  return (
    <section className="rounded-2xl p-5" style={{ background: `linear-gradient(135deg, ${colors.primary}1f, ${colors.card})`, border: `1px solid ${colors.primary}55` }}>
      <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: colors.primary }}>Welcome — let&apos;s set up your brand</p>
      <h2 className="mt-1 text-lg font-semibold" style={{ color: colors.foreground }}>Start with your Brand Kit. It takes about a minute.</h2>
      <ol className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {steps.map((s) => {
          const done = s.n < props.step;
          const current = s.n === props.step;
          return (
            <li key={s.n} className="rounded-xl p-3" style={{ background: colors.card, border: `1px solid ${current ? colors.primary : colors.border}`, opacity: done || current ? 1 : 0.7 }}>
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold"
                  style={done ? { background: colors.primary, color: "#fff" } : current ? { background: `${colors.primary}26`, color: colors.primary } : { background: colors.secondary, color: colors.mutedForeground }}>
                  {done ? <Check className="h-3.5 w-3.5" /> : s.n}
                </span>
                <p className="text-sm font-medium" style={{ color: colors.foreground }}>
                  {s.title}
                  {current && s.n === 1 && props.importing ? "…" : ""}
                </p>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed" style={{ color: colors.mutedForeground }}>{s.body}</p>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/** After the website import: what to review, with jump links to each section. */
export function ReviewTips(props: { onDismiss: () => void }) {
  const tips = [
    ["kit-logo", "Logo", "Pick another logo we found, or paste a link to a transparent PNG/SVG."],
    ["kit-colours", "Colours", "Give each colour a role: primary, secondary, accent, background, text."],
    ["kit-typography", "Typography", "Change the headline and body fonts if these aren't yours."],
    ["kit-about", "About the brand", "Your promise, audience and tone shape every caption and ad line."],
    ["kit-rules", "Brand rules", "Optional: things every creative must (or must never) include."],
  ] as const;
  return (
    <section className="rounded-2xl p-5" style={{ background: colors.card, border: `1px solid ${colors.primary}55` }}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold" style={{ color: colors.foreground }}>We filled in your kit — check these, then save</p>
          <p className="mt-0.5 text-xs" style={{ color: colors.mutedForeground }}>Everything is editable. The preview on the right updates as you change things.</p>
        </div>
        <button type="button" onClick={props.onDismiss} className="text-xs" style={{ color: colors.mutedForeground }}>Hide</button>
      </div>
      <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {tips.map(([id, title, body]) => (
          <li key={id}>
            <a href={`#${id}`} className="block rounded-lg p-2.5 transition-colors" style={{ background: colors.secondary }}>
              <span className="block text-sm font-medium" style={{ color: colors.foreground }}>{title} →</span>
              <span className="block text-xs" style={{ color: colors.mutedForeground }}>{body}</span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
