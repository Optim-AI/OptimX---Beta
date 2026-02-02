// pages/api/creative-studio/sessions/[id].ts
// Handles GET (single session), PUT (update), DELETE

import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseAdmin } from "@/auth/supabase/client";
import { getUserIdFromRequest } from "@/auth/request";

// Increase body size limit to 10MB for large image payloads
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Get authenticated user ID
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      return res.status(401).json({ ok: false, error: "Authentication required" });
    }

    const { id } = req.query;
    if (!id || typeof id !== "string") {
      return res.status(400).json({ ok: false, error: "Missing session ID" });
    }

    if (req.method === "GET") {
      return handleGetSession(req, res, userId, id);
    } else if (req.method === "PUT") {
      return handleUpdateSession(req, res, userId, id);
    } else if (req.method === "DELETE") {
      return handleDeleteSession(req, res, userId, id);
    } else {
      return res.status(405).json({ ok: false, error: "Method not allowed" });
    }
  } catch (err: any) {
    console.error("session/[id] API error:", err);
    return res.status(500).json({
      ok: false,
      error: err.message || "Internal server error",
    });
  }
}

/**
 * GET /api/creative-studio/sessions/[id]
 * Returns a single session by ID
 */
async function handleGetSession(
  req: NextApiRequest,
  res: NextApiResponse,
  userId: string,
  sessionId: string
) {
  try {
    const { data, error } = await supabaseAdmin
      .from("creative_studio_sessions")
      .select("*")
      .eq("id", sessionId)
      .eq("user_id", userId)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return res.status(404).json({
          ok: false,
          error: "Session not found",
        });
      }

      console.error("Failed to fetch session:", error);
      return res.status(500).json({
        ok: false,
        error: `Failed to fetch session: ${error.message}`,
      });
    }

    if (!data) {
      return res.status(404).json({
        ok: false,
        error: "Session not found",
      });
    }

    console.log('[DEBUG API] Get session from DB:', {
      sessionId,
      hasAdBuilderData: !!data.ad_builder_data,
      adBuilderStep: data.ad_builder_data?.step,
      hasProduct: !!data.ad_builder_data?.product,
      productName: data.ad_builder_data?.product?.product_name,
    });

    // Transform response to match frontend types
    const session = {
      id: data.id,
      userId: data.user_id,
      name: data.name,
      sessionType: data.session_type,
      brandSnapshot: data.brand_snapshot,
      phase: data.phase,
      messages: data.messages,
      productData: data.product_data,
      posterPrompt: data.poster_prompt,
      config: data.config,
      generatedPosters: data.generated_posters,
      adBuilderData: data.ad_builder_data,
      generatedVideos: data.generated_videos,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };

    return res.status(200).json({
      ok: true,
      session,
    });
  } catch (e: any) {
    console.error("Get session error:", e);
    return res.status(500).json({
      ok: false,
      error: `Failed to fetch session: ${e.message || "Unknown error"}`,
    });
  }
}

/**
 * PUT /api/creative-studio/sessions/[id]
 * Updates an existing session
 * Body: Partial session data to update
 */
async function handleUpdateSession(
  req: NextApiRequest,
  res: NextApiResponse,
  userId: string,
  sessionId: string
) {
  const {
    name,
    brandSnapshot,
    phase,
    messages,
    productData,
    posterPrompt,
    config,
    generatedPosters,
    adBuilderData,
    generatedVideos,
  } = req.body ?? {};
  
  console.log('[DEBUG API] Update session:', {
    sessionId,
    hasAdBuilderData: !!adBuilderData,
    adBuilderStep: adBuilderData?.step,
    hasProduct: !!adBuilderData?.product,
    productName: adBuilderData?.product?.product_name,
  });

  try {
    // First, verify the session exists and belongs to the user
    const { data: existingSession, error: fetchError } = await supabaseAdmin
      .from("creative_studio_sessions")
      .select("id, session_type")
      .eq("id", sessionId)
      .eq("user_id", userId)
      .single();

    if (fetchError || !existingSession) {
      return res.status(404).json({
        ok: false,
        error: "Session not found",
      });
    }

    // Build update payload
    const payload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    // Common fields
    if (name !== undefined) payload.name = name.trim();
    if (brandSnapshot !== undefined) payload.brand_snapshot = brandSnapshot;

    // Poster-specific fields
    if (existingSession.session_type === "poster") {
      if (phase !== undefined) payload.phase = phase;
      if (messages !== undefined) payload.messages = messages;
      if (productData !== undefined) payload.product_data = productData;
      if (posterPrompt !== undefined) payload.poster_prompt = posterPrompt;
      if (config !== undefined) payload.config = config;
      if (generatedPosters !== undefined) payload.generated_posters = generatedPosters;
    }

    // Video-specific fields
    if (existingSession.session_type === "video") {
      if (adBuilderData !== undefined) payload.ad_builder_data = adBuilderData;
      if (generatedVideos !== undefined) payload.generated_videos = generatedVideos;
    }

    const { data, error } = await supabaseAdmin
      .from("creative_studio_sessions")
      .update(payload)
      .eq("id", sessionId)
      .eq("user_id", userId)
      .select()
      .single();

    if (error) {
      console.error("Failed to update session:", error);
      return res.status(500).json({
        ok: false,
        error: `Failed to update session: ${error.message}`,
      });
    }

    // Transform response to match frontend types
    const session = {
      id: data.id,
      userId: data.user_id,
      name: data.name,
      sessionType: data.session_type,
      brandSnapshot: data.brand_snapshot,
      phase: data.phase,
      messages: data.messages,
      productData: data.product_data,
      posterPrompt: data.poster_prompt,
      config: data.config,
      generatedPosters: data.generated_posters,
      adBuilderData: data.ad_builder_data,
      generatedVideos: data.generated_videos,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };

    return res.status(200).json({
      ok: true,
      session,
    });
  } catch (e: any) {
    console.error("Update session error:", e);
    return res.status(500).json({
      ok: false,
      error: `Failed to update session: ${e.message || "Unknown error"}`,
    });
  }
}

/**
 * DELETE /api/creative-studio/sessions/[id]
 * Deletes a session
 */
async function handleDeleteSession(
  req: NextApiRequest,
  res: NextApiResponse,
  userId: string,
  sessionId: string
) {
  try {
    // First, verify the session exists and belongs to the user
    const { data: existingSession, error: fetchError } = await supabaseAdmin
      .from("creative_studio_sessions")
      .select("id")
      .eq("id", sessionId)
      .eq("user_id", userId)
      .single();

    if (fetchError || !existingSession) {
      return res.status(404).json({
        ok: false,
        error: "Session not found",
      });
    }

    const { error } = await supabaseAdmin
      .from("creative_studio_sessions")
      .delete()
      .eq("id", sessionId)
      .eq("user_id", userId);

    if (error) {
      console.error("Failed to delete session:", error);
      return res.status(500).json({
        ok: false,
        error: `Failed to delete session: ${error.message}`,
      });
    }

    return res.status(200).json({
      ok: true,
      message: "Session deleted successfully",
    });
  } catch (e: any) {
    console.error("Delete session error:", e);
    return res.status(500).json({
      ok: false,
      error: `Failed to delete session: ${e.message || "Unknown error"}`,
    });
  }
}
