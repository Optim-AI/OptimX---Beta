/**
 * Ads shown in the homepage showcase, each with its "Why this ad".
 * Findings here are illustrative examples for fictional brands (the UI labels them "Example").
 * Fictional brands only (or real brands with written permission). Phase 4's
 * scripts/generate-showcase.ts replaces these with fresh SkalX output.
 */
import { GENERATED_SHOWCASE, SHOWCASE_GENERATED_APPROVED } from './showcase.generated';

/** One asset written by scripts/generate-showcase.ts. */
export type GeneratedShowcaseItem = {
  id: string;
  brand: string;
  inputLink: string;
  format: string;
  aspect: '4:5' | '1:1' | '9:16';
  finding: string;
  angle: string;
  headline: string;
  image: string;
  video?: { mp4: string; webm: string };
  extraImages?: string[];
};

export type ShowcaseItem = {
  id: string;
  brand: string;
  format: string;
  image: string;
  /** Optional looping clip (mp4); `image` is its poster. */
  video?: string;
  aspect: '4/5' | '9/16' | '1/1';
  alt: string;
  why: {
    finding: string;
    angle: string;
  };
};

const STARTER_ITEMS: ShowcaseItem[] = [
  {
    id: 'crunchwell-feed',
    brand: 'Crunchwell (fictional)',
    format: 'Feed poster',
    image: '/images/samples/sample-feed-01.jpg',
    aspect: '4/5',
    alt: 'Feed ad for Crunchwell masala makhana, a fictional snack brand',
    why: {
      finding: 'Reviews of roasted snacks keep asking “is it actually healthy?”',
      angle: 'Lead with the ingredients list, not the flavour.',
    },
  },
  {
    id: 'tidal-lime-story',
    brand: 'Tidal Lime (fictional)',
    format: 'Story ad',
    image: '/images/samples/sample-story-01.jpg',
    aspect: '9/16',
    alt: 'Story ad for Tidal Lime sparkling soda, a fictional drinks brand',
    why: {
      finding: '3 of 4 competitors only show the can, never the moment.',
      angle: 'Show the drink in a hot-afternoon moment.',
    },
  },
  {
    id: 'skincare-video',
    brand: 'Skincare (fictional)',
    format: 'Video ad, 15s',
    image: '/videos/samples/sample-video-02.jpg',
    video: '/videos/samples/sample-video-02.mp4',
    aspect: '9/16',
    alt: 'Video ad: a morning skincare routine with a matching product range',
    why: {
      finding: 'Buyers say routines feel complicated.',
      angle: 'Show the whole routine in under 15 seconds.',
    },
  },
  {
    id: 'gift-box-video',
    brand: 'Tea & treats (fictional)',
    format: 'Video ad, 15s',
    image: '/videos/samples/sample-video-04.jpg',
    video: '/videos/samples/sample-video-04.mp4',
    aspect: '9/16',
    alt: 'Video ad: a tea tin, cookies and honey packed into one gift box',
    why: {
      finding: 'Reviews keep mentioning buying it as a gift.',
      angle: 'Sell the box as a finished gift, not the items.',
    },
  },
];

const ASPECT: Record<GeneratedShowcaseItem['aspect'], ShowcaseItem['aspect']> = { '4:5': '4/5', '1:1': '1/1', '9:16': '9/16' };

function fromGenerated(g: GeneratedShowcaseItem): ShowcaseItem {
  return {
    id: g.id,
    brand: g.brand,
    format: g.format,
    image: g.image,
    video: g.video?.mp4,
    aspect: ASPECT[g.aspect],
    alt: `${g.format} for ${g.brand}: ${g.headline}`,
    why: { finding: g.finding, angle: g.angle },
  };
}

const approvedGenerated = SHOWCASE_GENERATED_APPROVED ? GENERATED_SHOWCASE : [];

/** Showcase on the site: generated SkalX output once approved, else the starter samples. */
/** Up to `max` items, taken round-robin across brands so every brand shows. */
function mixAcrossBrands(items: GeneratedShowcaseItem[], max: number): GeneratedShowcaseItem[] {
  // Per brand: first poster, then the product video, then the rest.
  const rank = (g: GeneratedShowcaseItem) =>
    g.id.endsWith('/poster-1') ? 0 : g.video ? 1 : g.format.startsWith('Feed poster') ? 2 : g.format === 'Product photoshoot' ? 3 : 4;
  const byBrand = new Map<string, GeneratedShowcaseItem[]>();
  for (const g of [...items].sort((a, b) => rank(a) - rank(b))) {
    const key = g.id.split('/')[0];
    byBrand.set(key, [...(byBrand.get(key) ?? []), g]);
  }
  const queues = [...byBrand.values()];
  const out: GeneratedShowcaseItem[] = [];
  while (out.length < max && queues.some((q) => q.length)) {
    for (const q of queues) {
      const next = q.shift();
      if (next && out.length < max) out.push(next);
    }
  }
  return out;
}

export const SHOWCASE_ITEMS: ShowcaseItem[] = approvedGenerated.length
  ? mixAcrossBrands(approvedGenerated.filter((g) => !g.format.startsWith('UGC')), 8).map(fromGenerated)
  : STARTER_ITEMS;

/** UGC clips for the homepage UGC section (approved generated output only). */
export const UGC_CLIPS = approvedGenerated
  .filter((g) => g.format.startsWith('UGC') && g.video)
  .map((g) => ({ poster: g.image, mp4: g.video!.mp4, webm: g.video!.webm, label: `UGC-style video for ${g.brand}: ${g.headline}` }));
