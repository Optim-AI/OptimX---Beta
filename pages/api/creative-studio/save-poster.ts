// pages/api/creative-studio/save-poster.ts
import { limitedPagesApi } from "@/lib/security/rate-limit";
import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/auth/supabase/admin";
import { getUserIdFromRequest } from "@/auth/request";
import { GeneratedImageDAO } from "@/database/models/GeneratedImage.dao";
import { safeFetch, IMAGE_CONTENT } from "@/lib/audit/url-safety";

/** Only plain image types are stored in the public bucket (no SVG/HTML). */
const SAFE_IMAGE_TYPES: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/jpg": "jpg", "image/webp": "webp" };

// Increase body size limit for large image data URLs (up to 10MB)
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

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
    if (!userId) return res.status(401).json({ ok: false, error: "Please sign in to save posters." });
  if (limitedPagesApi(req, res, "save-poster", 60, 60_000, userId)) return;
    const effectiveUserId = userId;
    
    const { imageUrl, name, metadata } = req.body ?? {};

    if (!imageUrl || typeof imageUrl !== "string") {
      return res.status(400).json({ ok: false, error: "Missing imageUrl" });
    }

    let uploadedPath = "";
    let publicUrl = imageUrl;

    // Upload image to Supabase storage if it's a data URL or needs to be stored
    if (/^data:/i.test(imageUrl) && !/^data:image\/(png|jpe?g|webp);base64,/i.test(imageUrl)) {
      return res.status(400).json({ ok: false, error: "Please use a PNG, JPG or WEBP image." });
    }
    if (imageUrl.startsWith("data:")) {
      try {
        const { buffer, mime } = dataUrlToBuffer(imageUrl);
        const ext = SAFE_IMAGE_TYPES[mime];
        const safeName = (name || "poster")
          .replace(/[^a-z0-9_\-]/gi, "_")
          .toLowerCase();
        const filename = `${effectiveUserId}_${Date.now()}_${safeName}.${ext}`;
        const path = `campaigns/${effectiveUserId}/${filename}`;

        const { error: uploadError } = await supabaseAdmin.storage
          .from("campaign-assets")
          .upload(path, buffer, {
            contentType: mime,
            cacheControl: "3600",
            upsert: false,
          });

        if (!uploadError) {
          uploadedPath = path;
          const { data: publicData } = supabaseAdmin.storage
            .from("campaign-assets")
            .getPublicUrl(path);
          publicUrl = (publicData as any)?.publicUrl ?? imageUrl;
        } else {
          console.warn("Storage upload error:", uploadError);
        }
      } catch (e) {
        console.warn("Failed to upload data URL:", e);
      }
    } else if (imageUrl.startsWith("http")) {
      // Try to fetch and re-upload remote image
      try {
        const response = await safeFetch(imageUrl, { accept: IMAGE_CONTENT, maxBytes: 10 * 1024 * 1024 });
        const remoteType = (response.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
        if (response.ok && SAFE_IMAGE_TYPES[remoteType]) {
          const blob = new Blob([new Uint8Array(await response.arrayBuffer())], { type: remoteType === "image/jpg" ? "image/jpeg" : remoteType });
          const arrayBuffer = await blob.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          const ext = SAFE_IMAGE_TYPES[remoteType];
          const safeName = (name || "poster")
            .replace(/[^a-z0-9_\-]/gi, "_")
            .toLowerCase();
          const filename = `${effectiveUserId}_${Date.now()}_${safeName}.${ext}`;
          const path = `campaigns/${effectiveUserId}/${filename}`;

          const { error: uploadError } = await supabaseAdmin.storage
            .from("campaign-assets")
            .upload(path, buffer, {
              contentType: blob.type || "image/png",
              cacheControl: "3600",
              upsert: false,
            });

          if (!uploadError) {
            uploadedPath = path;
            const { data: publicData } = supabaseAdmin.storage
              .from("campaign-assets")
              .getPublicUrl(path);
            publicUrl = (publicData as any)?.publicUrl ?? imageUrl;
          } else {
            console.warn("Storage upload error (remote):", uploadError);
          }
        }
      } catch (e) {
        console.warn("Failed to fetch and upload remote image:", e);
        // Keep original URL if upload fails
      }
    }

    // Insert into user_generated_image table (only if authenticated)
    if (userId) {
      try {
        // Use DAO to insert - it handles ID generation properly
        const record = await GeneratedImageDAO.insert(
          userId,
          publicUrl,
          uploadedPath || null,
          metadata || undefined
        );

        return res.status(200).json({
          ok: true,
          imageUrl: publicUrl,
          imagePath: uploadedPath,
          record: record,
        });
      } catch (e: any) {
        console.error("Save poster error:", e);
        // Don't fail the request if DB insert fails - image is still uploaded to storage
        console.warn("Continuing despite DB insert error - image uploaded to storage");
        return res.status(200).json({
          ok: true,
          imageUrl: publicUrl,
          imagePath: uploadedPath,
          record: null,
        });
      }
    } else {
      // No authenticated user - skip database insert but return success with uploaded image
      return res.status(200).json({
        ok: true,
        imageUrl: publicUrl,
        imagePath: uploadedPath,
        record: null,
        message: "Image saved to storage (database record skipped - authentication required for full tracking)",
      });
    }
  } catch (err: any) {
    console.error("save-poster error:", err);
    return res.status(500).json({
      ok: false,
      error: err.message || "Internal server error",
    });
  }
}
