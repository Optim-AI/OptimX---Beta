/**
 * Product cut-outs: background-removed product photos for poster compositing.
 * Cached per user + source image bytes, so each product photo is cut out once.
 * Never throws for a bad photo — returns ok:false and the poster falls back to
 * letting the image model place the product.
 */

import { createHash } from "crypto";
import sharp from "sharp";
import { dataUrlToBuffer, detectImageMimeType, fetchUrlToBuffer } from "@/lib/creative-studio/nano-banana";
import { getCutoutProvider, type CutoutProvider } from "./providers";
import { assessCutout, type CutoutQuality } from "./quality";

export type { CutoutProvider } from "./providers";
export { getCutoutProvider, LocalUniformCutoutProvider } from "./providers";
export { assessCutout } from "./quality";

export type ProductCutout = {
  ok: boolean;
  /** Trimmed PNG with alpha (null when ok is false) */
  png: Buffer | null;
  url: string | null;
  provider: string;
  quality: CutoutQuality | null;
  cached: boolean;
  error?: string;
};

export type CutoutCacheRow = {
  sourceHash: string;
  sourceUrl: string | null;
  cutoutUrl: string | null;
  storagePath: string | null;
  width: number | null;
  height: number | null;
  provider: string;
  ok: boolean;
  quality: CutoutQuality | Record<string, never>;
};

export interface CutoutCache {
  get(userId: string, sourceHash: string): Promise<CutoutCacheRow | null>;
  put(userId: string, row: CutoutCacheRow): Promise<void>;
}

export type CutoutDeps = {
  /** null = cut-outs off */
  provider?: CutoutProvider | null;
  cache?: CutoutCache;
  store?: (opts: { userId: string; sourceHash: string; png: Buffer }) => Promise<{ url: string; storagePath: string }>;
  loadImage?: (urlOrDataUrl: string) => Promise<Buffer>;
};

async function defaultLoadImage(src: string): Promise<Buffer> {
  return src.startsWith("data:") ? dataUrlToBuffer(src) : fetchUrlToBuffer(src);
}

const dbCache: CutoutCache = {
  async get(userId, sourceHash) {
    const [{ db }, { productCutouts }, { and, eq }] = await Promise.all([
      import("@/database/client"),
      import("@/database/schema"),
      import("drizzle-orm"),
    ]);
    const [row] = await db
      .select()
      .from(productCutouts)
      .where(and(eq(productCutouts.userId, userId), eq(productCutouts.sourceHash, sourceHash)))
      .limit(1);
    return row ? ({ ...row, quality: row.quality as CutoutQuality } as CutoutCacheRow) : null;
  },
  async put(userId, row) {
    const [{ db }, { productCutouts }] = await Promise.all([import("@/database/client"), import("@/database/schema")]);
    await db
      .insert(productCutouts)
      .values({ userId, ...row, quality: row.quality })
      .onConflictDoNothing();
  },
};

async function defaultStore(opts: { userId: string; sourceHash: string; png: Buffer }) {
  const { supabaseAdmin } = await import("@/auth/supabase/admin");
  const storagePath = `product-cutouts/${opts.userId}/${opts.sourceHash}.png`;
  const { error } = await supabaseAdmin.storage
    .from("campaign-assets")
    .upload(storagePath, opts.png, { contentType: "image/png", cacheControl: "31536000", upsert: true });
  if (error) throw new Error(`Cut-out upload failed: ${error.message}`);
  const { data } = supabaseAdmin.storage.from("campaign-assets").getPublicUrl(storagePath);
  return { url: data.publicUrl, storagePath };
}

export async function getProductCutout(
  input: { userId: string; source: string },
  deps: CutoutDeps = {}
): Promise<ProductCutout> {
  const provider = deps.provider !== undefined ? deps.provider : getCutoutProvider();
  if (!provider) {
    return { ok: false, png: null, url: null, provider: "none", quality: null, cached: false, error: "No cut-out provider is configured (set PHOTOROOM_API_KEY or REMOVE_BG_API_KEY)." };
  }
  const cache = deps.cache ?? dbCache;
  const store = deps.store ?? defaultStore;
  const loadImage = deps.loadImage ?? defaultLoadImage;

  let sourceBuffer: Buffer;
  try {
    sourceBuffer = await loadImage(input.source);
  } catch (e) {
    return { ok: false, png: null, url: null, provider: provider.id, quality: null, cached: false, error: `Could not load the product photo: ${(e as Error).message}` };
  }
  const sourceHash = createHash("sha256").update(sourceBuffer).digest("hex").slice(0, 40);

  const hit = await cache.get(input.userId, sourceHash).catch(() => null);
  if (hit) {
    if (!hit.ok || !hit.cutoutUrl) {
      return { ok: false, png: null, url: null, provider: hit.provider, quality: (hit.quality as CutoutQuality) ?? null, cached: true, error: "This product photo couldn't be cut out cleanly." };
    }
    try {
      return { ok: true, png: await loadImage(hit.cutoutUrl), url: hit.cutoutUrl, provider: hit.provider, quality: hit.quality as CutoutQuality, cached: true };
    } catch {
      // Stored file missing — fall through and cut out again.
    }
  }

  let raw: Buffer;
  try {
    raw = await provider.remove({ buffer: sourceBuffer, mimeType: detectImageMimeType(sourceBuffer) });
  } catch (e) {
    // Provider outage: don't cache, so the next poster retries.
    return { ok: false, png: null, url: null, provider: provider.id, quality: null, cached: false, error: `Cut-out provider failed: ${(e as Error).message}` };
  }

  const quality = await assessCutout(raw);
  if (!quality.ok) {
    await cache.put(input.userId, {
      sourceHash, sourceUrl: input.source.startsWith("data:") ? null : input.source,
      cutoutUrl: null, storagePath: null, width: null, height: null, provider: provider.id, ok: false, quality,
    }).catch(() => undefined);
    return { ok: false, png: null, url: null, provider: provider.id, quality, cached: false, error: quality.reasons.join(" ") };
  }

  const png = await sharp(raw).trim({ threshold: 1 }).png().toBuffer();
  const meta = await sharp(png).metadata();
  let url: string | null = null;
  let storagePath: string | null = null;
  try {
    const stored = await store({ userId: input.userId, sourceHash, png });
    url = stored.url;
    storagePath = stored.storagePath;
  } catch (e) {
    console.warn("[cutout] storage failed; using the cut-out without caching", (e as Error).message);
  }
  if (url) {
    await cache.put(input.userId, {
      sourceHash, sourceUrl: input.source.startsWith("data:") ? null : input.source,
      cutoutUrl: url, storagePath, width: meta.width ?? null, height: meta.height ?? null, provider: provider.id, ok: true, quality,
    }).catch(() => undefined);
  }
  return { ok: true, png, url, provider: provider.id, quality, cached: false };
}
