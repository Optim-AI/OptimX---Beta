import {
  createFacebookPost,
  type CreateFacebookPostInput,
} from "@/integrations/meta/facebook";
import { validateCaption } from "@/lib/social/facebook-publish/media";
import {
  createDefaultResolveDeps,
  resolvePublishImageSource,
  type ResolvePublishImageDeps,
  type ResolvePublishImageResult,
} from "@/lib/social/facebook-publish/resolve-media";

export type PublishPhotoInput = {
  pageId: string;
  pageAccessToken: string;
  userId: string;
  imageUrl?: string;
  sourceImageId?: string | null;
  sourceImagePath?: string | null;
  caption?: string;
  /** Test-only injection — never pass from production routes. */
  createPost?: (input: CreateFacebookPostInput) => Promise<{ id: string; post_id?: string }>;
  resolveDeps?: ResolvePublishImageDeps;
  resolveImage?: (opts: {
    userId: string;
    imageUrl?: string | null;
    sourceImageId?: string | null;
    sourceImagePath?: string | null;
    deps: ResolvePublishImageDeps;
  }) => Promise<ResolvePublishImageResult>;
};

export type PublishPhotoResult =
  | {
      ok: true;
      photoId: string | null;
      postId: string | null;
      raw: { id?: string; post_id?: string };
      uploadMode: "url" | "multipart";
      canonicalUrl: string;
    }
  | {
      ok: false;
      error: string;
      code?: string;
      ambiguous?: boolean;
    };

/**
 * Publish a photo to a Facebook Page. Does not auto-retry on ambiguous failures.
 * Local / private storage images are uploaded as multipart `source`.
 * Public HTTPS images use Meta's `url` fetch.
 */
export async function publishFacebookPagePhoto(
  input: PublishPhotoInput
): Promise<PublishPhotoResult> {
  const cap = validateCaption(input.caption);
  if (!cap.ok) return { ok: false, error: cap.error, code: "invalid_caption" };

  if (!input.pageId || !input.pageAccessToken) {
    return { ok: false, error: "Missing Page credentials", code: "missing_page" };
  }

  if (!input.userId) {
    return { ok: false, error: "Missing user", code: "unauthorized" };
  }

  const deps = input.resolveDeps ?? (await createDefaultResolveDeps());
  const resolve = input.resolveImage ?? resolvePublishImageSource;
  const resolved = await resolve({
    userId: input.userId,
    imageUrl: input.imageUrl,
    sourceImageId: input.sourceImageId,
    sourceImagePath: input.sourceImagePath,
    deps,
  });

  if (!resolved.ok) {
    return {
      ok: false,
      error: resolved.error,
      code: resolved.code || "invalid_media",
    };
  }

  const createPost = input.createPost ?? createFacebookPost;

  try {
    const base = {
      pageId: input.pageId,
      message: cap.caption || undefined,
      accessToken: input.pageAccessToken,
    };

    const result =
      resolved.image.mode === "multipart"
        ? await createPost({
            ...base,
            imageBuffer: resolved.image.buffer,
            imageContentType: resolved.image.contentType,
            imageFilename: resolved.image.filename,
          })
        : await createPost({
            ...base,
            imageUrl: resolved.image.url,
          });

    const photoId = result.id ? String(result.id) : null;
    const postId = result.post_id ? String(result.post_id) : photoId;

    if (!photoId && !postId) {
      return {
        ok: false,
        error: "Facebook returned an empty success payload",
        code: "ambiguous_response",
        ambiguous: true,
      };
    }

    return {
      ok: true,
      photoId,
      postId,
      raw: result,
      uploadMode: resolved.image.mode,
      canonicalUrl: resolved.image.canonicalUrl,
    };
  } catch (e: any) {
    const message = e?.message || "Facebook publish failed";
    const ambiguous =
      /timeout|network|ECONNRESET|fetch failed|503|502/i.test(message) ||
      message.includes("ambiguous");
    return {
      ok: false,
      error: message.replace(/^Facebook post creation failed:\s*/i, ""),
      code: "meta_api_error",
      ambiguous,
    };
  }
}
