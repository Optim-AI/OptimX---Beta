/**
 * Phase 1C-1 — classification + LOCAL wallet migration tests.
 * Run: npx tsx lib/billing/video-seconds-migration.test.ts
 */

import 'dotenv/config';
import { config } from 'dotenv';
config({ path: '.env.local' });

import { randomUUID } from 'crypto';
import { Client } from 'pg';
import {
  classifyVideoWalletForSecondsMigration,
  convertSecondsBalancesToVideoCredits,
  VIDEO_SECONDS_CONVERSION_RATE,
  VIDEO_SECONDS_MIGRATION_SOURCE,
} from './video-seconds-migration';
import { CreditsDAO } from '@/database/models/Credits.dao';
import { db } from '@/database/client';
import { userCredits, creditHistory } from '@/database/schema';
import { eq, and, sql } from 'drizzle-orm';

function assert(cond: any, msg: string): asserts cond {
  if (!cond) throw new Error(`ASSERT: ${msg}`);
}

function assertLocal() {
  const u = new URL(process.env.DATABASE_URL!);
  assert(
    (u.hostname === 'localhost' || u.hostname === '127.0.0.1') && u.port === '54322',
    'Must target LOCAL localhost:54322'
  );
}

async function seedUser(
  client: Client,
  opts: {
    videoSub?: number;
    videoAddon?: number;
    imageSub?: number;
    imageAddon?: number;
    history?: Array<{
      amount: number;
      operation: string;
      source: string;
      metadata?: Record<string, unknown> | null;
    }>;
  }
) {
  const userId = randomUUID();
  const email = `mig-${userId.slice(0, 8)}@test.local`;
  await client.query(
    `INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
     VALUES ($1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', $2, crypt('test', gen_salt('bf')), now(), '{}', '{}', now(), now())`,
    [userId, email]
  );
  await client.query(
    `INSERT INTO user_credits (id, credits, image_credits_subscription, image_credits_addon, video_credits_subscription, video_credits_addon, updated_at)
     VALUES ($1, 0, $2, $3, $4, $5, now())
     ON CONFLICT (id) DO UPDATE SET
       image_credits_subscription = $2,
       image_credits_addon = $3,
       video_credits_subscription = $4,
       video_credits_addon = $5,
       updated_at = now()`,
    [
      userId,
      opts.imageSub ?? 5,
      opts.imageAddon ?? 10,
      opts.videoSub ?? 0,
      opts.videoAddon ?? 0,
    ]
  );
  for (const h of opts.history || []) {
    await client.query(
      `INSERT INTO credit_history (user_id, credit_type, amount, operation, source, balance_after, metadata)
       VALUES ($1, 'video', $2, $3, $4, $5, $6)`,
      [
        userId,
        h.amount,
        h.operation,
        h.source,
        h.amount,
        h.metadata ? JSON.stringify(h.metadata) : null,
      ]
    );
  }
  return userId;
}

async function cleanup(client: Client, userId: string) {
  await client.query(`DELETE FROM credit_history WHERE user_id = $1`, [userId]);
  await client.query(`DELETE FROM user_credits WHERE id = $1`, [userId]);
  await client.query(`DELETE FROM auth.users WHERE id = $1`, [userId]);
}

async function main() {
  assertLocal();
  console.log('=== Phase 1C-1 video-seconds-migration tests ===');

  // --- Pure classification / conversion ---
  {
    const c = convertSecondsBalancesToVideoCredits(30, 0);
    assert(c.addon === 0 && c.subscription === 600, '1: 30s sub → 600');
    const c2 = convertSecondsBalancesToVideoCredits(0, 30);
    assert(c2.addon === 600 && c2.subscription === 0, '1: 30s addon → 600');
    assert(VIDEO_SECONDS_CONVERSION_RATE === 20, 'rate 20');
    console.log('PASS 1: 30 seconds → 600 credits');
  }

  {
    const c = convertSecondsBalancesToVideoCredits(0, 0);
    assert(c.subscription === 0 && c.addon === 0, '2: 0→0');
    const d = classifyVideoWalletForSecondsMigration({
      videoCreditsSubscription: 0,
      videoCreditsAddon: 0,
      hasMigrationMarker: false,
      history: [],
    });
    assert(d.decision === 'skip_zero', '2: skip zero');
    console.log('PASS 2: 0 → 0');
  }

  {
    const d = classifyVideoWalletForSecondsMigration({
      videoCreditsSubscription: 0,
      videoCreditsAddon: 600,
      hasMigrationMarker: true,
      history: [
        {
          creditType: 'video',
          operation: 'migrate',
          source: VIDEO_SECONDS_MIGRATION_SOURCE,
          amount: 570,
        },
      ],
    });
    assert(d.decision === 'skip_already_migrated', '3: already migrated');
    console.log('PASS 3: already-migrated skipped (classify)');
  }

  {
    const d = classifyVideoWalletForSecondsMigration({
      videoCreditsSubscription: 0,
      videoCreditsAddon: 600,
      hasMigrationMarker: false,
      history: [
        {
          creditType: 'video',
          operation: 'add',
          source: 'welcome_bonus',
          amount: 600,
          metadata: { unit: 'video_credits', equivalentSeconds: 30 },
        },
      ],
    });
    assert(d.decision === 'skip_already_video_credits', '4: welcome not multiplied');
    console.log('PASS 4: new 600 welcome NOT classified for migrate');
  }

  {
    for (const amt of [1200, 2400, 4800]) {
      const d = classifyVideoWalletForSecondsMigration({
        videoCreditsSubscription: amt,
        videoCreditsAddon: 0,
        hasMigrationMarker: false,
        history: [
          {
            creditType: 'video',
            operation: 'reset',
            source: 'subscription_cycle',
            amount: amt,
            metadata: { unit: 'video_credits' },
          },
        ],
      });
      assert(d.decision === 'skip_already_video_credits', `5: cycle ${amt}`);
    }
    console.log('PASS 5: cycle 1200/2400/4800 NOT migrated');
  }

  {
    const d = classifyVideoWalletForSecondsMigration({
      videoCreditsSubscription: 0,
      videoCreditsAddon: 900,
      hasMigrationMarker: false,
      history: [
        {
          creditType: 'video',
          operation: 'add',
          source: 'addon_purchase',
          amount: 900,
          metadata: { unit: 'video_credits', paymentId: 'x' },
        },
      ],
    });
    assert(d.decision === 'skip_already_video_credits', '6: PAYG');
    console.log('PASS 6: new PAYG NOT migrated');
  }

  {
    const d = classifyVideoWalletForSecondsMigration({
      videoCreditsSubscription: 0,
      videoCreditsAddon: 50,
      hasMigrationMarker: false,
      history: [],
    });
    assert(d.decision === 'skip_ambiguous', '7: ambiguous no history');
    console.log('PASS 7: ambiguous skipped');
  }

  // --- DB integration ---
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  const users: string[] = [];

  try {
    // Legacy 30s addon
    const legacyId = await seedUser(client, {
      videoAddon: 30,
      imageSub: 100,
      imageAddon: 150,
      history: [
        { amount: 0, operation: 'add', source: 'subscription_init' },
        { amount: 30, operation: 'add', source: 'addon_purchase', metadata: null },
      ],
    });
    users.push(legacyId);

    const imgBefore = (
      await client.query(
        `SELECT image_credits_subscription, image_credits_addon FROM user_credits WHERE id=$1`,
        [legacyId]
      )
    ).rows[0];

    const histCountBefore = (
      await client.query(`SELECT COUNT(*)::int AS c FROM credit_history WHERE user_id=$1`, [
        legacyId,
      ])
    ).rows[0].c;

    const r1 = await CreditsDAO.migrateVideoSecondsToCredits(legacyId);
    assert(r1.success && !r1.skipped, `legacy migrate: ${r1.error || r1.skipReason}`);
    assert(r1.oldAddon === 30 && r1.newAddon === 600, 'legacy 30→600');
    assert(r1.oldSubscription === 0 && r1.newSubscription === 0, 'legacy sub 0');

    const after = (
      await client.query(
        `SELECT video_credits_subscription, video_credits_addon, image_credits_subscription, image_credits_addon
         FROM user_credits WHERE id=$1`,
        [legacyId]
      )
    ).rows[0];
    assert(after.video_credits_addon === 600, 'db addon 600');
    assert(after.image_credits_subscription === imgBefore.image_credits_subscription, '8: img sub');
    assert(after.image_credits_addon === imgBefore.image_credits_addon, '8: img addon');
    console.log('PASS 1/8 DB: 30→600; images unchanged');

    // Idempotent second run
    const r2 = await CreditsDAO.migrateVideoSecondsToCredits(legacyId);
    assert(r2.success && r2.skipped, '9: second skip');
    assert(r2.decision === 'skip_already_migrated', '9: already migrated');
    const after2 = (
      await client.query(`SELECT video_credits_addon FROM user_credits WHERE id=$1`, [legacyId])
    ).rows[0];
    assert(after2.video_credits_addon === 600, '9: still 600');
    const markers = (
      await client.query(
        `SELECT COUNT(*)::int AS c FROM credit_history
         WHERE user_id=$1 AND operation='migrate' AND source=$2 AND credit_type='video'`,
        [legacyId, VIDEO_SECONDS_MIGRATION_SOURCE]
      )
    ).rows[0].c;
    assert(markers === 1, '9: exactly one marker');
    console.log('PASS 3/9: idempotent second execution');

    // Historical rows not rewritten — count of non-migrate rows unchanged
    const histNonMigrate = (
      await client.query(
        `SELECT COUNT(*)::int AS c FROM credit_history WHERE user_id=$1 AND operation <> 'migrate'`,
        [legacyId]
      )
    ).rows[0].c;
    assert(histNonMigrate === histCountBefore, '11: historical rows unchanged count');
    console.log('PASS 11: historical credit_history not rewritten');

    // Welcome 600 not multiplied
    const welcomeId = await seedUser(client, {
      videoAddon: 600,
      history: [
        {
          amount: 600,
          operation: 'add',
          source: 'welcome_bonus',
          metadata: { unit: 'video_credits', equivalentSeconds: 30 },
        },
      ],
    });
    users.push(welcomeId);
    const rw = await CreditsDAO.migrateVideoSecondsToCredits(welcomeId);
    assert(rw.skipped && rw.decision === 'skip_already_video_credits', '4 db welcome');
    const wb = (
      await client.query(`SELECT video_credits_addon FROM user_credits WHERE id=$1`, [welcomeId])
    ).rows[0];
    assert(wb.video_credits_addon === 600, '4 still 600');
    console.log('PASS 4 DB: welcome not multiplied');

    // Cycle grant not multiplied
    const cycleId = await seedUser(client, {
      videoSub: 2400,
      history: [
        {
          amount: 2400,
          operation: 'reset',
          source: 'subscription_cycle',
          metadata: { unit: 'video_credits' },
        },
      ],
    });
    users.push(cycleId);
    const rc = await CreditsDAO.migrateVideoSecondsToCredits(cycleId);
    assert(rc.skipped, '5 db cycle skip');
    const cb = (
      await client.query(`SELECT video_credits_subscription FROM user_credits WHERE id=$1`, [
        cycleId,
      ])
    ).rows[0];
    assert(cb.video_credits_subscription === 2400, '5 still 2400');
    console.log('PASS 5 DB: cycle not multiplied');

    // PAYG not multiplied
    const paygId = await seedUser(client, {
      videoAddon: 900,
      history: [
        {
          amount: 900,
          operation: 'add',
          source: 'addon_purchase',
          metadata: { unit: 'video_credits' },
        },
      ],
    });
    users.push(paygId);
    const rp = await CreditsDAO.migrateVideoSecondsToCredits(paygId);
    assert(rp.skipped, '6 db payg');
    console.log('PASS 6 DB: PAYG not multiplied');

    // Ambiguous skipped
    const ambId = await seedUser(client, { videoAddon: 42, history: [] });
    users.push(ambId);
    const ra = await CreditsDAO.migrateVideoSecondsToCredits(ambId);
    assert(ra.skipped && ra.decision === 'skip_ambiguous', '7 db ambiguous');
    const ab = (
      await client.query(`SELECT video_credits_addon FROM user_credits WHERE id=$1`, [ambId])
    ).rows[0];
    assert(ab.video_credits_addon === 42, '7 unchanged');
    console.log('PASS 7 DB: ambiguous skipped');

    // Transaction rollback: unique marker conflict mid-flight simulation
    // Pre-insert marker then try convert would skip — instead force failed insert after
    // classifying by using raw SQL transaction that throws.
    const rollId = await seedUser(client, {
      videoAddon: 30,
      history: [{ amount: 30, operation: 'add', source: 'addon_purchase', metadata: null }],
    });
    users.push(rollId);
    let threw = false;
    try {
      await db.transaction(async (tx) => {
        await tx.execute(sql`SELECT * FROM user_credits WHERE id = ${rollId} FOR UPDATE`);
        await tx
          .update(userCredits)
          .set({ videoCreditsAddon: 600, updatedAt: new Date().toISOString() })
          .where(eq(userCredits.id, rollId));
        throw new Error('forced_rollback');
      });
    } catch (e: any) {
      threw = e.message === 'forced_rollback';
    }
    assert(threw, '10: threw');
    const rb = (
      await client.query(`SELECT video_credits_addon FROM user_credits WHERE id=$1`, [rollId])
    ).rows[0];
    assert(rb.video_credits_addon === 30, '10: rolled back to 30');
    console.log('PASS 10: transaction rollback restores wallet');

    // Marker uniqueness: second insert of migrate marker fails
    await client.query(
      `INSERT INTO credit_history (user_id, credit_type, amount, operation, source, balance_after, metadata)
       VALUES ($1, 'video', 570, 'migrate', $2, 600, '{}')`,
      [legacyId, VIDEO_SECONDS_MIGRATION_SOURCE]
    ).then(
      () => {
        throw new Error('duplicate marker should have failed');
      },
      (err: any) => {
        assert(
          err.code === '23505' || /unique|duplicate/i.test(String(err.message)),
          `unique index: ${err.message}`
        );
      }
    );
    console.log('PASS: unique migration marker index enforced');

    console.log('\n=== All Phase 1C-1 migration tests passed ===');
  } finally {
    for (const id of users) {
      try {
        await cleanup(client, id);
      } catch {
        /* ignore */
      }
    }
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
