// pages/api/creative-studio/save-poster.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/auth/supabase/client";
import { getUserIdFromRequest } from "@/auth/request";
import { GeneratedImageDAO } from "@/database/models/GeneratedImage.dao";
import { randomUUID } from "crypto";

// Increase body size limit for large image data URLs (up to 10MB)
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

function dataUrlToBuffer(dataUrl: string) {
  const m = dataUrl.match(/^data:(.+);base64,(.+)$/);
  if (!m) throw new Error("Invalid data URL");
  return { buffer: Buffer.from(m[2], "base64"), mime: m[1] };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    // Get authenticated user ID using staging's auth helper
    const userId = await getUserIdFromRequest(req);
    const effectiveUserId = userId || randomUUID();
    
    const { imageUrl, name, metadata } = req.body ?? {};

    if (!imageUrl || typeof imageUrl !== "string") {
      return res.status(400).json({ ok: false, error: "Missing imageUrl" });
    }

    let uploadedPath = "";
    let publicUrl = imageUrl;

    // Upload image to Supabase storage if it's a data URL or needs to be stored
    if (imageUrl.startsWith("data:")) {
      try {
        const { buffer, mime } = dataUrlToBuffer(imageUrl);
        const ext = mime.split("/")[1] || "png";
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
        const response = await fetch(imageUrl);
        if (response.ok) {
          const blob = await response.blob();
          const arrayBuffer = await blob.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          const ext = blob.type?.split("/")[1] || "png";
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
