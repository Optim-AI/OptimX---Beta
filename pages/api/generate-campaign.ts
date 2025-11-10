// pages/api/generate-campaign.ts
import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";
import sharp from "sharp";
import { supabaseAdmin } from "../../lib/supabaseClient"; // server admin client

const LEO_API_KEY = process.env.LEO_API_KEY;
const LEONARDO_MODEL_ID = process.env.LEONARDO_MODEL_ID || "de7d3faf-762f-48e0-b3b7-9d0ac3a3fcf3";
const LEO_BASE = "https://cloud.leonardo.ai/api/rest/v1";

if (!LEO_API_KEY) {
  console.warn("LEO_API_KEY not set - Leonardo calls will fail.");
}

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
  const { error } = await supabaseAdmin.storage.from(bucket).upload(path, buffer, {
    cacheControl: "3600",
    contentType,
    upsert: true,
  });
  if (error) throw error;
  const { data } = supabaseAdmin.storage.from(bucket).getPublicUrl(path);
  return (data as any)?.publicUrl ?? null;
}

/** Find image reference (same robust helper you had) */
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

/** Build a detailed prompt using the new inputs from UI */
function buildPromptFromInputs(body: any) {
  const parts: string[] = [];

  // generic
  if (body.mode === "post") parts.push("Create a social media post visual and short caption.");
  else parts.push("Create a high impact ad visual suitable for feed and story placements.");

  // campaign/post fields
  if (body.campaignName) parts.push(`Campaign name: ${body.campaignName}`);
  if (body.postName) parts.push(`Post name: ${body.postName}`);
  if (body.objective) parts.push(`Objective: ${body.objective}`);
  if (Array.isArray(body.platforms) && body.platforms.length) parts.push(`Platforms: ${body.platforms.join(", ")}`);
  if (body.campaignType) parts.push(`Campaign type: ${body.campaignType}`);
  if (body.brandName) parts.push(`Brand: ${body.brandName}`);
  if (body.tagline) parts.push(`Tagline: ${body.tagline}`);
  if (body.tone) parts.push(`Tone of voice: ${body.tone}`);
  if (body.primaryCTA) parts.push(`Primary CTA: ${body.primaryCTA}`);
  if (body.description) parts.push(`Description: ${body.description}`);
  if (body.offerInfo) parts.push(`Offer: ${body.offerInfo}`);
  if (body.emotion) parts.push(`Vibe/emotion: ${body.emotion}`);
  if (body.ageRange && Array.isArray(body.ageRange)) parts.push(`Age: ${body.ageRange[0]}-${body.ageRange[1]}`);
  if (body.gender) parts.push(`Gender target: ${body.gender}`);
  if (body.location) parts.push(`Location: ${body.location}`);
  if (body.interests) parts.push(`Interests: ${body.interests}`);
  if (body.budget) parts.push(`Budget: ${body.budget} (${body.budgetType || "daily"})`);
  if (body.startDate || body.endDate) parts.push(`Schedule: ${body.startDate || "start"} → ${body.endDate || "end"}`);

  // assets
  const refUrls = Array.isArray(body.refUrls) ? body.refUrls : body.aiCustomization?.refUrls ?? [];
  if (refUrls && refUrls.length) {
    parts.push(`Reference images: ${refUrls.join(", ")}. Use them as style reference — do not copy copyrighted elements exactly.`);
  }
  const logoCandidate = body.logoDataUrl ? "logo provided (inline)" : (body.aiCustomization?.logoUrl ?? body.logoUrl ?? null);
  if (logoCandidate) {
    parts.push(`Use brand logo (placed bottom-right with padding).`);
  }

  // final instruction
  const width = body.target?.width || 1080;
  const height = body.target?.height || 1080;
  parts.push(`Produce a clear, high-quality visual sized approximately ${width}×${height}. Center composition with negative space for headline / CTA.`);

  return parts.filter(Boolean).join("\n\n");
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const body = req.body ?? {};

    const {
      vision,
      target = { width: 1080, height: 1080 },
      logoDataUrl,
      refDataUrls = [],
      aiCustomization = {},
      // plus all the new inputs from client (campaignName, brandName, description, etc.)
    } = body;

    if (!vision && !body.description && !body.prompt) {
      return res.status(400).json({ ok: false, error: "Missing vision/description/prompt" });
    }
    if (!LEO_API_KEY) return res.status(500).json({ ok: false, error: "Server missing LEO_API_KEY" });

    // 1) upload any inline data-urls we received (logo/ref) so Leonardo can access them if needed
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
    } else if (body.logoUrl) {
      logoPublicUrl = body.logoUrl;
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
          } else if (typeof d === "string") {
            refPublicUrls.push(d);
          }
        } catch (e) {
          console.warn("ref upload failed", e);
        }
      }
    } else if (Array.isArray(aiCustomization?.refUrls) && aiCustomization.refUrls.length) {
      for (const u of aiCustomization.refUrls) if (typeof u === "string") refPublicUrls.push(u);
    }

    const mergedAi = {
      ...aiCustomization,
      logoUrl: logoPublicUrl ?? aiCustomization?.logoUrl ?? null,
      refUrls: refPublicUrls.length ? refPublicUrls : aiCustomization?.refUrls ?? [],
    };

    // Build prompt using all inputs
    const prompt = buildPromptFromInputs({ ...body, vision, aiCustomization: mergedAi, target });

    // Leonardo generate payload
    const targetW = Number(target?.width || 1080);
    const targetH = Number(target?.height || 1080);

    const createPayload: any = {
      modelId: LEONARDO_MODEL_ID,
      prompt,
      width: targetW,
      height: targetH,
      num_images: 1,
      alchemy: false,
      ultra: false,
    };

    if (mergedAi.styleUUID) createPayload.styleUUID = mergedAi.styleUUID;

    const headers = {
      accept: "application/json",
      "content-type": "application/json",
      authorization: `Bearer ${LEO_API_KEY}`,
    };

    // create generation
    const createResp = await axios.post(`${LEO_BASE}/generations`, createPayload, { headers }).catch((err) => {
      const r = err.response?.data ?? err.message;
      console.error("Leonardo create error", r);
      throw new Error(`Leonardo create failed: ${JSON.stringify(r)}`);
    });

    const createJson = createResp.data;
    const genId = createJson?.sdGenerationJob?.generationId ?? createJson?.id ?? createJson?.data?.id ?? null;

    // helper to extract image buffer from response shapes
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

    let imageBuffer: Buffer | null = null;
    let foundSrc: string | null = null;

    const direct = await tryExtract(createJson);
    if (direct) {
      imageBuffer = direct.buffer;
      foundSrc = direct.src!;
    }

    if (!imageBuffer) {
      if (!genId) {
        console.error("createJson has no generation id and no direct image", createJson);
        return res.status(500).json({ ok: false, error: "No generation id and no image returned", rawLeonardoResponse: createJson });
      }

      const pollUrl = `${LEO_BASE}/generations/${encodeURIComponent(genId)}`;
      const start = Date.now();
      const timeoutMs = 60_000;
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

        const alt = lastRespJson?.generated_images ?? lastRespJson?.outputs ?? lastRespJson?.result ?? lastRespJson?.data ?? lastRespJson;
        const ext2 = await tryExtract(alt);
        if (ext2) {
          imageBuffer = ext2.buffer;
          foundSrc = ext2.src!;
          break;
        }

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

    // Composite logo (if we have a public URL)
    let finalBuffer = imageBuffer!;
    const logoUrlToUse = mergedAi.logoUrl ?? null;
    if (logoUrlToUse) {
      try {
        const logoBuf = await fetchUrlToBuffer(logoUrlToUse);
        const meta = await sharp(finalBuffer).metadata();
        const gw = meta.width || targetW || 1080;
        const gh = meta.height || targetH || 1080;
        const logoTargetWidth = Math.max(60, Math.round(gw * 0.15));
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

    // Return the data URL; client stores in IDB/session for preview & finalization
    const dataUrl = `data:image/png;base64,${finalBuffer.toString("base64")}`;

    // Optionally: if caller asked for saving a temporary public copy, they could pass saveTemp: true
    if (body.saveTemp === true) {
      try {
        const buf = finalBuffer;
        const path = `temp/generated_${Date.now()}.png`;
        const publicUrl = await uploadBufferToSupabase(buf, path, "image/png");
        return res.status(200).json({ ok: true, image: publicUrl ? publicUrl : dataUrl, images: [publicUrl ? publicUrl : dataUrl], dataUrl, savedPublicUrl: publicUrl ?? null });
      } catch (e) {
        // ignore upload errors and return dataUrl
        console.warn("Temp upload failed", e);
      }
    }

    return res.status(200).json({ ok: true, image: dataUrl, images: [dataUrl] });
  } catch (err: any) {
    console.error("Generation endpoint error:", err);
    const message = err?.message || String(err);
    const extra = err?.response?.data ? { raw: err.response.data } : {};
    return res.status(500).json({ ok: false, error: message, ...extra });
  }
}
