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
  }
): Promise<string> {
  const sessionId = `oauth_meta_${userId}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
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
    await OAuthSessionDAO.store(sessionId, userId, "meta", session, expiresAt);
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

    // Parse the expiration timestamp
    // Database returns: "2026-01-04 11:43:39.535"
    // We need to convert to Date object for comparison
    const expiresAt = new Date(session.expiresAt.replace(' ', 'T') + 'Z');
    const now = new Date();

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
