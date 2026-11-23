// Action cards under an agent reply: a clear button, what it does, and the credit cost.
// Nothing runs until the owner presses the button.
import React, { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { CalendarDays, Check, ChevronLeft, ChevronRight, Copy, Download, ExternalLink, Image as ImageIcon, Megaphone, Pencil, ScanSearch, Upload, X } from "lucide-react";
import PosterEditModal from "@/app/web/src/components/content-studio/PosterEditModal";
import { executePosterIterationClient, planPosterIterationClient } from "@/app/web/src/components/creative-studio/poster-engine-client";
import colors from "@/lib/ui/colors";
import { authFetch } from "@/lib/utils";
import { friendlyError } from "@/lib/api-errors";
import { supabase } from "@/auth/supabase/client";
import AgentOrb from "./AgentOrb";
import { FocusedReport } from "@/app/web/src/components/research/FocusedResearch";
import type { FocusedResearch } from "@/lib/research/focused-research";

export type AgentActionUI = {
  id: string;
  messageId: string | null;
  type: "posters" | "brand_posters" | "ad_pack" | "research" | "calendar";
  title: string;
  params: Record<string, unknown>;
  costCredits: number;
  costNote: string;
  status: string;
  error: string | null;
  result?: Record<string, unknown> | null;
};

type ProductPick = { ref: string } | { uploadPath: string; name: string } | null;
/** products: per post (by index) — the product on that poster, or null for a brand poster. */
export type PosterOptions = { selected: number[]; size: "feed" | "square" | "story"; product: ProductPick; products?: Record<number, ProductPick> };

const META = {
  posters: { Icon: ImageIcon, button: "Make posters", done: "Posters ready", where: "this chat" },
  brand_posters: { Icon: ImageIcon, button: "Open in Brand Studio", done: "Opened in Brand Studio", where: "Brand Studio" },
  ad_pack: { Icon: Megaphone, button: "Open in Ad Studio", done: "Opened in Ad Studio", where: "Ad Studio" },
  research: { Icon: ScanSearch, button: "Run research", done: "Research done, see below", where: "Brand Research" },
  calendar: { Icon: CalendarDays, button: "Draft calendar", done: "Calendar drafted, see below", where: "this chat" },
} as const;

function detail(a: AgentActionUI): string {
  const p = a.params;
  if (a.type === "brand_posters") return `${p.count ?? 1} poster${Number(p.count) > 1 ? "s" : ""}: ${p.brief ?? ""}`;
  if (a.type === "ad_pack") return [p.product, p.offer ? `Offer: ${p.offer}` : "", p.idea].filter(Boolean).join(" · ");
  if (a.type === "research") {
    const regions = Array.isArray(p.regionNames) ? (p.regionNames as string[]).join(", ") : "";
    return [p.product ? `Product: ${p.product}` : "", regions ? `Regions: ${regions}` : ""].filter(Boolean).join(" · ");
  }
  return `${p.weeks ?? 2} weeks${p.focus ? ` · ${p.focus}` : ""}`;
}

export function ActionCard({ a, running, balance, onRun, onDismiss, onStartPosters, onPostersChanged }: {
  a: AgentActionUI; running: boolean; balance: number | null; onRun: () => void; onDismiss: () => void;
  onStartPosters?: (a: AgentActionUI, o: PosterOptions) => void;
  /** An edited poster was saved: new result for this action */
  onPostersChanged?: (actionId: string, result: Record<string, unknown>) => void;
}) {
  if (a.type === "posters") return <PosterCard a={a} starting={running} balance={balance} onDismiss={onDismiss} onStart={(o) => onStartPosters?.(a, o)} onChanged={(r) => onPostersChanged?.(a.id, r)} />;
  const report = a.type === "research" && a.status === "done" ? ((a.result as { report?: FocusedResearch } | null)?.report ?? null) : null;
  if (report) return <ResearchCard report={report} />;
  const m = META[a.type];
  if (!m || a.status === "dismissed") return null;
  const done = a.status === "done";
  const short = a.costCredits > 0 && balance !== null && balance < a.costCredits;
  return (
    <div className="mt-3 rounded-xl border p-3.5" style={{ borderColor: done ? colors.border : "hsl(213 100% 55% / 0.35)", background: done ? "transparent" : "hsl(213 80% 18% / 0.25)" }}>
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: colors.accent, color: colors.accentForeground }}>
          <m.Icon size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-medium" style={{ color: colors.foreground }}>{a.title}</div>
          <p className="mt-0.5 line-clamp-3 text-[12.5px] leading-snug" style={{ color: colors.mutedForeground }}>{detail(a)}</p>
          <p className="mt-2 text-[12px]" style={{ color: colors.secondaryForeground }}>
            <span className="font-medium">Cost:</span> {a.costNote}
            {a.costCredits > 0 && balance !== null && <span style={{ color: short ? colors.destructive : colors.mutedForeground }}> You have {balance} image credit{balance === 1 ? "" : "s"}.</span>}
          </p>
          {a.status === "failed" && a.error && <p className="mt-1.5 text-[12px]" style={{ color: colors.destructive }}>{a.error}</p>}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
        {done ? (
          <span className="flex items-center gap-1.5 text-[12.5px]" style={{ color: colors.green600 }}><Check size={14} /> {m.done}</span>
        ) : running ? (
          <span className="flex items-center gap-2 text-[12.5px]" style={{ color: colors.accentForeground }}>
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
            {a.type === "research" ? "Researching… about 1–2 minutes" : a.type === "calendar" ? "Drafting…" : "Opening…"}
          </span>
        ) : (
          <>
            <button type="button" onClick={onDismiss} className="rounded-lg px-3 py-1.5 text-[13px] hover:bg-white/5" style={{ color: colors.mutedForeground }}>Not now</button>
            <button type="button" onClick={onRun} className="rounded-lg px-3.5 py-1.5 text-[13px] font-medium" style={{ background: colors.primary, color: colors.primaryForeground }}>
              {a.status === "failed" ? "Try again" : m.button}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ---------- Posters made in the chat ----------
type Post = { day: string; platform: string; idea: string; headline: string; caption: string; visual: string; scope?: "brand" | "product"; product?: string };
type Tile = { index: number; status: "queued" | "running" | "done" | "failed"; imageUrl?: string | null; error?: string | null; engineSessionId?: string | null; generationId?: string | null; edits?: number; productName?: string | null };
type ProductChoice = { id: string; name: string; image: string | null };

const SIZES = [
  { key: "feed", label: "Feed", ratio: "4 / 5", hint: "4:5" },
  { key: "square", label: "Square", ratio: "1 / 1", hint: "1:1" },
  { key: "story", label: "Story", ratio: "9 / 16", hint: "9:16" },
] as const;

function PosterCard({ a, starting, balance, onStart, onDismiss, onChanged }: {
  a: AgentActionUI; starting: boolean; balance: number | null; onStart: (o: PosterOptions) => void; onDismiss: () => void;
  onChanged: (result: Record<string, unknown>) => void;
}) {
  const posts = (Array.isArray(a.params.posts) ? a.params.posts : []) as Post[];
  const job = (a.result ?? null) as { items?: Tile[]; size?: PosterOptions["size"]; productName?: string | null; finishedAt?: string } | null;
  const [picked, setPicked] = useState<Set<number>>(() => new Set(posts.map((_, i) => i)));
  const [size, setSize] = useState<PosterOptions["size"]>("feed");
  const [products, setProducts] = useState<ProductChoice[] | null>(null);
  /** What goes on each poster: "brand", "ref:<product id>" or "upload" (the photo uploaded here). */
  const [onPoster, setOnPoster] = useState<Record<number, string>>({});
  const [uploaded, setUploaded] = useState<{ uploadPath: string; name: string } | null>(null);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [previewAt, setPreviewAt] = useState<number | null>(null);
  const [editing, setEditing] = useState<number | null>(null);
  const proposed = a.status === "proposed" || (a.status === "failed" && !job?.items?.length);

  useEffect(() => {
    if (!proposed || products) return;
    authFetch("/api/agent/actions?products=1").then((r) => r.json()).then((j) => setProducts(j.ok ? j.products : [])).catch(() => setProducts([]));
  }, [proposed, products]);

  // Default for each post: brand posts show the brand; product posts get the product the agent named.
  useEffect(() => {
    if (!products) return;
    setOnPoster((prev) => {
      const next = { ...prev };
      posts.forEach((p, i) => {
        if (next[i]) return;
        const wanted = (p.product || "").toLowerCase().trim();
        const match = wanted ? products.find((x) => x.name.toLowerCase() === wanted) ?? products.find((x) => x.name.toLowerCase().includes(wanted) || wanted.includes(x.name.toLowerCase())) : null;
        next[i] = p.scope === "product" && (match || products[0]) ? `ref:${(match || products[0])!.id}` : "brand";
      });
      return next;
    });
  }, [products, posts]);

  if (a.status === "dismissed") return null;

  const upload = async (file: File) => {
    setUploading(true);
    try {
      const res = await authFetch("/api/agent/actions", { method: "POST", body: JSON.stringify({ op: "upload", mime: file.type, size: file.size }) });
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error || "Upload failed.");
      const up = await supabase.storage.from("agent-context").uploadToSignedUrl(json.path, json.token, file, { contentType: file.type });
      if (up.error) throw new Error("Upload failed. Please try again.");
      setUploaded({ uploadPath: json.path, name: file.name.replace(/\.[a-z0-9]+$/i, "") });
      setUploadPreview(URL.createObjectURL(file));
      // A fresh photo goes on the product posts that had no product of their own yet.
      setOnPoster((prev) => {
        const next = { ...prev };
        posts.forEach((p, i) => { if (p.scope === "product" && (!next[i] || next[i] === "brand")) next[i] = "upload"; });
        return next;
      });
    } catch (e) {
      toast.error(friendlyError(e));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  // ----- After starting: tiles -----
  if (!proposed && job?.items?.length) {
    const ratio = SIZES.find((x) => x.key === job.size)?.ratio ?? "4 / 5";
    const done = job.items.filter((t) => t.status === "done").length;
    const working = !job.finishedAt && job.items.some((t) => t.status === "queued" || t.status === "running");
    return (
      <div className="mt-4 rounded-2xl border p-4" style={{ borderColor: colors.border, background: "hsl(0 0% 100% / 0.02)" }}>
        <div className="mb-3 flex items-center gap-2 text-[13px]" style={{ color: colors.secondaryForeground }}>
          {working ? <AgentOrb size={18} active /> : <Check size={15} style={{ color: colors.green600 }} />}
          <span>
            {working
              ? `Making ${job.items.length} poster${job.items.length > 1 ? "s" : ""}… about a minute each. You can keep chatting.`
              : `${done} of ${job.items.length} poster${job.items.length > 1 ? "s" : ""} ready · ${done} image credit${done === 1 ? "" : "s"} used`}
          </span>
        </div>
        <div className={`grid gap-3 ${job.size === "story" ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-2"}`}>
          {job.items.map((t) => {
            const post = posts[t.index];
            return (
              <figure key={t.index} className="min-w-0">
                <div className="relative overflow-hidden rounded-xl" style={{ aspectRatio: ratio, background: "hsl(0 0% 100% / 0.04)" }}>
                  {t.status === "done" && t.imageUrl ? (
                    <button type="button" className="group/tile block h-full w-full" title="Preview" onClick={() => setPreviewAt(t.index)}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={t.imageUrl} alt={post?.headline || post?.idea || "Poster"} className="h-full w-full object-cover transition-transform duration-300 group-hover/tile:scale-[1.02]" />
                      {!!t.edits && <span className="absolute left-2 top-2 rounded-full px-2 py-0.5 text-[10.5px] font-medium" style={{ background: "rgba(0,0,0,0.6)", color: "#fff" }}>Edited</span>}
                    </button>
                  ) : t.status === "failed" ? (
                    <div className="flex h-full items-center justify-center p-3 text-center text-[12px]" style={{ color: colors.mutedForeground }}>{t.error || "This one didn't work. You weren't charged."}</div>
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center gap-2 animate-pulse">
                      <AgentOrb size={30} active={t.status === "running"} />
                      <span className="text-[12px]" style={{ color: colors.mutedForeground }}>{t.status === "running" ? "Designing…" : "Waiting…"}</span>
                    </div>
                  )}
                </div>
                <figcaption className="mt-1.5 px-0.5">
                  <div className="truncate text-[12.5px] font-medium" style={{ color: colors.foreground }}>{[post?.day, post?.platform].filter(Boolean).join(" · ") || `Post ${t.index + 1}`}</div>
                  {t.status === "done" && (
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[12px]">
                      <button type="button" className="flex items-center gap-1 hover:underline" style={{ color: colors.accentForeground }} onClick={() => setPreviewAt(t.index)}>
                        <ImageIcon size={12} /> Preview
                      </button>
                      <button type="button" className="flex items-center gap-1 hover:underline" style={{ color: colors.accentForeground }} onClick={() => setEditing(t.index)}>
                        <Pencil size={12} /> Edit
                      </button>
                      {post?.caption && (
                        <button type="button" className="flex items-center gap-1 hover:underline" style={{ color: colors.accentForeground }}
                          onClick={() => navigator.clipboard?.writeText(post.caption).then(() => toast.success("Caption copied"), () => toast.error("Couldn't copy"))}>
                          <Copy size={12} /> Copy caption
                        </button>
                      )}

                    </div>
                  )}
                </figcaption>
              </figure>
            );
          })}
        </div>
        {!working && <p className="mt-3 text-[11.5px]" style={{ color: colors.mutedForeground }}>Saved to Generated Contents too. Edits cost 1 image credit each.</p>}
        {previewAt !== null && (
          <PosterPreview
            tiles={job.items.filter((t) => t.status === "done" && t.imageUrl)}
            posts={posts}
            startIndex={previewAt}
            onClose={() => setPreviewAt(null)}
            onEdit={(i) => { setPreviewAt(null); setEditing(i); }}
          />
        )}
        {editing !== null && (() => {
          const tile = job.items.find((t) => t.index === editing);
          return tile?.imageUrl ? (
            <InChatPosterEditor actionId={a.id} tile={tile} onClose={() => setEditing(null)} onSaved={onChanged} />
          ) : null;
        })()}
      </div>
    );
  }

  // ----- Before starting: choose posts, size and product -----
  const count = picked.size;
  const short = balance !== null && balance < count;
  return (
    <div className="mt-4 rounded-2xl border p-4" style={{ borderColor: "hsl(213 100% 55% / 0.35)", background: "hsl(213 80% 18% / 0.18)" }}>
      <div className="flex items-center gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: colors.accent, color: colors.accentForeground }}><ImageIcon size={16} /></span>
        <div className="text-[14.5px] font-medium" style={{ color: colors.foreground }}>{a.title}</div>
      </div>

      <div className="mt-3 space-y-1.5">
        {posts.map((p, i) => {
          const on = picked.has(i);
          return (
            <label key={i} className="flex cursor-pointer items-start gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-white/[0.03]"
              style={{ background: on ? "hsl(0 0% 100% / 0.03)" : "transparent" }}>
              <input type="checkbox" checked={on} className="mt-1 h-4 w-4 shrink-0 accent-[hsl(213_100%_55%)]"
                onChange={() => setPicked((s) => { const n = new Set(s); if (n.has(i)) n.delete(i); else n.add(i); return n; })} />
              <span className="min-w-0 flex-1">
                <span className="block text-[11.5px] font-medium uppercase tracking-[0.08em]" style={{ color: colors.mutedForeground }}>{[p.day, p.platform].filter(Boolean).join(" · ") || `Post ${i + 1}`}</span>
                <span className="mt-0.5 block text-[14px]" style={{ color: colors.foreground }}>{p.headline || p.idea}</span>
                {p.headline && p.idea && <span className="mt-0.5 block text-[12.5px] leading-snug" style={{ color: colors.mutedForeground }}>{p.idea}</span>}
                <span className="mt-2 flex flex-wrap items-center gap-2 text-[12.5px]" onClick={(e) => e.preventDefault()}>
                  <span style={{ color: colors.mutedForeground }}>On the poster:</span>
                  <select value={onPoster[i] ?? "brand"} onChange={(e) => setOnPoster((s) => ({ ...s, [i]: e.target.value }))}
                    aria-label={`What goes on poster ${i + 1}`}
                    className="max-w-[240px] rounded-md border px-2 py-1 text-[12.5px]"
                    style={{ background: colors.card, borderColor: colors.border, color: colors.foreground }}>
                    <option value="brand">My brand (no single product)</option>
                    {(products ?? []).map((x) => <option key={x.id} value={`ref:${x.id}`}>{x.name}</option>)}
                    {uploaded && <option value="upload">Your photo: {uploaded.name}</option>}
                  </select>
                </span>
              </span>
            </label>
          );
        })}
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-[auto_1fr]">
        <div>
          <div className="mb-1.5 text-[12px]" style={{ color: colors.mutedForeground }}>Size</div>
          <div className="inline-flex rounded-lg p-0.5" style={{ background: "hsl(0 0% 100% / 0.05)" }}>
            {SIZES.map((x) => (
              <button key={x.key} type="button" onClick={() => setSize(x.key)} title={x.hint}
                className="rounded-md px-3 py-1.5 text-[13px] transition-colors"
                style={size === x.key ? { background: colors.card, color: colors.foreground } : { color: colors.mutedForeground }}>
                {x.label}
              </button>
            ))}
          </div>
        </div>
        <div className="min-w-0">
          <div className="mb-1.5 text-[12px]" style={{ color: colors.mutedForeground }}>Product not in the list?</div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
              className="flex items-center gap-1.5 rounded-lg border py-1 pl-1.5 pr-2.5 text-[13px] disabled:opacity-50"
              style={{ borderColor: uploaded ? colors.primary : colors.border, color: colors.secondaryForeground }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {uploadPreview ? <img src={uploadPreview} alt="" className="h-7 w-7 rounded object-cover" /> : <Upload size={14} />}
              {uploading ? "Uploading…" : uploadPreview ? "Your photo" : "Upload a product photo"}
            </button>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); }} />
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-3.5" style={{ borderColor: "hsl(0 0% 100% / 0.08)" }}>
        <p className="text-[12.5px]" style={{ color: colors.secondaryForeground }}>
          <span className="font-medium">{count} image credit{count === 1 ? "" : "s"}</span>
          {balance !== null && <span style={{ color: short ? colors.destructive : colors.mutedForeground }}> · you have {balance}</span>}
          <span className="block text-[11.5px]" style={{ color: colors.mutedForeground }}>Only posters that come out right are charged.</span>
        </p>
        <div className="flex items-center gap-2">
          <button type="button" onClick={onDismiss} className="rounded-lg px-3 py-2 text-[13px] hover:bg-white/5" style={{ color: colors.mutedForeground }}>Not now</button>
          <button type="button" disabled={!count || short || starting || uploading}
            onClick={() => onStart({
              selected: [...picked].sort((x, y) => x - y),
              size,
              product: null,
              products: Object.fromEntries([...picked].map((i) => {
                const v = onPoster[i] ?? "brand";
                return [i, v === "upload" ? uploaded : v.startsWith("ref:") ? { ref: v.slice(4) } : null];
              })),
            })}
            className="rounded-lg px-4 py-2 text-[13px] font-medium disabled:opacity-40" style={{ background: colors.primary, color: colors.primaryForeground }}>
            {starting ? "Starting…" : `Make ${count} poster${count === 1 ? "" : "s"}`}
          </button>
        </div>
      </div>
      {a.status === "failed" && a.error && <p className="mt-2 text-[12px]" style={{ color: colors.destructive }}>{a.error}</p>}
    </div>
  );
}

// ---------- Research report shown in the chat ----------
function ResearchCard({ report }: { report: FocusedResearch }) {
  const [open, setOpen] = useState(false);
  const prices = report.price_landscape;
  const priceRows = prices ? ([["Budget", prices.budget], ["Typical", prices.typical], ["Premium", prices.premium]] as const).filter(([, v]) => v) : [];
  const competitors = (report.competitors || []).slice(0, 5);
  return (
    <div className="mt-4 overflow-hidden rounded-2xl border" style={{ borderColor: colors.border, background: "hsl(0 0% 100% / 0.02)" }}>
      <div className="flex items-start gap-3 border-b px-4 py-3.5" style={{ borderColor: "hsl(0 0% 100% / 0.08)" }}>
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ background: colors.accent, color: colors.accentForeground }}><ScanSearch size={16} /></span>
        <div className="min-w-0">
          <div className="text-[11px] font-medium uppercase tracking-[0.1em]" style={{ color: colors.mutedForeground }}>Research report · saved in Brand Research</div>
          <div className="text-[15px] font-semibold" style={{ color: colors.foreground }}>{report.title}</div>
        </div>
      </div>
      <div className="space-y-4 px-4 py-4">
        {report.summary && <p className="text-[14px] leading-relaxed" style={{ color: colors.secondaryForeground }}>{report.summary}</p>}

        {(priceRows.length > 0 || prices?.where_yours_sits) && (
          <div>
            <div className="mb-1.5 text-[12px] font-medium" style={{ color: colors.mutedForeground }}>Prices in the market</div>
            {priceRows.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {priceRows.map(([label, v]) => (
                  <div key={label} className="rounded-lg px-3 py-2" style={{ background: "hsl(0 0% 100% / 0.04)" }}>
                    <div className="text-[11px]" style={{ color: colors.mutedForeground }}>{label}</div>
                    <div className="text-[13px] font-medium" style={{ color: colors.foreground }}>{v}</div>
                  </div>
                ))}
              </div>
            )}
            {prices?.where_yours_sits && <p className="mt-2 text-[13px]" style={{ color: colors.secondaryForeground }}><b>You:</b> {prices.where_yours_sits}</p>}
          </div>
        )}

        {competitors.length > 0 && (
          <div>
            <div className="mb-1.5 text-[12px] font-medium" style={{ color: colors.mutedForeground }}>Main competitors</div>
            <div className="overflow-x-auto rounded-lg border" style={{ borderColor: "hsl(0 0% 100% / 0.08)" }}>
              <table className="w-full text-left text-[12.5px]">
                <tbody>
                  {competitors.map((c, i) => (
                    <tr key={i} className={i ? "border-t" : ""} style={{ borderColor: "hsl(0 0% 100% / 0.06)" }}>
                      <td className="px-3 py-2 font-medium" style={{ color: colors.foreground }}>{c.brand || c.name}</td>
                      <td className="px-3 py-2" style={{ color: colors.secondaryForeground }}>{[c.price, c.pack_size].filter(Boolean).join(" · ") || "n/a"}</td>
                      <td className="hidden px-3 py-2 sm:table-cell" style={{ color: colors.mutedForeground }}>{c.weakness ? `Weak spot: ${c.weakness}` : c.strength}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {report.opportunities?.length > 0 && (
          <div>
            <div className="mb-1.5 text-[12px] font-medium" style={{ color: colors.mutedForeground }}>Where you can win</div>
            <ul className="space-y-1.5">
              {report.opportunities.slice(0, 3).map((o, i) => (
                <li key={i} className="text-[13.5px] leading-snug" style={{ color: colors.secondaryForeground }}>
                  <b style={{ color: colors.foreground }}>{o.title}:</b> {o.play}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <span className="text-[12px]" style={{ color: colors.mutedForeground }}>{report.sources?.length ? `${report.sources.length} web sources` : ""}</span>
          <button type="button" onClick={() => setOpen((o) => !o)} className="rounded-lg px-3 py-1.5 text-[13px] font-medium hover:bg-white/5" style={{ color: colors.accentForeground }}>
            {open ? "Hide full report" : "Show full report"}
          </button>
        </div>
        {open && <div className="border-t pt-4" style={{ borderColor: "hsl(0 0% 100% / 0.08)" }}><FocusedReport report={report} /></div>}
      </div>
    </div>
  );
}

// ---------- Poster preview (lightbox) ----------
async function downloadImage(url: string, name: string) {
  try {
    const blob = await (await fetch(url)).blob();
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = `${name.replace(/[^a-z0-9-]+/gi, "-").toLowerCase() || "poster"}.${blob.type.includes("png") ? "png" : "jpg"}`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(href), 2000);
  } catch {
    window.open(url, "_blank", "noopener");
  }
}

function PosterPreview({ tiles, posts, startIndex, onClose, onEdit }: {
  tiles: Tile[]; posts: Post[]; startIndex: number; onClose: () => void; onEdit: (index: number) => void;
}) {
  const [pos, setPos] = useState(() => Math.max(0, tiles.findIndex((t) => t.index === startIndex)));
  const tile = tiles[pos];
  const post = tile ? posts[tile.index] : undefined;
  const go = useCallback((d: number) => setPos((p) => (p + d + tiles.length) % tiles.length), [tiles.length]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, onClose]);
  if (!tile?.imageUrl) return null;
  const name = [post?.day, post?.headline || post?.idea].filter(Boolean).join(" ") || `poster-${tile.index + 1}`;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-6" role="dialog" aria-modal="true" aria-label="Poster preview">
      <button type="button" aria-label="Close" className="absolute inset-0 cursor-default" style={{ background: "rgba(0,0,0,0.85)" }} onClick={onClose} />
      <div className="relative flex max-h-full w-full max-w-5xl flex-col gap-4 md:flex-row">
        <div className="relative flex min-h-0 flex-1 items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={tile.imageUrl} alt={post?.headline || "Poster"} className="max-h-[78vh] w-auto max-w-full rounded-xl object-contain shadow-2xl" />
          {tiles.length > 1 && (
            <>
              <button type="button" aria-label="Previous poster" onClick={() => go(-1)} className="absolute left-1 top-1/2 -translate-y-1/2 rounded-full p-2" style={{ background: "rgba(0,0,0,0.55)", color: "#fff" }}><ChevronLeft size={20} /></button>
              <button type="button" aria-label="Next poster" onClick={() => go(1)} className="absolute right-1 top-1/2 -translate-y-1/2 rounded-full p-2" style={{ background: "rgba(0,0,0,0.55)", color: "#fff" }}><ChevronRight size={20} /></button>
            </>
          )}
        </div>
        <aside className="w-full shrink-0 overflow-y-auto rounded-xl p-4 md:w-80" style={{ background: "#161616", maxHeight: "78vh" }}>
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="text-[11.5px] font-medium uppercase tracking-[0.08em]" style={{ color: colors.mutedForeground }}>{[post?.day, post?.platform].filter(Boolean).join(" · ") || `Post ${tile.index + 1}`}</div>
              {post?.headline && <div className="mt-1 text-[15px] font-semibold" style={{ color: colors.foreground }}>{post.headline}</div>}
            </div>
            <button type="button" aria-label="Close preview" onClick={onClose} className="rounded-md p-1 hover:bg-white/10" style={{ color: colors.mutedForeground }}><X size={18} /></button>
          </div>
          {post?.caption && (
            <div className="mt-4">
              <div className="mb-1 text-[12px]" style={{ color: colors.mutedForeground }}>Caption</div>
              <p className="whitespace-pre-wrap text-[13.5px] leading-relaxed" style={{ color: colors.secondaryForeground }}>{post.caption}</p>
            </div>
          )}
          <div className="mt-5 grid gap-2">
            <button type="button" onClick={() => onEdit(tile.index)} className="flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-[13px] font-medium" style={{ background: colors.primary, color: colors.primaryForeground }}>
              <Pencil size={14} /> Edit poster
            </button>
            <button type="button" onClick={() => downloadImage(tile.imageUrl!, name)} className="flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-[13px]" style={{ borderColor: colors.border, color: colors.secondaryForeground }}>
              <Download size={14} /> Download
            </button>
            {post?.caption && (
              <button type="button" onClick={() => navigator.clipboard?.writeText(post.caption).then(() => toast.success("Caption copied"), () => toast.error("Couldn't copy"))}
                className="flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-[13px]" style={{ borderColor: colors.border, color: colors.secondaryForeground }}>
                <Copy size={14} /> Copy caption
              </button>
            )}
            <a href={tile.imageUrl} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-[12.5px] hover:underline" style={{ color: colors.mutedForeground }}>
              <ExternalLink size={13} /> Open full size
            </a>
          </div>
          {tiles.length > 1 && <p className="mt-3 text-center text-[11.5px]" style={{ color: colors.mutedForeground }}>{pos + 1} of {tiles.length} · use ← → to browse</p>}
        </aside>
      </div>
    </div>
  );
}

// ---------- Edit a poster without leaving the chat (same editor as the studios) ----------
function InChatPosterEditor({ actionId, tile, onClose, onSaved }: {
  actionId: string; tile: Tile; onClose: () => void; onSaved: (result: Record<string, unknown>) => void;
}) {
  const save = async (imageUrl: string, generationId: string | null) => {
    const res = await authFetch("/api/agent/actions", { method: "POST", body: JSON.stringify({ id: actionId, op: "poster-update", index: tile.index, imageUrl, generationId }) });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.ok) throw new Error(json?.error || "Couldn't save the edited poster.");
    onSaved(json.result);
    toast.success("Poster updated · 1 image credit used");
  };
  const areaEdit = async (box: { x: number; y: number; w: number; h: number }, instruction: string) => {
    const res = await authFetch("/api/content-studio/area-edit", { method: "POST", body: JSON.stringify({ image: tile.imageUrl, box, instruction }) });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok || !data.image) throw new Error(data?.error || "The edit didn't come out. Try again.");
    // The engine still points at the old image, so later whole-poster edits start from this one.
    await save(data.image, null);
  };
  const engine = !!(tile.engineSessionId && tile.generationId);
  return (
    <PosterEditModal
      imageUrl={tile.imageUrl!}
      posterIndex={tile.index}
      onClose={onClose}
      onAreaEdit={async (box, instruction) => { await areaEdit(box, instruction); onClose(); }}
      onPlanChange={engine ? (prompt) => planPosterIterationClient({ engineSessionId: tile.engineSessionId!, generationId: tile.generationId!, request: prompt }) : undefined}
      onExecuteChange={engine ? async (iterationId) => {
        const r = await executePosterIterationClient({ engineSessionId: tile.engineSessionId!, iterationId });
        if (!r.imageUrl) throw new Error("The update didn't return a poster. Try again.");
        await save(r.imageUrl, r.generationId ?? null);
        onClose();
      } : undefined}
      onRegenerate={engine ? undefined : async (prompt) => { await areaEdit({ x: 0, y: 0, w: 1, h: 1 }, prompt); onClose(); }}
    />
  );
}
