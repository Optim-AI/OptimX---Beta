// pages/photo-studio.tsx — upload a product photo, plan the shot list, shoot.
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { JSX } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { Activity, ArrowLeft, CupSoda, Package, Shirt, Soup, UtensilsCrossed, Camera, Check, Cylinder, Download, Flower2, Gem, Hand, House, ImagePlus, Images, LayoutGrid, Lock, Palette, RefreshCw, ShoppingBag, Sparkles, Trash2, Upload, User, Wand2 } from "lucide-react";
import { ArcSpinner, ShimmerGrid, ShimmerTile, StepProgress } from "@/app/web/src/components/ui/loaders";
import { toast } from "sonner";
import Sidebar from "../app/web/src/components/Sidebar";
import CreativeViewer from "@/app/web/src/components/creative-studio/CreativeViewer";
import colors from "@/lib/ui/colors";
import { authFetch } from "@/lib/utils";
import { friendlyError, readJson, responseError } from "@/lib/api-errors";
import { showConfirm } from "@/app/web/src/components/ui/alert-modal-api";
import type {
  LightingMood,
  PhotoAspect,
  ProductKind,
  ProductProfile,
  ShootSettings,
  ShotDefinition,
  ShotMethod,
  ShotResult,
} from "@/lib/photo-studio/types";

type Shoot = {
  sessionId: string;
  sourceUrl: string;
  /** Clean studio packshot every shot is built from */
  masterUrl?: string | null;
  profile: ProductProfile;
  settings: ShootSettings;
  catalog: ShotDefinition[];
  brandColors: string[];
  exactAvailable: boolean;
  /** The shot list recommended for this product (for "Recommended" quick pick) */
  recommended?: string[];
};

type ShotStatus = "idle" | "queued" | "shooting" | "done" | "failed";

const METHOD_LABEL: Record<ShotMethod, string> = {
  exact: "Your real product photo",
  scene: "Your real product in an AI set",
  guided: "AI-rendered, checked against your photo",
};

const SHOT_ICON: Record<string, typeof Camera> = {
  marketplace_white: ShoppingBag,
  color_sweep: Palette,
  acrylic_reflection: Gem,
  styled_still_life: Flower2,
  pedestal: Cylinder,
  levitation: Sparkles,
  lifestyle_context: House,
  flat_lay: LayoutGrid,
  in_hand: Hand,
  on_model: User,
  in_use: Activity,
};

const LIGHTS: Array<{ id: LightingMood; label: string }> = [
  { id: "studio_soft", label: "Clean studio" },
  { id: "natural_daylight", label: "Daylight" },
  { id: "golden_hour", label: "Golden hour" },
  { id: "dramatic", label: "Dramatic" },
];

const ASPECTS: Array<{ id: PhotoAspect; label: string; hint: string; w: number; h: number }> = [
  { id: "1:1", label: "Square", hint: "Marketplace", w: 14, h: 14 },
  { id: "4:5", label: "Portrait", hint: "Feed", w: 12, h: 15 },
  { id: "9:16", label: "Tall", hint: "Story", w: 9, h: 16 },
];

const KIND_LABEL: Record<ProductKind, string> = {
  packaged_food: "Packaged food & spices",
  beverage: "Beverages",
  cafe_food: "Café & restaurant food",
  beauty: "Beauty & personal care",
  fashion: "Fashion & accessories",
  other: "Other products",
};
/** Kinds with their own example set for the key general shots. */
const KIND_ICON: Record<ProductKind, typeof Camera> = {
  packaged_food: Soup,
  beverage: CupSoda,
  cafe_food: UtensilsCrossed,
  beauty: Sparkles,
  fashion: Shirt,
  other: Package,
};
const STYLES = ["Casual", "Formal", "Traditional Indian", "Sporty"];
const KIND_EXAMPLE_SHOTS = new Set(["marketplace_white", "lifestyle_context", "in_hand"]);

const card = { background: colors.card, border: `1px solid ${colors.border}` } as const;

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error("We couldn't read that file. Try another photo."));
    r.readAsDataURL(file);
  });
}

/** Big photos are shrunk before upload (the server works at 2400px anyway, and the
 *  upload limit applies to the base64 text, which is ~⅓ larger than the file). */
const MAX_UPLOAD_SIDE = 2400;
async function photoForUpload(file: File): Promise<string> {
  const original = await fileToDataUrl(file);
  if (file.size <= 3 * 1024 * 1024) return original;
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("We couldn't open that photo. Try a PNG, JPG or WebP."));
    el.src = original;
  });
  const scale = Math.min(1, MAX_UPLOAD_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.naturalWidth * scale);
  canvas.height = Math.round(img.naturalHeight * scale);
  canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
  // WebP keeps transparency (cut-out PNGs) and stays small.
  return canvas.toDataURL("image/webp", 0.95);
}

export default function PhotoStudioPage(): JSX.Element {
  const router = useRouter();
  const [shoot, setShoot] = useState<Shoot | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const [selected, setSelected] = useState<Record<string, number>>({});
  const [settings, setSettings] = useState<ShootSettings | null>(null);
  const [status, setStatus] = useState<Record<string, ShotStatus>>({});
  const [results, setResults] = useState<ShotResult[]>([]);
  const [running, setRunning] = useState(false);
  const [viewer, setViewer] = useState<number | null>(null);
  const [tab, setTab] = useState<"plan" | "photos">("plan");
  const [kindOverride, setKindOverride] = useState<ProductKind | null>(null);
  const [recent, setRecent] = useState<Array<{ id: string; name: string; cover: string | null; sourceUrl: string | null; photos: number }>>([]);
  const [recentLoading, setRecentLoading] = useState(true);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadRecent = useCallback(() => {
    authFetch("/api/photo-studio/sessions")
      .then((r) => r.json())
      .then((j) => j?.ok && setRecent(j.shoots || []))
      .catch(() => null)
      .finally(() => setRecentLoading(false));
  }, []);
  useEffect(loadRecent, [loadRecent]);

  // Back to the Photo Studio home (upload + recent shoots).
  const goHome = useCallback(async () => {
    if (running && !(await showConfirm("Shots still in progress will finish in the background and appear in this shoot later.", { title: "Leave this shoot?", confirmLabel: "Leave" }))) return;
    setShoot(null);
    setPreview(null);
    setResults([]);
    setStatus({});
    setTab("plan");
    setKindOverride(null);
    void router.replace("/photo-studio", undefined, { shallow: true });
    loadRecent();
  }, [running, router, loadRecent]);

  // Browser Back from /photo-studio?id=… to /photo-studio also returns home.
  const lastId = useRef<string | null>(null);
  useEffect(() => {
    const id = typeof router.query.id === "string" ? router.query.id : null;
    if (lastId.current && !id && shoot) {
      setShoot(null);
      setPreview(null);
      setResults([]);
      setStatus({});
      loadRecent();
    }
    lastId.current = id;
  }, [router.query.id, shoot, loadRecent]);

  const deleteShoot = useCallback(async (id: string, name: string) => {
    const ok = await showConfirm(`Delete "${name}" and all its photos? This can't be undone.`, { title: "Delete shoot", confirmLabel: "Delete" });
    if (!ok) return;
    const before = recent;
    setRecent((list) => list.filter((r) => r.id !== id));
    try {
      const res = await authFetch(`/api/photo-studio/sessions?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.ok) throw new Error(j.error || "We couldn't delete that shoot. Try again.");
      toast.success("Shoot deleted.");
    } catch (e) {
      setRecent(before);
      toast.error((e as Error).message);
    }
  }, [recent]);

  // Reopen a saved shoot (?id=)
  useEffect(() => {
    const id = typeof router.query.id === "string" ? router.query.id : null;
    if (!id || shoot?.sessionId === id) return;
    (async () => {
      const r = await authFetch(`/api/photo-studio/sessions?id=${encodeURIComponent(id)}`).catch(() => null);
      const j = r ? await r.json().catch(() => null) : null;
      if (r?.status === 401) return; // signed out: the sidebar sends them to sign in and back here
      if (!j?.ok) {
        // Deleted, someone else's, or offline: don't leave the "Opening your shoot…" loader spinning.
        toast.error(r?.status === 404 ? "That shoot no longer exists." : "We couldn't open that shoot. Check your connection and try again.");
        void router.replace("/photo-studio", undefined, { shallow: true });
        return;
      }
      const meta = await authFetch("/api/photo-studio/catalog").then((x) => x.json()).catch(() => null);
      setShoot({
        sessionId: id,
        sourceUrl: j.shoot.sourceUrl,
        masterUrl: j.shoot.masterUrl ?? null,
        profile: j.shoot.profile,
        settings: j.shoot.settings,
        catalog: meta?.catalog || [],
        brandColors: meta?.brandColors || [],
        exactAvailable: j.shoot.prepared ? Boolean(j.shoot.cutoutUrl) : Boolean(meta?.exactAvailable),
        recommended: j.shoot.shots || [],
      });
      setSettings(j.shoot.settings);
      setPreview(j.shoot.masterUrl || j.shoot.sourceUrl);
      setSelected(Object.fromEntries((j.shoot.shots || []).map((s: string) => [s, 1])));
      setResults(j.shoot.results || []);
      setTab((j.shoot.results || []).length ? "photos" : "plan");
    })();
  }, [router.query.id, shoot?.sessionId]);

  const start = useCallback(async (file: File) => {
    if (!/^image\/(png|jpe?g|webp)$/i.test(file.type)) return toast.error("Upload a PNG, JPG or WebP photo.");
    if (file.size > 10 * 1024 * 1024) return toast.error("That photo is over 10 MB.");
    let dataUrl: string;
    try {
      dataUrl = await photoForUpload(file);
    } catch (e) {
      return toast.error(friendlyError(e, "We couldn't read that photo. Try another one."));
    }
    await begin({ image: dataUrl }, dataUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  /** Start a shoot from an uploaded photo, a pasted link or a catalog product. */
  const begin = async (body: { image?: string; imageUrl?: string }, previewSrc: string) => {
    setPreview(previewSrc);
    setReading(true);
    setResults([]);
    setStatus({});
    try {
      const res = await authFetch("/api/photo-studio/start", { method: "POST", body: JSON.stringify(body) });
      const j = await readJson<any>(res);
      if (!res.ok || !j.ok) throw new Error(responseError(res, j, "We couldn't read that photo. Try another one."));
      setShoot(j);
      setTab("plan");
      setKindOverride(null);
      if (j.masterUrl) setPreview(j.masterUrl);
      setSettings(j.settings);
      setSelected(Object.fromEntries((j.recommended as string[]).map((s) => [s, 1])));
      router.replace({ pathname: "/photo-studio", query: { id: j.sessionId } }, undefined, { shallow: true });
    } catch (e) {
      toast.error(friendlyError(e, "We couldn't read that photo. Try another one."));
      setPreview(null);
    } finally {
      setReading(false);
    }
  };

  // Products already found on the brand's website (Ad Studio scan) — pick one to shoot.
  const [catalog, setCatalog] = useState<Array<{ name: string; image: string }>>([]);
  const [linkUrl, setLinkUrl] = useState("");
  useEffect(() => {
    authFetch("/api/content-studio/scans")
      .then((r) => r.json())
      .then((j) => {
        const products = (j?.scans?.[0]?.products || []) as Array<{ product_name?: string; product_images?: string[] }>;
        setCatalog(products.filter((x) => x.product_images?.[0]).slice(0, 12).map((x) => ({ name: x.product_name || "Product", image: x.product_images![0] })));
      })
      .catch(() => null);
  }, []);

  const selectedIds = useMemo(() => Object.keys(selected).filter((k) => selected[k] > 0), [selected]);
  const totalPhotos = selectedIds.reduce((n, id) => n + selected[id], 0);
  // Shots that already have photos (survives reopening a saved shoot, unlike per-session status).
  const shotIdsShot = useMemo(() => new Set(results.map((r) => r.shotId)), [results]);
  const remaining = selectedIds.filter((id) => !shotIdsShot.has(id));
  const usesModel = shoot?.catalog.some((s) => s.usesModel && selected[s.id]) ?? false;

  const shootOne = useCallback(async (shotId: string, variations: number): Promise<boolean> => {
    if (!shoot || !settings) return false;
    setStatus((m) => ({ ...m, [shotId]: "shooting" }));
    try {
      const res = await authFetch("/api/photo-studio/shoot", {
        method: "POST",
        body: JSON.stringify({ sessionId: shoot.sessionId, shotId, variations, settings }),
      });
      const j = await readJson<any>(res);
      if (!res.ok || !j.ok) throw new Error(responseError(res, j, "This shot didn't come out. Try again."));
      setResults((r) => [...r, ...(j.results as ShotResult[])]);
      setStatus((m) => ({ ...m, [shotId]: "done" }));
      return true;
    } catch (e) {
      setStatus((m) => ({ ...m, [shotId]: "failed" }));
      const label = shoot.catalog.find((c) => c.id === shotId)?.label || "Shot";
      const message = friendlyError(e, "This shot didn't come out. Try again.");
      // Offline or signed out: stop the queue instead of failing every remaining shot.
      const fatal = /reach SkalX|session has ended/.test(message);
      toast.error(fatal ? message : `${label}: ${message}`, { id: fatal ? "photo-studio-fatal" : undefined });
      return !fatal;
    }
  }, [shoot, settings]);

  const runShoot = useCallback(async (ids: string[]) => {
    if (!ids.length) return;
    setTab("photos");
    setRunning(true);
    setStatus((m) => ({ ...m, ...Object.fromEntries(ids.map((id) => [id, "queued" as ShotStatus])) }));
    const queue = [...ids];
    let stop = false;
    const worker = async () => {
      while (queue.length && !stop) {
        const id = queue.shift()!;
        const ok = await shootOne(id, selected[id] || 1);
        if (!ok) stop = true;
      }
    };
    await Promise.all([worker(), worker()]);
    // A stopped queue leaves shots that never started: clear their "Queued" state.
    setStatus((m) => Object.fromEntries(Object.entries(m).map(([k, v]) => [k, v === "queued" ? "idle" : v])) as Record<string, ShotStatus>);
    setRunning(false);
  }, [selected, shootOne]);

  const viewerItems = results.map((r, i) => {
    const def = shoot?.catalog.find((s) => s.id === r.shotId);
    return { id: `${i}-${r.url}`, images: [r.url], title: def?.label || r.shotId, caption: shoot?.profile.name, headline: shoot?.profile.name };
  });

  const download = async (url: string, name: string) => {
    try {
      const blob = await (await fetch(url)).blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    } catch {
      window.open(url, "_blank");
    }
  };

  // Reopening a saved shoot (?id=…): show a loader, not the empty upload screen.
  if (!shoot && typeof router.query.id === "string" && !reading) {
    return (
      <div className="h-screen flex overflow-hidden app-page" style={{ background: colors.background }}>
        <Head><title>Photoshoot Studio | SkalX AI</title></Head>
        <Sidebar />
        <main className="flex min-w-0 flex-1 items-center justify-center">
          <div className="flex items-center gap-2 text-sm" style={{ color: colors.mutedForeground }}>
            <ArcSpinner className="h-4 w-4 animate-spin" /> Opening your shoot…
          </div>
        </main>
      </div>
    );
  }

  // ───────────────────────── upload screen ─────────────────────────
  if (!shoot) {
    return (
      <div className="h-screen flex overflow-hidden app-page" style={{ background: colors.background }}>
        <Head><title>Photoshoot Studio | SkalX AI</title></Head>
        <Sidebar />
        <main className="min-w-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
            <h1 className="text-2xl font-semibold" style={{ color: colors.foreground }}>Photoshoot Studio</h1>
            <p className="mt-1 max-w-2xl text-sm" style={{ color: colors.mutedForeground }}>
              Upload one product photo and get a full product shoot — marketplace packshots, studio sets, lifestyle scenes,
              in-hand and model shots — planned like a photographer&apos;s shot list.
            </p>

            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                const f = e.dataTransfer.files?.[0];
                if (f) void start(f);
              }}
              className="mt-6 flex flex-col items-center justify-center rounded-2xl px-6 py-14 text-center transition-colors"
              style={{ ...card, borderStyle: "dashed", borderWidth: 2, borderColor: dragging ? colors.primary : colors.border }}
            >
              {reading ? (
                <>
                  {preview && <img src={preview} alt="" className="mb-5 h-40 w-40 rounded-xl object-contain" style={{ background: colors.secondary }} />}
                  <StepProgress
                    className="text-left"
                    estimatedMs={35_000}
                    hint="about half a minute"
                    steps={["Uploading your photo…", "Reading your product…", "Making a clean studio packshot…", "Checking it matches your product…", "Planning your shot list…"]}
                  />
                </>
              ) : (
                <>
                  <ImagePlus className="h-10 w-10" style={{ color: colors.mutedForeground }} />
                  <p className="mt-3 text-sm font-medium" style={{ color: colors.foreground }}>Drop a product photo here, or choose another way below</p>
                  <p className="mt-1 text-xs" style={{ color: colors.mutedForeground }}>
                    PNG, JPG or WebP up to 10 MB. A clear, front-facing photo on a plain background gives the most accurate results.
                  </p>
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="mt-5 inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium"
                    style={{ background: colors.primary, color: colors.primaryForeground }}
                  >
                    <Upload className="h-4 w-4" /> Upload from your device
                  </button>

                  {/* Or: paste a link */}
                  <div className="mt-8 w-full max-w-md text-left">
                    <p className="mb-1.5 text-xs font-medium" style={{ color: colors.mutedForeground }}>Or paste an image link</p>
                    <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); const u = linkUrl.trim(); if (u) void begin({ imageUrl: u }, u); }}>
                      <label className="sr-only" htmlFor="ps-link">Image link</label>
                      <input id="ps-link" value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://yourstore.com/product.jpg"
                        className="min-w-0 flex-1 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sky-400"
                        style={{ background: colors.secondary, color: colors.foreground, border: `1px solid ${colors.border}` }} />
                      <button type="submit" disabled={!linkUrl.trim()} className="rounded-lg px-3 py-2 text-sm font-medium disabled:opacity-50"
                        style={{ border: `1px solid ${colors.border}`, color: colors.foreground }}>Use link</button>
                    </form>
                  </div>

                  {/* Or: pick from the products found on their website */}
                  {catalog.length > 0 && (
                    <div className="mt-6 w-full text-left">
                      <p className="mb-2 text-xs font-medium" style={{ color: colors.mutedForeground }}>Or pick from your catalog</p>
                      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                        {catalog.map((c) => (
                          <button key={c.image} type="button" onClick={() => void begin({ imageUrl: c.image }, c.image)} title={c.name}
                            className="group overflow-hidden rounded-xl text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                            style={{ background: colors.card, border: `1px solid ${colors.border}` }}>
                            <span className="block aspect-square overflow-hidden bg-white">
                              <img src={c.image} alt="" loading="lazy" className="h-full w-full object-contain transition-transform group-hover:scale-105" />
                            </span>
                            <span className="block truncate px-2 py-1.5 text-[11px]" style={{ color: colors.foreground }}>{c.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void start(f);
                      e.target.value = "";
                    }}
                  />
                </>
              )}
            </div>

            {recentLoading && recent.length === 0 && (
              <section className="mt-10">
                <h2 className="text-sm font-semibold" style={{ color: colors.foreground }}>Recent shoots</h2>
                <ShimmerGrid className="mt-3" count={4} />
              </section>
            )}
            {recent.length > 0 && (
              <section className="mt-10">
                <h2 className="text-sm font-semibold" style={{ color: colors.foreground }}>Recent shoots</h2>
                <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {recent.map((r) => (
                    <div key={r.id} className="group relative">
                    <button
                      type="button"
                      onClick={() => router.push({ pathname: "/photo-studio", query: { id: r.id } })}
                      className="w-full overflow-hidden rounded-xl text-left"
                      style={card}
                    >
                      <div className="aspect-square" style={{ background: colors.secondary }}>
                        {(r.cover || r.sourceUrl) && <img src={r.cover || r.sourceUrl!} alt="" className="h-full w-full object-cover" />}
                      </div>
                      <div className="p-2.5">
                        <p className="truncate text-xs font-medium" style={{ color: colors.foreground }}>{r.name.replace(/^Photo shoot · /, "")}</p>
                        <p className="text-[11px]" style={{ color: colors.mutedForeground }}>{r.photos} photo{r.photos === 1 ? "" : "s"}</p>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => void deleteShoot(r.id, r.name.replace(/^Photo shoot · /, ""))}
                      aria-label={`Delete ${r.name.replace(/^Photo shoot · /, "")}`}
                      title="Delete shoot"
                      className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-lg opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100"
                      style={{ background: "rgba(0,0,0,0.6)", color: "#fff" }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        </main>
      </div>
    );
  }

  // ───────────────────────── plan + shoot screen ─────────────────────────
  const s = settings!;
  const p = shoot.profile;
  const kind: ProductKind = kindOverride || p.kind || "other";
  const visibleShots = shoot.catalog.filter((x) => !x.kinds || x.kinds.includes(kind));
  const exampleSrc = (id: string) => {
    const def = shoot.catalog.find((x) => x.id === id);
    if (!def?.kinds && KIND_EXAMPLE_SHOTS.has(id) && ["packaged_food", "beverage", "cafe_food"].includes(kind)) return `/images/photo-studio/examples/${kind}/${id}.webp`;
    return `/images/photo-studio/examples/${id}.webp`;
  };
  const recommendFor = (k: ProductKind): string[] =>
    k === "packaged_food" ? ["marketplace_white", "food_ingredients", "food_served", "food_scoop", "food_kitchen", "theme_festive"]
    : k === "beverage" ? ["marketplace_white", "bev_ice_cold", "bev_pour", "bev_fruit_burst", "bev_cafe_table", "in_hand"]
    : k === "cafe_food" ? ["cafe_delivery", "cafe_hero", "cafe_spread", "cafe_steam", "cafe_bite"]
    : k === (p.kind || "other") ? shoot.recommended || [] : ["marketplace_white", "color_sweep", "styled_still_life", "lifestyle_context", "in_hand"];
  const methodOf = (shot: ShotDefinition): ShotMethod => (shot.method !== "guided" && !shoot.exactAvailable ? "guided" : shot.method);
  const shotsWithPhotos = shoot.catalog.filter((x) => results.some((r) => r.shotId === x.id) || status[x.id] === "shooting" || status[x.id] === "queued");
  const focusRing = "focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-black";
  const segment = (on: boolean): React.CSSProperties =>
    on ? { background: colors.card, color: colors.foreground, boxShadow: "0 1px 2px rgba(0,0,0,0.35)" } : { color: colors.mutedForeground };

  return (
    <div className="h-screen flex overflow-hidden app-page" style={{ background: colors.background }}>
      <Head><title>{`${p.name} · Photoshoot Studio | SkalX AI`}</title></Head>
      <Sidebar />
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Top bar: where you are, what you're shooting, Plan / Photos */}
        <header className="flex-shrink-0 border-b" style={{ borderColor: colors.border, background: colors.card }}>
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
            <button type="button" onClick={() => void goHome()} className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm ${focusRing}`} style={{ color: colors.mutedForeground }}>
              <ArrowLeft className="h-4 w-4" /> All shoots
            </button>
            <span aria-hidden className="h-5 w-px" style={{ background: colors.border }} />
            <div className="flex min-w-0 flex-1 items-center gap-2.5">
              <span className="h-9 w-9 shrink-0 overflow-hidden rounded-lg" style={{ background: "#fff" }}>
                <img src={preview || shoot.sourceUrl} alt="" className="h-full w-full object-contain" />
              </span>
              <div className="min-w-0">
                <h1 className="truncate text-sm font-semibold" style={{ color: colors.foreground }}>{p.name}</h1>
                <p className="truncate text-xs" style={{ color: colors.mutedForeground }}>Photoshoot Studio · free during beta</p>
              </div>
            </div>
            <div role="tablist" aria-label="Shoot view" className="inline-flex rounded-lg p-1" style={{ background: colors.secondary }}>
              {([
                ["plan", "Plan shots", null],
                ["photos", "Photos", results.length],
              ] as const).map(([id, label, n]) => (
                <button key={id} role="tab" aria-selected={tab === id} type="button" onClick={() => setTab(id)}
                  className={`rounded-md px-3.5 py-1.5 text-sm transition-colors ${focusRing}`} style={segment(tab === id)}>
                  {label}{n ? <span className="ml-1.5 text-xs opacity-70">{n}</span> : null}
                </button>
              ))}
            </div>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
            {!shoot.exactAvailable && (
              <p role="note" className="mb-5 rounded-lg px-3.5 py-2.5 text-sm" style={{ background: "hsl(38 92% 50% / 0.12)", color: "hsl(38 92% 72%)" }}>
                We couldn&apos;t isolate the product from this photo, so every shot is AI-rendered and checked against it. For exact shots, upload a photo of the product on its own.
              </p>
            )}

            {tab === "plan" ? (
              <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
                {/* Left rail: what you're shooting, what you picked, how it should look */}
                <aside className="space-y-4 lg:sticky lg:top-0 lg:self-start" aria-label="Your shoot">
                  <section className="rounded-2xl p-4" style={card}>
                    <h2 className="text-xs font-semibold uppercase tracking-wider" style={{ color: colors.mutedForeground }}>1 · Your product</h2>
                    <div className="mt-3 flex items-center gap-3">
                      <span className="h-20 w-20 shrink-0 overflow-hidden rounded-xl" style={{ background: "#fff" }}>
                        <img src={preview || shoot.sourceUrl} alt={`${p.name}, studio packshot`} className="h-full w-full object-contain" />
                      </span>
                      <p className="text-xs leading-snug" style={{ color: colors.mutedForeground }}>
                        {shoot.masterUrl ? "Clean studio packshot — every shot is built from it." : p.productType}
                      </p>
                    </div>
                  </section>

                  <section className="rounded-2xl p-4" style={{ ...card, borderColor: selectedIds.length ? colors.primary : colors.border }}>
                    <h2 className="text-xs font-semibold uppercase tracking-wider" style={{ color: colors.mutedForeground }}>2 · Your shots</h2>
                    {selectedIds.length ? (
                      <>
                        <div className="mt-3 grid grid-cols-3 gap-1.5">
                          {selectedIds.slice(0, 8).map((id) => (
                            <img key={id} src={exampleSrc(id)} alt="" className="aspect-square w-full rounded-md object-cover" />
                          ))}
                          {selectedIds.length > 8 && (
                            <span className="flex aspect-square items-center justify-center rounded-md text-xs font-medium" style={{ background: colors.secondary, color: colors.foreground }}>
                              +{selectedIds.length - 8}
                            </span>
                          )}
                        </div>
                        <p className="mt-2.5 text-xs" style={{ color: colors.foreground }}>
                          {selectedIds.length} shot{selectedIds.length === 1 ? "" : "s"} · {totalPhotos} photo{totalPhotos === 1 ? "" : "s"}
                        </p>
                      </>
                    ) : (
                      <p className="mt-2 text-xs" style={{ color: colors.mutedForeground }}>Pick the shots you want from the examples.</p>
                    )}
                  </section>

                  <section className="space-y-4 rounded-2xl p-4" style={card} aria-label="Look">
                    <h2 className="text-xs font-semibold uppercase tracking-wider" style={{ color: colors.mutedForeground }}>3 · Look</h2>
                    <fieldset>
                      <legend className="mb-1.5 text-xs font-medium" style={{ color: colors.mutedForeground }}>Format</legend>
                      <div role="radiogroup" aria-label="Format" className="grid grid-cols-3 gap-1.5">
                        {ASPECTS.map((a) => {
                          const on = s.aspect === a.id;
                          return (
                            <button key={a.id} role="radio" aria-checked={on} type="button" onClick={() => setSettings({ ...s, aspect: a.id })} title={`${a.label} — ${a.hint}`}
                              className={`flex flex-col items-center gap-1 rounded-lg px-1 py-2 ${focusRing}`}
                              style={{ background: on ? "hsl(213 100% 55% / 0.12)" : colors.secondary, border: `1px solid ${on ? colors.primary : "transparent"}` }}>
                              <span aria-hidden className="rounded-[3px]" style={{ width: a.w, height: a.h, border: `1.5px solid ${on ? colors.primary : colors.mutedForeground}` }} />
                              <span className="text-[11px]" style={{ color: colors.foreground }}>{a.hint}</span>
                            </button>
                          );
                        })}
                      </div>
                    </fieldset>
                    <fieldset>
                      <legend className="mb-1.5 text-xs font-medium" style={{ color: colors.mutedForeground }}>Lighting</legend>
                      <div role="radiogroup" aria-label="Lighting" className="grid grid-cols-2 gap-1.5">
                        {LIGHTS.map((l) => {
                          const on = s.lighting === l.id;
                          return (
                            <button key={l.id} role="radio" aria-checked={on} type="button" onClick={() => setSettings({ ...s, lighting: l.id })}
                              className={`rounded-lg px-2 py-1.5 text-xs ${focusRing}`}
                              style={{ background: on ? "hsl(213 100% 55% / 0.12)" : colors.secondary, border: `1px solid ${on ? colors.primary : "transparent"}`, color: colors.foreground }}>
                              {l.label}
                            </button>
                          );
                        })}
                      </div>
                    </fieldset>
                    <fieldset>
                      <legend className="mb-1.5 text-xs font-medium" style={{ color: colors.mutedForeground }}>Backdrop</legend>
                      <div role="radiogroup" aria-label="Backdrop colour" className="flex flex-wrap items-center gap-2">
                        {[...new Set([...shoot.brandColors, "#EDE7DF", "#FFFFFF", "#1C1C1C"])].map((c) => {
                          const on = s.backdrop.toLowerCase() === c.toLowerCase();
                          return (
                            <button key={c} role="radio" aria-checked={on} type="button" aria-label={`Backdrop ${c}`} title={c} onClick={() => setSettings({ ...s, backdrop: c })}
                              className={`h-7 w-7 rounded-full ${focusRing}`}
                              style={{ background: c, outline: on ? `2px solid ${colors.primary}` : `1px solid ${colors.border}`, outlineOffset: 2 }} />
                          );
                        })}
                        <label className="relative flex h-7 w-7 cursor-pointer items-center justify-center overflow-hidden rounded-full text-sm" style={{ border: `1px dashed ${colors.border}`, color: colors.mutedForeground }} title="Pick any colour">
                          <span aria-hidden>+</span>
                          <input type="color" aria-label="Pick a custom backdrop colour" value={s.backdrop} onChange={(e) => setSettings({ ...s, backdrop: e.target.value })} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
                        </label>
                      </div>
                      <p className="mt-1.5 text-[11px]" style={{ color: colors.mutedForeground }}>Creative sets bring their own light and colours.</p>
                    </fieldset>
                    {usesModel && (
                      <fieldset>
                        <legend className="mb-1.5 text-xs font-medium" style={{ color: colors.mutedForeground }}>Model — for the people shots you picked</legend>
                        <div className="grid grid-cols-2 gap-1.5">
                          <label className="sr-only" htmlFor="ps-gender">Gender</label>
                          <select id="ps-gender" value={s.model?.gender || "any"} onChange={(e) => setSettings({ ...s, model: { ...s.model, gender: e.target.value as any } })}
                            className={`rounded-lg px-2 py-1.5 text-xs ${focusRing}`} style={{ background: colors.secondary, color: colors.foreground, border: `1px solid ${colors.border}` }}>
                            <option value="any">Any gender</option><option value="woman">Woman</option><option value="man">Man</option>
                          </select>
                          <label className="sr-only" htmlFor="ps-age">Age</label>
                          <select id="ps-age" value={s.model?.age || "any"} onChange={(e) => setSettings({ ...s, model: { ...s.model, age: e.target.value as any } })}
                            className={`rounded-lg px-2 py-1.5 text-xs ${focusRing}`} style={{ background: colors.secondary, color: colors.foreground, border: `1px solid ${colors.border}` }}>
                            <option value="any">Any age</option><option value="18-25">18–25</option><option value="25-40">25–40</option><option value="40+">40+</option>
                          </select>
                        </div>
                        {(() => {
                          // Look is free text ("Indian", "South Asian, 30s") plus an optional style.
                          const parts = (s.model?.look || "").split(", ");
                          const sty = STYLES.includes(parts[parts.length - 1]) ? parts.pop()! : "";
                          const look = parts.join(", ");
                          const save = (l: string, st: string) => setSettings({ ...s, model: { ...s.model, look: [l.trim(), st].filter(Boolean).join(", ") } });
                          return (
                            <>
                              <label className="sr-only" htmlFor="ps-look">Look</label>
                              <input id="ps-look" value={look} onChange={(e) => save(e.target.value, sty)} placeholder="Look, e.g. Indian, South Asian"
                                className={`mt-1.5 w-full rounded-lg px-2.5 py-1.5 text-xs ${focusRing}`} style={{ background: colors.secondary, color: colors.foreground, border: `1px solid ${colors.border}` }} />
                              <label className="sr-only" htmlFor="ps-style">Style</label>
                              <select id="ps-style" value={sty} onChange={(e) => save(look, e.target.value)}
                                className={`mt-1.5 w-full rounded-lg px-2 py-1.5 text-xs ${focusRing}`} style={{ background: colors.secondary, color: colors.foreground, border: `1px solid ${colors.border}` }}>
                                <option value="">Any style</option>
                                {STYLES.map((x) => <option key={x} value={x}>{x}</option>)}
                              </select>
                            </>
                          );
                        })()}
                      </fieldset>
                    )}
                  </section>
                </aside>

                {/* Example tiles */}
                <div className="min-w-0">
                  <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-semibold" style={{ color: colors.foreground }}>Pick your shots</h2>
                      <p className="mt-0.5 text-xs" style={{ color: colors.mutedForeground }}>Examples use a sample product — yours goes in its place.</p>
                    </div>
                    <div className="flex gap-1.5" aria-label="Quick select">
                      {([
                        ["Recommended", () => setSelected(Object.fromEntries((shoot.recommended || []).map((id) => [id, 1])))],
                        ["All", () => setSelected(Object.fromEntries(visibleShots.map((x) => [x.id, selected[x.id] || 1])))],
                        ["Clear", () => setSelected({})],
                      ] as const).map(([label, fn]) => (
                        <button key={label} type="button" onClick={fn} className={`rounded-full px-3 py-1.5 text-xs ${focusRing}`} style={{ border: `1px solid ${colors.border}`, color: colors.foreground }}>
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Step: what are you shooting? (detected from the photo — change it if it's wrong) */}
                  <section className="mt-5" aria-labelledby="kind-title">
                    <h3 id="kind-title" className="mb-2.5 text-sm font-semibold" style={{ color: colors.foreground }}>What are you shooting?</h3>
                    <div role="radiogroup" aria-labelledby="kind-title" className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
                      {(Object.keys(KIND_LABEL) as ProductKind[]).map((k) => {
                        const on = kind === k;
                        const KIcon = KIND_ICON[k];
                        return (
                          <button key={k} role="radio" aria-checked={on} type="button"
                            onClick={() => { setKindOverride(k); setSelected(Object.fromEntries(recommendFor(k).map((id) => [id, 1]))); }}
                            className={`flex flex-col items-center gap-1.5 rounded-xl px-2 py-3 text-center ${focusRing}`}
                            style={{ background: on ? "hsl(213 100% 55% / 0.12)" : colors.card, border: `1px solid ${on ? colors.primary : colors.border}` }}>
                            <KIcon className="h-5 w-5" style={{ color: on ? colors.primary : colors.mutedForeground }} aria-hidden />
                            <span className="text-xs font-medium leading-tight" style={{ color: colors.foreground }}>{KIND_LABEL[k]}</span>
                          </button>
                        );
                      })}
                    </div>
                  </section>

                  {([
                    { title: `Made for ${KIND_LABEL[kind].toLowerCase()}`, hint: "The shots that sell in your category", groups: ["catalogue", "studio", "lifestyle", "people"], kindOnly: true },
                    { title: "Product shots", hint: "Marketplace, product page and studio", groups: ["catalogue", "studio"] },
                    { title: "Lifestyle & people", hint: "In its world, in hand, in use", groups: ["lifestyle", "people"] },
                    { title: "Creative sets", hint: "Themed scenes for ads and social", groups: ["creative"] },
                  ] as const).map((sec) => {
                    const shots = visibleShots.filter((x) => (sec.groups as readonly string[]).includes(x.group) && ("kindOnly" in sec ? !!x.kinds : !x.kinds));
                    if (!shots.length) return null;
                    return (
                      <section key={sec.title} className="mt-7" aria-labelledby={`sec-${sec.title}`}>
                        <h3 id={`sec-${sec.title}`} className="mb-3 text-sm font-semibold" style={{ color: colors.foreground }}>
                          {sec.title} <span className="font-normal" style={{ color: colors.mutedForeground }}>· {sec.hint}</span>
                        </h3>
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                          {shots.map((shot) => {
                            const n = selected[shot.id] || 0;
                            const on = n > 0;
                            const method = methodOf(shot);
                            const MethodIcon = method === "guided" ? Wand2 : Lock;
                            const single = shot.id === "marketplace_white";
                            const dim = selectedIds.length > 0 && !on;
                            return (
                              <div key={shot.id} className="group relative overflow-hidden rounded-2xl transition-all"
                                style={{ boxShadow: on ? `0 0 0 2px ${colors.primary}` : `0 0 0 1px ${colors.border}`, opacity: dim ? 0.55 : 1 }}>
                                <button type="button" aria-pressed={on} onClick={() => setSelected((m) => ({ ...m, [shot.id]: on ? 0 : 1 }))}
                                  title={`${shot.purpose}. ${METHOD_LABEL[method]}.`}
                                  className={`block w-full ${focusRing}`}>
                                  <span className="relative block aspect-square overflow-hidden" style={{ background: colors.secondary }}>
                                    <img src={exampleSrc(shot.id)} alt={`Example: ${shot.label}`} loading="lazy"
                                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]" />
                                    <span className="absolute inset-x-2 bottom-2 flex items-center justify-center gap-1.5 rounded-xl px-2 py-1.5 text-sm font-medium backdrop-blur"
                                      style={on ? { background: colors.primary, color: colors.primaryForeground } : { background: "rgba(0,0,0,0.58)", color: "#fff" }}>
                                      <MethodIcon className="h-3.5 w-3.5 shrink-0 opacity-80" aria-label={METHOD_LABEL[method]} />
                                      <span className="truncate">{shot.label}</span>
                                    </span>
                                    {on && (
                                      <span aria-hidden className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full" style={{ background: colors.primary, color: "#fff" }}>
                                        <Check className="h-4 w-4" />
                                      </span>
                                    )}
                                  </span>
                                </button>
                                {on && !single && (
                                  <button type="button" onClick={() => setSelected((m) => ({ ...m, [shot.id]: n === 2 ? 1 : 2 }))}
                                    aria-label={`${shot.label}: ${n} photo${n > 1 ? "s" : ""}. Click for ${n === 2 ? 1 : 2}.`}
                                    title={n === 2 ? "Two different takes to pick from — click for one" : "Click for two different takes"}
                                    className={`absolute left-2 top-2 rounded-full px-2.5 py-1 text-xs font-medium backdrop-blur ${focusRing}`}
                                    style={{ background: "rgba(0,0,0,0.62)", color: "#fff" }}>
                                    {n} photo{n > 1 ? "s" : ""} ▾
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </section>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* Photos: one row per shot, newest work visible at a glance */
              <div aria-live="polite">
                {shotsWithPhotos.length === 0 ? (
                  <div className="flex flex-col items-center rounded-2xl px-6 py-16 text-center" style={{ border: `1px dashed ${colors.border}` }}>
                    <Images className="h-8 w-8" style={{ color: colors.mutedForeground }} aria-hidden />
                    <p className="mt-3 text-sm font-medium" style={{ color: colors.foreground }}>No photos yet</p>
                    <p className="mt-1 text-xs" style={{ color: colors.mutedForeground }}>Pick your shots, then start the shoot.</p>
                    <button type="button" onClick={() => setTab("plan")} className={`mt-4 rounded-lg px-4 py-2 text-sm ${focusRing}`} style={{ border: `1px solid ${colors.border}`, color: colors.foreground }}>
                      Plan shots
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-3 lg:grid-cols-4">
                    {shotsWithPhotos.flatMap((shot) => {
                      const st = status[shot.id] || "idle";
                      const photos = results.map((r, i) => ({ r, i })).filter((x) => x.r.shotId === shot.id);
                      const Icon = SHOT_ICON[shot.id] || Camera;
                      const busy = st === "shooting" || st === "queued";
                      const pending = busy ? (shot.id === "marketplace_white" ? 1 : selected[shot.id] || 1) : 0;
                      const caption = (k: number, total: number, withAction: boolean) => (
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <span className="inline-flex min-w-0 items-center gap-1.5 text-xs" style={{ color: colors.foreground }}>
                            <Icon className="h-3.5 w-3.5 shrink-0" style={{ color: colors.mutedForeground }} aria-hidden />
                            <span className="truncate">{shot.label}{total > 1 ? ` ${k + 1}` : ""}</span>
                          </span>
                          {withAction && (busy ? (
                            <span className="text-[11px]" style={{ color: colors.primary }}>{st === "queued" ? "Queued" : "Shooting…"}</span>
                          ) : (
                            <button type="button" disabled={running} onClick={() => void runShoot([shot.id])} title={`Reshoot ${shot.label}`} aria-label={`Reshoot ${shot.label}`}
                              className={`rounded-md p-1 disabled:opacity-40 ${focusRing}`} style={{ color: colors.mutedForeground }}>
                              <RefreshCw className="h-3.5 w-3.5" />
                            </button>
                          ))}
                        </div>
                      );
                      return [
                        ...photos.map(({ r, i }, k) => (
                          <figure key={r.url} className="min-w-0">
                            <button type="button" onClick={() => setViewer(i)} aria-label={`Open ${shot.label} photo`}
                              className={`group block aspect-[4/5] w-full overflow-hidden rounded-xl ${focusRing}`} style={{ background: colors.secondary }}>
                              <img src={r.url} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
                            </button>
                            <figcaption>{caption(k, photos.length + pending, k === 0)}</figcaption>
                          </figure>
                        )),
                        ...Array.from({ length: pending }, (_, k) => (
                          <figure key={`${shot.id}-pending-${k}`} className="min-w-0">
                            <ShimmerTile className="aspect-[4/5]" />
                            <figcaption>{caption(photos.length + k, photos.length + pending, photos.length === 0 && k === 0)}</figcaption>
                          </figure>
                        )),
                      ];
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Action bar */}
        <footer className="flex-shrink-0 border-t" style={{ borderColor: colors.border, background: colors.card }}>
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <p className="text-sm" style={{ color: colors.foreground }} aria-live="polite">
              <strong>{selectedIds.length}</strong> shot{selectedIds.length === 1 ? "" : "s"} · <strong>{totalPhotos}</strong> photo{totalPhotos === 1 ? "" : "s"}
              <span className="ml-2 text-xs" style={{ color: colors.mutedForeground }}>Free during beta</span>
            </p>
            <div className="flex flex-wrap gap-2">
              {results.length > 0 && (
                <button type="button" onClick={() => setViewer(0)} className={`rounded-lg px-3 py-2 text-sm ${focusRing}`} style={{ border: `1px solid ${colors.border}`, color: colors.foreground }}>
                  View all {results.length}
                </button>
              )}
              {shotIdsShot.size > 0 && (
                <button type="button" disabled={running || !selectedIds.length} onClick={() => void runShoot(selectedIds)}
                  title="Shoot every selected shot again with the current look"
                  className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm disabled:opacity-50 ${focusRing}`}
                  style={remaining.length ? { border: `1px solid ${colors.border}`, color: colors.foreground } : { background: colors.primary, color: colors.primaryForeground }}>
                  <RefreshCw className="h-4 w-4" /> Reshoot all
                </button>
              )}
              {(remaining.length > 0 || shotIdsShot.size === 0) && (
                <button type="button" disabled={running || !remaining.length} onClick={() => void runShoot(remaining)}
                  className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50 ${focusRing}`}
                  style={{ background: colors.primary, color: colors.primaryForeground }}>
                  {running ? <ArcSpinner className="h-4 w-4" /> : <Camera className="h-4 w-4" />}
                  {running ? "Shooting…" : shotIdsShot.size ? `Shoot ${remaining.length} more` : `Start shoot`}
                </button>
              )}
              {running && !remaining.length && shotIdsShot.size > 0 && (
                <span className="inline-flex items-center gap-2 px-2 text-sm" style={{ color: colors.primary }}>
                  <ArcSpinner className="h-4 w-4" /> Shooting…
                </span>
              )}
            </div>
          </div>
        </footer>
      </main>

      {viewer !== null && viewerItems[viewer] && (
        <CreativeViewer
          items={viewerItems}
          index={viewer}
          onIndexChange={setViewer}
          onClose={() => setViewer(null)}
          brand={{ name: p.name }}
          renderActions={(item, i) => (
            <button type="button" onClick={() => void download(item.images[0], `${(results[i]?.shotId || "photo").replace(/_/g, "-")}-${i + 1}.jpg`)}
              className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium"
              style={{ background: colors.card, color: colors.foreground, border: `1px solid ${colors.border}` }}>
              <Download className="h-4 w-4" /> Download
            </button>
          )}
        />
      )}

    </div>
  );
}
