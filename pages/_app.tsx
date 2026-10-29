// pages/_app.tsx
import "../styles/globals.css";
import type { AppProps } from "next/app";
import * as React from "react";
import dynamic from "next/dynamic";
import Head from "next/head";
import Router, { useRouter } from "next/router";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import AlertModal from "@/app/web/src/components/ui/AlertModal";
import { useSubscription } from "@/app/web/src/hooks/use-subscription";
import { shouldNoIndexPath, SITE_ORIGIN } from "@/lib/seo/site";

/** Stable absolute URLs for Google Search favicon discovery (non-www canonical origin). */
const FAVICON_PNG = `${SITE_ORIGIN}/icon-512.png`;
const FAVICON_ICO = `${SITE_ORIGIN}/favicon.ico`;
const APPLE_TOUCH_ICON = `${SITE_ORIGIN}/apple-touch-icon.png`;

import { IconMorphLoader } from "@/app/web/src/components/ui/loaders";
const LiquidGlassAnimator = dynamic(() => import("../app/web/src/components/LiquidGlassAnimator").then((m) => m.default), { ssr: false });

// System font stack - no network fetch during build (avoids Google Fonts failure in restricted environments)
const fontFamily = "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

export default function MyApp({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const noindex = shouldNoIndexPath(router.pathname);
  const [loading, setLoading] = React.useState<boolean>(false);

  // Rehydrate zustand persist only on the client (skipHydration) to avoid
  // SSR mismatch → Fast Refresh full-reload loops.
  React.useEffect(() => {
    void useSubscription.persist.rehydrate();
  }, []);

  React.useEffect(() => {
    let completeTimer: number | undefined;

    let startTimer: number | undefined;
    // Only for a different page that's slow to load: nothing for fast navigations, shallow
    // updates, or query/hash changes on the same page (e.g. after sign-in redirects).
    const SLOW_MS = 600;
    const handleStart = (url: string, opts?: { shallow?: boolean }) => {
      if (opts?.shallow) return;
      if (url.split(/[?#]/)[0] === window.location.pathname) return;
      if (completeTimer) { clearTimeout(completeTimer); completeTimer = undefined; }
      if (startTimer) clearTimeout(startTimer);
      startTimer = window.setTimeout(() => setLoading(true), SLOW_MS);
    };
    const handleComplete = () => {
      if (startTimer) { clearTimeout(startTimer); startTimer = undefined; }
      if (completeTimer) clearTimeout(completeTimer);
      completeTimer = window.setTimeout(() => setLoading(false), 120);
    };

    Router.events.on("routeChangeStart", handleStart);
    Router.events.on("routeChangeComplete", handleComplete);
    Router.events.on("routeChangeError", handleComplete);

    return () => {
      if (completeTimer) clearTimeout(completeTimer);
      if (startTimer) clearTimeout(startTimer);
      Router.events.off("routeChangeStart", handleStart);
      Router.events.off("routeChangeComplete", handleComplete);
      Router.events.off("routeChangeError", handleComplete);
    };
  }, []);

  return (
    <>
      {/* Favicon + default noindex for private/app routes (public pages set their own via PageSeo). */}
      <Head>
        <link rel="icon" href={FAVICON_ICO} sizes="any" />
        <link rel="icon" type="image/png" sizes="512x512" href={FAVICON_PNG} />
        <link rel="icon" type="image/png" sizes="192x192" href={`${SITE_ORIGIN}/icon-192.png`} />
        <link rel="icon" type="image/png" sizes="48x48" href={`${SITE_ORIGIN}/icon-48.png`} />
        <link rel="apple-touch-icon" sizes="180x180" href={APPLE_TOUCH_ICON} />
        {noindex ? <meta name="robots" content="noindex, nofollow" /> : null}
      </Head>

      {/* Liquid glass SVG filter - refraction + magnifying lens effect */}
      <svg aria-hidden width="0" height="0" style={{ position: 'absolute', left: 0, top: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        <defs>
          <filter id="liquid" x="-25%" y="-25%" width="150%" height="150%" colorInterpolationFilters="sRGB">
            <feTurbulence id="liquid-turbulence" type="fractalNoise" baseFrequency="0.006" numOctaves="5" result="noise" seed="15" />
            <feGaussianBlur in="noise" stdDeviation="0.5" result="smoothNoise" />
            <feGaussianBlur in="SourceGraphic" stdDeviation="0.08" result="blur" />
            {/* Water refraction */}
            <feDisplacementMap in="blur" in2="smoothNoise" scale="45" xChannelSelector="R" yChannelSelector="G" result="refracted">
              <animate attributeName="scale" from="45" to="58" dur="0.3s" begin="hero-liquid-trigger.mouseover" fill="freeze" />
              <animate attributeName="scale" from="58" to="45" dur="0.3s" begin="hero-liquid-trigger.mouseout" fill="freeze" />
            </feDisplacementMap>
            {/* Magnifying lens - radial bulge */}
            <feImage href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Cdefs%3E%3CradialGradient id='g' cx='50%25' cy='50%25' r='50%25'%3E%3Cstop offset='0%25' stop-color='%23808080'/%3E%3Cstop offset='100%25' stop-color='%23737373'/%3E%3C/radialGradient%3E%3C/defs%3E%3Crect width='100' height='100' fill='url(%23g)'/%3E%3C/svg%3E" result="magMap" x="0" y="0" width="1" height="1" preserveAspectRatio="none" />
            <feDisplacementMap in="refracted" in2="magMap" scale="8" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>
      </svg>
      <LiquidGlassAnimator />

      {/* Inline global styles: font-family + loader CSS */}
      <style jsx global>{`
        html {
          font-family: ${fontFamily};
        }

      `}</style>

      {/* Only for page loads that are actually slow (styles in globals.css) */}
      {loading && <IconMorphLoader label="Loading page" />}

      {/* App content */}
      <main style={{ fontFamily }}>
        <Component {...pageProps} />
      </main>

      {/* Global alert/confirm modal */}
      <AlertModal />

      <Analytics />
      <SpeedInsights />
    </>
  );
}
