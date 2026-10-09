import type { MetadataRoute } from "next";
import { SITE_ORIGIN } from "@/lib/seo/site";

/**
 * Crawl rules for Google and other bots.
 * Favicon and public marketing assets must remain crawlable.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/auth/",
          "/admin/",
          "/dashboard",
          "/settings",
          "/welcome",
          "/try",
          "/login",
          "/subscribe",
          "/buy-credits",
          "/content-studio",
          "/creative-studio",
          "/creative-intelligence",
          "/brand-studio",
          "/create-campaign",
          "/analytics",
          "/image-library",
          "/generated-contents",
          "/library",
          "/integrations",
          "/integrationsGoogle",
          "/integrationsInstagram",
          "/integrationsbeta",
          "/integrationsnew",
          "/notifications",
          "/onboardingInfo",
          "/publish",
          "/report",
          "/test-billing",
          "/api-Docs",
          "/tutorials",
          "/insights",
          "/roadmap",
        ],
      },
    ],
    sitemap: `${SITE_ORIGIN}/sitemap.xml`,
    host: SITE_ORIGIN,
  };
}
