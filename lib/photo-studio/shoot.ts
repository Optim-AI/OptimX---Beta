/**
 * Photo Studio shoot service: one shot at a time (the page drives the shot list so
 * progress shows and no request runs long). Free while Photo Studio is in beta
 * (PHOTO_STUDIO_CHARGES); afterwards 1 image credit per photo kept.
 * Shoots are stored as creative_studio_sessions with session_type "photo", so they
 * appear in Generated Contents without a new table.
 */

import { randomUUID } from "crypto";
import { CreditsDAO } from "@/database/models/Credits.dao";
import { CreativeStudioSessionDAO } from "@/database/models/CreativeStudioSession.dao";
import { getCutoutProvider, getProductCutout } from "@/lib/creative-studio/product-cutouts";
import { getDefaultPosterImageProvider } from "@/lib/creative-studio/poster-generation/generation/provider-router";
import { storePosterGeneratedImage } from "@/lib/creative-studio/poster-generation/generation/storage";
import { dataUrlToBuffer, detectImageMimeType, fetchUrlToBuffer } from "@/lib/creative-studio/nano-banana";
import type { ImageGenerationProvider } from "@/lib/creative-studio/poster-generation/types";
import { renderShot, type FidelityChecker } from "./render";
import { refineCutout } from "./cutout-refine";
import { getShot } from "./shots";
import type { PhotoAspect, ProductProfile, ShootSettings, ShotResult } from "./types";

export class PhotoStudioError extends Error {
  constructor(message: string, readonly status = 500, readonly code = "INTERNAL") {
    super(message);
    this.name = "PhotoStudioError";
  }
}

/** Beta: shots are free. Flip to true to charge 1 image credit per photo again. */
export const PHOTO_STUDIO_CHARGES = false;

export type PhotoShootState = {
  sourceUrl: string;
  /** Clean studio packshot recreated from the upload (null when it didn't hold up) */
  masterUrl?: string | null;
  /** Product cut-out every composite uses (null = none usable → shots are AI-rendered) */
  cutoutUrl?: string | null;
  /** Older shoots (before the master step) cut the upload out per shot */
  prepared?: boolean;
  profile: ProductProfile;
  settings: ShootSettings;
  shots: string[];
  results: ShotResult[];
};

async function loadSource(url: string): Promise<{ buffer: Buffer; mimeType: string }> {
  const buffer = url.startsWith("data:") ? dataUrlToBuffer(url) : await fetchUrlToBuffer(url);
  return { buffer, mimeType: detectImageMimeType(buffer) || "image/png" };
}

export async function createShootSession(userId: string, state: Omit<PhotoShootState, "results">, brandSnapshot: unknown) {
  const session = await CreativeStudioSessionDAO.create({
    userId,
    name: `Photo shoot · ${state.profile.name}`.slice(0, 120),
    sessionType: "photo",
    brandSnapshot: (brandSnapshot ?? {}) as any,
    phase: "shooting",
    productData: { sourceUrl: state.sourceUrl, masterUrl: state.masterUrl ?? null, cutoutUrl: state.cutoutUrl ?? null, prepared: state.prepared === true, profile: state.profile } as any,
    config: { settings: state.settings, shots: state.shots, results: [] } as any,
    generatedPosters: [] as any,
  } as any);
  return session.id;
}

export async function getShootSession(userId: string, sessionId: string): Promise<PhotoShootState | null> {
  const s = await CreativeStudioSessionDAO.getByIdAndUserId(sessionId, userId);
  if (!s || s.sessionType !== "photo") return null;
  const product = (s.productData || {}) as any;
  const config = (s.config || {}) as any;
  return {
    sourceUrl: product.sourceUrl,
    masterUrl: product.masterUrl ?? null,
    cutoutUrl: product.cutoutUrl ?? null,
    prepared: product.prepared === true,
    profile: product.profile,
    settings: config.settings,
    shots: config.shots || [],
    results: config.results || [],
  };
}

/**
 * Delete a shoot: the session (so it leaves Generated Contents too) and, best effort,
 * its photo files. The source upload and master packshot are kept — they're shared
 * by the cut-out cache.
 */
export async function deleteShootSession(userId: string, sessionId: string): Promise<"deleted" | "not_found" | "failed"> {
  const s = await CreativeStudioSessionDAO.getByIdAndUserId(sessionId, userId);
  if (!s || s.sessionType !== "photo") return "not_found";
  if (!(await CreativeStudioSessionDAO.deleteByIdAndUserId(sessionId, userId))) return "failed";
  try {
    const { supabaseAdmin } = await import("@/auth/supabase/admin");
    const prefix = `poster-generation/${userId}/photo-${sessionId}`;
    const bucket = supabaseAdmin.storage.from("campaign-assets");
    const { data } = await bucket.list(prefix, { limit: 1000 });
    if (data?.length) await bucket.remove(data.map((f) => `${prefix}/${f.name}`));
  } catch (e) {
    console.warn("[photoStudio] photo files not removed", { sessionId, error: (e as Error)?.message });
  }
  return "deleted";
}

async function appendResults(userId: string, sessionId: string, results: ShotResult[]) {
  const s = await CreativeStudioSessionDAO.getByIdAndUserId(sessionId, userId);
  if (!s) return;
  const config = (s.config || {}) as any;
  const all = [...(config.results || []), ...results];
  await CreativeStudioSessionDAO.updateByIdAndUserId(sessionId, userId, {
    config: { ...config, results: all } as any,
    generatedPosters: all.map((r) => r.url) as any,
    phase: "ready",
  } as any);
}

/** Paid provider when a key is set, otherwise the free built-in model. */
export function photoCutoutProvider() {
  return getCutoutProvider(process.env, { builtin: true });
}

export type ShootShotDeps = {
  provider?: ImageGenerationProvider;
  getCutout?: (userId: string, source: string) => Promise<Buffer | null>;
  store?: (userId: string, sessionId: string, id: string, buffer: Buffer) => Promise<string>;
  getBalance?: (userId: string) => Promise<number>;
  deduct?: (userId: string) => Promise<boolean>;
  save?: (userId: string, sessionId: string, results: ShotResult[]) => Promise<void>;
  checkFidelity?: FidelityChecker;
  /** Override PHOTO_STUDIO_CHARGES (tests) */
  charges?: boolean;
};

/** Shoot one shot (1–2 variations) for a saved shoot session. */
export async function shootShot(
  params: { userId: string; sessionId: string; shotId: string; variations?: number; aspect?: PhotoAspect; state: PhotoShootState },
  deps: ShootShotDeps = {}
): Promise<ShotResult[]> {
  const { userId, sessionId, state } = params;
  const shot = getShot(params.shotId);
  if (!shot) throw new PhotoStudioError("Unknown shot", 400, "VALIDATION");
  // The marketplace main image has one correct form, so it's always a single photo.
  const variations = shot.id === "marketplace_white" ? 1 : Math.min(2, Math.max(1, Math.round(params.variations || 1)));
  // The marketplace main image is always square (Amazon/Flipkart/Shopify main slot).
  const aspect = shot.id === "marketplace_white" ? "1:1" : params.aspect || state.settings.aspect || shot.defaultAspect;

  const charges = deps.charges ?? PHOTO_STUDIO_CHARGES;
  const getBalance = deps.getBalance ?? (async (u) => (await CreditsDAO.getFullBalance(u))?.imageCredits.total ?? 0);
  if (charges && (await getBalance(userId)) < variations) {
    throw new PhotoStudioError(`This shot needs ${variations} image credit${variations === 1 ? "" : "s"}.`, 402, "INSUFFICIENT_CREDITS");
  }

  // AI shots work from the clean master packshot when there is one (no hand, no clutter).
  const source = await loadSource(state.masterUrl || state.sourceUrl);
  const getCutout =
    deps.getCutout ??
    (async (u: string, src: string) => {
      const c = await getProductCutout({ userId: u, source: src }, { provider: photoCutoutProvider() });
      return c.ok && c.png ? refineCutout(c.png) : null;
    });
  const loadCutout = async (): Promise<Buffer | null> => {
    if (state.prepared) return state.cutoutUrl ? (await loadSource(state.cutoutUrl)).buffer : null;
    return getCutout(userId, state.sourceUrl);
  };
  const cutout = shot.method === "guided" ? null : await loadCutout().catch(() => null);
  const provider = deps.provider ?? getDefaultPosterImageProvider();
  const store =
    deps.store ??
    (async (u: string, s: string, id: string, buffer: Buffer) =>
      (await storePosterGeneratedImage({ userId: u, sessionId: `photo-${s}`, generationId: id, buffer, contentType: detectImageMimeType(buffer) || "image/jpeg" })).publicUrl);
  const deduct = deps.deduct ?? (async (u: string) => !!(await CreditsDAO.deductImageCredits(u, 1)).success);

  const rendered = await Promise.all(
    Array.from({ length: variations }, async (_, variation) => {
      const generationId = `photo_${randomUUID().slice(0, 12)}`;
      try {
        const out = await renderShot({
          shotId: shot.id,
          profile: state.profile,
          settings: state.settings,
          aspect,
          source,
          cutout,
          provider,
          userId,
          sessionId,
          generationId,
          variation,
          checkFidelity: deps.checkFidelity,
        });
        return { generationId, out };
      } catch (e) {
        console.error("[photoStudio] shot failed", { shot: shot.id, error: (e as Error)?.message });
        return null;
      }
    })
  );

  const results: ShotResult[] = [];
  for (const r of rendered) {
    if (!r) continue;
    const url = await store(userId, sessionId, r.generationId, r.out.buffer);
    // Charge only for photos actually delivered (nothing during the beta).
    if (charges && !(await deduct(userId))) break;
    results.push({ shotId: shot.id, url, method: r.out.method, aspect, fidelity: r.out.fidelity, createdAt: new Date().toISOString() });
  }
  if (!results.length) throw new PhotoStudioError("This shot didn't come out. No credits were charged — try again.", 502, "GENERATION_FAILED");
  await (deps.save ?? appendResults)(userId, sessionId, results);
  return results;
}
