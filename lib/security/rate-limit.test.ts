/** Run: npx tsx lib/security/rate-limit.test.ts */
import assert from "node:assert/strict";
import { clientIp, limitedPagesApi, rateLimit, resetRateLimits } from "./rate-limit";

resetRateLimits();
const t0 = 1_000_000;
for (let i = 0; i < 3; i++) assert.equal(rateLimit("k", 3, 60_000, t0 + i).ok, true);
const blocked = rateLimit("k", 3, 60_000, t0 + 10);
assert.equal(blocked.ok, false);
assert.ok(blocked.retryAfterSeconds > 0 && blocked.retryAfterSeconds <= 60);
assert.equal(rateLimit("other", 3, 60_000, t0).ok, true, "keys are independent");
assert.equal(rateLimit("k", 3, 60_000, t0 + 60_001).ok, true, "window resets");
assert.equal(clientIp({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }), "203.0.113.7");
assert.equal(clientIp(new Headers({ "x-real-ip": "198.51.100.2" })), "198.51.100.2");
resetRateLimits();
let status = 0;
const res = { setHeader: () => undefined, status: (c: number) => ((status = c), { json: () => undefined }) };
const req = { headers: { "x-forwarded-for": "203.0.113.9" } };
assert.equal(limitedPagesApi(req, res, "login", 2, 60_000), false);
assert.equal(limitedPagesApi(req, res, "login", 2, 60_000), false);
assert.equal(limitedPagesApi(req, res, "login", 2, 60_000), true);
assert.equal(status, 429);
console.log("rate-limit tests passed");
