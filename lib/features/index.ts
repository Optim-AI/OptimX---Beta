// lib/features/index.ts
export { FeatureService } from './feature.service';
export type { FeatureKey, FeatureAccess, UserFeatureAccess } from './feature.service';
export {
  isFeatureEntitled,
  decideBasicAnalyticsAccess,
  classifyAnalyticsBillingCohort,
  enforceBasicAnalyticsForMetricsApi,
} from './access';
