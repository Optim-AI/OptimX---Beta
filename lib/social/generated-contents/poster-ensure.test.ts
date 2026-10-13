/**
 * Poster → Instagram ownership / ensure regression.
 * Covers: owned poster after ensure, missing library, cross-user id, media resolve.
 * Run: npx --yes tsx lib/social/generated-contents/poster-ensure.test.ts
 */
import assert from "assert";
import { randomUUID } from "crypto";
import { config } from "dotenv";
config({ path: ".env.local" });

process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY =
  process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY ||
  "skalx-poster-ensure-test-encryption-key-v1";

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

async function main() {
  if (!process.env.DATABASE_URL) {
    console.log("poster-ensure.test: SKIP (no DATABASE_URL)");
    return;
  }
  const host = new URL(process.env.DATABASE_URL).hostname;
  if (host !== "localhost" && host !== "127.0.0.1") {
    console.log("poster-ensure.test: SKIP (non-local DB)");
    return;
  }

  const { db } = await import("@/database/client");
  const { sql, eq, or } = await import("drizzle-orm");
  const { recordGeneratedCreative } = await import(
    "@/lib/social/generated-contents/record"
  );
  const { assertEnsureableStoragePath } = await import(
    "@/lib/social/generated-contents/ensure-ownership"
  );
  const { GeneratedImageDAO } = await import(
    "@/database/models/GeneratedImage.dao"
  );
  const { userGeneratedImage } = await import("@/database/schema");
  const { resolveInstagramPublishableMedia } = await import(
    "@/lib/social/instagram/resolve-public-media"
  );
  const { createDefaultInstagramMediaResolveDeps } = await import(
    "@/lib/social/instagram/resolve-public-media"
  );

  const ownerId = randomUUID();
  const otherId = randomUUID();
  const ids: string[] = [];

  try {
    for (const uid of [ownerId, otherId]) {
      await db.execute(sql`
        INSERT INTO auth.users (
          id, aud, role, email, encrypted_password, email_confirmed_at,
          created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
          is_super_admin, is_sso_user, is_anonymous
        ) VALUES (
          ${uid}::uuid, 'authenticated', 'authenticated',
          ${`poster-ensure-${uid}@example.com`}, '', now(),
          now(), now(), '{"provider":"email"}'::jsonb, '{}'::jsonb,
          false, false, false
        )
        ON CONFLICT (id) DO NOTHING
      `);
    }

    const path = `poster-generation/${ownerId}/sess/poster1.jpg`;
    const mediaUrl = `https://example.supabase.co/storage/v1/object/public/campaign-assets/${path}`;
    const hostedUrl =
      "https://host.supabase.co/storage/v1/object/public/campaign-assets/mirrored-poster.jpg";

    // --- Missing library record → IG resolve not_owned ---
    const depsBase = await createDefaultInstagramMediaResolveDeps();
    const missing = await resolveInstagramPublishableMedia({
      userId: ownerId,
      mediaUrl,
      mediaTypeHint: "image",
      deps: {
        ...depsBase,
        validatePublicUrl: async () => ({
          ok: true,
          url: hostedUrl,
          mediaKind: "image" as const,
        }),
      },
    });
    assert.ok(!missing.ok);
    assert.strictEqual((missing as any).code, "not_owned");

    // --- Ensure (record) for owner → publish resolve succeeds ---
    const pathCheck = assertEnsureableStoragePath({
      userId: ownerId,
      storagePath: path,
    });
    assert.ok(pathCheck.ok);

    const foreignPath = assertEnsureableStoragePath({
      userId: otherId,
      storagePath: path,
    });
    assert.ok(!foreignPath.ok, "other user must not ensure owner poster path");

    const recorded = await recordGeneratedCreative({
      userId: ownerId,
      mediaUrl,
      storagePath: path,
      mediaType: "image",
      source: "poster-studio",
    });
    assert.ok(recorded?.id);
    ids.push(recorded!.id);

    // Cross-user claim by path rejected via DAO
    const anyRow = await GeneratedImageDAO.findAnyByPathOrUrl({
      imagePath: path,
      imageUrl: mediaUrl,
    });
    assert.ok(anyRow);
    assert.strictEqual(anyRow!.userId, ownerId);
    assert.notStrictEqual(anyRow!.userId, otherId);

    // Owned poster (by id) resolves for media publish
    const owned = await resolveInstagramPublishableMedia({
      userId: ownerId,
      sourceImageId: recorded!.id,
      mediaUrl,
      mediaTypeHint: "image",
      deps: {
        ...depsBase,
        downloadStorageObject: async () => ({ ok: true, buffer: JPEG }),
        getMediaHostConfig: () => ({
          ok: true as const,
          supabaseUrl: "https://host.supabase.co",
          serviceRoleKey: "test-key",
          bucket: "campaign-assets",
          source: "dedicated_host" as const,
        }),
        validatePublicUrl: async (url) => {
          if (url.includes("host.supabase.co") || url.includes("mirrored")) {
            return { ok: true, url: hostedUrl, mediaKind: "image" };
          }
          // Local/example library URL needs mirror
          return {
            ok: false,
            error: "not public to Meta",
            code: "localhost_or_insecure",
          };
        },
        probePublicUrl: async () => ({ ok: true as const }),
        uploadMirror: async () => ({ ok: true as const }),
        createHostClient: () =>
          ({
            storage: {
              from: () => ({
                upload: async () => ({ error: null }),
                getPublicUrl: () => ({ data: { publicUrl: hostedUrl } }),
              }),
            },
          }) as any,
      },
    });
    assert.ok(owned.ok, (owned as any).error);
    if (owned.ok) {
      assert.ok(owned.url.startsWith("https://"));
      assert.strictEqual(owned.sourceImageId, recorded!.id);
    }

    // Cross-user creative id → not_owned (never trust client id alone)
    const stolen = await resolveInstagramPublishableMedia({
      userId: otherId,
      sourceImageId: recorded!.id,
      deps: depsBase,
    });
    assert.ok(!stolen.ok);
    assert.strictEqual((stolen as any).code, "not_owned");

    console.log("poster-ensure.test: PASS");
  } finally {
    if (ids.length) {
      await db
        .delete(userGeneratedImage)
        .where(
          or(...ids.map((id) => eq(userGeneratedImage.id, id)))
        );
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
