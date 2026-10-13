"use client";

import * as React from "react";
import { Loader2, X, Facebook, Instagram, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/app/web/src/components/ui/button";
import { Label } from "@/app/web/src/components/ui/label";
import { Textarea } from "@/app/web/src/components/ui/textarea";
import { Input } from "@/app/web/src/components/ui/input";
import colors from "@/lib/ui/colors";
import { authFetch } from "@/lib/utils";
import { supabase } from "@/auth/supabase/client";
import { toast } from "sonner";
import { buildPublishRequestBody } from "@/lib/social/publishing/social-post-guards";

export type PublishableCreative = {
  id?: string | null;
  mediaUrl: string;
  mediaType: "image" | "video";
  storagePath?: string | null;
  label?: string | null;
  /** Resume an existing social_posts row (draft / failed retry). */
  socialPostId?: string | null;
};

type PlatformId = "facebook" | "instagram";

type Props = {
  open: boolean;
  creative: PublishableCreative | null;
  onClose: () => void;
  onPublished?: () => void;
};

export function PublishComposer({ open, creative, onClose, onPublished }: Props) {
  const [caption, setCaption] = React.useState("");
  const [hashtags, setHashtags] = React.useState("");
  const [platform, setPlatform] = React.useState<PlatformId>("facebook");
  const [fbConnected, setFbConnected] = React.useState(false);
  const [fbCanPublish, setFbCanPublish] = React.useState(false);
  const [fbWarning, setFbWarning] = React.useState<string | null>(null);
  const [fbPageName, setFbPageName] = React.useState<string | null>(null);
  const [igConnected, setIgConnected] = React.useState(false);
  const [igCanPublish, setIgCanPublish] = React.useState(false);
  const [igUsername, setIgUsername] = React.useState<string | null>(null);
  const [igWarning, setIgWarning] = React.useState<string | null>(null);
  const [igReason, setIgReason] = React.useState<string | null>(null);
  const [loadingStatus, setLoadingStatus] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [socialPostId, setSocialPostId] = React.useState<string | null>(null);
  /** Prior ambiguous outcome — block Publish until user acknowledges. */
  const [ambiguousLock, setAmbiguousLock] = React.useState(false);
  const [forceRetryAck, setForceRetryAck] = React.useState(false);
  const [publishedLock, setPublishedLock] = React.useState(false);
  const [status, setStatus] = React.useState<{
    type: "success" | "error" | "info" | null;
    text: string;
  } | null>(null);
  const [connectLoading, setConnectLoading] = React.useState(false);
  const submitGenerationRef = React.useRef(0);

  const refreshStatus = React.useCallback(async () => {
    setLoadingStatus(true);
    try {
      const [fbRes, igRes] = await Promise.all([
        authFetch("/api/social/facebook/status"),
        authFetch("/api/social/instagram/status"),
      ]);
      if (fbRes.ok) {
        const fb = await fbRes.json();
        setFbConnected(Boolean(fb.connected));
        setFbCanPublish(Boolean(fb.connected && fb.canPublish));
        setFbPageName(fb.pageName || null);
        setFbWarning(fb.warning || null);
      } else {
        setFbConnected(false);
        setFbCanPublish(false);
        setFbPageName(null);
        setFbWarning(null);
      }
      if (igRes.ok) {
        const ig = await igRes.json();
        setIgConnected(Boolean(ig.connected));
        setIgCanPublish(Boolean(ig.connected && ig.canPublish));
        setIgUsername(ig.igUsername || null);
        setIgWarning(ig.warning || null);
        setIgReason(ig.reason || null);
      } else {
        setIgConnected(false);
        setIgCanPublish(false);
        setIgUsername(null);
        setIgReason("Could not load Instagram status.");
      }
    } catch {
      setFbConnected(false);
      setIgConnected(false);
      setIgCanPublish(false);
    } finally {
      setLoadingStatus(false);
    }
  }, []);

  React.useEffect(() => {
    if (!open) return;
    setCaption("");
    setHashtags("");
    // Videos/Reels → Instagram; Facebook Page publish is photos-only today
    setPlatform(creative?.mediaType === "video" ? "instagram" : "facebook");
    setSocialPostId(creative?.socialPostId || null);
    setAmbiguousLock(false);
    setForceRetryAck(false);
    setPublishedLock(false);
    setStatus(null);
    submitGenerationRef.current = 0;
    void refreshStatus();
  }, [open, creative?.mediaUrl, creative?.mediaType, creative?.socialPostId, refreshStatus]);

  const selectPlatform = (next: PlatformId) => {
    if (next === platform) return;
    setPlatform(next);
    // New platform → new social_posts row (provider isolation).
    setSocialPostId(null);
    setAmbiguousLock(false);
    setForceRetryAck(false);
    setPublishedLock(false);
    setStatus(null);
  };

  React.useEffect(() => {
    if (!open) return;
    const onMessage = (event: MessageEvent) => {
      const data = event.data;
      if (!data) return;
      if (data.platform === "meta-publish" && data.status === "success") {
        void refreshStatus();
        toast.success(
          data.pageName
            ? `Connected ${data.pageName}`
            : "Facebook Page connected for publishing"
        );
      }
      if (data.platform === "meta-instagram" && data.status === "success") {
        void refreshStatus();
        toast.success(
          data.igUsername
            ? `Connected @${data.igUsername}`
            : "Instagram account connected"
        );
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [open, refreshStatus]);

  const openOAuthPopup = async (
    path: string,
    windowName: string,
    signInMessage: string
  ) => {
    setConnectLoading(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = (data as any)?.session?.access_token;
      if (!token) {
        toast.error(signInMessage);
        return;
      }
      // Preflight Instagram start: surface missing FLB config instead of Meta Invalid Scopes
      if (path.includes("/instagram/oauth/start")) {
        const pre = await fetch(
          `${path}?sb=${encodeURIComponent(token)}`,
          { method: "GET", redirect: "manual" }
        );
        // 302/307 → config present (do not follow here; popup will). 4xx → show message.
        if (pre.status >= 400 && pre.status < 500) {
          const json = await pre.json().catch(() => ({}));
          toast.error(
            json.message ||
              "Instagram Login configuration is missing. Set FACEBOOK_INSTAGRAM_LOGIN_CONFIG_ID."
          );
          return;
        }
      }
      const popup = window.open(
        `${path}?sb=${encodeURIComponent(token)}`,
        windowName,
        "width=720,height=720,menubar=no,toolbar=no"
      );
      if (!popup) toast.error("Popup blocked. Allow popups and try again.");
    } finally {
      setConnectLoading(false);
    }
  };

  const composedCaption = [caption.trim(), hashtags.trim()]
    .filter(Boolean)
    .join("\n\n");

  const fbReady =
    platform === "facebook" &&
    fbCanPublish &&
    creative?.mediaType === "image" &&
    Boolean(creative?.mediaUrl);

  const igReady =
    platform === "instagram" &&
    igCanPublish &&
    Boolean(creative?.mediaUrl) &&
    (creative?.mediaType === "image" || creative?.mediaType === "video");

  const canPublishNow = fbReady || igReady;

  const videoBlockedOnFacebook =
    platform === "facebook" && creative?.mediaType === "video";

  const submit = async (draft: boolean) => {
    if (!creative?.mediaUrl) return;
    // Ignore duplicate clicks / concurrent submits from the same composer.
    if (busy || submitGenerationRef.current > 0) return;
    if (!draft && publishedLock) {
      setStatus({
        type: "error",
        text: "This post was already published from this composer session.",
      });
      return;
    }
    if (!draft && ambiguousLock && !forceRetryAck) {
      setStatus({
        type: "error",
        text:
          "A previous publish attempt had an unclear result. Check the platform for a possible duplicate, then acknowledge Retry anyway.",
      });
      return;
    }

    setStatus(null);

    if (platform === "instagram") {
      if (!igConnected) {
        setStatus({
          type: "error",
          text: "Connect an Instagram professional account before publishing.",
        });
        return;
      }
      if (!igCanPublish) {
        setStatus({
          type: "error",
          text:
            igReason ||
            "Instagram publishing permission is incomplete. Reconnect with instagram_content_publish.",
        });
        return;
      }
    } else {
      if (creative.mediaType === "video") {
        setStatus({
          type: "error",
          text:
            "Facebook Page publishing currently supports photos only. Switch to Instagram for Reels, or use an image creative.",
        });
        return;
      }
      if (!fbConnected) {
        setStatus({
          type: "error",
          text: "Connect a Facebook Page before publishing.",
        });
        return;
      }
    }

    const endpoint =
      platform === "instagram"
        ? "/api/social/instagram/publish"
        : "/api/social/facebook/publish";
    const platformLabel = platform === "instagram" ? "Instagram" : "Facebook Page";

    setBusy(true);
    submitGenerationRef.current += 1;
    try {
      let activePostId = socialPostId;

      // Ensure a durable social_posts row before Graph publish so retries reuse it.
      if (!draft && !activePostId) {
        const draftBody = buildPublishRequestBody({
          platform,
          mediaUrl: creative.mediaUrl,
          mediaType: creative.mediaType,
          caption: composedCaption,
          sourceImageId: creative.id,
          sourceImagePath: creative.storagePath,
          draft: true,
        });
        const draftResp = await authFetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(draftBody),
        });
        const draftJson = await draftResp.json().catch(() => ({}));
        if (!draftResp.ok) {
          throw new Error(draftJson.error || "Could not create publish record");
        }
        activePostId = draftJson.socialPost?.id || null;
        if (activePostId) setSocialPostId(activePostId);
        if (!activePostId) {
          throw new Error("Publish record missing id — aborting to avoid duplicates");
        }
      }

      const body = buildPublishRequestBody({
        platform,
        mediaUrl: creative.mediaUrl,
        mediaType: creative.mediaType,
        caption: composedCaption,
        sourceImageId: creative.id,
        sourceImagePath: creative.storagePath,
        socialPostId: activePostId,
        draft,
        forceRetry: !draft && forceRetryAck,
      });

      const resp = await authFetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await resp.json().catch(() => ({}));

      const returnedId = json.socialPost?.id as string | undefined;
      if (returnedId) setSocialPostId(returnedId);

      if (!resp.ok) {
        if (
          json.code === "already_published" ||
          json.code === "publish_in_progress" ||
          json.code === "ambiguous_prior" ||
          json.ambiguous
        ) {
          if (json.code === "already_published") setPublishedLock(true);
          if (json.ambiguous || json.code === "ambiguous_prior" || json.code === "publish_in_progress") {
            setAmbiguousLock(true);
            setForceRetryAck(false);
          }
          throw new Error(
            json.ambiguous || json.code === "ambiguous_prior" || json.code === "publish_in_progress"
              ? `${json.error || "Publish result unclear"}. Do not retry automatically — check ${platformLabel} for a possible duplicate.`
              : json.error || "Publish blocked"
          );
        }
        if (
          json.code === "media_host_not_configured" ||
          json.code === "media_host_insecure"
        ) {
          throw new Error(
            json.error ||
              "Instagram media hosting is not configured. Set INSTAGRAM_MEDIA_HOST_SUPABASE_URL to a public HTTPS Supabase project (and its service role key) for local development."
          );
        }
        if (json.code === "localhost_or_insecure" || json.code === "mirror_upload_failed") {
          throw new Error(
            json.error ||
              "Could not produce a public HTTPS media URL for Instagram. Check hosted storage configuration."
          );
        }
        throw new Error(json.error || `${platformLabel} publish failed`);
      }

      if (draft) {
        setStatus({ type: "success", text: "Draft saved." });
      } else {
        setPublishedLock(true);
        setAmbiguousLock(false);
        setForceRetryAck(false);
        setStatus({
          type: "success",
          text: json.permalink
            ? `Published to ${platformLabel}. ${json.permalink}`
            : `Published to ${platformLabel}.`,
        });
        onPublished?.();
      }
    } catch (e: any) {
      setStatus({ type: "error", text: e?.message || "Publish failed" });
    } finally {
      submitGenerationRef.current = Math.max(0, submitGenerationRef.current - 1);
      setBusy(false);
    }
  };

  if (!open || !creative) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center p-0 sm:p-6"
      style={{ background: `${colors.background}cc`, backdropFilter: "blur(8px)" }}
      role="dialog"
      aria-modal="true"
      aria-label="Publish to social"
    >
      <div
        className="w-full max-w-3xl max-h-[92vh] overflow-auto rounded-t-2xl sm:rounded-2xl border shadow-2xl"
        style={{
          background: colors.card,
          borderColor: colors.border,
          color: colors.foreground,
        }}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: colors.border }}>
          <div>
            <h2 className="text-lg font-semibold">Publish</h2>
            <p className="text-xs mt-0.5" style={{ color: colors.mutedForeground }}>
              Share this creative to a connected social destination
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/5"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-0 md:gap-0">
          <div className="p-5 border-b md:border-b-0 md:border-r" style={{ borderColor: colors.border }}>
            <div className="rounded-xl overflow-hidden bg-black/40 border" style={{ borderColor: colors.border }}>
              {creative.mediaType === "video" ? (
                <video
                  src={creative.mediaUrl}
                  controls
                  className="w-full max-h-72 object-contain bg-black"
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={creative.mediaUrl}
                  alt={creative.label || "Creative preview"}
                  className="w-full max-h-72 object-contain bg-black/40"
                />
              )}
            </div>
            {creative.label && (
              <p className="mt-3 text-sm" style={{ color: colors.mutedForeground }}>
                {creative.label}
              </p>
            )}
            <div className="mt-4 rounded-lg border p-3 text-sm" style={{ borderColor: colors.border, background: colors.muted }}>
              <p className="text-xs uppercase tracking-wide mb-2" style={{ color: colors.mutedForeground }}>
                Platform preview
              </p>
              <p className="font-medium text-sm mb-1">
                {platform === "facebook"
                  ? "Facebook Page post"
                  : creative.mediaType === "video"
                    ? "Instagram Reel"
                    : "Instagram feed"}
              </p>
              <p className="text-sm whitespace-pre-wrap" style={{ color: colors.mutedForeground }}>
                {composedCaption || "Your caption will appear here…"}
              </p>
            </div>
          </div>

          <div className="p-5 space-y-4">
            <div>
              <Label className="text-sm">Platform</Label>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => selectPlatform("facebook")}
                  className="flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition"
                  style={{
                    borderColor: platform === "facebook" ? colors.primary : colors.border,
                    background: platform === "facebook" ? "rgba(59,130,246,0.12)" : "transparent",
                  }}
                >
                  <Facebook size={16} />
                  Facebook
                  {fbConnected ? (
                    <CheckCircle2 size={14} className="ml-auto text-green-500" />
                  ) : (
                    <span className="ml-auto text-[10px]" style={{ color: colors.mutedForeground }}>
                      {loadingStatus ? "…" : "Connect"}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => selectPlatform("instagram")}
                  className="flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition"
                  style={{
                    borderColor: platform === "instagram" ? colors.primary : colors.border,
                    background: platform === "instagram" ? "rgba(59,130,246,0.12)" : "transparent",
                  }}
                >
                  <Instagram size={16} />
                  Instagram
                  {igConnected ? (
                    <CheckCircle2 size={14} className="ml-auto text-green-500" />
                  ) : (
                    <span className="ml-auto text-[10px]" style={{ color: colors.mutedForeground }}>
                      {loadingStatus ? "…" : "Connect"}
                    </span>
                  )}
                </button>
              </div>
            </div>

            {platform === "facebook" && (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  {fbConnected ? (
                    <span className={fbCanPublish ? "text-green-500" : "text-amber-400"}>
                      Destination: {fbPageName || "Connected Page"}
                      {!fbCanPublish ? " (publishing permission incomplete)" : ""}
                    </span>
                  ) : (
                    <span className="text-amber-400">Facebook Page not connected</span>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={connectLoading}
                    onClick={() =>
                      void openOAuthPopup(
                        "/api/social/facebook/oauth/start",
                        "skalx_facebook_publish",
                        "Sign in to connect Facebook Page publishing"
                      )
                    }
                  >
                    {connectLoading ? "Opening…" : fbConnected ? "Reconnect" : "Connect Page"}
                  </Button>
                </div>
                {fbWarning && (
                  <p className="text-xs text-amber-300">{fbWarning}</p>
                )}
              </div>
            )}

            {platform === "instagram" && (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  {igConnected ? (
                    <span className={igCanPublish ? "text-green-500" : "text-amber-400"}>
                      Destination: @{igUsername || "Instagram"}
                      {!igCanPublish ? " (publish permission incomplete)" : ""}
                    </span>
                  ) : (
                    <span className="text-amber-400">Instagram not connected</span>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={connectLoading}
                    onClick={() =>
                      void openOAuthPopup(
                        "/api/social/instagram/oauth/start",
                        "skalx_instagram_publish",
                        "Sign in to connect Instagram"
                      )
                    }
                  >
                    {connectLoading
                      ? "Opening…"
                      : igConnected
                        ? "Reconnect"
                        : "Connect Instagram"}
                  </Button>
                </div>
                {igWarning && (
                  <p className="text-xs text-amber-300">{igWarning}</p>
                )}
                <p className="text-xs" style={{ color: colors.mutedForeground }}>
                  Instagram needs a Meta-reachable HTTPS media URL. Local creatives are mirrored to hosted
                  Supabase when{" "}
                  <code className="text-[10px]">INSTAGRAM_MEDIA_HOST_SUPABASE_URL</code> is configured
                  (or when primary storage is already public HTTPS).
                </p>
              </div>
            )}

            {videoBlockedOnFacebook && (
              <div
                className="flex gap-2 rounded-lg border px-3 py-2 text-sm text-amber-200"
                style={{ borderColor: "rgba(245,158,11,0.35)", background: "rgba(245,158,11,0.08)" }}
              >
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <span>
                  This creative is a video. Facebook Page publishing supports photos only — use Instagram for Reels.
                </span>
              </div>
            )}

            <div>
              <Label htmlFor="pub-caption" className="text-sm">
                Caption
              </Label>
              <Textarea
                id="pub-caption"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Write your caption…"
                className="mt-2 min-h-[100px]"
              />
            </div>

            <div>
              <Label htmlFor="pub-tags" className="text-sm">
                Hashtags (optional)
              </Label>
              <Input
                id="pub-tags"
                value={hashtags}
                onChange={(e) => setHashtags(e.target.value)}
                placeholder="#brand #launch"
                className="mt-2"
              />
            </div>

            {ambiguousLock && (
              <label className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={forceRetryAck}
                  onChange={(e) => setForceRetryAck(e.target.checked)}
                />
                <span>
                  I checked the platform for a possible duplicate and want to retry this publish
                  deliberately.
                </span>
              </label>
            )}

            <div className="flex flex-col gap-2 pt-2">
              <Button
                disabled={
                  busy ||
                  !canPublishNow ||
                  publishedLock ||
                  (ambiguousLock && !forceRetryAck)
                }
                onClick={() => void submit(false)}
                style={{
                  background: colors.gradientPrimary,
                  color: colors.primaryForeground,
                }}
              >
                {busy ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Publishing…
                  </>
                ) : publishedLock ? (
                  "Already published"
                ) : ambiguousLock && !forceRetryAck ? (
                  "Publish blocked (unclear prior result)"
                ) : (
                  "Publish Now"
                )}
              </Button>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  disabled={
                    busy ||
                    (platform === "facebook" && !fbConnected) ||
                    (platform === "instagram" && !igConnected)
                  }
                  onClick={() => void submit(true)}
                >
                  Save Draft
                </Button>
                <Button
                  variant="outline"
                  disabled
                  title="Scheduling is not implemented yet"
                >
                  Schedule (soon)
                </Button>
              </div>
            </div>

            {status && (
              <p
                className={`text-sm ${
                  status.type === "success"
                    ? "text-green-500"
                    : status.type === "error"
                      ? "text-red-400"
                      : ""
                }`}
              >
                {status.text}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default PublishComposer;
