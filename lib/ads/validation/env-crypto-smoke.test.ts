/**
 * Smoke-test encryption using the real .env.local key (never prints secrets).
 * Run: npx --yes tsx lib/ads/validation/env-crypto-smoke.test.ts
 */
import assert from "assert";
import { config } from "dotenv";
config({ path: ".env.local", override: true });

import {
  encryptToken,
  decryptToken,
  isEncryptedToken,
  prepareTokensForStorage,
  revealTokens,
} from "@/lib/ads/crypto/tokens";

const key = process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY || "";
assert.ok(key.length >= 16, "INTEGRATION_TOKEN_ENCRYPTION_KEY missing/short");
assert.ok(
  !/your[_-]|placeholder|change.?me|minimum_32/i.test(key),
  "encryption key still looks like a placeholder"
);
assert.ok(
  (process.env.SESSION_SECRET || "").length >= 16 &&
    !/your[_-]|placeholder|minimum_32/i.test(process.env.SESSION_SECRET || ""),
  "SESSION_SECRET not ready"
);
assert.ok(
  (process.env.CRON_SECRET || "").length >= 16 &&
    !/your[_-]|placeholder/i.test(process.env.CRON_SECRET || ""),
  "CRON_SECRET not ready"
);

const plain = `EAA_local_verify_${Date.now()}`;
const enc = encryptToken(plain);
assert.ok(isEncryptedToken(enc!), "encrypt must produce enc:v1 ciphertext");
assert.strictEqual(decryptToken(enc), plain);

const prepared = prepareTokensForStorage({
  accessToken: "access_smoke",
  refreshToken: "refresh_smoke",
});
assert.ok(prepared.tokenEncrypted);
const revealed = revealTokens(prepared);
assert.strictEqual(revealed.accessToken, "access_smoke");
assert.strictEqual(revealed.refreshToken, "refresh_smoke");

console.log(
  JSON.stringify({
    ok: true,
    encryption_key_len: key.length,
    ciphertext_prefix: enc!.slice(0, 6),
    session_secret_configured: true,
    cron_secret_configured: true,
  })
);
