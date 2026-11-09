/**
 * Features that are built but not open to everyone yet. While off, the sidebar shows "Soon" and
 * the page sits behind a "Coming soon" card (like UGC Studio).
 *
 * Switched per environment in Vercel (and .env.local), so the demo/staging site can show them to
 * Meta's reviewers while skalxai.app keeps "Coming soon":
 *   NEXT_PUBLIC_AD_PERFORMANCE_LIVE=true
 *   NEXT_PUBLIC_TRENDS_LIVE=true
 * NEXT_PUBLIC_ values are built into the page, so redeploy after changing them. Unset = off.
 */
export const AD_PERFORMANCE_LIVE = process.env.NEXT_PUBLIC_AD_PERFORMANCE_LIVE === 'true';
export const TRENDS_LIVE = process.env.NEXT_PUBLIC_TRENDS_LIVE === 'true';
