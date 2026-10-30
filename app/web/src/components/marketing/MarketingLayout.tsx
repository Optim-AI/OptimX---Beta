import React from 'react';
import Head from 'next/head';
import SiteNav from './SiteNav';
import SiteFooter from './SiteFooter';

/**
 * Light, editorial shell for the public marketing pages.
 * `_app` already renders the <main> landmark, so this uses a plain container.
 */
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="sx-page min-h-screen bg-paper font-body text-[17px] leading-normal text-ink antialiased">
      <style jsx global>{`
        html,
        body {
          background-color: var(--color-paper);
        }
      `}</style>
      <Head>
        <link rel="preload" href="/fonts/montserrat-latin-400-800.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preload" href="/fonts/poppins-latin-400.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
      </Head>
      <noscript>
        <style>{`.sx-reveal{opacity:1!important;transform:none!important}`}</style>
      </noscript>
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-3 focus:z-[60] focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-paper"
      >
        Skip to content
      </a>
      <SiteNav />
      <div id="content">{children}</div>
      <SiteFooter />
    </div>
  );
}
