// pages/_app.tsx
import "../styles/globals.css";
import type { AppProps } from "next/app";
import * as React from "react";
import dynamic from "next/dynamic";
import Router from "next/router";
import AlertModal from "@/app/web/src/components/ui/AlertModal";

const LiquidGlassAnimator = dynamic(() => import("../app/web/src/components/LiquidGlassAnimator").then((m) => m.default), { ssr: false });

// System font stack - no network fetch during build (avoids Google Fonts failure in restricted environments)
const fontFamily = "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

export default function MyApp({ Component, pageProps }: AppProps) {
  // loading state: true during initial paint + during route changes
  const [loading, setLoading] = React.useState<boolean>(true);

  React.useEffect(() => {
    let initialTimer: number | undefined;

    // hide initial loader after a short delay if no navigation happens
    initialTimer = window.setTimeout(() => setLoading(false), 700);

    const handleStart = () => {
      // show loader on route change start
      setLoading(true);
      if (initialTimer) {
        clearTimeout(initialTimer);
        initialTimer = undefined;
      }
    };
    const handleComplete = () => {
      // hide loader on route change complete
      // small delay to avoid flash on very fast navigations
      window.setTimeout(() => setLoading(false), 180);
    };

    Router.events.on("routeChangeStart", handleStart);
    Router.events.on("routeChangeComplete", handleComplete);
    Router.events.on("routeChangeError", handleComplete);

    return () => {
      if (initialTimer) clearTimeout(initialTimer);
      Router.events.off("routeChangeStart", handleStart);
      Router.events.off("routeChangeComplete", handleComplete);
      Router.events.off("routeChangeError", handleComplete);
    };
  }, []);

  return (
    <>
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

        /* Full-page loader container */
        .global-loader-container {
          position: fixed;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #121212;
          z-index: 99999;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
        }

        /* The provided loader CSS (exact animation) */
        .loader {
          --r1: 154%;
          --r2: 68.5%;
          width: 60px;
          aspect-ratio: 1;
          border-radius: 50%;
          background: radial-gradient(var(--r1) var(--r2) at top, #0000 79.5%, #269af2 80%),
            radial-gradient(var(--r1) var(--r2) at bottom, #269af2 79.5%, #0000 80%),
            radial-gradient(var(--r1) var(--r2) at top, #0000 79.5%, #269af2 80%), #ccc;
          background-size: 50.5% 220%;
          background-position: -100% 0%, 0% 0%, 100% 0%;
          background-repeat: no-repeat;
          animation: l9 2s infinite linear;
        }

        @keyframes l9 {
          33% {
            background-position: 0% 33%, 100% 33%, 200% 33%;
          }
          66% {
            background-position: -100% 66%, 0% 66%, 100% 66%;
          }
          100% {
            background-position: 0% 100%, 100% 100%, 200% 100%;
          }
        }

        /* optional: reduced motion respect */
        @media (prefers-reduced-motion: reduce) {
          .loader {
            animation: none;
          }
        }
      `}</style>

      {/* Loader overlay */}
      {loading && (
        <div
          className="global-loader-container"
          aria-hidden={!loading}
          aria-busy={loading}
        >
          <div className="loader" />
        </div>
      )}

      {/* App content */}
      <main style={{ fontFamily }}>
        <Component {...pageProps} />
      </main>

      {/* Global alert/confirm modal */}
      <AlertModal />
    </>
  );
}
