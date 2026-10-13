/**
 * Production reset policy for SkalX - Live.
 *
 * This module is pure: it does not connect to a database and it does not delete anything.
 * Dry-run and execute both use these rules so the deletion set cannot drift.
 *
 * An account is deletable only when its id is listed in the manifest.
 * Payment, subscription, cycle, and purchase-history rows are kept.
 * A financial record is not a reason to keep the auth account.
 */

import { createHash } from 'node:crypto';

export const LIVE_PROJECT_REF = 'jjfoymnhchfpjstomipr';
export const LIVE_PROJECT_NAME = 'SkalX - Live';

export const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Credit-history sources that record a purchase or subscription grant. */
export const FINANCIAL_CREDIT_SOURCES = [
  'initial_subscription_addon',
  'subscription_cycle',
  'subscription_cycle_provision',
  'subscription_init',
  'addon_purchase',
] as const;

export const BLOCKING_VOUCHER_STATUSES = ['active', 'redeemed'] as const;

/**
 * These tables currently reference auth.users ON DELETE CASCADE.
 * That cascade would erase the financial ledger. The preserve migration drops
 * these foreign keys and leaves user_id filled with the historical auth uuid.
 */
export const FINANCIAL_TABLES = [
  'payments',
  'subscriptions',
  'subscription_cycles',
  'credit_history',
] as const;

/** User-owned tables that may still cascade when the Auth admin API deletes a user. */
export const ALLOWED_AUTH_CASCADES = [
  'campaigns',
  'credit_reservations',
  'integrationsbeta',
  'user_credits',
] as const;

/**
 * Tables this workflow may delete from, and only by an allowlisted user column.
 * Payments, subscriptions, cycles, webhook events, plans, and packs are absent on purpose.
 */
export const DELETABLE_UUID_COLUMNS = [
  { table: 'poster_generation_sessions', column: 'user_id' },
  { table: 'creative_studio_sessions', column: 'user_id' },
  { table: 'content_studio_versions', column: 'user_id' },
  { table: 'content_studio_posters', column: 'user_id' },
  { table: 'content_studio_campaigns', column: 'user_id' },
  { table: 'content_studio_scans', column: 'user_id' },
  { table: 'creative_intelligence_runs', column: 'user_id' },
  { table: 'generation_job_locks', column: 'user_id' },
  { table: 'reports', column: 'user_id' },
  { table: 'credit_reservations', column: 'user_id' },
  { table: 'campaigns', column: 'user_id' },
  { table: 'integration_flags', column: 'user_id' },
  { table: 'integrationsbeta', column: 'user_id' },
  { table: 'user_generated_image', column: 'user_id' },
  { table: 'user_generated_images', column: 'user_id' },
  { table: 'user_ui_state', column: 'user_id' },
  { table: 'user_chats', column: 'user_id' },
  { table: 'profiles', column: 'id' },
] as const;

export const PRESERVED_TABLES = [
  'payments',
  'subscriptions',
  'subscription_cycles',
  'webhook_events',
  'plans',
  'credit_packs',
  'feature_keys',
  'plan_feature_flags',
  'app_settings',
] as const;

export type Classification =
  | 'delete_preserve_financial'
  | 'delete_voucher'
  | 'delete_account';

export type ForeignKeyRule = {
  table: string;
  onDelete: string;
};

export type AccountSignals = {
  id: string;
  paymentCount: number;
  capturedAmountInr: number;
  subscriptionCount: number;
  subscriptionCycleCount: number;
  financialCreditHistoryCount: number;
  blockingVoucherCount: number;
  createdAt: string | null;
  lastSignInAt: string | null;
};

export type ClassifiedAccount = {
  id: string;
  classification: Classification;
  reasons: string[];
  warnings: string[];
};

const IDENT_RE = /^[a-z_]+$/;

export function assertSqlIdent(value: string): string {
  if (!IDENT_RE.test(value)) {
    throw new Error(`Refusing unexpected SQL identifier: ${value}`);
  }
  return value;
}

export function classifyAccount(input: AccountSignals, now = new Date()): ClassifiedAccount {
  if (!UUID_RE.test(input.id)) {
    throw new Error('Account id must be a UUID.');
  }

  const reasons: string[] = [];
  const warnings: string[] = [];

  if (input.paymentCount > 0) {
    reasons.push(
      `${input.paymentCount} payment row(s), captured total INR ${input.capturedAmountInr}`
    );
  }
  if (input.subscriptionCount > 0) {
    reasons.push(`${input.subscriptionCount} subscription row(s)`);
  }
  if (input.subscriptionCycleCount > 0) {
    reasons.push(`${input.subscriptionCycleCount} subscription cycle row(s)`);
  }
  if (input.financialCreditHistoryCount > 0) {
    reasons.push(
      `${input.financialCreditHistoryCount} purchase or subscription credit-history row(s)`
    );
  }
  if (input.blockingVoucherCount > 0) {
    reasons.push(`${input.blockingVoucherCount} active or redeemed voucher row(s)`);
  }

  const created = input.createdAt ? new Date(input.createdAt) : null;
  if (created && Number.isFinite(created.getTime())) {
    const ageDays = (now.getTime() - created.getTime()) / 86_400_000;
    if (ageDays >= 0 && ageDays < 14) {
      warnings.push('Account was created in the last 14 days.');
    }
  }
  if (input.lastSignInAt) {
    const seen = new Date(input.lastSignInAt);
    if (Number.isFinite(seen.getTime())) {
      const idleDays = (now.getTime() - seen.getTime()) / 86_400_000;
      if (idleDays >= 0 && idleDays < 14) {
        warnings.push('Account signed in during the last 14 days.');
      }
    }
  }

  if (
    input.paymentCount > 0 ||
    input.subscriptionCount > 0 ||
    input.subscriptionCycleCount > 0 ||
    input.financialCreditHistoryCount > 0
  ) {
    reasons.unshift(
      'Auth access can be removed. Payment, subscription, cycle, and purchase-history rows stay, with this user id still stored on them.'
    );
    return { id: input.id, classification: 'delete_preserve_financial', reasons, warnings };
  }

  if (input.blockingVoucherCount > 0) {
    reasons.unshift(
      'The voucher is beta entitlement data and is removed with the account. It is not a payment record.'
    );
    return { id: input.id, classification: 'delete_voucher', reasons, warnings };
  }

  reasons.unshift('Listed for account removal. No payment or subscription rows.');
  return { id: input.id, classification: 'delete_account', reasons, warnings };
}

export function cascadingFinancialTables(constraints: readonly ForeignKeyRule[]): string[] {
  const cascading = new Set(
    constraints
      .filter((constraint) => constraint.onDelete.toUpperCase() === 'CASCADE')
      .map((constraint) => constraint.table.replace(/^public\./, ''))
  );
  return FINANCIAL_TABLES.filter((table) => cascading.has(table));
}

/**
 * After the preserve migration, the only remaining cascades from auth.users
 * are account-data tables. Anything else blocks execution.
 */
export function unexpectedAuthCascades(constraints: readonly ForeignKeyRule[]): string[] {
  const allowed = new Set<string>([...ALLOWED_AUTH_CASCADES, ...FINANCIAL_TABLES]);
  return constraints
    .filter((constraint) => constraint.onDelete.toUpperCase() === 'CASCADE')
    .map((constraint) => constraint.table.replace(/^public\./, ''))
    .filter((table) => !allowed.has(table));
}

export type StorageDecision = 'delete' | 'retain' | 'orphan' | 'shared';

/** UUID path segments only. Filenames that embed a user id plus a suffix are ignored. */
export function userIdsInStoragePath(objectName: string): string[] {
  const found = new Set<string>();
  for (const part of objectName.split('/')) {
    if (UUID_RE.test(part)) found.add(part.toLowerCase());
  }
  return [...found];
}

/**
 * An object is deletable only when its only known user id is on the approved manifest.
 * Objects whose folder id matches nobody are orphans and are kept.
 */
export function classifyStorageObject(
  objectName: string,
  liveUserIds: ReadonlySet<string>,
  approvedIds: ReadonlySet<string>
): StorageDecision {
  const known = userIdsInStoragePath(objectName).filter(
    (id) => liveUserIds.has(id) || approvedIds.has(id)
  );
  if (known.length === 0) return 'orphan';
  if (known.length > 1) return 'shared';
  return approvedIds.has(known[0]) ? 'delete' : 'retain';
}

export type ManifestDecision = {
  deleteUserIds: string[];
  storageRetryIds: string[];
};

/**
 * Every manifest id must be a live auth user, or an id that is already gone and
 * still owns storage objects (a retry after the Auth delete succeeded).
 * Financial rows do not make a listed id ineligible.
 */
export function assertManifestEligible(input: {
  approvedUserIds: string[];
  accounts: ClassifiedAccount[];
  storageObjectNames: string[];
  allowAlreadyAbsent?: boolean;
}): ManifestDecision {
  if (input.approvedUserIds.length === 0) {
    throw new Error('Manifest approvedUserIds is empty. Nothing is approved for deletion.');
  }

  const byId = new Map(input.accounts.map((account) => [account.id.toLowerCase(), account]));
  const liveIds = new Set(input.accounts.map((account) => account.id.toLowerCase()));
  const deleteUserIds: string[] = [];
  const storageRetryIds: string[] = [];

  for (const raw of input.approvedUserIds) {
    if (!UUID_RE.test(raw)) {
      throw new Error(`Manifest contains an id that is not a UUID: ${raw}`);
    }
    const id = raw.toLowerCase();
    const account = byId.get(id);
    if (account) {
      deleteUserIds.push(id);
      continue;
    }

    const approved = new Set([id]);
    const ownsObject = input.storageObjectNames.some(
      (name) => classifyStorageObject(name, liveIds, approved) === 'delete'
    );
    if (!ownsObject) {
      if (input.allowAlreadyAbsent) continue;
      throw new Error(
        `Refusing ${id}: not an auth user, and no storage object has this id as a path segment.`
      );
    }
    storageRetryIds.push(id);
  }

  return { deleteUserIds, storageRetryIds };
}

export function assertManifestEmails(
  live: ReadonlyArray<{ id: string; email: string }>,
  manifestAccounts: ReadonlyArray<{ id: string; email: string }>
): void {
  const byId = new Map(live.map((account) => [account.id.toLowerCase(), account.email.toLowerCase()]));
  for (const entry of manifestAccounts) {
    const email = byId.get(entry.id.toLowerCase());
    if (!email) continue;
    if (email !== entry.email.toLowerCase()) {
      throw new Error(
        `Refusing ${entry.id}: the live email does not match the manifest. Nothing was modified.`
      );
    }
  }
}

export type SnapshotBody = {
  projectRef: string;
  accounts: Array<{
    id: string;
    classification: Classification;
    paymentCount: number;
    subscriptionCount: number;
    subscriptionCycleCount: number;
    financialCreditHistoryCount: number;
    blockingVoucherCount: number;
  }>;
  tableCounts: Array<{ table: string; rows: number }>;
  storage: Record<StorageDecision, number>;
  approvedUserIds: string[];
};

export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
    a < b ? -1 : a > b ? 1 : 0
  );
  return `{${entries
    .map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`)
    .join(',')}}`;
}

export function snapshotHash(body: SnapshotBody): string {
  return createHash('sha256').update(stableStringify(body)).digest('hex');
}

export function assertDatabaseTarget(
  databaseUrl: string,
  options: { allowLocal: boolean }
): { host: string; live: boolean } {
  let host = '';
  try {
    host = new URL(databaseUrl).hostname;
  } catch {
    throw new Error('DATABASE_URL is not a valid URL. The value was not logged.');
  }

  const live = host.includes(LIVE_PROJECT_REF);
  const local = host === 'localhost' || host === '127.0.0.1';

  if (local) {
    if (!options.allowLocal) {
      throw new Error(
        `Refusing ${host}. Pass the ${LIVE_PROJECT_NAME} database URL, or --allow-local for a read-only local rehearsal.`
      );
    }
    return { host, live: false };
  }

  if (!live) {
    throw new Error(
      `Refusing host ${host}. This workflow is pinned to ${LIVE_PROJECT_NAME} (${LIVE_PROJECT_REF}).`
    );
  }

  return { host, live: true };
}

export function assertExecuteConfirmation(input: {
  hostIsLive: boolean;
  confirmProject: string | null;
  snapshot: string | null;
  expectedSnapshot: string;
  execute: boolean;
}): void {
  if (!input.execute) {
    throw new Error('Refusing to modify data. Re-run with --execute after the dry-run snapshot is approved.');
  }
  if (!input.hostIsLive) {
    throw new Error('Refusing to execute against a non-live database.');
  }
  if (input.confirmProject !== LIVE_PROJECT_REF) {
    throw new Error(
      `Refusing to execute. Pass --confirm-project ${LIVE_PROJECT_REF} after reviewing the dry run.`
    );
  }
  if (!input.snapshot || input.snapshot !== input.expectedSnapshot) {
    throw new Error(
      'Refusing to execute. --snapshot does not match the current database. Run the dry run again and review the new hash.'
    );
  }
}
