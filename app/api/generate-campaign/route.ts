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

/* ---------- Helpers ---------- */
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

/* Allowed Gemini aspect strings */
const ALLOWED_ASPECTS = [
  "1:1",
  "2:3",
  "3:2",
  "3:4",
  "4:3",
  "4:5",
  "5:4",
  "9:16",
  "16:9",
  "21:9",
];

function mapToAllowedAspect(width: number, height: number) {
  if (!width || !height) return "1:1";
  const ratio = width / height;
  const mapNum: Record<string, number> = {
    "1:1": 1.0,
    "2:3": 2 / 3,
    "3:2": 3 / 2,
    "3:4": 3 / 4,
    "4:3": 4 / 3,
    "4:5": 4 / 5,
    "5:4": 5 / 4,
    "9:16": 9 / 16,
    "16:9": 16 / 9,
    "21:9": 21 / 9,
  };
  let best = "1:1";
  let bestDiff = Math.abs(mapNum[best] - ratio);
  for (const a of ALLOWED_ASPECTS) {
    const d = Math.abs(mapNum[a] - ratio);
    if (d < bestDiff) {
      best = a;
      bestDiff = d;
    }
  }
  return best;
}

/* Build prompt — now explicitly asks Gemini to leave space for provided logo (bottom-right).
   It instructs NOT to invent/draw logos and to use the reference images for composition/style. */
function buildPromptFromInputs(body: any) {
  const parts: string[] = [];
  if (body.mode === "post") parts.push("Create a social media post visual and short caption.");
  else parts.push("Create a high impact ad visual suitable for feed and story placements.");

  if (body.campaignName) parts.push(`Campaign name: ${body.campaignName}`);
  if (body.postName) parts.push(`Post name: ${body.postName}`);
  if (body.objective) parts.push(`Objective: ${body.objective}`);
  if (Array.isArray(body.platforms) && body.platforms.length)
    parts.push(`Platforms: ${body.platforms.join(", ")}`);
  if (body.brandName) parts.push(`Brand: ${body.brandName}`);
  if (body.tagline) parts.push(`Tagline: ${body.tagline}`);
  if (body.tone) parts.push(`Tone of voice: ${body.tone}`);
  if (body.description) parts.push(`Description: ${body.description}`);
  if (body.offerInfo) parts.push(`Offer: ${body.offerInfo}`);
  if (body.theme) parts.push(`Design theme: ${body.theme}`);
  if (body.ageRange && Array.isArray(body.ageRange)) parts.push(`Age: ${body.ageRange[0]}-${body.ageRange[1]}`);
  if (body.gender) parts.push(`Gender target: ${body.gender}`);
  if (body.location) parts.push(`Location: ${body.location}`);
  if (body.interests) parts.push(`Interests: ${body.interests}`);
  if (body.budget) parts.push(`Budget: ${body.budget} (${body.budgetType || "daily"})`);
  if (body.startDate || body.endDate) parts.push(`Schedule: ${body.startDate || "start"} → ${body.endDate || "end"}`);

  // Reference images (public URLs) — encourage inspiration only.
  const refUrls: string[] = Array.isArray(body.refUrls) ? body.refUrls : body.aiCustomization?.refUrls ?? [];
  if (refUrls && refUrls.length) {
    parts.push(
      `Reference images (use as style/layout inspiration — color, composition, mood): ${refUrls.slice(0, 8).join(", ")}. Do not copy copyrighted elements verbatim.`
    );
  }

  // Crucial: if a logo is provided, instruct model to leave safe space and NOT to redraw logos.
  parts.push(
    "IF A LOGO IS PROVIDED: do NOT draw, invent, or sign the image with a logo. Instead, leave a clean safe area for a brand mark. Do not place essential text or focal content in that safe area."
  );

  const width = body.target?.width || 1080;
  const height = body.target?.height || 1080;
  const aspectLabel = body.aspectLabel || `${width}x${height}`;
  parts.push(`Produce a high-quality visual sized approximately ${width}×${height} (${aspectLabel}). Keep composition centered and leave safe space near edges for possible headline/CTA. Avoid putting essential text in the extreme corners.`);

  return parts.filter(Boolean).join("\n\n");
}

/* Extract image from Gemini response (robust) */
function extractImageFromGeminiResponse(respJson: any): { kind: "inline" | "url" | null; data?: string; url?: string } {
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

/* decode JWT payload (no verify) */
function decodeSupabaseJWT(token: string): any | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const payload = parts[1];
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/").padEnd(payload.length + ((4 - (payload.length % 4)) % 4), "=");
    const json = Buffer.from(base64, "base64").toString("utf8");
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/* try to extract access token from cookies */
function findTokenInCookies(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(";").map((p) => p.trim());
  for (const name of ["sb-access-token", "sb:token", "supabase-auth-token", "sb_token", "sb_access_token"]) {
    const kv = parts.find((p) => p.startsWith(`${name}=`));
    if (kv) {
      const val = kv.split("=").slice(1).join("=");
      try {
        const parsed = JSON.parse(decodeURIComponent(val));
        if (parsed?.access_token) return parsed.access_token;
      } catch {}
      try {
        return decodeURIComponent(val);
      } catch {
        return val;
      }
    }
  }
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

/* get user from request */
async function getUserFromRequest(request: Request, bodyToken?: string) {
  try {
    const authHeader = request.headers.get("authorization") || request.headers.get("Authorization") || "";
    const m = authHeader?.match(/Bearer\s+(.+)/i);
    const headerToken = m ? m[1] : authHeader ? authHeader.trim() : null;
    const cookieHeader = request.headers.get("cookie") || null;
    const cookieToken = findTokenInCookies(cookieHeader);
    const token = headerToken || bodyToken || cookieToken || null;

    if (token) {
      try {
        // @ts-ignore
        const { data } = await supabaseAdmin.auth.getUser(token);
        if ((data as any)?.user) return { user: (data as any).user, token };
      } catch (e) {
        console.warn("supabaseAdmin.auth.getUser failed (continuing to decode):", (e as any)?.message ?? e);
      }
      const dec = decodeSupabaseJWT(token);
      if (dec) {
        const userId = dec.sub || dec.user_id || dec.id || dec.uid || null;
        if (userId) return { user: { id: String(userId) } as any, token };
      }
    }
    return { user: null, token: null };
  } catch (e) {
    console.warn("getUserFromRequest error", e);
    return { user: null, token: null };
  }
}

/* ---------- Utility: pick placement cell with lowest texture ---------- */
async function chooseQuietCellAndStats(mainBuffer: Buffer) {
  // Downscale to small greyscale version and compute variance per 3x3 cell
  try {
    const thumbLimit = 300; // smaller for speed but enough to detect texture
    const thumb = await sharp(mainBuffer).resize({ width: thumbLimit, height: thumbLimit, fit: "inside" }).greyscale().raw().toBuffer({ resolveWithObject: true });
    const buf = thumb.data;
    const w = thumb.info.width;
    const h = thumb.info.height;
    const cols = 3;
    const rows = 3;
    const cellW = Math.floor(w / cols);
    const cellH = Math.floor(h / rows);

    let best = { r: 0, c: 0, variance: Number.POSITIVE_INFINITY, mean: 0 };
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        let sum = 0;
        let sumSq = 0;
        let count = 0;
        const sx = c * cellW;
        const sy = r * cellH;
        const ex = c === cols - 1 ? w : sx + cellW;
        const ey = r === rows - 1 ? h : sy + cellH;
        for (let y = sy; y < ey; y++) {
          const rowOffset = y * w;
          for (let x = sx; x < ex; x++) {
            const v = buf[rowOffset + x]; // single byte per pixel (greyscale)
            sum += v;
            sumSq += v * v;
            count++;
          }
        }
        if (count === 0) continue;
        const mean = sum / count;
        const variance = Math.max(0, sumSq / count - mean * mean);
        if (variance < best.variance) {
          best = { r, c, variance, mean };
        }
      }
    }

    // compute cell center in thumbnail coords
    const centerThumbX = Math.round((best.c + 0.5) * cellW);
    const centerThumbY = Math.round((best.r + 0.5) * cellH);

    return { thumbW: w, thumbH: h, cell: best, centerThumbX, centerThumbY };
  } catch (e) {
    // fallback to bottom-right if any failure
    return null;
  }
}

/* create a rounded rectangle backing for overlay */
async function createBackingPlate(width: number, height: number, backgroundColorRGBA: { r: number; g: number; b: number; alpha: number }, radius = 12) {
  const plate = await sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { r: backgroundColorRGBA.r, g: backgroundColorRGBA.g, b: backgroundColorRGBA.b, alpha: backgroundColorRGBA.alpha },
    },
  })
    .png()
    .toBuffer();
  if (radius > 0) {
    // apply rounded corners mask
    const rounded = await sharp(plate)
      .composite([
        {
          input: Buffer.from(
            `<svg><rect x="0" y="0" width="${width}" height="${height}" rx="${radius}" ry="${radius}" fill="#fff"/></svg>`
          ),
          blend: "dest-in",
        },
      ])
      .png()
      .toBuffer();
    return rounded;
  }
  return plate;
}

/* ---------- Route handler ---------- */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) ?? {};
    const bodyToken = typeof body.token === "string" ? body.token : undefined;
    const { user, token } = await getUserFromRequest(request, bodyToken);

    if (!user || !user.id) {
      return NextResponse.json({ ok: false, error: "Authentication required. Please sign in." }, { status: 401 });
    }

    // ensure user_credits exists / fetch
    let currentCredits: number | null = null;
    try {
      const { data: creditRow, error: creditError } = await supabaseAdmin.from("user_credits").select("credits").eq("id", user.id).single();
      if (creditError && (creditError as any).code !== "PGRST116") {
        console.warn("user_credits lookup error", creditError);
      }
      if (creditRow && (creditRow as any).credits !== undefined) {
        currentCredits = Number((creditRow as any).credits);
      } else {
        try {
          const seed = DEFAULT_INITIAL_CREDITS;
          const { data: upserted, error: upsertError } = await supabaseAdmin.from("user_credits").upsert({ id: user.id, credits: seed }, { onConflict: "id" }).select().single();
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
      return NextResponse.json({ ok: false, error: "No credits found for user. Please purchase credits." }, { status: 402 });
    }
    if (currentCredits <= 0) {
      return NextResponse.json({ ok: false, error: "No credits available. Please buy new credits to generate images." }, { status: 402 });
    }

    // Inputs
    const {
      vision,
      prompt: promptIn,
      target = { width: 1080, height: 1080 },
      logoDataUrl,
      refDataUrls = [],
      aiCustomization = {},
      theme,
      saveTemp = false,
    } = body;

    if (!vision && !body.description && !promptIn) {
      return NextResponse.json({ ok: false, error: "Missing vision/description/prompt" }, { status: 400 });
    }
    if (!NANO_API_KEY) return NextResponse.json({ ok: false, error: "Server missing NANO_API_KEY" }, { status: 500 });

    const targetW = Number(target?.width || 1080);
    const targetH = Number(target?.height || 1080);

    // Upload inline logo/ref images (data URLs) to Supabase as temp public urls
    let logoPublicUrl: string | null = null;
    let logoProvided = false;
    if (logoDataUrl && typeof logoDataUrl === "string" && logoDataUrl.startsWith("data:")) {
      try {
        const buf = dataUrlToBuffer(logoDataUrl);
        const safe = `temp/${Date.now()}_logo.png`;
        logoPublicUrl = await uploadBufferToSupabase(buf, safe, "image/png");
        logoProvided = !!logoPublicUrl;
      } catch (e) {
        console.warn("logo upload failed", e);
      }
    } else if (aiCustomization?.logoUrl) {
      logoPublicUrl = aiCustomization.logoUrl;
      logoProvided = true;
    } else if (body.logoUrl) {
      logoPublicUrl = body.logoUrl;
      logoProvided = true;
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

    const mergedAi = { ...aiCustomization, logoUrl: logoPublicUrl ?? aiCustomization?.logoUrl ?? null, refUrls: refPublicUrls.length ? refPublicUrls : aiCustomization?.refUrls ?? [] };

    // Aspect mapping
    const aspectLabel = mapToAllowedAspect(targetW, targetH);
    const prompt = buildPromptFromInputs({ ...body, vision, aiCustomization: mergedAi, target, theme, logoProvided, prompt: promptIn, aspectLabel });

    // Build parts array: text + inline_data for first few refs/logo
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
        if (added >= 3) break;
      }
    }

    if (logoDataUrl && typeof logoDataUrl === "string" && logoDataUrl.startsWith("data:")) {
      const m = logoDataUrl.match(/^data:(.+);base64,(.+)$/);
      if (m) {
        const mimeType = m[1];
        const base64Data = m[2];
        parts.push({
          inline_data: {
            mimeType,
            data: base64Data,
            label: "brand_logo",
          },
        });
      }
    }

    if (theme) parts.push({ text: `Design theme: ${theme}` });
    parts.push({ text: `Aspect ratio hint: ${aspectLabel}` });

    // Build Gemini request payload with allowed aspect string
    const payload: any = {
      contents: [{ parts }],
      generationConfig: {
        responseModalities: ["Image"],
        imageConfig: {
          aspectRatio: aspectLabel,
        },
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

    // Extract image bytes robustly
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
      const candidate = createJson?.files ?? createJson?.outputs ?? createJson?.images ?? null;
      if (Array.isArray(candidate) && candidate.length) {
        const f = candidate[0];
        if (typeof f === "string" && f.startsWith("data:")) {
          imageBuffer = dataUrlToBuffer(f);
          foundSrc = f;
        } else if (typeof f === "string" && f.startsWith("http")) {
          try {
            imageBuffer = await fetchUrlToBuffer(f);
            foundSrc = f;
          } catch (e) {
            console.warn("fallback fetch failed", e);
          }
        } else if (f?.data) {
          imageBuffer = Buffer.from(f.data, "base64");
          foundSrc = `data:image/png;base64,${f.data}`;
        } else if (f?.uri) {
          try {
            imageBuffer = await fetchUrlToBuffer(f.uri);
            foundSrc = f.uri;
          } catch (e) {
            console.warn("fallback fetch uri failed", e);
          }
        }
      }
    }

    if (!imageBuffer) {
      const asString = JSON.stringify(createJson || {});
      const dataUrlMatch = asString.match(/data:image\/[a-zA-Z]+;base64,[A-Za-z0-9+/=]+/);
      if (dataUrlMatch) {
        imageBuffer = dataUrlToBuffer(dataUrlMatch[0]);
        foundSrc = dataUrlMatch[0];
      }
    }

    if (!imageBuffer) {
      return NextResponse.json({ ok: false, error: "No image returned from Gemini (unable to extract).", rawGeminiResponse: createJson }, { status: 500 });
    }

    /* ---------- Composite provided overlay (logo or reference) into image ---------- */
    let finalBuffer = imageBuffer;
    // Determine candidate overlay source: prefer explicit logoPublicUrl, else first refPublicUrls entry
    const overlayCandidates: string[] = [];
    if (logoPublicUrl) overlayCandidates.push(logoPublicUrl);
    if (mergedAi?.refUrls && Array.isArray(mergedAi.refUrls)) overlayCandidates.push(...mergedAi.refUrls);
    // keep only first reasonable candidate
    const overlayUrl = overlayCandidates.length > 0 ? overlayCandidates[0] : null;

    if (overlayUrl) {
      try {
        // fetch overlay buffer
        const overlayBuf = await fetchUrlToBuffer(overlayUrl);

        // get main meta
        const meta = await sharp(finalBuffer).metadata();
        const gw = meta.width || targetW || 1024;
        const gh = meta.height || targetH || 1024;

        // Resize overlay to fit visually: aim for ~18% of image width, clamp
        const overlayTargetWidth = Math.min( Math.max( Math.round(gw * 0.18), 44 ), Math.round(gw * 0.30) );
        let overlaySharp = sharp(overlayBuf).rotate(); // respect EXIF rotate
        // preserve alpha if present, convert to PNG
        overlaySharp = overlaySharp.resize({ width: overlayTargetWidth }).png();
        let overlayResized = await overlaySharp.toBuffer();
        const overlayMeta = await sharp(overlayResized).metadata();
        const oW = overlayMeta.width || overlayTargetWidth;
        const oH = overlayMeta.height || Math.round(overlayTargetWidth * 0.6);

        // Choose a "quiet" area cell using thumbnail variance heuristic
        const stats = await chooseQuietCellAndStats(finalBuffer);
        let placeX = Math.max(8, gw - oW - Math.round(gw * 0.05)); // default fallback (bottom-right-ish)
        let placeY = Math.max(8, gh - oH - Math.round(gw * 0.05));
        if (stats) {
          // Map thumbnail center to original coords
          const scaleX = (meta.width || gw) / stats.thumbW;
          const scaleY = (meta.height || gh) / stats.thumbH;
          const centerX = Math.round(stats.centerThumbX * scaleX);
          const centerY = Math.round(stats.centerThumbY * scaleY);

          // Place overlay centered at chosen cell, but clamp so it is not flush to edges
          placeX = Math.max(8, Math.min(gw - oW - 8, centerX - Math.round(oW / 2)));
          placeY = Math.max(8, Math.min(gh - oH - 8, centerY - Math.round(oH / 2)));
        }

        // Decide backing color based on local mean luminance (if stats available)
        let backingColor = { r: 255, g: 255, b: 255, alpha: 0.9 }; // default white
        if (stats) {
          // stats.cell.mean ≈ [0..255], lower = darker -> use white backing; higher = light -> use semi-dark backing
          if (stats.cell.mean > 180) {
            backingColor = { r: 0, g: 0, b: 0, alpha: 0.48 };
          } else {
            backingColor = { r: 255, g: 255, b: 255, alpha: 0.92 };
          }
        }

        // Backing plate size = overlay size + padding
        const backingPadding = Math.round(Math.max(12, oW * 0.16));
        const backingW = (overlayMeta.width || oW) + backingPadding;
        const backingH = (overlayMeta.height || oH) + backingPadding;
        const backingBuffer = await createBackingPlate(backingW, backingH, backingColor, Math.round(Math.max(8, Math.min(24, oW * 0.08))));

        // Compute backing top-left so overlay sits centered on backing
        const backingLeft = Math.max(6, placeX - Math.round(backingPadding / 2));
        const backingTop = Math.max(6, placeY - Math.round(backingPadding / 2));
        const overlayLeft = backingLeft + Math.round(backingPadding / 2);
        const overlayTop = backingTop + Math.round(backingPadding / 2);

        // If overlay image has a hard background and you want "soft blending", add slight blur to backing edges or reduce backing alpha.
        // Composite: backing then overlay (overlay on top)
        finalBuffer = await sharp(finalBuffer)
          .composite([
            { input: backingBuffer, left: backingLeft, top: backingTop, blend: "over" },
            { input: overlayResized, left: overlayLeft, top: overlayTop, blend: "over" },
          ])
          .png()
          .toBuffer();
      } catch (e) {
        console.warn("Overlay composite failed; returning generated image without compositing", e);
        finalBuffer = imageBuffer;
      }
    }

    const dataUrl = `data:image/png;base64,${finalBuffer.toString("base64")}`;

    // Decrement credits (attempt atomic update)
    let updatedCredits: number | null = null;
    try {
      const { data: updatedRow, error: updateError } = await supabaseAdmin.from("user_credits").update({ credits: (currentCredits ?? 0) - 1 }).eq("id", user.id).gt("credits", 0).select().single();

      if (updateError) {
        try {
          const { data: rpcData, error: rpcErr } = await supabaseAdmin.rpc("decrement_user_credits", { p_user_id: user.id });
          if (!rpcErr && rpcData) {
            if (typeof rpcData === "number") updatedCredits = rpcData;
            else if (Array.isArray(rpcData) && rpcData.length) updatedCredits = Number((rpcData[0] as any).credits ?? null);
            else if ((rpcData as any)?.credits !== undefined) updatedCredits = Number((rpcData as any).credits);
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

    if (saveTemp === true) {
      try {
        const path = `temp/generated_${Date.now()}.png`;
        const publicUrl = await uploadBufferToSupabase(finalBuffer, path, "image/png");
        return NextResponse.json({ ok: true, image: publicUrl ? publicUrl : dataUrl, images: [publicUrl ? publicUrl : dataUrl], dataUrl, savedPublicUrl: publicUrl ?? null, creditsRemaining: updatedCredits, credits_depleted: updatedCredits !== null ? updatedCredits <= 0 : undefined }, { status: 200 });
      } catch (e) {
        console.warn("Temp upload failed", e);
      }
    }

    return NextResponse.json({ ok: true, image: dataUrl, images: [dataUrl], creditsRemaining: updatedCredits, credits_depleted: updatedCredits !== null ? updatedCredits <= 0 : undefined }, { status: 200 });
  } catch (err: any) {
    console.error("Generation endpoint error:", err);
    const message = err?.message || String(err);
    const extra = err?.response?.data ? { raw: err.response.data } : {};
    return NextResponse.json({ ok: false, error: message, ...extra }, { status: 500 });
  }
}
