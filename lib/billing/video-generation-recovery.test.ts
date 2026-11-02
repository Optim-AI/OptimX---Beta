/**
 * Video generation recovery — LOCAL ONLY (localhost:54322).
 * Run: npx tsx lib/billing/video-generation-recovery.test.ts
 *
 * A: a fresh in_progress generation lock still blocks a second claim.
 * B: an in_progress lock left by a dead request (older than the stale window) is reclaimed.
 * C: a video reservation held by a dead request is released before the next reserve;
 *    a fresh reservation is left alone.
 * D: a completed generation is never reclaimed (it was billed) and keeps its stored video.
 * E: free fixes are counted per original video; failed and paid fixes never use the allowance.
 */

import 'dotenv/config';
import { config } from 'dotenv';
config({ path: '.env.local' });

import { randomUUID } from 'crypto';
import { Client } from 'pg';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`ASSERT: ${msg}`);
}

async function main() {
  const u = new URL(process.env.DATABASE_URL!);
  assert(
    (u.hostname === 'localhost' || u.hostname === '127.0.0.1') && u.port === '54322',
    'Must target LOCAL localhost:54322'
  );
  console.log('=== video generation recovery tests (LOCAL) ===');

  const { GenerationLocksDAO, STALE_GENERATION_LOCK_MINUTES } = await import(
    '@/database/models/GenerationLocks.dao'
  );
  const { CreditsDAO } = await import('@/database/models/Credits.dao');
  const { assertAndReserveVideoCredits, STALE_VIDEO_RESERVATION_MINUTES } = await import(
    '@/lib/billing/video-billing'
  );
  const { getVideoCreditsForDuration } = await import('@/lib/billing/video-credits');

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  const userId = randomUUID();
  const email = `video-recovery-${userId.slice(0, 8)}@test.local`;
  const lockKey = `commercial:test-${userId.slice(0, 8)}:v1:15`;
  const cost15 = getVideoCreditsForDuration(15);

  const videoAddon = async () =>
    Number(
      (await client.query(`SELECT video_credits_addon FROM user_credits WHERE id = $1`, [userId]))
        .rows[0]?.video_credits_addon ?? 0
    );

  try {
    await client.query(
      `INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
       VALUES ($1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', $2, crypt('test', gen_salt('bf')), now(), '{}', '{}', now(), now())`,
      [userId, email]
    );
    await client.query(
      `INSERT INTO user_credits (id, credits, image_credits_subscription, image_credits_addon, video_credits_subscription, video_credits_addon, updated_at)
       VALUES ($1, 0, 0, 0, 0, $2, now())
       ON CONFLICT (id) DO UPDATE SET video_credits_addon = $2, updated_at = now()`,
      [userId, cost15 * 3]
    );

    // --- A: fresh in_progress lock blocks ---
    {
      const first = await GenerationLocksDAO.tryClaim({ lockKey, userId });
      assert(first.claimed, 'A: first claim succeeds');
      const second = await GenerationLocksDAO.tryClaim({ lockKey, userId });
      assert(!second.claimed && second.reason === 'in_progress', 'A: fresh lock blocks a second claim');
      console.log('PASS A: fresh in_progress lock blocks a second claim');
    }

    // --- B: stale in_progress lock is reclaimed ---
    {
      await client.query(
        `UPDATE generation_job_locks SET updated_at = now() - make_interval(mins => $2) WHERE lock_key = $1`,
        [lockKey, STALE_GENERATION_LOCK_MINUTES + 1]
      );
      const reclaimed = await GenerationLocksDAO.tryClaim({ lockKey, userId });
      assert(reclaimed.claimed, 'B: stale lock is reclaimed');
      assert(reclaimed.lock.status === 'in_progress', 'B: reclaimed lock is in_progress');
      const again = await GenerationLocksDAO.tryClaim({ lockKey, userId });
      assert(!again.claimed && again.reason === 'in_progress', 'B: reclaimed lock is fresh again');
      console.log('PASS B: stale in_progress lock reclaimed');
    }

    // --- C: stale reservation released before next reserve; fresh one kept ---
    {
      const start = await videoAddon();
      const dead = await CreditsDAO.reserveVideoCredits({
        userId,
        amount: cost15,
        referenceId: 'test:dead-request',
      });
      assert(dead.success && dead.reservationId, 'C: dead reservation created');
      assert((await videoAddon()) === start - cost15, 'C: reserve deducted credits');
      await client.query(
        `UPDATE credit_reservations SET created_at = now() - make_interval(mins => $2) WHERE id = $1`,
        [dead.reservationId, STALE_VIDEO_RESERVATION_MINUTES + 1]
      );

      const live = await assertAndReserveVideoCredits({
        userId,
        durationSeconds: 15,
        referenceId: 'test:live-request',
      });
      const deadStatus = (
        await client.query(`SELECT status FROM credit_reservations WHERE id = $1`, [dead.reservationId])
      ).rows[0]?.status;
      assert(deadStatus === 'released', `C: dead reservation released, got ${deadStatus}`);
      assert((await videoAddon()) === start - cost15, 'C: net balance holds only the live reservation');

      const released = await CreditsDAO.releaseStaleVideoReservations(
        userId,
        STALE_VIDEO_RESERVATION_MINUTES
      );
      assert(released === 0, 'C: fresh reservation is not swept');
      const liveStatus = (
        await client.query(`SELECT status FROM credit_reservations WHERE id = $1`, [live.reservationId])
      ).rows[0]?.status;
      assert(liveStatus === 'reserved', 'C: live reservation still reserved');
      console.log('PASS C: stale video reservation released, fresh one kept');
    }

    // --- D: completed lock is never re-run or re-billed ---
    {
      const doneKey = `${lockKey}:done`;
      const claim = await GenerationLocksDAO.tryClaim({ lockKey: doneKey, userId });
      assert(claim.claimed, 'D: first claim succeeds');
      await GenerationLocksDAO.markCompleted(doneKey, {
        generationVersion: 'v1',
        finalCommercial: { videoUrl: 'https://example.test/v1.mp4' },
      });
      const repeat = await GenerationLocksDAO.tryClaim({ lockKey: doneKey, userId });
      assert(!repeat.claimed && repeat.reason === 'completed', 'D: completed lock is not reclaimed');
      const stored = repeat.lock.resultSummary as { finalCommercial?: { videoUrl?: string } } | null;
      assert(
        stored?.finalCommercial?.videoUrl === 'https://example.test/v1.mp4',
        'D: completed lock keeps the finished video for a free replay'
      );
      console.log('PASS D: completed generation is never re-billed');
    }

    // --- E: free-fix allowance counts only completed free fixes of this video ---
    {
      const root = `${lockKey}:root`;
      const prefix = GenerationLocksDAO.fixKeyPrefix(root);
      const finish = async (id: string, free: boolean, ok = true) => {
        await GenerationLocksDAO.tryClaim({ lockKey: `${prefix}${id}`, userId });
        if (ok) await GenerationLocksDAO.markCompleted(`${prefix}${id}`, { free, finalCommercial: { videoUrl: 'x' } });
        else await GenerationLocksDAO.markFailed(`${prefix}${id}`, { error: 'edit failed' });
      };
      await finish('free-1', true);
      await finish('failed-1', true, false);
      await finish('paid-1', false);
      await finish('free-2', true);
      await GenerationLocksDAO.tryClaim({ lockKey: `fix:${lockKey}:elsewhere:free-x`, userId });
      await GenerationLocksDAO.markCompleted(`fix:${lockKey}:elsewhere:free-x`, { free: true });
      assert((await GenerationLocksDAO.countFreeFixes(userId, root)) === 2, 'E: only completed free fixes count');
      assert(!(await GenerationLocksDAO.hasActiveFix(userId, root)), 'E: no fix running');
      await GenerationLocksDAO.tryClaim({ lockKey: `${prefix}running`, userId });
      assert(await GenerationLocksDAO.hasActiveFix(userId, root), 'E: running fix detected');
      console.log('PASS E: free fixes counted per video; failed and paid fixes excluded');
    }

    console.log('\n=== All video generation recovery tests passed ===');
  } finally {
    try {
      await client.query(`DELETE FROM generation_job_locks WHERE user_id = $1`, [userId]);
      await client.query(`DELETE FROM credit_reservations WHERE user_id = $1`, [userId]);
      await client.query(`DELETE FROM credit_history WHERE user_id = $1`, [userId]);
      await client.query(`DELETE FROM user_credits WHERE id = $1`, [userId]);
      await client.query(`DELETE FROM auth.users WHERE id = $1`, [userId]);
    } catch (e) {
      console.warn('cleanup warning', e);
    }
    await client.end();
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
