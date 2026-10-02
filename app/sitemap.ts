import type { MetadataRoute } from "next";
import { INDEXABLE_PATHS, SITE_ORIGIN, absoluteUrl } from "@/lib/seo/site";

/**
 * Sitemap of canonical, publicly indexable marketing/legal URLs only.
 * Private app, auth, billing, and internal routes are intentionally excluded.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  const entries: MetadataRoute.Sitemap = INDEXABLE_PATHS.map((path) => {
    const url = absoluteUrl(path);
    const isHome = path === "/";
    if (isHome) {
      return {
        url,
        lastModified,
        changeFrequency: "weekly",
        priority: 1,
      };
    }
    return {
      url,
      lastModified,
      changeFrequency: "monthly",
      priority: path === "/About" || path === "/Contact" ? 0.8 : 0.6,
    };
  });

  return entries.filter((entry) => entry.url.startsWith(SITE_ORIGIN));
}
