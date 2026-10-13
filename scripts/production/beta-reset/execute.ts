/**
 * Deletes manifest-approved auth users and their application data.
 * Payment, subscription, cycle, purchase-history, and webhook rows are kept.
 *
 * Refuses unless all of these are present:
 *   --execute
 *   --confirm-project jjfoymnhchfpjstomipr
 *   --snapshot <hash printed by the dry run>
 *   --database-url <SkalX - Live URL>
 *
 * Does not call Razorpay, does not send mail through the Auth admin API, and does not
 * delete payments, subscriptions, subscription cycles, webhook events, plans, or packs.
 *
 * Usage (only after the dry-run review):
 *   npx tsx scripts/production/beta-reset/execute.ts \
 *     --database-url "$DATABASE_URL" \
 *     --execute \
 *     --confirm-project jjfoymnhchfpjstomipr \
 *     --snapshot <hash>
 *
 * Storage deletion also requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the
 * environment. They are not printed. Direct SQL deletes of storage.objects are blocked
 * by Supabase, so objects are removed through the Storage API after the database commit.
 */

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { Client } from 'pg';
import { loadInventory } from './inventory';
import {
  assertDatabaseTarget,
  assertExecuteConfirmation,
  assertManifestEligible,
  assertManifestEmails,
  FINANCIAL_CREDIT_SOURCES,
  LIVE_PROJECT_REF,
  unexpectedAuthCascades,
} from './policy';

type ManifestFile = {
  projectRef?: string;
  approvedUserIds?: unknown;
  accounts?: unknown;
};

type ManifestAccount = { id: string; email: string };

function parseArgs(argv: string[]) {
  let databaseUrl: string | null = null;
  let manifestPath = path.resolve(process.cwd(), 'scripts/production/beta-reset/manifest.json');
  let confirmProject: string | null = null;
  let snapshot: string | null = null;
  let execute = false;
  let resume = false;

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
    } else if (arg === '--confirm-project') {
      confirmProject = argv[i + 1] ?? null;
      i += 1;
    } else if (arg === '--snapshot') {
      snapshot = argv[i + 1] ?? null;
      i += 1;
    } else if (arg === '--execute') {
      execute = true;
    } else if (arg === '--resume') {
      resume = true;
    } else if (arg === '--allow-local') {
      throw new Error('Execute is refused on a local database.');
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return { databaseUrl, manifestPath, confirmProject, snapshot, execute, resume };
}

async function readManifest(manifestPath: string): Promise<{
  approvedUserIds: string[];
  accounts: ManifestAccount[];
}> {
  const raw = await readFile(manifestPath, 'utf8');
  const parsed = JSON.parse(raw) as ManifestFile;
  if (parsed.projectRef !== LIVE_PROJECT_REF) {
    throw new Error(`Manifest projectRef must be ${LIVE_PROJECT_REF}.`);
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
  const accountIds = accounts.map((account) => account.id).sort();
  const listed = [...approvedUserIds].sort();
  if (accountIds.join() !== listed.join()) {
    throw new Error('Manifest accounts must contain exactly the same ids as approvedUserIds.');
  }
  return { approvedUserIds, accounts };
}

const CHILD_DELETES = [
  `DELETE FROM public.poster_generation_sessions WHERE user_id = ANY($1::uuid[])`,
  `DELETE FROM public.creative_studio_sessions WHERE user_id = ANY($1::uuid[])`,
  `DELETE FROM public.content_studio_versions WHERE user_id = ANY($1::uuid[])`,
  `DELETE FROM public.content_studio_posters WHERE user_id = ANY($1::uuid[])`,
  `DELETE FROM public.content_studio_campaigns WHERE user_id = ANY($1::uuid[])`,
  `DELETE FROM public.content_studio_scans WHERE user_id = ANY($1::uuid[])`,
  `DELETE FROM public.creative_intelligence_creatives WHERE run_id IN (SELECT id FROM public.creative_intelligence_runs WHERE user_id = ANY($1::uuid[]))`,
  `DELETE FROM public.creative_intelligence_hooks WHERE run_id IN (SELECT id FROM public.creative_intelligence_runs WHERE user_id = ANY($1::uuid[]))`,
  `DELETE FROM public.creative_intelligence_strategies WHERE run_id IN (SELECT id FROM public.creative_intelligence_runs WHERE user_id = ANY($1::uuid[]))`,
  `DELETE FROM public.creative_intelligence_reviews WHERE run_id IN (SELECT id FROM public.creative_intelligence_runs WHERE user_id = ANY($1::uuid[]))`,
  `DELETE FROM public.creative_intelligence_brands WHERE run_id IN (SELECT id FROM public.creative_intelligence_runs WHERE user_id = ANY($1::uuid[]))`,
  `DELETE FROM public.creative_intelligence_competitors WHERE run_id IN (SELECT id FROM public.creative_intelligence_runs WHERE user_id = ANY($1::uuid[]))`,
  `DELETE FROM public.creative_intelligence_meta_ads WHERE run_id IN (SELECT id FROM public.creative_intelligence_runs WHERE user_id = ANY($1::uuid[]))`,
  `DELETE FROM public.creative_intelligence_facebook_pages WHERE run_id IN (SELECT id FROM public.creative_intelligence_runs WHERE user_id = ANY($1::uuid[]))`,
  `DELETE FROM public.creative_intelligence_google_ranks WHERE run_id IN (SELECT id FROM public.creative_intelligence_runs WHERE user_id = ANY($1::uuid[]))`,
  `DELETE FROM public.creative_intelligence_runs WHERE user_id = ANY($1::uuid[])`,
  `DELETE FROM public.generation_job_locks WHERE user_id = ANY($1::uuid[])`,
  `DELETE FROM public.onboarding_guest_sessions WHERE profile_id = ANY($1::uuid[]) OR claimed_by = ANY($1::uuid[])`,
  `DELETE FROM public.reports WHERE user_id = ANY($1::uuid[])`,
  `DELETE FROM public.credit_reservations WHERE user_id = ANY($1::uuid[])`,
  `DELETE FROM public.user_credits WHERE id = ANY($1::uuid[])`,
  `DELETE FROM public.campaigns WHERE user_id = ANY($1::uuid[])`,
  `DELETE FROM public.ad_accounts WHERE integration_id IN (SELECT id FROM public.integrations WHERE user_id = ANY($1::uuid[]))`,
  `DELETE FROM public.integrations WHERE user_id = ANY($1::uuid[])`,
  `DELETE FROM public.integration_flags WHERE user_id = ANY($1::uuid[])`,
  `DELETE FROM public.integrationsbeta WHERE user_id = ANY($1::uuid[])`,
  `DELETE FROM public.training_artifacts WHERE chat_id IN (SELECT id FROM public.user_chats WHERE user_id = ANY($1::uuid[]))`,
  `DELETE FROM public.user_chats WHERE user_id = ANY($1::uuid[])`,
  `DELETE FROM public.user_generated_image WHERE user_id = ANY($1::uuid[])`,
  `DELETE FROM public.user_generated_images WHERE user_id = ANY($1::uuid[])`,
  `DELETE FROM public.user_ui_state WHERE user_id = ANY($1::uuid[])`,
  `DELETE FROM public.profiles WHERE id = ANY($1::uuid[])`,
] as const;

async function deleteStorageObjects(input: {
  supabaseUrl: string;
  serviceRoleKey: string;
  objects: Array<{ bucketId: string; name: string }>;
}): Promise<void> {
  const host = new URL(input.supabaseUrl).hostname;
  if (host !== `${LIVE_PROJECT_REF}.supabase.co`) {
    throw new Error(`Refusing storage host ${host}.`);
  }

  const byBucket = new Map<string, string[]>();
  for (const object of input.objects) {
    const names = byBucket.get(object.bucketId) ?? [];
    names.push(object.name);
    byBucket.set(object.bucketId, names);
  }

  for (const [bucket, names] of byBucket) {
    for (let offset = 0; offset < names.length; offset += 100) {
      const batch = names.slice(offset, offset + 100);
      const response = await fetch(`${input.supabaseUrl.replace(/\/$/, '')}/storage/v1/object/${bucket}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${input.serviceRoleKey}`,
          apikey: input.serviceRoleKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prefixes: batch }),
      });
      if (!response.ok) {
        throw new Error(
          `Storage delete failed for bucket ${bucket} with HTTP ${response.status}. Database users in this batch were already removed. Re-run the dry run before retrying.`
        );
      }
    }
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.databaseUrl) {
    throw new Error('Pass --database-url explicitly. This command does not read .env files.');
  }

  const target = assertDatabaseTarget(args.databaseUrl, { allowLocal: false });
  const manifest = await readManifest(args.manifestPath);
  const approvedUserIds = manifest.approvedUserIds;
  const client = new Client({ connectionString: args.databaseUrl });
  await client.connect();

  let proposedObjects: Array<{ bucketId: string; name: string }> = [];

  try {
    await client.query('BEGIN READ ONLY');
    const inventory = await loadInventory(client, approvedUserIds);
    await client.query('ROLLBACK');

    const manifestIdsStillPresent = inventory.accounts.filter((account) =>
      approvedUserIds.includes(account.id.toLowerCase())
    ).length;
    if (args.resume) {
      if (!args.execute || args.confirmProject !== LIVE_PROJECT_REF || !target.live || !args.snapshot) {
        throw new Error(
          'Resume requires --execute, --confirm-project jjfoymnhchfpjstomipr, and the original --snapshot.'
        );
      }
      if (manifestIdsStillPresent === approvedUserIds.length && args.snapshot !== inventory.snapshotHash) {
        throw new Error(
          'No manifest user has been removed yet. Drop --resume so the live snapshot hash is checked.'
        );
      }
      if (args.snapshot !== inventory.snapshotHash) {
        console.log(
          `Resume: live snapshot is ${inventory.snapshotHash}. Continuing from the original snapshot ${args.snapshot}.`
        );
      }
    } else {
      assertExecuteConfirmation({
        hostIsLive: target.live,
        confirmProject: args.confirmProject,
        snapshot: args.snapshot,
        expectedSnapshot: inventory.snapshotHash,
        execute: args.execute,
      });
    }

    if (inventory.role === 'anon' || inventory.role === 'authenticated' || inventory.role === 'authenticator') {
      throw new Error(`Refusing to execute as database role ${inventory.role}.`);
    }

    if (inventory.cascadingFinancialTables.length > 0) {
      throw new Error(
        `Refusing to execute. ${inventory.cascadingFinancialTables.join(', ')} still ON DELETE CASCADE from auth.users. Apply supabase/migrations/20261010120000_preserve_financial_rows_on_auth_delete.sql first. Nothing was modified.`
      );
    }
    const extraCascades = unexpectedAuthCascades(inventory.authForeignKeys);
    if (extraCascades.length > 0) {
      throw new Error(`Refusing unexpected auth cascade on ${extraCascades.join(', ')}.`);
    }

    assertManifestEmails(inventory.accounts, manifest.accounts);

    const decision = assertManifestEligible({
      approvedUserIds,
      accounts: inventory.accounts,
      storageObjectNames: inventory.objects.map((object) => object.name),
      allowAlreadyAbsent: args.resume,
    });

    proposedObjects = inventory.objects
      .filter((object) => object.decision === 'delete')
      .map((object) => ({ bucketId: object.bucketId, name: object.name }));

    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error(
        'Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before execution. Nothing was modified.'
      );
    }
    if (new URL(supabaseUrl).hostname !== `${LIVE_PROJECT_REF}.supabase.co`) {
      throw new Error('SUPABASE_URL is not the SkalX - Live project. Nothing was modified.');
    }

    const deleteIds = decision.deleteUserIds;
    if (deleteIds.length === 0 && decision.storageRetryIds.length > 0) {
      if (!supabaseUrl || !serviceRoleKey) {
        throw new Error('Storage retry requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
      }
      await deleteStorageObjects({
        supabaseUrl,
        serviceRoleKey,
        objects: proposedObjects,
      });
      console.log(`Removed ${proposedObjects.length} storage object(s) for already-absent manifest ids.`);
      console.log('No auth users were deleted in this run.');
      return;
    }

    const preservedBefore = await client.query<{
      payments: number;
      subscriptions: number;
      cycles: number;
      webhooks: number;
      plans: number;
      packs: number;
      flags: number;
      financial_history: number;
    }>(
      `SELECT
         (SELECT count(*)::int FROM public.payments) AS payments,
         (SELECT count(*)::int FROM public.subscriptions) AS subscriptions,
         (SELECT count(*)::int FROM public.subscription_cycles) AS cycles,
         (SELECT count(*)::int FROM public.webhook_events) AS webhooks,
         (SELECT count(*)::int FROM public.plans) AS plans,
         (SELECT count(*)::int FROM public.credit_packs) AS packs,
         (SELECT count(*)::int FROM public.plan_feature_flags) AS flags,
         (SELECT count(*)::int FROM public.credit_history WHERE source = ANY($1::text[])) AS financial_history`,
      [FINANCIAL_CREDIT_SOURCES]
    );

    await client.query('BEGIN');
    try {
      for (const statement of CHILD_DELETES) {
        if (/\b(payments|subscriptions|subscription_cycles|webhook_events|plans|credit_packs|plan_feature_flags|app_settings)\b/.test(statement)) {
          throw new Error('Refusing a delete statement that names a preserved table.');
        }
        await client.query(statement, [deleteIds]);
      }
      await client.query(
        `DELETE FROM public.oauth_sessions WHERE user_id = ANY($1::text[])`,
        [deleteIds]
      );
      await client.query(
        `DELETE FROM public.vouchers WHERE user_id = ANY($1::uuid[])`,
        [deleteIds]
      );
      await client.query(
        `DELETE FROM public.credit_history
          WHERE user_id = ANY($1::uuid[])
            AND NOT (source = ANY($2::text[]))`,
        [deleteIds, FINANCIAL_CREDIT_SOURCES]
      );
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }

    const preservedAfter = await client.query<{
      payments: number;
      subscriptions: number;
      cycles: number;
      webhooks: number;
      plans: number;
      packs: number;
      flags: number;
      financial_history: number;
    }>(
      `SELECT
         (SELECT count(*)::int FROM public.payments) AS payments,
         (SELECT count(*)::int FROM public.subscriptions) AS subscriptions,
         (SELECT count(*)::int FROM public.subscription_cycles) AS cycles,
         (SELECT count(*)::int FROM public.webhook_events) AS webhooks,
         (SELECT count(*)::int FROM public.plans) AS plans,
         (SELECT count(*)::int FROM public.credit_packs) AS packs,
         (SELECT count(*)::int FROM public.plan_feature_flags) AS flags,
         (SELECT count(*)::int FROM public.credit_history WHERE source = ANY($1::text[])) AS financial_history`,
      [FINANCIAL_CREDIT_SOURCES]
    );
    const before = preservedBefore.rows[0];
    const after = preservedAfter.rows[0];
    if (
      !before ||
      !after ||
      before.payments !== after.payments ||
      before.subscriptions !== after.subscriptions ||
      before.cycles !== after.cycles ||
      before.plans !== after.plans ||
      before.packs !== after.packs ||
      before.flags !== after.flags ||
      before.financial_history !== after.financial_history ||
      after.webhooks < before.webhooks
    ) {
      throw new Error(
        'Preserved financial counts changed during application-data cleanup. Auth users were not deleted. Investigate before retrying.'
      );
    }

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error(
        'Application rows for the approved users were removed. Auth deletion still needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. Re-run this command; auth delete is idempotent.'
      );
    }

    let removedAuth = 0;
    let alreadyAbsent = 0;
    for (const userId of deleteIds) {
      const response = await fetch(
        `${supabaseUrl.replace(/\/$/, '')}/auth/v1/admin/users/${userId}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${serviceRoleKey}`,
            apikey: serviceRoleKey,
          },
        }
      );
      if (response.status === 404) {
        alreadyAbsent += 1;
        continue;
      }
      if (!response.ok) {
        throw new Error(
          `Auth admin delete failed for ${userId} with HTTP ${response.status}. ${removedAuth} user(s) were already removed. Resume with the same --snapshot and add --resume.`
        );
      }
      removedAuth += 1;
    }

    if (proposedObjects.length > 0) {
      await deleteStorageObjects({
        supabaseUrl,
        serviceRoleKey,
        objects: proposedObjects,
      });
    }

    console.log(
      `Auth admin delete removed ${removedAuth} user(s); ${alreadyAbsent} were already absent. Storage objects removed: ${proposedObjects.length}.`
    );
    console.log('Payments, subscriptions, cycles, webhook events, plans, and packs were not modified.');
    console.log('Existing access tokens remain valid until they expire. Sessions were removed with the auth user.');
  } finally {
    await client.end();
  }
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : 'Reset failed';
  console.error(message);
  process.exit(1);
});
