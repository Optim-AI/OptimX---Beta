/**
 * Meta Marketing / Graph API client for connected-account ads performance.
 * Separate from Creative Intelligence Ad Library scraping.
 */

const VERSION = process.env.FACEBOOK_API_VERSION || "23.0";

export function metaGraphVersion(): string {
  return VERSION;
}

export function stripActPrefix(id?: string | null): string | null {
  if (!id) return null;
  return String(id).replace(/^act_/, "").replace(/^act_act_/, "");
}

export function ensureActPrefix(id?: string | null): string | null {
  const n = stripActPrefix(id);
  return n ? `act_${n}` : null;
}

export async function metaGraphGet<T = any>(
  path: string,
  accessToken: string,
  params: Record<string, string | number | undefined> = {}
): Promise<T> {
  const qs = new URLSearchParams();
  qs.set("access_token", accessToken);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) qs.set(k, String(v));
  }
  const url = `https://graph.facebook.com/v${VERSION}/${path.replace(/^\//, "")}?${qs}`;
  const res = await fetch(url);
  const json = await res.json();
  if (json?.error) {
    const err = new Error(
      json.error.message || JSON.stringify(json.error)
    ) as Error & { code?: number; type?: string; fbtrace_id?: string };
    err.code = json.error.code;
    err.type = json.error.type;
    err.fbtrace_id = json.error.fbtrace_id;
    throw err;
  }
  return json as T;
}

export async function metaGraphGetAll<T = any>(
  path: string,
  accessToken: string,
  params: Record<string, string | number | undefined> = {},
  maxPages = 10
): Promise<T[]> {
  const items: T[] = [];
  let after: string | undefined;
  for (let page = 0; page < maxPages; page++) {
    const json = await metaGraphGet<{ data?: T[]; paging?: { cursors?: { after?: string } } }>(
      path,
      accessToken,
      { ...params, ...(after ? { after } : {}) }
    );
    if (Array.isArray(json.data)) items.push(...json.data);
    after = json.paging?.cursors?.after;
    if (!after || !json.data?.length) break;
  }
  return items;
}

/**
 * Permissions for the Meta Ads performance OAuth flow.
 * Must match the existing Facebook Login for Business configuration
 * named "SkalX Ads" — do not add Instagram publishing / Page-post scopes here.
 * Organic Instagram publishing uses `/api/auth/instagram/*` separately.
 */
export const META_ADS_SCOPES = [
  "ads_read",
  "ads_management",
  "business_management",
  "leads_retrieval",
  "pages_manage_ads",
  "pages_show_list",
  "pages_read_engagement",
  "pages_messaging",
  "whatsapp_business_management",
  "whatsapp_business_messaging",
] as const;

/** Scopes rejected when requested outside the SkalX Ads FLB configuration. */
export const META_ADS_EXCLUDED_SCOPES = [
  "instagram_basic",
  "instagram_content_publish",
  "instagram_manage_comments",
  "pages_read_user_content",
  "pages_manage_posts",
] as const;

/**
 * Canonical Meta OAuth redirect URI used by both `/start` and `/callback`.
 * Must be listed exactly under Facebook Login → Valid OAuth Redirect URIs,
 * and the host must appear in App Domains (e.g. `localhost`).
 */
export function getMetaOAuthRedirectUri(appUrl?: string | null): string {
  const base = (appUrl ?? process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/+$/, "");
  if (!base) {
    throw new Error("NEXT_PUBLIC_APP_URL not configured");
  }
  return `${base}/api/meta/oauth/callback`;
}

/**
 * Build the Facebook OAuth dialog URL for Meta Ads.
 * - If `FACEBOOK_LOGIN_CONFIG_ID` is set, pass `config_id` only (FLB recommended).
 * - Otherwise pass explicit `scope` matching META_ADS_SCOPES (SkalX Ads config).
 * Never invent a config_id; leave unset to use scopes.
 */
export function buildMetaAdsOAuthDialogUrl(opts: {
  appId: string;
  state: string;
  redirectUri?: string;
  version?: string;
  configId?: string | null;
}): string {
  const version = opts.version || process.env.FACEBOOK_API_VERSION || "23.0";
  const redirectUri = opts.redirectUri ?? getMetaOAuthRedirectUri();
  const configId =
    opts.configId !== undefined
      ? opts.configId
      : process.env.FACEBOOK_LOGIN_CONFIG_ID || null;

  let url =
    `https://www.facebook.com/v${version}/dialog/oauth` +
    `?client_id=${encodeURIComponent(opts.appId)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&response_type=code` +
    `&state=${encodeURIComponent(opts.state)}`;

  if (configId) {
    url += `&config_id=${encodeURIComponent(configId)}`;
  } else {
    url += `&scope=${encodeURIComponent(META_ADS_SCOPES.join(","))}`;
  }

  return url;
}

export const META_INSIGHT_FIELDS =
  "spend,impressions,reach,frequency,clicks,ctr,cpc,cpm,actions,action_values,date_start,date_stop";
