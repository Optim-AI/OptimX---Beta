/**
 * Concurrent claimForPublish — only one winner may Graph-publish.
 * Run: npx --yes tsx lib/social/publishing/claim-concurrency.test.ts
 */
import assert from "assert";
import { randomUUID } from "crypto";
import { config } from "dotenv";
config({ path: ".env.local" });

process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY =
  process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY ||
  "skalx-claim-concurrency-test-encryption-key-v1";

async function main() {
  if (!process.env.DATABASE_URL) {
    console.log("claim-concurrency.test: SKIP (no DATABASE_URL)");
    return;
  }
  const host = new URL(process.env.DATABASE_URL).hostname;
  if (host !== "localhost" && host !== "127.0.0.1") {
    console.log("claim-concurrency.test: SKIP (non-local DB)");
    return;
  }

  const { db } = await import("@/database/client");
  const { sql, eq } = await import("drizzle-orm");
  const { SocialPostDAO } = await import("@/database/models/SocialPost.dao");
  const { socialPosts } = await import("@/database/schema");
  const { evaluateSocialPostForPublish } = await import(
    "@/lib/social/publishing/social-post-guards"
  );

  const userId = randomUUID();
  let postId: string | null = null;

  try {
    await db.execute(sql`
      INSERT INTO auth.users (
        id, aud, role, email, encrypted_password, email_confirmed_at,
        created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
        is_super_admin, is_sso_user, is_anonymous
      ) VALUES (
        ${userId}::uuid, 'authenticated', 'authenticated',
        ${`claim-test-${userId}@example.com`}, '', now(),
        now(), now(), '{"provider":"email"}'::jsonb, '{}'::jsonb,
        false, false, false
      )
      ON CONFLICT (id) DO NOTHING
    `);

    const draft = await SocialPostDAO.create({
      userId,
      provider: "meta-publish",
      sourceImageUrl:
        "https://example.supabase.co/storage/v1/object/public/campaign-assets/t.png",
      caption: "Concurrency draft",
      status: "draft",
      destinationPageId: "page_1",
    });
    postId = draft.id;

    const [a, b] = await Promise.all([
      SocialPostDAO.claimForPublish(draft.id, userId, { caption: "A" }),
      SocialPostDAO.claimForPublish(draft.id, userId, { caption: "B" }),
    ]);

    const winners = [a, b].filter(Boolean);
    assert.strictEqual(winners.length, 1, "exactly one concurrent claim must win");
    assert.strictEqual(winners[0]!.status, "publishing");

    const loser = a && b ? null : a || b;
    assert.ok(loser === null || (a && !b) || (!a && b));

    // Loser path: evaluate as publish_in_progress
    const existing = await SocialPostDAO.findByIdForUser(draft.id, userId);
    assert.ok(existing);
    const guard = evaluateSocialPostForPublish({
      existing: existing!,
      expectedProvider: "meta-publish",
      userId,
    });
    assert.ok(!guard.ok);
    assert.strictEqual((guard as any).code, "publish_in_progress");

    // Foreign user cannot claim
    const foreign = await SocialPostDAO.claimForPublish(draft.id, randomUUID(), {});
    assert.strictEqual(foreign, null);

    // Confirmed failure can be reclaimed; ambiguous cannot without force (guard-level)
    await SocialPostDAO.update(draft.id, userId, {
      status: "failed",
      errorMessage: "confirmed",
      metadata: { ambiguous: false },
    });
    const reclaimed = await SocialPostDAO.claimForPublish(draft.id, userId, {});
    assert.ok(reclaimed);
    assert.strictEqual(reclaimed!.status, "publishing");

    await SocialPostDAO.update(draft.id, userId, {
      status: "failed",
      errorMessage: "timeout",
      metadata: { ambiguous: true },
    });
    const amb = evaluateSocialPostForPublish({
      existing: (await SocialPostDAO.findByIdForUser(draft.id, userId))!,
      expectedProvider: "meta-publish",
      userId,
    });
    assert.ok(!amb.ok);
    assert.strictEqual((amb as any).code, "ambiguous_prior");

    const forced = evaluateSocialPostForPublish({
      existing: (await SocialPostDAO.findByIdForUser(draft.id, userId))!,
      expectedProvider: "meta-publish",
      userId,
      forceRetry: true,
    });
    assert.ok(forced.ok);

    console.log("claim-concurrency.test: PASS");
  } finally {
    if (postId) {
      await db.delete(socialPosts).where(eq(socialPosts.id, postId));
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
