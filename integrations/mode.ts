/**
 * Integration mode configuration utility
 *
 * Determines whether the app should use beta integration flow (manual approval)
 * or full OAuth flow (instant self-service connection).
 */

/**
 * Check if integrations are in beta mode
 *
 * @returns true if beta mode is enabled (manual form + approval workflow)
 *          false if full OAuth mode is enabled (instant connection)
 */
export function isIntegrationBetaMode(): boolean {
  const envValue = process.env.NEXT_PUBLIC_INTEGRATIONS_BETA_MODE;

  // Default to false (full OAuth mode) if not set
  if (!envValue) {
    return false;
  }

  // Parse string to boolean
  return envValue.toLowerCase() === 'true' || envValue === '1';
}

/**
 * Get the integration mode as a string
 *
 * @returns 'beta' or 'oauth'
 */
export function getIntegrationMode(): 'beta' | 'oauth' {
  return isIntegrationBetaMode() ? 'beta' : 'oauth';
}
