// pages/api/generate-campaign.ts
import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";
import sharp from "sharp";
import { supabaseAdmin } from "../../lib/supabaseClient"; // must be server-side admin client

const LEO_API_KEY = process.env.LEO_API_KEY;
const LEONARDO_MODEL_ID = process.env.LEONARDO_MODEL_ID || "05ce0082-2d80-4a2d-8653-4d1c85e2418e";
const LEO_BASE = "https://cloud.leonardo.ai/api/rest/v1";

if (!LEO_API_KEY) {
  console.warn("LEO_API_KEY not set - Leonardo calls will fail.");
}

function dataUrlToBuffer(dataUrl: string) {
  const m = dataUrl.match(/^data:(.+);base64,(.+)$/);
  if (!m) throw new Error("Invalid data URL");
  return Buffer.from(m[2], "base64");
}

async function uploadBufferToSupabase(buffer: Buffer, path: string, contentType = "image/png") {
  const bucket = "campaign-assets";
  const { error } = await supabaseAdmin.storage.from(bucket).upload(path, buffer, {
    cacheControl: "3600",
    contentType,
    upsert: true,
  });
  if (error) throw error;
  const { data } = supabaseAdmin.storage.from(bucket).getPublicUrl(path);
  return (data as any)?.publicUrl ?? null;
}

async function fetchUrlToBuffer(url: string) {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Failed to fetch ${url}: ${resp.status}`);
  const arr = await resp.arrayBuffer();
  return Buffer.from(arr);
}

/** Try to find either a data: url or a http(s) url to an image recursively inside obj */
function findImageReference(obj: any): { kind: "data" | "url" | null; value: string | null } {
  if (!obj || typeof obj !== "object") return { kind: null, value: null };

  for (const k of Object.keys(obj)) {
    const v = obj[k];
    if (typeof v === "string") {
      if (v.startsWith("data:")) return { kind: "data", value: v };
      if (/^https?:\/\//.test(v) && /\.(png|jpe?g|webp|gif)(\?.*)?$/i.test(v)) return { kind: "url", value: v };
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

/** Build a concise prompt from incoming fields (no OpenAI used) */
function buildPrompt(body: any) {
  const parts: string[] = [];
  if (body.vision) parts.push(`Primary vision: ${body.vision}`);
  if (body.name) parts.push(`Campaign name: ${body.name}`);
  if (body.audience) parts.push(`Target audience: ${body.audience}`);
  if (body.campaignType) parts.push(`Campaign type: ${body.campaignType}`);
  if (body.brandVoice) parts.push(`Brand voice: ${body.brandVoice}`);
  if (Array.isArray(body.contentTypes) && body.contentTypes.length) {
    parts.push(`Content types: ${body.contentTypes.join(", ")}`);
  }
  if (body.aiCustomization?.colorPrimary || body.aiCustomization?.colorSecondary) {
    parts.push(`Brand colors: primary ${body.aiCustomization.colorPrimary || "unspecified"}, secondary ${body.aiCustomization.colorSecondary || "unspecified"}.`);
  }
  if (Array.isArray(body.aiCustomization?.refUrls) && body.aiCustomization.refUrls.length) {
    parts.push(`Reference images: ${body.aiCustomization.refUrls.join(", ")}. Use them as style references (match palette, lighting, overall look & feel). Do not copy copyrighted content exactly.`);
  }
  if (body.aiCustomization?.logoUrl) {
    parts.push(`Use brand logo at ${body.aiCustomization.logoUrl}. Place the logo in the bottom-right corner with clear padding. Do not overlap the main subject or headline text.`);
  }
  parts.push(`Produce a high-quality social media image suitable for ${body.target?.width || 1024}×${body.target?.height || 1024}. Keep central composition and negative space for headline text.`);

  return parts.filter(Boolean).join("\n\n");
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const body = req.body || {};
    const {
      vision,
      target = { width: 1024, height: 1024 },
      logoDataUrl,
      refDataUrls = [],
      aiCustomization = {},
      // note: we intentionally ignore client-side font/quality inputs per your request
    } = body;

    if (!vision) return res.status(400).json({ ok: false, error: "Missing vision" });
    if (!LEO_API_KEY) return res.status(500).json({ ok: false, error: "Server missing LEO_API_KEY" });

    // 1) upload provided data urls (logo / refs) to supabase so we have public urls to mention in prompt and to fetch later
    let logoPublicUrl: string | null = null;
    if (logoDataUrl && typeof logoDataUrl === "string" && logoDataUrl.startsWith("data:")) {
      try {
        const buf = dataUrlToBuffer(logoDataUrl);
        const safe = `temp/${Date.now()}_logo.png`;
        logoPublicUrl = await uploadBufferToSupabase(buf, safe, "image/png");
      } catch (e) {
        console.warn("logo upload failed", e);
      }
    } else if (aiCustomization?.logoUrl) {
      logoPublicUrl = aiCustomization.logoUrl;
    }

    const refPublicUrls: string[] = [];
    if (Array.isArray(refDataUrls) && refDataUrls.length) {
      for (let i = 0; i < refDataUrls.length; i++) {
        const d = refDataUrls[i];
        try {
          if (typeof d === "string" && d.startsWith("data:")) {
            const buf = dataUrlToBuffer(d);
            const safe = `temp/${Date.now()}_ref_${i}.png`;
            const p = await uploadBufferToSupabase(buf, safe, "image/png");
            if (p) refPublicUrls.push(p);
          }
        } catch (e) {
          console.warn("ref upload failed", e);
        }
      }
    } else if (Array.isArray(aiCustomization?.refUrls) && aiCustomization.refUrls.length) {
      for (const u of aiCustomization.refUrls) if (typeof u === "string") refPublicUrls.push(u);
    }

    // merge public urls into aiCustomization for prompt creation
    const merged = {
      ...aiCustomization,
      logoUrl: logoPublicUrl ?? aiCustomization?.logoUrl ?? null,
      refUrls: refPublicUrls.length ? refPublicUrls : aiCustomization?.refUrls ?? [],
    };

    // 2) build prompt
    const prompt = buildPrompt({ ...body, aiCustomization: merged });

    // 3) call Leonardo - use axios and the generation flow you showed
    const targetW = Number(target?.width || 1024);
    const targetH = Number(target?.height || 1024);

    const createPayload: any = {
      // minimal supported payload
      modelId: LEONARDO_MODEL_ID,
      prompt,
      width: targetW,
      height: targetH,
      num_images: 1,
      alchemy: false,
      ultra: false,
    };

    // include styleUUID if provided and looks okay
    if (merged.styleUUID) createPayload.styleUUID = merged.styleUUID;

    const headers = {
      accept: "application/json",
      "content-type": "application/json",
      authorization: `Bearer ${LEO_API_KEY}`,
    };

    const createResp = await axios.post(`${LEO_BASE}/generations`, createPayload, { headers }).catch((err) => {
      // toss the raw response into error for debugging
      const r = err.response?.data ?? err.message;
      console.error("Leonardo create error", r);
      throw new Error(`Leonardo create failed: ${JSON.stringify(r)}`);
    });

    const createJson = createResp.data;
    // The sample you gave saved generation id at response.data.sdGenerationJob.generationId
    const genId = createJson?.sdGenerationJob?.generationId ?? createJson?.id ?? createJson?.data?.id ?? null;

    // helper to attempt extracting an image right away
    async function tryExtract(obj: any) {
      const found = findImageReference(obj);
      if (found && found.value) {
        if (found.kind === "data") return { buffer: dataUrlToBuffer(found.value), src: found.value };
        if (found.kind === "url") {
          const b = await fetchUrlToBuffer(found.value);
          return { buffer: b, src: found.value };
        }
      }
      return null;
    }

    // try direct extraction first
    let imageBuffer: Buffer | null = null;
    let foundSrc: string | null = null;

    const direct = await tryExtract(createJson);
    if (direct) {
      imageBuffer = direct.buffer;
      foundSrc = direct.src!;
    }

    // if no direct image, poll using generation id
    if (!imageBuffer) {
      if (!genId) {
        console.error("createJson has no generation id and no direct image", createJson);
        return res.status(500).json({ ok: false, error: "No generation id and no image returned", rawLeonardoResponse: createJson });
      }

      const pollUrl = `${LEO_BASE}/generations/${encodeURIComponent(genId)}`;
      const start = Date.now();
      const timeoutMs = 60000; // poll for up to 60s
      const pollInterval = 1500;
      let lastRespJson: any = null;

      while (Date.now() - start < timeoutMs) {
        const pollResp = await axios.get(pollUrl, { headers }).catch((e) => {
          console.warn("poll error", e?.response?.data ?? e.message);
          return null;
        });
        if (!pollResp) {
          await new Promise((r) => setTimeout(r, pollInterval));
          continue;
        }
        lastRespJson = pollResp.data;

        const ext = await tryExtract(lastRespJson);
        if (ext) {
          imageBuffer = ext.buffer;
          foundSrc = ext.src!;
          break;
        }

        // some Leonardo responses list images in nested arrays
        const alt = lastRespJson?.generated_images ?? lastRespJson?.outputs ?? lastRespJson?.result ?? lastRespJson?.data ?? lastRespJson;
        const ext2 = await tryExtract(alt);
        if (ext2) {
          imageBuffer = ext2.buffer;
          foundSrc = ext2.src!;
          break;
        }

        // inspect status for failures
        const status = lastRespJson?.status ?? lastRespJson?.state ?? null;
        if (status && typeof status === "string" && /fail|error/i.test(String(status))) {
          console.error("Leonardo status indicates failure:", status, lastRespJson);
          return res.status(500).json({ ok: false, error: "Leonardo generation failed", rawLeonardoResponse: lastRespJson });
        }

        await new Promise((r) => setTimeout(r, pollInterval));
      }

      if (!imageBuffer) {
        console.error("Polling finished but no image found", lastRespJson ?? createJson);
        return res.status(500).json({
          ok: false,
          error: "No image returned from Leonardo (unable to extract).",
          rawLeonardoResponse: lastRespJson ?? createJson,
        });
      }
    }

    // 4) composite logo onto image (if available)
    let finalBuffer = imageBuffer!;
    const logoUrlToUse = logoPublicUrl ?? merged.logoUrl ?? null;
    if (logoUrlToUse) {
      try {
        const logoBuf = await fetchUrlToBuffer(logoUrlToUse);
        const meta = await sharp(finalBuffer).metadata();
        const gw = meta.width || targetW || 1024;
        const gh = meta.height || targetH || 1024;
        const logoTargetWidth = Math.max(60, Math.round(gw * 0.15));
        const resizedLogo = await sharp(logoBuf).resize({ width: logoTargetWidth }).png().toBuffer();
        const logoMeta = await sharp(resizedLogo).metadata();
        const padding = Math.round(gw * 0.03);
        const lx = Math.max(8, gw - (logoMeta.width || logoTargetWidth) - padding);
        const ly = Math.max(8, gh - (logoMeta.height || logoTargetWidth) - padding);

        // create white translucent background box for logo to avoid text overlap
        const bg = await sharp({
          create: {
            width: (logoMeta.width || logoTargetWidth) + 12,
            height: (logoMeta.height || logoTargetWidth) + 12,
            channels: 4,
            background: { r: 255, g: 255, b: 255, alpha: 0.9 },
          },
        })
          .png()
          .toBuffer();

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

    // 5) return data URL (client-side will store in idb or preview)
    const dataUrl = `data:image/png;base64,${finalBuffer.toString("base64")}`;
    return res.status(200).json({ ok: true, image: dataUrl, images: [dataUrl] });
  } catch (err: any) {
    console.error("Generation endpoint error:", err);
    const message = err?.message || String(err);
    // try to include response data if axios error
    const extra = err?.response?.data ? { raw: err.response.data } : {};
    return res.status(500).json({ ok: false, error: message, ...extra });
  }
}
