/** Shared test pack types (browser-safe, no runtime deps). */
export type PackFormat = 'feed' | 'story';
export const PACK_FORMATS: PackFormat[] = ['feed', 'story'];

export const FORMAT_INFO: Record<PackFormat, { aspect: '4:5' | '9:16'; label: string; tests: string; nameSuffix: string }> = {
  feed: { aspect: '4:5', label: 'Feed (4:5)', tests: 'Facebook and Instagram feed', nameSuffix: 'Feed' },
  story: { aspect: '9:16', label: 'Stories & Reels (9:16)', tests: 'Stories and Reels', nameSuffix: 'Story' },
};

export type AngleSource = 'past_winner' | 'customer_voice' | 'competitor';
export type VariantCopy = { primary_text: string; headline: string };

export type PackAngle = {
  name: string;
  hook: string;
  message: string;
  insight: string;
  proof: string;
  audience: string;
  source: AngleSource;
  source_detail: string;
  what_it_tests: string;
  why_it_might_work: string;
  copy: Record<PackFormat, VariantCopy>;
};

export const ANGLES_PER_PACK = 3;
export const CREDITS_PER_VARIANT = 1;
export const variantCount = (angles: number) => angles * PACK_FORMATS.length;
