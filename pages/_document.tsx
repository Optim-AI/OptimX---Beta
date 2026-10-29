import { Html, Head, Main, NextScript } from "next/document";

/** Sets the document language (accessibility + SEO); everything else is Next's default. */
export default function Document() {
  return (
    <Html lang="en">
      <Head />
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
