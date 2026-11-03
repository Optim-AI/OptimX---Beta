/**
 * POST /api/commercial/transcribe
 *
 * Authenticated. Turns a short voice recording from "Speak instead" into text
 * (Gemini). Free — no credits.
 *
 * Body: { audio: base64, mimeType: "audio/webm" | "audio/mp4" | …, language?: VoiceoverLanguage }
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { getUserIdFromRequest } from "@/auth/request";
import {
  MAX_SPEECH_BYTES,
  transcribeSpeech,
} from "@/lib/creative-studio/commercial-production/audio/transcribe-speech";

export const config = {
  api: { bodyParser: { sizeLimit: "10mb" } },
  maxDuration: 60,
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return res.status(401).json({ ok: false, error: "Authentication required", code: "AUTH_REQUIRED" });
  }

  const { audio, mimeType, language } = req.body || {};
  if (typeof audio !== "string" || !audio || typeof mimeType !== "string" || !mimeType.startsWith("audio/")) {
    return res.status(400).json({ ok: false, error: "A voice recording is required" });
  }
  if ((audio.length * 3) / 4 > MAX_SPEECH_BYTES) {
    return res.status(413).json({ ok: false, error: "That recording is too long. Please keep it under 2 minutes." });
  }

  try {
    const text = await transcribeSpeech({ audioBase64: audio, mimeType, language });
    return res.status(200).json({ ok: true, text });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[api/commercial/transcribe] failed", { userId, message });
    return res.status(500).json({ ok: false, error: "We couldn't hear that clearly. Please try again." });
  }
}
