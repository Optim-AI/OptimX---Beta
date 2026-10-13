import {
  createInstagramMedia,
  createInstagramVideoMedia,
  publishInstagramMedia,
  waitForInstagramContainerReady,
  getInstagramMedia,
} from "@/integrations/meta/instagram";
import {
  validateCaption,
  validateInstagramPublicMediaUrl,
} from "@/lib/social/instagram/media";

export type PublishInstagramInput = {
  igUserId: string;
  /** Page access token (Facebook Login IG flow). */
  accessToken: string;
  mediaUrl: string;
  mediaType?: "image" | "video";
  caption?: string;
  /** Test injections */
  createImageContainer?: typeof createInstagramMedia;
  createVideoContainer?: typeof createInstagramVideoMedia;
  waitForReady?: typeof waitForInstagramContainerReady;
  publishContainer?: typeof publishInstagramMedia;
  fetchPublished?: typeof getInstagramMedia;
  validateUrl?: typeof validateInstagramPublicMediaUrl;
};

export type PublishInstagramResult =
  | {
      ok: true;
      mediaId: string;
      containerId: string;
      permalink: string | null;
      mediaType: "image" | "video";
    }
  | {
      ok: false;
      error: string;
      code?: string;
      ambiguous?: boolean;
    };

/**
 * Instagram Content Publishing: create container → poll → media_publish.
 * Does not auto-retry after media_publish (ambiguous duplicate risk).
 */
export async function publishInstagramCreative(
  input: PublishInstagramInput
): Promise<PublishInstagramResult> {
  const cap = validateCaption(input.caption);
  if (!cap.ok) return { ok: false, error: cap.error, code: "invalid_caption" };

  if (!input.igUserId || !input.accessToken) {
    return { ok: false, error: "Missing Instagram credentials", code: "missing_ig" };
  }

  const validateUrl = input.validateUrl ?? validateInstagramPublicMediaUrl;
  const mediaCheck = await validateUrl(input.mediaUrl, {
    mediaTypeHint: input.mediaType,
  });
  if (!mediaCheck.ok) {
    return { ok: false, error: mediaCheck.error, code: mediaCheck.code };
  }

  const createImage = input.createImageContainer ?? createInstagramMedia;
  const createVideo = input.createVideoContainer ?? createInstagramVideoMedia;
  const waitReady = input.waitForReady ?? waitForInstagramContainerReady;
  const publish = input.publishContainer ?? publishInstagramMedia;
  const fetchPublished = input.fetchPublished ?? getInstagramMedia;

  let containerId: string | null = null;

  try {
    if (mediaCheck.mediaKind === "video") {
      const container = await createVideo({
        igUserId: input.igUserId,
        videoUrl: mediaCheck.url,
        caption: cap.caption || undefined,
        accessToken: input.accessToken,
        mediaType: "REELS",
      });
      containerId = container.id;
    } else {
      const container = await createImage({
        igUserId: input.igUserId,
        imageUrl: mediaCheck.url,
        caption: cap.caption || undefined,
        accessToken: input.accessToken,
      });
      containerId = container.id;
    }

    if (!containerId) {
      return {
        ok: false,
        error: "Instagram returned an empty container id",
        code: "ambiguous_response",
        ambiguous: true,
      };
    }

    // Images are often FINISHED immediately; videos need polling.
    await waitReady({
      containerId,
      accessToken: input.accessToken,
      timeoutMs: mediaCheck.mediaKind === "video" ? 180_000 : 60_000,
    });

    const published = await publish({
      igUserId: input.igUserId,
      creationId: containerId,
      accessToken: input.accessToken,
    });

    const mediaId = published?.id ? String(published.id) : null;
    if (!mediaId) {
      return {
        ok: false,
        error:
          "Instagram publish returned no media id. Do not retry automatically — check Instagram for a possible duplicate.",
        code: "ambiguous_response",
        ambiguous: true,
      };
    }

    let permalink: string | null = null;
    try {
      const detail = await fetchPublished({
        mediaId,
        accessToken: input.accessToken,
      });
      permalink = detail.permalink || null;
    } catch {
      // non-fatal
    }

    return {
      ok: true,
      mediaId,
      containerId,
      permalink,
      mediaType: mediaCheck.mediaKind,
    };
  } catch (e: any) {
    const message = e?.message || "Instagram publish failed";
    const ambiguous =
      Boolean(containerId) &&
      (/timeout|network|ECONNRESET|fetch failed|503|502|ambiguous/i.test(message) ||
        /media_publish/i.test(message));
    return {
      ok: false,
      error: message,
      code: "meta_api_error",
      ambiguous,
    };
  }
}
