// pages/api/publicize.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../../lib/supabaseClient"; // same style as your other server files

function dataUrlToBuffer(dataUrl: string) {
  const m = dataUrl.match(/^data:(.+);base64,(.+)$/);
  if (!m) throw new Error("Invalid data URL");
  return { buffer: Buffer.from(m[2], "base64"), mime: m[1] };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });
  try {
    const { dataUrl, filename } = req.body ?? {};
    if (!dataUrl || typeof dataUrl !== "string") return res.status(400).json({ ok: false, error: "Missing dataUrl" });

    const { buffer, mime } = dataUrlToBuffer(dataUrl);
    const ext = mime.split("/")[1] || "png";
    const safeName = filename ? filename.replace(/[^a-zA-Z0-9_.-]/g, "_") : `gen_${Date.now()}.${ext}`;
    const path = `generated/${Date.now()}_${safeName}`;

    const bucket = "campaign-assets";
    const up = await supabaseAdmin.storage.from(bucket).upload(path, buffer, {
      contentType: mime,
      cacheControl: "3600",
      upsert: false,
    });

    if (up.error) {
      console.error("supabase upload error", up.error);
      return res.status(500).json({ ok: false, error: up.error.message || up.error });
    }

    const pub = supabaseAdmin.storage.from(bucket).getPublicUrl(path);
    const publicUrl = (pub as any)?.data?.publicUrl ?? null;
    return res.status(200).json({ ok: true, publicUrl });
  } catch (err: any) {
    console.error("publicize error", err);
    return res.status(500).json({ ok: false, error: String(err) });
  }
}
