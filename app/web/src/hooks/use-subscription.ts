// app/web/src/hooks/use-subscription.ts
import { create } from 'zustand';
import { authFetch } from '@/lib/utils';
import { persist } from 'zustand/middleware';

interface CreditBalance {
  subscription: number;
  addon: number;
  total: number;
}

interface Plan {
  id: string;
  name: string;
  billingCycle: string;
  imageCredits: number;
  videoCredits: number;
}

interface Subscription {
  id: string;
  status: string;
  plan: Plan;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  trialEndsAt?: string;
  nextResetDate: string;
}

interface Credits {
  imageCredits: CreditBalance;
  videoCredits: CreditBalance;
  lastResetAt: string | null;
}

interface SubscriptionState {
  // State
  subscription: Subscription | null;
  credits: Credits | null;
  hasSubscription: boolean;
  isLoading: boolean;
  error: string | null;
  lastFetched: number | null;
  
  // Actions
  fetchSubscription: (options?: { force?: boolean }) => Promise<void>;
  clearSubscription: () => void;
  setCredits: (credits: Credits) => void;
  deductImageCredit: (amount?: number) => Promise<boolean>;
  deductVideoCredit: (seconds: number) => Promise<boolean>;
}

export const useSubscription = create<SubscriptionState>()(
  persist(
    (set, get) => ({
      subscription: null,
      credits: null,
      hasSubscription: false,
      isLoading: false,
      error: null,
      lastFetched: null,

      fetchSubscription: async (options?: { force?: boolean }) => {
        const { lastFetched } = get();
        const CACHE_MS = 30 * 1000; // 30 seconds - avoid redundant fetches
        if (!options?.force && lastFetched && Date.now() - lastFetched < CACHE_MS) {
          return;
        }
        set({ isLoading: true, error: null });
        try {
          const response = await authFetch('/api/billing/subscriptions/current');
          const data = await response.json();

          if (data.success) {
            set({
              subscription: data.subscription,
              credits: data.credits,
              hasSubscription: data.hasSubscription,
              isLoading: false,
              lastFetched: Date.now(),
            });
          } else {
            set({
              error: data.error || 'Failed to fetch subscription',
              isLoading: false,
            });
          }
        } catch (error: any) {
          set({
            error: error.message || 'Failed to fetch subscription',
            isLoading: false,
          });
        }
      },

      clearSubscription: () => {
        set({
          subscription: null,
          credits: null,
          hasSubscription: false,
          lastFetched: null,
        });
      },

      setCredits: (credits: Credits) => {
        set({ credits });
      },

      deductImageCredit: async (_amount = 1) => {
        // Image billing is server-side only (poster/campaign generate after success).
        console.warn(
          '[useSubscription] deductImageCredit is disabled; use generation APIs for billing.'
        );
        return false;
      },

      deductVideoCredit: async (_seconds: number) => {
        // Video billing is server-side only (reserve on /api/commercial/generate).
        console.warn('[useSubscription] deductVideoCredit is disabled; use commercial generate billing.');
        return false;
      },
    }),
    {
      name: 'optimx-subscription',
      // Avoid SSR/client persist mismatches that mark hadRuntimeError and
      // force Fast Refresh into a full-reload loop on every HMR tick.
      skipHydration: true,
      partialize: (state) => ({
        subscription: state.subscription,
        credits: state.credits,
        hasSubscription: state.hasSubscription,
        lastFetched: state.lastFetched,
      }),
    }
  )
);

// Hook to check if subscription data is stale (older than 5 minutes)
export function useIsSubscriptionStale() {
  const lastFetched = useSubscription((state) => state.lastFetched);
  if (!lastFetched) return true;
  return Date.now() - lastFetched > 5 * 60 * 1000;
}
