/**
 * Derive brand-intelligence cards from real BrandSnapshot fields only.
 * Never invent facts.
 */

import type { BrandSnapshot } from '@/app/web/src/components/creative-studio/types';

export type BrandInsightCard = {
  id: string;
  label: string;
  value: string;
};

function titleCaseList(items: string[]): string {
  return items
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 4)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(' · ');
}

export function buildBrandInsightCards(
  brand: BrandSnapshot | null,
  fallbackName?: string
): BrandInsightCard[] {
  if (!brand && !fallbackName) return [];
  const cards: BrandInsightCard[] = [];

  const name = (brand?.name || fallbackName || '').trim();
  if (name) {
    cards.push({ id: 'brand', label: 'Brand', value: name });
  }

  const product =
    brand?.productCategory?.trim() ||
    (typeof brand?.offering === 'string' ? brand.offering.split(',')[0]?.trim() : '') ||
    brand?.coreValueProp?.trim();
  if (product) {
    cards.push({ id: 'product', label: 'Product', value: product });
  }

  const aesthetic = brand?.brand_aesthetic?.filter(Boolean);
  if (aesthetic && aesthetic.length > 0) {
    cards.push({
      id: 'visual',
      label: 'Visual Direction',
      value: titleCaseList(aesthetic),
    });
  } else if (brand?.personality?.trim()) {
    cards.push({
      id: 'visual',
      label: 'Visual Direction',
      value: brand.personality.trim(),
    });
  }

  const toneArr = brand?.brand_tone?.filter(Boolean);
  const tone =
    (toneArr && toneArr.length > 0 && titleCaseList(toneArr)) ||
    brand?.tone?.trim() ||
    brand?.brandVoice?.trim();
  if (tone) {
    cards.push({ id: 'tone', label: 'Tone', value: tone });
  }

  const directionBits = [
    brand?.tagline?.trim(),
    brand?.coreValueProp?.trim(),
  ].filter(Boolean) as string[];
  if (directionBits.length > 0) {
    cards.push({
      id: 'creative',
      label: 'Creative Direction',
      value: directionBits[0],
    });
  } else if (brand?.audience?.trim()) {
    cards.push({
      id: 'creative',
      label: 'Creative Direction',
      value: `Built for ${brand.audience.trim()}`,
    });
  }

  return cards.slice(0, 5);
}
