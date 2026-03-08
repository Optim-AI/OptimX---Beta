// lib/features/feature.service.ts
// Service for feature gating and access control

import { PlansDAO } from '@/database/models/Plans.dao';
import { SubscriptionsDAO } from '@/database/models/Subscriptions.dao';

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

  // Analytics - coming soon
  basic_analytics: { enabled: false, comingSoon: true, reason: 'Coming soon' },
  advanced_analytics: { enabled: false, comingSoon: true, reason: 'Coming soon' },

  // Advanced features - require subscription
  social_posting: { enabled: false, comingSoon: false, reason: 'Subscription required' },
  auto_scheduling: { enabled: false, comingSoon: false, reason: 'Subscription required' },
  brand_analysis: { enabled: false, comingSoon: false, reason: 'Subscription required' },
  competitive_analysis: { enabled: false, comingSoon: false, reason: 'Subscription required' },

  // Dashboard and integrations - coming soon (Meta integration pending approval)
  dashboard: { enabled: false, comingSoon: true, reason: 'Coming soon' },
  integrations: { enabled: false, comingSoon: false, reason: 'Subscription required' },

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
      return {
        features: NO_SUBSCRIPTION_ACCESS,
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
    if (access.features.create_campaigns.enabled) visibleItems.push('create-campaigns');
    if (access.features.campaign_library.enabled) visibleItems.push('campaigns');

    return visibleItems;
  }
}
