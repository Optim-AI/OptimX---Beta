/**
 * Read-only inventory shared by the dry run and the execute preflight.
 * Callers that must not write should open a READ ONLY transaction first.
 */

import type { Client } from 'pg';
import {
  BLOCKING_VOUCHER_STATUSES,
  classifyAccount,
  classifyStorageObject,
  cascadingFinancialTables,
  FINANCIAL_CREDIT_SOURCES,
  LIVE_PROJECT_REF,
  snapshotHash,
  type ClassifiedAccount,
  type Classification,
  type SnapshotBody,
  type StorageDecision,
} from './policy';

export type InventoryAccount = ClassifiedAccount & {
  email: string;
  provider: string;
  hasProfile: boolean;
  paymentCount: number;
  capturedAmountInr: number;
  subscriptionCount: number;
  subscriptionCycleCount: number;
  financialCreditHistoryCount: number;
  blockingVoucherCount: number;
  imageCredits: number;
  videoCredits: number;
  createdAt: string | null;
  lastSignInAt: string | null;
};

export type StorageObjectRef = {
  bucketId: string;
  name: string;
  decision: StorageDecision;
};

export type Inventory = {
  role: string;
  accounts: InventoryAccount[];
  tableCounts: Array<{ table: string; rows: number }>;
  objects: StorageObjectRef[];
  storageCounts: Record<StorageDecision, number>;
  approvedUserIds: string[];
  cascadingFinancialTables: string[];
  authForeignKeys: Array<{ table: string; onDelete: string }>;
  snapshot: SnapshotBody;
  snapshotHash: string;
};

type AccountRow = {
  id: string;
  email: string | null;
  provider: string | null;
  has_profile: boolean;
  payment_count: number;
  captured_amount: number;
  subscription_count: number;
  cycle_count: number;
  financial_history_count: number;
  blocking_voucher_count: number;
  image_credits: number | null;
  video_credits: number | null;
  created_at: Date | string | null;
  last_sign_in_at: Date | string | null;
};

const COUNT_TABLES = [
  'profiles',
  'user_credits',
  'campaigns',
  'integration_flags',
  'integrations',
  'integrationsbeta',
  'user_chats',
  'user_generated_image',
  'user_generated_images',
  'user_ui_state',
  'oauth_sessions',
  'creative_studio_sessions',
  'poster_generation_sessions',
  'content_studio_scans',
  'content_studio_campaigns',
  'content_studio_posters',
  'content_studio_versions',
  'creative_intelligence_runs',
  'creative_intelligence_reviews',
  'credit_reservations',
  'generation_job_locks',
  'reports',
  'vouchers',
  'onboarding_guest_sessions',
  'payments',
  'subscriptions',
  'subscription_cycles',
  'credit_history',
  'webhook_events',
  'plans',
  'credit_packs',
  'feature_keys',
  'plan_feature_flags',
  'app_settings',
] as const;

function iso(value: Date | string | null): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

export async function loadInventory(
  client: Client,
  approvedUserIds: string[]
): Promise<Inventory> {
  const roleResult = await client.query<{ role: string }>('SELECT current_user AS role');
  const role = roleResult.rows[0]?.role ?? '';

  const accountsResult = await client.query<AccountRow>(
    `SELECT
       u.id::text AS id,
       u.email,
       COALESCE(u.raw_app_meta_data->>'provider', '') AS provider,
       EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = u.id) AS has_profile,
       (SELECT count(*)::int FROM public.payments pay WHERE pay.user_id = u.id) AS payment_count,
       (SELECT COALESCE(sum(pay.amount) FILTER (WHERE pay.status = 'captured'), 0)::int
          FROM public.payments pay WHERE pay.user_id = u.id) AS captured_amount,
       (SELECT count(*)::int FROM public.subscriptions s WHERE s.user_id = u.id) AS subscription_count,
       (SELECT count(*)::int FROM public.subscription_cycles c WHERE c.user_id = u.id) AS cycle_count,
       (SELECT count(*)::int FROM public.credit_history h
          WHERE h.user_id = u.id AND h.source = ANY($1::text[])) AS financial_history_count,
       (SELECT count(*)::int FROM public.vouchers v
          WHERE v.user_id = u.id AND v.status = ANY($2::text[])) AS blocking_voucher_count,
       (SELECT COALESCE(uc.image_credits_subscription, 0) + COALESCE(uc.image_credits_addon, 0)
          FROM public.user_credits uc WHERE uc.id = u.id) AS image_credits,
       (SELECT COALESCE(uc.video_credits_subscription, 0) + COALESCE(uc.video_credits_addon, 0)
          FROM public.user_credits uc WHERE uc.id = u.id) AS video_credits,
       u.created_at,
       u.last_sign_in_at
     FROM auth.users u
     ORDER BY u.created_at ASC, u.id ASC`,
    [FINANCIAL_CREDIT_SOURCES, BLOCKING_VOUCHER_STATUSES]
  );

  const accounts: InventoryAccount[] = accountsResult.rows.map((row) => {
    const classified = classifyAccount({
      id: row.id,
      paymentCount: row.payment_count,
      capturedAmountInr: row.captured_amount,
      subscriptionCount: row.subscription_count,
      subscriptionCycleCount: row.cycle_count,
      financialCreditHistoryCount: row.financial_history_count,
      blockingVoucherCount: row.blocking_voucher_count,
      createdAt: iso(row.created_at),
      lastSignInAt: iso(row.last_sign_in_at),
    });
    return {
      ...classified,
      email: row.email ?? '',
      provider: row.provider ?? '',
      hasProfile: row.has_profile,
      paymentCount: row.payment_count,
      capturedAmountInr: row.captured_amount,
      subscriptionCount: row.subscription_count,
      subscriptionCycleCount: row.cycle_count,
      financialCreditHistoryCount: row.financial_history_count,
      blockingVoucherCount: row.blocking_voucher_count,
      imageCredits: row.image_credits ?? 0,
      videoCredits: row.video_credits ?? 0,
      createdAt: iso(row.created_at),
      lastSignInAt: iso(row.last_sign_in_at),
    };
  });

  const countSql = COUNT_TABLES.map(
    (table) =>
      `SELECT '${table}' AS table_name, count(*)::int AS rows FROM public.${table}`
  ).join(' UNION ALL ');
  const countsResult = await client.query<{ table_name: string; rows: number }>(countSql);
  const tableCounts = countsResult.rows
    .map((row) => ({ table: row.table_name, rows: row.rows }))
    .sort((a, b) => (a.table < b.table ? -1 : a.table > b.table ? 1 : 0));

  const objectsResult = await client.query<{ bucket_id: string; name: string }>(
    `SELECT bucket_id, name FROM storage.objects ORDER BY bucket_id, name`
  );

  const liveUserIds = new Set(accounts.map((account) => account.id.toLowerCase()));
  const approved = new Set(approvedUserIds.map((id) => id.toLowerCase()));
  const objects: StorageObjectRef[] = objectsResult.rows.map((row) => ({
    bucketId: row.bucket_id,
    name: row.name,
    decision: classifyStorageObject(row.name, liveUserIds, approved),
  }));

  const storageCounts: Record<StorageDecision, number> = {
    delete: 0,
    retain: 0,
    orphan: 0,
    shared: 0,
  };
  for (const object of objects) storageCounts[object.decision] += 1;

  const fkResult = await client.query<{ table_name: string; on_delete: string }>(
    `SELECT c.conrelid::regclass::text AS table_name,
            CASE c.confdeltype
              WHEN 'c' THEN 'CASCADE'
              WHEN 'n' THEN 'SET NULL'
              WHEN 'd' THEN 'SET DEFAULT'
              WHEN 'r' THEN 'RESTRICT'
              WHEN 'a' THEN 'NO ACTION'
              ELSE c.confdeltype::text
            END AS on_delete
       FROM pg_constraint c
      WHERE c.contype = 'f'
        AND c.confrelid = 'auth.users'::regclass
        AND c.connamespace = 'public'::regnamespace`
  );
  const financialCascades = cascadingFinancialTables(
    fkResult.rows.map((row) => ({ table: row.table_name, onDelete: row.on_delete }))
  );

  const snapshot: SnapshotBody = {
    projectRef: LIVE_PROJECT_REF,
    accounts: accounts.map((account) => ({
      id: account.id.toLowerCase(),
      classification: account.classification,
      paymentCount: account.paymentCount,
      subscriptionCount: account.subscriptionCount,
      subscriptionCycleCount: account.subscriptionCycleCount,
      financialCreditHistoryCount: account.financialCreditHistoryCount,
      blockingVoucherCount: account.blockingVoucherCount,
    })),
    tableCounts,
    storage: storageCounts,
    approvedUserIds: [...approved].sort(),
  };

  return {
    role,
    accounts,
    tableCounts,
    objects,
    storageCounts,
    approvedUserIds: [...approved].sort(),
    cascadingFinancialTables: financialCascades,
    authForeignKeys: fkResult.rows.map((row) => ({
      table: row.table_name,
      onDelete: row.on_delete,
    })),
    snapshot,
    snapshotHash: snapshotHash(snapshot),
  };
}

export function countByClassification(
  accounts: InventoryAccount[]
): Record<Classification, number> {
  return {
    delete_preserve_financial: accounts.filter(
      (account) => account.classification === 'delete_preserve_financial'
    ).length,
    delete_voucher: accounts.filter((account) => account.classification === 'delete_voucher')
      .length,
    delete_account: accounts.filter((account) => account.classification === 'delete_account')
      .length,
  };
}
