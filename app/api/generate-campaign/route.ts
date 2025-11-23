// app/api/generate-campaign/route.ts
import axios from "axios";
import sharp from "sharp";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabaseClient"; // adjust path if necessary

const NANO_API_KEY = process.env.NANO_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash-image";
const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const DEFAULT_INITIAL_CREDITS = Number(process.env.DEFAULT_INITIAL_CREDITS ?? 5);

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

function findImageReference(obj: any): { kind: "data" | "url" | null; value: string | null } {
  if (!obj || typeof obj !== "object") return { kind: null, value: null };
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    if (typeof v === "string") {
      if (v.startsWith("data:")) return { kind: "data", value: v };
      if (/^https?:\/\//.test(v) && /\.(png|jpe?g|webp|gif)(\?.*)?$/i.test(v)) return { kind: "url", value: v };
      if (/^https?:\/\//.test(v) && (v.includes("/outputs/") || v.includes("/generated/") || v.includes("/images/")))
        return { kind: "url", value: v };
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

function buildPromptFromInputs(body: any) {
  const parts: string[] = [];
  if (body.mode === "post") parts.push("Create a social media post visual and short caption.");
  else parts.push("Create a high impact ad visual suitable for feed and story placements.");

  if (body.campaignName) parts.push(`Campaign name: ${body.campaignName}`);
  if (body.postName) parts.push(`Post name: ${body.postName}`);
  if (body.objective) parts.push(`Objective: ${body.objective}`);
  if (Array.isArray(body.platforms) && body.platforms.length)
    parts.push(`Platforms: ${body.platforms.join(", ")}`);
  if (body.campaignType) parts.push(`Campaign type: ${body.campaignType}`);
  if (body.brandName) parts.push(`Brand: ${body.brandName}`);
  if (body.tagline) parts.push(`Tagline: ${body.tagline}`);
  if (body.tone) parts.push(`Tone of voice: ${body.tone}`);
  if (body.primaryCTA) parts.push(`Primary CTA: ${body.primaryCTA}`);
  if (body.description) parts.push(`Description: ${body.description}`);
  if (body.offerInfo) parts.push(`Offer: ${body.offerInfo}`);
  if (body.emotion) parts.push(`Vibe/emotion: ${body.emotion}`);
  if (body.ageRange && Array.isArray(body.ageRange))
    parts.push(`Age: ${body.ageRange[0]}-${body.ageRange[1]}`);
  if (body.gender) parts.push(`Gender target: ${body.gender}`);
  if (body.location) parts.push(`Location: ${body.location}`);
  if (body.interests) parts.push(`Interests: ${body.interests}`);
  if (body.budget) parts.push(`Budget: ${body.budget} (${body.budgetType || "daily"})`);
  if (body.startDate || body.endDate)
    parts.push(`Schedule: ${body.startDate || "start"} → ${body.endDate || "end"}`);

  const refUrls = Array.isArray(body.refUrls) ? body.refUrls : body.aiCustomization?.refUrls ?? [];
  if (refUrls && refUrls.length) {
    parts.push(
      `Reference images are provided. Use them as style and layout reference — keep overall brand feel, colors and composition inspired by them, but do not copy copyrighted elements exactly.`
    );
  }

  // IMPORTANT: removed "Use brand logo..." line to avoid Gemini drawing a second logo.
  // We now rely ONLY on server-side compositing with the uploaded/profile logo.

  const width = body.target?.width || 1080;
  const height = body.target?.height || 1080;
  parts.push(
    `Produce a clear, high-quality visual sized approximately ${width}×${height}. Center composition with good negative space for headline / CTA and keep text easily readable.`
  );

  return parts.filter(Boolean).join("\n\n");
}

function extractImageFromGeminiResponse(respJson: any): {
  kind: "inline" | "url" | null;
  data?: string;
  url?: string;
} {
  try {
    const candidates =
      respJson?.response?.candidates ??
      respJson?.candidates ??
      respJson?.result?.candidates ??
      respJson?.parts ??
      null;
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

    const topFiles =
      respJson?.files ?? respJson?.outputs ?? respJson?.generated_images ?? respJson?.images;
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

/** decode JWT payload (no verify) */
function decodeSupabaseJWT(token: string): any | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const payload = parts[1];
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

/** Try to extract an access token from cookies content (many shapes) */
function findTokenInCookies(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(";").map((p) => p.trim());
  // quick check for common names
  for (const name of [
    "sb-access-token",
    "sb:token",
    "supabase-auth-token",
    "sb_token",
    "sb_access_token",
  ]) {
    const kv = parts.find((p) => p.startsWith(`${name}=`));
    if (kv) {
      const val = kv.split("=").slice(1).join("=");
      // some cookies store JSON with access_token
      try {
        const parsed = JSON.parse(decodeURIComponent(val));
        if (parsed?.access_token) return parsed.access_token;
      } catch {}
      // try raw
      try {
        return decodeURIComponent(val);
      } catch {
        return val;
      }
    }
  }
  // fallback: scan all cookie values and try JSON parse for access_token keys
  for (const p of parts) {
    const idx = p.indexOf("=");
    if (idx === -1) continue;
    const val = p.slice(idx + 1);
    try {
      const parsed = JSON.parse(decodeURIComponent(val));
      if (parsed?.access_token) return parsed.access_token;
      if (parsed?.currentSession?.access_token) return parsed.currentSession.access_token;
    } catch {}
  }
  return null;
}

/** Get user from request (tries header, body.token, cookies, decode fallback) */
async function getUserFromRequest(request: Request, bodyToken?: string) {
  try {
    // 1) Authorization header (Bearer)
    const authHeader =
      request.headers.get("authorization") || request.headers.get("Authorization") || "";
    const m = authHeader?.match(/Bearer\s+(.+)/i);
    const headerToken = m ? m[1] : authHeader ? authHeader.trim() : null;

    // 2) cookie token
    const cookieHeader = request.headers.get("cookie") || null;
    const cookieToken = findTokenInCookies(cookieHeader);

    const token = headerToken || bodyToken || cookieToken || null;

    if (token) {
      // Try supabaseAdmin.auth.getUser for authoritative user object
      try {
        // @ts-ignore
        const { data } = await supabaseAdmin.auth.getUser(token);
        if ((data as any)?.user) return { user: (data as any).user, token };
      } catch (e) {
        // continue to decode fallback
        console.warn(
          "supabaseAdmin.auth.getUser failed (continuing to decode):",
          (e as any)?.message ?? e
        );
      }
      // fallback decode JWT
      const dec = decodeSupabaseJWT(token);
      if (dec) {
        const userId = dec.sub || dec.user_id || dec.id || dec.uid || null;
        if (userId) return { user: { id: String(userId) } as any, token };
      }
    }

    // No token found or couldn't resolve
    return { user: null, token: null };
  } catch (e) {
    console.warn("getUserFromRequest error", e);
    return { user: null, token: null };
  }
}

/** POST handler for app route */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) ?? {};

    const bodyToken = typeof body.token === "string" ? body.token : undefined;
    const { user, token } = await getUserFromRequest(request, bodyToken);

    if (!user || !user.id) {
      return NextResponse.json(
        { ok: false, error: "Authentication required. Please sign in." },
        { status: 401 }
      );
    }

    // Ensure user_credits row exists (optional: seed)
    let currentCredits: number | null = null;
    try {
      const { data: creditRow, error: creditError } = await supabaseAdmin
        .from("user_credits")
        .select("credits")
        .eq("id", user.id)
        .single();

      if (creditError && (creditError as any).code !== "PGRST116") {
        console.warn("user_credits lookup error", creditError);
      }

      if (creditRow && (creditRow as any).credits !== undefined) {
        currentCredits = Number((creditRow as any).credits);
      } else {
        // Optionally seed a default credits row if you want trial credits in production
        // comment out next block if you don't want automatic seeding
        try {
          const seed = DEFAULT_INITIAL_CREDITS;
          const { data: upserted, error: upsertError } = await supabaseAdmin
            .from("user_credits")
            .upsert({ id: user.id, credits: seed }, { onConflict: "id" })
            .select()
            .single();
          if (!upsertError && upserted && (upserted as any).credits !== undefined) {
            currentCredits = Number((upserted as any).credits);
            console.log(`Seeded user_credits for ${user.id} with ${seed} credits.`);
          } else {
            currentCredits = null;
          }
        } catch (e) {
          console.warn("Seed credits failed", e);
          currentCredits = null;
        }
      }
    } catch (e) {
      console.warn("credits lookup failed", e);
      currentCredits = null;
    }

    if (currentCredits === null) {
      return NextResponse.json(
        { ok: false, error: "No credits found for user. Please purchase credits." },
        { status: 402 }
      );
    }
    if (currentCredits <= 0) {
      return NextResponse.json(
        { ok: false, error: "No credits available. Please buy new credits to generate images." },
        { status: 402 }
      );
    }

    // --- generation logic ---
    const {
      vision,
      target = { width: 1080, height: 1080 },
      logoDataUrl,
      refDataUrls = [],
      aiCustomization = {},
    } = body;

    if (!vision && !body.description && !body.prompt) {
      return NextResponse.json(
        { ok: false, error: "Missing vision/description/prompt" },
        { status: 400 }
      );
    }
    if (!NANO_API_KEY)
      return NextResponse.json({ ok: false, error: "Server missing NANO_API_KEY" }, { status: 500 });

    // Upload inline logo/ref images to Supabase so Gemini can reference them (public URLs)
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

    const prompt = buildPromptFromInputs({ ...body, vision, aiCustomization: mergedAi, target });

    // map target width/height to aspect ratio
    const targetW = Number(target?.width || 1080);
    const targetH = Number(target?.height || 1080);
    let aspectRatio = "1:1";
    if (targetW && targetH) {
      const ratio = Math.round((targetW / targetH) * 1000) / 1000;
      const candidates = ["1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"];
      const numMap: Record<string, number> = {
        "1:1": 1.0,
        "2:3": 0.6667,
        "3:2": 1.5,
        "3:4": 0.75,
        "4:3": 1.3333,
        "4:5": 0.8,
        "5:4": 1.25,
        "9:16": 0.5625,
        "16:9": 1.7778,
        "21:9": 2.3333,
      };
      let best = "1:1";
      let bestDiff = Math.abs(numMap[best] - ratio);
      for (const c of candidates) {
        const d = Math.abs(numMap[c] - ratio);
        if (d < bestDiff) {
          best = c;
          bestDiff = d;
        }
      }
      aspectRatio = best;
    }

    // Build Gemini request parts: text + reference images as inline_data (only if provided)
    const parts: any[] = [{ text: prompt }];

    if (Array.isArray(refDataUrls) && refDataUrls.length) {
      let added = 0;
      for (const d of refDataUrls) {
        if (typeof d !== "string") continue;
        if (!d.startsWith("data:")) continue;
        const m = d.match(/^data:(.+);base64,(.+)$/);
        if (!m) continue;
        const mimeType = m[1];
        const base64Data = m[2];
        parts.push({
          inline_data: {
            mimeType,
            data: base64Data,
          },
        });
        added++;
        if (added >= 3) break; // limit to first 3 refs
      }
    }

    const payload: any = {
      contents: [{ parts }],
      generationConfig: {
        responseModalities: ["Image"],
        imageConfig: { aspectRatio },
        candidateCount: 1,
      },
    };

    const url = `${GEMINI_BASE}/${encodeURIComponent(GEMINI_MODEL)}:generateContent`;
    const headers: Record<string, string> = {
      "content-type": "application/json",
      accept: "application/json",
      "x-goog-api-key": NANO_API_KEY,
    };

    const createResp = await axios.post(url, payload, { headers }).catch((err) => {
      const r = err.response?.data ?? err.message;
      console.error("Gemini create error", r);
      throw new Error(`Gemini create failed: ${JSON.stringify(r)}`);
    });

    const createJson = createResp.data;

    let imageBuffer: Buffer | null = null;
    let foundSrc: string | null = null;

    const extracted = extractImageFromGeminiResponse(createJson);
    if (extracted.kind === "inline" && extracted.data) {
      const maybe = extracted.data;
      if (typeof maybe === "string" && maybe.startsWith("data:")) {
        imageBuffer = dataUrlToBuffer(maybe);
        foundSrc = maybe;
      } else {
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
      return NextResponse.json(
        {
          ok: false,
          error: "No image returned from Gemini (unable to extract).",
          rawGeminiResponse: createJson,
        },
        { status: 500 }
      );
    }

    // Composite logo (only from what you actually provided / profile; prompt no longer asks Gemini to draw a logo)
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

    const dataUrl = `data:image/png;base64,${finalBuffer.toString("base64")}`;

    // --- atomic decrement attempt ---
    let updatedCredits: number | null = null;
    try {
      // Try an atomic update via PostgREST: update where credits > 0 and return new credits.
      const { data: updatedRow, error: updateError } = await supabaseAdmin
        .from("user_credits")
        .update({ credits: (currentCredits ?? 0) - 1 })
        .eq("id", user.id)
        .gt("credits", 0)
        .select()
        .single();

      if (updateError) {
        // fallback: try RPC if available
        try {
          const { data: rpcData, error: rpcErr } = await supabaseAdmin.rpc(
            "decrement_user_credits",
            { p_user_id: user.id }
          );
          if (!rpcErr && rpcData) {
            if (typeof rpcData === "number") updatedCredits = rpcData;
            else if (Array.isArray(rpcData) && rpcData.length)
              updatedCredits = Number((rpcData[0] as any).credits ?? null);
            else if ((rpcData as any)?.credits !== undefined)
              updatedCredits = Number((rpcData as any).credits);
          } else {
            console.warn("Atomic decrement fallback rpc failed:", rpcErr);
          }
        } catch (e) {
          console.warn("rpc decrement failed", e);
        }
        console.warn("Failed to decrement user_credits via direct update:", updateError);
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
        return NextResponse.json(
          {
            ok: true,
            image: publicUrl ? publicUrl : dataUrl,
            images: [publicUrl ? publicUrl : dataUrl],
            dataUrl,
            savedPublicUrl: publicUrl ?? null,
            creditsRemaining: updatedCredits,
            credits_depleted: updatedCredits !== null ? updatedCredits <= 0 : undefined,
          },
          { status: 200 }
        );
      } catch (e) {
        console.warn("Temp upload failed", e);
      }
    }

    return NextResponse.json(
      {
        ok: true,
        image: dataUrl,
        images: [dataUrl],
        creditsRemaining: updatedCredits,
        credits_depleted: updatedCredits !== null ? updatedCredits <= 0 : undefined,
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("Generation endpoint error:", err);
    const message = err?.message || String(err);
    const extra = err?.response?.data ? { raw: err.response.data } : {};
    return NextResponse.json({ ok: false, error: message, ...extra }, { status: 500 });
  }
}
