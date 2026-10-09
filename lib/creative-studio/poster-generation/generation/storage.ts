/**
 * Persist generated poster buffers to campaign-assets (same bucket as Brand Studio).
 * Also records into Generated Contents (user_generated_image) with path-based dedupe.
 * Supabase is loaded lazily so unit tests can run without env.
 */

import { detectImageFormatFromBuffer } from "@/lib/media/image-format";

const BUCKET = "campaign-assets";

export type StoredPosterImage = {
  publicUrl: string;
  storagePath: string;
  contentType: string;
  libraryId?: string | null;
};

/** Pure helper — filename extension + MIME from bytes (or explicit override). */
export function resolvePosterStorageFormat(
  buffer: Buffer,
  contentTypeOverride?: string
): { contentType: string; extension: string } {
  const detected = detectImageFormatFromBuffer(buffer);
  if (detected) {
    return {
      contentType: detected.mimeType,
      extension: detected.extension,
    };
  }
  const override = (contentTypeOverride || "").toLowerCase().trim();
  if (override === "image/jpeg" || override === "image/jpg") {
    return { contentType: "image/jpeg", extension: "jpg" };
  }
  if (override === "image/png") {
    return { contentType: "image/png", extension: "png" };
  }
  if (override === "image/webp") {
    return { contentType: "image/webp", extension: "webp" };
  }
  // Unknown bytes — keep legacy PNG label only when no signal at all
  return { contentType: contentTypeOverride || "image/png", extension: "png" };
}

export function buildPosterStoragePath(opts: {
  userId: string;
  sessionId: string;
  generationId: string;
  extension: string;
}): string {
  const ext = opts.extension.replace(/^\./, "") || "png";
  return `poster-generation/${opts.userId}/${opts.sessionId}/${opts.generationId}.${ext}`;
}

export async function storePosterGeneratedImage(options: {
  userId: string;
  sessionId: string;
  generationId: string;
  buffer: Buffer;
  contentType?: string;
  metadata?: Record<string, unknown>;
}): Promise<StoredPosterImage> {
  const format = resolvePosterStorageFormat(
    options.buffer,
    options.contentType
  );
  const storagePath = buildPosterStoragePath({
    userId: options.userId,
    sessionId: options.sessionId,
    generationId: options.generationId,
    extension: format.extension,
  });

  const { supabaseAdmin } = await import("@/auth/supabase/admin");
  const { error } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(storagePath, options.buffer, {
      cacheControl: "3600",
      contentType: format.contentType,
      upsert: true,
    });

  if (error) {
    throw new Error(`Storage upload failed: ${error.message}`);
  }

  const { data } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(storagePath);
  const publicUrl = (data as { publicUrl?: string })?.publicUrl;
  if (!publicUrl) {
    throw new Error("Storage upload succeeded but public URL missing");
  }

  let libraryId: string | null = null;
  try {
    const { recordGeneratedCreative } = await import(
      "@/lib/social/generated-contents/record"
    );
    const recorded = await recordGeneratedCreative({
      userId: options.userId,
      mediaUrl: publicUrl,
      storagePath,
      mediaType: "image",
      source: "poster-generation",
      metadata: {
        sessionId: options.sessionId,
        generationId: options.generationId,
        contentType: format.contentType,
        ...(options.metadata || {}),
      },
    });
    libraryId = recorded?.id ?? null;
  } catch (e) {
    console.warn("[storePosterGeneratedImage] library record skipped:", e);
  }

  return {
    publicUrl,
    storagePath,
    contentType: format.contentType,
    libraryId,
  };
}
