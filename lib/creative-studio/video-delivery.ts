import { randomUUID } from "crypto";
import { supabaseAdmin } from "@/auth/supabase/admin";
import { parseVideoDataUrl } from "./parse-video-data-url";

export { parseVideoDataUrl } from "./parse-video-data-url";

/** Inline base64 responses above this size often fail on serverless (~4.5 MB response cap). */
export const MAX_INLINE_VIDEO_BYTES = 3 * 1024 * 1024;

const CAMPAIGN_ASSETS_BUCKET = "campaign-assets";
/** Soft check matching production campaign-assets limit (200 MiB). */
const STORAGE_SOFT_LIMIT_BYTES = 209715200;

export async function uploadVideoBuffer(buf: Buffer): Promise<string> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY && !process.env.SUPABASE_SERVICE_ROLE) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not configured. Extended (16s) videos must be uploaded to storage — add this env var in production."
    );
  }

  const supabaseHost = (() => {
    const raw = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
    try {
      return new URL(raw).host;
    } catch {
      return "unknown";
    }
  })();
  const isLocalSupabase = /localhost|127\.0\.0\.1|54321/.test(supabaseHost);
  const downloadedBytes = buf.length;
  const downloadedMB = Number((downloadedBytes / (1024 * 1024)).toFixed(3));
  const objectPath = `generated/videos/${randomUUID()}_${Date.now()}.mp4`;
  const uploadMethod = "supabase.storage.upload(standard, full-buffer)";

  console.log("[video-delivery] storage.upload.start", {
    supabaseHost,
    isLocalSupabase,
    bucket: CAMPAIGN_ASSETS_BUCKET,
    objectPath,
    uploadMethod,
    contentType: "video/mp4",
    downloadedBytes,
    downloadedMB,
    underConfiguredLimit: downloadedBytes <= STORAGE_SOFT_LIMIT_BYTES,
  });

  if (downloadedBytes > STORAGE_SOFT_LIMIT_BYTES) {
    throw new Error(
      `Video storage upload failed: file is ${downloadedMB} MB which exceeds the configured ${STORAGE_SOFT_LIMIT_BYTES / (1024 * 1024)} MiB limit for ${CAMPAIGN_ASSETS_BUCKET}`
    );
  }

  const { error } = await supabaseAdmin.storage.from(CAMPAIGN_ASSETS_BUCKET).upload(objectPath, buf, {
    contentType: "video/mp4",
    cacheControl: "3600",
    upsert: true,
  });

  if (error) {
    console.error("[video-delivery] storage.upload.failed", {
      supabaseHost,
      isLocalSupabase,
      bucket: CAMPAIGN_ASSETS_BUCKET,
      objectPath,
      uploadMethod,
      downloadedBytes,
      downloadedMB,
      error: error.message,
    });
    throw new Error(`Video storage upload failed: ${error.message}`);
  }

  const { data } = supabaseAdmin.storage.from(CAMPAIGN_ASSETS_BUCKET).getPublicUrl(objectPath);
  const publicUrl = (data as { publicUrl?: string })?.publicUrl;
  if (!publicUrl) {
    throw new Error("Video uploaded but public URL could not be resolved.");
  }

  console.log("[video-delivery] storage.upload.completed", {
    supabaseHost,
    isLocalSupabase,
    bucket: CAMPAIGN_ASSETS_BUCKET,
    objectPath,
    uploadMethod,
    downloadedBytes,
    downloadedMB,
  });

  return publicUrl;
}

/**
 * Return a URL the browser can play.
 * Stitched / large videos MUST use storage — never inline multi-MB base64 on serverless.
 */
export async function resolveVideoDeliveryUrl(
  dataUrl: string,
  options: { forceUpload?: boolean } = {}
): Promise<{ videoUrl: string; delivery: "storage" | "inline"; bytes: number }> {
  const buf = parseVideoDataUrl(dataUrl);
  if (!buf) {
    return { videoUrl: dataUrl, delivery: "inline", bytes: 0 };
  }

  const forceUpload = options.forceUpload === true;
  if (!forceUpload && buf.length <= MAX_INLINE_VIDEO_BYTES) {
    return { videoUrl: dataUrl, delivery: "inline", bytes: buf.length };
  }

  const publicUrl = await uploadVideoBuffer(buf);
  return { videoUrl: publicUrl, delivery: "storage", bytes: buf.length };
}
