// pages/api/creative-studio/sessions/[id].ts
// Handles GET (single session), PUT (update), DELETE

import type { NextApiRequest, NextApiResponse } from "next";
import { getUserIdFromRequest } from "@/auth/request";
import { CreativeStudioSessionDAO } from "@/database/models/CreativeStudioSession.dao";

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

    // Transform response to match frontend types
    const transformedSession = {
      id: session.id,
      userId: session.userId,
      name: session.name,
      sessionType: session.sessionType,
      brandSnapshot: session.brandSnapshot,
      phase: session.phase,
      messages: session.messages,
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
