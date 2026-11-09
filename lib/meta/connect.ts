/**
 * Meta connect: code → token → inspect → discover assets → save (encrypted).
 * Server-only.
 */
import { graphCall, graphGetAll, MetaGraphError } from './graph';
import { getMetaConnectConfig, type MetaConnectConfig } from './config';
import { encryptToken } from './crypto';
import { metaLog } from './log';
import { MetaConnectionDAO, type MetaAssetInput } from '@/database/models/MetaConnection.dao';

export type TokenInfo = {
  tokenType: 'system_user' | 'user';
  isValid: boolean;
  scopes: string[];
  /** target ids per scope from granular_scopes (e.g. business ids, page ids, ad account ids). */
  targets: Record<string, string[]>;
  expiresAt: string | null;
  dataAccessExpiresAt: string | null;
  subjectId: string | null;
};

type DebugTokenResponse = {
  data?: {
    is_valid?: boolean;
    type?: string;
    scopes?: string[];
    granular_scopes?: { scope: string; target_ids?: string[] }[];
    expires_at?: number;
    data_access_expires_at?: number;
    user_id?: string;
  };
};

const toIso = (unix?: number) => (unix && unix > 0 ? new Date(unix * 1000).toISOString() : null);

export function interpretDebugToken(resp: DebugTokenResponse): TokenInfo {
  const d = resp?.data ?? {};
  const targets: Record<string, string[]> = {};
  for (const g of d.granular_scopes ?? []) targets[g.scope] = (g.target_ids ?? []).map(String);
  return {
    tokenType: String(d.type ?? '').toUpperCase() === 'SYSTEM_USER' ? 'system_user' : 'user',
    isValid: d.is_valid === true,
    scopes: d.scopes ?? [],
    targets,
    expiresAt: toIso(d.expires_at),
    dataAccessExpiresAt: toIso(d.data_access_expires_at),
    subjectId: d.user_id ? String(d.user_id) : null,
  };
}

export async function inspectToken(token: string, cfg: MetaConnectConfig = getMetaConnectConfig()): Promise<TokenInfo> {
  const resp = await graphCall<DebugTokenResponse>('debug_token', null, {
    input_token: token,
    access_token: `${cfg.appId}|${cfg.appSecret}`,
  });
  return interpretDebugToken(resp);
}

async function exchangeCode(code: string, cfg: MetaConnectConfig): Promise<string> {
  const resp = await graphCall<{ access_token?: string }>('oauth/access_token', null, {
    client_id: cfg.appId,
    client_secret: cfg.appSecret,
    redirect_uri: cfg.redirectUri,
    code,
  }, { attempts: 1 });
  if (!resp.access_token) throw new Error('Meta did not return an access token');
  return resp.access_token;
}

async function toLongLived(token: string, cfg: MetaConnectConfig): Promise<string> {
  const resp = await graphCall<{ access_token?: string }>('oauth/access_token', null, {
    grant_type: 'fb_exchange_token',
    client_id: cfg.appId,
    client_secret: cfg.appSecret,
    fb_exchange_token: token,
  }, { attempts: 2 });
  return resp.access_token || token;
}

type AdAccountNode = {
  id: string;
  account_id?: string;
  name?: string;
  currency?: string;
  timezone_name?: string;
  account_status?: number;
  business?: { id: string; name?: string };
};
type IgNode = { id: string; username?: string; name?: string; profile_picture_url?: string };
type PageNode = {
  id: string;
  name?: string;
  category?: string;
  access_token?: string;
  instagram_business_account?: IgNode;
};

const AD_ACCOUNT_FIELDS = 'id,account_id,name,currency,timezone_name,account_status,business{id,name}';
const PAGE_FIELDS = 'id,name,category,access_token,instagram_business_account{id,username,name,profile_picture_url}';

/** Fetch nodes one by one (used when /me edges come back empty for business-granted assets). */
async function fetchEach<T>(ids: string[], token: string, fields: string, prefix = ''): Promise<T[]> {
  const out: T[] = [];
  for (const id of ids.slice(0, 50)) {
    try {
      out.push(await graphCall<T>(`${prefix}${id}`, token, { fields }));
    } catch (err) {
      metaLog.warn('asset_fetch_failed', { id, message: (err as Error).message });
    }
  }
  return out;
}

export async function discoverAssets(token: string, info: TokenInfo): Promise<MetaAssetInput[]> {
  let adAccounts = await graphGetAll<AdAccountNode>('me/adaccounts', token, { fields: AD_ACCOUNT_FIELDS }).catch((err) => {
    metaLog.warn('adaccounts_list_failed', { message: (err as Error).message });
    return [] as AdAccountNode[];
  });
  if (!adAccounts.length && info.targets.ads_read?.length) {
    adAccounts = await fetchEach<AdAccountNode>(info.targets.ads_read, token, AD_ACCOUNT_FIELDS, 'act_');
  }

  let pages = await graphGetAll<PageNode>('me/accounts', token, { fields: PAGE_FIELDS }).catch((err) => {
    metaLog.warn('pages_list_failed', { message: (err as Error).message });
    return [] as PageNode[];
  });
  if (!pages.length && info.targets.pages_show_list?.length) {
    pages = await fetchEach<PageNode>(info.targets.pages_show_list, token, PAGE_FIELDS);
  }

  const assets: MetaAssetInput[] = [];
  for (const a of adAccounts) {
    const metaId = a.account_id ? String(a.account_id) : String(a.id).replace(/^act_/, '');
    assets.push({
      kind: 'ad_account',
      metaId,
      name: a.name ?? null,
      currency: a.currency ?? null,
      timezoneName: a.timezone_name ?? null,
      accountStatus: typeof a.account_status === 'number' ? a.account_status : null,
      metadata: a.business ? { businessId: a.business.id, businessName: a.business.name ?? null } : {},
    });
  }
  const seenIg = new Set<string>();
  for (const p of pages) {
    assets.push({
      kind: 'page',
      metaId: String(p.id),
      name: p.name ?? null,
      pageTokenEnc: p.access_token ? encryptToken(p.access_token) : null,
      metadata: { category: p.category ?? null },
    });
    const ig = p.instagram_business_account;
    if (ig?.id && !seenIg.has(ig.id)) {
      seenIg.add(ig.id);
      assets.push({
        kind: 'ig_account',
        metaId: String(ig.id),
        name: ig.username ? `@${ig.username}` : ig.name ?? null,
        parentMetaId: String(p.id),
        metadata: { username: ig.username ?? null, pictureUrl: ig.profile_picture_url ?? null },
      });
    }
  }
  return assets;
}

export type CompleteConnectResult = { connectionId: string; assetCounts: Record<string, number> };

export async function completeConnect(params: {
  userId: string;
  brandKitId: string | null;
  code: string;
}): Promise<CompleteConnectResult> {
  const cfg = getMetaConnectConfig();
  let token = await exchangeCode(params.code, cfg);
  let info = await inspectToken(token, cfg);
  if (!info.isValid) throw new Error('Meta returned a token that is not valid');

  if (info.tokenType === 'user') {
    // Short-lived user token → long-lived (≈60 days). System-user tokens are used as-is.
    token = await toLongLived(token, cfg);
    info = await inspectToken(token, cfg);
  }

  const me = await graphCall<{ id?: string; name?: string }>('me', token, { fields: 'id,name' }).catch(() => ({} as { id?: string; name?: string }));
  const businessId = info.targets.business_management?.[0] ?? null;
  let businessName: string | null = null;
  if (businessId) {
    businessName = await graphCall<{ name?: string }>(businessId, token, { fields: 'name' })
      .then((b) => b.name ?? null)
      .catch(() => null);
  }

  const assets = await discoverAssets(token, info);

  const conn = await MetaConnectionDAO.upsertFromConnect({
    userId: params.userId,
    brandKitId: params.brandKitId,
    metaUserId: me.id ?? info.subjectId,
    metaUserName: me.name ?? null,
    businessId,
    businessName,
    tokenEnc: encryptToken(token),
    tokenType: info.tokenType,
    scopes: info.scopes,
    tokenExpiresAt: info.expiresAt,
    dataAccessExpiresAt: info.dataAccessExpiresAt,
  });
  await MetaConnectionDAO.replaceAssets(conn.id, params.userId, assets);

  const assetCounts = assets.reduce<Record<string, number>>((acc, a) => {
    acc[a.kind] = (acc[a.kind] ?? 0) + 1;
    return acc;
  }, {});
  metaLog.info('connect_completed', {
    userId: params.userId,
    tokenType: info.tokenType,
    scopeCount: info.scopes.length,
    assetCounts,
  });
  return { connectionId: conn.id, assetCounts };
}

export { MetaGraphError };
