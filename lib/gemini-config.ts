/** Resolve Gemini API key from env (read at call time for dev hot-reload). */
const PLACEHOLDER_KEY_RE =
  /^(your[_-]?|xxx|changeme|replace|todo|example|dummy)/i;

function isUsableApiKey(value: string | undefined): value is string {
  const trimmed = value?.trim();
  if (!trimmed) return false;
  if (PLACEHOLDER_KEY_RE.test(trimmed)) return false;
  if (/api[_-]?key[_-]?here/i.test(trimmed)) return false;
  // Real Google AI Studio keys typically start with AIza
  // Allow other formats but reject obvious .env.example placeholders
  return true;
}

export function getGeminiApiKey(): string | undefined {
  const candidates = [
    process.env.GEMINI_API_KEY,
    process.env.GEMINI_VEO_API_KEY,
    process.env.NANO_API_KEY,
  ];
  for (const key of candidates) {
    if (isUsableApiKey(key)) return key.trim();
  }
  return undefined;
}

export function getGeminiApiKeySource(): string | undefined {
  if (isUsableApiKey(process.env.GEMINI_API_KEY)) return "GEMINI_API_KEY";
  if (isUsableApiKey(process.env.GEMINI_VEO_API_KEY)) return "GEMINI_VEO_API_KEY";
  if (isUsableApiKey(process.env.NANO_API_KEY)) return "NANO_API_KEY";
  return undefined;
}

/** Veo video generation — prefers dedicated Veo key, falls back to general Gemini key. */
export function getVeoApiKey(): string | undefined {
  const candidates = [
    process.env.GEMINI_VEO_API_KEY,
    process.env.GEMINI_API_KEY,
    process.env.NANO_API_KEY,
  ];
  for (const key of candidates) {
    if (isUsableApiKey(key)) return key.trim();
  }
  return undefined;
}

export function getVeoApiKeySource(): string | undefined {
  if (isUsableApiKey(process.env.GEMINI_VEO_API_KEY)) return "GEMINI_VEO_API_KEY";
  if (isUsableApiKey(process.env.GEMINI_API_KEY)) return "GEMINI_API_KEY";
  if (isUsableApiKey(process.env.NANO_API_KEY)) return "NANO_API_KEY";
  return undefined;
}

export const VEO_API_KEY_SETUP_MESSAGE =
  "Video generation requires GEMINI_VEO_API_KEY (or GEMINI_API_KEY) in .env.local. Get a key from https://aistudio.google.com/app/apikey (Veo access required), add it, then restart npm run dev.";

export const GEMINI_API_KEY_SETUP_MESSAGE =
  "Commercial planning requires a valid GEMINI_API_KEY in .env.local (Google AI Studio). Get a key from https://aistudio.google.com/app/apikey, replace the placeholder, then restart npm run dev. A Runway key alone is not enough — Gemini plans the commercial before Seedance generates it.";

export const GEMINI_REST_BASE = "https://generativelanguage.googleapis.com/v1beta";
