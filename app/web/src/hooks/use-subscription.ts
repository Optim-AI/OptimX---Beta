// app/web/src/hooks/use-subscription.ts
import { create } from 'zustand';
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
  fetchSubscription: () => Promise<void>;
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

      fetchSubscription: async () => {
        const { lastFetched } = get();
        const CACHE_MS = 30 * 1000; // 30 seconds - avoid redundant fetches
        if (lastFetched && Date.now() - lastFetched < CACHE_MS) {
          return;
        }
        set({ isLoading: true, error: null });
        try {
          const response = await fetch('/api/billing/subscriptions/current');
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

      deductImageCredit: async (amount = 1) => {
        const { credits } = get();
        if (!credits || credits.imageCredits.total < amount) {
          return false;
        }

        try {
          const response = await fetch('/api/credits/deduct', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'image', amount }),
          });
          const data = await response.json();

          if (data.success && data.balance) {
            set({ credits: data.balance });
            return true;
          }
          return false;
        } catch {
          return false;
        }
      },

      deductVideoCredit: async (seconds: number) => {
        const { credits } = get();
        if (!credits || credits.videoCredits.total < seconds) {
          return false;
        }

        try {
          const response = await fetch('/api/credits/deduct', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'video', amount: seconds }),
          });
          const data = await response.json();

          if (data.success && data.balance) {
            set({ credits: data.balance });
            return true;
          }
          return false;
        } catch {
          return false;
        }
      },
    }),
    {
      name: 'optimx-subscription',
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
