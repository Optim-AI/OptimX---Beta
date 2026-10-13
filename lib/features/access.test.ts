/**
 * Analytics entitlement policy + metrics API gate.
 * Run: npx --yes tsx lib/features/access.test.ts
 */
import assert from "assert";
import { readFileSync } from "fs";
import { join } from "path";
import {
  classifyAnalyticsBillingCohort,
  decideBasicAnalyticsAccess,
  enforceBasicAnalyticsForMetricsApi,
  featureBlockReason,
  isFeatureEntitled,
} from "@/lib/features/access";
import {
  ADVANCED_ANALYTICS_STILL_GATED_CONTRACT,
  PAYG_BASIC_ANALYTICS_CONTRACT,
  SKALX_BASIC_ANALYTICS_PLAN_IDS,
} from "@/lib/features/feature-access.contract";

// --- helpers ---
assert.strictEqual(isFeatureEntitled({ enabled: true, comingSoon: false }), true);
assert.strictEqual(isFeatureEntitled({ enabled: true, comingSoon: true }), false);
assert.strictEqual(isFeatureEntitled({ enabled: false, comingSoon: false }), false);
assert.strictEqual(isFeatureEntitled(null), false);
assert.strictEqual(featureBlockReason({ enabled: false, comingSoon: true }), "coming_soon");

assert.strictEqual(
  classifyAnalyticsBillingCohort({
    hasActiveOrTrialingSubscription: false,
    subscriptionRowCount: 0,
  }),
  "payg"
);
assert.strictEqual(
  classifyAnalyticsBillingCohort({
    hasActiveOrTrialingSubscription: true,
    subscriptionRowCount: 1,
  }),
  "active_subscriber"
);
assert.strictEqual(
  classifyAnalyticsBillingCohort({
    hasActiveOrTrialingSubscription: false,
    subscriptionRowCount: 1,
  }),
  "inactive_subscriber",
  "expired/cancelled/pending is not PAYG"
);

// Authenticated PAYG (no subscription rows) → allowed
{
  const d = decideBasicAnalyticsAccess({ cohort: "payg" });
  assert.strictEqual(d.entitled, true);
  assert.strictEqual(d.enabled, PAYG_BASIC_ANALYTICS_CONTRACT.enabled);
  assert.strictEqual(d.comingSoon, false);
}

// Entitled subscriber
{
  const d = decideBasicAnalyticsAccess({
    cohort: "active_subscriber",
    planFlag: { enabled: true, comingSoon: false },
  });
  assert.strictEqual(d.entitled, true);
}

// Subscriber Analytics disabled
{
  const d = decideBasicAnalyticsAccess({
    cohort: "active_subscriber",
    planFlag: { enabled: false, comingSoon: false },
  });
  assert.strictEqual(d.entitled, false);
  assert.strictEqual(d.comingSoon, false);
}

// Subscriber Coming Soon (trial/legacy skalx before migration, or still-gated plan)
{
  const d = decideBasicAnalyticsAccess({
    cohort: "active_subscriber",
    planFlag: { enabled: false, comingSoon: true },
  });
  assert.strictEqual(d.entitled, false);
  assert.strictEqual(d.comingSoon, true);
}

// Trial is active_subscriber — Coming Soon / missing flag denied
{
  const trial = classifyAnalyticsBillingCohort({
    hasActiveOrTrialingSubscription: true,
    subscriptionRowCount: 1,
  });
  assert.strictEqual(trial, "active_subscriber");
  const d = decideBasicAnalyticsAccess({
    cohort: trial,
    planFlag: { enabled: false, comingSoon: true },
  });
  assert.strictEqual(d.entitled, false);
}

// Legacy / expired / unclassified with subscription history → denied
{
  const d = decideBasicAnalyticsAccess({ cohort: "inactive_subscriber" });
  assert.strictEqual(d.entitled, false);
  assert.strictEqual(d.enabled, false);
}

// Missing plan flag on subscriber → deny
{
  const d = decideBasicAnalyticsAccess({
    cohort: "active_subscriber",
    planFlag: null,
  });
  assert.strictEqual(d.entitled, false);
}

// Absence of *active* sub is not PAYG when history exists
assert.notStrictEqual(
  classifyAnalyticsBillingCohort({
    hasActiveOrTrialingSubscription: false,
    subscriptionRowCount: 2,
  }),
  "payg"
);

// Unauthenticated metrics API
{
  const gate = enforceBasicAnalyticsForMetricsApi({
    userId: null,
    access: { entitled: true, enabled: true, comingSoon: false },
  });
  assert.strictEqual(gate.ok, false);
  if (!gate.ok) {
    assert.strictEqual(gate.status, 401);
    assert.strictEqual(gate.body.error, "missing_user");
  }
}

// PAYG allowed through metrics gate
{
  const access = decideBasicAnalyticsAccess({ cohort: "payg" });
  const gate = enforceBasicAnalyticsForMetricsApi({
    userId: "user-payg",
    access,
  });
  assert.strictEqual(gate.ok, true);
}

// Disabled subscriber → 403
{
  const access = decideBasicAnalyticsAccess({
    cohort: "active_subscriber",
    planFlag: { enabled: false, comingSoon: false },
  });
  const gate = enforceBasicAnalyticsForMetricsApi({
    userId: "user-sub",
    access,
  });
  assert.strictEqual(gate.ok, false);
  if (!gate.ok) {
    assert.strictEqual(gate.status, 403);
    assert.strictEqual(
      (gate.body as { error: string }).error,
      "feature_not_entitled"
    );
    assert.strictEqual(
      (gate.body as { feature: string }).feature,
      "basic_analytics"
    );
  }
}

// Coming soon subscriber → 403
{
  const access = decideBasicAnalyticsAccess({
    cohort: "active_subscriber",
    planFlag: { enabled: false, comingSoon: true },
  });
  const gate = enforceBasicAnalyticsForMetricsApi({
    userId: "user-soon",
    access,
  });
  assert.strictEqual(gate.ok, false);
  if (!gate.ok) {
    assert.strictEqual(gate.status, 403);
    assert.strictEqual((gate.body as { comingSoon: boolean }).comingSoon, true);
  }
}

// Both metrics handlers share the gate
{
  const ads = readFileSync(
    join(process.cwd(), "pages/api/ads/metrics.ts"),
    "utf8"
  );
  const integrations = readFileSync(
    join(process.cwd(), "pages/api/integrations/metrics.ts"),
    "utf8"
  );
  assert.ok(
    ads.includes("enforceBasicAnalyticsForMetricsApi"),
    "ads/metrics must use shared gate"
  );
  assert.ok(
    integrations.includes("enforceBasicAnalyticsForMetricsApi"),
    "integrations/metrics must use shared gate"
  );
}

// Enabling Analytics does not unlock unrelated features (contract + SQL)
assert.strictEqual(ADVANCED_ANALYTICS_STILL_GATED_CONTRACT.enabled, false);
assert.strictEqual(ADVANCED_ANALYTICS_STILL_GATED_CONTRACT.comingSoon, true);
{
  const sql = readFileSync(
    join(
      process.cwd(),
      "supabase/migrations/20261013140000_enable_basic_analytics.sql"
    ),
    "utf8"
  );
  assert.ok(sql.includes("feature_key = 'basic_analytics'"));
  assert.ok(!sql.includes("feature_key = 'advanced_analytics'"));
  assert.ok(!sql.includes("feature_key = 'create_campaigns'"));
  assert.ok(!sql.includes("feature_key = 'dashboard'"));
  for (const id of SKALX_BASIC_ANALYTICS_PLAN_IDS) {
    assert.ok(sql.includes(`'${id}'`), `migration must include ${id}`);
  }
  assert.ok(
    sql.includes("AND plan_id IN"),
    "migration must scope by plan_id"
  );
  const update = sql.slice(sql.indexOf("UPDATE public.plan_feature_flags"));
  assert.ok(!update.includes("free_trial"));
  assert.ok(!update.includes("basic_monthly"));
  assert.ok(!update.includes("growth_pro_monthly"));
}

console.log("features access.test: PASS");
