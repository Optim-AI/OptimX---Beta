/**
 * Persist generated creatives into user_generated_image for the library.
 * Dedupes by (userId + imagePath) or (userId + imageUrl).
 */
import { GeneratedImageDAO } from "@/database/models/GeneratedImage.dao";

export type CreativeMediaType = "image" | "video";

export type RecordGeneratedCreativeInput = {
  userId: string;
  mediaUrl: string;
  storagePath?: string | null;
  mediaType?: CreativeMediaType;
  source?: string;
  metadata?: Record<string, unknown>;
};

/**
 * Create or update a library record. Never throws to callers that must not
 * fail generation — returns null on failure after logging.
 */
export async function recordGeneratedCreative(
  input: RecordGeneratedCreativeInput
): Promise<{ id: string; created: boolean } | null> {
  try {
    if (!input.userId || !input.mediaUrl) return null;
    if (input.mediaUrl.startsWith("data:")) {
      // Data URLs are not durable library entries
      return null;
    }

    const mediaType = input.mediaType ?? "image";
    const metadata = {
      ...(input.metadata || {}),
      mediaType,
    };

    const existing = await GeneratedImageDAO.findExisting({
      userId: input.userId,
      imagePath: input.storagePath ?? null,
      imageUrl: input.mediaUrl,
    });

    if (existing) {
      const updated = await GeneratedImageDAO.updateMetadata(existing.id, {
        ...((existing.metadata as Record<string, unknown>) || {}),
        ...metadata,
        lastSeenAt: new Date().toISOString(),
      });
      return { id: updated?.id || existing.id, created: false };
    }

    const row = await GeneratedImageDAO.insert(
      input.userId,
      input.mediaUrl,
      input.storagePath ?? null,
      metadata,
      input.source ?? "generated",
      mediaType
    );
    return { id: row.id, created: true };
  } catch (e) {
    console.warn("[recordGeneratedCreative] failed:", (e as Error)?.message || e);
    return null;
  }
}
