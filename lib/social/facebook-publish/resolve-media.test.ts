/**
 * Run: npx --yes tsx lib/social/facebook-publish/resolve-media.test.ts
 */
import assert from "assert";
import {
  assertPublicHostname,
  classifyMetaImageUrlStrategy,
  extractPublicStorageObjectPath,
  isPrivateOrReservedIp,
  resolvePublishImageSource,
  safeFetchImageBytes,
  type ResolvePublishImageDeps,
} from "@/lib/social/facebook-publish/resolve-media";

assert.strictEqual(isPrivateOrReservedIp("127.0.0.1"), true);
assert.strictEqual(isPrivateOrReservedIp("10.0.0.1"), true);
assert.strictEqual(isPrivateOrReservedIp("192.168.1.1"), true);
assert.strictEqual(isPrivateOrReservedIp("172.16.0.1"), true);
assert.strictEqual(isPrivateOrReservedIp("8.8.8.8"), false);

assert.strictEqual(
  classifyMetaImageUrlStrategy(
    "http://localhost:54321/storage/v1/object/public/campaign-assets/a.jpg"
  ),
  "multipart_local"
);
assert.strictEqual(
  classifyMetaImageUrlStrategy(
    "https://xyz.supabase.co/storage/v1/object/public/campaign-assets/a.jpg"
  ),
  "meta_url"
);
assert.strictEqual(
  classifyMetaImageUrlStrategy("data:image/png;base64,xx"),
  "reject"
);
assert.strictEqual(
  classifyMetaImageUrlStrategy("http://evil.example/img.png"),
  "reject"
);

assert.deepStrictEqual(
  extractPublicStorageObjectPath(
    "http://localhost:54321/storage/v1/object/public/campaign-assets/poster-generation/u/s/g.jpg"
  ),
  {
    bucket: "campaign-assets",
    path: "poster-generation/u/s/g.jpg",
  }
);

const jpegBytes = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0xff,
  0xd9,
]);

function mockDeps(overrides?: Partial<ResolvePublishImageDeps>): ResolvePublishImageDeps {
  const owned = {
    id: "img-1",
    userId: "user-1",
    imageUrl:
      "http://localhost:54321/storage/v1/object/public/campaign-assets/poster-generation/u/s/g.jpg",
    imagePath: "poster-generation/u/s/g.jpg",
    mediaType: "image",
  };
  return {
    getImageByIdForUser: async (id, userId) =>
      id === owned.id && userId === owned.userId ? owned : null,
    findImageForUser: async ({ userId, imagePath, imageUrl }) => {
      if (userId !== owned.userId) return null;
      if (imagePath === owned.imagePath || imageUrl === owned.imageUrl) return owned;
      return null;
    },
    downloadStorageObject: async (_bucket, path) => {
      if (path === owned.imagePath) return { ok: true, buffer: jpegBytes };
      return { ok: false, error: "not_found" };
    },
    lookupFn: async () => [{ address: "8.8.8.8", family: 4 }] as any,
    ...overrides,
  };
}

async function main() {
  // Localhost owned → multipart, never Meta url
  const local = await resolvePublishImageSource({
    userId: "user-1",
    sourceImageId: "img-1",
    imageUrl:
      "http://localhost:54321/storage/v1/object/public/campaign-assets/poster-generation/u/s/g.jpg",
    deps: mockDeps(),
  });
  assert.ok(local.ok);
  if (local.ok) {
    assert.strictEqual(local.image.mode, "multipart");
    if (local.image.mode === "multipart") {
      assert.strictEqual(local.image.contentType, "image/jpeg");
      assert.strictEqual(local.image.filename, "photo.jpg");
      assert.ok(local.image.buffer.equals(jpegBytes));
    }
  }

  // Public HTTPS → url mode
  const publicUrl =
    "https://xyz.supabase.co/storage/v1/object/public/campaign-assets/poster.png";
  const pub = await resolvePublishImageSource({
    userId: "user-1",
    imageUrl: publicUrl,
    deps: mockDeps({
      findImageForUser: async () => null,
      getImageByIdForUser: async () => null,
    }),
  });
  assert.ok(pub.ok);
  if (pub.ok) {
    assert.strictEqual(pub.image.mode, "url");
    if (pub.image.mode === "url") {
      assert.strictEqual(pub.image.url, publicUrl);
    }
  }

  // Ownership required for localhost
  const unowned = await resolvePublishImageSource({
    userId: "user-1",
    imageUrl:
      "http://localhost:54321/storage/v1/object/public/campaign-assets/other.png",
    deps: mockDeps({
      findImageForUser: async () => null,
      getImageByIdForUser: async () => null,
    }),
  });
  assert.ok(!unowned.ok);
  assert.strictEqual((unowned as any).code, "not_owned");

  // Wrong owner on id
  const stolen = await resolvePublishImageSource({
    userId: "user-2",
    sourceImageId: "img-1",
    deps: mockDeps(),
  });
  assert.ok(!stolen.ok);
  assert.strictEqual((stolen as any).code, "not_owned");

  // Missing storage object
  const missing = await resolvePublishImageSource({
    userId: "user-1",
    sourceImageId: "img-1",
    deps: mockDeps({
      downloadStorageObject: async () => ({ ok: false, error: "not_found" }),
      fetchBytes: async () => ({
        ok: false,
        error: "Image URL returned HTTP 404",
        code: "fetch_failed",
      }),
    }),
  });
  assert.ok(!missing.ok);

  // Invalid image bytes
  const badBytes = await resolvePublishImageSource({
    userId: "user-1",
    sourceImageId: "img-1",
    deps: mockDeps({
      downloadStorageObject: async () => ({
        ok: true,
        buffer: Buffer.from("not-an-image!!!!"),
      }),
    }),
  });
  assert.ok(!badBytes.ok);
  assert.strictEqual((badBytes as any).code, "invalid_image");

  // Oversized
  const huge = Buffer.alloc(10 * 1024 * 1024 + 1, 0xff);
  huge[0] = 0xff;
  huge[1] = 0xd8;
  huge[2] = 0xff;
  const oversized = await resolvePublishImageSource({
    userId: "user-1",
    sourceImageId: "img-1",
    deps: mockDeps({
      downloadStorageObject: async () => ({ ok: true, buffer: huge }),
    }),
  });
  assert.ok(!oversized.ok);
  assert.strictEqual((oversized as any).code, "image_too_large");

  // SSRF: hostname resolves private
  const privateHost = await assertPublicHostname("evil.local.test", async () => [
    { address: "10.0.0.5", family: 4 },
  ] as any);
  assert.ok(!privateHost.ok);

  // Redirect to private blocked
  const redirectPrivate = await safeFetchImageBytes(
    "https://cdn.example/img.jpg",
    {
      lookupFn: async (host) => {
        if (String(host).includes("cdn.example")) {
          return [{ address: "8.8.8.8", family: 4 }] as any;
        }
        return [{ address: "192.168.0.1", family: 4 }] as any;
      },
      fetchFn: async (url) => {
        if (String(url).includes("cdn.example")) {
          return new Response(null, {
            status: 302,
            headers: { Location: "https://internal.example/secret.jpg" },
          });
        }
        return new Response("nope", { status: 200 });
      },
    }
  );
  assert.ok(!redirectPrivate.ok);
  assert.strictEqual(redirectPrivate.code, "ssrf_blocked");

  console.log("facebook-publish resolve-media.test: PASS");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
