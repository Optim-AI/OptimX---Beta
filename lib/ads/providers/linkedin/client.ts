/**
 * LinkedIn Marketing / Advertising API helpers.
 * Requires LINKEDIN_CLIENT_ID / LINKEDIN_CLIENT_SECRET.
 */

export const LINKEDIN_API_VERSION =
  process.env.LINKEDIN_API_VERSION || "202405";

export const LINKEDIN_ADS_SCOPES = [
  "r_ads",
  "r_ads_reporting",
  "rw_ads",
  "r_organization_social",
  "openid",
  "profile",
  "email",
].join(" ");

export function getLinkedInOAuthConfig() {
  const clientId = process.env.LINKEDIN_CLIENT_ID;
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET must be set");
  }
  return { clientId, clientSecret };
}

export function isLinkedInConfigured(): boolean {
  return !!(process.env.LINKEDIN_CLIENT_ID && process.env.LINKEDIN_CLIENT_SECRET);
}

export async function refreshLinkedInAccessToken(
  refreshToken: string
): Promise<{ accessToken: string; refreshToken?: string; expiresIn: number }> {
  const { clientId, clientSecret } = getLinkedInOAuthConfig();
  const resp = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  const json = await resp.json();
  if (!resp.ok || !json.access_token) {
    throw new Error(json.error_description || json.error || "LinkedIn token refresh failed");
  }
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresIn: json.expires_in ?? 5184000,
  };
}

export async function linkedInGet(
  path: string,
  accessToken: string,
  params: Record<string, string> = {}
): Promise<any> {
  const qs = new URLSearchParams(params);
  const url = `https://api.linkedin.com/rest/${path.replace(/^\//, "")}${
    qs.toString() ? `?${qs}` : ""
  }`;
  const resp = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "LinkedIn-Version": LINKEDIN_API_VERSION,
      "X-Restli-Protocol-Version": "2.0.0",
    },
  });
  const json = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    throw new Error(
      json.message || json.error_description || `LinkedIn API ${resp.status}`
    );
  }
  return json;
}
