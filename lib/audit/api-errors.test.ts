/**
 * Run: npx tsx lib/audit/api-errors.test.ts
 */
import assert from 'node:assert/strict';
import {
  classifyAuditPersistError,
  clientMessageForCode,
  logAuditApiError,
  newAuditRequestId,
} from './api-errors';

console.log('=== audit api-errors ===');

{
  const id = newAuditRequestId();
  assert.match(id, /^[0-9a-f-]{36}$/i);
  assert.notEqual(id, newAuditRequestId());
}

{
  const missing = classifyAuditPersistError({
    code: '42P01',
    message: 'relation "marketing_audits" does not exist',
  });
  assert.equal(missing.code, 'audit_storage_unavailable');
  assert.equal(missing.status, 503);
  assert.ok(missing.message.includes('storage'));
}

{
  const missingMsg = classifyAuditPersistError(
    new Error('Failed query: select ... from "marketing_audits" — relation "marketing_audits" does not exist')
  );
  assert.equal(missingMsg.code, 'audit_storage_unavailable');
}

{
  const timeout = classifyAuditPersistError(new Error('Connection terminated due to timeout'));
  assert.equal(timeout.code, 'database_error');
  assert.equal(timeout.status, 503);
}

{
  const fk = classifyAuditPersistError({ code: '23503', message: 'violates foreign key constraint' });
  assert.equal(fk.code, 'database_error');
  assert.equal(fk.status, 500);
}

{
  const other = classifyAuditPersistError(new Error('unexpected boom'));
  assert.equal(other.code, 'server_error');
  assert.equal(other.status, 500);
  assert.ok(!other.message.toLowerCase().includes('boom'));
}

{
  assert.equal(clientMessageForCode('rate_limited').includes('recently'), true);
  assert.ok(clientMessageForCode('nope').length > 10);
}

{
  const lines: string[] = [];
  const orig = console.error;
  console.error = (...args: unknown[]) => {
    lines.push(String(args[0]));
  };
  try {
    logAuditApiError({
      requestId: '11111111-1111-1111-1111-111111111111',
      stage: 'create',
      code: 'audit_storage_unavailable',
      detail: 'marketing_audits_missing_or_schema_mismatch',
      host: 'plumgoodness.com',
      err: new Error('password=supersecret bearer tok_abc relation missing'),
    });
  } finally {
    console.error = orig;
  }
  assert.equal(lines.length, 1);
  const payload = JSON.parse(lines[0]);
  assert.equal(payload.scope, 'marketing_audit');
  assert.equal(payload.stage, 'create');
  assert.equal(payload.host, 'plumgoodness.com');
  assert.ok(!String(payload.errMessage).includes('supersecret'));
  assert.ok(!String(payload.errMessage).includes('tok_abc'));
  assert.ok(String(payload.errMessage).includes('[redacted]'));
}

console.log('PASS audit api-errors');
