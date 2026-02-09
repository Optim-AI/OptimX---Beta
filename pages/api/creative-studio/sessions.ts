// pages/api/creative-studio/sessions.ts
// Handles GET (list all sessions) and POST (create new session)

import type { NextApiRequest, NextApiResponse } from "next";
import { getUserIdFromRequest } from "@/auth/request";
import { CreativeStudioSessionDAO } from "@/database/models/CreativeStudioSession.dao";

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
    const sessionType = (type === "poster" || type === "video") ? type : undefined;

    const data = await CreativeStudioSessionDAO.listByUser(userId, {
      sessionType,
      limit: limitNum,
    });

    // Transform data to match frontend types
    const sessions = data.map((session) => ({
      id: session.id,
      name: session.name,
      sessionType: session.sessionType,
      brandSnapshot: session.brandSnapshot,
      phase: session.phase,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
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
    const exists = await CreativeStudioSessionDAO.existsByNameAndType(
      userId,
      trimmedName,
      sessionType
    );

    if (exists) {
      return res.status(400).json({
        ok: false,
        error: `A ${sessionType} session with this name already exists. Please choose a different name.`,
      });
    }

    const payload: any = {
      userId,
      name: trimmedName,
      sessionType,
      brandSnapshot,
    };

    // Add poster-specific fields
    if (sessionType === "poster") {
      if (phase) payload.phase = phase;
      if (messages) payload.messages = messages;
      if (productData) payload.productData = productData;
      if (posterPrompt) payload.posterPrompt = posterPrompt;
      if (config) payload.config = config;
      if (generatedPosters) payload.generatedPosters = generatedPosters;
    }

    // Add video-specific fields
    if (sessionType === "video") {
      if (adBuilderData) payload.adBuilderData = adBuilderData;
      if (generatedVideos) payload.generatedVideos = generatedVideos;
    }

    const data = await CreativeStudioSessionDAO.create(payload);

    // Transform response to match frontend types
    const session = {
      id: data.id,
      userId: data.userId,
      name: data.name,
      sessionType: data.sessionType,
      brandSnapshot: data.brandSnapshot,
      phase: data.phase,
      messages: data.messages,
      productData: data.productData,
      posterPrompt: data.posterPrompt,
      config: data.config,
      generatedPosters: data.generatedPosters,
      adBuilderData: data.adBuilderData,
      generatedVideos: data.generatedVideos,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
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
