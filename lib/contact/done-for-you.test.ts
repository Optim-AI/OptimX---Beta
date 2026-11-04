/**
 * "Done for you" enquiry — validation and email body.
 * Run: npx tsx lib/contact/done-for-you.test.ts
 */

import assert from 'node:assert/strict';
import { buildDfyEmail, validateDfyRequest } from './done-for-you';

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
  email: 'Asha@Example.com',
  phone: '+91 98765 43210',
  brandName: 'Fictional Foods',
  sells: 'Millet snacks',
  monthlyContent: '10–25 pieces',
};

run('requires the six required fields; website and notes optional', () => {
  const res = validateDfyRequest({});
  assert.equal(res.ok, false);
  if (res.ok) return;
  assert.deepEqual(
    Object.keys(res.errors).sort(),
    ['brandName', 'email', 'monthlyContent', 'name', 'phone', 'sells']
  );
  const ok = validateDfyRequest(valid);
  assert.equal(ok.ok, true);
  if (ok.ok) {
    assert.equal(ok.value.email, 'asha@example.com');
    assert.equal(ok.value.website, '');
  }
});

run('rejects bad email, phone and an unknown content option', () => {
  const res = validateDfyRequest({ ...valid, email: 'x', phone: 'abc', monthlyContent: '1000 pieces' });
  assert.equal(res.ok, false);
  if (res.ok) return;
  assert.ok(res.errors.email && res.errors.phone && res.errors.monthlyContent);
});

run('rejects over-long input', () => {
  const res = validateDfyRequest({ ...valid, notes: 'x'.repeat(5000) });
  assert.equal(res.ok, false);
  if (!res.ok) assert.ok(res.errors.notes);
});

run('escapes HTML in the email body', () => {
  const checked = validateDfyRequest({ ...valid, sells: '<img src=x>' });
  assert.ok(checked.ok);
  if (!checked.ok) return;
  const { html, subject } = buildDfyEmail(checked.value, 'now');
  assert.ok(!html.includes('<img'));
  assert.ok(subject.includes('Fictional Foods'));
});

console.log('All done-for-you tests passed');
