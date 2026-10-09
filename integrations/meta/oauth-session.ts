// lib/meta/oauthSession.ts
// REFACTORED: Now uses Prisma OAuthSessionDAO instead of direct Supabase
import { OAuthSessionDAO } from '@/database';

/**
 * Represents a Facebook Page returned from /me/accounts
 */
export interface FacebookPage {
  id: string;
  name: string;
  category?: string;
  access_token: string;
  tasks?: string[];
  instagram_business_account?: {
    id: string;
  };
}

/**
 * Temporary OAuth session stored during the page selection flow
 */
export interface OAuthSession {
  userId: string;
  userAccessToken: string;
  pages: FacebookPage[];
  adAccounts?: any[];
  errorType?: string;
  tokenExpiresAt?: string;
  createdAt: string;
  expiresAt: string;
}

/**
 * Stores a temporary OAuth session for page selection flow
 * @param userId - The user ID
 * @param data - OAuth data (userAccessToken, pages, adAccounts)
 * @returns Session ID to use in redirect URL
 */
export async function storeOAuthSession(
  userId: string,
  data: {
    userAccessToken: string;
    pages: FacebookPage[];
    adAccounts?: any[];
    errorType?: string;
    tokenExpiresAt?: string;
  },
  options?: { provider?: string; sessionPrefix?: string }
): Promise<string> {
  const provider = options?.provider ?? "meta";
  const prefix = options?.sessionPrefix ?? `oauth_${provider}`;
  const sessionId = `${prefix}_${userId}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  const session: OAuthSession = {
    userId,
    userAccessToken: data.userAccessToken,
    pages: data.pages,
    adAccounts: data.adAccounts,
    errorType: data.errorType,
    tokenExpiresAt: data.tokenExpiresAt,
    createdAt: new Date().toISOString(),
    expiresAt: expiresAt.toISOString(),
  };

  try {
    await OAuthSessionDAO.store(sessionId, userId, provider, session, expiresAt);
    return sessionId;
  } catch (error: any) {
    console.error("[storeOAuthSession] Failed to store OAuth session:", error);
    throw new Error(`Failed to store OAuth session: ${error.message}`);
  }
}

/**
 * Retrieves an OAuth session by ID
 * @param sessionId - The session ID
 * @returns OAuth session data or null if expired/not found
 */
export async function getOAuthSession(
  sessionId: string
): Promise<OAuthSession | null> {
  try {
    const session = await OAuthSessionDAO.get(sessionId);

    if (!session) {
      return null;
    }

    // Parse expiration without corrupting already-offset timestamps
    // (appending "Z" to values like "2026-10-09 11:53:59.87+00" yields Invalid Date).
    const expiresAt = parseOAuthSessionExpiry(session.expiresAt);
    const now = new Date();

    if (!expiresAt || Number.isNaN(expiresAt.getTime())) {
      console.warn("[getOAuthSession] Unparseable expiresAt; treating as expired");
      await OAuthSessionDAO.delete(sessionId);
      return null;
    }

    // Check if expired
    if (now > expiresAt) {
      await OAuthSessionDAO.delete(sessionId);
      return null;
    }

    return session.data as unknown as OAuthSession;
  } catch (error) {
    console.error("[getOAuthSession] Error retrieving OAuth session:", error);
    return null;
  }
}

/** Exported for unit tests — parse oauth_sessions.expires_at safely. */
export function parseOAuthSessionExpiry(raw: string | Date | null | undefined): Date | null {
  if (!raw) return null;
  if (raw instanceof Date) return raw;
  const s = String(raw).trim();
  if (!s) return null;

  // Postgres often returns "YYYY-MM-DD HH:MM:SS.ms+00".
  // Never append "Z" onto an existing numeric offset (produces Invalid Date).
  const hasZone = /[zZ]|[+-]\d{2}(:?\d{2})?$/.test(s);
  let normalized = s.replace(" ", "T");
  if (hasZone) {
    normalized = normalized.replace(/([+-]\d{2})$/, "$1:00"); // +00 → +00:00
  } else if (!/[zZ]$/.test(normalized)) {
    normalized = `${normalized}Z`; // naive → UTC
  }

  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Clears an OAuth session after it's been used
 * @param sessionId - The session ID to delete
 */
export async function clearOAuthSession(sessionId: string): Promise<void> {
  try {
    await OAuthSessionDAO.delete(sessionId);
  } catch (error) {
    console.error("Failed to clear OAuth session:", error);
    // Non-fatal - session will expire naturally
  }
}

/**
 * Cleans up expired OAuth sessions (should be called periodically)
 */
export async function cleanupExpiredSessions(): Promise<void> {
  try {
    await OAuthSessionDAO.clearExpired();
  } catch (error) {
    console.error("Failed to cleanup expired sessions:", error);
  }
}
