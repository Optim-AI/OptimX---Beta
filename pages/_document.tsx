import Document, { Html, Head, Main, NextScript } from "next/document";

/**
 * Site-wide document shell for the Pages Router.
 * Favicon link tags live here so every page (including `/`) declares a
 * crawlable, stable icon for browsers and Google Search.
 */
export default class SkalXDocument extends Document {
  render() {
    return (
      <Html lang="en">
        <Head>
          {/* Primary PNG (≥48px) — preferred for Google Search favicon eligibility */}
          <link
            rel="icon"
            type="image/png"
            sizes="512x512"
            href="/icon.png"
          />
          <link
            rel="icon"
            type="image/png"
            sizes="48x48"
            href="/favicon-48x48.png"
          />
          {/* Classic ICO fallback for older browsers / default /favicon.ico fetch */}
          <link rel="icon" href="/favicon.ico" sizes="any" />
          <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        </Head>
        <body>
          <Main />
          <NextScript />
        </body>
      </Html>
    );
  }
}
