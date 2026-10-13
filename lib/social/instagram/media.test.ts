/**
 * Run: npx --yes tsx lib/social/instagram/media.test.ts
 */
import assert from "assert";
import {
  classifyMediaKindFromUrl,
  validateCaption,
  validateInstagramPublicMediaUrl,
} from "@/lib/social/instagram/media";

assert.strictEqual(classifyMediaKindFromUrl("https://cdn.example/a.png"), "image");
assert.strictEqual(classifyMediaKindFromUrl("https://cdn.example/a.mp4"), "video");
assert.strictEqual(
  classifyMediaKindFromUrl("https://cdn.example/x", "video"),
  "video"
);

assert.ok(validateCaption("hi").ok);
assert.ok(!validateCaption("x".repeat(2201)).ok);

async function main() {
  const data = await validateInstagramPublicMediaUrl("data:image/png;base64,xx");
  assert.ok(!data.ok);

  const local = await validateInstagramPublicMediaUrl(
    "http://localhost:54321/storage/v1/object/public/campaign-assets/a.png"
  );
  assert.ok(!local.ok);
  assert.strictEqual((local as any).code, "localhost_or_insecure");

  const http = await validateInstagramPublicMediaUrl(
    "http://cdn.example.com/a.png"
  );
  assert.ok(!http.ok);

  const pub = await validateInstagramPublicMediaUrl(
    "https://xyz.supabase.co/storage/v1/object/public/campaign-assets/a.png",
    {
      lookupFn: async () => [{ address: "8.8.8.8", family: 4 }] as any,
    }
  );
  assert.ok(pub.ok);
  if (pub.ok) assert.strictEqual(pub.mediaKind, "image");

  const privateHost = await validateInstagramPublicMediaUrl(
    "https://internal.example/a.png",
    {
      lookupFn: async () => [{ address: "10.0.0.2", family: 4 }] as any,
    }
  );
  assert.ok(!privateHost.ok);
  assert.strictEqual((privateHost as any).code, "ssrf_blocked");

  console.log("instagram media.test: PASS");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
