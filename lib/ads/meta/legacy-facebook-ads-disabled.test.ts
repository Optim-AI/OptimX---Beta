/**
 * Legacy Meta Ads write route — disabled (PR W1.1).
 * Run: npx --yes tsx lib/ads/meta/legacy-facebook-ads-disabled.test.ts
 *
 * No live Meta Graph calls.
 */
import assert from "assert";
import fs from "fs";
import path from "path";
import type { NextApiRequest, NextApiResponse } from "next";
import handler, {
  LEGACY_META_ADS_WRITE_DISABLED,
  LEGACY_META_ADS_WRITE_DISABLED_MESSAGE,
  respondLegacyMetaAdsWriteDisabled,
} from "@/pages/api/auth/facebook/ads";

type MockRes = NextApiResponse & {
  statusCode: number;
  body: unknown;
  headers: Record<string, string>;
};

function mockRes(): MockRes {
  const res = {
    statusCode: 200,
    body: null as unknown,
    headers: {} as Record<string, string>,
    setHeader(key: string, value: string) {
      this.headers[key] = value;
      return this;
    },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
  return res as MockRes;
}

function mockReq(method: string, body?: unknown): NextApiRequest {
  return { method, body } as NextApiRequest;
}

// Module must not contain Graph / campaign mutation helpers
{
  const src = fs.readFileSync(
    path.join(process.cwd(), "pages/api/auth/facebook/ads.ts"),
    "utf8"
  );
  assert.ok(!src.includes("graph.facebook.com"), "must not call Graph");
  assert.ok(!src.includes("discoverAdAccount"), "must not discover ad accounts");
  assert.ok(!src.includes("createCampaign"), "must not create campaigns");
  assert.ok(!src.includes("daily_budget"), "must not set budgets");
  assert.ok(!src.includes("uploadImageGetHash"), "must not upload ad images");
}

// POST → 410 with stable code
{
  const res = mockRes();
  handler(mockReq("POST", { campaignName: "x", budget: 100, adSetName: "y" }), res);
  assert.strictEqual(res.statusCode, 410);
  assert.deepStrictEqual(res.body, {
    error: LEGACY_META_ADS_WRITE_DISABLED,
    message: LEGACY_META_ADS_WRITE_DISABLED_MESSAGE,
  });
  assert.strictEqual(LEGACY_META_ADS_WRITE_DISABLED, "legacy_meta_ads_write_disabled");
}

// Helper is pure 410 (no side effects beyond response)
{
  const res = mockRes();
  respondLegacyMetaAdsWriteDisabled(res);
  assert.strictEqual(res.statusCode, 410);
  assert.strictEqual(
    (res.body as { error: string }).error,
    "legacy_meta_ads_write_disabled"
  );
}

// Unsupported methods → 405; never execute mutation success path
for (const method of ["GET", "PUT", "PATCH", "DELETE", "OPTIONS"]) {
  const res = mockRes();
  handler(mockReq(method), res);
  assert.strictEqual(res.statusCode, 405, method);
  assert.strictEqual(res.headers.Allow, "POST");
  assert.notStrictEqual(
    (res.body as { error?: string } | null)?.error,
    LEGACY_META_ADS_WRITE_DISABLED
  );
}

console.log("legacy-facebook-ads-disabled.test.ts: ok");
