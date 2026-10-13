// lib/features/feature.service.ts
// Service for feature gating and access control

import { PlansDAO } from '@/database/models/Plans.dao';
import { SubscriptionsDAO } from '@/database/models/Subscriptions.dao';
import {
  classifyAnalyticsBillingCohort,
  decideBasicAnalyticsAccess,
  isFeatureEntitled,
} from '@/lib/features/access';
import {
  ADVANCED_ANALYTICS_STILL_GATED_CONTRACT,
  BASIC_ANALYTICS_DENIED_CONTRACT,
} from '@/lib/features/feature-access.contract';

export {
  isFeatureEntitled,
  featureBlockReason,
  decideBasicAnalyticsAccess,
  classifyAnalyticsBillingCohort,
  enforceBasicAnalyticsForMetricsApi,
  basicAnalyticsForbiddenBody,
} from '@/lib/features/access';

export type FeatureKey = 
  | 'image_generation'
  | 'video_generation'
  | 'no_watermark'
  | 'fast_generation'
  | 'priority_generation'
  | 'basic_analytics'
  | 'advanced_analytics'
  | 'social_posting'
  | 'auto_scheduling'
  | 'brand_analysis'
  | 'competitive_analysis'
  | 'dashboard'
  | 'integrations'
  | 'create_campaigns'
  | 'campaign_library';

export interface FeatureAccess {
  enabled: boolean;
  comingSoon: boolean;
  reason?: string;
}

export interface UserFeatureAccess {
  features: Record<FeatureKey, FeatureAccess>;
  plan: {
    id: string;
    name: string;
    billingCycle: string;
  } | null;
  subscription: {
    id: string;
    status: string;
    trialEndsAt?: string;
    currentPeriodEnd: string;
  } | null;
}

// Default access for users without subscription (pay-as-you-go model)
const NO_SUBSCRIPTION_ACCESS: Record<FeatureKey, FeatureAccess> = {
  // Core generation features - enabled for everyone (pay-as-you-go with credits)
  image_generation: { enabled: true, comingSoon: false },
  video_generation: { enabled: true, comingSoon: false },

  // Premium features - require subscription
  no_watermark: { enabled: false, comingSoon: false, reason: 'Subscription required' },
  fast_generation: { enabled: false, comingSoon: false, reason: 'Subscription required' },
  priority_generation: { enabled: false, comingSoon: false, reason: 'Subscription required' },

  // basic_analytics is decided separately (PAYG vs subscriber vs history).
  // Fail closed in this map so a missed override cannot grant Analytics.
  basic_analytics: { ...BASIC_ANALYTICS_DENIED_CONTRACT },
  advanced_analytics: { ...ADVANCED_ANALYTICS_STILL_GATED_CONTRACT },

  // Advanced features - require subscription
  social_posting: { enabled: false, comingSoon: false, reason: 'Subscription required' },
  auto_scheduling: { enabled: false, comingSoon: false, reason: 'Subscription required' },
  brand_analysis: { enabled: false, comingSoon: false, reason: 'Subscription required' },
  competitive_analysis: { enabled: false, comingSoon: false, reason: 'Subscription required' },

  // Dashboard + ad platform connect — available for new / pay-as-you-go users
  dashboard: { enabled: true, comingSoon: false },
  integrations: { enabled: true, comingSoon: false },

  // Campaign features - disabled for pay-as-you-go users
  create_campaigns: { enabled: false, comingSoon: false, reason: 'Subscription required' },

  // Campaign library - disabled for pay-as-you-go users
  campaign_library: { enabled: false, comingSoon: false, reason: 'Subscription required' },
};

export class FeatureService {
  /**
   * Get all feature access for a user
   */
  static async getUserFeatureAccess(userId: string): Promise<UserFeatureAccess> {
    // Get active subscription
    const subscription = await SubscriptionsDAO.getActiveByUserId(userId);

    if (!subscription) {
      const features = { ...NO_SUBSCRIPTION_ACCESS };
      const analytics = await this.resolveBasicAnalyticsAccess(userId, null);
      features.basic_analytics = {
        enabled: analytics.enabled,
        comingSoon: analytics.comingSoon,
        reason: analytics.reason,
      };
      return {
        features,
        plan: null,
        subscription: null,
      };
    }

    // Get feature flags for the plan
    const featureFlags = await PlansDAO.getFeatureFlags(subscription.planId);

    // Build feature access map
    const features: Record<string, FeatureAccess> = {};
    
    for (const key of Object.keys(NO_SUBSCRIPTION_ACCESS) as FeatureKey[]) {
      const flag = featureFlags[key];
      if (flag) {
        features[key] = {
          enabled: flag.enabled,
          comingSoon: flag.comingSoon,
          reason: flag.comingSoon ? 'Coming soon' : (flag.enabled ? undefined : 'Not included in plan'),
        };
      } else {
        features[key] = {
          enabled: false,
          comingSoon: false,
          reason: 'Not included in plan',
        };
      }
    }

    const analytics = await this.resolveBasicAnalyticsAccess(userId, subscription);
    features.basic_analytics = {
      enabled: analytics.enabled,
      comingSoon: analytics.comingSoon,
      reason: analytics.reason,
    };

    return {
      features: features as Record<FeatureKey, FeatureAccess>,
      plan: {
        id: subscription.plan.id,
        name: subscription.plan.name,
        billingCycle: subscription.plan.billingCycle,
      },
      subscription: {
        id: subscription.id,
        status: subscription.status,
        trialEndsAt: subscription.trialEndsAt || undefined,
        currentPeriodEnd: subscription.currentPeriodEnd,
      },
    };
  }

  /**
   * Check if a specific feature is accessible
   */
  static async checkFeatureAccess(userId: string, featureKey: FeatureKey): Promise<FeatureAccess> {
    if (featureKey === 'basic_analytics') {
      const subscription = await SubscriptionsDAO.getActiveByUserId(userId);
      const decided = await this.resolveBasicAnalyticsAccess(userId, subscription);
      return {
        enabled: decided.enabled,
        comingSoon: decided.comingSoon,
        reason: decided.reason,
      };
    }

    const subscription = await SubscriptionsDAO.getActiveByUserId(userId);

    if (!subscription) {
      return NO_SUBSCRIPTION_ACCESS[featureKey] || { enabled: false, comingSoon: false, reason: 'Subscription required' };
    }

    const access = await PlansDAO.isFeatureEnabled(subscription.planId, featureKey);
    
    return {
      enabled: access.enabled,
      comingSoon: access.comingSoon,
      reason: access.comingSoon ? 'Coming soon' : (access.enabled ? undefined : 'Not included in plan'),
    };
  }

  /**
   * PAYG = zero subscription rows. Active/trialing → plan flags.
   * Expired/cancelled/pending (history, no active) → deny Analytics.
   */
  static async resolveBasicAnalyticsAccess(
    userId: string,
    activeSubscription: { planId: string } | null
  ) {
    if (activeSubscription) {
      const flag = await PlansDAO.isFeatureEnabled(
        activeSubscription.planId,
        'basic_analytics'
      );
      return decideBasicAnalyticsAccess({
        cohort: 'active_subscriber',
        planFlag: flag,
      });
    }

    const history = await SubscriptionsDAO.getAllByUserId(userId);
    const cohort = classifyAnalyticsBillingCohort({
      hasActiveOrTrialingSubscription: false,
      subscriptionRowCount: history.length,
    });
    return decideBasicAnalyticsAccess({ cohort });
  }

  /**
   * True when the user may use the feature (enabled and not coming soon).
   * Prefer this over checking flags independently in API handlers.
   */
  static async requireFeatureEntitled(
    userId: string,
    featureKey: FeatureKey
  ): Promise<FeatureAccess & { entitled: boolean }> {
    const access = await this.checkFeatureAccess(userId, featureKey);
    return { ...access, entitled: isFeatureEntitled(access) };
  }

  /**
   * Check if user can generate images
   */
  static async canGenerateImages(userId: string): Promise<{ allowed: boolean; reason?: string }> {
    const access = await this.checkFeatureAccess(userId, 'image_generation');
    return {
      allowed: access.enabled,
      reason: access.reason,
    };
  }

  /**
   * Check if user can generate videos
   */
  static async canGenerateVideos(userId: string): Promise<{ allowed: boolean; reason?: string }> {
    const access = await this.checkFeatureAccess(userId, 'video_generation');
    return {
      allowed: access.enabled,
      reason: access.reason,
    };
  }

  /**
   * Check if watermark should be applied
   */
  static async shouldApplyWatermark(userId: string): Promise<boolean> {
    const access = await this.checkFeatureAccess(userId, 'no_watermark');
    return !access.enabled; // Apply watermark if no_watermark is NOT enabled
  }

  /**
   * Get generation priority for user
   */
  static async getGenerationPriority(userId: string): Promise<'normal' | 'fast' | 'priority'> {
    const priorityAccess = await this.checkFeatureAccess(userId, 'priority_generation');
    if (priorityAccess.enabled) return 'priority';

    const fastAccess = await this.checkFeatureAccess(userId, 'fast_generation');
    if (fastAccess.enabled) return 'fast';

    return 'normal';
  }

  /**
   * Check if user has an active subscription
   */
  static async hasActiveSubscription(userId: string): Promise<boolean> {
    const subscription = await SubscriptionsDAO.getActiveByUserId(userId);
    return !!subscription;
  }

  /**
   * Get visible navigation items for user
   */
  static async getVisibleNavigation(userId: string): Promise<string[]> {
    const access = await this.getUserFeatureAccess(userId);
    
    const visibleItems: string[] = ['brand-studio']; // Always visible

    // Analytics is always visible (but may be gated with coming soon)
    visibleItems.push('analytics');

    // These are controlled by feature flags
    if (access.features.dashboard.enabled) visibleItems.push('dashboard');
    if (access.features.integrations.enabled) visibleItems.push('integrations');
    if (access.features.campaign_library.enabled) visibleItems.push('campaigns');

    return visibleItems;
  }
}
