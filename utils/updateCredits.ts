// lib/updateCredits.ts
import { supabaseAdmin } from "../lib/supabaseClient";

/**
 * Deduct 1 credit from the user.
 * Returns the new balance or an error message.
 */
export async function deductCredit(userId: string): Promise<{ success: boolean; newCredits?: number; error?: string }> {
  try {
    if (!userId) return { success: false, error: "Missing user ID" };

    // Step 1: Fetch current credits
    const { data, error } = await supabaseAdmin
      .from("user_credits")
      .select("credits")
      .eq("id", userId)
      .single();

    if (error || !data) {
      console.error("Error fetching credits:", error?.message);
      return { success: false, error: error?.message || "User not found" };
    }

    const currentCredits = data.credits ?? 0;

    // Step 2: Check if credits are sufficient
    if (currentCredits <= 0) {
      console.warn(`User ${userId} has no remaining credits.`);
      return { success: false, error: "Credit limit reached" };
    }

    // Step 3: Deduct 1 credit
    const { error: updateError } = await supabaseAdmin
      .from("user_credits")
      .update({
        credits: currentCredits - 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);

    if (updateError) {
      console.error("Credit update failed:", updateError.message);
      return { success: false, error: updateError.message };
    }

    return { success: true, newCredits: currentCredits - 1 };
  } catch (err: any) {
    console.error("deductCredit error:", err.message);
    return { success: false, error: err.message || "Unexpected error" };
  }
}

/**
 * Add credits (admin or reward function)
 */
export async function addCredits(userId: string, amount: number): Promise<{ success: boolean; newCredits?: number; error?: string }> {
  try {
    if (!userId) return { success: false, error: "Missing user ID" };
    if (amount <= 0) return { success: false, error: "Invalid credit amount" };

    // Fetch current credits
    const { data, error } = await supabaseAdmin
      .from("user_credits")
      .select("credits")
      .eq("id", userId)
      .single();

    if (error || !data) return { success: false, error: error?.message || "User not found" };

    const newBalance = (data.credits ?? 0) + amount;

    // Update credits
    const { error: updateError } = await supabaseAdmin
      .from("user_credits")
      .update({
        credits: newBalance,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);

    if (updateError) return { success: false, error: updateError.message };

    return { success: true, newCredits: newBalance };
  } catch (err: any) {
    console.error("addCredits error:", err.message);
    return { success: false, error: err.message || "Unexpected error" };
  }
}

/**
 * Get user credits safely
 */
export async function getCredits(userId: string): Promise<{ success: boolean; credits?: number; error?: string }> {
  try {
    const { data, error } = await supabaseAdmin
      .from("user_credits")
      .select("credits")
      .eq("id", userId)
      .single();

    if (error || !data) return { success: false, error: error?.message || "User not found" };

    return { success: true, credits: data.credits };
  } catch (err: any) {
    console.error("getCredits error:", err.message);
    return { success: false, error: err.message };
  }
}
