// pages/brand-kit.tsx
import React, { useCallback, useEffect, useMemo, useState } from "react";
import type { JSX } from "react";
import Head from "next/head";
import Sidebar from "../app/web/src/components/Sidebar";
import { Button } from "../app/web/src/components/ui/button";
import colors from "@/lib/ui/colors";
import { authFetch } from "@/lib/utils";
import { showConfirm } from "@/app/web/src/components/ui/alert-modal-api";
import { toast } from "sonner";
import { mapFullAnalyzeToBrandSnapshot } from "@/app/web/src/components/creative-studio/utils";
import { identityFromSnapshot } from "@/lib/brand-kit/snapshot";
import { Globe, Loader2, Plus, Trash2, Star, X } from "lucide-react";
import {
  BRAND_COLOR_ROLES,
  BRAND_FONT_SOURCES,
  normalizeHex,
  EMPTY_IDENTITY,
  type BrandColorRole,
  type BrandKit,
  type BrandKitExtraction,
  type BrandKitFont,
  type BrandKitInput,
} from "@/lib/brand-kit/types";

const ROLE_LABELS: Record<BrandColorRole, string> = {
  primary: "Primary",
  secondary: "Secondary",
  accent: "Accent",
  background: "Background",
  text: "Text",
};

const SOURCE_LABELS: Record<BrandKitFont["source"], string> = {
  google: "Google Fonts",
  custom: "Brand font file",
  system: "System font",
};

const POPULAR_FONTS = [
  "Inter", "Poppins", "Montserrat", "Playfair Display", "Lora", "DM Sans", "Manrope",
  "Roboto", "Open Sans", "Lato", "Work Sans", "Space Grotesk", "Bebas Neue", "Oswald",
  "Cormorant Garamond", "Libre Baskerville", "Nunito", "Raleway", "Archivo", "Jost",
];

type Draft = BrandKitInput & { id: string | null };

function emptyDraft(): Draft {
  return {
    id: null,
    name: "",
    websiteUrl: null,
    isDefault: false,
    logo: null,
    colors: [
      { hex: "#1f3a8a", role: "primary" },
      { hex: "#ffffff", role: "background" },
      { hex: "#111111", role: "text" },
    ],
    fonts: { heading: null, body: null },
    guidelines: { mustInclude: [], dos: [], donts: [] },
    identity: { ...EMPTY_IDENTITY },
  };
}

function kitToDraft(kit: BrandKit): Draft {
  const { createdAt: _c, updatedAt: _u, ...rest } = kit;
  return { ...rest, id: kit.id };
}

function draftPayload(d: Draft): BrandKitInput {
  const { id: _id, ...rest } = d;
  return rest;
}

function linesToList(text: string): string[] {
  return text.split("\n").map((l) => l.trim()).filter(Boolean);
}

function googleFontHref(families: string[]): string | null {
  const uniq = [...new Set(families.filter(Boolean))];
  if (!uniq.length) return null;
  const q = uniq.map((f) => `family=${encodeURIComponent(f).replace(/%20/g, "+")}:wght@400;600;700`).join("&");
  return `https://fonts.googleapis.com/css2?${q}&display=swap`;
}

function pickColor(d: Draft, role: BrandColorRole, fallback: string): string {
  return d.colors.find((c) => c.role === role)?.hex || fallback;
}

/** Readable text colour (dark or light) for a background hex. */
function contrastOn(hex: string): string {
  const n = normalizeHex(hex) || "#000000";
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(n.slice(i, i + 2), 16));
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? "#111111" : "#ffffff";
}

const fieldStyle: React.CSSProperties = {
  background: colors.secondary,
  border: `1px solid ${colors.border}`,
  color: colors.foreground,
};
const inputClass = "w-full rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/60";

function Section(props: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl p-5" style={{ background: colors.card, border: `1px solid ${colors.border}` }}>
      <h2 className="text-sm font-semibold" style={{ color: colors.foreground }}>{props.title}</h2>
      {props.hint && <p className="mt-1 text-xs" style={{ color: colors.mutedForeground }}>{props.hint}</p>}
      <div className="mt-4 space-y-3">{props.children}</div>
    </section>
  );
}

function Label(props: { htmlFor?: string; children: React.ReactNode }) {
  return (
    <label htmlFor={props.htmlFor} className="mb-1 block text-xs font-medium" style={{ color: colors.mutedForeground }}>
      {props.children}
    </label>
  );
}

function FontField(props: {
  id: string;
  label: string;
  value: BrandKitFont | null;
  suggestions: string[];
  /** Known source for a family (Google list, or what the site import found) */
  sourceFor: (family: string) => BrandKitFont["source"] | null;
  onChange: (font: BrandKitFont | null) => void;
}) {
  const { value } = props;
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_170px]">
      <div>
        <Label htmlFor={props.id}>{props.label}</Label>
        <input
          id={props.id}
          list={`${props.id}-list`}
          className={inputClass}
          style={fieldStyle}
          placeholder="e.g. Playfair Display"
          value={value?.family || ""}
          onChange={(e) => {
            const family = e.target.value;
            const known = family ? props.sourceFor(family) : null;
            props.onChange(
              family
                ? {
                    family,
                    source: known || value?.source || "google",
                    url: known && known !== value?.source ? null : value?.url ?? null,
                  }
                : null
            );
          }}
        />
        <datalist id={`${props.id}-list`}>
          {props.suggestions.map((f) => <option key={f} value={f} />)}
        </datalist>
      </div>
      <div>
        <Label htmlFor={`${props.id}-source`}>Source</Label>
        <select
          id={`${props.id}-source`}
          className={inputClass}
          style={fieldStyle}
          value={value?.source || "google"}
          disabled={!value}
          onChange={(e) => value && props.onChange({ ...value, source: e.target.value as BrandKitFont["source"] })}
        >
          {BRAND_FONT_SOURCES.map((s) => <option key={s} value={s}>{SOURCE_LABELS[s]}</option>)}
        </select>
      </div>
    </div>
  );
}

function PosterPreview({ draft }: { draft: Draft }) {
  const bg = pickColor(draft, "background", "#ffffff");
  const text = pickColor(draft, "text", contrastOn(bg));
  const primary = pickColor(draft, "primary", "#1f3a8a");
  const accent = pickColor(draft, "secondary", pickColor(draft, "accent", primary));
  const heading = draft.fonts.heading?.family || draft.fonts.body?.family || "Georgia";
  const body = draft.fonts.body?.family || heading;
  return (
    <div
      className="relative aspect-[4/5] w-full overflow-hidden rounded-xl"
      style={{ background: bg, border: `1px solid ${colors.border}` }}
      aria-label="Poster preview using this kit"
    >
      <div className="absolute inset-x-0 bottom-0 h-1/2" style={{ background: `linear-gradient(160deg, ${primary}22, ${accent}33)` }} />
      <div className="absolute bottom-[14%] right-[8%] h-[38%] w-[34%] rounded-2xl" style={{ background: primary, opacity: 0.9 }} />
      <div className="absolute bottom-[22%] right-[30%] h-[18%] w-[18%] rounded-full" style={{ background: accent }} />
      <div className="absolute left-[7%] top-[6%] flex h-[7%] max-w-[40%] items-center">
        {draft.logo?.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={draft.logo.url} alt={`${draft.name || "Brand"} logo`} className="max-h-full max-w-full object-contain" />
        ) : (
          <span className="text-xs font-semibold" style={{ color: text, fontFamily: heading }}>{draft.name || "Your logo"}</span>
        )}
      </div>
      <div className="absolute left-[7%] right-[7%] top-[20%]">
        <p className="text-[clamp(18px,3.4vw,30px)] font-bold leading-tight" style={{ color: primary, fontFamily: `"${heading}", serif` }}>
          New season,<br />same you.
        </p>
        <p className="mt-2 text-[clamp(10px,1.4vw,13px)]" style={{ color: text, fontFamily: `"${body}", sans-serif` }}>
          Your headline, product line and CTA use these fonts and colours.
        </p>
      </div>
      <div
        className="absolute bottom-[7%] left-[7%] rounded-full px-4 py-1.5 text-[clamp(9px,1.2vw,12px)] font-semibold"
        style={{ background: primary, color: contrastOn(primary), fontFamily: `"${body}", sans-serif` }}
      >
        Shop now
      </div>
    </div>
  );
}

export default function BrandKitPage(): JSX.Element {
  const [kits, setKits] = useState<BrandKit[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [saved, setSaved] = useState<string>(JSON.stringify(emptyDraft()));
  const [saving, setSaving] = useState(false);
  const [importUrl, setImportUrl] = useState("");
  const [importing, setImporting] = useState<null | "styles" | "brand">(null);
  const [extraction, setExtraction] = useState<BrandKitExtraction | null>(null);
  const [rulesText, setRulesText] = useState({ mustInclude: "", dos: "", donts: "" });
  const [valuesText, setValuesText] = useState("");

  const dirty = JSON.stringify(draft) !== saved;

  const selectDraft = useCallback((d: Draft) => {
    setDraft(d);
    setSaved(JSON.stringify(d));
    setExtraction(null);
    setImportUrl(d.websiteUrl || "");
    setRulesText({
      mustInclude: d.guidelines.mustInclude.join("\n"),
      dos: d.guidelines.dos.join("\n"),
      donts: d.guidelines.donts.join("\n"),
    });
    setValuesText(d.identity.values.join("\n"));
  }, []);

  const loadKits = useCallback(async (selectId?: string | null) => {
    try {
      const res = await authFetch("/api/brand-kits");
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Could not load brand kits.");
      const list: BrandKit[] = json.kits || [];
      setKits(list);
      const pick = list.find((k) => k.id === selectId) || list[0];
      selectDraft(pick ? kitToDraft(pick) : emptyDraft());
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [selectDraft]);

  useEffect(() => {
    void loadKits();
  }, [loadKits]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const fontHref = useMemo(
    () =>
      googleFontHref(
        [draft.fonts.heading, draft.fonts.body]
          .filter((f): f is BrandKitFont => !!f && f.source === "google")
          .map((f) => f.family)
      ),
    [draft.fonts]
  );

  const fontSuggestions = useMemo(
    () => [...new Set([...(extraction?.fonts.all.map((f) => f.family) || []), ...POPULAR_FONTS])],
    [extraction]
  );

  const fontSourceFor = useCallback(
    (family: string): BrandKitFont["source"] | null => {
      const key = family.trim().toLowerCase();
      const found = extraction?.fonts.all.find((f) => f.family.toLowerCase() === key);
      if (found) return found.source;
      return POPULAR_FONTS.some((f) => f.toLowerCase() === key) ? "google" : null;
    },
    [extraction]
  );

  async function confirmDiscard(): Promise<boolean> {
    if (!dirty) return true;
    return showConfirm("You have unsaved changes to this kit. Discard them?", {
      title: "Discard changes?",
      confirmLabel: "Discard",
    });
  }

  async function handleImport() {
    const url = importUrl.trim();
    if (!url) return;
    // Importing another brand's site into this kit would mix two brands.
    const hostOf = (u: string) => {
      try {
        return new URL(/^https?:\/\//i.test(u) ? u : `https://${u}`).hostname.replace(/^www\./, "").toLowerCase();
      } catch {
        return "";
      }
    };
    const kitHost = draft.websiteUrl ? hostOf(draft.websiteUrl) : "";
    if (draft.id && kitHost && hostOf(url) && hostOf(url) !== kitHost) {
      const startNew = await showConfirm(
        `This kit is for ${kitHost}. Import ${hostOf(url)} into a new kit instead?`,
        { title: "Different website", confirmLabel: "New kit", cancelLabel: "Update this kit" }
      );
      if (startNew) {
        if (!(await confirmDiscard())) return;
        selectDraft(emptyDraft());
        setImportUrl(url);
      }
    } else if (draft.id && !kitHost && draft.name.trim() && hostOf(url)) {
      const sameBrand = await showConfirm(
        `Is ${hostOf(url)} the website for ${draft.name.trim()}?`,
        { title: "Confirm website", confirmLabel: `Yes, update ${draft.name.trim()}`, cancelLabel: "No, new kit" }
      );
      if (!sameBrand) {
        if (!(await confirmDiscard())) return;
        selectDraft(emptyDraft());
        setImportUrl(url);
      }
    }
    setImporting("styles");
    // Two reads in parallel: the site's styles (fast) and what the brand is (AI analysis, slower).
    const styles = authFetch("/api/brand-kits/extract", { method: "POST", body: JSON.stringify({ url }) })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || "Could not read that website.");
        const ex: BrandKitExtraction = json.extraction;
        setExtraction(ex);
        setDraft((d) => ({
          ...d,
          name: d.name || ex.name || "",
          websiteUrl: ex.url,
          logo: ex.logoCandidates[0] ? { url: ex.logoCandidates[0].url, darkUrl: d.logo?.darkUrl ?? null } : d.logo,
          colors: ex.colors.length ? ex.colors.map(({ hex, role }) => ({ hex, role })) : d.colors,
          fonts: {
            heading: ex.fonts.heading ?? d.fonts.heading,
            body: ex.fonts.body ?? d.fonts.body,
          },
        }));
        setImporting((cur) => (cur === "styles" ? "brand" : cur));
        return true;
      });
    // The brand analysis needs a full URL ("skalxai.app" → "https://skalxai.app").
    const fullUrl = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    const brand = authFetch("/api/brand/fullAnalyze", { method: "POST", body: JSON.stringify({ url: fullUrl }) })
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok || !json?.result) throw new Error(json?.error || "Could not analyse the brand.");
        const found = identityFromSnapshot(mapFullAnalyzeToBrandSnapshot(json.result));
        const foundName = json.result?.facts?.company_name;
        // Only fill empty fields so re-importing never overwrites what you wrote.
        setDraft((d) => {
          const identity = { ...d.identity };
          for (const key of Object.keys(found) as Array<keyof typeof found>) {
            const cur = identity[key];
            const next = found[key];
            const isEmpty = (v: unknown) => v == null || v === "" || (Array.isArray(v) && v.length === 0);
            if (isEmpty(cur) && !isEmpty(next)) (identity as Record<string, unknown>)[key] = next;
          }
          if (!d.identity.values.length && identity.values.length) setValuesText(identity.values.join("\n"));
          return { ...d, name: d.name || (typeof foundName === "string" && foundName !== "Unknown Brand" ? foundName : ""), identity };
        });
        return true;
      });
    const [stylesResult, brandResult] = await Promise.allSettled([styles, brand]);
    setImporting(null);
    if (stylesResult.status === "fulfilled" && brandResult.status === "fulfilled") {
      toast.success("Imported your brand and its look. Check each section, then save.");
    } else if (stylesResult.status === "fulfilled") {
      toast.warning("Imported your logo, colours and fonts. We couldn't analyse the brand itself — fill in 'About the brand' by hand.");
    } else if (brandResult.status === "fulfilled") {
      toast.warning("Imported 'About the brand'. We couldn't read the site's styles — set the logo, colours and fonts by hand.");
    } else {
      toast.error((stylesResult.reason as Error)?.message || "Could not read that website.");
    }
  }

  async function handleSave() {
    setSaving(true);
    const payload = draftPayload({
      ...draft,
      guidelines: {
        mustInclude: linesToList(rulesText.mustInclude),
        dos: linesToList(rulesText.dos),
        donts: linesToList(rulesText.donts),
      },
    });
    try {
      const res = await authFetch(draft.id ? `/api/brand-kits/${draft.id}` : "/api/brand-kits", {
        method: draft.id ? "PUT" : "POST",
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Could not save the brand kit.");
      toast.success("Brand kit saved.");
      await loadKits(json.kit.id);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!draft.id) return;
    const ok = await showConfirm(`Delete the "${draft.name}" brand kit? This can't be undone.`, {
      title: "Delete brand kit",
      confirmLabel: "Delete",
    });
    if (!ok) return;
    const res = await authFetch(`/api/brand-kits/${draft.id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Could not delete the brand kit.");
      return;
    }
    toast.success("Brand kit deleted.");
    await loadKits();
  }

  function setIdentity(patch: Partial<BrandKitInput["identity"]>) {
    setDraft((d) => ({ ...d, identity: { ...d.identity, ...patch } }));
  }

  function updateColor(i: number, patch: Partial<{ hex: string; role: BrandColorRole }>) {
    setDraft((d) => ({ ...d, colors: d.colors.map((c, j) => (j === i ? { ...c, ...patch } : c)) }));
  }

  if (loading) {
    return (
      <div className="min-h-screen flex app-page" style={{ background: colors.background }}>
        <Sidebar />
        <main className="flex-1 flex items-center justify-center p-6">
          <p style={{ color: colors.mutedForeground, fontSize: 15 }}>Loading brand kits…</p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex app-page" style={{ background: colors.background }}>
      <Head>
        <title>Brand Kit | SkalX AI</title>
        {fontHref && <link rel="stylesheet" href={fontHref} />}
      </Head>
      <Sidebar />
      <main className="min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
          <header className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold" style={{ color: colors.foreground }}>Brand Kit</h1>
              <p className="mt-1 max-w-2xl text-sm" style={{ color: colors.mutedForeground }}>
                Your brand&apos;s design system. Posters use your default kit&apos;s logo, colours, fonts and rules,
                and it takes priority over the visual theme you pick.
              </p>
            </div>
          </header>

          <nav className="mt-6 flex flex-wrap items-center gap-2" aria-label="Brand kits">
            {kits.map((k) => {
              const active = k.id === draft.id;
              return (
                <button
                  key={k.id}
                  type="button"
                  onClick={async () => { if (!active && (await confirmDiscard())) selectDraft(kitToDraft(k)); }}
                  className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm"
                  style={{
                    background: active ? colors.accent : colors.secondary,
                    color: active ? colors.accentForeground : colors.secondaryForeground,
                    border: `1px solid ${active ? colors.primary : colors.border}`,
                  }}
                  aria-current={active ? "true" : undefined}
                >
                  {k.isDefault && <Star className="h-3.5 w-3.5" aria-label="Default kit" />}
                  {k.name}
                </button>
              );
            })}
            <button
              type="button"
              onClick={async () => { if (await confirmDiscard()) selectDraft(emptyDraft()); }}
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm"
              style={{ background: "transparent", color: colors.mutedForeground, border: `1px dashed ${colors.border}` }}
            >
              <Plus className="h-3.5 w-3.5" /> New kit
            </button>
          </nav>

          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="min-w-0 space-y-5">
              <Section
                title={draft.id ? "Update from your website" : "Start from your website"}
                hint="We read your site to learn what your brand is about and to find its logo, colours and fonts. Review everything before saving."
              >
                <form
                  className="flex flex-col gap-2 sm:flex-row"
                  onSubmit={(e) => { e.preventDefault(); void handleImport(); }}
                >
                  <div className="relative flex-1">
                    <Globe className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: colors.mutedForeground }} />
                    <input
                      aria-label="Website URL"
                      className={`${inputClass} pl-9`}
                      style={fieldStyle}
                      placeholder="yourbrand.com"
                      value={importUrl}
                      onChange={(e) => setImportUrl(e.target.value)}
                    />
                  </div>
                  <Button type="submit" disabled={!!importing || !importUrl.trim()}>
                    {importing ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {importing === "styles" ? "Reading site…" : "Understanding your brand…"}</>
                    ) : "Import"}
                  </Button>
                </form>
                {extraction?.warnings.length ? (
                  <ul className="list-disc pl-5 text-xs" style={{ color: colors.mutedForeground }}>
                    {extraction.warnings.map((w) => <li key={w}>{w}</li>)}
                  </ul>
                ) : null}
              </Section>

              <Section title="Basics">
                <div>
                  <Label htmlFor="kit-name">Brand name</Label>
                  <input id="kit-name" className={inputClass} style={fieldStyle} value={draft.name}
                    onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} placeholder="e.g. FuelCo" />
                </div>
                <label className="flex items-center gap-2 text-sm" style={{ color: colors.foreground }}>
                  <input type="checkbox" checked={draft.isDefault || kits.length === 0 || (kits.length === 1 && !!draft.id)}
                    disabled={kits.length === 0 || (kits.length === 1 && !!draft.id)}
                    onChange={(e) => setDraft((d) => ({ ...d, isDefault: e.target.checked }))} />
                  Use this kit for new posters (default)
                </label>
              </Section>

              <Section title="About the brand" hint="What your posters and videos say comes from here: who you are, what you sell and how you sound.">
                <div>
                  <Label htmlFor="id-description">What the brand does</Label>
                  <textarea id="id-description" rows={2} className={inputClass} style={fieldStyle}
                    placeholder="e.g. Ready-to-eat protein breakfasts for busy mornings."
                    value={draft.identity.description}
                    onChange={(e) => setIdentity({ description: e.target.value })} />
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="id-tagline">Tagline</Label>
                    <input id="id-tagline" className={inputClass} style={fieldStyle} placeholder="e.g. Fuel your mornings"
                      value={draft.identity.tagline} onChange={(e) => setIdentity({ tagline: e.target.value })} />
                  </div>
                  <div>
                    <Label htmlFor="id-industry">Industry</Label>
                    <input id="id-industry" className={inputClass} style={fieldStyle} placeholder="e.g. Food & beverage"
                      value={draft.identity.industry} onChange={(e) => setIdentity({ industry: e.target.value })} />
                  </div>
                </div>
                <div>
                  <Label htmlFor="id-offering">What you sell</Label>
                  <textarea id="id-offering" rows={2} className={inputClass} style={fieldStyle}
                    placeholder="e.g. Protein oats, granola, overnight oats"
                    value={draft.identity.offering} onChange={(e) => setIdentity({ offering: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="id-audience">Who it&apos;s for</Label>
                  <textarea id="id-audience" rows={2} className={inputClass} style={fieldStyle}
                    placeholder="e.g. Working professionals who skip breakfast"
                    value={draft.identity.audience} onChange={(e) => setIdentity({ audience: e.target.value })} />
                </div>
                <div>
                  <Label htmlFor="id-value">Main promise to customers</Label>
                  <input id="id-value" className={inputClass} style={fieldStyle}
                    placeholder="e.g. A real breakfast in 3 minutes"
                    value={draft.identity.valueProposition} onChange={(e) => setIdentity({ valueProposition: e.target.value })} />
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="id-tone">Tone of voice</Label>
                    <input id="id-tone" className={inputClass} style={fieldStyle} placeholder="e.g. warm, confident, a little playful"
                      value={draft.identity.tone} onChange={(e) => setIdentity({ tone: e.target.value })} />
                  </div>
                  <div>
                    <Label htmlFor="id-values">Brand values (one per line)</Label>
                    <textarea id="id-values" rows={2} className={inputClass} style={fieldStyle} placeholder={"No added sugar\nMade in India"}
                      value={valuesText}
                      onChange={(e) => {
                        const value = e.target.value;
                        setValuesText(value);
                        setIdentity({ values: linesToList(value) });
                      }} />
                  </div>
                </div>
              </Section>

              <Section title="Logo" hint="Use a transparent PNG or SVG. Posters place it small and unaltered.">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                  <div
                    className="flex h-24 w-full shrink-0 items-center justify-center rounded-lg p-3 sm:w-40"
                    style={{ backgroundColor: "#f4f4f5", backgroundImage: "linear-gradient(45deg,#e4e4e7 25%,transparent 25%,transparent 75%,#e4e4e7 75%),linear-gradient(45deg,#e4e4e7 25%,transparent 25%,transparent 75%,#e4e4e7 75%)", backgroundSize: "14px 14px", backgroundPosition: "0 0,7px 7px" }}
                  >
                    {draft.logo?.url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={draft.logo.url} alt="Selected logo" className="max-h-full max-w-full object-contain" />
                    ) : (
                      <span className="text-xs text-zinc-500">No logo</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1 space-y-2">
                    <div>
                      <Label htmlFor="logo-url">Logo URL</Label>
                      <input id="logo-url" className={inputClass} style={fieldStyle} placeholder="https://…/logo.svg"
                        value={draft.logo?.url?.startsWith("data:") ? "(inline SVG from your site)" : draft.logo?.url || ""}
                        onChange={(e) => setDraft((d) => ({ ...d, logo: e.target.value ? { url: e.target.value, darkUrl: d.logo?.darkUrl ?? null } : null }))} />
                    </div>
                    {draft.logo?.url && (
                      <button type="button" className="text-xs underline" style={{ color: colors.mutedForeground }}
                        onClick={() => setDraft((d) => ({ ...d, logo: null }))}>Remove logo</button>
                    )}
                  </div>
                </div>
                {extraction && extraction.logoCandidates.length > 1 && (
                  <div>
                    <p className="mb-2 text-xs" style={{ color: colors.mutedForeground }}>Other logos found on your site:</p>
                    <div className="flex flex-wrap gap-2">
                      {extraction.logoCandidates.map((c) => (
                        <button key={c.url} type="button" title={c.source}
                          onClick={() => setDraft((d) => ({ ...d, logo: { url: c.url, darkUrl: d.logo?.darkUrl ?? null } }))}
                          className="flex h-14 w-20 items-center justify-center rounded-md bg-zinc-100 p-1.5"
                          style={{ outline: draft.logo?.url === c.url ? `2px solid ${colors.primary}` : "none" }}
                          aria-label={`Use logo from ${c.source}`}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={c.url} alt="" className="max-h-full max-w-full object-contain" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </Section>

              <Section title="Colours" hint="Give each colour a role so posters use them the way your brand does.">
                {draft.colors.map((c, i) => (
                  <div key={i} className="grid grid-cols-[44px_minmax(0,1fr)_minmax(0,1fr)_36px] items-center gap-2">
                    <input type="color" aria-label={`Colour ${i + 1}`} value={normalizeHex(c.hex) || "#000000"}
                      onChange={(e) => updateColor(i, { hex: e.target.value })}
                      className="h-10 w-11 cursor-pointer rounded-md border-0 bg-transparent p-0" />
                    <input aria-label={`Hex for colour ${i + 1}`} className={`${inputClass} font-mono`} style={fieldStyle}
                      value={c.hex} onChange={(e) => updateColor(i, { hex: e.target.value })} />
                    <select aria-label={`Role for colour ${i + 1}`} className={inputClass} style={fieldStyle} value={c.role}
                      onChange={(e) => updateColor(i, { role: e.target.value as BrandColorRole })}>
                      {BRAND_COLOR_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                    </select>
                    <button type="button" aria-label={`Remove colour ${i + 1}`} className="flex h-9 w-9 items-center justify-center rounded-md"
                      style={{ color: colors.mutedForeground }}
                      onClick={() => setDraft((d) => ({ ...d, colors: d.colors.filter((_, j) => j !== i) }))}>
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                {draft.colors.length < 8 && (
                  <button type="button" className="flex items-center gap-1.5 text-sm" style={{ color: colors.accentForeground }}
                    onClick={() => setDraft((d) => ({ ...d, colors: [...d.colors, { hex: "#888888", role: "accent" }] }))}>
                    <Plus className="h-4 w-4" /> Add colour
                  </button>
                )}
              </Section>

              <Section title="Typography" hint="Image models approximate fonts by name today; exact brand fonts on posters are coming next.">
                <FontField id="font-heading" label="Headline font" value={draft.fonts.heading} suggestions={fontSuggestions} sourceFor={fontSourceFor}
                  onChange={(f) => setDraft((d) => ({ ...d, fonts: { ...d.fonts, heading: f } }))} />
                <FontField id="font-body" label="Body and button font" value={draft.fonts.body} suggestions={fontSuggestions} sourceFor={fontSourceFor}
                  onChange={(f) => setDraft((d) => ({ ...d, fonts: { ...d.fonts, body: f } }))} />
              </Section>

              <Section title="Brand rules" hint="One rule per line. These are added to every poster brief.">
                {([
                  ["mustInclude", "Every poster must include", "Logo in the top-left corner\n@fuelco handle in the footer"],
                  ["dos", "Do", "Use lots of white space\nShow the product in natural light"],
                  ["donts", "Don't", "No gradients\nNo stock-photo models"],
                ] as const).map(([key, label, placeholder]) => (
                  <div key={key}>
                    <Label htmlFor={`rules-${key}`}>{label}</Label>
                    <textarea id={`rules-${key}`} rows={3} className={inputClass} style={fieldStyle} placeholder={placeholder}
                      value={rulesText[key]}
                      onChange={(e) => {
                        const value = e.target.value;
                        setRulesText((r) => ({ ...r, [key]: value }));
                        setDraft((d) => ({ ...d, guidelines: { ...d.guidelines, [key]: linesToList(value) } }));
                      }} />
                  </div>
                ))}
              </Section>

              <div className="flex flex-wrap items-center justify-between gap-3 pb-10">
                {draft.id ? (
                  <button type="button" onClick={() => void handleDelete()} className="flex items-center gap-1.5 text-sm"
                    style={{ color: colors.destructive }}>
                    <Trash2 className="h-4 w-4" /> Delete kit
                  </button>
                ) : <span />}
                <div className="flex items-center gap-3">
                  {dirty && <span className="text-xs" style={{ color: colors.mutedForeground }}>Unsaved changes</span>}
                  <Button type="button" onClick={() => void handleSave()} disabled={saving || !draft.name.trim()}>
                    {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving…</> : draft.id ? "Save changes" : "Create kit"}
                  </Button>
                </div>
              </div>
            </div>

            <aside className="lg:sticky lg:top-6 lg:self-start">
              <p className="mb-2 text-xs font-medium" style={{ color: colors.mutedForeground }}>Preview</p>
              <PosterPreview draft={draft} />
              <p className="mt-2 text-xs" style={{ color: colors.mutedForeground }}>
                A rough guide to how your kit is applied. Real posters follow your chosen concept and product.
              </p>
            </aside>
          </div>
        </div>
      </main>
    </div>
  );
}
