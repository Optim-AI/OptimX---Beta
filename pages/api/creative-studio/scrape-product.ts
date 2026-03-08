// pages/api/creative-studio/scrape-product.ts
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const { getUserIdFromRequest } = await import("@/auth/request");
  const userId = await getUserIdFromRequest(req);
  if (!userId) return res.status(401).json({ ok: false, error: "Authentication required" });

  try {
    const { url } = req.body;

    if (!url || typeof url !== "string") {
      return res.status(400).json({ ok: false, error: "Product URL is required" });
    }

    // Basic URL validation
    try {
      new URL(url);
    } catch {
      return res.status(400).json({ ok: false, error: "Invalid URL format" });
    }

    // For now, we'll use a simple scraping approach
    // In production, you might want to use a service like ScraperAPI, Bright Data, or similar
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    if (!response.ok) {
      return res.status(response.status).json({
        ok: false,
        error: `Failed to fetch product page: ${response.statusText}`,
      });
    }

    const html = await response.text();

    // Extract product information using regex patterns
    // This is a simplified version - in production, use a proper HTML parser like cheerio
    const productNameMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i) ||
      html.match(/<h1[^>]*>([^<]+)<\/h1>/i) ||
      html.match(/property="og:title"[^>]*content="([^"]+)"/i);

    const productName = productNameMatch ? productNameMatch[1].trim() : "Product";

    // Extract brand name from domain
    const domain = new URL(url).hostname.replace("www.", "");
    const brandName = domain.split(".")[0].charAt(0).toUpperCase() + domain.split(".")[0].slice(1);

    // Extract images - prioritize product images
    const imageUrls: string[] = [];
    
    // First, try to get og:image (usually the main product image)
    const ogImageMatch = html.match(/property="og:image"[^>]*content="([^"]+)"/i);
    if (ogImageMatch) {
      try {
        const ogImageUrl = ogImageMatch[1];
        if (ogImageUrl && !ogImageUrl.startsWith("data:")) {
          const fullUrl = ogImageUrl.startsWith("http") ? ogImageUrl : new URL(ogImageUrl, url).href;
          imageUrls.push(fullUrl);
        }
      } catch {
        // Skip invalid URL
      }
    }
    
    // Extract all images from the page
    const imageMatches = [
      ...html.matchAll(/<img[^>]*src="([^"]+)"[^>]*>/gi),
      ...html.matchAll(/<img[^>]*data-src="([^"]+)"[^>]*>/gi), // Lazy-loaded images
      ...html.matchAll(/<img[^>]*data-lazy-src="([^"]+)"[^>]*>/gi), // Another lazy-load pattern
    ];

    for (const match of imageMatches) {
      const imgUrl = match[1];
      if (imgUrl && !imgUrl.startsWith("data:") && !imgUrl.startsWith("//")) {
        try {
          const fullUrl = imgUrl.startsWith("http") ? imgUrl : new URL(imgUrl, url).href;
          
          // Filter out common non-product images
          const lowerUrl = fullUrl.toLowerCase();
          const skipPatterns = [
            'logo', 'icon', 'avatar', 'favicon', 'sprite', 'button', 'badge',
            'social', 'share', 'menu', 'nav', 'header', 'footer', 'banner',
            'placeholder', 'loading', 'spinner'
          ];
          
          // Skip if URL contains skip patterns (unless it's clearly a product image)
          const shouldSkip = skipPatterns.some(pattern => 
            lowerUrl.includes(pattern) && !lowerUrl.includes('product')
          );
          
          if (!shouldSkip && !imageUrls.includes(fullUrl)) {
            imageUrls.push(fullUrl);
          }
        } catch {
          // Skip invalid URLs
        }
      }
    }

    // Remove duplicates and limit to 10, prioritizing larger images (usually product images)
    const uniqueImages = Array.from(new Set(imageUrls)).slice(0, 10);

    // Fetch and convert images to data URLs (server-side to avoid CORS issues)
    const imageDataUrls: string[] = [];
    for (const imgUrl of uniqueImages.slice(0, 3)) {
      try {
        // Add timeout to prevent hanging
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

        const imgResponse = await fetch(imgUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Referer": url, // Some sites require referer
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (imgResponse.ok) {
          const contentType = imgResponse.headers.get("content-type");
          if (contentType && contentType.startsWith("image/")) {
            const imageBuffer = await imgResponse.arrayBuffer();
            const base64 = Buffer.from(imageBuffer).toString("base64");
            const dataUrl = `data:${contentType};base64,${base64}`;
            imageDataUrls.push(dataUrl);
          }
        }
      } catch (err) {
        console.error(`Failed to fetch image ${imgUrl}:`, err);
        // Continue with other images even if one fails
      }
    }

    // Simple category detection based on keywords
    const categoryKeywords: Record<string, string[]> = {
      food: ["food", "restaurant", "recipe", "cooking", "meal", "snack", "beverage"],
      fashion: ["clothing", "apparel", "fashion", "wear", "outfit", "dress", "shirt", "shoes"],
      electronics: ["electronics", "tech", "device", "phone", "laptop", "computer", "gadget"],
      beauty: ["beauty", "cosmetic", "makeup", "skincare", "perfume"],
      home: ["home", "furniture", "decor", "kitchen", "bedroom"],
    };

    const lowerHtml = html.toLowerCase();
    let detectedCategory = "general";
    for (const [cat, keywords] of Object.entries(categoryKeywords)) {
      if (keywords.some((kw) => lowerHtml.includes(kw))) {
        detectedCategory = cat;
        break;
      }
    }

    return res.status(200).json({
      ok: true,
      product: {
        product_name: productName,
        brand_name: brandName,
        product_images: imageDataUrls.length > 0 ? imageDataUrls : uniqueImages, // Return data URLs if available, otherwise URLs
        product_image_urls: uniqueImages, // Also return original URLs for reference
        category: detectedCategory,
      },
    });
  } catch (error: any) {
    console.error("Product scraping error:", error);
    return res.status(500).json({
      ok: false,
      error: error.message || "Failed to scrape product information",
    });
  }
}
