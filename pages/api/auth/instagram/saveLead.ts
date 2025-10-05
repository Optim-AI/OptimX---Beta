// pages/api/auth/instagram/saveLead.ts

import { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { v4 as uuidv4 } from "uuid";
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

    const { full_name, email, phone, source } = req.body;

    if (!full_name && !email && !phone) {
      return res.status(400).json({ error: "Missing required params" });
    }

    const lead_id = uuidv4();

    const { data, error } = await supabase
      .from("leads")
      .insert([
        {
          lead_id,
          full_name,
          email,
          phone,
          source: source || "manual",
          status: "new",
        },
      ])
      .select();

    if (error) throw error;

    return res.status(200).json({ success: true, lead: data?.[0] });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}
