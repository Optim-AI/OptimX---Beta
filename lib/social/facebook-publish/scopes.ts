/**
 * Facebook Page organic publishing scopes / OAuth dialog.
 * Separate from META_ADS_SCOPES and FACEBOOK_LOGIN_CONFIG_ID (Ads).
 *
 * For Facebook Login for Business apps, permissions that are not part of a
 * Login Configuration are rejected as "Invalid Scopes" when requested via
 * classic `scope=`. Prefer FACEBOOK_PUBLISH_LOGIN_CONFIG_ID (config_id).
 *
 * Minimum for implemented APIs:
 *   - pages_show_list      → GET me/accounts (Page discovery)
 *   - pages_manage_posts   → POST /{page-id}/photos
 *
 * pages_read_engagement is a Meta-documented dependency of pages_manage_posts
 * (App Review / Pages API). Include it in the FLB Login configuration when
 * available, but do not treat it as a hard finalize requirement by itself.
 *
 * Instagram permissions intentionally omitted for this milestone.
 */

export const META_PUBLISH_SCOPES = [
  "pages_show_list",
  "pages_read_engagement",
  "pages_manage_posts",
] as const;

/** Hard requirements for the APIs we actually call. */
export const META_PUBLISH_REQUIRED_SCOPES = [
  "pages_show_list",
  "pages_manage_posts",
] as const;

/**
 * Permissions that must never be mixed into the Ads OAuth URL.
 */
export const META_PUBLISH_ONLY_SCOPES = [
  "pages_manage_posts",
] as const;

export const META_PUBLISH_PROVIDER = "meta-publish" as const;

export function getMetaPublishRedirectUri(appUrl?: string | null): string {
  const base = (appUrl ?? process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/+$/, "");
  if (!base) throw new Error("NEXT_PUBLIC_APP_URL not configured");
  return `${base}/api/social/facebook/oauth/callback`;
}

/**
 * Build the Facebook OAuth dialog URL for Page publishing.
 * - If FACEBOOK_PUBLISH_LOGIN_CONFIG_ID (or opts.configId) is set, pass
 *   config_id only (never also send scope=).
 * - Otherwise pass explicit META_PUBLISH_SCOPES.
 * Never reuses FACEBOOK_LOGIN_CONFIG_ID (Ads).
 */
export function buildMetaPublishOAuthDialogUrl(opts: {
  appId: string;
  state: string;
  version?: string;
  redirectUri?: string;
  configId?: string | null;
}): string {
  const version = opts.version || process.env.FACEBOOK_API_VERSION || "23.0";
  const redirectUri = opts.redirectUri ?? getMetaPublishRedirectUri();
  const configId =
    opts.configId !== undefined
      ? opts.configId
      : process.env.FACEBOOK_PUBLISH_LOGIN_CONFIG_ID || null;

  let url =
    `https://www.facebook.com/v${version}/dialog/oauth` +
    `?client_id=${encodeURIComponent(opts.appId)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&response_type=code` +
    `&state=${encodeURIComponent(opts.state)}`;

  if (configId) {
    url += `&config_id=${encodeURIComponent(configId)}`;
    url += `&override_default_response_type=true`;
  } else {
    url += `&scope=${encodeURIComponent(META_PUBLISH_SCOPES.join(","))}`;
  }

  return url;
}
