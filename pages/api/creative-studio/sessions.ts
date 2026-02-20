// pages/api/creative-studio/sessions.ts
// Handles:
// - GET (list all sessions OR get single session with ?id=xxx)
// - POST (create new session)
// - PUT (update session with ?id=xxx)
// - DELETE (delete session with ?id=xxx)

import type { NextApiRequest, NextApiResponse } from "next";
import { getUserIdFromRequest } from "@/auth/request";
import { CreativeStudioSessionDAO } from "@/database/models/CreativeStudioSession.dao";
import { GeneratedImageDAO } from "@/database/models/GeneratedImage.dao";
import { SettingsDAO } from "@/database/models/Settings.dao";
import { supabaseAdmin } from "@/auth/supabase/client";

// Increase body size limit to 50MB for large image payloads (multiple poster data URLs)
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '50mb',
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

    // Check if ID is provided in query params
    const { id } = req.query;
    const sessionId = typeof id === 'string' ? id : undefined;

    if (req.method === "GET") {
      // GET with ?id=xxx -> get single session
      // GET without id -> list sessions
      if (sessionId) {
        return handleGetSession(req, res, userId, sessionId);
      } else {
        return handleGetSessions(req, res, userId);
      }
    } else if (req.method === "POST") {
      return handleCreateSession(req, res, userId);
    } else if (req.method === "PUT") {
      if (!sessionId) {
        return res.status(400).json({ ok: false, error: "Missing session ID" });
      }
      return handleUpdateSession(req, res, userId, sessionId);
    } else if (req.method === "DELETE") {
      if (!sessionId) {
        return res.status(400).json({ ok: false, error: "Missing session ID" });
      }
      return handleDeleteSession(req, res, userId, sessionId);
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
  const { type, limit = "50", includeMedia = "0" } = req.query;
  const limitNum = Math.min(parseInt(limit as string) || 50, 100);
  const includeMediaData = includeMedia === "1" || includeMedia === "true";

  try {
    const sessionType = (type === "poster" || type === "video") ? type : undefined;

    const data = await CreativeStudioSessionDAO.listByUser(userId, {
      sessionType,
      limit: limitNum,
    });

    // Transform data to match frontend types
    const sessions = data.map((session) => {
      const base = {
        id: session.id,
        name: session.name,
        sessionType: session.sessionType,
        brandSnapshot: session.brandSnapshot,
        phase: session.phase,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
      };
      if (includeMediaData) {
        return {
          ...base,
          generatedPosters: session.generatedPosters,
          generatedVideos: session.generatedVideos,
        };
      }
      return base;
    });

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

/**
 * GET /api/creative-studio/sessions?id=xxx
 * Returns a single session by ID
 * Also performs read-time image expiry cleanup.
 */
async function handleGetSession(
  req: NextApiRequest,
  res: NextApiResponse,
  userId: string,
  sessionId: string
) {
  try {
    const session = await CreativeStudioSessionDAO.getByIdAndUserId(sessionId, userId);

    if (!session) {
      return res.status(404).json({
        ok: false,
        error: "Session not found",
      });
    }

    console.log('[DEBUG API] Get session from DB:', {
      sessionId,
      hasAdBuilderData: !!session.adBuilderData,
      adBuilderStep: (session.adBuilderData as any)?.step,
      hasProduct: !!(session.adBuilderData as any)?.product,
      productName: (session.adBuilderData as any)?.product?.product_name,
    });

    // ---- Read-time image expiry cleanup ----
    const messages = session.messages as any[] | undefined;
    let messagesModified = false;

    if (messages && Array.isArray(messages) && messages.length > 0) {
      // Read retention setting (default 7 days)
      let retentionDays = 7;
      try {
        const settingValue = await SettingsDAO.getSetting("image_retention_days");
        if (typeof settingValue === "number") retentionDays = settingValue;
      } catch (e) {
        console.warn("Failed to read image_retention_days setting, using default 7", e);
      }

      const cutoffTimestamp = Date.now() - retentionDays * 86_400_000;
      let savedUrls: Set<string> | null = null; // Lazy-loaded

      for (const msg of messages) {
        if (!msg.imageUrls || !Array.isArray(msg.imageUrls) || msg.imageUrls.length === 0) continue;
        if (msg.timestamp >= cutoffTimestamp) continue;

        // Lazy-load saved URLs on first need
        if (savedUrls === null) {
          try {
            savedUrls = await GeneratedImageDAO.getSavedUrls(userId);
          } catch (e) {
            console.warn("Failed to load saved URLs, skipping expiry for this session", e);
            savedUrls = new Set();
          }
        }

        const keptUrls: string[] = [];
        const keptPaths: string[] = [];
        const storagePaths: string[] = msg.imageStoragePaths || [];
        let removedCount = 0;

        for (let i = 0; i < msg.imageUrls.length; i++) {
          const url = msg.imageUrls[i];
          if (savedUrls.has(url)) {
            // Protected — keep it
            keptUrls.push(url);
            if (storagePaths[i]) keptPaths.push(storagePaths[i]);
          } else {
            // Expired — delete from storage if we have a path
            removedCount++;
            const storagePath = storagePaths[i];
            if (storagePath) {
              try {
                await supabaseAdmin.storage
                  .from("campaign-assets")
                  .remove([storagePath]);
              } catch (e) {
                console.warn(`Failed to delete storage file ${storagePath}:`, e);
              }
            }
          }
        }

        if (removedCount > 0) {
          msg.imageUrls = keptUrls.length > 0 ? keptUrls : undefined;
          msg.imageStoragePaths = keptPaths.length > 0 ? keptPaths : undefined;
          msg.expiredImageCount = (msg.expiredImageCount || 0) + removedCount;
          messagesModified = true;
        }
      }
    }

    // Fire-and-forget: persist cleaned-up messages back to DB
    if (messagesModified) {
      CreativeStudioSessionDAO.updateByIdAndUserId(sessionId, userId, { messages })
        .catch((e: any) => console.warn("Failed to persist expired-image cleanup:", e));
    }

    // Transform response to match frontend types
    const transformedSession = {
      id: session.id,
      userId: session.userId,
      name: session.name,
      sessionType: session.sessionType,
      brandSnapshot: session.brandSnapshot,
      phase: session.phase,
      messages: messages ?? session.messages,
      productData: session.productData,
      posterPrompt: session.posterPrompt,
      config: session.config,
      generatedPosters: session.generatedPosters,
      adBuilderData: session.adBuilderData,
      generatedVideos: session.generatedVideos,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    };

    return res.status(200).json({
      ok: true,
      session: transformedSession,
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
 * PUT /api/creative-studio/sessions?id=xxx
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
    const existingSession = await CreativeStudioSessionDAO.getByIdAndUserId(sessionId, userId);

    if (!existingSession) {
      return res.status(404).json({
        ok: false,
        error: "Session not found",
      });
    }

    // Build update payload
    const payload: any = {};

    // Common fields
    if (name !== undefined) payload.name = name.trim();
    if (brandSnapshot !== undefined) payload.brandSnapshot = brandSnapshot;

    // Poster-specific fields
    if (existingSession.sessionType === "poster") {
      if (phase !== undefined) payload.phase = phase;
      if (messages !== undefined) payload.messages = messages;
      if (productData !== undefined) payload.productData = productData;
      if (posterPrompt !== undefined) payload.posterPrompt = posterPrompt;
      if (config !== undefined) payload.config = config;
      if (generatedPosters !== undefined) payload.generatedPosters = generatedPosters;
    }

    // Video-specific fields
    if (existingSession.sessionType === "video") {
      if (adBuilderData !== undefined) payload.adBuilderData = adBuilderData;
      if (generatedVideos !== undefined) payload.generatedVideos = generatedVideos;
    }

    const updatedSession = await CreativeStudioSessionDAO.updateByIdAndUserId(
      sessionId,
      userId,
      payload
    );

    if (!updatedSession) {
      return res.status(500).json({
        ok: false,
        error: "Failed to update session",
      });
    }

    // Transform response to match frontend types
    const session = {
      id: updatedSession.id,
      userId: updatedSession.userId,
      name: updatedSession.name,
      sessionType: updatedSession.sessionType,
      brandSnapshot: updatedSession.brandSnapshot,
      phase: updatedSession.phase,
      messages: updatedSession.messages,
      productData: updatedSession.productData,
      posterPrompt: updatedSession.posterPrompt,
      config: updatedSession.config,
      generatedPosters: updatedSession.generatedPosters,
      adBuilderData: updatedSession.adBuilderData,
      generatedVideos: updatedSession.generatedVideos,
      createdAt: updatedSession.createdAt,
      updatedAt: updatedSession.updatedAt,
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
 * DELETE /api/creative-studio/sessions?id=xxx
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
    const existingSession = await CreativeStudioSessionDAO.getByIdAndUserId(sessionId, userId);

    if (!existingSession) {
      return res.status(404).json({
        ok: false,
        error: "Session not found",
      });
    }

    const success = await CreativeStudioSessionDAO.deleteByIdAndUserId(sessionId, userId);

    if (!success) {
      return res.status(500).json({
        ok: false,
        error: "Failed to delete session",
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
