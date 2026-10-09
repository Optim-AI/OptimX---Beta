/**
 * Pending selection must ignore NO_PAGES / empty page sessions.
 * Run: npx --yes tsx lib/ads/meta/pending-session-filter.test.ts
 */
import assert from "assert";

function shouldExposePending(data: {
  errorType?: string | null;
  pages?: unknown[];
  adAccounts?: unknown[];
}): boolean {
  const pages = Array.isArray(data.pages) ? data.pages : [];
  const errorType = data.errorType || null;
  if (errorType === "NO_PAGES" || pages.length === 0) return false;
  return true;
}

assert.strictEqual(
  shouldExposePending({ errorType: "NO_PAGES", pages: [], adAccounts: [] }),
  false
);
assert.strictEqual(shouldExposePending({ pages: [], adAccounts: [{ id: 1 }] }), false);
assert.strictEqual(
  shouldExposePending({
    pages: [{ id: "1", name: "SkalX" }],
    adAccounts: [{ account_id: "1" }],
  }),
  true
);

console.log("pending-session-filter.test: PASS");
