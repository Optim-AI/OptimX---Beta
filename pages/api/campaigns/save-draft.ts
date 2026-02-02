// pages/api/campaigns/save-draft.ts (simplified)
import type { NextApiRequest, NextApiResponse } from "next";
// import { supabaseAdmin } from "../lib/supabaseClient"; // admin client
import { supabaseAdmin } from "../../../lib/supabaseAdmin"

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });

  try {
    // TEMPORARILY DISABLED: Auth check
    // const authHeader = req.headers.authorization;
    // let userId: string | null = null;

    // if (authHeader?.startsWith("Bearer ")) {
    //   const token = authHeader.split(" ")[1];
    //   // verify token with supabase admin (server)
    //   const { data, error } = await supabaseAdmin.auth.getUser(token);
    //   if (error) throw error;
    //   userId = data?.user?.id ?? null;
    // }

    // // fallback to userId in body for dev (NOT recommended for prod)
    // if (!userId && req.body?._userId) {
    //   userId = String(req.body._userId);
    // }

    // if (!userId) return res.status(401).json({ ok: false, error: "missing_user" });

    // Use dummy user ID for now
    const userId = "temp-user-id";

    // now insert/update draft into your DB using userId
    // ... (your db logic)
    return res.status(200).json({ ok: true, draft: { userId } });
  } catch (err: any) {
    console.error("save-draft error", err);
    return res.status(500).json({ ok: false, error: err.message ?? String(err) });
  }
}
