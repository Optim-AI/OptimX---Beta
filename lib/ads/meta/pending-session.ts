import { OAuthSessionDAO } from "@/database";

export type MetaPendingSelection = {
  sessionId: string;
  pagesCount: number;
  adAccountsCount: number;
  expiresAt: string;
};

/**
 * Safe summary of an in-progress Meta OAuth session (tokens never included).
 * Used when Facebook authorized but Page/ad-account selection is not finalized.
 * Skips NO_PAGES / empty sessions so the UI does not open select-assets with empty lists.
 */
export async function getMetaPendingSelection(
  userId: string
): Promise<MetaPendingSelection | null> {
  const row = await OAuthSessionDAO.findLatestActiveByUserProvider(userId, "meta");
  if (!row) return null;

  const data = (row.data || {}) as Record<string, unknown>;
  const pages = Array.isArray(data.pages) ? data.pages : [];
  const adAccounts = Array.isArray(data.adAccounts) ? data.adAccounts : [];
  const errorType = typeof data.errorType === "string" ? data.errorType : null;

  if (errorType === "NO_PAGES" || pages.length === 0) {
    return null;
  }

  return {
    sessionId: row.id,
    pagesCount: pages.length,
    adAccountsCount: adAccounts.length,
    expiresAt: row.expiresAt,
  };
}
