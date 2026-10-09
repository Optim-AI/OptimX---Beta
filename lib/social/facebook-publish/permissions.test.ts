/**
 * Publish permission helpers.
 * Run: npx --yes tsx lib/social/facebook-publish/permissions.test.ts
 */
import assert from "assert";
import {
  buildPermissionSourceDiagnostics,
  extractGrantedFromMePermissions,
  extractGranularScopeSummaries,
  extractMePermissionStatuses,
  extractScopesFromDebugTokenData,
  isPageCoveredByManagePostsGranular,
  mapPublishPermissionError,
  sanitizePermissionDiagnosticsForLog,
  summarizeScopes,
} from "@/lib/social/facebook-publish/permissions";

// FLB: pages_manage_posts may appear only under granular_scopes
const merged = extractScopesFromDebugTokenData({
  scopes: ["pages_show_list", "pages_read_engagement", "public_profile"],
  granular_scopes: [
    { scope: "pages_show_list", target_ids: ["111"] },
    { scope: "pages_manage_posts", target_ids: ["111"] },
  ],
});
assert.ok(merged.includes("pages_manage_posts"));
assert.ok(merged.includes("pages_show_list"));
assert.ok(merged.includes("pages_read_engagement"));

const scopesOnly = extractScopesFromDebugTokenData({
  scopes: ["pages_show_list", "pages_manage_posts"],
});
assert.deepStrictEqual(
  [...scopesOnly].sort(),
  ["pages_manage_posts", "pages_show_list"].sort()
);

// Alternate Meta field name `permission` on granular entries
const altField = extractScopesFromDebugTokenData({
  scopes: ["public_profile"],
  granular_scopes: [{ permission: "pages_manage_posts", target_ids: ["222"] }],
});
assert.ok(altField.includes("pages_manage_posts"));

const granularSummaries = extractGranularScopeSummaries({
  granular_scopes: [
    { scope: "pages_manage_posts", target_ids: ["111", "222"] },
    { scope: "pages_show_list", target_ids: [] },
  ],
});
assert.deepStrictEqual(granularSummaries, [
  { scope: "pages_manage_posts", targetIdCount: 2 },
  { scope: "pages_show_list", targetIdCount: 0 },
]);

const meGranted = extractGrantedFromMePermissions({
  data: [
    { permission: "pages_show_list", status: "granted" },
    { permission: "pages_manage_posts", status: "declined" },
    { permission: "email", status: "granted" },
  ],
});
assert.ok(meGranted.includes("pages_show_list"));
assert.ok(!meGranted.includes("pages_manage_posts"));

const meStatuses = extractMePermissionStatuses({
  data: [
    { permission: "pages_manage_posts", status: "declined" },
    { permission: "pages_show_list", status: "granted" },
  ],
});
assert.deepStrictEqual(
  meStatuses.map((p) => `${p.permission}:${p.status}`).sort(),
  ["pages_manage_posts:declined", "pages_show_list:granted"].sort()
);

const complete = summarizeScopes([
  "pages_show_list",
  "pages_read_engagement",
  "pages_manage_posts",
]);
assert.deepStrictEqual(complete.missingRequired, []);
assert.deepStrictEqual(complete.missingRecommended, []);

// pages_read_engagement missing alone is recommended, not required
const noEngagement = summarizeScopes([
  "pages_show_list",
  "pages_manage_posts",
]);
assert.deepStrictEqual(noEngagement.missingRequired, []);
assert.deepStrictEqual(noEngagement.missingRecommended, [
  "pages_read_engagement",
]);

const incomplete = summarizeScopes(["pages_show_list"]);
assert.ok(incomplete.missingRequired.includes("pages_manage_posts"));
assert.ok(!incomplete.hasManagePosts);

// Regression: 11 merged scopes with engagement present can still miss manage_posts
// (real Meta non-grant — validator must not invent the permission).
const elevenWithoutManage = summarizeScopes([
  "email",
  "pages_read_engagement",
  "pages_show_list",
  "public_profile",
  "business_management",
  "ads_management",
  "ads_read",
  "pages_read_user_content",
  "catalog_management",
  "instagram_basic",
  "instagram_manage_insights",
]);
assert.deepStrictEqual(elevenWithoutManage.missingRequired, [
  "pages_manage_posts",
]);
assert.deepStrictEqual(elevenWithoutManage.missingRecommended, []);
assert.strictEqual(elevenWithoutManage.hasManagePosts, false);
assert.strictEqual(elevenWithoutManage.hasShowList, true);
assert.strictEqual(elevenWithoutManage.hasReadEngagement, true);

assert.strictEqual(
  isPageCoveredByManagePostsGranular(
    {
      granular_scopes: [
        { scope: "pages_manage_posts", target_ids: ["page_a", "page_b"] },
      ],
    },
    "page_b"
  ),
  true
);
assert.strictEqual(
  isPageCoveredByManagePostsGranular(
    {
      granular_scopes: [
        { scope: "pages_manage_posts", target_ids: ["page_a"] },
      ],
    },
    "page_other"
  ),
  false
);
assert.strictEqual(
  isPageCoveredByManagePostsGranular(
    { granular_scopes: [{ scope: "pages_manage_posts", target_ids: [] }] },
    "page_a"
  ),
  null
);
assert.strictEqual(
  isPageCoveredByManagePostsGranular(
    { granular_scopes: [{ scope: "pages_show_list", target_ids: ["page_a"] }] },
    "page_a"
  ),
  null
);

const diag = buildPermissionSourceDiagnostics({
  debugData: {
    scopes: ["public_profile", "pages_show_list"],
    granular_scopes: [
      { scope: "pages_show_list", target_ids: ["111"] },
      { scope: "pages_read_engagement", target_ids: ["111"] },
    ],
  },
  mePermissionsJson: {
    data: [
      { permission: "pages_show_list", status: "granted" },
      { permission: "pages_manage_posts", status: "declined" },
      { permission: "pages_read_engagement", status: "granted" },
    ],
  },
  mergedScopes: ["public_profile", "pages_show_list", "pages_read_engagement"],
  selectedPageId: "111",
});
assert.deepStrictEqual(diag.debugScopes.sort(), [
  "pages_show_list",
  "public_profile",
].sort());
assert.ok(
  diag.granularScopes.some(
    (g) => g.scope === "pages_read_engagement" && g.targetIdCount === 1
  )
);
assert.ok(
  !diag.granularScopes.some((g) => g.scope === "pages_manage_posts")
);
assert.ok(
  diag.mePermissions.some(
    (p) => p.permission === "pages_manage_posts" && p.status === "declined"
  )
);
assert.deepStrictEqual(diag.requiredDetected, {
  pages_show_list: true,
  pages_manage_posts: false,
});
assert.strictEqual(diag.managePostsTargetIdCount, null);
assert.strictEqual(diag.selectedPageCoveredByManagePosts, null);

const safe = sanitizePermissionDiagnosticsForLog(diag);
assert.ok(safe);
assert.ok(!JSON.stringify(safe).includes("111"));
assert.ok(Array.isArray(safe.granularScopes));

const mapped = mapPublishPermissionError(
  "(#200) The permission(s) pages_manage_posts are not available. It could because either they are deprecated or need to be approved by App Review."
);
assert.strictEqual(mapped.code, "missing_pages_manage_posts");
assert.ok(mapped.needsReconnect);
assert.ok(mapped.error.includes("Login configuration"));
assert.ok(!mapped.error.includes("ensure Standard Access"));

console.log("facebook-publish permissions.test: PASS");
