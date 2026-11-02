/**
 * Does the video model's own soundtrack contain human voices?
 *
 * For dubbed languages we lay our TTS over Seedance's audio as a music bed. Seedance
 * sometimes speaks anyway (it said "order on Zomato" in Tamil under one ad), and that
 * voice surfaces as soon as our narrator stops. The bed is only kept when it is
 * verified voice-free; any doubt drops it.
 */

import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { getFfmpegExecutable } from "@/lib/creative-studio/ffmpeg-server";
import { GEMINI_REST_BASE, getGeminiApiKey } from "@/lib/gemini-config";
import { fetchWithGeminiRateLimitRetry } from "@/lib/gemini-retry";

const execFileAsync = promisify(execFile);
const MODEL = "gemini-3.8-flash";

export type VoiceCheck = { hasVoices: boolean; detail: string };

/** Small mono WAV of a video's soundtrack, or null when the video has no audio. */
async function extractSoundtrack(videoBuffer: Buffer): Promise<Buffer | null> {
  const dir = await mkdtemp(join(tmpdir(), "skalx-voicecheck-"));
  try {
    const input = join(dir, "in.mp4");
    const output = join(dir, "out.wav");
    await writeFile(input, videoBuffer);
    try {
      await execFileAsync(getFfmpegExecutable(), ["-y", "-i", input, "-vn", "-ac", "1", "-ar", "16000", output], { timeout: 60_000 });
    } catch {
      return null;
    }
    return await readFile(output);
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}

/**
 * Listen to the soundtrack with Gemini. Returns hasVoices=true on any speech,
 * narration, singing or murmuring — and also when the check cannot run (safe default).
 */
export async function detectVoicesInVideo(videoBuffer: Buffer): Promise<VoiceCheck> {
  const wav = await extractSoundtrack(videoBuffer);
  if (!wav) return { hasVoices: false, detail: "no audio track" };
  const apiKey = getGeminiApiKey();
  if (!apiKey) return { hasVoices: true, detail: "voice check unavailable (no API key)" };

  try {
    const response = await fetchWithGeminiRateLimitRetry(
      `${GEMINI_REST_BASE}/models/${MODEL}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { inline_data: { mime_type: "audio/wav", data: wav.toString("base64") } },
                {
                  text:
                    "This is the soundtrack of a video ad. Is there ANY human voice in it — speech, narration, " +
                    "dialogue, whispering, murmuring, singing or vocal sounds — in any language? Music and sound " +
                    'effects alone do not count. Return JSON only: {"hasVoices": boolean, "detail": "what you heard and when, max 20 words"}',
                },
              ],
            },
          ],
          generation_config: { temperature: 0, response_mime_type: "application/json", thinking_config: { thinking_budget: 0 } },
        }),
      },
      { operationLabel: "detect-voices", maxRetries: 2 }
    );
    if (!response.ok) return { hasVoices: true, detail: `voice check failed (HTTP ${response.status})` };
    const json = (await response.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "";
    const parsed = JSON.parse(text) as { hasVoices?: unknown; detail?: unknown };
    if (typeof parsed.hasVoices !== "boolean") return { hasVoices: true, detail: "voice check unclear" };
    return { hasVoices: parsed.hasVoices, detail: String(parsed.detail || "").slice(0, 160) };
  } catch (e) {
    return { hasVoices: true, detail: `voice check failed (${(e as Error).message.slice(0, 80)})` };
  }
}
