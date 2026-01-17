// integrations/meta/health.ts
// Health check service for Facebook integrations

import { retryWithBackoff } from './retry';
import { detectTokenError, TokenErrorCode } from './token-refresh';
import { IntegrationDAO } from '@/database';

const VERSION = process.env.FACEBOOK_API_VERSION || "23.0";

export type HealthStatus = 'healthy' | 'expires_soon' | 'expired' | 'revoked' | 'invalid';

/**
 * Convert TokenErrorCode to HealthStatus
 * Filters out transient and generic errors which shouldn't affect health status
 */
export function tokenErrorCodeToHealthStatus(code: string): HealthStatus | null {
  switch (code) {
    case 'expired':
      return 'expired';
    case 'revoked':
      return 'revoked';
    case 'invalid':
      return 'invalid';
    case 'transient':
    case 'error':
    default:
      // Don't update health for transient or generic errors
      return null;
  }
}

export interface HealthCheckResult {
  healthy: boolean;
  status: HealthStatus;
  message: string;
  facebookCode?: number;
}

/**
 * Check if health check is needed for an integration
 *
 * @param integration - Integration object from database
 * @returns true if health check should be performed
 */
export function shouldCheckHealth(integration: any): boolean {
  // Always check if status is not healthy
  if (integration.healthStatus && integration.healthStatus !== 'healthy') {
    return true;
  }

  // Check if last health check was more than 6 hours ago
  if (integration.lastHealthCheck) {
    const lastCheck = new Date(integration.lastHealthCheck.replace(' ', 'T') + 'Z');
    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);

    if (lastCheck < sixHoursAgo) {
      return true;
    }
  } else {
    // Never checked before
    return true;
  }

  // Check if token expires soon (within 7 days)
  if (integration.tokenExpiresAt) {
    const expiresAt = new Date(integration.tokenExpiresAt.replace(' ', 'T') + 'Z');
    const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    if (expiresAt < sevenDaysFromNow) {
      return true;
    }
  }

  return false;
}

/**
 * Calculate health status from token expiration date
 *
 * @param tokenExpiresAt - Token expiration timestamp
 * @param lastHealthCheck - Last health check timestamp
 * @returns Health status
 */
export function getHealthStatus(tokenExpiresAt?: string, lastHealthCheck?: string): HealthStatus {
  if (!tokenExpiresAt) {
    return 'healthy';
  }

  const expiresAt = new Date(tokenExpiresAt.replace(' ', 'T') + 'Z');
  const now = new Date();

  // Token expired
  if (expiresAt < now) {
    return 'expired';
  }

  // Token expires within 7 days
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  if (expiresAt < sevenDaysFromNow) {
    return 'expires_soon';
  }

  return 'healthy';
}

/**
 * Perform health check by making a lightweight API call to Facebook
 *
 * @param integration - Integration object with access token
 * @returns Health check result
 */
export async function checkIntegrationHealth(integration: any): Promise<HealthCheckResult> {
  console.log('[Health Check] Checking integration health', {
    integrationId: integration.savedRowId,
    userId: integration.userId || integration.user_id,
  });

  try {
    // Use /me endpoint as a lightweight health check
    const response = await retryWithBackoff(
      () => fetch(
        `https://graph.facebook.com/v${VERSION}/me?access_token=${encodeURIComponent(integration.pageAccessToken)}`
      ),
      {
        maxAttempts: 3,
        onRetry: (attempt, error) => {
          console.log(`[Health Check] Retry attempt ${attempt}:`, error.message);
        },
      }
    );

    const data = await response.json();

    if (data.error) {
      // Token error detected
      const error = detectTokenError(data.error);

      console.warn('[Health Check] Token error detected:', {
        code: error.code,
        message: error.message,
      });

      // Update integration health in database
      if (integration.savedRowId) {
        await updateIntegrationHealth(
          integration.savedRowId,
          error.status as HealthStatus,
          error.message
        );
      }

      return {
        healthy: false,
        status: error.status as HealthStatus,
        message: error.message,
        facebookCode: error.facebookCode,
      };
    }

    // Success - token is valid
    const status = getHealthStatus(integration.tokenExpiresAt);

    // Update integration health in database
    if (integration.savedRowId) {
      await updateIntegrationHealth(
        integration.savedRowId,
        status,
        getHealthMessage(status, integration.tokenExpiresAt)
      );
    }

    return {
      healthy: true,
      status,
      message: getHealthMessage(status, integration.tokenExpiresAt),
    };
  } catch (error: any) {
    console.error('[Health Check] Failed:', error);

    // If this is a token error, classify it
    const tokenError = detectTokenError(error);

    if (tokenError.code !== 'transient' && tokenError.code !== 'error') {
      // Update database with error
      if (integration.savedRowId) {
        await updateIntegrationHealth(
          integration.savedRowId,
          tokenError.status as HealthStatus,
          tokenError.message
        );
      }

      return {
        healthy: false,
        status: tokenError.status as HealthStatus,
        message: tokenError.message,
      };
    }

    // Transient error - don't mark as unhealthy
    return {
      healthy: true,
      status: 'healthy',
      message: 'Health check failed temporarily, will retry later',
    };
  }
}

/**
 * Update integration health status in database
 *
 * @param integrationId - Integration ID
 * @param status - Health status
 * @param message - Error message or status description
 */
export async function updateIntegrationHealth(
  integrationId: string,
  status: HealthStatus,
  message: string
): Promise<void> {
  try {
    await IntegrationDAO.update(integrationId, {
      healthStatus: status,
      healthErrorMessage: message,
      lastHealthCheck: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    console.log('[Health Check] Updated integration health:', {
      integrationId,
      status,
      message,
    });
  } catch (error) {
    console.error('[Health Check] Failed to update integration health:', error);
  }
}

/**
 * Update integration health in background (fire-and-forget)
 * Used when error is detected during an API call to avoid blocking the response
 *
 * @param userId - User ID
 * @param provider - Provider name (e.g., 'meta')
 * @param status - Health status
 * @param message - Error message
 */
export async function updateIntegrationHealthInBackground(
  userId: string,
  provider: string,
  status: HealthStatus,
  message: string
): Promise<void> {
  // Fire and forget - don't await
  setImmediate(async () => {
    try {
      const integration = await IntegrationDAO.findByUserAndProvider(userId, provider);

      if (integration) {
        await updateIntegrationHealth(integration.id, status, message);
      }
    } catch (error) {
      console.error('[Health Check] Background update failed:', error);
    }
  });
}

/**
 * Get user-friendly health message based on status
 *
 * @param status - Health status
 * @param tokenExpiresAt - Token expiration date (optional)
 * @returns User-friendly message
 */
function getHealthMessage(status: HealthStatus, tokenExpiresAt?: string): string {
  switch (status) {
    case 'healthy':
      return 'Connected and working normally';

    case 'expires_soon':
      if (tokenExpiresAt) {
        const expiresAt = new Date(tokenExpiresAt.replace(' ', 'T') + 'Z');
        const daysLeft = Math.ceil((expiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
        return `Token expires in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}. We'll refresh it automatically.`;
      }
      return 'Token expires soon. We\'ll refresh it automatically.';

    case 'expired':
      return 'Your Facebook token has expired. Please reconnect your account.';

    case 'revoked':
      return 'Your Facebook access was revoked. Please reconnect your account.';

    case 'invalid':
      return 'You no longer have access to this Facebook page. Please reconnect.';

    default:
      return 'Status unknown';
  }
}
