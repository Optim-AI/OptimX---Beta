/**
 * Local library persistence + ownership isolation.
 * Run: npx --yes tsx lib/social/generated-contents/local-persistence.test.ts
 */
import assert from "assert";
import { randomUUID } from "crypto";
import { config } from "dotenv";
config({ path: ".env.local" });

process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY =
  process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY ||
  "skalx-generated-contents-test-encryption-key-v1";

async function main() {
  if (!process.env.DATABASE_URL) {
    console.log("generated-contents local-persistence.test: SKIP (no DATABASE_URL)");
    return;
  }
  const host = new URL(process.env.DATABASE_URL).hostname;
  if (host !== "localhost" && host !== "127.0.0.1") {
    console.log("generated-contents local-persistence.test: SKIP (non-local DB)");
    return;
  }

  const { db } = await import("@/database/client");
  const { sql, eq } = await import("drizzle-orm");
  const { recordGeneratedCreative } = await import(
    "@/lib/social/generated-contents/record"
  );
  const { GeneratedImageDAO } = await import(
    "@/database/models/GeneratedImage.dao"
  );
  const { userGeneratedImage } = await import("@/database/schema");

  const userId = randomUUID();
  let id: string | null = null;

  try {
    await db.execute(sql`
      INSERT INTO auth.users (
        id, aud, role, email, encrypted_password, email_confirmed_at,
        created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
        is_super_admin, is_sso_user, is_anonymous
      ) VALUES (
        ${userId}::uuid, 'authenticated', 'authenticated',
        ${`gc-test-${userId}@example.com`}, '', now(),
        now(), now(), '{"provider":"email"}'::jsonb, '{}'::jsonb,
        false, false, false
      )
      ON CONFLICT (id) DO NOTHING
    `);

    const path = `poster-generation/${userId}/sess/gen1.png`;
    const url = `https://example.supabase.co/storage/v1/object/public/campaign-assets/${path}`;

    const first = await recordGeneratedCreative({
      userId,
      mediaUrl: url,
      storagePath: path,
      mediaType: "image",
      source: "test",
    });
    assert.ok(first?.created);
    id = first!.id;

    const second = await recordGeneratedCreative({
      userId,
      mediaUrl: url,
      storagePath: path,
      mediaType: "image",
      source: "test-retry",
    });
    assert.ok(second);
    assert.strictEqual(second!.id, first!.id);
    assert.strictEqual(second!.created, false, "retry must not duplicate");

    const other = await GeneratedImageDAO.getByIdForUser(first!.id, randomUUID());
    assert.strictEqual(other, null);

    const listed = await GeneratedImageDAO.listForUser({
      userId,
      mediaType: "image",
      limit: 10,
    });
    assert.ok(listed.total >= 1);

    console.log("generated-contents local-persistence.test: PASS");
  } finally {
    if (id) {
      await db.delete(userGeneratedImage).where(eq(userGeneratedImage.id, id));
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
