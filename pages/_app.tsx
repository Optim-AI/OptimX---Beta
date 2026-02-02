// pages/_app.tsx
import "../styles/globals.css";
import type { AppProps } from "next/app";
import * as React from "react";
import Router from "next/router";
import { Poppins } from "next/font/google";
import { useRouter } from "next/router";

// <-- Adjust this import if your Layout is in a different spot
import Layout from "../app/web/src/components/Layout";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-poppins",
  display: "swap",
});

export default function MyApp({ Component, pageProps }: AppProps) {
  // loading state: true during initial paint + during route changes
  const [loading, setLoading] = React.useState<boolean>(true);
  const router = useRouter();

  const DASHBOARD_PREFIXES = [
    "/dashboard",
    "/create-campaign",
    "/analytics",
    "/brand",
    "/campaign-library",
    "/image-library",
    "/integrations",
    "/notifications",
    "/settings",
  ];

  function isDashboardRoute(pathname: string) {
    return DASHBOARD_PREFIXES.some(
      (p) => pathname === p || pathname.startsWith(p + "/")
    );
  }

  // allow pages to opt-out of the layout by setting `PageComponent.noLayout = true`
  const showLayout =
    !((Component as any).noLayout === true) &&
    isDashboardRoute(router.pathname);

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
      {/* Inline global styles: font-family + loader CSS */}
      <style jsx global>{`
        /* Apply Poppins globally */
        html {
          font-family: ${poppins.style.fontFamily}, system-ui, -apple-system,
            "Segoe UI", Roboto, "Helvetica Neue", Arial;
        }

        /* Full-page loader container */
        .global-loader-container {
          position: fixed;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #ffffff;
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

      {/* App content wrapped with Layout (unless page opts out) */}
     <main className={poppins.className}>
  {showLayout ? (
    <Layout>
      <Component {...pageProps} />
    </Layout>
  ) : (
    <Component {...pageProps} />
  )}
</main>
    </>
  );
}
