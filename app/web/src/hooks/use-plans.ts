// app/web/src/hooks/use-plans.ts
import { create } from 'zustand';

interface Plan {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  billingCycle: string;
  priceInr: number;
  imageCredits: number;
  videoCredits: number;
  isActive: boolean;
  displayOrder: number;
}

interface GroupedPlan {
  name: string;
  monthly: Plan | null;
  quarterly: Plan | null;
}

interface CreditPack {
  id: string;
  name: string;
  creditType: 'image' | 'video';
  credits: number;
  priceInr: number;
  isActive: boolean;
  displayOrder: number;
}

interface PlansState {
  // State
  plans: Plan[];
  groupedPlans: GroupedPlan[];
  creditPacks: CreditPack[];
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchPlans: () => Promise<void>;
  fetchGroupedPlans: () => Promise<void>;
  fetchCreditPacks: (type?: 'image' | 'video') => Promise<void>;
  getPlanById: (id: string) => Plan | undefined;
}

export const usePlans = create<PlansState>()((set, get) => ({
  plans: [],
  groupedPlans: [],
  creditPacks: [],
  isLoading: false,
  error: null,

  fetchPlans: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch('/api/billing/plans');
      const data = await response.json();

      if (data.success) {
        set({ plans: data.plans, isLoading: false });
      } else {
        set({ error: data.error || 'Failed to fetch plans', isLoading: false });
      }
    } catch (error: any) {
      set({ error: error.message || 'Failed to fetch plans', isLoading: false });
    }
  },

  fetchGroupedPlans: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await fetch('/api/billing/plans?grouped=true');
      const data = await response.json();

      if (data.success) {
        set({ groupedPlans: data.plans, isLoading: false });
      } else {
        set({ error: data.error || 'Failed to fetch plans', isLoading: false });
      }
    } catch (error: any) {
      set({ error: error.message || 'Failed to fetch plans', isLoading: false });
    }
  },

  fetchCreditPacks: async (type?: 'image' | 'video') => {
    set({ isLoading: true, error: null });
    try {
      const url = type 
        ? `/api/billing/credit-packs?type=${type}`
        : '/api/billing/credit-packs';
      const response = await fetch(url);
      const data = await response.json();

      if (data.success) {
        set({ creditPacks: data.creditPacks, isLoading: false });
      } else {
        set({ error: data.error || 'Failed to fetch credit packs', isLoading: false });
      }
    } catch (error: any) {
      set({ error: error.message || 'Failed to fetch credit packs', isLoading: false });
    }
  },

  getPlanById: (id: string) => {
    return get().plans.find((plan) => plan.id === id);
  },
}));
