/**
 * Read-only dry run for the SkalX production user reset.
 *
 * Does not load .env files. Does not write to the database.
 *
 * Usage:
 *   npx tsx scripts/production/beta-reset/dry-run.ts \
 *     --database-url "$DATABASE_URL"
 *
 * Optional:
 *   --manifest scripts/production/beta-reset/manifest.json
 *   --out scripts/production/beta-reset/out/dry-run.json
 *   --allow-local
 *
 * The report contains account emails. It is written only under
 * scripts/production/beta-reset/out/, which is gitignored.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Client } from 'pg';
import { countByClassification, loadInventory } from './inventory';
import {
  assertDatabaseTarget,
  assertManifestEmails,
  LIVE_PROJECT_NAME,
  LIVE_PROJECT_REF,
} from './policy';

const OUT_DIR = path.resolve(process.cwd(), 'scripts/production/beta-reset/out');

type ManifestFile = {
  projectRef?: string;
  approvedUserIds?: unknown;
  accounts?: unknown;
};

function parseArgs(argv: string[]) {
  let databaseUrl: string | null = null;
  let manifestPath = path.resolve(process.cwd(), 'scripts/production/beta-reset/manifest.json');
  let outPath: string | null = null;
  let allowLocal = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--database-url') {
      databaseUrl = argv[i + 1] ?? null;
      i += 1;
    } else if (arg.startsWith('--database-url=')) {
      databaseUrl = arg.slice('--database-url='.length);
    } else if (arg === '--manifest') {
      manifestPath = path.resolve(argv[i + 1] ?? '');
      i += 1;
    } else if (arg === '--out') {
      outPath = path.resolve(argv[i + 1] ?? '');
      i += 1;
    } else if (arg === '--allow-local') {
      allowLocal = true;
    } else if (arg === '--execute' || arg === '--mutate' || arg === '--apply') {
      throw new Error('This command is read-only. Use execute.ts for a reviewed deletion.');
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return { databaseUrl, manifestPath, outPath, allowLocal };
}

async function readApprovedIds(manifestPath: string): Promise<{
  approvedUserIds: string[];
  accounts: Array<{ id: string; email: string }>;
}> {
  const raw = await readFile(manifestPath, 'utf8');
  const parsed = JSON.parse(raw) as ManifestFile;
  if (parsed.projectRef && parsed.projectRef !== LIVE_PROJECT_REF) {
    throw new Error(
      `Manifest projectRef is ${parsed.projectRef}. Expected ${LIVE_PROJECT_REF}.`
    );
  }
  if (!Array.isArray(parsed.approvedUserIds)) {
    throw new Error('Manifest approvedUserIds must be an array.');
  }
  const approvedUserIds = parsed.approvedUserIds.map((id) => {
    if (typeof id !== 'string') throw new Error('Manifest approvedUserIds must contain strings.');
    return id.toLowerCase();
  });
  if (!Array.isArray(parsed.accounts)) {
    throw new Error('Manifest accounts must list every approved id and email.');
  }
  const accounts = parsed.accounts.map((entry) => {
    if (!entry || typeof entry !== 'object') throw new Error('Manifest accounts must be objects.');
    const record = entry as { id?: unknown; email?: unknown };
    if (typeof record.id !== 'string' || typeof record.email !== 'string') {
      throw new Error('Each manifest account needs an id and an email.');
    }
    return { id: record.id.toLowerCase(), email: record.email.toLowerCase() };
  });
  return { approvedUserIds, accounts };
}

function printReport(input: {
  host: string;
  live: boolean;
  role: string;
  inventory: Awaited<ReturnType<typeof loadInventory>>;
}) {
  const { inventory } = input;
  const counts = countByClassification(inventory.accounts);
  console.log(`Project: ${LIVE_PROJECT_NAME} (${LIVE_PROJECT_REF})`);
  console.log(`Host: ${input.host}`);
  console.log(`Live project: ${input.live ? 'yes' : 'no'}`);
  console.log(`Database role: ${input.role}`);
  console.log(`Auth accounts: ${inventory.accounts.length}`);
  console.log(`Approved manifest ids: ${inventory.approvedUserIds.length}`);
  console.log(`Delete, preserve financial rows: ${counts.delete_preserve_financial}`);
  console.log(`Delete, including a beta voucher: ${counts.delete_voucher}`);
  console.log(`Delete, no payment rows: ${counts.delete_account}`);
  console.log(
    `Storage objects: delete ${inventory.storageCounts.delete}, retain ${inventory.storageCounts.retain}, orphan ${inventory.storageCounts.orphan}, shared ${inventory.storageCounts.shared}`
  );
  console.log('');
  if (inventory.cascadingFinancialTables.length > 0) {
    console.log(
      `BLOCKER: ${inventory.cascadingFinancialTables.join(', ')} still cascade from auth.users.`
    );
    console.log(
      'Apply supabase/migrations/20261010120000_preserve_financial_rows_on_auth_delete.sql before execute.'
    );
    console.log('Execute refuses while those foreign keys remain. This dry run did not apply it.');
  } else {
    console.log('Financial foreign keys no longer cascade from auth.users.');
  }
  console.log('Payment, subscription, cycle, and webhook rows are not in the deletion set.');
  console.log('');

  for (const account of inventory.accounts) {
    const flags = [
      account.classification,
      account.provider || 'unknown-provider',
      account.hasProfile ? 'profile' : 'no-profile',
      `payments=${account.paymentCount}`,
      `captured_inr=${account.capturedAmountInr}`,
      `subscriptions=${account.subscriptionCount}`,
      `cycles=${account.subscriptionCycleCount}`,
      `image_credits=${account.imageCredits}`,
      `video_credits=${account.videoCredits}`,
    ];
    console.log(`${account.id}  ${account.email}`);
    console.log(`  ${flags.join(' | ')}`);
    for (const reason of account.reasons) console.log(`  - ${reason}`);
    for (const warning of account.warnings) console.log(`  ! ${warning}`);
  }

  console.log('');
  console.log('Table row counts (whole table, not only proposed deletions):');
  for (const row of inventory.tableCounts) {
    if (row.rows > 0) console.log(`  ${row.table}: ${row.rows}`);
  }

  const orphanPrefixes = new Map<string, number>();
  for (const object of inventory.objects) {
    if (object.decision !== 'orphan') continue;
    const prefix = object.name.split('/').slice(0, 2).join('/');
    orphanPrefixes.set(prefix, (orphanPrefixes.get(prefix) ?? 0) + 1);
  }
  console.log('');
  console.log(`Orphan storage prefixes: ${orphanPrefixes.size}`);
  console.log('Orphan objects are not proposed for deletion.');

  console.log('');
  console.log(`Snapshot: ${inventory.snapshotHash}`);
  console.log('Database was not modified.');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.databaseUrl) {
    throw new Error(
      'Pass --database-url explicitly. This command does not read .env.local or .env.production.'
    );
  }

  const target = assertDatabaseTarget(args.databaseUrl, { allowLocal: args.allowLocal });
  const manifest = await readApprovedIds(args.manifestPath);
  const approvedUserIds = manifest.approvedUserIds;
  const client = new Client({ connectionString: args.databaseUrl });
  await client.connect();

  try {
    await client.query('BEGIN READ ONLY');
    const inventory = await loadInventory(client, approvedUserIds);
    await client.query('ROLLBACK');
    assertManifestEmails(inventory.accounts, manifest.accounts);
    const listed = new Set(approvedUserIds);
    const missingFromManifest = inventory.accounts.filter((account) => !listed.has(account.id.toLowerCase()));
    if (missingFromManifest.length > 0) {
      console.log(
        `Not in the manifest, so they will be kept: ${missingFromManifest.map((account) => account.email).join(', ')}`
      );
    }
    printReport({ host: target.host, live: target.live, role: inventory.role, inventory });

    if (args.outPath) {
      if (args.outPath !== OUT_DIR && !args.outPath.startsWith(`${OUT_DIR}${path.sep}`)) {
        throw new Error(
          'Refusing to write the report outside scripts/production/beta-reset/out/. The report contains emails.'
        );
      }
      await mkdir(OUT_DIR, { recursive: true });
      const body = {
        generatedAt: new Date().toISOString(),
        host: target.host,
        live: target.live,
        role: inventory.role,
        snapshotHash: inventory.snapshotHash,
        accounts: inventory.accounts,
        tableCounts: inventory.tableCounts,
        storageCounts: inventory.storageCounts,
        proposedStorageDeletes: inventory.objects
          .filter((object) => object.decision === 'delete')
          .map((object) => ({ bucketId: object.bucketId, name: object.name })),
      };
      await writeFile(args.outPath, `${JSON.stringify(body, null, 2)}\n`, 'utf8');
      console.log(`Wrote ${args.outPath}`);
    }
  } finally {
    await client.end();
  }
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : 'Dry run failed';
  console.error(message);
  process.exit(1);
});
