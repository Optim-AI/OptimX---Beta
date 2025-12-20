import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface CreditsState {
  credits: number;
  maxCredits: number;
  useCredit: () => boolean;
  addCredits: (amount: number) => void;
  resetCredits: () => void;
}

export const useCredits = create<CreditsState>()(
  persist(
    (set, get) => ({
      credits: 20,
      maxCredits: 20,
      useCredit: () => {
        const { credits } = get();
        if (credits > 0) {
          set({ credits: credits - 1 });
          return true;
        }
        return false;
      },
      addCredits: (amount: number) => {
        set((state) => ({
          credits: Math.min(state.credits + amount, state.maxCredits),
        }));
      },
      resetCredits: () => {
        set({ credits: 20 });
      },
    }),
    {
      name: 'optimx-credits',
    }
  )
);
