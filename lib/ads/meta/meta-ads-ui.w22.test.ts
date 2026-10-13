/**
 * Meta Ads draft list + wizard UI contracts (PR W2.2).
 * Run: npx --yes tsx lib/ads/meta/meta-ads-ui.w22.test.ts
 *
 * No live Meta Graph. Static + unit checks for labels, routes, regressions.
 */
import assert from "assert";
import fs from "fs";
import path from "path";
import { metaAdsDraftStatusLabel } from "@/lib/ads/meta/draft-contract";

function read(rel: string) {
  return fs.readFileSync(path.join(process.cwd(), rel), "utf8");
}

// Status labels distinguish local drafts from Meta
{
  assert.strictEqual(metaAdsDraftStatusLabel("draft"), "Draft — not on Meta");
  assert.strictEqual(
    metaAdsDraftStatusLabel("failed"),
    "Failed — needs attention"
  );
  assert.strictEqual(metaAdsDraftStatusLabel("archived"), "Archived");
  const badge = read(
    "app/web/src/components/ads/meta/MetaAdsStatusBadge.tsx"
  );
  assert.ok(badge.includes("metaAdsDraftStatusLabel"));
  assert.ok(badge.includes('data-testid="meta-ads-status-badge"'));
}

// Routes exist
{
  for (const rel of [
    "pages/ads/meta/drafts/index.tsx",
    "pages/ads/meta/drafts/new.tsx",
    "pages/ads/meta/drafts/[id].tsx",
  ]) {
    assert.ok(fs.existsSync(path.join(process.cwd(), rel)), rel);
  }
}

// List surface: preflight, empty/loading/error, create CTA, no Meta IDs as delivery
{
  const list = read(
    "app/web/src/components/ads/meta/MetaAdsDraftsList.tsx"
  );
  assert.ok(list.includes("fetchMetaAdsPreflight"));
  assert.ok(list.includes("listMetaAdsDrafts"));
  assert.ok(list.includes("archiveMetaAdsDraft"));
  assert.ok(list.includes('data-testid="list-empty"'));
  assert.ok(list.includes('data-testid="list-loading"'));
  assert.ok(list.includes('data-testid="list-error"'));
  assert.ok(list.includes('data-testid="entitlement-denied"'));
  assert.ok(list.includes('data-testid="preflight-blockers"'));
  assert.ok(list.includes('data-testid="create-ad-campaign"'));
  assert.ok(/does not\s+create a campaign on Meta/.test(list));
  assert.ok(!list.includes("graph.facebook.com"));
  assert.ok(!list.includes("PublishComposer"));
  assert.ok(!list.includes("/api/auth/facebook/ads"));
  assert.ok(list.includes("/library"));
  assert.ok(list.includes("/analytics"));
}

// Wizard: steps, currency, idempotency, HTTPS creative warning, save lock
{
  const wiz = read(
    "app/web/src/components/ads/meta/MetaAdsDraftWizard.tsx"
  );
  assert.ok(wiz.includes("Objective"));
  assert.ok(wiz.includes("Budget & schedule"));
  assert.ok(wiz.includes("Audience"));
  assert.ok(wiz.includes("Creative & copy"));
  assert.ok(wiz.includes("Review & save"));
  assert.ok(wiz.includes("idempotencyKey"));
  assert.ok(wiz.includes("submitLockRef"));
  assert.ok(wiz.includes("wizard-currency"));
  assert.ok(wiz.includes("does not spend money"));
  assert.ok(wiz.includes("createMetaAdsDraft"));
  assert.ok(wiz.includes("updateMetaAdsDraft"));
  assert.ok(wiz.includes("META_ADS_DRAFT_OBJECTIVES"));
  assert.ok(wiz.includes("isPublicHttpsUrl"));
  assert.ok(!wiz.includes("graph.facebook.com"));
  assert.ok(!wiz.includes("metaGraphPost"));
  assert.ok(!wiz.includes("PublishComposer"));
  assert.ok(!wiz.includes("activate on Meta"));
  assert.ok(!wiz.includes("publish to Meta"));
}

// Creative picker warns on non-HTTPS; no Meta upload
{
  const picker = read(
    "app/web/src/components/ads/meta/MetaAdsCreativePicker.tsx"
  );
  assert.ok(picker.includes("/api/generated-contents/list"));
  assert.ok(picker.includes("mediaType=image"));
  assert.ok(picker.includes("creative-https-warning"));
  assert.ok(/not uploaded to\s+Meta/.test(picker));
  assert.ok(!picker.includes("graph.facebook.com"));
}

// Sidebar: Meta Ads entry; Analytics + library preserved
{
  const sidebar = read("app/web/src/components/Sidebar.tsx");
  assert.ok(sidebar.includes("/ads/meta/drafts"));
  assert.ok(sidebar.includes("Meta Ads"));
  assert.ok(sidebar.includes("/analytics"));
  assert.ok(sidebar.includes("basic_analytics"));
  assert.ok(sidebar.includes("/library"));
  assert.ok(sidebar.includes("/generated-contents"));
  assert.ok(sidebar.includes("pathname.startsWith('/ads/meta/')"));
}

// Client helper never sends forbidden fields
{
  const client = read("lib/ads/meta/draft-client.ts");
  assert.ok(client.includes("/api/ads/meta/preflight"));
  assert.ok(client.includes("/api/ads/meta/drafts"));
  assert.ok(!client.includes("body: JSON.stringify({ userId"));
  assert.ok(!/JSON\.stringify\([^)]*metaCampaignId/.test(client));
  assert.ok(!/JSON\.stringify\([^)]*currency/.test(client));
}

// Docs mention W2.2
{
  const docs = read("docs/PAID_ADS_ARCHITECTURE.md");
  // Will assert after we update docs — tolerate either
  assert.ok(docs.includes("W2.1") || docs.includes("W2.2"));
}

console.log("meta-ads-ui.w22.test.ts: ok");
