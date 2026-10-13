"use client";

import * as React from "react";
import { Loader2, RefreshCw, MessageCircle, Heart } from "lucide-react";
import { Button } from "@/app/web/src/components/ui/button";
import { Textarea } from "@/app/web/src/components/ui/textarea";
import colors from "@/lib/ui/colors";
import { authFetch } from "@/lib/utils";
import { toast } from "sonner";

type Metric = { available: boolean; value: number | null };

type MediaItem = {
  id: string;
  caption: string | null;
  mediaType: string | null;
  mediaUrl: string | null;
  thumbnailUrl: string | null;
  permalink: string | null;
  timestamp: string | null;
  likeCount: Metric;
  commentsCount: Metric;
};

type CommentItem = {
  id: string;
  text: string | null;
  username: string | null;
  timestamp: string | null;
  hidden: boolean;
  likeCount: number | null;
  replies: CommentItem[];
};

function formatMetric(m?: Metric) {
  if (!m || !m.available) return "—";
  return String(m.value ?? 0);
}

export function InstagramEngagementPanel() {
  const [connected, setConnected] = React.useState(false);
  const [igUsername, setIgUsername] = React.useState<string | null>(null);
  const [canComments, setCanComments] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [items, setItems] = React.useState<MediaItem[]>([]);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [comments, setComments] = React.useState<CommentItem[]>([]);
  const [commentsLoading, setCommentsLoading] = React.useState(false);
  const [replyText, setReplyText] = React.useState("");
  const [replyToId, setReplyToId] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [insights, setInsights] = React.useState<Record<string, Metric> | null>(
    null
  );
  const [error, setError] = React.useState<string | null>(null);

  const loadStatusAndMedia = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const statusRes = await authFetch("/api/social/instagram/status");
      const status = await statusRes.json().catch(() => ({}));
      if (!statusRes.ok || !status.connected) {
        setConnected(false);
        setItems([]);
        setIgUsername(null);
        return;
      }
      setConnected(true);
      setIgUsername(status.igUsername || null);
      setCanComments(Boolean(status.canManageComments));

      const mediaRes = await authFetch("/api/social/instagram/media/list?limit=20");
      const mediaJson = await mediaRes.json().catch(() => ({}));
      if (!mediaRes.ok) {
        throw new Error(mediaJson.error || "Failed to load Instagram media");
      }
      setItems(mediaJson.items || []);
    } catch (e: any) {
      setError(e?.message || "Failed to load Instagram engagement");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadStatusAndMedia();
  }, [loadStatusAndMedia]);

  const selectMedia = async (id: string) => {
    setSelectedId(id);
    setComments([]);
    setInsights(null);
    setReplyToId(null);
    setReplyText("");
    setCommentsLoading(true);
    try {
      const [cRes, iRes] = await Promise.all([
        authFetch(`/api/social/instagram/media/${encodeURIComponent(id)}/comments`),
        authFetch(`/api/social/instagram/media/${encodeURIComponent(id)}/insights`),
      ]);
      const cJson = await cRes.json().catch(() => ({}));
      const iJson = await iRes.json().catch(() => ({}));
      if (cRes.ok) setComments(cJson.comments || []);
      else toast.error(cJson.error || "Could not load comments");
      if (iRes.ok) {
        setInsights(iJson.engagement?.insights || null);
        // Prefer engagement like/comment when present
        setItems((prev) =>
          prev.map((m) =>
            m.id === id && iJson.engagement
              ? {
                  ...m,
                  likeCount: iJson.engagement.likeCount || m.likeCount,
                  commentsCount:
                    iJson.engagement.commentsCount || m.commentsCount,
                }
              : m
          )
        );
      }
    } catch (e: any) {
      toast.error(e?.message || "Failed to load comments");
    } finally {
      setCommentsLoading(false);
    }
  };

  const sendReply = async () => {
    if (!selectedId || !replyText.trim()) return;
    setBusy(true);
    try {
      const body: Record<string, string> = { message: replyText.trim() };
      if (replyToId) body.replyToCommentId = replyToId;
      const resp = await authFetch(
        `/api/social/instagram/media/${encodeURIComponent(selectedId)}/comments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(json.error || "Reply failed");
      toast.success(replyToId ? "Reply posted" : "Comment posted");
      setReplyText("");
      setReplyToId(null);
      await selectMedia(selectedId);
    } catch (e: any) {
      toast.error(e?.message || "Reply failed");
    } finally {
      setBusy(false);
    }
  };

  const toggleHide = async (commentId: string, hide: boolean) => {
    if (!selectedId) return;
    setBusy(true);
    try {
      const resp = await authFetch(
        `/api/social/instagram/media/${encodeURIComponent(selectedId)}/comments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ commentId, hide }),
        }
      );
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(json.error || "Update failed");
      toast.success(hide ? "Comment hidden" : "Comment unhidden");
      await selectMedia(selectedId);
    } catch (e: any) {
      toast.error(e?.message || "Could not update comment");
    } finally {
      setBusy(false);
    }
  };

  if (!connected && !loading) {
    return (
      <div
        className="rounded-xl border p-4 text-sm"
        style={{ borderColor: colors.border, color: colors.mutedForeground }}
      >
        Connect Instagram from the Publish composer to manage comments and view
        likes for your professional account.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Instagram engagement</h2>
          <p className="text-xs mt-0.5" style={{ color: colors.mutedForeground }}>
            {igUsername
              ? `Connected as @${igUsername}`
              : "Connected Instagram professional account"}
            {!canComments
              ? " · Comment management may need instagram_manage_comments"
              : ""}
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          disabled={loading}
          onClick={() => void loadStatusAndMedia()}
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
        </Button>
      </div>

      {error && (
        <p className="text-sm text-red-400">{error}</p>
      )}

      {loading ? (
        <p className="text-sm" style={{ color: colors.mutedForeground }}>
          Loading media…
        </p>
      ) : items.length === 0 ? (
        <p className="text-sm" style={{ color: colors.mutedForeground }}>
          No Instagram media found for this account yet.
        </p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ul className="space-y-2 max-h-[420px] overflow-auto">
            {items.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => void selectMedia(item.id)}
                  className="w-full text-left rounded-lg border px-3 py-2.5 transition"
                  style={{
                    borderColor:
                      selectedId === item.id ? colors.primary : colors.border,
                    background:
                      selectedId === item.id
                        ? "rgba(59,130,246,0.1)"
                        : "transparent",
                  }}
                >
                  <div className="flex gap-3">
                    {(item.thumbnailUrl || item.mediaUrl) && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.thumbnailUrl || item.mediaUrl || ""}
                        alt=""
                        className="w-12 h-12 rounded object-cover bg-black/40"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm truncate">
                        {item.caption || "(no caption)"}
                      </p>
                      <p
                        className="text-xs mt-1 flex gap-3"
                        style={{ color: colors.mutedForeground }}
                      >
                        <span className="inline-flex items-center gap-1">
                          <Heart size={12} /> {formatMetric(item.likeCount)}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <MessageCircle size={12} />{" "}
                          {formatMetric(item.commentsCount)}
                        </span>
                        <span>{item.mediaType || "MEDIA"}</span>
                      </p>
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>

          <div
            className="rounded-xl border p-4 space-y-3 min-h-[280px]"
            style={{ borderColor: colors.border }}
          >
            {!selectedId ? (
              <p className="text-sm" style={{ color: colors.mutedForeground }}>
                Select a post to view comments and insights.
              </p>
            ) : commentsLoading ? (
              <p className="text-sm" style={{ color: colors.mutedForeground }}>
                Loading comments…
              </p>
            ) : (
              <>
                {insights && (
                  <div className="grid grid-cols-3 gap-2 text-xs mb-2">
                    {(["likes", "comments", "reach", "saved", "shares", "views"] as const).map(
                      (key) => (
                        <div
                          key={key}
                          className="rounded border px-2 py-1.5"
                          style={{ borderColor: colors.border }}
                        >
                          <div style={{ color: colors.mutedForeground }}>
                            {key}
                          </div>
                          <div className="font-medium">
                            {formatMetric(insights[key])}
                          </div>
                        </div>
                      )
                    )}
                  </div>
                )}

                <div className="space-y-2 max-h-[220px] overflow-auto">
                  {comments.length === 0 ? (
                    <p
                      className="text-sm"
                      style={{ color: colors.mutedForeground }}
                    >
                      No comments on this post.
                    </p>
                  ) : (
                    comments.map((c) => (
                      <div
                        key={c.id}
                        className="rounded border px-3 py-2 text-sm"
                        style={{ borderColor: colors.border }}
                      >
                        <div className="flex justify-between gap-2">
                          <span className="font-medium">
                            @{c.username || "user"}
                          </span>
                          <span
                            className="text-xs"
                            style={{ color: colors.mutedForeground }}
                          >
                            {c.timestamp
                              ? new Date(c.timestamp).toLocaleString()
                              : ""}
                          </span>
                        </div>
                        <p className="mt-1 whitespace-pre-wrap">
                          {c.text || ""}
                          {c.hidden ? " (hidden)" : ""}
                        </p>
                        <div className="mt-2 flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy || !canComments}
                            onClick={() => {
                              setReplyToId(c.id);
                              setReplyText("");
                            }}
                          >
                            Reply
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy || !canComments}
                            onClick={() => void toggleHide(c.id, !c.hidden)}
                          >
                            {c.hidden ? "Unhide" : "Hide"}
                          </Button>
                        </div>
                        {c.replies?.length > 0 && (
                          <ul className="mt-2 ml-3 space-y-1 border-l pl-3" style={{ borderColor: colors.border }}>
                            {c.replies.map((r) => (
                              <li key={r.id} className="text-xs">
                                <span className="font-medium">
                                  @{r.username || "user"}
                                </span>
                                : {r.text}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))
                  )}
                </div>

                <div className="space-y-2 pt-2 border-t" style={{ borderColor: colors.border }}>
                  {replyToId && (
                    <p className="text-xs" style={{ color: colors.mutedForeground }}>
                      Replying to comment {replyToId.slice(0, 8)}…
                      <button
                        type="button"
                        className="ml-2 underline"
                        onClick={() => setReplyToId(null)}
                      >
                        Cancel
                      </button>
                    </p>
                  )}
                  <Textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder={
                      canComments
                        ? "Write a reply…"
                        : "Comment permission not granted"
                    }
                    disabled={!canComments || busy}
                    className="min-h-[72px]"
                  />
                  <Button
                    size="sm"
                    disabled={!canComments || busy || !replyText.trim()}
                    onClick={() => void sendReply()}
                  >
                    {busy ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : replyToId ? (
                      "Post reply"
                    ) : (
                      "Post comment"
                    )}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default InstagramEngagementPanel;
