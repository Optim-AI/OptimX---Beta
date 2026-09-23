/**
 * Persist generated poster buffers to campaign-assets (same bucket as Brand Studio).
 * Supabase is loaded lazily so unit tests can run without env.
 */

const BUCKET = "campaign-assets";

export type StoredPosterImage = {
  publicUrl: string;
  storagePath: string;
};

export async function storePosterGeneratedImage(options: {
  userId: string;
  sessionId: string;
  generationId: string;
  buffer: Buffer;
  contentType?: string;
}): Promise<StoredPosterImage> {
  const contentType = options.contentType || "image/png";
  const storagePath = `poster-generation/${options.userId}/${options.sessionId}/${options.generationId}.png`;

  const { supabaseAdmin } = await import("@/auth/supabase/client");
  const { error } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(storagePath, options.buffer, {
      cacheControl: "3600",
      contentType,
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

  return { publicUrl, storagePath };
}
