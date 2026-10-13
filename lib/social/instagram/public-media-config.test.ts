/**
 * Run: npx --yes tsx lib/social/instagram/public-media-config.test.ts
 */
import assert from "assert";
import {
  buildInstagramMirrorObjectPath,
  buildPublicStorageObjectUrl,
  getInstagramMediaHostConfig,
  isPublicHttpsSupabaseOrigin,
  normalizeSupabaseOrigin,
} from "@/lib/social/instagram/public-media-config";

assert.strictEqual(
  normalizeSupabaseOrigin("https://abc.supabase.co/"),
  "https://abc.supabase.co"
);
assert.ok(isPublicHttpsSupabaseOrigin("https://abc.supabase.co"));
assert.ok(!isPublicHttpsSupabaseOrigin("http://localhost:54321"));
assert.ok(!isPublicHttpsSupabaseOrigin("https://127.0.0.1"));
assert.ok(
  !isPublicHttpsSupabaseOrigin(
    "https://eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSJ9.sig"
  ),
  "JWT pasted as URL must be rejected"
);

const jwtAsUrl = getInstagramMediaHostConfig({
  NEXT_PUBLIC_SUPABASE_URL: "http://localhost:54321",
  SUPABASE_SERVICE_ROLE_KEY: "local-key",
  INSTAGRAM_MEDIA_HOST_SUPABASE_URL:
    "https://eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJvbGUiOiJhbm9uIn0.sig",
  INSTAGRAM_MEDIA_HOST_SUPABASE_SERVICE_ROLE_KEY: "host-key",
});
assert.ok(!jwtAsUrl.ok);
assert.strictEqual((jwtAsUrl as any).code, "media_host_insecure");
assert.ok(/API key|JWT|Project URL/i.test((jwtAsUrl as any).error));

const localEnv: Record<string, string | undefined> = {
  NEXT_PUBLIC_SUPABASE_URL: "http://localhost:54321",
  SUPABASE_SERVICE_ROLE_KEY: "local-key",
};

const missing = getInstagramMediaHostConfig(localEnv);
assert.ok(!missing.ok);
assert.strictEqual((missing as any).code, "media_host_not_configured");

const insecureHost = getInstagramMediaHostConfig({
  ...localEnv,
  INSTAGRAM_MEDIA_HOST_SUPABASE_URL: "http://localhost:54321",
  INSTAGRAM_MEDIA_HOST_SUPABASE_SERVICE_ROLE_KEY: "x",
});
assert.ok(!insecureHost.ok);
assert.strictEqual((insecureHost as any).code, "media_host_insecure");

const dedicated = getInstagramMediaHostConfig({
  ...localEnv,
  INSTAGRAM_MEDIA_HOST_SUPABASE_URL: "https://host.supabase.co",
  INSTAGRAM_MEDIA_HOST_SUPABASE_SERVICE_ROLE_KEY: "host-key",
});
assert.ok(dedicated.ok);
if (dedicated.ok) {
  assert.strictEqual(dedicated.source, "dedicated_host");
  assert.strictEqual(dedicated.supabaseUrl, "https://host.supabase.co");
  assert.strictEqual(dedicated.bucket, "campaign-assets");
}

const primary = getInstagramMediaHostConfig({
  NEXT_PUBLIC_SUPABASE_URL: "https://prod.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "prod-key",
});
assert.ok(primary.ok);
if (primary.ok) {
  assert.strictEqual(primary.source, "primary");
}

const path = buildInstagramMirrorObjectPath({
  userId: "user-1",
  creativeId: "img_99",
  extension: "jpg",
});
assert.strictEqual(path, "instagram-publish/user-1/img_99.jpg");

const url = buildPublicStorageObjectUrl(
  "https://host.supabase.co",
  "campaign-assets",
  path
);
assert.strictEqual(
  url,
  "https://host.supabase.co/storage/v1/object/public/campaign-assets/instagram-publish/user-1/img_99.jpg"
);

console.log("instagram public-media-config.test: PASS");
