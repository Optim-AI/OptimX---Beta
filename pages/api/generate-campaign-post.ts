// pages/api/generate-campaign-post.ts
import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";
import sharp from "sharp";
import { supabaseAdmin } from "../../lib/supabaseClient";

const NANO_API_KEY = process.env.NANO_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash-image";
const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

if (!NANO_API_KEY) console.warn("NANO_API_KEY not set");

/* --------------------- helpers --------------------- */
function dataUrlToBuffer(dataUrl: string) {
  const m = dataUrl.match(/^data:(.+);base64,(.+)$/);
  if (!m) throw new Error("Invalid data URL");
  return Buffer.from(m[2], "base64");
}
async function fetchUrlToBuffer(url: string) {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Failed to fetch ${url}: ${resp.status}`);
  const arr = await resp.arrayBuffer();
  return Buffer.from(arr);
}
async function uploadBufferToSupabase(buffer: Buffer, path: string, contentType = "image/png") {
  const bucket = "campaign-assets";
  const { error } = await supabaseAdmin.storage.from(bucket).upload(path, buffer, { cacheControl: "3600", contentType, upsert: true });
  if (error) throw error;
  const { data } = supabaseAdmin.storage.from(bucket).getPublicUrl(path);
  return (data as any)?.publicUrl ?? null;
}

/** Search for any data: or url image strings anywhere in an object (fallback) */
function findImageReference(obj: any): { kind: "data" | "url" | null; value: string | null } {
  if (!obj || typeof obj !== "object") return { kind: null, value: null };
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    if (typeof v === "string") {
      if (v.startsWith("data:")) return { kind: "data", value: v };
      if (/^https?:\/\//.test(v) && /\.(png|jpe?g|webp|gif)(\?.*)?$/i.test(v)) return { kind: "url", value: v };
      // generic url likely pointing to generated image location
      if (/^https?:\/\//.test(v) && (v.includes("/outputs/") || v.includes("/generated/") || v.includes("/images/"))) return { kind: "url", value: v };
    } else if (Array.isArray(v)) {
      for (const el of v) {
        if (typeof el === "string") {
          if (el.startsWith("data:")) return { kind: "data", value: el };
          if (/^https?:\/\//.test(el)) return { kind: "url", value: el };
        } else if (typeof el === "object") {
          const nested = findImageReference(el);
          if (nested.value) return nested;
        }
      }
    } else if (typeof v === "object") {
      const nested = findImageReference(v);
      if (nested.value) return nested;
    }
  }
  return { kind: null, value: null };
}

function buildPromptFromPostInputs(body: any) {
  const parts: string[] = [];
  parts.push("Create a single, high-quality social media image suitable for feed (square composition preferred).");
  if (body.postName) parts.push(`Post name: ${body.postName}`);
  if (body.brandName) parts.push(`Brand: ${body.brandName}`);
  if (body.prompt) parts.push(`Brief: ${body.prompt}`);
  if (body.hashtags) parts.push(`Hashtags: ${body.hashtags}`);
  if (body.tone) parts.push(`Tone: ${body.tone}`);
  parts.push("Center composition, leave negative space for a short headline/CTA. Do not include copyrighted logos unless provided.");
  return parts.join("\n\n");
}

/** Extract image from Gemini response (common shapes) */
function extractImageFromGeminiResponse(respJson: any): { kind: "inline" | "url" | null; data?: string; url?: string } {
  try {
    // Preferred path: response.candidates[0].content.parts[*].inline_data.data (or response.parts in SDK)
    const candidates = respJson?.response?.candidates ?? respJson?.candidates ?? respJson?.result?.candidates ?? respJson?.parts ?? null;
    if (Array.isArray(candidates) && candidates.length > 0) {
      // candidates can be array of objects with content.parts
      for (const c of candidates) {
        const parts = c?.content?.parts ?? c?.content ?? c?.parts ?? null;
        if (Array.isArray(parts)) {
          for (const p of parts) {
            // inline_data.data -> base64
            if (p?.inline_data?.data) return { kind: "inline", data: p.inline_data.data };
            // older/other shape: inlineData / inlineData.data
            if (p?.inlineData?.data) return { kind: "inline", data: p.inlineData.data };
            // files array: files[0].data or files[0].uri
            if (p?.files && Array.isArray(p.files) && p.files.length > 0) {
              const f = p.files[0];
              if (f?.data) return { kind: "inline", data: f.data };
              if (f?.uri) return { kind: "url", url: f.uri };
            }
            // top-level data field (some REST responses include "data": "<base64>")
            if (p?.data && typeof p.data === "string") {
              const s = p.data;
              if (s.startsWith("data:")) return { kind: "inline", data: s };
              // maybe raw base64
              return { kind: "inline", data: s };
            }
          }
        }
      }
    }

    // fallback to top-level arrays like outputs/files/images
    const topFiles = respJson?.files ?? respJson?.outputs ?? respJson?.generated_images ?? respJson?.images;
    if (Array.isArray(topFiles) && topFiles.length > 0) {
      const f = topFiles[0];
      if (typeof f === "string") {
        if (f.startsWith("data:")) return { kind: "inline", data: f };
        if (f.startsWith("http")) return { kind: "url", url: f };
      } else if (f?.data) {
        return { kind: "inline", data: f.data };
      } else if (f?.uri) {
        return { kind: "url", url: f.uri };
      }
    }
  } catch (e) {
    // swallow
  }
  return { kind: null };
}

/* --------------------- handler --------------------- */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); return res.status(405).json({ ok: false, error: "Method not allowed" }); }
  try {
    const body = req.body ?? {};
    const { postName, brandName, prompt, hashtags, tone, logoDataUrl, target = { width: 1080, height: 1080 } } = body;

    if (!prompt && !postName) return res.status(400).json({ ok: false, error: "Missing prompt or postName" });
    if (!NANO_API_KEY) return res.status(500).json({ ok: false, error: "Server missing NANO_API_KEY" });

    // Upload logo dataURL (if provided) so Gemini can reference public URL during generation or for watermarking later
    let logoPublicUrl: string | null = null;
    if (logoDataUrl && typeof logoDataUrl === "string" && logoDataUrl.startsWith("data:")) {
      try {
        const buf = dataUrlToBuffer(logoDataUrl);
        const safe = `temp/${Date.now()}_post_logo.png`;
        logoPublicUrl = await uploadBufferToSupabase(buf, safe, "image/png");
      } catch (e) {
        console.warn("logo upload failed", e);
      }
    }

    const merged = { postName, brandName, prompt, hashtags, tone, logoUrl: logoPublicUrl ?? null };

    // build prompt
    const finalPrompt = buildPromptFromPostInputs({ ...merged, prompt });

    // Determine aspect ratio for Gemini (Gemini supports specific aspect ratios; doc maps ratio -> px).
    // We prefer square for 1080x1080 target -> '1:1'
    const w = Number(target?.width || 1080);
    const h = Number(target?.height || 1080);
    let aspectRatio = "1:1";
    if (w && h) {
      const ratio = Math.round((w / h) * 1000) / 1000;
      // basic mapping to common allowed aspect ratios supported by Gemini (use nearest):
      const candidates = ["1:1","2:3","3:2","3:4","4:3","4:5","5:4","9:16","16:9","21:9"];
      // map candidate -> numeric
      const numMap: Record<string, number> = {
        "1:1": 1.0, "2:3": 0.6667, "3:2": 1.5, "3:4": 0.75, "4:3": 1.3333,
        "4:5": 0.8, "5:4": 1.25, "9:16": 0.5625, "16:9": 1.7778, "21:9": 2.3333
      };
      let best = "1:1";
      let bestDiff = Math.abs(numMap[best] - ratio);
      for (const c of candidates) {
        const d = Math.abs(numMap[c] - ratio);
        if (d < bestDiff) { best = c; bestDiff = d; }
      }
      aspectRatio = best;
    }

    // Build Gemini REST payload using correct fields:
    // generationConfig (REST examples show "generationConfig") with imageConfig.aspectRatio.
    const payload: any = {
      contents: [
        {
          parts: [
            {
              text: finalPrompt,
            },
          ],
        },
      ],
      generationConfig: {
        // ask for image output only (or include "Text" if you want interleaved text)
        responseModalities: ["Image"],
        // specify only aspectRatio (Gemini will pick a supported pixel size for that ratio)
        imageConfig: {
          aspectRatio,
        },
        // return 1 candidate
        candidateCount: 1,
      },
    };

    const url = `${GEMINI_BASE}/${encodeURIComponent(GEMINI_MODEL)}:generateContent`;
    const headers = {
      "content-type": "application/json",
      "x-goog-api-key": NANO_API_KEY, // many examples use this header for developer API keys
      accept: "application/json",
    };

    const createResp = await axios.post(url, payload, { headers }).catch((err) => {
      const r = err.response?.data ?? err.message;
      console.error("Gemini create error", r);
      throw new Error(`Gemini create failed: ${JSON.stringify(r)}`);
    });

    const createJson = createResp.data;

    // Try to extract image from response (several shapes are possible)
    let imageBuffer: Buffer | null = null;
    let foundSrc: string | null = null;

    // Preferred extraction
    const extracted = extractImageFromGeminiResponse(createJson);
    if (extracted.kind === "inline" && extracted.data) {
      // extracted.data could be entire data-url or raw base64
      const maybe = extracted.data;
      if (maybe.startsWith("data:")) {
        imageBuffer = dataUrlToBuffer(maybe);
        foundSrc = maybe;
      } else {
        // treat as base64
        imageBuffer = Buffer.from(maybe, "base64");
        foundSrc = `data:image/png;base64,${maybe}`;
      }
    } else if (extracted.kind === "url" && extracted.url) {
      try {
        imageBuffer = await fetchUrlToBuffer(extracted.url);
        foundSrc = extracted.url;
      } catch (e) {
        console.warn("Failed to fetch image url from Gemini response", e);
      }
    }

    // fallback generic search in response JSON
    if (!imageBuffer) {
      const direct = findImageReference(createJson);
      if (direct && direct.value) {
        if (direct.kind === "data") {
          imageBuffer = dataUrlToBuffer(direct.value);
          foundSrc = direct.value;
        } else if (direct.kind === "url") {
          try {
            imageBuffer = await fetchUrlToBuffer(direct.value);
            foundSrc = direct.value;
          } catch (e) {
            console.warn("Fallback fetch failed", e);
          }
        }
      }
    }

    if (!imageBuffer) {
      // give raw response for debugging to help adjust extractor
      return res.status(500).json({ ok: false, error: "No image returned from Gemini (unable to extract).", rawGeminiResponse: createJson });
    }

    // Composite logo (if provided)
    let finalBuffer = imageBuffer!;
    const logoUrlToUse = merged.logoUrl ?? null;
    if (logoUrlToUse) {
      try {
        const logoBuf = await fetchUrlToBuffer(logoUrlToUse);
        const meta = await sharp(finalBuffer).metadata();
        const gw = meta.width || 1024;
        const gh = meta.height || 1024;
        const logoTargetWidth = Math.max(60, Math.round(gw * 0.12));
        const resizedLogo = await sharp(logoBuf).resize({ width: logoTargetWidth }).png().toBuffer();
        const logoMeta = await sharp(resizedLogo).metadata();
        const padding = Math.round(gw * 0.03);
        const lx = Math.max(8, gw - (logoMeta.width || logoTargetWidth) - padding);
        const ly = Math.max(8, gh - (logoMeta.height || logoTargetWidth) - padding);

        const bg = await sharp({
          create: {
            width: (logoMeta.width || logoTargetWidth) + 12,
            height: (logoMeta.height || logoTargetWidth) + 12,
            channels: 4,
            background: { r: 255, g: 255, b: 255, alpha: 0.9 },
          },
        }).png().toBuffer();

        finalBuffer = await sharp(finalBuffer)
          .composite([
            { input: bg, left: lx - 6, top: ly - 6 },
            { input: resizedLogo, left: lx, top: ly },
          ])
          .png()
          .toBuffer();
      } catch (e) {
        console.warn("Logo composite failed; continuing with generated image", e);
        finalBuffer = imageBuffer!;
      }
    }

    const dataUrl = `data:image/png;base64,${finalBuffer.toString("base64")}`;

    if (body.saveTemp === true) {
      try {
        const path = `temp/generated_post_${Date.now()}.png`;
        const publicUrl = await uploadBufferToSupabase(finalBuffer, path, "image/png");
        return res.status(200).json({ ok: true, image: publicUrl ? publicUrl : dataUrl, images: [publicUrl ? publicUrl : dataUrl], dataUrl, savedPublicUrl: publicUrl ?? null });
      } catch (e) {
        console.warn("Temp upload failed", e);
      }
    }

    return res.status(200).json({ ok: true, image: dataUrl, images: [dataUrl] });
  } catch (err: any) {
    console.error("generate-campaign-post error:", err);
    const message = err?.message || String(err);
    const extra = err?.response?.data ? { raw: err.response.data } : {};
    return res.status(500).json({ ok: false, error: message, ...extra });
  }
}
