// lib/supabaseClient.ts
import { createClient } from '@supabase/supabase-js';
import { NextApiRequest, NextApiResponse } from "next";
export const supabase = createClient(
  'https://lkrvwszeveupyqebxehq.supabase.co',         // e.g., https://xyz.supabase.co
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxrcnZ3c3pldmV1cHlxZWJ4ZWhxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY0NjEzMzEsImV4cCI6MjA3MjAzNzMzMX0.OHBB4AXCQSksIvBov3obN_hSKyyuo4nyRtAyOv0dTC0'       // found in your Supabase API settings
);


export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });

  const { campaignId, image: imageUrl, copy } = req.body;
  if (!campaignId) return res.status(400).json({ ok: false, error: "Missing campaignId" });

  try {
    // 1️⃣ Fetch the campaign to confirm ownership
    const { data: campaign, error } = await supabase
      .from("campaigns").select("user_id").eq("id", campaignId).single();
    if (error || !campaign) return res.status(404).json({ ok: false, error: "Campaign not found" });

    // 2️⃣ Download the generated image
    let publicUrl: string | null = null;
    if (imageUrl) {
      const fetched = await fetch(imageUrl);
      if (!fetched.ok) throw new Error("Failed to fetch image");
      const buffer = Buffer.from(await fetched.arrayBuffer());

      const path = `${campaign.user_id}/${campaignId}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from("campaign-images")
        .upload(path, buffer, {
          contentType: fetched.headers.get("content-type") || "image/jpeg",
          upsert: true
        });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("campaign-images").getPublicUrl(path);
      publicUrl = urlData.publicUrl;
    }

    // 3️⃣ Update the campaign row with final info
    const updates: any = {
      status: "published",
      updated_at: new Date().toISOString(),
      image_url: publicUrl || null, // Ensure image_url is either null or a valid string
      copy: copy || null // Ensure copy is either null or a valid string
    };

    const { error: updateError } = await supabase
      .from("campaigns").update(updates).eq("id", campaignId);
    if (updateError) throw updateError;

    return res.status(200).json({ ok: true, imageUrl: publicUrl });
  } catch (err: any) {
    console.error("publish error:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}