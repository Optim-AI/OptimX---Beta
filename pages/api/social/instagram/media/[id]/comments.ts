import type { NextApiRequest, NextApiResponse } from "next";
import { getUserIdFromRequest } from "@/auth/request";
import {
  getInstagramComments,
  postInstagramComment,
  replyToInstagramComment,
  setInstagramCommentHidden,
} from "@/integrations/meta/instagram";
import { getMetaInstagramIntegration } from "@/lib/social/instagram/auth";

/**
 * GET  /api/social/instagram/media/[id]/comments?after=&limit=
 * POST /api/social/instagram/media/[id]/comments
 *   body: { message } — top-level comment on media
 *   body: { message, replyToCommentId } — reply to a comment
 *   body: { commentId, hide: boolean } — hide/unhide
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const mediaId = Array.isArray(req.query.id) ? req.query.id[0] : req.query.id;
    if (!mediaId) {
      res.status(400).json({ error: "media id required" });
      return;
    }

    const integration = await getMetaInstagramIntegration(req);

    if (req.method === "GET") {
      const after = Array.isArray(req.query.after)
        ? req.query.after[0]
        : req.query.after;
      const limit = Math.min(Math.max(Number(req.query.limit) || 25, 1), 50);
      const result = await getInstagramComments({
        mediaId,
        accessToken: integration.pageAccessToken,
        after: typeof after === "string" ? after : undefined,
        limit,
      });
      res.status(200).json({
        success: true,
        mediaId,
        comments: (result.data || []).map(sanitizeComment),
        paging: result.paging || null,
      });
      return;
    }

    if (req.method === "POST") {
      const { message, replyToCommentId, commentId, hide } = req.body ?? {};

      if (typeof hide === "boolean" && commentId) {
        const result = await setInstagramCommentHidden({
          commentId: String(commentId),
          hide,
          accessToken: integration.pageAccessToken,
        });
        res.status(200).json({ success: true, result });
        return;
      }

      if (!message || typeof message !== "string" || !message.trim()) {
        res.status(400).json({ error: "message is required" });
        return;
      }

      if (replyToCommentId) {
        const result = await replyToInstagramComment({
          commentId: String(replyToCommentId),
          message: message.trim(),
          accessToken: integration.pageAccessToken,
        });
        res.status(200).json({ success: true, reply: result });
        return;
      }

      const result = await postInstagramComment({
        mediaId,
        message: message.trim(),
        accessToken: integration.pageAccessToken,
      });
      res.status(200).json({ success: true, comment: result });
      return;
    }

    res.setHeader("Allow", "GET, POST");
    res.status(405).json({ error: "Method not allowed" });
  } catch (err: any) {
    const msg = err?.message || "Instagram comments failed";
    const status = /permission|OAuth|not connected|#10|#200/i.test(msg)
      ? 403
      : /Unauthorized|incomplete/i.test(msg)
        ? 401
        : 500;
    res.status(status).json({ error: msg });
  }
}

function sanitizeComment(c: any) {
  return {
    id: c.id,
    text: c.text || null,
    username: c.username || null,
    timestamp: c.timestamp || null,
    hidden: Boolean(c.hidden),
    likeCount: typeof c.like_count === "number" ? c.like_count : null,
    replies: Array.isArray(c.replies?.data)
      ? c.replies.data.map(sanitizeComment)
      : [],
  };
}
