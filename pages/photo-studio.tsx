// pages/photo-studio.tsx — upload a product photo, plan the shot list, shoot.
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { JSX } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { ArrowLeft, Camera, Check, Download, ImagePlus, RefreshCw, Trash2, Upload } from "lucide-react";
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
  ProductProfile,
  ShootSettings,
  ShotDefinition,
  ShotGroup,
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
};

type ShotStatus = "idle" | "queued" | "shooting" | "done" | "failed";

const GROUPS: Array<{ id: ShotGroup; label: string; hint: string }> = [
  { id: "catalogue", label: "Catalogue", hint: "Marketplace and product-page images" },
  { id: "studio", label: "Studio", hint: "Styled sets for product pages and ads" },
  { id: "lifestyle", label: "Lifestyle", hint: "The product in its world" },
  { id: "people", label: "People", hint: "Hands and models — scale and emotion" },
];

const METHOD_LABEL: Record<ShotMethod, string> = {
  exact: "Exact product",
  scene: "Exact product · AI set",
  guided: "AI-rendered · fidelity checked",
};

const LIGHTS: Array<{ id: LightingMood; label: string }> = [
  { id: "studio_soft", label: "Clean studio" },
  { id: "natural_daylight", label: "Daylight" },
  { id: "golden_hour", label: "Golden hour" },
  { id: "dramatic", label: "Dramatic" },
];

const ASPECTS: Array<{ id: PhotoAspect; label: string }> = [
  { id: "1:1", label: "1:1 Marketplace" },
  { id: "4:5", label: "4:5 Feed" },
  { id: "9:16", label: "9:16 Story" },
];

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
      });
      setSettings(j.shoot.settings);
      setPreview(j.shoot.masterUrl || j.shoot.sourceUrl);
      setSelected(Object.fromEntries((j.shoot.shots || []).map((s: string) => [s, 1])));
      setResults(j.shoot.results || []);
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
    setPreview(dataUrl);
    setReading(true);
    setResults([]);
    setStatus({});
    try {
      const res = await authFetch("/api/photo-studio/start", { method: "POST", body: JSON.stringify({ image: dataUrl }) });
      const j = await readJson<any>(res);
      if (!res.ok || !j.ok) throw new Error(responseError(res, j, "We couldn't read that photo. Try another one."));
      setShoot(j);
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
  }, [router]);

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
        <Head><title>Photo Studio | SkalX AI</title></Head>
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
        <Head><title>Photo Studio | SkalX AI</title></Head>
        <Sidebar />
        <main className="min-w-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
            <h1 className="text-2xl font-semibold" style={{ color: colors.foreground }}>Photo Studio</h1>
            <p className="mt-1 max-w-2xl text-sm" style={{ color: colors.mutedForeground }}>
              Upload one product photo and get a full product shoot — marketplace packshots, studio sets, lifestyle scenes,
              in-hand and model shots — planned like a photographer's shot list.
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
                  <p className="mt-3 text-sm font-medium" style={{ color: colors.foreground }}>Drop a product photo here</p>
                  <p className="mt-1 text-xs" style={{ color: colors.mutedForeground }}>
                    PNG, JPG or WebP up to 10 MB. A clear, front-facing photo on a plain background gives the most accurate results.
                  </p>
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="mt-5 inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium"
                    style={{ background: colors.primary, color: colors.primaryForeground }}
                  >
                    <Upload className="h-4 w-4" /> Choose photo
                  </button>
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
  return (
    <div className="h-screen flex overflow-hidden app-page" style={{ background: colors.background }}>
      <Head><title>Photo Studio | SkalX AI</title></Head>
      <Sidebar />
      <main className="min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
          <button type="button" onClick={() => void goHome()} className="mb-3 inline-flex items-center gap-1.5 text-sm" style={{ color: colors.mutedForeground }}>
            <ArrowLeft className="h-4 w-4" /> All shoots
          </button>
          <header className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold" style={{ color: colors.foreground }}>Photo Studio</h1>
              <p className="mt-1 text-sm" style={{ color: colors.mutedForeground }}>Plan the shot list, then shoot. Free while Photo Studio is in beta.</p>
            </div>
            <button
              type="button"
              onClick={() => void goHome()}
              className="rounded-lg px-3 py-2 text-sm"
              style={{ border: `1px solid ${colors.border}`, color: colors.foreground }}
            >
              New product
            </button>
          </header>

          {!shoot.exactAvailable && (
            <p className="mt-4 rounded-lg px-3 py-2 text-xs" style={{ background: "hsl(38 92% 50% / 0.12)", color: "hsl(38 92% 70%)" }}>
              We couldn't isolate the product cleanly from this photo, so catalogue and studio shots are AI-rendered with a fidelity check. For exact shots, upload a photo of the product on its own.
            </p>
          )}

          <div className="mt-6 grid gap-6 lg:grid-cols-[320px_1fr]">
            {/* Product + settings */}
            <aside className="space-y-4">
              <section className="rounded-xl p-4" style={card}>
                <div className="aspect-square overflow-hidden rounded-lg" style={{ background: colors.secondary }}>
                  <img src={preview || shoot.sourceUrl} alt={p.name} className="h-full w-full object-contain" />
                </div>
                {shoot.masterUrl && (
                  <p className="mt-2 text-[11px]" style={{ color: colors.mutedForeground }}>Studio packshot of your product. Every shot is built from this.</p>
                )}
                <p className="mt-3 text-sm font-semibold" style={{ color: colors.foreground }}>{p.name}</p>
                <p className="text-xs" style={{ color: colors.mutedForeground }}>{p.productType}</p>
                <dl className="mt-3 space-y-1 text-xs" style={{ color: colors.mutedForeground }}>
                  {p.finish && <div><dt className="inline" style={{ color: colors.foreground }}>Finish: </dt><dd className="inline">{p.finish}</dd></div>}
                  {p.storyProps.length > 0 && <div><dt className="inline" style={{ color: colors.foreground }}>Props: </dt><dd className="inline">{p.storyProps.join(", ")}</dd></div>}
                  {p.usageContexts.length > 0 && <div><dt className="inline" style={{ color: colors.foreground }}>Used in: </dt><dd className="inline">{p.usageContexts.join(", ")}</dd></div>}
                </dl>
              </section>

              <section className="space-y-4 rounded-xl p-4" style={card}>
                <div>
                  <p className="mb-2 text-xs font-medium" style={{ color: colors.mutedForeground }}>Format</p>
                  <div className="flex flex-wrap gap-1.5">
                    {ASPECTS.map((a) => (
                      <button key={a.id} type="button" onClick={() => setSettings({ ...s, aspect: a.id })}
                        className="rounded-md px-2.5 py-1.5 text-xs"
                        style={s.aspect === a.id ? { background: colors.primary, color: colors.primaryForeground } : { background: colors.secondary, color: colors.foreground }}>
                        {a.label}
                      </button>
                    ))}
                  </div>
                  <p className="mt-1.5 text-[11px]" style={{ color: colors.mutedForeground }}>The marketplace packshot is always square.</p>
                </div>
                <div>
                  <p className="mb-2 text-xs font-medium" style={{ color: colors.mutedForeground }}>Lighting</p>
                  <div className="flex flex-wrap gap-1.5">
                    {LIGHTS.map((l) => (
                      <button key={l.id} type="button" onClick={() => setSettings({ ...s, lighting: l.id })}
                        className="rounded-md px-2.5 py-1.5 text-xs"
                        style={s.lighting === l.id ? { background: colors.primary, color: colors.primaryForeground } : { background: colors.secondary, color: colors.foreground }}>
                        {l.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-xs font-medium" style={{ color: colors.mutedForeground }}>Backdrop colour</p>
                  <div className="flex flex-wrap items-center gap-2">
                    {[...new Set([...shoot.brandColors, "#EDE7DF", "#FFFFFF", "#1C1C1C"])].map((c) => (
                      <button key={c} type="button" aria-label={`Backdrop ${c}`} onClick={() => setSettings({ ...s, backdrop: c })}
                        className="h-7 w-7 rounded-full"
                        style={{ background: c, outline: s.backdrop.toLowerCase() === c.toLowerCase() ? `2px solid ${colors.primary}` : `1px solid ${colors.border}`, outlineOffset: 2 }} />
                    ))}
                    <label className="relative h-7 w-7 cursor-pointer overflow-hidden rounded-full" style={{ border: `1px dashed ${colors.border}` }} aria-label="Custom backdrop colour">
                      <input type="color" value={s.backdrop} onChange={(e) => setSettings({ ...s, backdrop: e.target.value })} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
                      <span className="flex h-full w-full items-center justify-center text-xs" style={{ color: colors.mutedForeground }}>+</span>
                    </label>
                  </div>
                </div>
                {usesModel && (
                  <div>
                    <p className="mb-2 text-xs font-medium" style={{ color: colors.mutedForeground }}>Model</p>
                    <div className="grid grid-cols-2 gap-2">
                      <select value={s.model?.gender || "any"} onChange={(e) => setSettings({ ...s, model: { ...s.model, gender: e.target.value as any } })}
                        className="rounded-md px-2 py-1.5 text-xs" style={{ background: colors.secondary, color: colors.foreground, border: `1px solid ${colors.border}` }}>
                        <option value="any">Any gender</option><option value="woman">Woman</option><option value="man">Man</option>
                      </select>
                      <select value={s.model?.age || "any"} onChange={(e) => setSettings({ ...s, model: { ...s.model, age: e.target.value as any } })}
                        className="rounded-md px-2 py-1.5 text-xs" style={{ background: colors.secondary, color: colors.foreground, border: `1px solid ${colors.border}` }}>
                        <option value="any">Any age</option><option value="18-25">18–25</option><option value="25-40">25–40</option><option value="40+">40+</option>
                      </select>
                    </div>
                    <input value={s.model?.look || ""} onChange={(e) => setSettings({ ...s, model: { ...s.model, look: e.target.value } })}
                      placeholder="Look (optional) — e.g. South Asian, casual"
                      className="mt-2 w-full rounded-md px-2 py-1.5 text-xs outline-none" style={{ background: colors.secondary, color: colors.foreground, border: `1px solid ${colors.border}` }} />
                  </div>
                )}
              </section>
            </aside>

            {/* Shot list + results */}
            <div className="space-y-5">
              {GROUPS.map((g) => {
                const shots = shoot.catalog.filter((x) => x.group === g.id);
                if (!shots.length) return null;
                return (
                  <section key={g.id}>
                    <div className="mb-2 flex items-baseline gap-2">
                      <h2 className="text-sm font-semibold" style={{ color: colors.foreground }}>{g.label}</h2>
                      <span className="text-xs" style={{ color: colors.mutedForeground }}>{g.hint}</span>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {shots.map((shot) => {
                        const on = (selected[shot.id] || 0) > 0;
                        const st = status[shot.id] || "idle";
                        const photos = results.map((r, i) => ({ r, i })).filter((x) => x.r.shotId === shot.id);
                        return (
                          <div key={shot.id} className="rounded-xl p-3.5" style={{ ...card, borderColor: on ? colors.primary : colors.border }}>
                            <div className="flex items-start gap-3">
                              <button type="button" aria-pressed={on} aria-label={`${on ? "Remove" : "Add"} ${shot.label}`}
                                onClick={() => setSelected((m) => ({ ...m, [shot.id]: on ? 0 : 1 }))}
                                className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded"
                                style={{ background: on ? colors.primary : "transparent", border: `1px solid ${on ? colors.primary : colors.border}` }}>
                                {on && <Check className="h-3.5 w-3.5 text-white" />}
                              </button>
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="text-sm font-medium" style={{ color: colors.foreground }}>{shot.label}</p>
                                  <span className="rounded px-1.5 py-0.5 text-[10px]" style={{ background: colors.muted, color: colors.mutedForeground }}>
                                    {METHOD_LABEL[shot.method !== "guided" && !shoot.exactAvailable ? "guided" : shot.method]}
                                  </span>
                                </div>
                                <p className="mt-0.5 text-xs" style={{ color: colors.mutedForeground }}>{shot.description}</p>
                                <p className="mt-1 text-[11px]" style={{ color: colors.mutedForeground }}>For: {shot.purpose}</p>
                                <div className="mt-2 flex items-center justify-between gap-2">
                                  {on && shot.id === "marketplace_white" ? (
                                    <span className="text-[11px]" style={{ color: colors.mutedForeground }}>1 photo (marketplace standard)</span>
                                  ) : on ? (
                                    <div className="flex items-center gap-1 text-[11px]" style={{ color: colors.mutedForeground }}>
                                      Variations
                                      {[1, 2].map((n) => (
                                        <button key={n} type="button" onClick={() => setSelected((m) => ({ ...m, [shot.id]: n }))}
                                          className="h-6 w-6 rounded text-xs"
                                          style={selected[shot.id] === n ? { background: colors.primary, color: colors.primaryForeground } : { background: colors.secondary, color: colors.foreground }}>
                                          {n}
                                        </button>
                                      ))}
                                    </div>
                                  ) : <span />}
                                  {st === "shooting" || st === "queued" ? (
                                    <span className="inline-flex items-center gap-1 text-[11px]" style={{ color: colors.primary }}>
                                      <ArcSpinner className="h-3 w-3 animate-spin" /> {st === "queued" ? "Queued" : "Shooting…"}
                                    </span>
                                  ) : photos.length > 0 || st === "failed" ? (
                                    <button type="button" disabled={running} onClick={() => void runShoot([shot.id])}
                                      className="inline-flex items-center gap-1 text-[11px] disabled:opacity-50" style={{ color: colors.primary }}>
                                      <RefreshCw className="h-3 w-3" /> {st === "failed" ? "Try again" : "Reshoot"}
                                    </button>
                                  ) : null}
                                </div>
                              </div>
                            </div>
                            {(photos.length > 0 || st === "shooting") && (
                              <div className="mt-3 grid grid-cols-3 gap-2">
                                {photos.map(({ r, i }) => (
                                  <button key={r.url} type="button" onClick={() => setViewer(i)} className="aspect-[4/5] overflow-hidden rounded-md" style={{ background: colors.secondary }}>
                                    <img src={r.url} alt={shot.label} className="h-full w-full object-cover" />
                                  </button>
                                ))}
                                {/* Where the new photos will land while they're being shot */}
                                {st === "shooting" &&
                                  Array.from({ length: shot.id === "marketplace_white" ? 1 : selected[shot.id] || 1 }, (_, k) => (
                                    <ShimmerTile key={`pending-${k}`} className="aspect-[4/5] rounded-md" />
                                  ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </section>
                );
              })}

              <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 rounded-xl p-4" style={{ ...card, background: colors.card }}>
                <p className="text-sm" style={{ color: colors.foreground }}>
                  {selectedIds.length} shot{selectedIds.length === 1 ? "" : "s"} · {totalPhotos} photo{totalPhotos === 1 ? "" : "s"} ·{" "}
                  <span style={{ color: colors.mutedForeground }}>Free during beta</span>
                </p>
                <div className="flex gap-2">
                  {results.length > 0 && (
                    <button type="button" onClick={() => setViewer(0)} className="rounded-lg px-3 py-2 text-sm"
                      style={{ border: `1px solid ${colors.border}`, color: colors.foreground }}>
                      View all {results.length}
                    </button>
                  )}
                  {shotIdsShot.size > 0 && (
                    <button
                      type="button"
                      disabled={running || !selectedIds.length}
                      onClick={() => void runShoot(selectedIds)}
                      title="Shoot every selected shot again with the current format, lighting, backdrop and model"
                      className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm disabled:opacity-50"
                      style={remaining.length ? { border: `1px solid ${colors.border}`, color: colors.foreground } : { background: colors.primary, color: colors.primaryForeground }}
                    >
                      <RefreshCw className="h-4 w-4" /> Reshoot all {selectedIds.length}
                    </button>
                  )}
                  {(remaining.length > 0 || shotIdsShot.size === 0) && (
                    <button
                      type="button"
                      disabled={running || !remaining.length}
                      onClick={() => void runShoot(remaining)}
                      className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50"
                      style={{ background: colors.primary, color: colors.primaryForeground }}
                    >
                      {running ? <ArcSpinner className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                      {running ? "Shooting…" : shotIdsShot.size ? `Shoot remaining ${remaining.length}` : "Start shoot"}
                    </button>
                  )}
                  {running && !remaining.length && shotIdsShot.size > 0 && (
                    <span className="inline-flex items-center gap-2 text-sm" style={{ color: colors.primary }}>
                      <ArcSpinner className="h-4 w-4 animate-spin" /> Shooting…
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
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
