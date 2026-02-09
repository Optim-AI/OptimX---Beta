// app/web/src/hooks/use-features.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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

interface Plan {
  id: string;
  name: string;
  billingCycle: string;
}

interface FeaturesState {
  // State
  features: Record<FeatureKey, FeatureAccess> | null;
  plan: Plan | null;
  isLoading: boolean;
  error: string | null;
  lastFetched: number | null;

  // Actions
  fetchFeatures: () => Promise<void>;
  checkFeature: (key: FeatureKey) => FeatureAccess;
  isEnabled: (key: FeatureKey) => boolean;
  isComingSoon: (key: FeatureKey) => boolean;
  clearFeatures: () => void;
}

const DEFAULT_ACCESS: FeatureAccess = {
  enabled: false,
  comingSoon: false,
  reason: 'Subscription required',
};

export const useFeatures = create<FeaturesState>()(
  persist(
    (set, get) => ({
      features: null,
      plan: null,
      isLoading: false,
      error: null,
      lastFetched: null,

      fetchFeatures: async () => {
        set({ isLoading: true, error: null });
        try {
          const response = await fetch('/api/features/access');
          const data = await response.json();

          if (data.success) {
            set({
              features: data.features,
              plan: data.plan,
              isLoading: false,
              lastFetched: Date.now(),
            });
          } else {
            set({
              error: data.error || 'Failed to fetch features',
              isLoading: false,
            });
          }
        } catch (error: any) {
          set({
            error: error.message || 'Failed to fetch features',
            isLoading: false,
          });
        }
      },

      checkFeature: (key: FeatureKey): FeatureAccess => {
        const { features } = get();
        if (!features) return DEFAULT_ACCESS;
        return features[key] || DEFAULT_ACCESS;
      },

      isEnabled: (key: FeatureKey): boolean => {
        const { features } = get();
        if (!features) return false;
        return features[key]?.enabled || false;
      },

      isComingSoon: (key: FeatureKey): boolean => {
        const { features } = get();
        if (!features) return false;
        return features[key]?.comingSoon || false;
      },

      clearFeatures: () => {
        set({
          features: null,
          plan: null,
          lastFetched: null,
        });
      },
    }),
    {
      name: 'optimx-features',
      partialize: (state) => ({
        features: state.features,
        plan: state.plan,
        lastFetched: state.lastFetched,
      }),
    }
  )
);

// Hook to check if feature data is stale (older than 5 minutes)
export function useIsFeaturesStale() {
  const lastFetched = useFeatures((state) => state.lastFetched);
  if (!lastFetched) return true;
  return Date.now() - lastFetched > 5 * 60 * 1000;
}
