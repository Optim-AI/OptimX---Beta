/**
 * Contact form — validation and email body.
 * Run: npx tsx lib/contact/contact.test.ts
 */

import assert from 'node:assert/strict';
import { validateContactRequest } from './validate';
import { buildContactEmail } from './notify';

function run(name: string, fn: () => void) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (e) {
    console.error(`FAIL ${name}`);
    throw e;
  }
}

const valid = { name: 'Asha', businessName: 'Fictional Foods', email: 'Asha@Example.com', message: 'Hi' };

run('requires name, business, email and message; phone optional', () => {
  const res = validateContactRequest({});
  assert.equal(res.ok, false);
  if (res.ok) return;
  assert.deepEqual(Object.keys(res.errors).sort(), ['businessName', 'email', 'message', 'name']);
  const ok = validateContactRequest(valid);
  assert.equal(ok.ok, true);
  if (ok.ok) assert.equal(ok.value.email, 'asha@example.com');
});

run('rejects bad email and phone', () => {
  const res = validateContactRequest({ ...valid, email: 'x', phone: 'abc' });
  assert.equal(res.ok, false);
  if (res.ok) return;
  assert.ok(res.errors.email && res.errors.phone);
});

run('escapes HTML in the email body', () => {
  const { html } = buildContactEmail({ ...valid, email: 'a@b.co', phone: '', message: '<img src=x>' }, 'now');
  assert.ok(!html.includes('<img'));
});
