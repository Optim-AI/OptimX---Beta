/**
 * Inspect Meta token grants without exposing tokens to the client.
 *
 * Important: Facebook Login for Business tokens often put Page permissions in
 * `granular_scopes` (with target_ids). Using only `data.scopes` can falsely
 * report pages_manage_posts as missing.
 */

const VERSION = process.env.FACEBOOK_API_VERSION || "23.0";

export type GranularScopeSummary = {
  scope: string;
  /** Count only — never log or return the actual Page IDs. */
  targetIdCount: number;
};

export type MePermissionStatus = {
  permission: string;
  status: string;
};

/**
 * Sanitized breakdown of how Meta reported grants. Safe to log:
 * permission names, statuses, and target-ID counts only.
 */
export type PermissionSourceDiagnostics = {
  debugScopes: string[];
  granularScopes: GranularScopeSummary[];
  mePermissions: MePermissionStatus[];
  requiredDetected: {
    pages_show_list: boolean;
    pages_manage_posts: boolean;
  };
  /** Whether selected Page id appears in pages_manage_posts target_ids (if any). */
  selectedPageCoveredByManagePosts: boolean | null;
  managePostsTargetIdCount: number | null;
};

export type TokenPermissionSnapshot = {
  scopes: string[];
  hasManagePosts: boolean;
  hasShowList: boolean;
  hasReadEngagement: boolean;
  /** Hard requirements for Page discovery + photo publish API calls. */
  missingRequired: string[];
  /** Documented Meta dependency; warn only — not a hard finalize block. */
  missingRecommended: string[];
  rawError?: string;
  source?: "debug_token" | "me_permissions" | "merged" | "none";
  diagnostics?: PermissionSourceDiagnostics;
};

/** Minimum needed for me/accounts + /{page-id}/photos. */
export const REQUIRED_PUBLISH_SCOPES = [
  "pages_show_list",
  "pages_manage_posts",
] as const;

/**
 * Meta lists pages_read_engagement as a dependency of pages_manage_posts for
 * App Review / Pages API docs. Our publish path does not call engagement-read
 * endpoints, so missing it alone must not block finalize when manage_posts is granted.
 */
export const RECOMMENDED_PUBLISH_SCOPES = ["pages_read_engagement"] as const;

export function extractGranularScopeSummaries(
  data: any
): GranularScopeSummary[] {
  if (!Array.isArray(data?.granular_scopes)) return [];
  return data.granular_scopes
    .map((g: any) => {
      const scope = String(g?.scope || g?.permission || "").trim();
      if (!scope) return null;
      const targets = Array.isArray(g?.target_ids) ? g.target_ids : [];
      return {
        scope,
        targetIdCount: targets.filter((id: unknown) => String(id || "").trim())
          .length,
      };
    })
    .filter(Boolean) as GranularScopeSummary[];
}

export function extractScopesFromDebugTokenData(data: any): string[] {
  const fromScopes = Array.isArray(data?.scopes)
    ? data.scopes.map((s: unknown) => String(s)).filter(Boolean)
    : [];
  const fromGranular = extractGranularScopeSummaries(data).map((g) => g.scope);
  return Array.from(new Set([...fromScopes, ...fromGranular]));
}

export function extractGrantedFromMePermissions(data: any): string[] {
  if (!Array.isArray(data?.data)) return [];
  return data.data
    .filter((row: any) => String(row?.status).toLowerCase() === "granted")
    .map((row: any) => String(row?.permission || "").trim())
    .filter(Boolean);
}

export function extractMePermissionStatuses(data: any): MePermissionStatus[] {
  if (!Array.isArray(data?.data)) return [];
  return data.data
    .map((row: any) => {
      const permission = String(row?.permission || "").trim();
      const status = String(row?.status || "").trim().toLowerCase();
      if (!permission || !status) return null;
      return { permission, status };
    })
    .filter(Boolean) as MePermissionStatus[];
}

/**
 * Whether `pageId` appears among target_ids for pages_manage_posts.
 * Returns null when manage_posts is absent or has no target_ids (app-level grant).
 */
export function isPageCoveredByManagePostsGranular(
  data: any,
  pageId: string | null | undefined
): boolean | null {
  if (!pageId || !Array.isArray(data?.granular_scopes)) return null;
  const entry = data.granular_scopes.find(
    (g: any) =>
      String(g?.scope || g?.permission || "").trim() === "pages_manage_posts"
  );
  if (!entry) return null;
  const targets = Array.isArray(entry.target_ids)
    ? entry.target_ids.map((id: unknown) => String(id))
    : [];
  if (targets.length === 0) return null;
  return targets.includes(String(pageId));
}

export function buildPermissionSourceDiagnostics(opts: {
  debugData?: any;
  mePermissionsJson?: any;
  mergedScopes: string[];
  selectedPageId?: string | null;
}): PermissionSourceDiagnostics {
  const debugScopes: string[] = Array.isArray(opts.debugData?.scopes)
    ? opts.debugData.scopes
        .map((s: unknown) => String(s).trim())
        .filter((s: string) => Boolean(s))
    : [];
  const granularScopes = extractGranularScopeSummaries(opts.debugData);
  const mePermissions = extractMePermissionStatuses(opts.mePermissionsJson);
  const set = new Set(opts.mergedScopes);
  const manageEntry = granularScopes.find(
    (g) => g.scope === "pages_manage_posts"
  );
  return {
    debugScopes: [...new Set(debugScopes)].sort(),
    granularScopes: granularScopes
      .slice()
      .sort((a, b) => a.scope.localeCompare(b.scope)),
    mePermissions: mePermissions
      .slice()
      .sort((a, b) => a.permission.localeCompare(b.permission)),
    requiredDetected: {
      pages_show_list: set.has("pages_show_list"),
      pages_manage_posts: set.has("pages_manage_posts"),
    },
    selectedPageCoveredByManagePosts: isPageCoveredByManagePostsGranular(
      opts.debugData,
      opts.selectedPageId
    ),
    managePostsTargetIdCount: manageEntry
      ? manageEntry.targetIdCount
      : null,
  };
}

/** Safe log payload — never includes tokens, secrets, codes, or Page IDs. */
export function sanitizePermissionDiagnosticsForLog(
  diagnostics: PermissionSourceDiagnostics | undefined
): Record<string, unknown> | null {
  if (!diagnostics) return null;
  return {
    debugScopes: diagnostics.debugScopes,
    granularScopes: diagnostics.granularScopes.map((g) => ({
      scope: g.scope,
      targetIdCount: g.targetIdCount,
    })),
    mePermissions: diagnostics.mePermissions.map((p) => ({
      permission: p.permission,
      status: p.status,
    })),
    requiredDetected: diagnostics.requiredDetected,
    selectedPageCoveredByManagePosts:
      diagnostics.selectedPageCoveredByManagePosts,
    managePostsTargetIdCount: diagnostics.managePostsTargetIdCount,
  };
}

export function summarizeScopes(
  scopes: string[],
  source: TokenPermissionSnapshot["source"] = "none",
  diagnostics?: PermissionSourceDiagnostics
): TokenPermissionSnapshot {
  const set = new Set(scopes);
  const hasManagePosts = set.has("pages_manage_posts");
  const hasShowList = set.has("pages_show_list");
  const hasReadEngagement = set.has("pages_read_engagement");
  return {
    scopes: [...set],
    hasManagePosts,
    hasShowList,
    hasReadEngagement,
    missingRequired: REQUIRED_PUBLISH_SCOPES.filter((s) => !set.has(s)),
    missingRecommended: RECOMMENDED_PUBLISH_SCOPES.filter((s) => !set.has(s)),
    source,
    diagnostics,
  };
}

/**
 * Use Graph debug_token (+ optional /me/permissions) to see granted permissions.
 * Pass selectedPageId to check granular target_ids coverage (counts/boolean only).
 */
export async function inspectAccessTokenPermissions(
  accessToken: string,
  opts?: { selectedPageId?: string | null }
): Promise<TokenPermissionSnapshot> {
  const appId = process.env.FACEBOOK_APP_ID;
  const appSecret = process.env.FACEBOOK_APP_SECRET;
  if (!appId || !appSecret || !accessToken) {
    return {
      ...summarizeScopes([]),
      rawError: "missing_app_credentials",
      source: "none",
    };
  }

  try {
    const appToken = `${appId}|${appSecret}`;
    const debugUrl =
      `https://graph.facebook.com/v${VERSION}/debug_token` +
      `?input_token=${encodeURIComponent(accessToken)}` +
      `&access_token=${encodeURIComponent(appToken)}`;
    const debugResp = await fetch(debugUrl);
    const debugJson = await debugResp.json();

    if (debugJson?.error) {
      return {
        ...summarizeScopes([]),
        rawError: debugJson.error?.message || "debug_token_failed",
        source: "none",
      };
    }

    const debugData = debugJson?.data;
    let scopes = extractScopesFromDebugTokenData(debugData);
    let source: TokenPermissionSnapshot["source"] = "debug_token";
    let mePermissionsJson: any = undefined;

    // Supplement with /me/permissions — some FLB grants surface more clearly here.
    // Uses the same user access token as debug_token input (not the app token).
    try {
      const permUrl =
        `https://graph.facebook.com/v${VERSION}/me/permissions` +
        `?access_token=${encodeURIComponent(accessToken)}`;
      const permResp = await fetch(permUrl);
      const permJson = await permResp.json();
      if (!permJson?.error) {
        mePermissionsJson = permJson;
        const fromMe = extractGrantedFromMePermissions(permJson);
        if (fromMe.length > 0) {
          scopes = Array.from(new Set([...scopes, ...fromMe]));
          source = scopes.length > 0 ? "merged" : "me_permissions";
        }
      }
    } catch {
      // non-fatal
    }

    const diagnostics = buildPermissionSourceDiagnostics({
      debugData,
      mePermissionsJson,
      mergedScopes: scopes,
      selectedPageId: opts?.selectedPageId,
    });

    return summarizeScopes(scopes, source, diagnostics);
  } catch (e: any) {
    return {
      ...summarizeScopes([]),
      rawError: e?.message || "debug_token_exception",
      source: "none",
    };
  }
}

/**
 * Map Meta Graph publish errors into actionable user-facing copy.
 * Does not claim Standard Access alone is sufficient without evidence.
 */
export function mapPublishPermissionError(message: string): {
  code: string;
  error: string;
  needsReconnect: boolean;
  needsAppReview: boolean;
} {
  const lower = message.toLowerCase();
  const mentionsManagePosts = /pages_manage_posts/.test(lower);
  const mentionsAppReview =
    /app review|not available|deprecated|advanced access|insufficient/.test(lower);

  if (mentionsManagePosts || /#200/.test(message)) {
    return {
      code: "missing_pages_manage_posts",
      error:
        "Facebook rejected the post because pages_manage_posts is not usable with this token. " +
        "Confirm the SkalX Publish Login configuration includes pages_show_list and pages_manage_posts, " +
        "reconnect to issue a new token, and ensure your Meta user is an app Admin/Developer/Tester " +
        "with CREATE_CONTENT on the Page. If the permission remains unavailable after reconnect, " +
        "check App Review → Permissions and Features for this app's access level for pages_manage_posts.",
      needsReconnect: true,
      needsAppReview: mentionsAppReview,
    };
  }

  if (/#?324|missing or invalid image file/i.test(message)) {
    return {
      code: "invalid_image_for_meta",
      error:
        "Facebook could not accept the image file. Prefer publishing from Generated Contents " +
        "(server uploads image bytes) or use a public HTTPS image URL Meta can fetch.",
      needsReconnect: false,
      needsAppReview: false,
    };
  }

  return {
    code: "meta_api_error",
    error: message,
    needsReconnect: false,
    needsAppReview: false,
  };
}
