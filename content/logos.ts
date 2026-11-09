/**
 * Customer logos. Only entries with `permission: true` are rendered. While none are,
 * the proof strip shows the category chips instead.
 */
export type CustomerLogo = { name: string; src: string; width: number; height: number; permission: boolean };

export const LOGOS: CustomerLogo[] = [];

export const LOGO_FALLBACK = {
  label: 'Made for brands in',
  categories: ['Skincare', 'Food & Spices', 'Wellness', 'Fashion', 'Home'],
} as const;

export function permittedLogos(list: CustomerLogo[] = LOGOS): CustomerLogo[] {
  return list.filter((l) => l.permission);
}
