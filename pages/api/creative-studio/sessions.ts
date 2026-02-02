// pages/api/creative-studio/sessions.ts
// Handles GET (list all sessions) and POST (create new session)

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

    if (req.method === "GET") {
      return handleGetSessions(req, res, userId);
    } else if (req.method === "POST") {
      return handleCreateSession(req, res, userId);
    } else {
      return res.status(405).json({ ok: false, error: "Method not allowed" });
    }
  } catch (err: any) {
    console.error("sessions API error:", err);
    return res.status(500).json({
      ok: false,
      error: err.message || "Internal server error",
    });
  }
}

/**
 * GET /api/creative-studio/sessions
 * Query params:
 * - type: 'poster' | 'video' (optional, filter by session type)
 * - limit: number (optional, default 50)
 */
async function handleGetSessions(
  req: NextApiRequest,
  res: NextApiResponse,
  userId: string
) {
  const { type, limit = "50" } = req.query;
  const limitNum = Math.min(parseInt(limit as string) || 50, 100);

  try {
    let query = supabaseAdmin
      .from("creative_studio_sessions")
      .select("id, name, session_type, brand_snapshot, phase, created_at, updated_at")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(limitNum);

    // Filter by session type if provided
    if (type && (type === "poster" || type === "video")) {
      query = query.eq("session_type", type);
    }

    const { data, error } = await query;

    if (error) {
      // If table doesn't exist, return empty array
      if (error.message?.includes("does not exist") || error.code === "42P01") {
        return res.status(200).json({
          ok: true,
          sessions: [],
          message: "Sessions table not configured",
        });
      }

      console.error("Failed to fetch sessions:", error);
      return res.status(500).json({
        ok: false,
        error: `Failed to fetch sessions: ${error.message}`,
      });
    }

    // Transform data to match frontend types
    const sessions = (data || []).map((session) => ({
      id: session.id,
      name: session.name,
      sessionType: session.session_type,
      brandSnapshot: session.brand_snapshot,
      phase: session.phase,
      createdAt: session.created_at,
      updatedAt: session.updated_at,
    }));

    return res.status(200).json({
      ok: true,
      sessions,
    });
  } catch (e: any) {
    console.error("Get sessions error:", e);
    return res.status(500).json({
      ok: false,
      error: `Failed to fetch sessions: ${e.message || "Unknown error"}`,
    });
  }
}

/**
 * POST /api/creative-studio/sessions
 * Body:
 * - name: string (required)
 * - sessionType: 'poster' | 'video' (required)
 * - brandSnapshot: object (required)
 * - phase: string (optional, for poster sessions)
 * - messages: array (optional)
 * - productData: object (optional)
 * - posterPrompt: string (optional)
 * - config: object (optional)
 * - generatedPosters: array (optional)
 * - adBuilderData: object (optional, for video sessions)
 * - generatedVideos: array (optional)
 */
async function handleCreateSession(
  req: NextApiRequest,
  res: NextApiResponse,
  userId: string
) {
  const {
    name,
    sessionType,
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

  // Validation
  if (!name || typeof name !== "string") {
    return res.status(400).json({ ok: false, error: "Missing session name" });
  }

  if (!sessionType || (sessionType !== "poster" && sessionType !== "video")) {
    return res.status(400).json({ ok: false, error: "Invalid session type. Must be 'poster' or 'video'" });
  }

  if (!brandSnapshot) {
    return res.status(400).json({ ok: false, error: "Missing brand snapshot" });
  }

  try {
    const trimmedName = name.trim();
    
    // Check for duplicate session name for this user and session type
    const { data: existingSession } = await supabaseAdmin
      .from("creative_studio_sessions")
      .select("id")
      .eq("user_id", userId)
      .eq("session_type", sessionType)
      .ilike("name", trimmedName)
      .limit(1)
      .single();
    
    if (existingSession) {
      return res.status(400).json({
        ok: false,
        error: `A ${sessionType} session with this name already exists. Please choose a different name.`,
      });
    }
    
    const now = new Date().toISOString();
    const payload: Record<string, any> = {
      user_id: userId,
      name: trimmedName,
      session_type: sessionType,
      brand_snapshot: brandSnapshot,
      created_at: now,
      updated_at: now,
    };

    // Add poster-specific fields
    if (sessionType === "poster") {
      if (phase) payload.phase = phase;
      if (messages) payload.messages = messages;
      if (productData) payload.product_data = productData;
      if (posterPrompt) payload.poster_prompt = posterPrompt;
      if (config) payload.config = config;
      if (generatedPosters) payload.generated_posters = generatedPosters;
    }

    // Add video-specific fields
    if (sessionType === "video") {
      if (adBuilderData) payload.ad_builder_data = adBuilderData;
      if (generatedVideos) payload.generated_videos = generatedVideos;
    }

    const { data, error } = await supabaseAdmin
      .from("creative_studio_sessions")
      .insert([payload])
      .select()
      .single();

    if (error) {
      console.error("Failed to insert session:", error);

      // Check if it's a "relation does not exist" error
      if (error.message?.includes("does not exist") || error.code === "42P01") {
        return res.status(500).json({
          ok: false,
          error: "Sessions table not configured. Please run the database migration.",
          details: "Run: supabase db reset or apply the migration manually",
        });
      }

      return res.status(500).json({
        ok: false,
        error: `Failed to save session: ${error.message}`,
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

    return res.status(201).json({
      ok: true,
      session,
    });
  } catch (e: any) {
    console.error("Create session error:", e);
    return res.status(500).json({
      ok: false,
      error: `Failed to create session: ${e.message || "Unknown error"}`,
    });
  }
}
