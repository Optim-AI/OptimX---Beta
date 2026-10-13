/**
 * Meta Marketing / Graph API client for connected-account ads performance.
 * Separate from Creative Intelligence Ad Library scraping.
 *
 * PR W1 adds server-side write primitives (`metaGraphPost`) for future Marketing
 * API mutations. PR W2.4 adds `metaGraphUpload` (multipart) for ad image bytes.
 * No public write routes or live campaign mutations ship in these PRs.
 * PATCH is deferred — Meta Marketing updates typically use POST.
 */

const VERSION = process.env.FACEBOOK_API_VERSION || "23.0";

/** Default timeout for non-idempotent write requests (no automatic retries). */
export const META_GRAPH_WRITE_TIMEOUT_MS = 30_000;

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

/** Redact bearer-like tokens from strings that may surface in errors/logs. */
export function redactMetaSecrets(text: string): string {
  return String(text)
    .replace(/access_token=[^&\s"']+/gi, "access_token=[REDACTED]")
    // Meta user/page tokens commonly start with EA and are long opaque strings.
    .replace(/\bEA[A-Za-z0-9_-]{20,}/g, "[REDACTED_TOKEN]");
}

export type MetaGraphErrorBody = {
  message?: string;
  type?: string;
  code?: number;
  error_subcode?: number;
  fbtrace_id?: string;
  error_user_title?: string;
  error_user_msg?: string;
};

export class MetaGraphError extends Error {
  readonly code?: number;
  readonly type?: string;
  readonly fbtrace_id?: string;
  readonly error_subcode?: number;
  readonly httpStatus?: number;
  readonly kind: "graph" | "http" | "network" | "timeout" | "parse";

  constructor(
    message: string,
    opts: {
      code?: number;
      type?: string;
      fbtrace_id?: string;
      error_subcode?: number;
      httpStatus?: number;
      kind?: MetaGraphError["kind"];
    } = {}
  ) {
    super(redactMetaSecrets(message));
    this.name = "MetaGraphError";
    this.code = opts.code;
    this.type = opts.type;
    this.fbtrace_id = opts.fbtrace_id;
    this.error_subcode = opts.error_subcode;
    this.httpStatus = opts.httpStatus;
    this.kind = opts.kind ?? "graph";
  }
}

function actionableGraphMessage(
  err: MetaGraphErrorBody,
  httpStatus?: number
): string {
  const userMsg =
    typeof err.error_user_msg === "string" && err.error_user_msg.trim()
      ? err.error_user_msg.trim()
      : null;
  const base =
    userMsg ||
    (typeof err.message === "string" && err.message.trim()
      ? err.message.trim()
      : null) ||
    "Meta Graph API request failed";
  const parts = [redactMetaSecrets(base)];
  if (err.code != null) parts.push(`code=${err.code}`);
  if (err.type) parts.push(`type=${err.type}`);
  if (err.fbtrace_id) parts.push(`fbtrace_id=${err.fbtrace_id}`);
  if (httpStatus != null) parts.push(`http=${httpStatus}`);
  return parts.join(" · ");
}

/**
 * Normalize a Graph `error` object into MetaGraphError.
 * Never embeds access tokens or raw request payloads.
 */
export function normalizeMetaGraphError(
  err: MetaGraphErrorBody | null | undefined,
  httpStatus?: number
): MetaGraphError {
  const body = err && typeof err === "object" ? err : {};
  return new MetaGraphError(actionableGraphMessage(body, httpStatus), {
    code: typeof body.code === "number" ? body.code : undefined,
    type: typeof body.type === "string" ? body.type : undefined,
    fbtrace_id:
      typeof body.fbtrace_id === "string" ? body.fbtrace_id : undefined,
    error_subcode:
      typeof body.error_subcode === "number" ? body.error_subcode : undefined,
    httpStatus,
    kind: "graph",
  });
}

function isAbortError(e: unknown): boolean {
  return (
    (e instanceof Error && e.name === "AbortError") ||
    (typeof DOMException !== "undefined" &&
      e instanceof DOMException &&
      e.name === "AbortError")
  );
}

function networkMetaGraphError(
  e: unknown,
  opts?: { httpStatus?: number; timeoutMs?: number }
): MetaGraphError {
  if (isAbortError(e)) {
    const timeoutMs = opts?.timeoutMs ?? META_GRAPH_WRITE_TIMEOUT_MS;
    return new MetaGraphError(
      `Meta Graph API request timed out after ${timeoutMs}ms`,
      { kind: "timeout", httpStatus: opts?.httpStatus }
    );
  }
  const msg =
    e instanceof Error && e.message
      ? redactMetaSecrets(e.message)
      : "Meta Graph API network error";
  return new MetaGraphError(msg, {
    kind: "network",
    httpStatus: opts?.httpStatus,
  });
}

/** Auth fields that must never come from caller-supplied write params. */
export const META_GRAPH_RESERVED_WRITE_PARAMS = [
  "access_token",
  "appsecret_proof",
] as const;

function assertNoReservedWriteParams(params: MetaGraphWriteParams): void {
  for (const key of Object.keys(params)) {
    const lower = key.toLowerCase();
    if (
      (META_GRAPH_RESERVED_WRITE_PARAMS as readonly string[]).includes(lower)
    ) {
      throw new MetaGraphError(
        `Reserved Graph auth parameter "${key}" cannot be supplied in write params; the server access token is authoritative.`,
        { kind: "http", httpStatus: 400 }
      );
    }
  }
}

async function parseJsonResponse(
  res: Response
): Promise<{ json: any; parseError?: MetaGraphError }> {
  try {
    const json = await res.json();
    return { json };
  } catch {
    return {
      json: null,
      parseError: new MetaGraphError(
        `Meta Graph API returned non-JSON response (http=${res.status})`,
        { kind: "parse", httpStatus: res.status }
      ),
    };
  }
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
    // Preserve GET error semantics: message + code/type/fbtrace_id on Error.
    const err = normalizeMetaGraphError(json.error, res.status);
    throw err;
  }
  return json as T;
}

export type MetaGraphPageResult<T> = {
  items: T[];
  pagesFetched: number;
  /** True when more pages remained after maxPages — treat as incomplete/partial. */
  truncated: boolean;
};

export async function metaGraphGetAllWithMeta<T = any>(
  path: string,
  accessToken: string,
  params: Record<string, string | number | undefined> = {},
  maxPages = 10
): Promise<MetaGraphPageResult<T>> {
  const items: T[] = [];
  let after: string | undefined;
  let pagesFetched = 0;
  for (let page = 0; page < maxPages; page++) {
    const json = await metaGraphGet<{
      data?: T[];
      paging?: { cursors?: { after?: string }; next?: string };
    }>(path, accessToken, { ...params, ...(after ? { after } : {}) });
    pagesFetched += 1;
    if (Array.isArray(json.data)) items.push(...json.data);
    after = json.paging?.cursors?.after;
    if (!after || !json.data?.length) {
      return { items, pagesFetched, truncated: false };
    }
  }
  return { items, pagesFetched, truncated: Boolean(after) };
}

export async function metaGraphGetAll<T = any>(
  path: string,
  accessToken: string,
  params: Record<string, string | number | undefined> = {},
  maxPages = 10
): Promise<T[]> {
  const result = await metaGraphGetAllWithMeta<T>(
    path,
    accessToken,
    params,
    maxPages
  );
  return result.items;
}

export type MetaGraphWriteParams = Record<
  string,
  string | number | boolean | undefined | null
>;

export type MetaGraphPostOptions = {
  /** Override default write timeout (ms). */
  timeoutMs?: number;
  /**
   * Optional fetch implementation (tests). Must not log tokens/bodies.
   */
  fetchImpl?: typeof fetch;
};

/**
 * Server-side Meta Graph POST (Marketing API writes).
 *
 * - Uses configured Graph API version.
 * - Puts server `access_token` in the form body last (authoritative; not logged).
 * - Rejects reserved auth keys in caller params (`access_token`, `appsecret_proof`).
 * - Does **not** automatically retry (non-idempotent unless callers add
 *   an explicit idempotency strategy).
 * - PATCH is deferred; Meta Marketing updates typically use POST.
 */
export async function metaGraphPost<T = any>(
  path: string,
  accessToken: string,
  params: MetaGraphWriteParams = {},
  opts: MetaGraphPostOptions = {}
): Promise<T> {
  if (!accessToken || !String(accessToken).trim()) {
    throw new MetaGraphError("Meta Graph write requires an access token", {
      kind: "http",
      httpStatus: 401,
    });
  }

  assertNoReservedWriteParams(params);

  const body = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) body.set(k, String(v));
  }
  // Always set last so the server token wins even if filtering regresses.
  body.set("access_token", accessToken);

  const url = `https://graph.facebook.com/v${VERSION}/${path.replace(/^\//, "")}`;
  const timeoutMs = opts.timeoutMs ?? META_GRAPH_WRITE_TIMEOUT_MS;
  const fetchImpl = opts.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    res = await fetchImpl(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      signal: controller.signal,
    });
  } catch (e) {
    throw networkMetaGraphError(e, { timeoutMs });
  } finally {
    clearTimeout(timer);
  }

  const { json, parseError } = await parseJsonResponse(res);
  if (parseError) {
    if (!res.ok) {
      throw new MetaGraphError(
        `Meta Graph API HTTP ${res.status} with non-JSON body`,
        { kind: "http", httpStatus: res.status }
      );
    }
    throw parseError;
  }

  if (json?.error) {
    throw normalizeMetaGraphError(json.error, res.status);
  }

  if (!res.ok) {
    throw new MetaGraphError(`Meta Graph API HTTP ${res.status}`, {
      kind: "http",
      httpStatus: res.status,
    });
  }

  return json as T;
}

export type MetaGraphUploadFile = {
  /**
   * Multipart field name for the file part.
   * Ad Images (act_{id}/adimages): commonly "filename" (file bytes as the part).
   * Page Photos: commonly "source".
   */
  fieldName: string;
  buffer: Buffer | Uint8Array;
  /** Filename shown to Meta / used as response `images` map key. */
  filename: string;
  contentType: string;
};

export type MetaGraphUploadFields = MetaGraphWriteParams;

export type MetaGraphUploadOptions = {
  file: MetaGraphUploadFile;
  /** Extra non-file form fields (never access_token / appsecret_proof). */
  fields?: MetaGraphUploadFields;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
};

/**
 * Server-side Meta Graph multipart POST (file uploads).
 *
 * - Uses configured Graph API version.
 * - Puts server `access_token` in the FormData last (authoritative; not logged).
 * - Rejects reserved auth keys in caller fields and as the file field name.
 * - Does **not** automatically retry (uploads may be accepted before a timeout).
 * - Leaves `metaGraphPost` form-urlencoded behavior unchanged.
 *
 * Callers must never log the FormData body (contains token + image bytes).
 */
export async function metaGraphUpload<T = any>(
  path: string,
  accessToken: string,
  opts: MetaGraphUploadOptions
): Promise<T> {
  if (!accessToken || !String(accessToken).trim()) {
    throw new MetaGraphError("Meta Graph upload requires an access token", {
      kind: "http",
      httpStatus: 401,
    });
  }

  const file = opts.file;
  if (!file || !file.fieldName || !String(file.fieldName).trim()) {
    throw new MetaGraphError("Meta Graph upload requires a file field name", {
      kind: "http",
      httpStatus: 400,
    });
  }
  if (
    (META_GRAPH_RESERVED_WRITE_PARAMS as readonly string[]).includes(
      String(file.fieldName).toLowerCase()
    )
  ) {
    throw new MetaGraphError(
      `Reserved Graph auth parameter "${file.fieldName}" cannot be used as the upload file field; the server access token is authoritative.`,
      { kind: "http", httpStatus: 400 }
    );
  }

  const fields = opts.fields ?? {};
  assertNoReservedWriteParams(fields);

  const bytes =
    file.buffer instanceof Buffer
      ? file.buffer
      : Buffer.from(file.buffer as Uint8Array);
  if (bytes.length === 0) {
    throw new MetaGraphError("Meta Graph upload rejected empty file", {
      kind: "http",
      httpStatus: 400,
    });
  }

  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) {
    if (v !== undefined && v !== null) form.append(k, String(v));
  }
  const mime =
    typeof file.contentType === "string" && file.contentType.trim()
      ? file.contentType.trim()
      : "application/octet-stream";
  const name =
    typeof file.filename === "string" && file.filename.trim()
      ? file.filename.trim()
      : "upload.bin";
  form.append(
    String(file.fieldName).trim(),
    new Blob([new Uint8Array(bytes)], { type: mime }),
    name
  );
  // Always set last so the server token wins even if filtering regresses.
  form.append("access_token", accessToken);

  const url = `https://graph.facebook.com/v${VERSION}/${path.replace(/^\//, "")}`;
  const timeoutMs = opts.timeoutMs ?? META_GRAPH_WRITE_TIMEOUT_MS;
  const fetchImpl = opts.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let res: Response;
  try {
    // Do not set Content-Type — fetch must supply multipart boundary.
    res = await fetchImpl(url, {
      method: "POST",
      body: form,
      signal: controller.signal,
    });
  } catch (e) {
    throw networkMetaGraphError(e, { timeoutMs });
  } finally {
    clearTimeout(timer);
  }

  const { json, parseError } = await parseJsonResponse(res);
  if (parseError) {
    if (!res.ok) {
      throw new MetaGraphError(
        `Meta Graph API HTTP ${res.status} with non-JSON body`,
        { kind: "http", httpStatus: res.status }
      );
    }
    throw parseError;
  }

  if (json?.error) {
    throw normalizeMetaGraphError(json.error, res.status);
  }

  if (!res.ok) {
    throw new MetaGraphError(`Meta Graph API HTTP ${res.status}`, {
      kind: "http",
      httpStatus: res.status,
    });
  }

  return json as T;
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
  const base = (appUrl ?? process.env.NEXT_PUBLIC_APP_URL ?? "").replace(
    /\/+$/,
    ""
  );
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
