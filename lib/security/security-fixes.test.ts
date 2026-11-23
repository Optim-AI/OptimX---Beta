/** Security audit 2026-11-23: safe fetch refuses private targets; OAuth nonce must match. */
import assert from "node:assert/strict";
import { safeFetch, UnsafeUrlError } from "@/lib/audit/url-safety";
import { issueOAuthNonce, checkOAuthNonce } from "@/lib/security/oauth-nonce";

async function rejects(url: string) {
  await assert.rejects(() => safeFetch(url), (e: unknown) => e instanceof UnsafeUrlError, url);
}

async function main() {
  for (const url of [
    "http://127.0.0.1:9001/2018-06-01/runtime/invocation/next",
    "http://localhost:3000/api/admin/users",
    "http://169.254.169.254/latest/meta-data/",
    "http://10.0.0.5/",
    "http://[::1]/",
    "file:///etc/passwd",
    "ftp://example.com/x",
    "http://user:pass@example.com/",
    "http://metadata.google.internal/",
  ]) {
    await rejects(url);
  }
  console.log("PASS: safeFetch refuses private and non-http targets");

  const { state, setCookie } = issueOAuthNonce("skx_t", "/api/x", true);
  assert.match(setCookie, /HttpOnly/i);
  assert.match(setCookie, /SameSite=Lax/i);
  const cookie = `other=1; skx_t=${state}`;
  assert.equal(checkOAuthNonce(cookie, "skx_t", state), true);
  assert.equal(checkOAuthNonce(cookie, "skx_t", state + "x"), false);
  assert.equal(checkOAuthNonce(undefined, "skx_t", state), false);
  assert.equal(checkOAuthNonce(cookie, "skx_t", undefined), false);
  console.log("PASS: OAuth nonce only accepts the matching browser cookie");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
