// pages/api/creative-studio/fetch-image.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { JSDOM } from "jsdom";

// Helper to convert relative URLs to absolute
function toAbsolute(base: string, src: string): string {
  try {
    return new URL(src, base).href;
  } catch {
    return src;
  }
}

// Scrape page to find product images
async function scrapeProductImage(url: string): Promise<string | null> {
  try {
    const resp = await fetch(url, {
      redirect: "follow",
      headers: { "User-Agent": "Mozilla/5.0 (compatible; OptimX/1.0)" },
    });
    
    if (!resp.ok) {
      throw new Error(`Failed to fetch page: ${resp.statusText}`);
    }

    const html = await resp.text();
    const dom = new JSDOM(html, { url });
    const doc = dom.window.document;

    // Try to get og:image first (usually the best product image)
    const ogImage =
      doc.querySelector('meta[property="og:image"]')?.getAttribute("content") ||
      doc.querySelector('link[rel="image_src"]')?.getAttribute("href") ||
      null;

    if (ogImage) {
      return toAbsolute(url, ogImage);
    }

    // Find all images and look for product images
    const imgs = Array.from(doc.querySelectorAll("img"))
      .map((el) => {
        // Try srcset first, then src
        const srcset = el.getAttribute("srcset");
        if (srcset) {
          // Extract the largest image from srcset
          const sources = srcset.split(",").map((s) => s.trim().split(" ")[0]);
          return sources[sources.length - 1] || el.getAttribute("src") || "";
        }
        return el.getAttribute("src") || "";
      })
      .filter(Boolean)
      .map((src) => toAbsolute(url, src));

    // Filter for product images (exclude logos, icons, small images)
    const productImages = imgs.filter((img) => {
      const lower = img.toLowerCase();
      // Exclude common non-product images
      if (
        /logo|icon|avatar|profile|banner|header|footer|button|badge/i.test(lower)
      ) {
        return false;
      }
      return true;
    });

    // Return the first product image, or fallback to first image
    return productImages[0] || imgs[0] || null;
  } catch (error: any) {
    console.error("Error scraping page:", error);
    return null;
  }
}

// Check if URL is a direct image URL
function isDirectImageUrl(url: string): boolean {
  const imageExtensions = /\.(jpg|jpeg|png|gif|webp|svg|bmp)(\?.*)?$/i;
  return imageExtensions.test(url);
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const { url } = req.body ?? {};
  if (!url || typeof url !== "string") {
    return res.status(400).json({ ok: false, error: "Missing or invalid URL" });
  }

  try {
    // Validate URL
    let urlObj: URL;
    try {
      urlObj = new URL(url);
    } catch (e) {
      return res.status(400).json({ ok: false, error: "Invalid URL format" });
    }
    
    if (!["http:", "https:"].includes(urlObj.protocol)) {
      return res.status(400).json({ ok: false, error: "Invalid URL protocol" });
    }

    let imageUrl = url;

    // If it's not a direct image URL, scrape the page to find product images
    if (!isDirectImageUrl(url)) {
      console.log("Scraping page to find product image:", url);
      const scrapedImageUrl = await scrapeProductImage(url);
      
      if (!scrapedImageUrl) {
        return res.status(404).json({
          ok: false,
          error: "Could not find any product images on this page",
        });
      }
      
      imageUrl = scrapedImageUrl;
      console.log("Found product image:", imageUrl);
    }

    // Fetch image from URL (server-side, no CORS issues)
    // Create timeout controller for 30 second timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const response = await fetch(imageUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; OptimX/1.0)",
        "Accept": "image/*",
      },
      signal: controller.signal,
    }).finally(() => {
      clearTimeout(timeoutId);
    });

    if (!response.ok) {
      return res.status(response.status).json({
        ok: false,
        error: `Failed to fetch image: ${response.statusText} (${response.status})`,
      });
    }

    // Check if it's actually an image
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.startsWith("image/")) {
      return res.status(400).json({
        ok: false,
        error: "URL does not point to an image",
        contentType,
      });
    }
    
    // Filter out unsupported image types (SVG, ICO, etc.) - Gemini doesn't support them
    const unsupportedTypes = [
      'image/svg+xml',
      'image/vnd.microsoft.icon',
      'image/x-icon',
      'image/ico',
    ];
    const normalizedContentType = contentType.toLowerCase().trim();
    if (unsupportedTypes.some(type => normalizedContentType.includes(type))) {
      return res.status(400).json({
        ok: false,
        error: `Unsupported image type: ${contentType}. Please use JPEG, PNG, GIF, or WebP.`,
      });
    }

    // Get image as buffer
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Convert to base64 data URL
    const base64 = buffer.toString("base64");
    const dataUrl = `data:${contentType};base64,${base64}`;

    return res.status(200).json({
      ok: true,
      dataUrl,
      contentType,
      size: buffer.length,
    });
  } catch (error: any) {
    console.error("Error fetching image from URL:", error);
    
    if (error.name === "AbortError" || error.name === "TimeoutError") {
      return res.status(408).json({ ok: false, error: "Request timeout - image took too long to fetch" });
    }
    
    if (error.message?.includes("Invalid URL")) {
      return res.status(400).json({ ok: false, error: "Invalid URL format" });
    }

    return res.status(500).json({
      ok: false,
      error: `Failed to fetch image: ${error.message || "Unknown error"}`,
    });
  }
}
