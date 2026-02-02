// pages/api/creative-studio/fetch-logo.ts
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const { domain } = req.body;

    if (!domain || typeof domain !== "string") {
      return res.status(400).json({ ok: false, error: "Domain is required" });
    }

    // Clean domain (remove protocol, www, path)
    const cleanDomain = domain.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];

    // Try Brandfetch API first
    // Note: You'll need to add your Brandfetch API key to environment variables
    const BRANDFETCH_API_KEY = process.env.BRANDFETCH_API_KEY;
    
    if (BRANDFETCH_API_KEY) {
      try {
        const brandfetchResponse = await fetch(
          `https://api.brandfetch.io/v2/brands/${cleanDomain}`,
          {
            headers: {
              Authorization: `Bearer ${BRANDFETCH_API_KEY}`,
            },
          }
        );

        if (brandfetchResponse.ok) {
          const brandfetchData = await brandfetchResponse.json();
          const logo = brandfetchData.logo?.image || brandfetchData.icons?.[0]?.image;
          
          if (logo) {
            return res.status(200).json({
              ok: true,
              logo_url: logo,
              source: "brandfetch",
            });
          }
        }
      } catch (error) {
        console.log("Brandfetch API failed, trying fallback:", error);
      }
    }

    // Fallback to Clearbit Logo API
    try {
      const clearbitUrl = `https://logo.clearbit.com/${cleanDomain}`;
      // Add timeout to prevent hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
      }, 5000); // 5 second timeout
      
      try {
        const clearbitResponse = await fetch(clearbitUrl, {
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);

        if (clearbitResponse.ok && clearbitResponse.headers.get("content-type")?.startsWith("image/")) {
          // Convert to data URL
          const imageBuffer = await clearbitResponse.arrayBuffer();
          const base64 = Buffer.from(imageBuffer).toString("base64");
          const contentType = clearbitResponse.headers.get("content-type") || "image/png";
          const dataUrl = `data:${contentType};base64,${base64}`;

          return res.status(200).json({
            ok: true,
            logo_url: dataUrl,
            source: "clearbit",
          });
        }
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        // AbortError is expected when timeout occurs - don't log as error
        if (fetchError.name === 'AbortError' || fetchError.code === 'ABORT_ERR' || fetchError.code === 20) {
          // Timeout is expected - silently continue to next fallback
        } else {
          console.log("Clearbit API failed, trying favicon:", fetchError.message);
        }
        // Don't re-throw - let it fall through to next fallback
      }
    } catch (error: any) {
      // This catch handles the outer try block
      // Only log if it's not an expected AbortError
      if (error?.name !== 'AbortError' && error?.code !== 'ABORT_ERR' && error?.code !== 20) {
        console.log("Clearbit API failed, trying favicon:", error);
      }
    }

    // Last fallback: favicon
    try {
      const faviconUrl = `https://www.google.com/s2/favicons?domain=${cleanDomain}&sz=128`;
      // Add timeout to prevent hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
      }, 5000); // 5 second timeout
      
      try {
        const faviconResponse = await fetch(faviconUrl, {
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);

        if (faviconResponse.ok) {
          const imageBuffer = await faviconResponse.arrayBuffer();
          const base64 = Buffer.from(imageBuffer).toString("base64");
          const contentType = faviconResponse.headers.get("content-type") || "image/png";
          const dataUrl = `data:${contentType};base64,${base64}`;

          return res.status(200).json({
            ok: true,
            logo_url: dataUrl,
            source: "favicon",
          });
        }
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        // AbortError is expected when timeout occurs - don't log as error
        if (fetchError.name === 'AbortError' || fetchError.code === 'ABORT_ERR' || fetchError.code === 20) {
          // Timeout is expected - silently continue
        } else {
          console.log("Favicon fetch failed:", fetchError.message);
        }
        // Don't re-throw - let it fall through
      }
    } catch (error: any) {
      // This catch handles the outer try block
      // Only log if it's not an expected AbortError
      if (error?.name !== 'AbortError' && error?.code !== 'ABORT_ERR' && error?.code !== 20) {
        console.log("Favicon fetch failed:", error);
      }
    }

    // If all methods fail
    return res.status(404).json({
      ok: false,
      error: "Could not fetch logo from any source",
    });
  } catch (error: any) {
    console.error("Logo fetching error:", error);
    return res.status(500).json({
      ok: false,
      error: error.message || "Failed to fetch logo",
    });
  }
}
