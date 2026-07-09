import { randomUUID } from "crypto";
import { supabaseAdmin } from "@/auth/supabase/client";
import { parseVideoDataUrl } from "./parse-video-data-url";

export { parseVideoDataUrl } from "./parse-video-data-url";

/** Inline base64 responses above this size often fail on serverless (~4.5 MB response cap). */
export const MAX_INLINE_VIDEO_BYTES = 3 * 1024 * 1024;

export async function uploadVideoBuffer(buf: Buffer): Promise<string> {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY && !process.env.SUPABASE_SERVICE_ROLE) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not configured. Extended (16s) videos must be uploaded to storage — add this env var in production."
    );
  }

  const storagePath = `generated/videos/${randomUUID()}_${Date.now()}.mp4`;
  const { error } = await supabaseAdmin.storage.from("campaign-assets").upload(storagePath, buf, {
    contentType: "video/mp4",
    cacheControl: "3600",
    upsert: true,
  });

  if (error) {
    throw new Error(`Video storage upload failed: ${error.message}`);
  }

  const { data } = supabaseAdmin.storage.from("campaign-assets").getPublicUrl(storagePath);
  const publicUrl = (data as { publicUrl?: string })?.publicUrl;
  if (!publicUrl) {
    throw new Error("Video uploaded but public URL could not be resolved.");
  }

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
