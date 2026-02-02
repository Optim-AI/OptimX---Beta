// pages/api/creative-studio/save-session.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "../../../lib/supabaseClient";

async function getUserFromRequest(req: NextApiRequest): Promise<{ user: any; userId: string } | null> {
  // TEMPORARILY DISABLED: Auth check - return dummy user
  return { user: { id: "temp-user-id", email: "temp@example.com" }, userId: "temp-user-id" };
  
  // Original implementation (commented out):
  // const authHeader = req.headers.authorization;
  // if (!authHeader || !authHeader.startsWith("Bearer ")) {
  //   return null;
  // }

  // const token = authHeader.split(" ")[1];
  // try {
  //   const { data: userData, error } = await supabaseAdmin.auth.getUser(token);
  //   if (error || !userData?.user) {
  //     return null;
  //   }
  //   return { user: userData.user, userId: userData.user.id };
  // } catch (e) {
  //   console.error("getUserFromRequest error:", e);
  //   return null;
  // }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  try {
    // TEMPORARILY DISABLED: Auth check
    const auth = await getUserFromRequest(req);
    // if (!auth) {
    //   return res.status(401).json({ ok: false, error: "Authentication required" });
    // }

    const { userId } = auth || { userId: "temp-user-id" };
    const { name, brandSnapshot, productData, config } = req.body ?? {};

    if (!name || typeof name !== "string") {
      return res.status(400).json({ ok: false, error: "Missing session name" });
    }

    if (!brandSnapshot) {
      return res.status(400).json({ ok: false, error: "Missing brand snapshot" });
    }

    // Save session data (using a JSON column or storing as JSONB)
    // If creative_studio_sessions table doesn't exist, we can store in a generic way
    // For now, let's try to insert into a table or use a fallback
    try {
      const payload = {
        user_id: userId,
        name: name,
        brand_snapshot: brandSnapshot,
        product_data: productData || null,
        config: config || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Try to insert into creative_studio_sessions table
      // If it doesn't exist, we'll catch the error and use an alternative
      const { data, error } = await supabaseAdmin
        .from("creative_studio_sessions")
        .insert([payload])
        .select()
        .single();

      if (error) {
        // If table doesn't exist, we could create it or use localStorage fallback
        // For now, let's return an error suggesting the table needs to be created
        console.error("Failed to insert session:", error);
        
        // Check if it's a "relation does not exist" error
        if (error.message?.includes("does not exist") || error.code === "42P01") {
          return res.status(500).json({
            ok: false,
            error: "Sessions table not configured. Please create 'creative_studio_sessions' table in Supabase.",
            details: "Table should have: user_id, name, brand_snapshot (jsonb), product_data (jsonb), config (jsonb), created_at, updated_at",
          });
        }

        return res.status(500).json({
          ok: false,
          error: `Failed to save session: ${error.message}`,
        });
      }

      return res.status(200).json({
        ok: true,
        sessionId: data.id,
        session: data,
      });
    } catch (e: any) {
      console.error("Save session error:", e);
      return res.status(500).json({
        ok: false,
        error: `Failed to save session: ${e.message || "Unknown error"}`,
      });
    }
  } catch (err: any) {
    console.error("save-session error:", err);
    return res.status(500).json({
      ok: false,
      error: err.message || "Internal server error",
    });
  }
}

