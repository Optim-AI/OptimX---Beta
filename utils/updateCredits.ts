// utils/updateCredits.ts
// REFACTORED: Now uses Prisma CreditsDAO instead of direct Supabase
import { CreditsDAO } from '@/database';

/**
 * Deduct 1 credit from the user.
 * Returns the new balance or an error message.
 */
export async function deductCredit(userId: string): Promise<{ success: boolean; newCredits?: number; error?: string }> {
  return CreditsDAO.deduct(userId, 1);
}

/**
 * Add credits (admin or reward function)
 */
export async function addCredits(userId: string, amount: number): Promise<{ success: boolean; newCredits?: number; error?: string }> {
  return CreditsDAO.add(userId, amount);
}

/**
 * Get user credits safely
 */
export async function getCredits(userId: string): Promise<{ success: boolean; credits?: number; error?: string }> {
  return CreditsDAO.getBalance(userId);
}
