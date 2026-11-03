/**
 * Outbound URL safety for untrusted, visitor-supplied websites.
 * Every connection is pinned to an address that passed the public-IP check,
 * so DNS rebinding between validation and connect cannot reach private hosts.
 */

import dns from 'node:dns';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import type { LookupFunction } from 'node:net';

export type UrlCheck =
  | { ok: true; url: string; host: string }
  | { ok: false; reason: UrlRejectReason; message: string };

export type UrlRejectReason =
  | 'empty'
  | 'invalid'
  | 'protocol'
  | 'credentials'
  | 'port'
  | 'host'
  | 'private_address'
  | 'too_long';

const BLOCKED_HOST_SUFFIXES = [
  'localhost',
  '.localhost',
  '.local',
  '.internal',
  '.lan',
  '.home',
  '.corp',
  '.intranet',
  '.arpa',
];

const BLOCKED_HOSTS = new Set([
  'metadata',
  'metadata.google.internal',
  'metadata.goog',
  'instance-data',
  'instance-data.ec2.internal',
]);

const MAX_URL_LENGTH = 2048;

function reject(reason: UrlRejectReason, message: string): UrlCheck {
  return { ok: false, reason, message };
}

function ipv4ToInt(ip: string): number {
  return ip.split('.').reduce((acc, part) => (acc << 8) + Number(part), 0) >>> 0;
}

function inV4Range(ip: string, cidr: string): boolean {
  const [base, bitsRaw] = cidr.split('/');
  const bits = Number(bitsRaw);
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return (ipv4ToInt(ip) & mask) === (ipv4ToInt(base) & mask);
}

const PRIVATE_V4_RANGES = [
  '0.0.0.0/8',
  '10.0.0.0/8',
  '100.64.0.0/10',
  '127.0.0.0/8',
  '169.254.0.0/16',
  '172.16.0.0/12',
  '192.0.0.0/24',
  '192.0.2.0/24',
  '192.88.99.0/24',
  '192.168.0.0/16',
  '198.18.0.0/15',
  '198.51.100.0/24',
  '203.0.113.0/24',
  '224.0.0.0/4',
  '240.0.0.0/4',
  '255.255.255.255/32',
];

/** True for loopback, private, link-local (incl. 169.254.169.254 metadata), CGNAT, multicast, reserved. */
export function isPrivateAddress(address: string): boolean {
  const ip = address.trim().replace(/^\[|\]$/g, '');
  const family = net.isIP(ip);
  if (family === 4) {
    return PRIVATE_V4_RANGES.some((range) => inV4Range(ip, range));
  }
  if (family === 6) {
    const lower = ip.toLowerCase();
    const mapped = lower.match(/^(?:0{0,4}:){0,5}(?:0{0,4}:)?ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateAddress(mapped[1]);
    if (lower === '::' || lower === '::1') return true;
    const first = parseInt(lower.split(':')[0] || '0', 16);
    if ((first & 0xfe00) === 0xfc00) return true; // fc00::/7 unique local
    if ((first & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
    if ((first & 0xff00) === 0xff00) return true; // ff00::/8 multicast
    if (lower.startsWith('2001:db8') || lower.startsWith('2001:0db8')) return true;
    if (lower.startsWith('64:ff9b:')) return true; // NAT64 can front private v4
    if (lower.startsWith('fd00:ec2::254')) return true;
    return false;
  }
  return true;
}

function isBlockedHostname(host: string): boolean {
  const h = host.toLowerCase().replace(/\.$/, '');
  if (BLOCKED_HOSTS.has(h)) return true;
  if (BLOCKED_HOST_SUFFIXES.some((s) => (s.startsWith('.') ? h.endsWith(s) : h === s))) return true;
  if (!h.includes('.') && net.isIP(h) === 0) return true;
  return false;
}

/**
 * Syntactic validation + normalization (no network).
 * Accepts bare domains; only http/https on default ports; no credentials.
 */
export function normalizeAuditUrl(raw: unknown): UrlCheck {
  if (typeof raw !== 'string' || !raw.trim()) return reject('empty', 'Enter your website URL.');
  let input = raw.trim();
  if (input.length > MAX_URL_LENGTH) return reject('too_long', 'That URL is too long.');
  if (/^[a-z][a-z0-9+.-]*:/i.test(input) && !/^https?:\/\//i.test(input)) {
    return reject('protocol', 'Only http and https websites can be audited.');
  }
  if (!/^https?:\/\//i.test(input)) input = `https://${input}`;

  let parsed: URL;
  try {
    parsed = new URL(input);
  } catch {
    return reject('invalid', 'That does not look like a valid website URL.');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return reject('protocol', 'Only http and https websites can be audited.');
  }
  if (parsed.username || parsed.password) {
    return reject('credentials', 'URLs with embedded credentials are not allowed.');
  }
  if (parsed.port && parsed.port !== '80' && parsed.port !== '443') {
    return reject('port', 'Only websites on standard ports can be audited.');
  }
  const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');
  if (!host) return reject('invalid', 'That does not look like a valid website URL.');
  if (net.isIP(host)) {
    if (isPrivateAddress(host)) {
      return reject('private_address', 'Private and internal addresses cannot be audited.');
    }
  } else {
    if (isBlockedHostname(host)) {
      return reject('host', 'Internal hostnames cannot be audited.');
    }
    if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(host) || !/[a-z]/i.test(host.split('.').pop() || '')) {
      return reject('invalid', 'That does not look like a valid website URL.');
    }
  }
  parsed.hash = '';
  parsed.hostname = host;
  return { ok: true, url: parsed.toString(), host: host.replace(/^www\./, '') };
}

type ResolveFn = (host: string) => Promise<Array<{ address: string; family: number }>>;

const defaultResolve: ResolveFn = (host) =>
  dns.promises.lookup(host, { all: true, verbatim: true });

/** Resolve a hostname and require that every address is public. */
export async function assertPublicHost(host: string, resolve: ResolveFn = defaultResolve) {
  if (net.isIP(host)) {
    if (isPrivateAddress(host)) throw new UnsafeUrlError('private_address');
    return [{ address: host, family: net.isIP(host) }];
  }
  let addresses: Array<{ address: string; family: number }>;
  try {
    addresses = await resolve(host);
  } catch {
    throw new UnsafeUrlError('dns');
  }
  if (!addresses.length) throw new UnsafeUrlError('dns');
  if (addresses.some((a) => isPrivateAddress(a.address))) {
    throw new UnsafeUrlError('private_address');
  }
  return addresses;
}

export class UnsafeUrlError extends Error {
  constructor(public readonly code: string, message?: string) {
    super(message || `Unsafe URL (${code})`);
    this.name = 'UnsafeUrlError';
  }
}

export class FetchLimitError extends Error {
  constructor(public readonly code: 'timeout' | 'too_large' | 'content_type' | 'status' | 'redirects' | 'network', message: string) {
    super(message);
    this.name = 'FetchLimitError';
  }
}

const safeLookup: LookupFunction = (hostname, options, callback) => {
  assertPublicHost(hostname)
    .then((addresses) => {
      const wantAll = typeof options === 'object' && options && (options as dns.LookupOptions).all;
      if (wantAll) {
        (callback as unknown as (e: null, a: dns.LookupAddress[]) => void)(null, addresses);
      } else {
        callback(null, addresses[0].address, addresses[0].family);
      }
    })
    .catch((err) => callback(err as NodeJS.ErrnoException, '', 0));
};

export type SafeFetchResult = {
  url: string;
  status: number;
  contentType: string;
  body: string;
  /** True when the response exceeded maxBytes and only a prefix was kept. */
  truncated: boolean;
};

export type SafeFetchOptions = {
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
  accept?: RegExp;
  /** Some storefronts (Shopify) rate-limit agents containing "bot"; research passes a browser agent. */
  userAgent?: string;
};

const DEFAULT_ACCEPT = /^(text\/html|application\/xhtml\+xml)/i;

type RequestOnceResult = {
  status: number;
  location: string | null;
  contentType: string;
  body: string;
  truncated: boolean;
};

function requestOnce(
  target: URL,
  opts: Required<SafeFetchOptions>,
  deadline: number
): Promise<RequestOnceResult> {
  return new Promise((resolve, reject) => {
    const lib = target.protocol === 'https:' ? https : http;
    const remaining = Math.max(1, deadline - Date.now());
    const req = lib.request(
      target,
      {
        method: 'GET',
        lookup: safeLookup,
        headers: {
          'User-Agent': opts.userAgent,
          Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.1',
          'Accept-Encoding': 'identity',
        },
        timeout: remaining,
      },
      (res) => {
        const status = res.statusCode || 0;
        const location = typeof res.headers.location === 'string' ? res.headers.location : null;
        const contentType = String(res.headers['content-type'] || '');
        if (status >= 300 && status < 400) {
          res.resume();
          resolve({ status, location, contentType, body: '', truncated: false });
          return;
        }
        if (status < 200 || status >= 300) {
          res.resume();
          reject(new FetchLimitError('status', `Website responded with HTTP ${status}`));
          return;
        }
        if (!opts.accept.test(contentType)) {
          res.resume();
          reject(new FetchLimitError('content_type', `Unsupported content type: ${contentType || 'unknown'}`));
          return;
        }
        // Large ecommerce pages (Shopify etc.) often exceed the cap. Keep a
        // prefix for brand extraction instead of failing the whole audit.
        const chunks: Buffer[] = [];
        let size = 0;
        let truncated = false;
        let settled = false;
        const finish = () => {
          if (settled) return;
          settled = true;
          resolve({
            status,
            location,
            contentType,
            body: Buffer.concat(chunks).toString('utf8'),
            truncated,
          });
        };
        res.on('data', (chunk: Buffer) => {
          if (settled) return;
          const room = opts.maxBytes - size;
          if (room <= 0) {
            truncated = true;
            res.destroy();
            finish();
            return;
          }
          if (chunk.length > room) {
            chunks.push(chunk.subarray(0, room));
            size += room;
            truncated = true;
            res.destroy();
            finish();
            return;
          }
          chunks.push(chunk);
          size += chunk.length;
        });
        res.on('end', () => finish());
        res.on('error', (err) => {
          // destroy() after a deliberate truncate often emits an error — ignore it.
          if (settled && truncated) return;
          if (settled) return;
          reject(new FetchLimitError('network', err.message));
        });
      }
    );
    const hardStop = setTimeout(() => {
      req.destroy(new FetchLimitError('timeout', 'Website took too long to respond'));
    }, remaining);
    req.on('close', () => clearTimeout(hardStop));
    req.on('timeout', () => {
      req.destroy(new FetchLimitError('timeout', 'Website took too long to respond'));
    });
    req.on('error', (err) => {
      if (err instanceof FetchLimitError || err instanceof UnsafeUrlError) reject(err);
      else reject(new FetchLimitError('network', err.message));
    });
    req.end();
  });
}

/**
 * GET an untrusted URL with SSRF protection, manual redirect validation,
 * an overall deadline, a byte cap, and content-type allow-listing.
 */
export async function safeFetchText(rawUrl: string, options: SafeFetchOptions = {}): Promise<SafeFetchResult> {
  const opts: Required<SafeFetchOptions> = {
    timeoutMs: options.timeoutMs ?? 10_000,
    maxBytes: options.maxBytes ?? 2 * 1024 * 1024,
    maxRedirects: options.maxRedirects ?? 4,
    accept: options.accept ?? DEFAULT_ACCEPT,
    userAgent: options.userAgent ?? 'SkalXAuditBot/1.0 (+https://skalx.ai)',
  };
  const deadline = Date.now() + opts.timeoutMs;
  let current = rawUrl;
  for (let hop = 0; hop <= opts.maxRedirects; hop++) {
    const check = normalizeAuditUrl(current);
    if (!check.ok) throw new UnsafeUrlError(check.reason, check.message);
    const target = new URL(check.url);
    if (Date.now() >= deadline) throw new FetchLimitError('timeout', 'Website took too long to respond');
    const result = await requestOnce(target, opts, deadline);
    if (result.status >= 300 && result.status < 400) {
      if (!result.location) throw new FetchLimitError('status', 'Redirect without location');
      current = new URL(result.location, target).toString();
      continue;
    }
    return {
      url: target.toString(),
      status: result.status,
      contentType: result.contentType,
      body: result.body,
      truncated: result.truncated,
    };
  }
  throw new FetchLimitError('redirects', 'Too many redirects');
}
