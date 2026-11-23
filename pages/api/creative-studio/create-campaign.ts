// pages/api/creative-studio/create-campaign.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/auth/supabase/admin"; // Keep for storage operations
import { getUserIdFromRequest } from "@/auth/request";
import { CampaignDAO } from "@/database/models/Campaign.dao";
import { GeneratedImageDAO } from "@/database/models/GeneratedImage.dao";
import { safeFetch, IMAGE_CONTENT } from "@/lib/audit/url-safety";

/** Only plain image types are stored in the public bucket (no SVG/HTML). */
const SAFE_IMAGE_TYPES: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/jpg": "jpg", "image/webp": "webp" };

function dataUrlToBuffer(dataUrl: string) {
  const m = dataUrl.match(/^data:([^;,]+);base64,(.+)$/);
  if (!m) throw new Error("Invalid data URL");
  const mime = m[1].toLowerCase();
  if (!SAFE_IMAGE_TYPES[mime]) throw new Error("Unsupported image type");
  return { buffer: Buffer.from(m[2], "base64"), mime: mime === "image/jpg" ? "image/jpeg" : mime };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    // Get authenticated user ID using staging's auth helper
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      return res.status(401).json({ ok: false, error: "Authentication required" });
    }

    const { posterUrl, campaignName, objective, brandSnapshot, config, platforms } = req.body ?? {};

    if (!posterUrl || typeof posterUrl !== "string") {
      return res.status(400).json({ ok: false, error: "Missing posterUrl" });
    }

    if (!campaignName || typeof campaignName !== "string" || !campaignName.trim()) {
      return res.status(400).json({ ok: false, error: "Missing or invalid campaignName" });
    }

    if (/^data:/i.test(posterUrl) && !/^data:image\/(png|jpe?g|webp);base64,/i.test(posterUrl)) {
      return res.status(400).json({ ok: false, error: "Please use a PNG, JPG or WEBP image." });
    }
    let image_url = posterUrl;
    let image_path = "";

    // Upload poster to Supabase storage
    try {
      if (posterUrl.startsWith("data:")) {
        const { buffer, mime } = dataUrlToBuffer(posterUrl);
        const ext = SAFE_IMAGE_TYPES[mime];
        const safeName = campaignName
          .replace(/[^a-z0-9_\-]/gi, "_")
          .toLowerCase();
        const filename = `${userId}_${Date.now()}_${safeName}.${ext}`;
        const path = `campaigns/${userId}/${filename}`;

        const { error: uploadError } = await supabaseAdmin.storage
          .from("campaign-assets")
          .upload(path, buffer, {
            contentType: mime,
            cacheControl: "3600",
            upsert: false,
          });

        if (!uploadError) {
          image_path = path;
          const { data: publicData } = supabaseAdmin.storage
            .from("campaign-assets")
            .getPublicUrl(path);
          image_url = (publicData as any)?.publicUrl ?? posterUrl;
        } else {
          console.warn("Storage upload error:", uploadError);
        }
      } else if (posterUrl.startsWith("http")) {
        // Try to fetch and re-upload remote image
        try {
          const response = await safeFetch(posterUrl, { accept: IMAGE_CONTENT, maxBytes: 10 * 1024 * 1024 });
          const remoteType = (response.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
          if (response.ok && SAFE_IMAGE_TYPES[remoteType]) {
            const blob = new Blob([new Uint8Array(await response.arrayBuffer())], { type: remoteType === "image/jpg" ? "image/jpeg" : remoteType });
            const arrayBuffer = await blob.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            const ext = SAFE_IMAGE_TYPES[remoteType];
            const safeName = campaignName
              .replace(/[^a-z0-9_\-]/gi, "_")
              .toLowerCase();
            const filename = `${userId}_${Date.now()}_${safeName}.${ext}`;
            const path = `campaigns/${userId}/${filename}`;

            const { error: uploadError } = await supabaseAdmin.storage
              .from("campaign-assets")
              .upload(path, buffer, {
                contentType: blob.type || "image/png",
                cacheControl: "3600",
                upsert: false,
              });

            if (!uploadError) {
              image_path = path;
              const { data: publicData } = supabaseAdmin.storage
                .from("campaign-assets")
                .getPublicUrl(path);
              image_url = (publicData as any)?.publicUrl ?? posterUrl;
            } else {
              console.warn("Storage upload error (remote):", uploadError);
            }
          }
        } catch (e) {
          console.warn("Failed to fetch and upload remote image:", e);
          // Keep original URL if upload fails
        }
      }
    } catch (e) {
      console.warn("Image upload failed, using original URL:", e);
    }

    // Also record in user_generated_image
    try {
      await GeneratedImageDAO.insert(userId, image_url, image_path || null);
    } catch (e) {
      console.warn("Failed to record in user_generated_image:", e);
    }

    // Create campaign record
    try {
      const campaignData = await CampaignDAO.create({
        userId,
        name: campaignName.trim(),
        campaignType: "post",
        brandVoice: brandSnapshot?.tone || config?.theme || undefined,
        contentTypes: ["image"],
        vision: undefined,
        output: {
          images: [image_url],
        },
        imageUrl: [image_url],
        imagePath: [image_path],
        isPublished: false, // Campaigns from Creative Studio start as drafts
      });

      return res.status(200).json({
        ok: true,
        campaignId: campaignData.id,
        campaign: campaignData,
        imageUrl: image_url,
      });
    } catch (e: any) {
      console.error("Create campaign error:", e);
      return res.status(500).json({
        ok: false,
        error: `Failed to create campaign: ${e.message || "Unknown error"}`,
      });
    }
  } catch (err: any) {
    console.error("create-campaign error:", err);
    return res.status(500).json({
      ok: false,
      error: err.message || "Internal server error",
    });
  }
}
