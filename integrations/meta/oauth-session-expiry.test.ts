/**
 * OAuth session expiry parsing regression tests.
 * Run: npx --yes tsx integrations/meta/oauth-session-expiry.test.ts
 */
import assert from "assert";
import { parseOAuthSessionExpiry } from "@/integrations/meta/oauth-session";

// Postgres timestamptz text with offset (must NOT become Invalid Date via +Z)
{
  const d = parseOAuthSessionExpiry("2026-10-09 11:53:59.87+00");
  assert.ok(d && !Number.isNaN(d.getTime()), "offset timestamp must parse");
  assert.strictEqual(d!.toISOString(), "2026-10-09T11:53:59.870Z");
}

// ISO with Z
{
  const d = parseOAuthSessionExpiry("2026-10-09T11:53:59.870Z");
  assert.ok(d && !Number.isNaN(d.getTime()));
}

// Naive UTC
{
  const d = parseOAuthSessionExpiry("2026-01-04 11:43:39.535");
  assert.ok(d && !Number.isNaN(d.getTime()));
  assert.strictEqual(d!.toISOString(), "2026-01-04T11:43:39.535Z");
}

console.log("oauth-session-expiry.test: PASS");
