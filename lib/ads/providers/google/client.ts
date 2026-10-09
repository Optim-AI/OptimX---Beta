/**
 * Google Ads API helpers via REST + GAQL.
 * Uses GOOGLE_ADS_* env vars — independent of Supabase Google Sign-In.
 */

export const GOOGLE_ADS_API_VERSION =
  process.env.GOOGLE_ADS_API_VERSION || "v18";

export const GOOGLE_ADS_SCOPES = [
  "https://www.googleapis.com/auth/adwords",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
] as const;

export function getGoogleAdsOAuthConfig() {
  const clientId = process.env.GOOGLE_ADS_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET;
  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  if (!clientId || !clientSecret) {
    throw new Error(
      "GOOGLE_ADS_CLIENT_ID and GOOGLE_ADS_CLIENT_SECRET must be set"
    );
  }
  return { clientId, clientSecret, developerToken };
}

export async function refreshGoogleAdsAccessToken(
  refreshToken: string
): Promise<{ accessToken: string; expiresIn: number }> {
  const { clientId, clientSecret } = getGoogleAdsOAuthConfig();
  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const json = await resp.json();
  if (!resp.ok || !json.access_token) {
    throw new Error(
      json.error_description || json.error || "Google Ads token refresh failed"
    );
  }
  return {
    accessToken: json.access_token,
    expiresIn: json.expires_in ?? 3600,
  };
}

export async function googleAdsSearch(
  customerId: string,
  accessToken: string,
  query: string,
  loginCustomerId?: string | null
): Promise<any[]> {
  const { developerToken } = getGoogleAdsOAuthConfig();
  if (!developerToken) {
    throw new Error("GOOGLE_ADS_DEVELOPER_TOKEN must be set");
  }

  const cid = String(customerId).replace(/-/g, "");
  const url = `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}/customers/${cid}/googleAds:searchStream`;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    "developer-token": developerToken,
    "Content-Type": "application/json",
  };
  if (loginCustomerId) {
    headers["login-customer-id"] = String(loginCustomerId).replace(/-/g, "");
  }

  const resp = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ query }),
  });

  const text = await resp.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }

  if (!resp.ok) {
    const msg =
      json?.[0]?.error?.message ||
      json?.error?.message ||
      text.slice(0, 500) ||
      `Google Ads search failed (${resp.status})`;
    throw new Error(msg);
  }

  // searchStream returns an array of batches: [{ results: [...] }, ...]
  const rows: any[] = [];
  if (Array.isArray(json)) {
    for (const batch of json) {
      if (Array.isArray(batch?.results)) rows.push(...batch.results);
    }
  } else if (Array.isArray(json?.results)) {
    rows.push(...json.results);
  }
  return rows;
}

export async function listAccessibleCustomers(
  accessToken: string
): Promise<string[]> {
  const { developerToken } = getGoogleAdsOAuthConfig();
  if (!developerToken) throw new Error("GOOGLE_ADS_DEVELOPER_TOKEN must be set");

  const resp = await fetch(
    `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}/customers:listAccessibleCustomers`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "developer-token": developerToken,
      },
    }
  );
  const json = await resp.json();
  if (!resp.ok) {
    throw new Error(
      json?.error?.message || `listAccessibleCustomers failed (${resp.status})`
    );
  }
  const names: string[] = json.resourceNames || [];
  return names.map((n) => n.replace(/^customers\//, ""));
}
