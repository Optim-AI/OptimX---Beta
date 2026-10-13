/**
 * Meta Ads credential column contract (PR W2.3B).
 *
 * ## How SkalX stores Meta Ads OAuth credentials
 *
 * `pages/api/meta/oauth/finalize.ts` saves:
 * - `userAccessToken` — long-lived **user** token from the Ads OAuth exchange
 * - `pageAccessToken` — selected Facebook **Page** token from `me/accounts`
 * - `pageId` — selected Page id (must be in the OAuth session page list)
 *
 * `integrations/store.ts` `saveIntegration` maps those into DB columns for
 * `provider = "meta"` only:
 * - `integrations.access_token`  ← Page token (`pageAccessToken`)
 * - `integrations.refresh_token` ← User token (`userAccessToken`)
 * - `integrations.page_id`       ← Page id
 *
 * `readSavedIntegration` remaps on read:
 * - `pageAccessToken` ← decrypted `access_token`
 * - `userAccessToken` ← decrypted `refresh_token`
 *
 * Google Ads / LinkedIn keep conventional OAuth meaning
 * (access_token = access, refresh_token = refresh). **Do not** use this
 * mapper for those providers or for organic `meta-publish` / `meta-instagram`.
 *
 * ## Intended token type per operation (W2.3+)
 *
 * | Operation | Intended credential |
 * |-----------|---------------------|
 * | `act_{id}/campaigns`, ad sets, ads, adimages, insights | **User** Ads token (`ads_management` / `ads_read`) |
 * | `object_story_spec.page_id` (Page identity) | Trusted `page_id` from integration (not from body) |
 * | Page-scoped Graph calls that require a Page token | **Page** token, when Meta requires it |
 *
 * Documentation note: developers.facebook.com returned HTTP 403 from this
 * environment during W2.3B. Industry / Marketing API practice treats user or
 * system-user tokens with `ads_management` as the credential for ad-account
 * writes; Page tokens are for Page APIs. Confirm on staging with Meta’s
 * Access Token Debugger before production create-paused.
 */

export type MetaAdsStoredTokenColumns = {
  /** Decrypted `integrations.access_token` (Page token for provider=meta). */
  accessToken: string | null;
  /** Decrypted `integrations.refresh_token` (User Ads token for provider=meta). */
  refreshToken: string | null;
};

export type MetaAdsTypedCredentials = {
  /** User / Ads Marketing API token — NEVER a Page token relabeled. */
  userAccessToken: string | null;
  /** Facebook Page token — NEVER a user token relabeled. */
  pageAccessToken: string | null;
};

/**
 * Map decrypted Meta Ads DB columns to typed credentials.
 * Does not invent tokens; empty strings become null.
 */
export function mapMetaAdsStoredTokens(
  revealed: MetaAdsStoredTokenColumns
): MetaAdsTypedCredentials {
  const page =
    typeof revealed.accessToken === "string" && revealed.accessToken.trim()
      ? revealed.accessToken.trim()
      : null;
  const user =
    typeof revealed.refreshToken === "string" && revealed.refreshToken.trim()
      ? revealed.refreshToken.trim()
      : null;
  return {
    pageAccessToken: page,
    userAccessToken: user,
  };
}

/**
 * Prefer the user Ads token for Marketing API / sync Graph calls when
 * provider is `meta`. Falls back to Page token only if user token is absent
 * (legacy/incomplete rows) — callers that require Ads writes should fail
 * closed when user token is missing instead of relying on this fallback.
 */
export function preferMetaAdsUserTokenForGraph(opts: {
  provider: string;
  accessToken: string | null | undefined;
  refreshToken: string | null | undefined;
}): string {
  const mapped = mapMetaAdsStoredTokens({
    accessToken: opts.accessToken ?? null,
    refreshToken: opts.refreshToken ?? null,
  });
  if (String(opts.provider) === "meta") {
    return mapped.userAccessToken || mapped.pageAccessToken || "";
  }
  // Non-Meta: conventional access_token
  return String(opts.accessToken || "").trim();
}
