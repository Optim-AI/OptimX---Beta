// pages/api/dashboard/health-check.ts
// Health check endpoint called when user lands on dashboard

import type { NextApiRequest, NextApiResponse } from "next";
import { getUserIdFromRequest } from '@/auth/request';
import { readSavedIntegration } from '@/integrations/store';
import { shouldCheckHealth, checkIntegrationHealth, getHealthStatus } from '@/integrations/meta/health';
import { ensureValidToken } from '@/integrations/meta/token-refresh';

/**
 * POST /api/dashboard/health-check
 * Checks health of user's Meta integration and refreshes token if needed
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const userId = await getUserIdFromRequest(req);

    if (!userId) {
      return res.status(200).json({ meta: null });
    }

    // Get user's Meta integration
    const integration = await readSavedIntegration({ provider: "meta", userId });

    if (!integration) {
      return res.status(200).json({ meta: null });
    }

    let healthStatus = integration.healthStatus || 'healthy';
    let healthMessage = integration.healthErrorMessage || 'Connected and working normally';
    let needsReconnect = false;

    // Check if unhealthy
    const unhealthyStatuses = ['expired', 'revoked', 'invalid'];
    if (unhealthyStatuses.includes(healthStatus)) {
      needsReconnect = true;

      return res.status(200).json({
        meta: {
          connected: false,
          healthStatus,
          message: healthMessage,
          needsReconnect: true,
          lastChecked: integration.lastHealthCheck || null,
        },
      });
    }

    // Check if health check is needed
    if (shouldCheckHealth(integration)) {
      console.log('[Dashboard Health Check] Running health check for user:', userId);

      try {
        const healthResult = await checkIntegrationHealth(integration);

        if (!healthResult.healthy) {
          // Integration is unhealthy
          return res.status(200).json({
            meta: {
              connected: false,
              healthStatus: healthResult.status,
              message: healthResult.message,
              needsReconnect: true,
              lastChecked: new Date().toISOString(),
            },
          });
        }

        healthStatus = healthResult.status;
        healthMessage = healthResult.message;
      } catch (error: any) {
        console.error('[Dashboard Health Check] Health check failed:', error);
        // Continue with existing status if check fails
      }

      // If token expires soon, try to refresh proactively
      if (healthStatus === 'expires_soon') {
        try {
          console.log('[Dashboard Health Check] Token expires soon, attempting refresh...');
          await ensureValidToken(integration);
          healthStatus = 'healthy';
          healthMessage = 'Connected and working normally';
        } catch (error: any) {
          console.error('[Dashboard Health Check] Token refresh failed:', error);
          // Keep expires_soon status
        }
      }
    }

    // Return healthy status
    return res.status(200).json({
      meta: {
        connected: true,
        healthStatus,
        message: healthMessage,
        needsReconnect: false,
        tokenExpiresAt: integration.tokenExpiresAt || null,
        lastChecked: integration.lastHealthCheck || new Date().toISOString(),
      },
    });
  } catch (err: any) {
    console.error('[Dashboard Health Check] Error:', err);
    return res.status(500).json({
      error: "health_check_error",
      message: "Failed to check integration health",
    });
  }
}
