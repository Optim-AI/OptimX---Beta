/** Voiceover keeps working when one configured Gemini key is rejected. */
import assert from "node:assert/strict";
import { generateGeminiTtsVoiceover } from "./gemini-tts";

const realFetch = globalThis.fetch;
const audio = Buffer.from("RIFFfakewav").toString("base64");
const calls: string[] = [];

function stub(byKey: Record<string, number>) {
  calls.length = 0;
  globalThis.fetch = (async (_url: unknown, init?: RequestInit) => {
    const key = String((init?.headers as Record<string, string>)["x-goog-api-key"]);
    calls.push(key);
    const status = byKey[key] ?? 200;
    const body = status === 200 ? { output_audio: { data: audio, mime_type: "audio/wav" } } : {};
    return new Response(JSON.stringify(body), { status });
  }) as typeof fetch;
}

(async () => {
  process.env.GEMINI_TTS_API_KEY = "tts-key-stale";
  process.env.GEMINI_API_KEY = "main-key-good";
  delete process.env.GEMINI_VEO_API_KEY;
  delete process.env.NANO_API_KEY;

  // Stale TTS key (401) → falls through to GEMINI_API_KEY, without retrying the dead key.
  stub({ "tts-key-stale": 401 });
  const ok = await generateGeminiTtsVoiceover({ script: "Vanakkam", language: "tamil" });
  assert.ok(ok.audioBuffer.length > 0, "audio from the working key");
  assert.deepEqual(calls, ["tts-key-stale", "main-key-good"], "rejected key tried once, then the next key");

  // Every key rejected → one clear error naming the variables.
  stub({ "tts-key-stale": 401, "main-key-good": 403 });
  await assert.rejects(
    () => generateGeminiTtsVoiceover({ script: "Vanakkam", language: "tamil" }),
    /rejected every configured Gemini key \(GEMINI_TTS_API_KEY, GEMINI_API_KEY\)/
  );

  // A server hiccup (500) is retried on the same key, not treated as a bad key.
  let n = 0;
  globalThis.fetch = (async () => (++n === 1 ? new Response("{}", { status: 500 }) : new Response(JSON.stringify({ output_audio: { data: audio } }), { status: 200 }))) as typeof fetch;
  const retried = await generateGeminiTtsVoiceover({ script: "Namaste", language: "hindi" });
  assert.ok(retried.audioBuffer.length > 0 && n === 2, "5xx retried on the same key");

  globalThis.fetch = realFetch;
  console.log("gemini-tts-keys.test.ts: PASS");
})().catch((e) => { globalThis.fetch = realFetch; console.error(e); process.exit(1); });
