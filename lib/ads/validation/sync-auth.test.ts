/**
 * Static/logic tests for /api/ads/sync cron authorization (no HTTP server).
 * Run: npx --yes tsx lib/ads/validation/sync-auth.test.ts
 */
import assert from "assert";

function isCronAuthorized(opts: {
  cronSecret?: string;
  authHeader?: string;
  vercelCron?: boolean;
  nodeEnv?: string;
}): boolean {
  const cronSecret = opts.cronSecret;
  const auth = opts.authHeader || "";
  const vercelCron = !!opts.vercelCron;
  return (
    vercelCron ||
    (!!cronSecret && auth === `Bearer ${cronSecret}`) ||
    (!cronSecret && opts.nodeEnv !== "production")
  );
}

assert.strictEqual(
  isCronAuthorized({
    cronSecret: "secret",
    authHeader: "Bearer secret",
  }),
  true,
  "bearer secret ok"
);

assert.strictEqual(
  isCronAuthorized({
    cronSecret: "secret",
    authHeader: "Bearer wrong",
  }),
  false,
  "wrong bearer denied"
);

assert.strictEqual(
  isCronAuthorized({
    cronSecret: "secret",
    vercelCron: true,
  }),
  true,
  "vercel cron header ok"
);

assert.strictEqual(
  isCronAuthorized({
    cronSecret: undefined,
    nodeEnv: "development",
  }),
  true,
  "dev without secret allowed"
);

assert.strictEqual(
  isCronAuthorized({
    cronSecret: undefined,
    nodeEnv: "production",
  }),
  false,
  "prod without secret denied"
);

console.log("PASS lib/ads/validation/sync-auth.test.ts");
