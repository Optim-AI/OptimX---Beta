/**
 * Local social_posts persistence (requires local DATABASE_URL + migration applied).
 * Skips cleanly if social_posts table is missing.
 * Run: npx --yes tsx lib/social/facebook-publish/local-persistence.test.ts
 */
import assert from "assert";
import { randomUUID } from "crypto";
import { config } from "dotenv";
config({ path: ".env.local" });

process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY =
  process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY ||
  "skalx-social-publish-test-encryption-key-v1";

async function main() {
  if (!process.env.DATABASE_URL) {
    console.log("facebook-publish local-persistence.test: SKIP (no DATABASE_URL)");
    return;
  }

  const host = new URL(process.env.DATABASE_URL).hostname;
  if (host !== "localhost" && host !== "127.0.0.1") {
    console.log("facebook-publish local-persistence.test: SKIP (non-local DB)");
    return;
  }

  const { db } = await import("@/database/client");
  const { sql } = await import("drizzle-orm");

  try {
    await db.execute(sql`SELECT 1 FROM public.social_posts LIMIT 1`);
  } catch {
    console.log(
      "facebook-publish local-persistence.test: SKIP (social_posts missing — apply migration)"
    );
    return;
  }

  const { SocialPostDAO } = await import("@/database/models/SocialPost.dao");
  const { prepareTokensForStorage } = await import("@/lib/ads/crypto/tokens");
  const { IntegrationDAO } = await import("@/database/models/Integration.dao");
  const { socialPosts, integrations } = await import("@/database/schema");
  const { eq } = await import("drizzle-orm");

  const userId = randomUUID();
  let postId: string | null = null;
  let integrationId: string | null = null;

  try {
    await db.execute(sql`
      INSERT INTO auth.users (
        id, aud, role, email, encrypted_password, email_confirmed_at,
        created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
        is_super_admin, is_sso_user, is_anonymous
      ) VALUES (
        ${userId}::uuid, 'authenticated', 'authenticated',
        ${`social-test-${userId}@example.com`}, '', now(),
        now(), now(), '{"provider":"email"}'::jsonb, '{}'::jsonb,
        false, false, false
      )
      ON CONFLICT (id) DO NOTHING
    `);

    const prepared = prepareTokensForStorage({
      accessToken: "page-token-test",
      refreshToken: "user-token-test",
    });

    const integ = await IntegrationDAO.upsert({
      userId,
      provider: "meta-publish",
      pageId: "page_123",
      pageName: "Test Page",
      accessToken: prepared.accessToken,
      refreshToken: prepared.refreshToken,
      tokenEncrypted: prepared.tokenEncrypted,
      scopes: ["pages_manage_posts", "pages_show_list"],
      healthStatus: "healthy",
      raw: { purpose: "test" },
      metadata: { purpose: "facebook_page_publish" },
    });
    integrationId = integ.id;

    const draft = await SocialPostDAO.create({
      userId,
      integrationId,
      sourceImageUrl:
        "https://example.supabase.co/storage/v1/object/public/campaign-assets/t.png",
      caption: "Draft caption",
      status: "draft",
      destinationPageId: "page_123",
      destinationPageName: "Test Page",
    });
    postId = draft.id;
    assert.strictEqual(draft.status, "draft");

    const publishing = await SocialPostDAO.update(draft.id, userId, {
      status: "publishing",
    });
    assert.ok(publishing);
    assert.strictEqual(publishing!.status, "publishing");

    const published = await SocialPostDAO.update(draft.id, userId, {
      status: "published",
      metaPostId: "page_123_999",
      metaPhotoId: "photo_999",
      permalink: "https://www.facebook.com/page_123_999",
      publishedAt: new Date().toISOString(),
      errorMessage: null,
    });
    assert.ok(published);
    assert.strictEqual(published!.status, "published");
    assert.ok(!("pageAccessToken" in (published as any)));

    const otherUser = await SocialPostDAO.findByIdForUser(draft.id, randomUUID());
    assert.strictEqual(otherUser, null, "RLS-style DAO ownership must hide other users");

    const dup = await SocialPostDAO.findByMetaPostId(userId, "page_123_999");
    assert.ok(dup);

    console.log("facebook-publish local-persistence.test: PASS");
  } finally {
    if (postId) {
      await db.delete(socialPosts).where(eq(socialPosts.id, postId));
    }
    if (integrationId) {
      await db.delete(integrations).where(eq(integrations.id, integrationId));
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
