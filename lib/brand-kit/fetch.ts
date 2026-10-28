/**
 * SSRF-safe fetcher for Brand Kit extraction (public hosts only, size-capped).
 */

import { safeFetchText } from "@/lib/audit/url-safety";
import type { BrandFetchText } from "./extract";

export const safeBrandFetch: BrandFetchText = async (url, kind) => {
  const res = await safeFetchText(
    url,
    kind === "html"
      ? { timeoutMs: 12_000, maxBytes: 3 * 1024 * 1024 }
      : {
          timeoutMs: 6_000,
          maxBytes: 1024 * 1024,
          accept: /^(text\/css|text\/plain|application\/octet-stream)/i,
        }
  );
  if (res.status >= 400) {
    if (kind === "html") throw new Error(`Website responded with ${res.status}`);
    return null;
  }
  return { url: res.url, body: res.body };
};
