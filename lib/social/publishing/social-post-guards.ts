/**
 * Shared guards for organic social publish (Facebook Page + Instagram).
 * Pure helpers — used by API routes and regression tests.
 */

export type SocialPostGuardRow = {
  id: string;
  userId: string;
  provider?: string | null;
  status: string;
  metaPostId?: string | null;
  sourceImageId?: string | null;
  sourceImageUrl?: string | null;
  metadata?: unknown;
};

export type SocialPostGuardResult =
  | { ok: true }
  | {
      ok: false;
      status: number;
      code: string;
      error: string;
      ambiguous?: boolean;
      retrySafe?: boolean;
    };

function metadataAmbiguous(metadata: unknown): boolean {
  if (!metadata || typeof metadata !== "object") return false;
  return Boolean((metadata as Record<string, unknown>).ambiguous);
}

/**
 * Validate an existing social_posts row before attempting Graph publish.
 * Does not mutate state — pair with SocialPostDAO.claimForPublish for concurrency.
 */
export function evaluateSocialPostForPublish(opts: {
  existing: SocialPostGuardRow;
  expectedProvider: string;
  /** Authenticated user — must match row.userId */
  userId: string;
  sourceImageId?: string | null;
  /** User explicitly acknowledges retry after an ambiguous prior outcome */
  forceRetry?: boolean;
}): SocialPostGuardResult {
  const { existing, expectedProvider, userId } = opts;

  if (existing.userId !== userId) {
    return {
      ok: false,
      status: 404,
      code: "not_found",
      error: "Social post not found",
    };
  }

  if (existing.provider && existing.provider !== expectedProvider) {
    return {
      ok: false,
      status: 400,
      code: "provider_mismatch",
      error:
        "This social post belongs to a different platform. Start a new draft for the selected platform.",
      retrySafe: false,
    };
  }

  if (
    opts.sourceImageId &&
    existing.sourceImageId &&
    String(existing.sourceImageId) !== String(opts.sourceImageId)
  ) {
    return {
      ok: false,
      status: 400,
      code: "creative_mismatch",
      error: "This social post is linked to a different creative.",
      retrySafe: false,
    };
  }

  if (existing.status === "published" && existing.metaPostId) {
    return {
      ok: false,
      status: 409,
      code: "already_published",
      error: "This post was already published",
      retrySafe: false,
    };
  }

  if (existing.status === "publishing") {
    return {
      ok: false,
      status: 409,
      code: "publish_in_progress",
      error:
        "A publish is already in progress. Do not retry until status is known.",
      ambiguous: true,
      retrySafe: false,
    };
  }

  if (
    existing.status === "failed" &&
    metadataAmbiguous(existing.metadata) &&
    !opts.forceRetry
  ) {
    return {
      ok: false,
      status: 409,
      code: "ambiguous_prior",
      error:
        "A previous publish attempt had an unclear result. Check the platform for a possible duplicate before retrying.",
      ambiguous: true,
      retrySafe: false,
    };
  }

  if (existing.status !== "draft" && existing.status !== "failed") {
    return {
      ok: false,
      status: 409,
      code: "invalid_status",
      error: `Cannot publish from status "${existing.status}"`,
      retrySafe: false,
    };
  }

  return { ok: true };
}

/** Build the JSON body fields that must include socialPostId when known. */
export function buildPublishRequestBody(opts: {
  platform: "facebook" | "instagram";
  mediaUrl: string;
  mediaType: "image" | "video";
  caption: string;
  sourceImageId?: string | null;
  sourceImagePath?: string | null;
  socialPostId?: string | null;
  draft?: boolean;
  forceRetry?: boolean;
}): Record<string, unknown> {
  const base: Record<string, unknown> = {
    caption: opts.caption,
    draft: Boolean(opts.draft),
  };
  if (opts.socialPostId) base.socialPostId = opts.socialPostId;
  if (opts.sourceImageId) base.sourceImageId = opts.sourceImageId;
  if (opts.sourceImagePath) base.sourceImagePath = opts.sourceImagePath;
  if (opts.forceRetry) base.forceRetry = true;

  if (opts.platform === "instagram") {
    base.mediaUrl = opts.mediaUrl;
    base.mediaType = opts.mediaType;
  } else {
    base.imageUrl = opts.mediaUrl;
  }
  return base;
}
