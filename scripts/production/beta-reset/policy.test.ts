/**
 * Policy checks. No database connection.
 * Run: npx tsx scripts/production/beta-reset/policy.test.ts
 */

import assert from 'node:assert/strict';
import {
  assertExecuteConfirmation,
  assertManifestEligible,
  cascadingFinancialTables,
  classifyAccount,
  classifyStorageObject,
  LIVE_PROJECT_REF,
  snapshotHash,
} from './policy';

const financial = classifyAccount({
  id: '1505635f-c073-4422-bcd9-78a9fbbb647f',
  paymentCount: 1,
  capturedAmountInr: 4719,
  subscriptionCount: 3,
  subscriptionCycleCount: 1,
  financialCreditHistoryCount: 0,
  blockingVoucherCount: 0,
  createdAt: '2026-02-27T00:00:00.000Z',
  lastSignInAt: '2026-10-10T00:00:00.000Z',
});
assert.equal(financial.classification, 'delete_preserve_financial');

const voucher = classifyAccount({
  id: 'a2a7eacd-31bc-4f44-a76a-eb6f73abb1e7',
  paymentCount: 0,
  capturedAmountInr: 0,
  subscriptionCount: 0,
  subscriptionCycleCount: 0,
  financialCreditHistoryCount: 0,
  blockingVoucherCount: 1,
  createdAt: '2026-02-28T00:00:00.000Z',
  lastSignInAt: '2026-03-01T00:00:00.000Z',
});
assert.equal(voucher.classification, 'delete_voucher');

const unclassified = classifyAccount({
  id: 'e6d08563-5172-485c-abd7-761cb92b33d8',
  paymentCount: 0,
  capturedAmountInr: 0,
  subscriptionCount: 0,
  subscriptionCycleCount: 0,
  financialCreditHistoryCount: 0,
  blockingVoucherCount: 0,
  createdAt: '2026-10-10T00:00:00.000Z',
  lastSignInAt: null,
});
assert.equal(unclassified.classification, 'delete_account');
assert.ok(unclassified.warnings.some((warning) => warning.includes('14 days')));

assert.throws(() =>
  assertManifestEligible({
    approvedUserIds: [],
    accounts: [unclassified],
    storageObjectNames: [],
  })
);

const financialDecision = assertManifestEligible({
  approvedUserIds: [financial.id, voucher.id],
  accounts: [financial, voucher],
  storageObjectNames: [],
});
assert.deepEqual(financialDecision.deleteUserIds, [financial.id, voucher.id]);

const eligible = assertManifestEligible({
  approvedUserIds: [unclassified.id],
  accounts: [financial, voucher, unclassified],
  storageObjectNames: [],
});
assert.deepEqual(eligible.deleteUserIds, [unclassified.id]);
assert.deepEqual(eligible.storageRetryIds, []);

const live = new Set([unclassified.id, financial.id]);
const approved = new Set([unclassified.id]);
assert.equal(
  classifyStorageObject(`campaigns/${unclassified.id}/poster.png`, live, approved),
  'delete'
);
assert.equal(
  classifyStorageObject(`campaigns/${financial.id}/poster.png`, live, approved),
  'retain'
);
assert.equal(
  classifyStorageObject('user-uploads/2c603576-842d-4827-a5ed-aa275aa0a174/logo.png', live, new Set()),
  'orphan'
);
assert.equal(
  classifyStorageObject(
    `campaigns/${unclassified.id}/${financial.id}/shared.png`,
    live,
    approved
  ),
  'shared'
);
assert.equal(
  classifyStorageObject('campaigns/generated/not-a-user.png', live, approved),
  'orphan'
);

const retry = assertManifestEligible({
  approvedUserIds: ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'],
  accounts: [],
  storageObjectNames: ['user-uploads/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/logo.png'],
});
assert.deepEqual(retry.storageRetryIds, ['aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa']);

assert.throws(() =>
  assertManifestEligible({
    approvedUserIds: ['bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'],
    accounts: [],
    storageObjectNames: ['user-uploads/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/logo.png'],
  })
);

const body = {
  projectRef: LIVE_PROJECT_REF,
  accounts: [],
  tableCounts: [],
  storage: { delete: 0, retain: 0, orphan: 0, shared: 0 },
  approvedUserIds: [],
};
assert.equal(snapshotHash(body), snapshotHash(body));

assert.throws(() =>
  assertExecuteConfirmation({
    hostIsLive: true,
    confirmProject: LIVE_PROJECT_REF,
    snapshot: 'abc',
    expectedSnapshot: 'def',
    execute: true,
  })
);

assert.throws(() =>
  assertExecuteConfirmation({
    hostIsLive: true,
    confirmProject: null,
    snapshot: 'abc',
    expectedSnapshot: 'abc',
    execute: true,
  })
);

assert.deepEqual(
  cascadingFinancialTables([
    { table: 'public.payments', onDelete: 'CASCADE' },
    { table: 'subscriptions', onDelete: 'NO ACTION' },
    { table: 'campaigns', onDelete: 'CASCADE' },
  ]),
  ['payments']
);

console.log('beta-reset policy checks passed');
