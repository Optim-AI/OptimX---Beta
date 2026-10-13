/**
 * Integrations Instagram page must not expose legacy Run Ad → facebook/ads.
 * Run: npx --yes tsx lib/ads/meta/integrations-instagram-run-ad-ui.test.ts
 */
import assert from "assert";
import fs from "fs";
import path from "path";

const src = fs.readFileSync(
  path.join(process.cwd(), "pages/integrationsInstagram.tsx"),
  "utf8"
);

assert.ok(
  !src.includes('apiFetch("/api/auth/facebook/ads"') &&
    !src.includes("apiFetch('/api/auth/facebook/ads'") &&
    !src.includes('fetch("/api/auth/facebook/ads"'),
  "page must not call legacy ads write endpoint"
);
assert.ok(!src.includes("handleRunAd"), "Run Ad handler must be removed");
assert.ok(
  !/>\s*Create Ad\s*</.test(src) && !/"Create Ad"/.test(src),
  "Create Ad button label must not be present"
);
assert.ok(!/<h3[^>]*>Run an Ad<\/h3>/.test(src), "Run an Ad heading must be gone");

// Organic / integration surfaces should still be present
assert.ok(src.includes("alsoPostToFacebook") || src.includes("Post Comment"));
assert.ok(src.includes("Manage Leads") || src.includes("Fetch Leads"));

console.log("integrations-instagram-run-ad-ui.test.ts: ok");
