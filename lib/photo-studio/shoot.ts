/**
 * Photo Studio shoot service: one shot at a time (the page drives the shot list so
 * progress shows and no request runs long).
 *
 * Billing works like Ad Studio posters: photos are free to make (capped per day), the
 * browser gets a watermarked preview, and 1 image credit is charged per photo the
 * person KEEPS — which is when the full-quality file is released.
 *
 * Shoots are stored as creative_studio_sessions with session_type "photo", so they
 * appear in Generated Contents without a new table.
 */

import { randomUUID } from "crypto";
import { and, eq, sql } from "drizzle-orm";
import { CreditsDAO } from "@/database/models/Credits.dao";
import { CreativeStudioSessionDAO } from "@/database/models/CreativeStudioSession.dao";
import { getCutoutProvider, getProductCutout } from "@/lib/creative-studio/product-cutouts";
import { getDefaultPosterImageProvider } from "@/lib/creative-studio/poster-generation/generation/provider-router";
import { dataUrlToBuffer, detectImageMimeType, fetchUrlToBuffer } from "@/lib/creative-studio/nano-banana";
import type { ImageGenerationProvider } from "@/lib/creative-studio/poster-generation/types";
import { LabelDriftError, renderShot, type FidelityChecker } from "./render";
import type { ArtDirector } from "./art-direct";
import { refineCutout } from "./cutout-refine";
import {
  FREE_PHOTOS_PER_SHOOT_PER_DAY,
  FREE_PHOTOS_PER_USER_PER_DAY,
  MIN_CREDITS_TO_SHOOT,
  isKept,
  photoId,
  photosInLastDay,
  publishKeptPhoto,
  removeShootFiles,
  storeDraftPhoto,
  toPhotoViews,
} from "./drafts";
import { getShot } from "./shots";
import type { PhotoAspect, PhotoView, ProductProfile, ShootSettings, ShotResult } from "./types";

export class PhotoStudioError extends Error {
  constructor(message: string, readonly status = 500, readonly code = "INTERNAL") {
    super(message);
    this.name = "PhotoStudioError";
  }
}

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
    // Photos from before keep-to-pay live under poster-generation/.
    const { supabaseAdmin } = await import("@/auth/supabase/admin");
    const prefix = `poster-generation/${userId}/photo-${sessionId}`;
    const bucket = supabaseAdmin.storage.from("campaign-assets");
    const { data } = await bucket.list(prefix, { limit: 1000 });
    if (data?.length) await bucket.remove(data.map((f) => `${prefix}/${f.name}`));
    await removeShootFiles(userId, sessionId);
  } catch (e) {
    console.warn("[photoStudio] photo files not removed", { sessionId, error: (e as Error)?.message });
  }
  return "deleted";
}

/** What the session row stores next to the results (kept photos show in Generated Contents). */
function sessionPatch(config: Record<string, unknown>, results: ShotResult[]) {
  return {
    config: { ...config, results } as any,
    generatedPosters: results.filter((r) => isKept(r) && r.url).map((r) => r.url) as any,
    phase: "ready",
    updatedAt: new Date().toISOString(),
  };
}

/** Access to a shoot's photos while its row is locked: nothing else can change them meanwhile. */
export type LockedShoot = {
  results: ShotResult[];
  /** Charge image credits in the same transaction; false = not enough credits */
  pay: (amount: number, photoIds: string[]) => Promise<boolean>;
  save: (results: ShotResult[]) => Promise<void>;
};
export type WithLockedShoot = <T>(userId: string, sessionId: string, fn: (shoot: LockedShoot) => Promise<T>) => Promise<T>;

/**
 * Run `fn` with the shoot's row locked, in ONE transaction: parallel shots can't lose each
 * other's photos, and a double click on Keep can't charge twice.
 */
export const withLockedShoot: WithLockedShoot = async (userId, sessionId, fn) => {
  const [{ db }, { creativeStudioSessions }] = await Promise.all([import("@/database/client"), import("@/database/schema")]);
  return db.transaction(async (tx) => {
    const locked = await tx.execute(
      sql`SELECT config FROM creative_studio_sessions WHERE id = ${sessionId} AND user_id = ${userId} AND session_type = 'photo' FOR UPDATE`
    );
    const rows = ((locked as any).rows ?? locked) as Array<{ config: Record<string, unknown> | null }>;
    if (!rows?.[0]) throw new PhotoStudioError("Shoot not found", 404, "NOT_FOUND");
    const config = (rows[0].config || {}) as Record<string, unknown>;
    return fn({
      results: (Array.isArray(config.results) ? config.results : []) as ShotResult[],
      pay: async (amount, photoIds) =>
        (await CreditsDAO.deductImageCreditsInTransaction(tx, { userId, amount, source: "photo_studio_keep", metadata: { sessionId, photoIds } })).success,
      save: async (results) => {
        await tx
          .update(creativeStudioSessions)
          .set(sessionPatch(config, results))
          .where(and(eq(creativeStudioSessions.id, sessionId), eq(creativeStudioSessions.userId, userId)));
      },
    });
  });
};

export async function appendResults(userId: string, sessionId: string, results: ShotResult[], lock: WithLockedShoot = withLockedShoot) {
  await lock(userId, sessionId, async (shoot) => shoot.save([...shoot.results, ...results]));
}

/** The shoot as the browser sees it: previews for drafts, full files for kept photos. */
export async function getShootView(userId: string, sessionId: string) {
  const state = await getShootSession(userId, sessionId);
  if (!state) return null;
  // A kept photo whose file didn't finish publishing (a crash after payment) is finished here.
  if (state.results.some((r) => r.kept === true && !r.published)) {
    await publishPendingPhotos(userId, sessionId).catch((e) => console.warn("[photoStudio] publish retry failed", { sessionId, error: (e as Error)?.message }));
    const fresh = await getShootSession(userId, sessionId);
    if (fresh) state.results = fresh.results;
  }
  const [results, balance] = await Promise.all([toPhotoViews(state.results), CreditsDAO.getFullBalance(userId).catch(() => null)]);
  return {
    ...state,
    results,
    credits: balance?.imageCredits.total ?? 0,
    photosLeftToday: Math.max(0, FREE_PHOTOS_PER_SHOOT_PER_DAY - photosInLastDay(state.results)),
  };
}

export type KeepDeps = {
  lock?: WithLockedShoot;
  publish?: (userId: string, sessionId: string, r: ShotResult) => Promise<string>;
  getState?: (userId: string, sessionId: string) => Promise<PhotoShootState | null>;
};

/**
 * Keep photos: charge 1 image credit per newly kept photo and mark them kept in ONE
 * transaction, then release the full-quality files. Already-kept photos are never charged again.
 */
export async function keepPhotos(userId: string, sessionId: string, photoIds: string[], deps: KeepDeps = {}): Promise<{ charged: number }> {
  const ids = new Set(photoIds.filter((x) => typeof x === "string" && x.length > 0 && x.length < 200));
  if (!ids.size) throw new PhotoStudioError("Choose at least one photo to keep.", 400, "VALIDATION");
  const charged = await (deps.lock ?? withLockedShoot)(userId, sessionId, async (shoot) => {
    const want = shoot.results.filter((r) => r.kept === false && ids.has(photoId(r)));
    if (!want.length) return 0;
    const n = want.length;
    if (!(await shoot.pay(n, want.map(photoId)))) {
      throw new PhotoStudioError(
        `Keeping ${n} photo${n > 1 ? "s" : ""} needs ${n} image credit${n > 1 ? "s" : ""}. Keep fewer or get more credits.`,
        402,
        "INSUFFICIENT_CREDITS"
      );
    }
    const keptAt = new Date().toISOString();
    await shoot.save(shoot.results.map((r) => (want.includes(r) ? { ...r, kept: true, keptAt } : r)));
    return n;
  });
  await publishPendingPhotos(userId, sessionId, deps);
  console.info("[photoStudio] kept", { userId, sessionId, charged });
  return { charged };
}

/** Release the full file of every kept photo that isn't public yet (also retried when the shoot is opened). */
export async function publishPendingPhotos(userId: string, sessionId: string, deps: KeepDeps = {}): Promise<void> {
  const state = await (deps.getState ?? getShootSession)(userId, sessionId);
  const pending = (state?.results || []).filter((r) => r.kept === true && !r.published && r.storagePath);
  if (!pending.length) return;
  const publish = deps.publish ?? publishKeptPhoto;
  const urls = new Map<string, string>();
  for (const r of pending) {
    try {
      urls.set(photoId(r), await publish(userId, sessionId, r));
    } catch (e) {
      console.error("[photoStudio] publish failed", { sessionId, photo: photoId(r), error: (e as Error)?.message });
    }
  }
  if (!urls.size) return;
  await (deps.lock ?? withLockedShoot)(userId, sessionId, async (shoot) =>
    shoot.save(shoot.results.map((r) => (urls.has(photoId(r)) ? { ...r, url: urls.get(photoId(r))!, published: true } : r)))
  );
}

export type ShootLimitDeps = {
  getBalance?: (userId: string) => Promise<number>;
  /** Photos this person made in the last 24h across all their shoots */
  photosToday?: (userId: string) => Promise<number>;
};

async function userPhotosToday(userId: string): Promise<number> {
  const rows = await CreativeStudioSessionDAO.listByUser(userId, { sessionType: "photo", limit: 50 });
  return rows.reduce((n, r) => n + photosInLastDay((((r.config as any) || {}).results || []) as ShotResult[]), 0);
}

/**
 * Photos are free to make, so making them is limited: the person needs at least one
 * image credit (to keep something), and free photos are capped per shoot and per day.
 */
export async function assertCanShoot(userId: string, state: PhotoShootState, count: number, deps: ShootLimitDeps = {}): Promise<void> {
  const getBalance = deps.getBalance ?? (async (u: string) => (await CreditsDAO.getFullBalance(u))?.imageCredits.total ?? 0);
  if ((await getBalance(userId)) < MIN_CREDITS_TO_SHOOT) {
    throw new PhotoStudioError(
      "You need at least 1 image credit to shoot. Photos are free to make — you only pay 1 credit for each photo you keep.",
      402,
      "INSUFFICIENT_CREDITS"
    );
  }
  if (photosInLastDay(state.results) + count > FREE_PHOTOS_PER_SHOOT_PER_DAY) {
    throw new PhotoStudioError(
      `You've made ${FREE_PHOTOS_PER_SHOOT_PER_DAY} photos of this product today. Keep the ones you like, or come back tomorrow for more.`,
      429,
      "DAILY_LIMIT"
    );
  }
  if ((await (deps.photosToday ?? userPhotosToday)(userId)) + count > FREE_PHOTOS_PER_USER_PER_DAY) {
    throw new PhotoStudioError(
      `You've made ${FREE_PHOTOS_PER_USER_PER_DAY} photos today, which is the daily limit. Keep the ones you like, or come back tomorrow for more.`,
      429,
      "DAILY_LIMIT"
    );
  }
}

/** Paid provider when a key is set, otherwise the free built-in model. */
export function photoCutoutProvider() {
  return getCutoutProvider(process.env, { builtin: true });
}

export type ShootShotDeps = {
  provider?: ImageGenerationProvider;
  getCutout?: (userId: string, source: string) => Promise<Buffer | null>;
  /** Stores the full file privately plus its watermarked preview */
  store?: (userId: string, sessionId: string, id: string, buffer: Buffer) => Promise<{ storagePath: string; previewPath: string }>;
  save?: (userId: string, sessionId: string, results: ShotResult[]) => Promise<void>;
  /** Turns stored photos into what the browser may see */
  view?: (results: ShotResult[]) => Promise<PhotoView[]>;
  limits?: ShootLimitDeps;
  checkFidelity?: FidelityChecker;
  /** Scene writer (null = shot templates). Default: the live art director. */
  artDirector?: ArtDirector | null;
};

/** Shoot one shot (1–2 variations) for a saved shoot session. Free: each photo is a draft until kept. */
export async function shootShot(
  params: { userId: string; sessionId: string; shotId: string; variations?: number; aspect?: PhotoAspect; state: PhotoShootState },
  deps: ShootShotDeps = {}
): Promise<PhotoView[]> {
  const { userId, sessionId, state } = params;
  const shot = getShot(params.shotId);
  if (!shot) throw new PhotoStudioError("Unknown shot", 400, "VALIDATION");
  // The marketplace main image has one correct form, so it's always a single photo.
  const variations = shot.id === "marketplace_white" ? 1 : Math.min(2, Math.max(1, Math.round(params.variations || 1)));
  // The marketplace main image is always square (Amazon/Flipkart/Shopify main slot).
  const aspect = shot.id === "marketplace_white" ? "1:1" : params.aspect || state.settings.aspect || shot.defaultAspect;

  await assertCanShoot(userId, state, variations, deps.limits);

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
  const store = deps.store ?? storeDraftPhoto;

  let labelDrift = false;
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
          artDirector: deps.artDirector,
        });
        return { generationId, out };
      } catch (e) {
        if (e instanceof LabelDriftError) labelDrift = true;
        console.error("[photoStudio] shot failed", { shot: shot.id, error: (e as Error)?.message, issues: e instanceof LabelDriftError ? e.issues : undefined });
        return null;
      }
    })
  );

  const results: ShotResult[] = [];
  for (const r of rendered) {
    if (!r) continue;
    const stored = await store(userId, sessionId, r.generationId, r.out.buffer);
    // A draft: the browser gets its preview; the address is filled in when it is kept.
    results.push({ id: r.generationId, shotId: shot.id, url: "", kept: false, ...stored, method: r.out.method, aspect, fidelity: r.out.fidelity, createdAt: new Date().toISOString() });
  }
  if (!results.length) {
    throw labelDrift
      ? new PhotoStudioError(
          "We couldn't keep the small print on your label accurate in this shot, so we didn't use the photo. Try again, or pick a shot where the product stands upright.",
          502,
          "LABEL_NOT_ACCURATE"
        )
      : new PhotoStudioError("This shot didn't come out. Try again.", 502, "GENERATION_FAILED");
  }
  await (deps.save ?? appendResults)(userId, sessionId, results);
  return (deps.view ?? toPhotoViews)(results);
}
