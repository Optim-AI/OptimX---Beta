/**
 * Fonts for code-rendered posters. Brand Kit families come from Google Fonts
 * as TTF (Satori reads TTF/OTF/WOFF, not WOFF2) and are cached in memory.
 * A bundled Noto Sans is the last-resort fallback so rendering never fails.
 */

import { readFileSync } from "fs";
import { join } from "path";
import opentype from "opentype.js";

export type LoadedFont = {
  family: string;
  weight: number;
  data: ArrayBuffer;
  font: opentype.Font;
  /** True when the requested family wasn't available and a fallback was used */
  fallback: boolean;
};

const cache = new Map<string, Promise<LoadedFont>>();

function toArrayBuffer(buf: Buffer): ArrayBuffer {
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}

/**
 * Next ships Noto Sans for next/og. Read it from disk at runtime (a require
 * would make webpack try to bundle the binary); next.config.ts adds it to the
 * serverless file trace for API routes.
 */
export const FALLBACK_FONT_PATH = "node_modules/next/dist/compiled/@vercel/og/noto-sans-v27-latin-regular.ttf";

function bundledFallback(weight: number): LoadedFont {
  const buf = readFileSync(join(process.cwd(), FALLBACK_FONT_PATH));
  const data = toArrayBuffer(buf);
  return { family: "Noto Sans", weight, data, font: opentype.parse(data), fallback: true };
}

export type FontFetcher = (url: string) => Promise<{ ok: boolean; text(): Promise<string>; arrayBuffer(): Promise<ArrayBuffer> }>;

/** Google Fonts CSS2 returns TTF URLs to clients that don't advertise WOFF2 support. */
async function fetchGoogleFont(family: string, weight: number, fetcher: FontFetcher): Promise<ArrayBuffer | null> {
  const url = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, "+")}:wght@${weight}`;
  const css = await fetcher(url);
  if (!css.ok) return null;
  const match = (await css.text()).match(/src:\s*url\(([^)]+)\)\s*format\('(?:truetype|opentype)'\)/);
  if (!match) return null;
  const file = await fetcher(match[1]);
  return file.ok ? file.arrayBuffer() : null;
}

/**
 * Load a font by family and weight. Falls back to the nearest weight, then
 * Inter, then the bundled Noto Sans. Never throws.
 */
export function loadFont(
  family: string | null | undefined,
  weight: number,
  fetcher: FontFetcher = (u) => fetch(u)
): Promise<LoadedFont> {
  const wanted = (family || "Inter").trim();
  const key = `${wanted.toLowerCase()}@${weight}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const p = (async () => {
    const attempts: Array<[string, number]> = [
      [wanted, weight],
      [wanted, weight >= 600 ? 700 : 400],
      ["Inter", weight],
    ];
    for (const [fam, w] of attempts) {
      try {
        const data = await fetchGoogleFont(fam, w, fetcher);
        if (data) {
          return { family: fam, weight: w, data, font: opentype.parse(data), fallback: fam !== wanted };
        }
      } catch {
        // try the next option
      }
    }
    return bundledFallback(weight);
  })();
  cache.set(key, p);
  return p;
}
