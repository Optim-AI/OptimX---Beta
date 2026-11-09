/** SKX- ad names and ZIP file names. Meta Intelligence matches synced ads by this prefix. */
import { FORMAT_INFO, type PackFormat } from './types';

/** "Mango Pickle (500g)" → "MangoPickle500g", trimmed to maxLen on a word boundary. */
export function slugPart(input: string, maxLen = 24): string {
  const words = (input || '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/['’]/g, '')
    .replace(/[^A-Za-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1));
  let out = '';
  for (const w of words) {
    if ((out + w).length > maxLen) break;
    out += w;
  }
  return out || (words[0] ? words[0].slice(0, maxLen) : 'Item');
}

export function adNameFor(product: string, angle: string, format: PackFormat): string {
  return `SKX-${slugPart(product, 24)}-${slugPart(angle, 20)}-${FORMAT_INFO[format].nameSuffix}`;
}

/** Ad names for a pack; angles whose slugs collide get a number so every name is unique. */
export function adNamesForPack(product: string, angles: string[], formats: PackFormat[]): string[][] {
  const seen = new Map<string, number>();
  return angles.map((a) => {
    let slug = slugPart(a, 20);
    const n = (seen.get(slug) ?? 0) + 1;
    seen.set(slug, n);
    if (n > 1) slug = `${slug.slice(0, 18)}${n}`;
    return formats.map((f) => `SKX-${slugPart(product, 24)}-${slug}-${FORMAT_INFO[f].nameSuffix}`);
  });
}

export function extensionFor(contentType: string | null | undefined): string {
  if (/png/i.test(contentType || '')) return 'png';
  if (/webp/i.test(contentType || '')) return 'webp';
  return 'jpg';
}
