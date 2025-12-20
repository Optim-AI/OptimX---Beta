// pages/api/credits/update.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // must be service role key (not public anon)
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) return res.status(401).json({ error: "Missing token" });

    const { data: user, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user?.user) return res.status(401).json({ error: "Invalid token" });
    const userId = user.user.id;

    // Deduct 1 credit
    const { data, error } = await supabase
      .from("user_credits")
      .update({ credits: supabase.rpc("decrement_credit", { user_id: userId }) })
      .eq("id", userId)
      .select();

    // fallback if RPC not exists
    if (error) {
      await supabase.rpc("decrement_credit_fallback", { user_id: userId });
    }

    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error("credits/update error", e);
    res.status(500).json({ error: (e as any).message || "Internal error" });
  }
}
