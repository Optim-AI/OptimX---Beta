/**
 * Instagram organic (Content Publishing API with Facebook Login).
 * Separate from META_ADS and Facebook Page publishing (meta-publish).
 *
 * This app uses Facebook Login for Business. FLB rejects Instagram permissions
 * when requested via classic `scope=` unless they are part of a saved Login
 * Configuration. Always prefer FACEBOOK_INSTAGRAM_LOGIN_CONFIG_ID (config_id).
 *
 * Do not reuse FACEBOOK_LOGIN_CONFIG_ID (Ads) or FACEBOOK_PUBLISH_LOGIN_CONFIG_ID
 * unless that configuration intentionally includes Instagram scopes
 * (not recommended — keep a dedicated "SkalX Instagram" configuration).
 *
 * Permission names below are for Instagram API with Facebook Login
 * (graph.facebook.com), NOT Instagram Login (instagram_business_* on
 * graph.instagram.com / www.instagram.com/oauth/authorize).
 */

export const META_INSTAGRAM_PROVIDER = "meta-instagram" as const;

/**
 * Permissions for Instagram API with Facebook Login (FLB configuration / docs).
 * Include pages_show_list to discover Pages and linked IG accounts.
 */
export const META_INSTAGRAM_SCOPES = [
  "instagram_basic",
  "instagram_content_publish",
  "instagram_manage_comments",
  "instagram_manage_insights",
  "pages_show_list",
  "pages_read_engagement",
] as const;

export const META_INSTAGRAM_REQUIRED_SCOPES = [
  "instagram_basic",
  "instagram_content_publish",
  "pages_show_list",
] as const;

export const META_INSTAGRAM_RECOMMENDED_SCOPES = [
  "pages_read_engagement",
  "instagram_manage_comments",
  "instagram_manage_insights",
] as const;

/** Instagram Login (Instagram API with Instagram Login) — not used by this flow. */
export const META_INSTAGRAM_LOGIN_SCOPES_NOT_USED = [
  "instagram_business_basic",
  "instagram_business_content_publish",
  "instagram_business_manage_comments",
  "instagram_business_manage_insights",
] as const;

export function getMetaInstagramRedirectUri(appUrl?: string | null): string {
  const base = (appUrl ?? process.env.NEXT_PUBLIC_APP_URL ?? "").replace(
    /\/+$/,
    ""
  );
  if (!base) throw new Error("NEXT_PUBLIC_APP_URL not configured");
  return `${base}/api/social/instagram/oauth/callback`;
}

export type InstagramOAuthUrlMode = "config_id" | "classic_scope";

export type BuildInstagramOAuthUrlResult = {
  url: string;
  mode: InstagramOAuthUrlMode;
  /** True when config_id is present — never log the ID value. */
  configIdPresent: boolean;
  host: string;
  hasScopeParam: boolean;
  hasConfigIdParam: boolean;
};

/**
 * Build OAuth dialog URL for Instagram professional account connection.
 *
 * Default (FLB-safe): require FACEBOOK_INSTAGRAM_LOGIN_CONFIG_ID / opts.configId
 * and pass `config_id` only (never also `scope=`).
 *
 * Classic `scope=` is only allowed when `allowClassicScope: true` (non-FLB apps).
 * Sending Instagram scopes via `scope=` on an FLB app causes:
 *   Invalid Scopes: instagram_basic, instagram_content_publish, ...
 */
export function buildMetaInstagramOAuthDialogUrl(opts: {
  appId: string;
  state: string;
  version?: string;
  redirectUri?: string;
  configId?: string | null;
  /**
   * When true, allow classic scope= if no config_id.
   * Default false — FLB apps must use a Login Configuration.
   */
  allowClassicScope?: boolean;
}): BuildInstagramOAuthUrlResult {
  const version = opts.version || process.env.FACEBOOK_API_VERSION || "23.0";
  const redirectUri = opts.redirectUri ?? getMetaInstagramRedirectUri();
  const configId =
    opts.configId !== undefined
      ? opts.configId
      : process.env.FACEBOOK_INSTAGRAM_LOGIN_CONFIG_ID || null;

  const host = `www.facebook.com`;
  let url =
    `https://${host}/v${version}/dialog/oauth` +
    `?client_id=${encodeURIComponent(opts.appId)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&response_type=code` +
    `&state=${encodeURIComponent(opts.state)}`;

  if (configId) {
    url += `&config_id=${encodeURIComponent(configId)}`;
    url += `&override_default_response_type=true`;
    return {
      url,
      mode: "config_id",
      configIdPresent: true,
      host,
      hasScopeParam: false,
      hasConfigIdParam: true,
    };
  }

  if (!opts.allowClassicScope) {
    throw new Error(
      "FACEBOOK_INSTAGRAM_LOGIN_CONFIG_ID is required. " +
        "This app uses Facebook Login for Business, which rejects Instagram permissions " +
        "when requested via classic scope=. Create a Login Configuration (e.g. SkalX Instagram) " +
        "that includes instagram_basic, instagram_content_publish, pages_show_list, " +
        "pages_read_engagement (+ instagram_manage_comments / instagram_manage_insights), " +
        "then set FACEBOOK_INSTAGRAM_LOGIN_CONFIG_ID and restart the server."
    );
  }

  url += `&scope=${encodeURIComponent(META_INSTAGRAM_SCOPES.join(","))}`;
  return {
    url,
    mode: "classic_scope",
    configIdPresent: false,
    host,
    hasScopeParam: true,
    hasConfigIdParam: false,
  };
}
