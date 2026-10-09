/**
 * Meta Graph helpers for OAuth asset discovery (Pages + Ad Accounts).
 * Never logs tokens or secrets.
 */

const VERSION = process.env.FACEBOOK_API_VERSION || "23.0";

export type MetaGraphError = {
  code?: number;
  message?: string;
  type?: string;
  error_subcode?: number;
};

export type MetaAssetFetchResult<T> = {
  data: T[];
  error: MetaGraphError | null;
  hasPaging: boolean;
  httpOk: boolean;
};

export function logMetaOAuthDiag(
  event: string,
  payload: Record<string, unknown>
): void {
  if (process.env.NODE_ENV === "production" && process.env.DEBUG_CALLBACK !== "true") {
    return;
  }
  console.info(`[meta-oauth] ${event}`, {
    apiVersion: VERSION,
    ...payload,
  });
}

export async function fetchMetaPagesForOAuth(
  userAccessToken: string
): Promise<MetaAssetFetchResult<any>> {
  const path =
    `me/accounts?fields=id,name,category,access_token,tasks,instagram_business_account&limit=100`;
  const url = `https://graph.facebook.com/v${VERSION}/${path}&access_token=${encodeURIComponent(userAccessToken)}`;
  const resp = await fetch(url);
  const json = await resp.json();
  const error = json?.error
    ? {
        code: json.error.code,
        message: json.error.message,
        type: json.error.type,
        error_subcode: json.error.error_subcode,
      }
    : null;
  const data = Array.isArray(json?.data) ? json.data : [];
  logMetaOAuthDiag("me/accounts", {
    endpoint: "me/accounts",
    httpOk: resp.ok,
    count: data.length,
    hasPaging: !!json?.paging,
    errorCode: error?.code,
    errorMessage: error?.message,
    errorType: error?.type,
  });
  return { data, error, hasPaging: !!json?.paging, httpOk: resp.ok };
}

export async function fetchMetaAdAccountsForOAuth(
  userAccessToken: string
): Promise<MetaAssetFetchResult<any>> {
  const path =
    `me/adaccounts?fields=id,account_id,name,currency,timezone_name,account_status,business&limit=100`;
  const url = `https://graph.facebook.com/v${VERSION}/${path}&access_token=${encodeURIComponent(userAccessToken)}`;
  const resp = await fetch(url);
  const json = await resp.json();
  const error = json?.error
    ? {
        code: json.error.code,
        message: json.error.message,
        type: json.error.type,
        error_subcode: json.error.error_subcode,
      }
    : null;
  const data = Array.isArray(json?.data) ? json.data : [];
  logMetaOAuthDiag("me/adaccounts", {
    endpoint: "me/adaccounts",
    httpOk: resp.ok,
    count: data.length,
    hasPaging: !!json?.paging,
    errorCode: error?.code,
    errorMessage: error?.message,
    errorType: error?.type,
  });
  return { data, error, hasPaging: !!json?.paging, httpOk: resp.ok };
}
