/**
 * Secure helpers for the legacy `/api/auth/instagram/post` route.
 * Organic Instagram only (provider = meta-instagram). Never Ads `meta`.
 */

import { META_INSTAGRAM_PROVIDER } from "@/lib/social/instagram/scopes";

export const LEGACY_IG_ADS_PROVIDER = "meta" as const;
export const LEGACY_IG_PUBLISH_PROVIDER = "meta-publish" as const;

export type LegacyIgIntegrationRow = {
  provider?: string | null;
  user_id?: string | null;
  igUserId?: string | null;
  pageAccessToken?: string | null;
  pageId?: string | null;
  healthStatus?: string | null;
  healthErrorMessage?: string | null;
};

export type LegacyIgCreds = {
  userId: string;
  provider: typeof META_INSTAGRAM_PROVIDER;
  igUserId: string;
  pageAccessToken: string;
  pageId: string | null;
};

export type LegacyIgResolveFailure = {
  ok: false;
  status: number;
  code: string;
  error: string;
};

export type LegacyIgResolveSuccess = {
  ok: true;
  creds: LegacyIgCreds;
};

/**
 * Provider that must be requested from storage for this legacy route.
 * Tests assert we never ask for Ads `meta`.
 */
export function legacyInstagramOrganicProvider(): typeof META_INSTAGRAM_PROVIDER {
  return META_INSTAGRAM_PROVIDER;
}

export function isAdsOrWrongPublishProvider(provider: string | null | undefined): boolean {
  const p = String(provider || "");
  return (
    p === LEGACY_IG_ADS_PROVIDER ||
    p === LEGACY_IG_PUBLISH_PROVIDER ||
    (p !== "" && p !== META_INSTAGRAM_PROVIDER)
  );
}

/**
 * Resolve credentials for legacy IG image publish after auth + user-scoped load.
 */
export function resolveLegacyInstagramOrganicCreds(opts: {
  userId: string | null | undefined;
  integration: LegacyIgIntegrationRow | null | undefined;
}): LegacyIgResolveSuccess | LegacyIgResolveFailure {
  if (!opts.userId) {
    return {
      ok: false,
      status: 401,
      code: "unauthorized",
      error: "Authentication required",
    };
  }

  const integration = opts.integration;
  if (!integration) {
    return {
      ok: false,
      status: 404,
      code: "not_connected",
      error:
        "Instagram is not connected. Connect an Instagram professional account in Social Studio first.",
    };
  }

  const provider = String(integration.provider || "");
  if (provider === LEGACY_IG_ADS_PROVIDER) {
    return {
      ok: false,
      status: 403,
      code: "wrong_provider",
      error:
        "Ads credentials cannot be used for Instagram publishing. Connect Instagram organic publishing.",
    };
  }
  if (provider && provider !== META_INSTAGRAM_PROVIDER) {
    return {
      ok: false,
      status: 403,
      code: "wrong_provider",
      error:
        "This endpoint requires an Instagram organic connection (meta-instagram).",
    };
  }

  if (integration.user_id && integration.user_id !== opts.userId) {
    return {
      ok: false,
      status: 403,
      code: "forbidden",
      error: "You do not have access to this Instagram connection.",
    };
  }

  const unhealthy = ["expired", "revoked", "invalid"];
  if (
    integration.healthStatus &&
    unhealthy.includes(String(integration.healthStatus))
  ) {
    return {
      ok: false,
      status: 401,
      code: "reconnect_required",
      error:
        integration.healthErrorMessage ||
        "Your Instagram connection needs to be refreshed.",
    };
  }

  const igUserId = integration.igUserId ? String(integration.igUserId) : "";
  const pageAccessToken = integration.pageAccessToken
    ? String(integration.pageAccessToken)
    : "";

  if (!igUserId || !pageAccessToken) {
    return {
      ok: false,
      status: 400,
      code: "incomplete_connection",
      error:
        "Instagram connection is incomplete. Reconnect Instagram publishing.",
    };
  }

  return {
    ok: true,
    creds: {
      userId: opts.userId,
      provider: META_INSTAGRAM_PROVIDER,
      igUserId,
      pageAccessToken,
      pageId: integration.pageId ? String(integration.pageId) : null,
    },
  };
}

/** Strip secrets from Graph-style payloads before returning to clients. */
export function sanitizeLegacyPostClientPayload(payload: unknown): unknown {
  if (payload == null || typeof payload !== "object") return payload;
  if (Array.isArray(payload)) {
    return payload.map(sanitizeLegacyPostClientPayload);
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(payload as Record<string, unknown>)) {
    const key = k.toLowerCase();
    if (
      key.includes("token") ||
      key.includes("secret") ||
      key.includes("authorization") ||
      key === "access_token" ||
      key === "pageaccesstoken"
    ) {
      continue;
    }
    out[k] = sanitizeLegacyPostClientPayload(v);
  }
  return out;
}

export function publicGraphErrorMessage(graphJson: any): string {
  const msg = graphJson?.error?.message;
  if (typeof msg === "string" && msg.trim()) {
    // Avoid echoing long raw dumps that might include request params
    return msg.slice(0, 300);
  }
  return "Instagram publish failed";
}

export type LegacyIgPostGraphDeps = {
  createMediaContainer: (opts: {
    igUserId: string;
    imageUrl: string;
    caption: string;
    accessToken: string;
  }) => Promise<{ id?: string; error?: unknown }>;
  publishMedia: (opts: {
    igUserId: string;
    creationId: string;
    accessToken: string;
  }) => Promise<{ id?: string; error?: unknown }>;
  createFacebookPhoto?: (opts: {
    pageId: string;
    imageUrl: string;
    caption: string;
    accessToken: string;
  }) => Promise<unknown>;
};

/**
 * Execute IG image container → publish using already-resolved organic creds.
 */
export async function executeLegacyInstagramImagePost(
  opts: {
    creds: LegacyIgCreds;
    imageUrl: string;
    caption?: string;
    alsoPostToFacebook?: boolean;
  },
  deps: LegacyIgPostGraphDeps
): Promise<
  | {
      ok: true;
      creationId: string;
      mediaId: string | null;
      facebookPost: unknown | null;
    }
  | { ok: false; status: number; code: string; error: string }
> {
  const caption = opts.caption || "";
  const createJson = await deps.createMediaContainer({
    igUserId: opts.creds.igUserId,
    imageUrl: opts.imageUrl,
    caption,
    accessToken: opts.creds.pageAccessToken,
  });

  if ((createJson as any)?.error) {
    return {
      ok: false,
      status: 400,
      code: "graph_create_failed",
      error: publicGraphErrorMessage(createJson),
    };
  }

  const creationId = String((createJson as any)?.id || "");
  if (!creationId) {
    return {
      ok: false,
      status: 502,
      code: "graph_create_failed",
      error: "Instagram did not return a media container id",
    };
  }

  const publishJson = await deps.publishMedia({
    igUserId: opts.creds.igUserId,
    creationId,
    accessToken: opts.creds.pageAccessToken,
  });

  if ((publishJson as any)?.error) {
    return {
      ok: false,
      status: 400,
      code: "graph_publish_failed",
      error: publicGraphErrorMessage(publishJson),
    };
  }

  const mediaId = (publishJson as any)?.id
    ? String((publishJson as any).id)
    : null;

  let facebookPost: unknown | null = null;
  if (
    opts.alsoPostToFacebook &&
    opts.creds.pageId &&
    deps.createFacebookPhoto
  ) {
    try {
      facebookPost = await deps.createFacebookPhoto({
        pageId: opts.creds.pageId,
        imageUrl: opts.imageUrl,
        caption,
        accessToken: opts.creds.pageAccessToken,
      });
      facebookPost = sanitizeLegacyPostClientPayload(facebookPost);
    } catch {
      facebookPost = {
        error: "Facebook Page photo publish failed",
      };
    }
  }

  return {
    ok: true,
    creationId,
    mediaId,
    facebookPost,
  };
}
