// pages/api/creative-studio/create-campaign.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../../lib/supabaseClient";

function dataUrlToBuffer(dataUrl: string) {
  const m = dataUrl.match(/^data:(.+);base64,(.+)$/);
  if (!m) throw new Error("Invalid data URL");
  return { buffer: Buffer.from(m[2], "base64"), mime: m[1] };
}

async function getUserFromRequest(req: NextApiRequest): Promise<{ user: any; userId: string } | null> {
  // TEMPORARILY DISABLED: Auth check - return dummy user
  return { user: { id: "temp-user-id", email: "temp@example.com" }, userId: "temp-user-id" };
  
  // Original implementation (commented out):
  // const authHeader = req.headers.authorization;
  // if (!authHeader || !authHeader.startsWith("Bearer ")) {
  //   return null;
  // }

  // const token = authHeader.split(" ")[1];
  // try {
  //   const { data: userData, error } = await supabaseAdmin.auth.getUser(token);
  //   if (error || !userData?.user) {
  //     return null;
  //   }
  //   return { user: userData.user, userId: userData.user.id };
  // } catch (e) {
  //   console.error("getUserFromRequest error:", e);
  //   return null;
  // }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    // TEMPORARILY DISABLED: Auth check
    const auth = await getUserFromRequest(req);
    // if (!auth) {
    //   return res.status(401).json({ ok: false, error: "Authentication required" });
    // }

    const { userId } = auth || { userId: "temp-user-id" };
    const { posterUrl, campaignName, objective, brandSnapshot, config, platforms } = req.body ?? {};

    if (!posterUrl || typeof posterUrl !== "string") {
      return res.status(400).json({ ok: false, error: "Missing posterUrl" });
    }

    if (!campaignName || typeof campaignName !== "string" || !campaignName.trim()) {
      return res.status(400).json({ ok: false, error: "Missing or invalid campaignName" });
    }

    let image_url = posterUrl;
    let image_path = "";

    // Upload poster to Supabase storage
    try {
      if (posterUrl.startsWith("data:")) {
        const { buffer, mime } = dataUrlToBuffer(posterUrl);
        const ext = mime.split("/")[1] || "png";
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
          const response = await fetch(posterUrl);
          if (response.ok) {
            const blob = await response.blob();
            const arrayBuffer = await blob.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            const ext = blob.type?.split("/")[1] || "png";
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
      await supabaseAdmin.from("user_generated_image").insert([
        {
          user_id: userId,
          image_url: image_url,
          image_path: image_path || null,
          source: "creative-studio",
          metadata: {
            campaignName,
            objective,
            brand: brandSnapshot?.name,
            theme: config?.theme,
          },
        },
      ]);
    } catch (e) {
      console.warn("Failed to record in user_generated_image:", e);
    }

    // Create campaign record
    try {
      const campaignPayload = {
        user_id: userId,
        name: campaignName.trim(),
        campaign_type: "post",
        brand_voice: brandSnapshot?.tone || config?.theme || null,
        content_types: ["image"],
        vision: null,
        output: {
          images: [image_url],
        },
        image_url: [image_url],
        image_path: [image_path],
        is_published: false, // Campaigns from Creative Studio start as drafts
        objective: objective || "LINK_CLICKS",
        platforms: platforms || [],
        metadata: {
          source: "creative-studio",
          brandSnapshot: brandSnapshot || null,
          config: config || null,
        },
      };

      const { data: campaignData, error: campaignError } = await supabaseAdmin
        .from("campaigns")
        .insert([campaignPayload])
        .select()
        .single();

      if (campaignError) {
        console.error("Failed to create campaign:", campaignError);
        return res.status(500).json({
          ok: false,
          error: `Failed to create campaign: ${campaignError.message}`,
        });
      }

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

