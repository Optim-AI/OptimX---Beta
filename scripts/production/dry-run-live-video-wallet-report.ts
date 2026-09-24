/**
 * Phase 12.5 — Live video wallet dry-run / review report
 *
 * PREPARE ONLY. Defaults to DRY RUN. Mutation is intentionally disabled
 * for this phase — there is no working --execute path.
 *
 * Connects only when an explicit target URL is supplied via:
 *   --database-url <postgres-url>
 * (does not auto-load .env.production / .env.local)
 *
 * Usage:
 *   npx tsx scripts/production/dry-run-live-video-wallet-report.ts \
 *     --database-url "$TARGET_DATABASE_URL"
 *
 * Optional:
 *   --json          print machine-readable JSON summary
 *   --include-zero  include zero video-balance wallets in detail listing
 *
 * Does NOT:
 * - UPDATE user_credits
 * - INSERT migration markers
 * - apply ×20 conversions
 */

import { Client } from 'pg';
import {
  classifyVideoWalletForSecondsMigration,
  convertSecondsBalancesToVideoCredits,
  VIDEO_SECONDS_CONVERSION_RATE,
  VIDEO_SECONDS_MIGRATION_SOURCE,
  type VideoWalletClassifyDecision,
} from '../../lib/billing/video-seconds-migration';

type WalletRow = {
  id: string;
  video_credits_subscription: number;
  video_credits_addon: number;
  image_credits_subscription: number;
  image_credits_addon: number;
};

type HistoryRow = {
  credit_type: string;
  operation: string;
  source: string;
  amount: number;
  metadata: Record<string, unknown> | null;
};

type ReportRow = {
  userIdTruncated: string;
  videoSub: number;
  videoAddon: number;
  videoTotal: number;
  proposedSub: number;
  proposedAddon: number;
  proposedTotal: number;
  decision: VideoWalletClassifyDecision;
  reason: string;
  appearsLegacySeconds: boolean;
  metadataUnitMissingOnGrants: boolean;
  videoHistoryCount: number;
  historySources: string[];
  hasMigrationMarker: boolean;
  confidence: 'high' | 'medium' | 'low' | 'n/a';
};

function parseArgs(argv: string[]) {
  const args = [...argv];
  let databaseUrl: string | null = null;
  let json = false;
  let includeZero = false;
  let executeRequested = false;

  for (let i = 0; i < args.length; i += 1) {
    const a = args[i];
    if (a === '--database-url') {
      databaseUrl = args[i + 1] ?? null;
      i += 1;
    } else if (a.startsWith('--database-url=')) {
      databaseUrl = a.slice('--database-url='.length);
    } else if (a === '--json') {
      json = true;
    } else if (a === '--include-zero') {
      includeZero = true;
    } else if (a === '--execute' || a === '--mutate' || a === '--apply') {
      executeRequested = true;
    }
  }

  return { databaseUrl, json, includeZero, executeRequested };
}

function truncateUserId(id: string): string {
  if (id.length <= 12) return `…${id.slice(-4)}`;
  return `${id.slice(0, 4)}…${id.slice(-4)}`;
}

function confidenceFor(decision: VideoWalletClassifyDecision): ReportRow['confidence'] {
  switch (decision) {
    case 'migrate_legacy_seconds':
      return 'high';
    case 'skip_already_migrated':
    case 'skip_already_video_credits':
    case 'skip_zero':
      return 'high';
    case 'skip_ambiguous':
      return 'low';
    default:
      return 'n/a';
  }
}

function grantsMissingUnit(history: HistoryRow[]): boolean {
  const grants = history.filter(
    (h) =>
      h.credit_type === 'video' &&
      (h.operation === 'add' || h.operation === 'reset')
  );
  if (grants.length === 0) return true;
  return grants.some((h) => {
    const unit = h.metadata?.unit;
    return typeof unit !== 'string' || !unit.trim();
  });
}

async function main() {
  const { databaseUrl, json, includeZero, executeRequested } = parseArgs(
    process.argv.slice(2)
  );

  console.log('=== Phase 12.5 Live video wallet REVIEW (dry-run only) ===');
  console.log(`Conversion formula (proposed only): × ${VIDEO_SECONDS_CONVERSION_RATE}`);
  console.log('Mutation: DISABLED in this package');

  if (executeRequested) {
    console.error(
      'REFUSED: --execute/--mutate/--apply is disabled in Phase 12.5. This tool is report-only.'
    );
    process.exit(2);
  }

  if (!databaseUrl) {
    console.error(
      'REFUSED: provide an explicit target with --database-url <postgres-url>. No default env DB is used.'
    );
    process.exit(2);
  }

  let hostLabel = '(unparsed)';
  try {
    const u = new URL(databaseUrl);
    hostLabel = `${u.hostname}:${u.port || '(default)'}`;
  } catch {
    console.error('REFUSED: --database-url is not a valid URL');
    process.exit(2);
  }

  console.log(`TARGET (explicit): ${hostLabel}`);
  console.log('Mode: DRY RUN (no writes)');

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    // Hard safety: open a read-only transaction for the whole report.
    await client.query('BEGIN READ ONLY');

    const wallets = await client.query<WalletRow>(
      `SELECT id,
              COALESCE(video_credits_subscription, 0)::int AS video_credits_subscription,
              COALESCE(video_credits_addon, 0)::int AS video_credits_addon,
              COALESCE(image_credits_subscription, 0)::int AS image_credits_subscription,
              COALESCE(image_credits_addon, 0)::int AS image_credits_addon
       FROM public.user_credits
       ORDER BY video_credits_addon DESC, video_credits_subscription DESC, id`
    );

    const reports: ReportRow[] = [];
    const decisionCounts: Record<string, number> = {};
    let addonNonzero = 0;

    for (const row of wallets.rows) {
      if (row.video_credits_addon > 0) addonNonzero += 1;

      const historyRes = await client.query<HistoryRow>(
        `SELECT credit_type, operation, source, amount, metadata
         FROM public.credit_history
         WHERE user_id = $1
         ORDER BY created_at ASC`,
        [row.id]
      );
      const history = historyRes.rows.map((h) => ({
        ...h,
        metadata: (h.metadata as Record<string, unknown> | null) ?? null,
      }));

      const markers = history.filter(
        (h) =>
          h.credit_type === 'video' &&
          h.operation === 'migrate' &&
          h.source === VIDEO_SECONDS_MIGRATION_SOURCE
      );

      const videoHistory = history.filter((h) => h.credit_type === 'video');
      const classification = classifyVideoWalletForSecondsMigration({
        videoCreditsSubscription: row.video_credits_subscription,
        videoCreditsAddon: row.video_credits_addon,
        hasMigrationMarker: markers.length > 0,
        history: videoHistory.map((h) => ({
          creditType: h.credit_type,
          operation: h.operation,
          source: h.source,
          amount: h.amount,
          metadata: h.metadata,
        })),
      });

      const proposed = convertSecondsBalancesToVideoCredits(
        row.video_credits_subscription,
        row.video_credits_addon,
        VIDEO_SECONDS_CONVERSION_RATE
      );

      const report: ReportRow = {
        userIdTruncated: truncateUserId(row.id),
        videoSub: row.video_credits_subscription,
        videoAddon: row.video_credits_addon,
        videoTotal: row.video_credits_subscription + row.video_credits_addon,
        proposedSub: proposed.subscription,
        proposedAddon: proposed.addon,
        proposedTotal: proposed.subscription + proposed.addon,
        decision: classification.decision,
        reason: classification.reason,
        appearsLegacySeconds: classification.decision === 'migrate_legacy_seconds',
        metadataUnitMissingOnGrants: grantsMissingUnit(videoHistory),
        videoHistoryCount: videoHistory.length,
        historySources: [...new Set(videoHistory.map((h) => h.source))].sort(),
        hasMigrationMarker: markers.length > 0,
        confidence: confidenceFor(classification.decision),
      };

      decisionCounts[classification.decision] =
        (decisionCounts[classification.decision] || 0) + 1;

      if (
        includeZero ||
        row.video_credits_addon > 0 ||
        row.video_credits_subscription > 0 ||
        classification.decision === 'migrate_legacy_seconds' ||
        classification.decision === 'skip_ambiguous'
      ) {
        reports.push(report);
      }
    }

    await client.query('COMMIT');

    const summary = {
      targetHost: hostLabel,
      mode: 'dry_run',
      mutationDisabled: true,
      conversionRate: VIDEO_SECONDS_CONVERSION_RATE,
      totalWallets: wallets.rows.length,
      addonVideoNonzero: addonNonzero,
      decisionCounts,
      note:
        'Proposed ×20 balances are NOT applied. Review skip_ambiguous / missing-unit rows before any future conversion.',
    };

    if (json) {
      console.log(JSON.stringify({ summary, rows: reports }, null, 2));
    } else {
      console.log('\n--- SUMMARY ---');
      console.log(JSON.stringify(summary, null, 2));
      console.log('\n--- DETAIL (truncated user ids) ---');
      for (const r of reports) {
        console.log(
          [
            `user=${r.userIdTruncated}`,
            `addon=${r.videoAddon}`,
            `sub=${r.videoSub}`,
            `proposed_addon=${r.proposedAddon}`,
            `proposed_sub=${r.proposedSub}`,
            `decision=${r.decision}`,
            `legacy=${r.appearsLegacySeconds}`,
            `unit_missing=${r.metadataUnitMissingOnGrants}`,
            `confidence=${r.confidence}`,
            `hist_n=${r.videoHistoryCount}`,
            `sources=[${r.historySources.join('|')}]`,
            `reason=${r.reason}`,
          ].join(' ')
        );
      }
      console.log(
        '\nSTOP: no user_credits rows were updated. Re-run a future approved mutate tool only after human review.'
      );
    }
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      /* ignore */
    }
    throw err;
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
