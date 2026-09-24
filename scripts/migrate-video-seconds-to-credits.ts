/**
 * Classification-based migration: user_credits video balances seconds → Video Credits.
 *
 * Formula: newCredits = oldSeconds * 20
 *
 * LOCAL / staging only until verified. Does NOT modify plans, packs, or historical history rows.
 *
 * Usage:
 *   npx tsx scripts/migrate-video-seconds-to-credits.ts --dry-run
 *   npx tsx scripts/migrate-video-seconds-to-credits.ts --execute
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { db } from '../database/client';
import { userCredits, creditHistory } from '../database/schema';
import { CreditsDAO } from '../database/models/Credits.dao';
import { eq, and, sql } from 'drizzle-orm';
import {
  classifyVideoWalletForSecondsMigration,
  VIDEO_SECONDS_CONVERSION_RATE,
  VIDEO_SECONDS_MIGRATION_SOURCE,
} from '../lib/billing/video-seconds-migration';

function assertLocal() {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error('DATABASE_URL missing');
  const u = new URL(raw);
  if (
    !(u.hostname === 'localhost' || u.hostname === '127.0.0.1') ||
    u.port !== '54322'
  ) {
    throw new Error(
      `Refusing to run: DATABASE_URL is ${u.hostname}:${u.port} (LOCAL localhost:54322 only)`
    );
  }
  console.log(`TARGET ${u.hostname}:${u.port}`);
}

async function checksum(label: string) {
  const rows = await db.select().from(userCredits);
  let sumSub = 0;
  let sumAddon = 0;
  let sumImgSub = 0;
  let sumImgAddon = 0;
  let minV = Infinity;
  let maxV = -Infinity;
  for (const r of rows) {
    sumSub += r.videoCreditsSubscription;
    sumAddon += r.videoCreditsAddon;
    sumImgSub += r.imageCreditsSubscription;
    sumImgAddon += r.imageCreditsAddon;
    const t = r.videoCreditsSubscription + r.videoCreditsAddon;
    if (t < minV) minV = t;
    if (t > maxV) maxV = t;
  }
  if (rows.length === 0) {
    minV = 0;
    maxV = 0;
  }

  const markers = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(creditHistory)
    .where(
      and(
        eq(creditHistory.operation, 'migrate'),
        eq(creditHistory.source, VIDEO_SECONDS_MIGRATION_SOURCE),
        eq(creditHistory.creditType, 'video')
      )
    );

  const out = {
    label,
    userCreditsRows: rows.length,
    sumVideoSubscription: sumSub,
    sumVideoAddon: sumAddon,
    sumVideoTotal: sumSub + sumAddon,
    minVideoTotal: minV,
    maxVideoTotal: maxV,
    sumImageSubscription: sumImgSub,
    sumImageAddon: sumImgAddon,
    migrationMarkers: Number(markers[0]?.c ?? 0),
  };
  console.log(JSON.stringify(out, null, 2));
  return out;
}

async function main() {
  assertLocal();

  const args = process.argv.slice(2);
  const execute = args.includes('--execute');
  const dryRun = !execute;

  console.log('=== Video seconds → Video Credits migration (classification-based) ===');
  console.log(`Mode: ${dryRun ? 'DRY RUN (no writes)' : 'EXECUTE'}`);
  console.log(`Rate: × ${VIDEO_SECONDS_CONVERSION_RATE}`);

  const before = await checksum('PRE-MIGRATION');

  const rows = await db.select().from(userCredits);
  console.log(`Users with credit rows: ${rows.length}`);

  let classifiedMigrate = 0;
  let migrated = 0;
  let skipped = 0;
  const skipCounts: Record<string, number> = {};

  for (const row of rows) {
    const history = await db
      .select()
      .from(creditHistory)
      .where(eq(creditHistory.userId, row.id));

    const markers = history.filter(
      (h) =>
        h.creditType === 'video' &&
        h.operation === 'migrate' &&
        h.source === VIDEO_SECONDS_MIGRATION_SOURCE
    );

    const classification = classifyVideoWalletForSecondsMigration({
      videoCreditsSubscription: row.videoCreditsSubscription,
      videoCreditsAddon: row.videoCreditsAddon,
      hasMigrationMarker: markers.length > 0,
      history: history.map((h) => ({
        creditType: h.creditType,
        operation: h.operation,
        source: h.source,
        amount: h.amount,
        metadata: (h.metadata as Record<string, unknown> | null) ?? null,
      })),
    });

    if (classification.decision === 'migrate_legacy_seconds') {
      classifiedMigrate += 1;
      console.log(
        `  CLASSIFY migrate user=…${row.id.slice(-8)} sub=${row.videoCreditsSubscription} addon=${row.videoCreditsAddon} → ×${VIDEO_SECONDS_CONVERSION_RATE}`
      );
    } else {
      skipped += 1;
      skipCounts[classification.decision] = (skipCounts[classification.decision] || 0) + 1;
      console.log(
        `  CLASSIFY ${classification.decision} user=…${row.id.slice(-8)} (${classification.reason})`
      );
      continue;
    }

    if (dryRun) {
      migrated += 1;
      continue;
    }

    const result = await CreditsDAO.migrateVideoSecondsToCredits(
      row.id,
      VIDEO_SECONDS_CONVERSION_RATE
    );
    if (!result.success) {
      console.error(`  FAIL …${row.id.slice(-8)}: ${result.error}`);
      process.exitCode = 1;
    } else if (result.skipped) {
      skipped += 1;
      skipCounts[result.decision || 'skipped'] =
        (skipCounts[result.decision || 'skipped'] || 0) + 1;
      console.log(`  SKIP …${row.id.slice(-8)} ${result.skipReason}`);
    } else {
      migrated += 1;
      console.log(
        `  OK …${row.id.slice(-8)} video sub ${result.oldSubscription}→${result.newSubscription} addon ${result.oldAddon}→${result.newAddon}`
      );
    }
  }

  console.log('---');
  console.log(`Classified for migration: ${classifiedMigrate}`);
  console.log(`Migrated (or dry-run preview): ${migrated}`);
  console.log(`Skipped: ${skipped}`, skipCounts);

  if (!dryRun) {
    const after = await checksum('POST-MIGRATION');
    if (after.sumImageSubscription !== before.sumImageSubscription) {
      throw new Error('IMAGE SUBSCRIPTION SUM CHANGED');
    }
    if (after.sumImageAddon !== before.sumImageAddon) {
      throw new Error('IMAGE ADDON SUM CHANGED');
    }
  } else {
    console.log('Re-run with --execute to apply on LOCAL.');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
