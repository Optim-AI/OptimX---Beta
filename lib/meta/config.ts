/** Env-driven config for Meta Intelligence connect. Server-only. */

/** Permissions the Facebook Login for Business configuration must grant (set in the Meta dashboard). */
export const META_INTEL_SCOPES = [
  'ads_read',
  'business_management',
  'read_insights',
  'pages_show_list',
  'pages_read_engagement',
  'instagram_basic',
  'instagram_manage_insights',
] as const;

/** Only requested when META_REQUEST_PAGE_USER_CONTENT=true (needs its own FLfB configuration). */
export const META_OPTIONAL_SCOPE_USER_CONTENT = 'pages_read_user_content';

export function wantsPageUserContent(): boolean {
  const v = process.env.META_REQUEST_PAGE_USER_CONTENT?.trim().toLowerCase();
  return v === 'true' || v === '1';
}

export type MetaConnectConfig = {
  appId: string;
  appSecret: string;
  configId: string;
  redirectUri: string;
  appUrl: string;
};

export class MetaConfigError extends Error {}

export function getMetaConnectConfig(): MetaConnectConfig {
  const appId = process.env.FACEBOOK_APP_ID?.trim();
  const appSecret = process.env.FACEBOOK_APP_SECRET?.trim();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, '');
  const configId = (wantsPageUserContent()
    ? process.env.META_LOGIN_CONFIG_ID_USER_CONTENT
    : process.env.META_LOGIN_CONFIG_ID
  )?.trim();

  const missing = [
    !appId && 'FACEBOOK_APP_ID',
    !appSecret && 'FACEBOOK_APP_SECRET',
    !appUrl && 'NEXT_PUBLIC_APP_URL',
    !configId && (wantsPageUserContent() ? 'META_LOGIN_CONFIG_ID_USER_CONTENT' : 'META_LOGIN_CONFIG_ID'),
  ].filter(Boolean);
  if (missing.length) throw new MetaConfigError(`Meta connect is not configured: missing ${missing.join(', ')}`);

  return {
    appId: appId!,
    appSecret: appSecret!,
    configId: configId!,
    appUrl: appUrl!,
    redirectUri: `${appUrl}/api/meta-intel/callback`,
  };
}
