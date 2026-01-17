// integrations/meta/token-refresh.ts
// Facebook token refresh and validation logic

import { retryWithBackoff } from './retry';
import { IntegrationDAO } from '@/database';

const VERSION = process.env.FACEBOOK_API_VERSION || "23.0";

export type TokenErrorCode = 'expired' | 'revoked' | 'invalid' | 'transient' | 'error';

export interface TokenError {
  code: TokenErrorCode;
  status: string;
  message: string;
  facebookCode?: number;
}

export interface RefreshResult {
  accessToken: string;
  expiresAt: Date;
}

/**
 * Refresh a Facebook access token by exchanging it for a new long-lived token
 *
 * @param currentToken - Current access token to refresh
 * @returns New access token and expiration date (60 days from now)
 */
export async function refreshFacebookToken(currentToken: string): Promise<RefreshResult> {
  const appId = process.env.FACEBOOK_APP_ID;
  const appSecret = process.env.FACEBOOK_APP_SECRET;

  if (!appId || !appSecret) {
    throw new Error('Facebook app credentials not configured');
  }

  // Use retry logic for network resilience
  const response = await retryWithBackoff(
    () => fetch(
      `https://graph.facebook.com/v${VERSION}/oauth/access_token` +
      `?grant_type=fb_exchange_token` +
      `&client_id=${encodeURIComponent(appId)}` +
      `&client_secret=${encodeURIComponent(appSecret)}` +
      `&fb_exchange_token=${encodeURIComponent(currentToken)}`
    ),
    {
      maxAttempts: 3,
      onRetry: (attempt, error) => {
        console.log(`[Token Refresh] Retry attempt ${attempt}:`, error.message);
      },
    }
  );

  const data = await response.json();

  if (data.error) {
    const error = detectTokenError(data.error);
    throw new Error(`Token refresh failed: ${error.message}`);
  }

  if (!data.access_token) {
    throw new Error('Token refresh response missing access_token');
  }

  // Long-lived tokens expire in 60 days
  const expiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);

  return {
    accessToken: data.access_token,
    expiresAt,
  };
}

/**
 * Ensure an integration has a valid token, refreshing if needed
 *
 * @param integration - Integration object from database
 * @returns Updated integration with fresh token
 */
export async function ensureValidToken(integration: any): Promise<any> {
  const now = new Date();

  // Parse expiry date with better error handling
  let expiresAt: Date | null = null;
  if (integration.tokenExpiresAt) {
    try {
      const dateStr = typeof integration.tokenExpiresAt === 'string'
        ? integration.tokenExpiresAt.replace(' ', 'T')
        : integration.tokenExpiresAt;
      expiresAt = new Date(dateStr);

      // Check if date is valid
      if (isNaN(expiresAt.getTime())) {
        console.warn('[Token Refresh] Invalid tokenExpiresAt, will refresh token:', integration.tokenExpiresAt);
        expiresAt = null;
      }
    } catch (err) {
      console.warn('[Token Refresh] Error parsing tokenExpiresAt:', err);
      expiresAt = null;
    }
  }

  // Check if token expires within 7 days
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  if (expiresAt && expiresAt > sevenDaysFromNow) {
    // Token is still valid for more than 7 days
    return integration;
  }

  console.log('[Token Refresh] Token expires soon or invalid expiry, refreshing...', {
    integrationId: integration.savedRowId,
    expiresAt: expiresAt ? expiresAt.toISOString() : 'null',
  });

  try {
    // Refresh the token
    const refreshResult = await refreshFacebookToken(integration.pageAccessToken);

    // Update database
    await IntegrationDAO.update(integration.savedRowId, {
      accessToken: refreshResult.accessToken,
      tokenExpiresAt: refreshResult.expiresAt.toISOString(),
      updatedAt: new Date().toISOString(),
    });

    console.log('[Token Refresh] Token refreshed successfully', {
      integrationId: integration.savedRowId,
      newExpiresAt: refreshResult.expiresAt.toISOString(),
    });

    // Return updated integration
    return {
      ...integration,
      pageAccessToken: refreshResult.accessToken,
      tokenExpiresAt: refreshResult.expiresAt.toISOString(),
    };
  } catch (error: any) {
    console.error('[Token Refresh] Failed to refresh token:', error);
    throw error;
  }
}

/**
 * Detect and classify Facebook API errors
 *
 * @param error - Error object from Facebook API or thrown error
 * @returns Classified token error
 */
export function detectTokenError(error: any): TokenError {
  // Handle Facebook Graph API error format
  if (error.code || error.error_code) {
    const code = error.code || error.error_code;
    const message = error.message || error.error_message || 'Unknown error';

    switch (code) {
      case 190:
        // Invalid or expired access token
        return {
          code: 'expired',
          status: 'expired',
          message: 'Your Facebook token has expired. Please reconnect your account.',
          userMessage: 'Your Facebook token has expired. Please reconnect your account.',
          name: 'TokenError',
          facebookCode: code,
        };

      case 200:
        // Permission denied - user revoked access
        return {
          code: 'revoked',
          status: 'revoked',
          message: 'Your Facebook access was revoked. Please reconnect your account.',
          userMessage: 'Your Facebook access was revoked. Please reconnect your account.',
          name: 'TokenError',
          facebookCode: code,
        };

      case 10:
        // Permission error - page access lost
        return {
          code: 'invalid',
          status: 'invalid',
          message: 'You no longer have access to this Facebook page. Please reconnect with a different page.',
          userMessage: 'You no longer have access to this Facebook page. Please reconnect with a different page.',
          name: 'TokenError',
          facebookCode: code,
        };

      case 403:
      case 3:
        // Permission denied
        return {
          code: 'invalid',
          status: 'invalid',
          message: 'Permission denied. You may no longer have access to this resource.',
          userMessage: 'Permission denied. You may no longer have access to this resource.',
          name: 'TokenError',
          facebookCode: code,
        };

      default:
        return {
          code: 'error',
          status: 'error',
          message: `Facebook API error: ${message}`,
          userMessage: `Facebook API error: ${message}`,
          name: 'TokenError',
          facebookCode: code,
        };
    }
  }

  // Handle network/timeout errors
  if (error.code === 'ETIMEDOUT' || error.code === 'ECONNRESET' || error.code === 'ENOTFOUND') {
    return {
      code: 'transient',
      status: 'transient',
      message: 'Network error. Please try again.',
      userMessage: 'Network error. Please try again.',
      name: 'TokenError',
    };
  }

  // Generic error
  return {
    code: 'error',
    status: 'error',
    message: error.message || 'An unknown error occurred',
    userMessage: error.message || 'An unknown error occurred',
    name: 'TokenError',
  };
}

/**
 * Custom error class for token-specific errors
 */
export class TokenError extends Error {
  constructor(
    public code: TokenErrorCode,
    public userMessage: string,
    public facebookCode?: number
  ) {
    super(userMessage);
    this.name = 'TokenError';
  }
}
