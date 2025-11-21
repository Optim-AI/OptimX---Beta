// pages/api/generate-campaign.ts
import type { NextApiRequest, NextApiResponse } from "next";
import axios from "axios";
import sharp from "sharp";
import { supabaseAdmin } from "../../lib/supabaseClient"; // server admin client

const NANO_API_KEY = process.env.NANO_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash-image";
const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

if (!NANO_API_KEY) {
  console.warn("NANO_API_KEY not set - Gemini calls will fail.");
}

/** Helpers **/
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

/** Find image reference (data: or urls) anywhere in an object (fallback) */
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

/** Build a detailed prompt using your UI inputs */
function buildPromptFromInputs(body: any) {
  const parts: string[] = [];

  if (body.mode === "post") parts.push("Create a social media post visual and short caption.");
  else parts.push("Create a high impact ad visual suitable for feed and story placements.");

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

  const refUrls = Array.isArray(body.refUrls) ? body.refUrls : body.aiCustomization?.refUrls ?? [];
  if (refUrls && refUrls.length) {
    parts.push(`Reference images: ${refUrls.join(", ")}. Use them as style reference — do not copy copyrighted elements exactly.`);
  }
  const logoCandidate = body.logoDataUrl ? "logo provided (inline)" : (body.aiCustomization?.logoUrl ?? body.logoUrl ?? null);
  if (logoCandidate) {
    parts.push(`Use brand logo (placed bottom-right with padding).`);
  }

  const width = body.target?.width || 1080;
  const height = body.target?.height || 1080;
  parts.push(`Produce a clear, high-quality visual sized approximately ${width}×${height}. Center composition with negative space for headline / CTA.`);

  return parts.filter(Boolean).join("\n\n");
}

/** Extract image from Gemini response (common shapes) */
function extractImageFromGeminiResponse(respJson: any): { kind: "inline" | "url" | null; data?: string; url?: string } {
  try {
    // candidates path: response.candidates[*].content.parts[*]
    const candidates = respJson?.response?.candidates ?? respJson?.candidates ?? respJson?.result?.candidates ?? respJson?.parts ?? null;
    if (Array.isArray(candidates) && candidates.length > 0) {
      for (const c of candidates) {
        const parts = c?.content?.parts ?? c?.content ?? c?.parts ?? null;
        if (Array.isArray(parts)) {
          for (const p of parts) {
            if (p?.inline_data?.data) return { kind: "inline", data: p.inline_data.data };
            if (p?.inlineData?.data) return { kind: "inline", data: p.inlineData.data };
            if (p?.files && Array.isArray(p.files) && p.files.length > 0) {
              const f = p.files[0];
              if (f?.data) return { kind: "inline", data: f.data };
              if (f?.uri) return { kind: "url", url: f.uri };
            }
            if (p?.data && typeof p.data === "string") {
              const s = p.data;
              if (s.startsWith("data:")) return { kind: "inline", data: s };
              return { kind: "inline", data: s };
            }
          }
        }
      }
    }

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
    // ignore
  }
  return { kind: null };
}

/** Helper: safely decode a Supabase JWT payload (no verification) */
function decodeSupabaseJWT(token: string): any | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;

    const payload = parts[1];
    // convert URL-safe base64 to normal + pad
    const base64 = payload
      .replace(/-/g, "+")
      .replace(/_/g, "/")
      .padEnd(payload.length + ((4 - (payload.length % 4)) % 4), "=");

    const json = Buffer.from(base64, "base64").toString("utf8");
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/** Robust user detection for NextApiRequest:
 *  - Authorization: Bearer <token>
 *  - Common cookie names (JSON or raw token)
 *  - JWT decode fallback to extract user id (non-verified)
 */
async function getUserFromRequest(req: NextApiRequest) {
  try {
    // 1) Authorization header
    const rawAuth = (req.headers.authorization || (req.headers as any).Authorization) as string | undefined;
    let token: string | null = null;
    if (rawAuth) {
      const m = rawAuth.match(/Bearer\s+(.+)/i);
      token = m ? m[1] : rawAuth.trim();
    }

    // 2) cookies (typical Supabase cookie names)
    if (!token && req.cookies) {
      const cookieCandidates = [
        "sb-access-token",
        "sb:token",
        "supabase-auth-token",
        "sb",
        "supabase-session",
        "sb-session",
      ];
      for (const name of cookieCandidates) {
        const val = req.cookies[name as string];
        if (!val) continue;
        // cookie might be JSON string with access_token
        try {
          const parsed = JSON.parse(val);
          if (parsed?.access_token) {
            token = parsed.access_token;
            break;
          }
          if (parsed?.currentSession?.access_token) {
            token = parsed.currentSession.access_token;
            break;
          }
          // some setups have nested shape: { provider_token: { access_token } } — best-effort:
          if (parsed?.provider_token?.access_token) {
            token = parsed.provider_token.access_token;
            break;
          }
        } catch {
          // not JSON — treat raw cookie value as token
          token = val;
          break;
        }
      }
    }

    if (!token) {
      return { user: null, token: null };
    }

    // 3) Try Supabase admin getUser (multiple shapes)
    try {
      // supabaseAdmin.auth.getUser(token) or getUser({ access_token: token })
      try {
        // @ts-ignore
        const { data } = await supabaseAdmin.auth.getUser(token);
        if ((data as any)?.user) return { user: (data as any).user, token };
      } catch {
        // fallback
        try {
          // @ts-ignore
          const { data } = await supabaseAdmin.auth.getUser({ access_token: token });
          if ((data as any)?.user) return { user: (data as any).user, token };
        } catch {
          // last fallback:
          try {
            // @ts-ignore
            const { data } = await (supabaseAdmin.auth as any).getUser?.({ access_token: token });
            if ((data as any)?.user) return { user: (data as any).user, token };
          } catch {}
        }
      }
    } catch (e) {
      // ignore and fallback to JWT decode
    }

    // 4) fallback: decode JWT to extract a user id (non-verified)
    const decoded = decodeSupabaseJWT(token);
    if (decoded) {
      const userId = decoded.sub || decoded.user_id || decoded.id || decoded.uid || null;
      if (userId) {
        return { user: { id: String(userId) } as any, token };
      }
    }

    return { user: null, token: null };
  } catch (e) {
    console.warn("getUserFromRequest error", e);
    return { user: null, token: null };
  }
}

/** Main handler **/
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    const body = req.body ?? {};

    // Attempt to identify user from Authorization header or cookies
    const { user, token } = await getUserFromRequest(req);

    if (!user || !user.id) {
      // Require signed-in user to consume credits
      console.warn("generate-campaign: unauthenticated request. headers:", {
        authHeader: !!req.headers.authorization,
        cookies: Object.keys(req.cookies || {}).slice(0, 20),
      });
      return res.status(401).json({ ok: false, error: "Authentication required. Please sign in." });
    }

    // Check credits
    const { data: creditRow, error: creditError } = await supabaseAdmin
      .from("user_credits")
      .select("credits")
      .eq("id", user.id)
      .single();

    if (creditError && creditError.code !== "PGRST116") {
      // PGRST116 = no rows? (PostgREST code varies), but just log other errors
      console.warn("user_credits lookup error", creditError);
    }

    const currentCredits = (creditRow && (creditRow as any).credits !== undefined) ? Number((creditRow as any).credits) : null;

    if (currentCredits === null) {
      // If no row exists, treat as zero credits (or you can choose to create default)
      return res.status(402).json({ ok: false, error: "No credits found for user. Please purchase credits." });
    }

    if (currentCredits <= 0) {
      return res.status(402).json({ ok: false, error: "No credits available. Please buy new credits to generate images." });
    }

    // --- continue with your existing generation logic ---
    const {
      vision,
      target = { width: 1080, height: 1080 },
      logoDataUrl,
      refDataUrls = [],
      aiCustomization = {},
      // other UI fields are read inside buildPromptFromInputs
    } = body;

    if (!vision && !body.description && !body.prompt) {
      return res.status(400).json({ ok: false, error: "Missing vision/description/prompt" });
    }
    if (!NANO_API_KEY) return res.status(500).json({ ok: false, error: "Server missing NANO_API_KEY" });

    // 1) upload inline logo/ref images to Supabase so Gemini can reference them (public URLs)
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

    // Build prompt
    const prompt = buildPromptFromInputs({ ...body, vision, aiCustomization: mergedAi, target });

    // map target width/height to an aspect ratio supported by Gemini
    const targetW = Number(target?.width || 1080);
    const targetH = Number(target?.height || 1080);
    let aspectRatio = "1:1"; // default
    if (targetW && targetH) {
      const ratio = Math.round((targetW / targetH) * 1000) / 1000;
      const candidates = ["1:1","2:3","3:2","3:4","4:3","4:5","5:4","9:16","16:9","21:9"];
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

    // Build Gemini payload (correct REST shape — imageConfig uses aspectRatio)
    const payload: any = {
      contents: [
        {
          parts: [
            { text: prompt },
          ],
        },
      ],
      generationConfig: {
        responseModalities: ["Image"],
        imageConfig: {
          aspectRatio,
        },
        candidateCount: 1,
      },
    };

    const url = `${GEMINI_BASE}/${encodeURIComponent(GEMINI_MODEL)}:generateContent`;
    const headers: Record<string, string> = {
      "content-type": "application/json",
      accept: "application/json",
      // Most examples use x-goog-api-key for a developer API key:
      "x-goog-api-key": NANO_API_KEY,
    };
    // If your key is a bearer token, replace above with:
    // headers["Authorization"] = `Bearer ${NANO_API_KEY}`; delete headers["x-goog-api-key"];

    // Call Gemini
    const createResp = await axios.post(url, payload, { headers }).catch((err) => {
      const r = err.response?.data ?? err.message;
      console.error("Gemini create error", r);
      throw new Error(`Gemini create failed: ${JSON.stringify(r)}`);
    });

    const createJson = createResp.data;

    // Try extracting image buffer
    let imageBuffer: Buffer | null = null;
    let foundSrc: string | null = null;

    // 1) Preferred extractor
    const extracted = extractImageFromGeminiResponse(createJson);
    if (extracted.kind === "inline" && extracted.data) {
      const maybe = extracted.data;
      if (typeof maybe === "string" && maybe.startsWith("data:")) {
        imageBuffer = dataUrlToBuffer(maybe);
        foundSrc = maybe;
      } else {
        // raw base64 or raw base64-like string
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

    // 2) fallback generic search
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
      return res.status(500).json({ ok: false, error: "No image returned from Gemini (unable to extract).", rawGeminiResponse: createJson });
    }

    // Composite logo (if we have a public URL)
    let finalBuffer = imageBuffer!;
    const logoUrlToUse = mergedAi.logoUrl ?? null;
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

    // After successful generation - consume 1 credit (best-effort)
    let updatedCredits: number | null = null;
    try {
      // compute new credits value (simple subtract approach)
      const newCredits = Math.max(0, (currentCredits ?? 0) - 1);
      const { data: updatedRow, error: updateError } = await supabaseAdmin
        .from("user_credits")
        .update({ credits: newCredits })
        .eq("id", user.id)
        .select()
        .single();

      if (updateError) {
        console.warn("Failed to update user_credits:", updateError);
      } else if (updatedRow && (updatedRow as any).credits !== undefined) {
        updatedCredits = Number((updatedRow as any).credits);
      }
    } catch (e) {
      console.warn("Credit decrement failed", e);
    }

    // Optionally save temporary public copy
    if (body.saveTemp === true) {
      try {
        const path = `temp/generated_${Date.now()}.png`;
        const publicUrl = await uploadBufferToSupabase(finalBuffer, path, "image/png");
        return res.status(200).json({
          ok: true,
          image: publicUrl ? publicUrl : dataUrl,
          images: [publicUrl ? publicUrl : dataUrl],
          dataUrl,
          savedPublicUrl: publicUrl ?? null,
          creditsRemaining: updatedCredits,
          credits_depleted: updatedCredits !== null ? updatedCredits <= 0 : undefined,
        });
      } catch (e) {
        console.warn("Temp upload failed", e);
      }
    }

    return res.status(200).json({
      ok: true,
      image: dataUrl,
      images: [dataUrl],
      creditsRemaining: updatedCredits,
      credits_depleted: updatedCredits !== null ? updatedCredits <= 0 : undefined,
    });
  } catch (err: any) {
    console.error("Generation endpoint error:", err);
    const message = err?.message || String(err);
    const extra = err?.response?.data ? { raw: err.response.data } : {};
    return res.status(500).json({ ok: false, error: message, ...extra });
  }
}
