import Head from "next/head";
import * as React from "react";
import {
  DEFAULT_DESCRIPTION,
  SITE_LOGO_URL,
  SITE_NAME,
  SITE_OG_IMAGE_URL,
  SITE_ORIGIN,
  SITE_SAME_AS,
  SITE_SUPPORT_EMAIL,
  absoluteUrl,
  buildPageTitle,
} from "@/lib/seo/site";

export type PageSeoProps = {
  title?: string;
  description?: string;
  /** Path only, e.g. `/About` — becomes absolute canonical on skalxai.app */
  path?: string;
  ogType?: "website" | "article";
  noindex?: boolean;
  /** Extra JSON-LD objects merged after Organization + WebSite when includeSiteGraph */
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
  /** Homepage (and shared shell) should emit Organization + WebSite graph once */
  includeSiteGraph?: boolean;
  ogImage?: string;
};

function organizationJsonLd() {
  return {
    "@type": "Organization",
    "@id": `${SITE_ORIGIN}/#organization`,
    name: SITE_NAME,
    url: `${SITE_ORIGIN}/`,
    logo: {
      "@type": "ImageObject",
      url: SITE_LOGO_URL,
    },
    email: SITE_SUPPORT_EMAIL,
    sameAs: [...SITE_SAME_AS],
  };
}

function websiteJsonLd() {
  return {
    "@type": "WebSite",
    "@id": `${SITE_ORIGIN}/#website`,
    name: SITE_NAME,
    url: `${SITE_ORIGIN}/`,
    description: DEFAULT_DESCRIPTION,
    publisher: { "@id": `${SITE_ORIGIN}/#organization` },
    inLanguage: "en",
  };
}

export function PageSeo({
  title,
  description = DEFAULT_DESCRIPTION,
  path = "/",
  ogType = "website",
  noindex = false,
  jsonLd,
  includeSiteGraph = false,
  ogImage = SITE_OG_IMAGE_URL,
}: PageSeoProps) {
  const fullTitle = buildPageTitle(title);
  const canonical = absoluteUrl(path);
  const robots = noindex ? "noindex, nofollow" : "index, follow";

  const graph: Record<string, unknown>[] = [];
  if (includeSiteGraph) {
    graph.push(organizationJsonLd(), websiteJsonLd());
  }
  if (jsonLd) {
    graph.push(...(Array.isArray(jsonLd) ? jsonLd : [jsonLd]));
  }

  const structuredData =
    graph.length > 0
      ? {
          "@context": "https://schema.org",
          "@graph": graph,
        }
      : null;

  return (
    <Head>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <meta name="robots" content={robots} />
      <meta name="googlebot" content={robots} />
      <link rel="canonical" href={canonical} />

      <meta property="og:type" content={ogType} />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonical} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:locale" content="en_US" />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />

      {structuredData ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
      ) : null}
    </Head>
  );
}

export default PageSeo;
