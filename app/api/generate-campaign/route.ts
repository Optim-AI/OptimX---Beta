// app/api/generate-campaign/route.ts
import axios from "axios";
import { NextResponse } from "next/server";
import { supabaseAdmin } from '@/auth/supabase/client'; // adjust path if necessary

const NANO_API_KEY = process.env.NANO_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash-image";
const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";
const DEFAULT_INITIAL_CREDITS = Number(process.env.DEFAULT_INITIAL_CREDITS ?? 5);

if (!NANO_API_KEY) {
  console.warn("NANO_API_KEY not set - Gemini calls will fail.");
}

/* ---------- Types / helpers for logo placement ---------- */

type LogoPlacement =
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right"
  | "center-top"
  | "center-bottom"
  | "on-product";

function placementToPrompt(placement: LogoPlacement): string {
  switch (placement) {
    case "top-left":
      return "Place the logo in the top-left corner, with some breathing room from the edges.";
    case "top-right":
      return "Place the logo in the top-right corner, with some breathing room from the edges.";
    case "bottom-left":
      return "Place the logo in the bottom-left corner, with some breathing room from the edges.";
    case "bottom-right":
      return "Place the logo in the bottom-right corner, with some breathing room from the edges.";
    case "center-top":
      return "Place the logo centered at the top edge of the image.";
    case "center-bottom":
      return "Place the logo centered at the bottom edge of the image.";
    case "on-product":
      return "Place the logo clearly on the main product surface, following its perspective and curvature.";
    default:
      return "";
  }
}

/* ---------- Generic helpers ---------- */

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

async function uploadBufferToSupabase(
  buffer: Buffer,
  path: string,
  contentType = "image/png"
) {
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
  let best = "4:5";
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

/* ---------- Build prompt ---------- */

function buildPromptFromInputs(body: any) {
  const parts: string[] = [];

  // Mode
  if (body.mode === "post") {
    parts.push(
      "Think like a creative director and a performance marketer at the same time. Design a social media creative that’s aesthetically captivating like an everyday post, but strategically built to convert like a top-performing ad."
    );
  }

  // Campaign info
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
  if (body.ageRange && Array.isArray(body.ageRange))
    parts.push(`Age: ${body.ageRange[0]}-${body.ageRange[1]}`);
  if (body.gender) parts.push(`Gender target: ${body.gender}`);
  if (body.location) parts.push(`Location: ${body.location}`);
  if (body.interests) parts.push(`Interests: ${body.interests}`);
  if (body.budget)
    parts.push(`Budget: ${body.budget} (${body.budgetType || "daily"})`);
  if (body.startDate || body.endDate)
    parts.push(`Schedule: ${body.startDate || "start"} → ${body.endDate || "end"}`);

  // Extract brand details from brandSnapshot if available
  const brand = body.brandSnapshot;
  if (brand) {
    const brandContext: string[] = [];
    
    // Brand colors - CRITICAL for visual consistency
    if (brand.primaryColors && Array.isArray(brand.primaryColors) && brand.primaryColors.length > 0) {
      brandContext.push(`MANDATORY BRAND COLORS: ${brand.primaryColors.join(", ")}. Use ONLY these colors as the dominant palette.`);
    } else if (brand.colors) {
      const colorParts: string[] = [];
      if (brand.colors.primary) colorParts.push(`PRIMARY: ${brand.colors.primary}`);
      if (brand.colors.secondary) colorParts.push(`SECONDARY: ${brand.colors.secondary}`);
      if (brand.colors.accent) colorParts.push(`ACCENT: ${brand.colors.accent}`);
      if (colorParts.length > 0) {
        brandContext.push(`MANDATORY BRAND COLORS: ${colorParts.join(", ")}. Use these as the dominant visual elements.`);
      }
    }
    
    // Brand voice/tone
    if (brand.brandVoice) brandContext.push(`Brand voice: ${brand.brandVoice}`);
    if (brand.coreValueProp) brandContext.push(`Core value proposition: "${brand.coreValueProp}"`);
    if (brand.audience) brandContext.push(`Target audience: ${brand.audience}`);
    if (brand.fontStyles) brandContext.push(`Typography style: ${brand.fontStyles}`);
    if (brand.productCategory) brandContext.push(`Product category: ${brand.productCategory}`);
    if (brand.pricePositioning) brandContext.push(`Price positioning: ${brand.pricePositioning}`);
    if (brand.ctaPatterns && Array.isArray(brand.ctaPatterns) && brand.ctaPatterns.length > 0) {
      brandContext.push(`Preferred CTAs: ${brand.ctaPatterns.join(", ")}`);
    }
    
    if (brandContext.length > 0) {
      parts.push(`BRAND GUIDELINES (MUST FOLLOW): ${brandContext.join(". ")}`);
    }
  }
  
  // Product image instruction
  if (body.productProvided || body.productDataUrl) {
    parts.push(
      "CRITICAL PRODUCT IMAGE: A product image has been provided. Use THIS EXACT product image as the hero element. Do NOT regenerate or replace the product. Only adjust background and composition around it."
    );
  }

  // Reference images
  const refUrls: string[] =
    Array.isArray(body.refUrls) ? body.refUrls : body.aiCustomization?.refUrls ?? [];
  if (refUrls && refUrls.length) {
    parts.push(
      `Reference images (use as style/layout inspiration — color, composition, mood): ${refUrls
        .slice(0, 8)
        .join(", ")}. Do not copy copyrighted elements verbatim.`
    );
  }

  // Logo guidance
  const placement: LogoPlacement | undefined = body.logoPlacement as LogoPlacement | undefined;

  parts.push(
    "Use the uploaded image only as the brand logo. First extract the logo cleanly by removing any background, borders, or surrounding design.",
    "Do not place the entire uploaded picture inside the creative. Use only the isolated logo graphic.",
    "Resize and position the logo the way a professional designer would — balanced, tasteful, and context-aware. Do not stretch or distort it.",
    "Place the logo in a location that complements the layout. If the creative includes a product in the scene, apply the logo naturally to the product surface when it makes visual sense. Make it look printed or embedded, not floating.",
    "Match lighting, shadows, and perspective so the logo feels realistically part of the scene.",
    "If the layout does not include a product surface for application, place the logo neatly within the composition, maintaining premium brand aesthetics.",
    "Never generate or modify the logo. Do not create a new version. Do not add filters or effects to it.",
    "Never add any watermarks, symbols, brand marks, or signatures.",
    "The logo placement should always support the focal point of the creative. It should be visible but never dominate."
  );

  if (placement) {
    const placementInstruction = placementToPrompt(placement);
    if (placementInstruction) parts.push(placementInstruction);
  }

  // Size / Aspect
  const width = body.target?.width || 1080;
  const height = body.target?.height || 1080;
  const aspectLabel = body.aspectLabel || `${width}x${height}`;

  parts.push(
    `Produce a high-quality visual sized approximately ${width}×${height} (${aspectLabel}). Keep composition balanced. Avoid putting essential text in the extreme corners.`
  );

  return parts.filter(Boolean).join("\n\n");
}

/* ---------- Gemini response image extraction ---------- */

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

/* ---------- Auth helpers ---------- */

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

function findTokenInCookies(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(";").map((p) => p.trim());
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
      if (parsed?.currentSession?.access_token)
        return parsed.currentSession.access_token;
    } catch {}
  }
  return null;
}

async function getUserFromRequest(request: Request, bodyToken?: string) {
  try {
    const authHeader =
      request.headers.get("authorization") ||
      request.headers.get("Authorization") ||
      "";
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
        console.warn(
          "supabaseAdmin.auth.getUser failed (continuing to decode):",
          (e as any)?.message ?? e
        );
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

/* ---------- Route handler ---------- */

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) ?? {};
    const bodyToken = typeof body.token === "string" ? body.token : undefined;
    const { user } = await getUserFromRequest(request, bodyToken);

    if (!user || !user.id) {
      return NextResponse.json(
        { ok: false, error: "Authentication required. Please sign in." },
        { status: 401 }
      );
    }

    // credits
    let currentCredits: number | null = null;
    try {
      console.log('[Credits] Looking up credits for user:', user.id);
      const { data: creditRow, error: creditError } = await supabaseAdmin
        .from("user_credits")
        .select("credits")
        .eq("id", user.id) // id IS the user_id in production schema
        .single();
      console.log('[Credits] Lookup result:', { creditRow, creditError });
      if (creditError && (creditError as any).code !== "PGRST116") {
        console.warn("user_credits lookup error", creditError);
      }
      if (creditRow && (creditRow as any).credits !== undefined) {
        currentCredits = Number((creditRow as any).credits);
        console.log('[Credits] Found credits:', currentCredits);
      } else {
        console.log('[Credits] No credits row found, attempting to seed...');
        try {
          const seed = DEFAULT_INITIAL_CREDITS;
          // In production schema, id IS the user_id
          const { data: upserted, error: upsertError } = await supabaseAdmin
            .from("user_credits")
            .upsert({ id: user.id, credits: seed }, { onConflict: "id" })
            .select()
            .single();
          if (!upsertError && upserted && (upserted as any).credits !== undefined) {
            currentCredits = Number((upserted as any).credits);
            console.log(
              `Seeded user_credits for ${user.id} with ${seed} credits.`
            );
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
        {
          ok: false,
          error: "No credits available. Please buy new credits to generate images.",
        },
        { status: 402 }
      );
    }

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
      return NextResponse.json(
        { ok: false, error: "Missing vision/description/prompt" },
        { status: 400 }
      );
    }
    if (!NANO_API_KEY)
      return NextResponse.json(
        { ok: false, error: "Server missing NANO_API_KEY" },
        { status: 500 }
      );

    const targetW = Number(target?.width || 1080);
    const targetH = Number(target?.height || 1080);

    // Upload logo/ref inline images to Supabase to have public URLs as needed
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
    } else if (
      Array.isArray(aiCustomization?.refUrls) &&
      aiCustomization.refUrls.length
    ) {
      for (const u of aiCustomization.refUrls)
        if (typeof u === "string") refPublicUrls.push(u);
    }

    const logoPlacement: LogoPlacement | undefined =
      (body.logoPlacement as LogoPlacement | undefined) ??
      (aiCustomization?.logoPlacement as LogoPlacement | undefined);

    const mergedAi = {
      ...aiCustomization,
      logoUrl: logoPublicUrl ?? aiCustomization?.logoUrl ?? null,
      refUrls: refPublicUrls.length
        ? refPublicUrls
        : aiCustomization?.refUrls ?? [],
      logoPlacement,
    };

    // Aspect mapping
    const aspectLabel = mapToAllowedAspect(targetW, targetH);

    const prompt = buildPromptFromInputs({
      ...body,
      vision,
      aiCustomization: mergedAi,
      target,
      theme,
      logoProvided,
      logoPlacement,
      prompt: promptIn,
      aspectLabel,
      refUrls: mergedAi.refUrls,
    });

    // Build Gemini parts: text + inline images
    const parts: any[] = [{ text: prompt }];
    
    // Extract productDataUrl from body (main product image - highest priority)
    const productDataUrl = body.productDataUrl;
    
    // Add main product image FIRST (most important reference)
    if (productDataUrl && typeof productDataUrl === "string" && productDataUrl.startsWith("data:")) {
      const m = productDataUrl.match(/^data:(.+);base64,(.+)$/);
      if (m) {
        const mimeType = m[1];
        const base64Data = m[2];
        parts.push({
          inline_data: {
            mimeType,
            data: base64Data,
          },
        });
        parts.push({ text: "The image above is the MAIN PRODUCT IMAGE. This is the primary subject. Use this exact product in the poster design. Do NOT alter, regenerate, or replace this product image." });
      }
    }

    // Add additional reference images (lower priority)
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
        parts.push({ text: "The image above is an additional reference image for style/context." });
        added++;
        if (added >= 2) break; // Limit to 2 additional refs (3 total including product)
      }
    }

    // Add brand logo
    if (logoDataUrl && typeof logoDataUrl === "string" && logoDataUrl.startsWith("data:")) {
      const m = logoDataUrl.match(/^data:(.+);base64,(.+)$/);
      if (m) {
        const mimeType = m[1];
        const base64Data = m[2];
        parts.push({
          inline_data: {
            mimeType,
            data: base64Data,
          },
        });
        parts.push({ text: "The image above is the BRAND LOGO. Include this logo in the poster design in an appropriate location." });
      }
    }

    if (theme) parts.push({ text: `Design theme: ${theme}` });
    parts.push({ text: `Aspect ratio hint: ${aspectLabel}` });

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

    const url = `${GEMINI_BASE}/${encodeURIComponent(
      GEMINI_MODEL
    )}:generateContent`;
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

    // Extract image
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
      const candidate =
        createJson?.files ??
        createJson?.outputs ??
        createJson?.images ??
        null;
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
      const dataUrlMatch = asString.match(
        /data:image\/[a-zA-Z]+;base64,[A-Za-z0-9+/=]+/
      );
      if (dataUrlMatch) {
        imageBuffer = dataUrlToBuffer(dataUrlMatch[0]);
        foundSrc = dataUrlMatch[0];
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

    // Final buffer = Gemini output (logo is integrated by the model)
    const finalBuffer = imageBuffer;

    const dataUrl = `data:image/png;base64,${finalBuffer.toString("base64")}`;

    // decrement credits - MUST use atomic operation for parallel request safety
    let updatedCredits: number | null = null;
    try {
      // Primary: Use RPC for atomic decrement (prevents race conditions with parallel requests)
      // The function parameter is p_user (not user_id) and returns void
      const { error: rpcErr } = await supabaseAdmin.rpc(
        "decrement_credit",
        { p_user: user.id }
      );
      
      if (!rpcErr) {
        // RPC returns void, so we need to query the current balance
        const { data: creditRow, error: queryErr } = await supabaseAdmin
          .from("user_credits")
          .select("credits")
          .eq("id", user.id)
          .single();
        
        if (!queryErr && creditRow && (creditRow as any).credits !== undefined) {
          updatedCredits = Number((creditRow as any).credits);
        }
        console.log('[Credits] Atomic decrement successful, new balance:', updatedCredits);
      } else {
        // Fallback: Re-read current credits and decrement (less ideal but works)
        console.warn("RPC decrement_credit failed:", rpcErr);
        
        // Re-read current credits to get fresh value
        const { data: freshCredits } = await supabaseAdmin
          .from("user_credits")
          .select("credits")
          .eq("id", user.id)
          .single();
        
        const currentVal = freshCredits ? Number((freshCredits as any).credits) : (currentCredits ?? 1);
        
        const { data: updatedRow, error: updateError } = await supabaseAdmin
          .from("user_credits")
          .update({ 
            credits: Math.max(currentVal - 1, 0),
            updated_at: new Date().toISOString()
          })
          .eq("id", user.id)
          .gt("credits", 0)
          .select()
          .single();
        
        if (!updateError && updatedRow && (updatedRow as any).credits !== undefined) {
          updatedCredits = Number((updatedRow as any).credits);
          console.log('[Credits] Direct update fallback, new balance:', updatedCredits);
        } else {
          console.warn("Credit decrement fallback failed:", updateError);
        }
      }
    } catch (e) {
      console.warn("Credit decrement failed", e);
    }

    if (saveTemp === true) {
      try {
        const path = `temp/generated_${Date.now()}.png`;
        const publicUrl = await uploadBufferToSupabase(
          finalBuffer,
          path,
          "image/png"
        );
        return NextResponse.json(
          {
            ok: true,
            image: publicUrl ? publicUrl : dataUrl,
            images: [publicUrl ? publicUrl : dataUrl],
            dataUrl,
            savedPublicUrl: publicUrl ?? null,
            creditsRemaining: updatedCredits,
            credits_depleted:
              updatedCredits !== null ? updatedCredits <= 0 : undefined,
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
        credits_depleted:
          updatedCredits !== null ? updatedCredits <= 0 : undefined,
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("Generation endpoint error:", err);
    const message = err?.message || String(err);
    const extra = err?.response?.data ? { raw: err.response.data } : {};
    return NextResponse.json(
      { ok: false, error: message, ...extra },
      { status: 500 }
    );
  }
}
