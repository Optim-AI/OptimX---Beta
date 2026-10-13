/**
 * Inspect Instagram-related token grants (sanitized).
 */

import {
  extractScopesFromDebugTokenData,
  extractGrantedFromMePermissions,
  summarizeScopes as summarizePublishScopes,
} from "@/lib/social/facebook-publish/permissions";
import {
  META_INSTAGRAM_RECOMMENDED_SCOPES,
  META_INSTAGRAM_REQUIRED_SCOPES,
} from "@/lib/social/instagram/scopes";

const VERSION = process.env.FACEBOOK_API_VERSION || "23.0";

export type InstagramPermissionSnapshot = {
  scopes: string[];
  missingRequired: string[];
  missingRecommended: string[];
  hasContentPublish: boolean;
  hasManageComments: boolean;
  hasManageInsights: boolean;
  source?: "debug_token" | "me_permissions" | "merged" | "none";
  rawError?: string;
};

export function summarizeInstagramScopes(
  scopes: string[],
  source: InstagramPermissionSnapshot["source"] = "none"
): InstagramPermissionSnapshot {
  const set = new Set(scopes);
  return {
    scopes: [...set],
    missingRequired: META_INSTAGRAM_REQUIRED_SCOPES.filter((s) => !set.has(s)),
    missingRecommended: META_INSTAGRAM_RECOMMENDED_SCOPES.filter(
      (s) => !set.has(s)
    ),
    hasContentPublish: set.has("instagram_content_publish"),
    hasManageComments: set.has("instagram_manage_comments"),
    hasManageInsights: set.has("instagram_manage_insights"),
    source,
  };
}

export async function inspectInstagramAccessTokenPermissions(
  accessToken: string
): Promise<InstagramPermissionSnapshot> {
  const appId = process.env.FACEBOOK_APP_ID;
  const appSecret = process.env.FACEBOOK_APP_SECRET;
  if (!appId || !appSecret || !accessToken) {
    return {
      ...summarizeInstagramScopes([]),
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
        ...summarizeInstagramScopes([]),
        rawError: debugJson.error?.message || "debug_token_failed",
        source: "none",
      };
    }

    let scopes = extractScopesFromDebugTokenData(debugJson?.data);
    let source: InstagramPermissionSnapshot["source"] = "debug_token";

    try {
      const permUrl =
        `https://graph.facebook.com/v${VERSION}/me/permissions` +
        `?access_token=${encodeURIComponent(accessToken)}`;
      const permResp = await fetch(permUrl);
      const permJson = await permResp.json();
      if (!permJson?.error) {
        const fromMe = extractGrantedFromMePermissions(permJson);
        if (fromMe.length > 0) {
          scopes = Array.from(new Set([...scopes, ...fromMe]));
          source = "merged";
        }
      }
    } catch {
      // non-fatal
    }

    return summarizeInstagramScopes(scopes, source);
  } catch (e: any) {
    return {
      ...summarizeInstagramScopes([]),
      rawError: e?.message || "debug_token_exception",
      source: "none",
    };
  }
}

/** Re-export summarize helper used only for naming consistency in tests. */
export { summarizePublishScopes };
