/**
 * isUniqueViolation — recognises pg 23505 directly and through drizzle's DrizzleQueryError.
 * Run: npx tsx lib/db/unique-violation.test.ts
 */

import assert from 'node:assert/strict';
import { DrizzleQueryError } from 'drizzle-orm/errors';
import { isUniqueViolation } from './unique-violation';

function run(name: string, fn: () => void) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (e) {
    console.error(`FAIL ${name}`);
    throw e;
  }
}

const pgDuplicate = Object.assign(
  new Error('duplicate key value violates unique constraint "subscription_cycles_idempotency_key_unique"'),
  { code: '23505' }
);

run('raw pg unique violation', () => {
  assert.equal(isUniqueViolation(pgDuplicate), true);
});

run('drizzle-wrapped unique violation (code only on .cause)', () => {
  const wrapped = new DrizzleQueryError('insert into "subscription_cycles" …', [], pgDuplicate);
  assert.equal((wrapped as { code?: string }).code, undefined);
  assert.equal(isUniqueViolation(wrapped), true);
});

run('other errors are not unique violations', () => {
  const fk = Object.assign(new Error('insert violates foreign key constraint'), { code: '23503' });
  assert.equal(isUniqueViolation(fk), false);
  assert.equal(isUniqueViolation(new DrizzleQueryError('select 1', [], fk)), false);
  assert.equal(isUniqueViolation(new Error('Failed query: insert into "unique_things"')), false);
  assert.equal(isUniqueViolation(null), false);
  assert.equal(isUniqueViolation(undefined), false);
});
