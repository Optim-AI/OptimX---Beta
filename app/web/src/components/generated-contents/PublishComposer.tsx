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

export type PublishableCreative = {
  id?: string | null;
  mediaUrl: string;
  mediaType: "image" | "video";
  storagePath?: string | null;
  label?: string | null;
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
  const [igAvailable, setIgAvailable] = React.useState(false);
  const [igReason, setIgReason] = React.useState<string | null>(null);
  const [loadingStatus, setLoadingStatus] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [status, setStatus] = React.useState<{
    type: "success" | "error" | "info" | null;
    text: string;
  } | null>(null);
  const [connectLoading, setConnectLoading] = React.useState(false);

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
        setIgAvailable(Boolean(ig.available && ig.canPublish));
        setIgReason(ig.reason || null);
      } else {
        setIgAvailable(false);
        setIgReason("Instagram publishing is not available yet.");
      }
    } catch {
      setFbConnected(false);
      setIgAvailable(false);
    } finally {
      setLoadingStatus(false);
    }
  }, []);

  React.useEffect(() => {
    if (!open) return;
    setCaption("");
    setHashtags("");
    setPlatform("facebook");
    setStatus(null);
    void refreshStatus();
  }, [open, creative?.mediaUrl, refreshStatus]);

  React.useEffect(() => {
    if (!open) return;
    const onMessage = (event: MessageEvent) => {
      const data = event.data;
      if (!data || data.platform !== "meta-publish") return;
      if (data.status === "success") {
        void refreshStatus();
        toast.success(
          data.pageName
            ? `Connected ${data.pageName}`
            : "Facebook Page connected for publishing"
        );
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [open, refreshStatus]);

  const connectFacebook = async () => {
    setConnectLoading(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = (data as any)?.session?.access_token;
      if (!token) {
        toast.error("Sign in to connect Facebook Page publishing");
        return;
      }
      const popup = window.open(
        `/api/social/facebook/oauth/start?sb=${encodeURIComponent(token)}`,
        "skalx_facebook_publish",
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

  const canPublishNow =
    platform === "facebook" &&
    fbCanPublish &&
    creative?.mediaType === "image" &&
    Boolean(creative?.mediaUrl);

  const videoBlocked =
    platform === "facebook" && creative?.mediaType === "video";
  const igBlocked = platform === "instagram";

  const submit = async (draft: boolean) => {
    if (!creative?.mediaUrl) return;
    setStatus(null);

    if (platform === "instagram") {
      setStatus({
        type: "error",
        text:
          igReason ||
          "Instagram publishing is not available yet. Select Facebook instead.",
      });
      return;
    }

    if (creative.mediaType === "video") {
      setStatus({
        type: "error",
        text:
          "Facebook video publishing is not enabled yet. This endpoint currently supports Page photo posts only.",
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

    setBusy(true);
    try {
      const resp = await authFetch("/api/social/facebook/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageUrl: creative.mediaUrl,
          caption: composedCaption,
          sourceImageId: creative.id || undefined,
          sourceImagePath: creative.storagePath || undefined,
          draft,
        }),
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        if (json.ambiguous) {
          throw new Error(
            `${json.error || "Publish result unclear"}. Do not retry automatically — check your Page for a possible duplicate.`
          );
        }
        throw new Error(json.error || "Publish failed");
      }

      if (draft) {
        setStatus({ type: "success", text: "Draft saved." });
      } else {
        setStatus({
          type: "success",
          text: json.permalink
            ? `Published. ${json.permalink}`
            : "Published to your Facebook Page.",
        });
        onPublished?.();
      }
    } catch (e: any) {
      setStatus({
        type: "error",
        text: e?.message || "Publish failed",
      });
    } finally {
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
                {platform === "facebook" ? "Facebook Page post" : "Instagram feed"}
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
                  onClick={() => setPlatform("facebook")}
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
                  onClick={() => setPlatform("instagram")}
                  className="flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition"
                  style={{
                    borderColor: platform === "instagram" ? colors.primary : colors.border,
                    background: platform === "instagram" ? "rgba(59,130,246,0.12)" : "transparent",
                  }}
                >
                  <Instagram size={16} />
                  Instagram
                  <span className="ml-auto text-[10px]" style={{ color: colors.mutedForeground }}>
                    {igAvailable ? "Ready" : "Soon"}
                  </span>
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
                    onClick={() => void connectFacebook()}
                  >
                    {connectLoading ? "Opening…" : fbConnected ? "Reconnect" : "Connect Page"}
                  </Button>
                </div>
                {fbWarning && (
                  <p className="text-xs text-amber-300">{fbWarning}</p>
                )}
              </div>
            )}

            {igBlocked && (
              <div
                className="flex gap-2 rounded-lg border px-3 py-2 text-sm text-amber-200"
                style={{ borderColor: "rgba(245,158,11,0.35)", background: "rgba(245,158,11,0.08)" }}
              >
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <span>
                  {igReason ||
                    "Instagram is not publish-ready yet. Selecting it will not call Facebook publishing."}
                </span>
              </div>
            )}

            {videoBlocked && (
              <div
                className="flex gap-2 rounded-lg border px-3 py-2 text-sm text-amber-200"
                style={{ borderColor: "rgba(245,158,11,0.35)", background: "rgba(245,158,11,0.08)" }}
              >
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <span>
                  This creative is a video. Facebook Page publishing currently supports photos only.
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

            <div className="flex flex-col gap-2 pt-2">
              <Button
                disabled={busy || !canPublishNow}
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
                ) : (
                  "Publish Now"
                )}
              </Button>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  disabled={busy || !fbConnected || platform !== "facebook"}
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
