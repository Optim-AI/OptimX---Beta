/** Resolve Gemini API key from env (read at call time for dev hot-reload). */
export function getGeminiApiKey(): string | undefined {
  const key =
    process.env.GEMINI_API_KEY ||
    process.env.GEMINI_VEO_API_KEY ||
    process.env.NANO_API_KEY;
  const trimmed = key?.trim();
  return trimmed || undefined;
}

/** Veo video generation — prefers dedicated Veo key, falls back to general Gemini key. */
export function getVeoApiKey(): string | undefined {
  const key =
    process.env.GEMINI_VEO_API_KEY ||
    process.env.GEMINI_API_KEY ||
    process.env.NANO_API_KEY;
  const trimmed = key?.trim();
  return trimmed || undefined;
}

export const VEO_API_KEY_SETUP_MESSAGE =
  "Video generation requires GEMINI_VEO_API_KEY (or GEMINI_API_KEY) in .env.local. Get a key from https://aistudio.google.com/app/apikey (Veo access required), add it, then restart npm run dev.";

export const GEMINI_REST_BASE = "https://generativelanguage.googleapis.com/v1beta";
