// pages/api/auth/instagram/getLeads.ts

import { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { supabase } from "../../../../lib/supabaseClient";

// const supabase = createClient(
//   process.env.SUPABASE_URL as string,
//   process.env.SUPABASE_ANON_KEY as string
// );

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== "GET") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const { status } = req.query;

    let query = supabase.from("leads").select("*").order("created_at", { ascending: false });

    if (status && typeof status === "string" && status !== "all") {
      query = query.eq("status", status);
    }

    const { data, error } = await query;

    if (error) throw error;

    return res.status(200).json({ success: true, leads: data });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
