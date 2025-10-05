// pages/api/auth/instagram/updateLeadStatus.ts

import { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { supabase } from "../../../../lib/supabaseClient";
// const supabase = createClient(
//   process.env.SUPABASE_URL as string,
//   process.env.SUPABASE_ANON_KEY as string
// );

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const { lead_id, status } = req.body;

    if (!lead_id || !status) {
      return res.status(400).json({ error: "Missing required params" });
    }

    const { data, error } = await supabase
      .from("leads")
      .update({ status })
      .eq("lead_id", lead_id)
      .select();

    if (error) throw error;

    return res.status(200).json({ success: true, updated: data?.[0] });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
