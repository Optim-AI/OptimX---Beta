/**
 * Typed Graph API client for Meta Intelligence.
 * - Pinned version (version.ts), appsecret_proof on every call
 * - Retries transient / throttling errors with backoff, honours usage headers
 * - Never logs tokens
 */
import { createHmac } from 'crypto';
import { META_GRAPH_BASE } from './version';
import { backoffMs, parseUsageHeaders, type MetaUsage } from './usage';
import { metaLog } from './log';

export class MetaGraphError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: number,
    readonly subcode?: number,
    readonly type?: string,
    readonly fbtraceId?: string,
  ) {
    super(message);
    this.name = 'MetaGraphError';
  }

  /** Token expired, revoked, or permissions removed → user must reconnect. */
  get isAuthError(): boolean {
    return this.code === 190 || this.code === 102 || this.code === 10 || (this.code === 200 && this.status === 403);
  }

  get isThrottle(): boolean {
    const c = this.code ?? -1;
    return [4, 17, 32, 613].includes(c) || (c >= 80000 && c <= 80014);
  }

  get isTransient(): boolean {
    return this.isThrottle || this.code === 1 || this.code === 2 || this.status >= 500;
  }
}

export type GraphParams = Record<string, string | number | boolean | undefined | null>;

export type GraphCallOptions = {
  method?: 'GET' | 'POST' | 'DELETE';
  /** Max attempts including the first. */
  attempts?: number;
  timeoutMs?: number;
  /** Called with usage after every response (sync jobs use it to pace themselves). */
  onUsage?: (usage: MetaUsage) => void;
  /** Inject for tests. */
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
};

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export function appSecretProof(token: string, appSecret = process.env.FACEBOOK_APP_SECRET): string | null {
  if (!appSecret) return null;
  return createHmac('sha256', appSecret).update(token).digest('hex');
}

function buildUrl(pathOrUrl: string, params: GraphParams, token: string | null): string {
  const url = pathOrUrl.startsWith('https://')
    ? new URL(pathOrUrl)
    : new URL(`${META_GRAPH_BASE}/${pathOrUrl.replace(/^\//, '')}`);
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue;
    url.searchParams.set(k, String(v));
  }
  if (token) {
    url.searchParams.set('access_token', token);
    const proof = appSecretProof(token);
    if (proof) url.searchParams.set('appsecret_proof', proof);
  }
  return url.toString();
}

function pathForLog(pathOrUrl: string): string {
  try {
    const u = new URL(pathOrUrl.startsWith('https://') ? pathOrUrl : `${META_GRAPH_BASE}/${pathOrUrl}`);
    return u.pathname;
  } catch {
    return 'unknown';
  }
}

export async function graphCall<T = unknown>(
  pathOrUrl: string,
  token: string | null,
  params: GraphParams = {},
  opts: GraphCallOptions = {},
): Promise<T> {
  const method = opts.method ?? 'GET';
  const attempts = Math.max(1, opts.attempts ?? 3);
  const doFetch = opts.fetchImpl ?? fetch;
  const sleep = opts.sleep ?? defaultSleep;
  const url = buildUrl(pathOrUrl, params, token);

  let lastErr: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 30_000);
    try {
      const res = await doFetch(url, { method, signal: controller.signal });
      const usage = parseUsageHeaders((n) => res.headers.get(n));
      opts.onUsage?.(usage);
      const body = (await res.json().catch(() => null)) as any;

      if (!res.ok || body?.error) {
        const e = body?.error ?? {};
        throw new MetaGraphError(
          e.message || `Graph request failed (${res.status})`,
          res.status,
          e.code,
          e.error_subcode,
          e.type,
          e.fbtrace_id,
        );
      }

      const wait = backoffMs(usage);
      if (wait > 0) {
        metaLog.warn('usage_backoff', { path: pathForLog(pathOrUrl), maxPct: usage.maxPct, waitMs: wait });
        await sleep(Math.min(wait, 60_000));
      }
      return body as T;
    } catch (err) {
      lastErr = err;
      const graphErr = err instanceof MetaGraphError ? err : null;
      const aborted = (err as Error)?.name === 'AbortError';
      const retryable = aborted || (graphErr?.isTransient ?? (err instanceof TypeError));
      metaLog.warn('graph_error', {
        path: pathForLog(pathOrUrl),
        attempt,
        status: graphErr?.status,
        code: graphErr?.code,
        subcode: graphErr?.subcode,
        fbtraceId: graphErr?.fbtraceId,
        message: (err as Error)?.message,
      });
      if (!retryable || attempt === attempts) break;
      const base = graphErr?.isThrottle ? 20_000 : 1_500;
      await sleep(base * 2 ** (attempt - 1));
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastErr;
}

type Paged<T> = { data?: T[]; paging?: { next?: string } };

/** Follow `paging.next` up to maxPages. */
export async function graphGetAll<T>(
  path: string,
  token: string,
  params: GraphParams = {},
  opts: GraphCallOptions & { maxPages?: number } = {},
): Promise<T[]> {
  const out: T[] = [];
  let page = await graphCall<Paged<T>>(path, token, { limit: 100, ...params }, opts);
  out.push(...(page.data ?? []));
  let pages = 1;
  while (page.paging?.next && pages < (opts.maxPages ?? 20)) {
    // `next` already carries access_token; rebuild from its query minus auth so proof is recomputed.
    const next = new URL(page.paging.next);
    next.searchParams.delete('access_token');
    next.searchParams.delete('appsecret_proof');
    page = await graphCall<Paged<T>>(next.toString(), token, {}, opts);
    out.push(...(page.data ?? []));
    pages++;
  }
  return out;
}
