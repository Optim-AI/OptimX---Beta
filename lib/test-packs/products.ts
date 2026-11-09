/** The user's products from Ad Studio website scans, and a best guess of which product an ad is for. */
import { ContentStudioScanDAO } from '@/database/models/ContentStudioScan.dao';
import type { Product } from '@/app/web/src/components/creative-studio/types';

export type ProductRef = { id: string; product: Product };

export async function listUserProducts(userId: string): Promise<ProductRef[]> {
  const scans = await ContentStudioScanDAO.listByUser(userId, 10);
  const out: ProductRef[] = [];
  const seen = new Set<string>();
  for (const scan of scans) {
    const products = Array.isArray(scan.products) ? (scan.products as Product[]) : [];
    products.forEach((p, i) => {
      const key = (p?.product_name || '').trim().toLowerCase();
      if (!key || seen.has(key)) return;
      seen.add(key);
      out.push({ id: `${scan.id}:${i}`, product: p });
    });
  }
  return out;
}

export async function getUserProduct(userId: string, ref: string): Promise<Product | null> {
  const [scanId, idx] = ref.split(':');
  if (!scanId || idx === undefined) return null;
  const scan = await ContentStudioScanDAO.getByIdAndUser(scanId, userId);
  const products = Array.isArray(scan?.products) ? (scan!.products as Product[]) : [];
  return products[Number(idx)] ?? null;
}

const tokens = (s: string) => new Set((s.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase().match(/[a-z0-9]{3,}/g) ?? []).filter((t) => !['the', 'and', 'for', 'with', 'skx', 'feed', 'story', 'sale', 'off'].includes(t)));

/** Product whose name shares the most words with the ad's name / headline / text (or null). */
export function guessProductForAd(products: ProductRef[], adText: string): ProductRef | null {
  const ad = tokens(adText);
  let best: { ref: ProductRef; score: number } | null = null;
  for (const ref of products) {
    const name = tokens(ref.product.product_name);
    let score = 0;
    name.forEach((t) => { if (ad.has(t)) score++; });
    if (score > 0 && (!best || score > best.score)) best = { ref, score };
  }
  return best?.ref ?? null;
}
