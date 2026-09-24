/**
 * Phase 12.9.1 — legacy credit mutation routes must not mutate wallets.
 * Static/source assertions (no DB, no provider).
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

function read(rel: string): string {
  return readFileSync(join(root, rel), 'utf8');
}

function run(name: string, fn: () => void) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (err) {
    console.error(`FAIL ${name}`);
    throw err;
  }
}

const deductRoute = read('pages/api/credits/deduct.ts');
const updateRoute = read('pages/api/credits/update.ts');
const subscriptionHook = read('app/web/src/hooks/use-subscription.ts');
const clientHelpers = read('database/client-helpers.ts');

run('/api/credits/deduct does not call CreditsDAO', () => {
  assert.equal(/import\s+.*CreditsDAO/.test(deductRoute), false);
  assert.equal(/CreditsDAO\./.test(deductRoute), false);
  assert.match(deductRoute, /CREDIT_MUTATION_DISABLED/);
  assert.match(deductRoute, /status\(403\)/);
});

run('/api/credits/update does not call CreditsDAO', () => {
  assert.equal(/import\s+.*CreditsDAO/.test(updateRoute), false);
  assert.equal(/CreditsDAO\./.test(updateRoute), false);
  assert.match(updateRoute, /CREDIT_MUTATION_DISABLED/);
  assert.match(updateRoute, /status\(403\)/);
});

run('useSubscription.deductImageCredit does not call /api/credits/deduct', () => {
  assert.equal(
    /authFetch\(\s*['"]\/api\/credits\/deduct['"]/.test(subscriptionHook),
    false
  );
  assert.match(subscriptionHook, /deductImageCredit is disabled/);
});

run('creditsClient.deduct does not call /api/credits/deduct', () => {
  assert.equal(
    /apiFetch\(\s*['"]\/api\/credits\/deduct['"]/.test(clientHelpers),
    false
  );
  assert.match(clientHelpers, /Direct credit deduction is disabled/);
});

console.log('All legacy credit-mutation bypass tests passed.');
