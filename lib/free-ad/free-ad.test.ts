/**
 * Free-ad request — validation and email body.
 * Run: npx tsx lib/free-ad/free-ad.test.ts
 */

import assert from 'node:assert/strict';
import { validateFreeAdRequest } from './validate';
import { buildFreeAdEmail, getFreeAdNotifyRecipient } from './notify';

function run(name: string, fn: () => void) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (e) {
    console.error(`FAIL ${name}`);
    throw e;
  }
}

const valid = {
  name: 'Asha',
  brandName: 'Fictional Foods',
  brandLink: '@fictionalfoods',
  product: 'Mango trail mix',
  email: ' Asha@Example.com ',
};

run('requires the five core fields', () => {
  const res = validateFreeAdRequest({});
  assert.equal(res.ok, false);
  if (res.ok) return;
  assert.deepEqual(Object.keys(res.errors).sort(), ['brandLink', 'brandName', 'email', 'name', 'product']);
});

run('accepts a valid request and normalizes email; optional fields may be empty', () => {
  const res = validateFreeAdRequest(valid);
  assert.equal(res.ok, true);
  if (!res.ok) return;
  assert.equal(res.value.email, 'asha@example.com');
  assert.equal(res.value.whatsapp, '');
});

run('rejects bad email and bad WhatsApp number', () => {
  const res = validateFreeAdRequest({ ...valid, email: 'nope', whatsapp: 'call me' });
  assert.equal(res.ok, false);
  if (res.ok) return;
  assert.ok(res.errors.email);
  assert.ok(res.errors.whatsapp);
  assert.equal(validateFreeAdRequest({ ...valid, whatsapp: '+91 98765 43210' }).ok, true);
});

run('rejects overlong fields', () => {
  const res = validateFreeAdRequest({ ...valid, notes: 'x'.repeat(2001) });
  assert.equal(res.ok, false);
});

run('email goes to the support inbox and escapes HTML', () => {
  assert.equal(getFreeAdNotifyRecipient(), 'info@skalxai.app');
  const { subject, html } = buildFreeAdEmail(
    { ...valid, email: 'a@b.co', whatsapp: '', notes: '<script>x</script>' },
    '2026-01-01T00:00:00Z'
  );
  assert.match(subject, /Fictional Foods/);
  assert.ok(!html.includes('<script>'));
});
