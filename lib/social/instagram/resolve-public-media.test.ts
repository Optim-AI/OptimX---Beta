/**
 * Run: npx --yes tsx lib/social/instagram/resolve-public-media.test.ts
 */
import assert from "assert";
import { resolveInstagramPublishableMedia } from "@/lib/social/instagram/resolve-public-media";
import type { ResolveInstagramPublicMediaDeps } from "@/lib/social/instagram/resolve-public-media";

/** Minimal JPEG (1x1) */
const JPEG = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
  0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43,
  0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
  0x09, 0x08, 0x0a, 0x0c, 0x14, 0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12,
  0x13, 0x0f, 0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d, 0x1a, 0x1c, 0x1c, 0x20,
  0x24, 0x2e, 0x27, 0x20, 0x22, 0x2c, 0x23, 0x1c, 0x1c, 0x28, 0x37, 0x29,
  0x2c, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1f, 0x27, 0x39, 0x3d, 0x38, 0x32,
  0x3c, 0x2e, 0x33, 0x34, 0x32, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01,
  0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xc4, 0x00, 0x14, 0x00, 0x01,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x03, 0xff, 0xc4, 0x00, 0x14, 0x10, 0x01, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00,
  0x37, 0xff, 0xd9,
]);

const LOCAL_URL =
  "http://localhost:54321/storage/v1/object/public/campaign-assets/poster-generation/u/s/g.jpg";
const HOSTED_URL =
  "https://host.supabase.co/storage/v1/object/public/campaign-assets/poster.jpg";

const owned = {
  id: "img_1",
  userId: "user_1",
  imageUrl: LOCAL_URL,
  imagePath: "poster-generation/u/s/g.jpg",
  mediaType: "image" as const,
};

function baseDeps(
  overrides: Partial<ResolveInstagramPublicMediaDeps> = {}
): ResolveInstagramPublicMediaDeps {
  return {
    getImageByIdForUser: async (id, userId) =>
      id === owned.id && userId === owned.userId ? { ...owned } : null,
    findImageForUser: async () => null,
    downloadStorageObject: async () => ({ ok: true, buffer: JPEG }),
    getMediaHostConfig: () => ({
      ok: true,
      supabaseUrl: "https://host.supabase.co",
      serviceRoleKey: "host-key",
      bucket: "campaign-assets",
      source: "dedicated_host",
    }),
    validatePublicUrl: async (url) => {
      if (url.startsWith("https://") && !url.includes("localhost")) {
        return { ok: true, url, mediaKind: "image" };
      }
      return {
        ok: false,
        error: "localhost blocked",
        code: "localhost_or_insecure",
      };
    },
    probePublicUrl: async () => ({ ok: false }),
    uploadMirror: async () => ({ ok: true }),
    createHostClient: () => ({}) as any,
    ...overrides,
  };
}

async function main() {
  // Ownership required
  const noOwn = await resolveInstagramPublishableMedia({
    userId: "user_1",
    mediaUrl: LOCAL_URL,
    deps: {
      ...baseDeps(),
      getImageByIdForUser: async () => null,
      findImageForUser: async () => null,
    },
  });
  assert.ok(!noOwn.ok);
  assert.strictEqual((noOwn as any).code, "not_owned");

  const wrongUser = await resolveInstagramPublishableMedia({
    userId: "other",
    sourceImageId: "img_1",
    deps: baseDeps(),
  });
  assert.ok(!wrongUser.ok);
  assert.strictEqual((wrongUser as any).code, "not_owned");

  // Hosted HTTPS library URL reused (no mirror)
  const reuse = await resolveInstagramPublishableMedia({
    userId: "user_1",
    sourceImageId: "img_1",
    deps: baseDeps({
      getImageByIdForUser: async () => ({
        ...owned,
        imageUrl: HOSTED_URL,
        imagePath: "poster.jpg",
      }),
      uploadMirror: async () => {
        throw new Error("should not upload");
      },
    }),
  });
  assert.ok(reuse.ok);
  if (reuse.ok) {
    assert.strictEqual(reuse.url, HOSTED_URL);
    assert.strictEqual(reuse.reusedExisting, true);
    assert.strictEqual(reuse.mirrored, false);
  }

  // Local URL → mirror to hosted public path
  let uploads = 0;
  const mirrored = await resolveInstagramPublishableMedia({
    userId: "user_1",
    sourceImageId: "img_1",
    deps: baseDeps({
      uploadMirror: async (opts) => {
        uploads += 1;
        assert.strictEqual(opts.bucket, "campaign-assets");
        assert.ok(opts.objectPath.includes("instagram-publish/user_1/img_1"));
        assert.strictEqual(opts.contentType, "image/jpeg");
        return { ok: true };
      },
    }),
  });
  assert.ok(mirrored.ok);
  if (mirrored.ok) {
    assert.ok(mirrored.url.startsWith("https://host.supabase.co/"));
    assert.ok(mirrored.url.includes("instagram-publish/"));
    assert.strictEqual(mirrored.mirrored, true);
    assert.strictEqual(mirrored.reusedExisting, false);
  }
  assert.strictEqual(uploads, 1);

  // Existing mirror probed → skip upload
  uploads = 0;
  const probed = await resolveInstagramPublishableMedia({
    userId: "user_1",
    sourceImageId: "img_1",
    deps: baseDeps({
      probePublicUrl: async () => ({ ok: true }),
      uploadMirror: async () => {
        uploads += 1;
        return { ok: true };
      },
    }),
  });
  assert.ok(probed.ok);
  assert.strictEqual(uploads, 0);
  if (probed.ok) assert.strictEqual(probed.reusedExisting, true);

  // Media host not configured
  const noHost = await resolveInstagramPublishableMedia({
    userId: "user_1",
    sourceImageId: "img_1",
    deps: baseDeps({
      getMediaHostConfig: () => ({
        ok: false,
        code: "media_host_not_configured",
        error: "configure host",
      }),
    }),
  });
  assert.ok(!noHost.ok);
  assert.strictEqual((noHost as any).code, "media_host_not_configured");

  // Invalid format
  const badFmt = await resolveInstagramPublishableMedia({
    userId: "user_1",
    sourceImageId: "img_1",
    deps: baseDeps({
      downloadStorageObject: async () => ({
        ok: true,
        buffer: Buffer.from("not-an-image"),
      }),
    }),
  });
  assert.ok(!badFmt.ok);
  assert.strictEqual((badFmt as any).code, "invalid_format");

  // Upload failure
  const upFail = await resolveInstagramPublishableMedia({
    userId: "user_1",
    sourceImageId: "img_1",
    deps: baseDeps({
      uploadMirror: async () => ({ ok: false, error: "bucket denied" }),
    }),
  });
  assert.ok(!upFail.ok);
  assert.strictEqual((upFail as any).code, "mirror_upload_failed");

  // File too large
  const huge = Buffer.alloc(9 * 1024 * 1024);
  huge[0] = 0xff;
  huge[1] = 0xd8;
  huge[2] = 0xff;
  // still fails format if not full jpeg — use oversized valid-looking jpeg header + size check
  // detectPublishableMedia checks size after format — craft by patching: use JPEG magic then size
  const bigJpeg = Buffer.concat([JPEG.slice(0, 20), Buffer.alloc(9 * 1024 * 1024)]);
  // Fix: first 3 bytes jpeg
  bigJpeg[0] = 0xff;
  bigJpeg[1] = 0xd8;
  bigJpeg[2] = 0xff;
  const tooBig = await resolveInstagramPublishableMedia({
    userId: "user_1",
    sourceImageId: "img_1",
    deps: baseDeps({
      downloadStorageObject: async () => ({ ok: true, buffer: bigJpeg }),
    }),
  });
  assert.ok(!tooBig.ok);
  assert.strictEqual((tooBig as any).code, "file_too_large");

  console.log("instagram resolve-public-media.test: PASS");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
