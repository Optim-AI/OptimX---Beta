/**
 * Automated unit tests for token crypto (no provider calls).
 * Run: npx --yes tsx lib/ads/crypto/tokens.test.ts
 */
import assert from "assert";
import {
  encryptToken,
  decryptToken,
  isEncryptedToken,
  prepareTokensForStorage,
  revealTokens,
} from "./tokens";

process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY =
  process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY ||
  "test-encryption-key-for-paid-ads-validation-32chars";

function run() {
  const plain = "EAAG_test_access_token_value_12345";
  const enc = encryptToken(plain);
  assert.ok(enc && isEncryptedToken(enc), "encrypt produces enc:v1 prefix");
  assert.notStrictEqual(enc, plain, "ciphertext != plaintext");
  assert.strictEqual(decryptToken(enc), plain, "round-trip decrypt");

  // Idempotent encrypt
  assert.strictEqual(encryptToken(enc), enc, "re-encrypt is no-op");

  // Legacy plaintext compatibility
  assert.strictEqual(decryptToken("legacy_plain_token"), "legacy_plain_token");
  assert.strictEqual(isEncryptedToken("legacy_plain_token"), false);

  // Null/empty
  assert.strictEqual(encryptToken(null), null);
  assert.strictEqual(encryptToken(""), "");
  assert.strictEqual(decryptToken(null), null);

  const prepared = prepareTokensForStorage({
    accessToken: "access_abc",
    refreshToken: "refresh_xyz",
  });
  assert.ok(prepared.tokenEncrypted);
  assert.ok(isEncryptedToken(prepared.accessToken!));
  assert.ok(isEncryptedToken(prepared.refreshToken!));

  const revealed = revealTokens({
    accessToken: prepared.accessToken,
    refreshToken: prepared.refreshToken,
  });
  assert.strictEqual(revealed.accessToken, "access_abc");
  assert.strictEqual(revealed.refreshToken, "refresh_xyz");

  // Tamper detection
  let threw = false;
  try {
    decryptToken(enc!.slice(0, -4) + "xxxx");
  } catch {
    threw = true;
  }
  assert.ok(threw, "tampered ciphertext must fail");

  console.log("PASS lib/ads/crypto/tokens.test.ts");
}

function runPlaceholderRefusal() {
  const prevKey = process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY;
  const prevSession = process.env.SESSION_SECRET;
  delete process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY;
  process.env.SESSION_SECRET = "your_random_secret_minimum_32_characters_here";

  // Re-import is hard with ESM cache; call encrypt with env set — module already loaded.
  // getEncryptionKey reads env at call time, so this still works.
  const out = encryptToken("should_remain_plain");
  assert.strictEqual(out, "should_remain_plain", "placeholder secret must not encrypt");
  assert.strictEqual(isEncryptedToken(out!), false);

  process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY = prevKey;
  process.env.SESSION_SECRET = prevSession;
  console.log("PASS placeholder secret refusal");
}

run();
runPlaceholderRefusal();
