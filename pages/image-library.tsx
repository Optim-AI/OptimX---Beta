"use client";

import * as React from "react";
import type { JSX } from "react";
import Sidebar from "../app/web/src/components/Sidebar";
import { Card } from "../app/web/src/components/ui/card";
import { Button } from "../app/web/src/components/ui/button";
import { Input } from "../app/web/src/components/ui/input";
import { Label } from "../app/web/src/components/ui/label";
import { Textarea } from "../app/web/src/components/ui/textarea";
import { Separator } from "../app/web/src/components/ui/separator";
import colors from '@/lib/ui/colors';
import { supabase } from '@/auth/supabase/client';
import { profileClient, imagesClient } from '@/database/client-helpers';
import { storageClient } from '@/lib/storage/client';
import { toast } from "sonner";
import { Sparkles, Image as ImageIcon, Video } from "lucide-react";
import { authFetch } from "@/lib/utils";
import { SkeletonImageGrid, SkeletonVideoGrid } from "@/app/web/src/components/ui/skeletons";

type UserImage = {
  id: string;
  imageUrl: string;
  createdAt: string;
};

type GeneratedVideo = {
  id: string;
  url: string;
  prompt?: string;
  timestamp: number;
};

export default function ImageLibraryPage(): JSX.Element {
  const [contentType, setContentType] = React.useState<"poster" | "video">("poster");
  const [images, setImages] = React.useState<UserImage[]>([]);
  const [videos, setVideos] = React.useState<Array<{ sessionId: string; sessionName: string; video: GeneratedVideo }>>([]);
  const [loading, setLoading] = React.useState(true);
  const [videosLoading, setVideosLoading] = React.useState(false);
  const [firstName, setFirstName] = React.useState<string | null>(null);
  const [selectedImage, setSelectedImage] = React.useState<UserImage | null>(
    null
  );

  // publish panel state (copied/adapted from create-campaign)
  const [showPublishPanel, setShowPublishPanel] = React.useState(false);
  const [publishMode, setPublishMode] = React.useState<"post" | "ad">("post");

  const [postFormData, setPostFormData] = React.useState<any>({
    postName: "",
    platforms: [],
    postType: "image",
    goal: "",
    brandName: "",
    tone: "",
    primaryCTA: "",
    hashtags: "",
    prompt: "",
    generatedCaption: "",
    multipleVersions: false,
    logoPublicUrl: null,
    logoDataUrl: null,
  });

  const [adFormData, setAdFormData] = React.useState<any>({
    campaignName: "",
    objective: "LINK_CLICKS",
    platforms: [],
    campaignType: "",
    brandName: "",
    tagline: "",
    tone: "",
    primaryCTA: "LEARN_MORE",
    location: "",
    ageRange: [18, 65],
    gender: "all",
    interests: "",
    autoTarget: true,
    budgetType: "daily",
    budget: 5000,
    startDate: "",
    endDate: "",
    autoOptimise: true,
    description: "",
    emotion: "",
    offerInfo: "",
    multipleVariations: false,
    logoPublicUrl: null,
    logoDataUrl: null,
    adSetName: "",
    destinationLink: "",
    delivery: "",
    duration: 7,
  });

  const [publishLoading, setPublishLoading] = React.useState(false);
  const [publishStatus, setPublishStatus] = React.useState<{
    text: string;
    type: "success" | "error" | null;
  } | null>(null);

  const [adLoading, setAdLoading] = React.useState(false);
  const [adStatus, setAdStatus] = React.useState<{
    text: string;
    type: "success" | "error" | null;
  } | null>(null);

  const [platformError, setPlatformError] = React.useState<string | null>(
    null
  );

  // delete confirmation modal
  const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  // selected video for detail view
  const [selectedVideo, setSelectedVideo] = React.useState<{
    sessionId: string;
    sessionName: string;
    video: GeneratedVideo;
  } | null>(null);

  React.useEffect(() => {
    let mounted = true;

    const getCurrentUser = async () => {
      try {
        const { data, error } = await supabase.auth.getUser();
        if (error) return null;
        return data.user ?? null;
      } catch {
        return null;
      }
    };

    const fetchImages = async () => {
      if (!mounted) return;
      setLoading(true);

      try {
        const user = await getCurrentUser();
        if (!user) {
          if (mounted) {
            setImages([]);
            setFirstName(null);
            setLoading(false);
          }
          return;
        }

        // fetch user profile for greeting
        try {
          const result = await profileClient.get();
          const profile = result.success ? result.data : null;
          const name =
            (profile as any)?.full_name ||
            (user.email ? user.email.split("@")[0] : null);
          if (mounted) setFirstName(name);
        } catch {
          if (mounted)
            setFirstName(user.email ? user.email.split("@")[0] : "There");
        }

        // fetch user images
        const result = await imagesClient.list(500);

        if (!result.success) {
          toast.error("Failed to fetch images");
          if (mounted) setImages([]);
        } else {
          const parsed: UserImage[] =
            (result.data || [])
              .map((r: any) =>
                r && r.imageUrl
                  ? {
                      id: String(r.id),
                      imageUrl: String(r.imageUrl),
                      createdAt: String(r.createdAt),
                    }
                  : null
              )
              .filter((u): u is UserImage => Boolean(u)) ?? [];
          if (mounted) setImages(parsed);
        }
      } catch {
        toast.error("Failed to load images");
        if (mounted) setImages([]);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchImages();
    return () => {
      mounted = false;
    };
  }, []);

  React.useEffect(() => {
    if (contentType !== "video") return;

    let mounted = true;
    setVideosLoading(true);

    authFetch("/api/creative-studio/sessions?type=video&limit=100&includeMedia=1")
      .then((res) => res.json())
      .then((data) => {
        if (!mounted || !data.ok) {
          if (mounted) setVideos([]);
          return;
        }
        const aggregated: Array<{ sessionId: string; sessionName: string; video: GeneratedVideo }> = [];
        for (const s of data.sessions || []) {
          const list = (s.generatedVideos || []) as GeneratedVideo[];
          for (const v of list) {
            aggregated.push({
              sessionId: s.id,
              sessionName: s.name,
              video: v,
            });
          }
        }
        if (mounted) setVideos(aggregated);
      })
      .catch(() => {
        if (mounted) {
          setVideos([]);
          toast.error("Failed to load videos");
        }
      })
      .finally(() => {
        if (mounted) setVideosLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [contentType]);

  const greet = React.useMemo(() => {
    const n = firstName?.trim();
    if (!n) return "There";
    const f = n.split(" ")[0];
    return f.charAt(0).toUpperCase() + f.slice(1).toLowerCase();
  }, [firstName]);

  // DELETE flow with confirmation
  const handleDelete = () => {
    if (!selectedImage) return;
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirmed = async () => {
    if (!selectedImage) return;
    setDeleting(true);
    try {
      const { error } = await supabase
        .from("user_generated_image")
        .delete()
        .eq("id", selectedImage.id);

      if (error) {
        toast.error("Failed to delete image");
        setDeleting(false);
        setShowDeleteConfirm(false);
        return;
      }

      setImages((prev) => prev.filter((img) => img.id !== selectedImage.id));
      setSelectedImage(null);
      setShowDeleteConfirm(false);
      toast.success("Image deleted");
    } catch (e) {
      console.error("delete error", e);
      toast.error("Failed to delete image");
      setShowDeleteConfirm(false);
    } finally {
      setDeleting(false);
    }
  };

  // DOWNLOAD
  const handleDownload = () => {
    if (!selectedImage) return;
    const link = document.createElement("a");
    link.href = selectedImage.imageUrl;
    link.download = "poster.png";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // POST — open publish panel (pre-fill some fields)
  const handlePost = async () => {
    if (!selectedImage) return;
    // prefill minimal fields using image metadata
    setPostFormData((p: any) => ({
      ...p,
      postName: p.postName || `Post_${Date.now()}`,
      generatedCaption: p.generatedCaption || "",
      prompt: p.prompt || "",
    }));
    setAdFormData((a: any) => ({ ...a, campaignName: a.campaignName || "" }));
    setPublishMode("post");
    setShowPublishPanel(true);
  };

  // AI caption generator (same as create-campaign)
  const generateCaption = async (
    promptText: string,
    setResult: (text: string) => void
  ) => {
    try {
      if (!promptText || !promptText.trim()) {
        toast.error("Please provide some text for AI to work with.");
        return;
      }
      const token =
        (await supabase.auth.getSession()).data?.session?.access_token ?? null;
      if (!token) {
        toast.error("Not signed in. Please sign in to use AI features.");
        return;
      }

      const resp = await fetch("/api/generateCaption", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ prompt: promptText }),
      });
      const json = await resp.json();
      if (!resp.ok || !json)
        throw new Error((json && json.error) || "AI generation failed");
      if (json.caption) {
        setResult(json.caption);
        toast.success("AI generated text");
      } else {
        toast.error("AI returned no caption");
      }
    } catch (err: any) {
      console.error("generateCaption error", err);
      toast.error("AI generation failed: " + (err.message || String(err)));
    }
  };

  // Publish post (adapted from create-campaign)
  const handlePublishPost = async () => {
    try {
      setPublishStatus(null);
      if (!selectedImage) {
        setPublishStatus({
          text: "No selected image to publish.",
          type: "error",
        });
        return;
      }

      if (!postFormData.platforms || postFormData.platforms.length === 0) {
        setPlatformError(
          "Please choose at least one platform (Instagram / Facebook)."
        );
        setPublishStatus({ text: "Select at least one platform.", type: "error" });
        return;
      }

      setPlatformError(null);

      const user = await (async () => {
        try {
          const u = await supabase.auth.getUser();
          return u?.data?.user ?? null;
        } catch {
          return null;
        }
      })();
      if (!user) {
        setPublishStatus({ text: "Sign in to publish posts.", type: "error" });
        return;
      }

      setPublishLoading(true);

      let finalName = (postFormData.postName || "").trim();
      if (!finalName) {
        finalName = `Post_${Date.now()}`;
        setPostFormData((p: any) => ({ ...p, postName: finalName }));
      }

      const imageToPublish = selectedImage.imageUrl;
      let image_url = imageToPublish;
      let image_path = "";

      try {
        // if it's a data url, upload to campaign-assets (unlikely here)
        if (imageToPublish.startsWith("data:")) {
          const blob = (await fetch(imageToPublish).then((r) => r.blob())) as Blob;
          const safeName = (finalName || "post")
            .replace(/[^a-z0-9_\-]/gi, "_")
            .toLowerCase();
          const filename = `${user.id}_${Date.now()}_${safeName}.png`;
          const path = `campaigns/${user.id}/${filename}`;
          const { error: uploadError } = await storageClient.upload("campaign-assets", path, blob, {
            cacheControl: "3600",
            upsert: false,
          });
          if (uploadError) throw uploadError;
          image_url = storageClient.getPublicUrl("campaign-assets", path);
          image_path = path;
          try {
            await supabase.from("user_generated_image").insert([
              {
                user_id: user.id,
                image_url: image_url,
                image_path: image_path,
                source: "generated",
              },
            ]);
          } catch (e) {
            console.warn("failed to insert generated image record", e);
          }
        } else if (imageToPublish.startsWith("http")) {
          image_url = imageToPublish;
          image_path = "";
        }

        const payload = {
          user_id: user.id,
          name: finalName,
          audience: null,
          campaign_type: "post",
          brand_voice: postFormData.tone || null,
          content_types: [postFormData.postType || "image"],
          vision: postFormData.prompt || null,
          output: {
            caption: postFormData.generatedCaption || null,
          },
          image_url: [image_url],
          image_path: [image_path],
          is_published: true,
        };

        const { data: inserted, error: insertError } = await supabase
          .from("campaigns")
          .insert([payload])
          .select();
        if (insertError) throw insertError;

        // Try to post to Instagram (if selected)
        if (postFormData.platforms.includes("Instagram")) {
          try {
            const resp = await fetch("/api/auth/instagram/post", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                image_url,
                caption: postFormData.generatedCaption || postFormData.postName || "",
                alsoPostToFacebook: postFormData.platforms.includes("Facebook"),
              }),
            });
            if (!resp.ok) {
              const j = await resp.json().catch(() => null);
              throw new Error((j && j.error) || `Instagram post failed`);
            }
          } catch (e: any) {
            console.error("Instagram post failed", e);
            // show simplified error below button
            setPublishStatus({
              text:
                (e && (e.message || String(e))) ||
                "Instagram post failed. Try again.",
              type: "error",
            });
            setPublishLoading(false);
            return;
          }
        }

        // If user opted only Facebook (and not Instagram) or also requested FB separately, call FB endpoint
        if (
          postFormData.platforms.includes("Facebook") &&
          !postFormData.platforms.includes("Instagram")
        ) {
          try {
            const resp = await fetch("/api/auth/facebook/post", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                image_url,
                caption: postFormData.generatedCaption || postFormData.postName || "",
              }),
            });
            if (!resp.ok) {
              const j = await resp.json().catch(() => null);
              throw new Error((j && j.error) || `Facebook post failed`);
            }
          } catch (e: any) {
            console.error("Facebook post failed", e);
            setPublishStatus({
              text:
                (e && (e.message || String(e))) ||
                "Facebook post failed. Try again.",
              type: "error",
            });
            setPublishLoading(false);
            return;
          }
        }

        // Do not insert chat messages etc here — this page only needs the publish result state
        setPublishStatus({ text: "Post posted successfully.", type: "success" });
      } catch (e: any) {
        console.error("handlePublishPost inner error", e);
        setPublishStatus({
          text: (e && (e.message || String(e))) || "Publish failed.",
          type: "error",
        });
      } finally {
        setPublishLoading(false);
      }
    } catch (e: any) {
      console.error("handlePublishPost error", e);
      setPublishLoading(false);
      setPublishStatus({
        text: (e && (e.message || String(e))) || "Publish failed.",
        type: "error",
      });
    }
  };

  /* -------------------- Launch Ad (same logic as create-campaign) -------------------- */

  const handleLaunchAd = async () => {
    try {
      setAdStatus(null);

      if (!adFormData.campaignName || !adFormData.campaignName.trim()) {
        setAdStatus({ text: "Campaign name required", type: "error" });
        return;
      }
      if (!selectedImage) {
        setAdStatus({ text: "No creative available — select an image first", type: "error" });
        return;
      }

      const user = await (async () => {
        try {
          const u = await supabase.auth.getUser();
          return u?.data?.user ?? null;
        } catch {
          return null;
        }
      })();
      if (!user) {
        setAdStatus({ text: "You must be signed in to run ads.", type: "error" });
        return;
      }

      setAdLoading(true);

      const mapObjectiveToMeta = (obj: string | undefined | null) => {
        const o = (obj || "").toString().trim().toUpperCase();
        switch (o) {
          case "LINK_CLICKS":
          case "TRAFFIC":
            return "OUTCOME_TRAFFIC";
          case "CONVERSIONS":
          case "SALES":
            return "OUTCOME_SALES";
          case "BRAND_AWARENESS":
            return "OUTCOME_AWARENESS";
          case "REACH":
            return "OUTCOME_AWARENESS";
          case "ENGAGEMENT":
            return "OUTCOME_ENGAGEMENT";
          case "APP_PROMOTION":
          case "APP_INSTALLS":
            return "OUTCOME_APP_PROMOTION";
          case "LEADS":
          case "OUTCOME_LEADS":
            return "OUTCOME_LEADS";
          default:
            return "OUTCOME_TRAFFIC";
        }
      };

      const imageToUse = selectedImage.imageUrl;
      let creativeImageUrl = "";
      let creativeImageDataUrl: string | undefined = undefined;

      try {
        if (imageToUse.startsWith("data:")) {
          const blob = (await fetch(imageToUse).then((r) => r.blob())) as Blob;
          const safeName = (adFormData.campaignName || "ad")
            .replace(/[^a-z0-9_\-]/gi, "_")
            .toLowerCase();
          const filename = `${user.id}_${Date.now()}_${safeName}.png`;
          const path = `campaigns/${user.id}/${filename}`;
          const { error: uploadError } = await storageClient.upload("campaign-assets", path, blob, {
            cacheControl: "3600",
            upsert: true,
          });
          if (uploadError) throw uploadError;
          creativeImageUrl = storageClient.getPublicUrl("campaign-assets", path);
          if (!creativeImageUrl) creativeImageDataUrl = imageToUse;
        } else if (imageToUse.startsWith("http")) {
          creativeImageUrl = imageToUse;
        }
      } catch (e) {
        console.error("upload creative to storage failed", e);
        creativeImageDataUrl = imageToUse;
      }

      const payloadDb = {
        user_id: user.id,
        name: adFormData.campaignName,
        campaign_type: "ad",
        brand_voice: adFormData.tone || null,
        content_types: ["image"],
        vision: adFormData.description || null,
        output: { images: [selectedImage.imageUrl] },
        image_url: [selectedImage.imageUrl],
        image_path: [""],
        is_published: true,
      };

      try {
        const { data: inserted, error } = await supabase
          .from("campaigns")
          .insert([payloadDb])
          .select();
        if (error) throw error;
      } catch (e) {
        console.error("save campaign record failed", e);
        setAdStatus({ text: "Saving campaign failed. Try again.", type: "error" });
        setAdLoading(false);
        return;
      }

      const mappedObjective = mapObjectiveToMeta(adFormData.objective);

      const adPayload: any = {
        campaignName: adFormData.campaignName,
        objective: mappedObjective,
        platforms: adFormData.platforms,
        adSetName:
          adFormData.adSetName ||
          `${adFormData.campaignName || "Campaign"} AdSet ${Date.now()}`,
        targeting: undefined,
        creativeCaption: adFormData.tagline || adFormData.description || "",
        creativeImageUrl: creativeImageUrl || undefined,
        creativeImageDataUrl: creativeImageDataUrl || undefined,
        destinationLink: adFormData.destinationLink || "",
        budget: adFormData.budget,
        budgetType: adFormData.budgetType || "daily",
        startDate: adFormData.startDate || null,
        endDate: adFormData.endDate || null,
        delivery: adFormData.delivery || undefined,
        campaignType: adFormData.campaignType || "ad",
        brandName: adFormData.brandName || undefined,
        tagline: adFormData.tagline || undefined,
        tone: adFormData.tone || undefined,
        primaryCTA: adFormData.primaryCTA || undefined,
        location: adFormData.location || undefined,
        ageRange: adFormData.ageRange || undefined,
        gender: adFormData.gender || undefined,
        interests: adFormData.interests || undefined,
        autoTarget: !!adFormData.autoTarget,
        autoOptimise: !!adFormData.autoOptimise,
      };

      try {
        const token =
          (await supabase.auth.getSession()).data?.session?.access_token ?? null;
        if (!token) {
          setAdStatus({ text: "Sign in to run ads.", type: "error" });
          setAdLoading(false);
          return;
        }

        const resp = await fetch("/api/auth/facebook/ads", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(adPayload),
        });

        const json = await resp.json().catch(() => null);
        if (!resp.ok) {
          console.error("facebook/ads returned error:", json);
          setAdStatus({ text: (json && (json.error || json.message)) || "Facebook Ads creation failed.", type: "error" });
          setAdLoading(false);
          return;
        } else {
          setAdStatus({ text: "Ad campaign posted successfully.", type: "success" });
          setAdLoading(false);
          return;
        }
      } catch (e: any) {
        console.error("facebook/ads call failed", e);
        setAdStatus({ text: (e && (e.message || String(e))) || "Facebook Ads creation failed.", type: "error" });
        setAdLoading(false);
        return;
      }
    } catch (e: any) {
      console.error("handleLaunchAd error", e);
      setAdStatus({ text: (e && (e.message || String(e))) || "Launch failed.", type: "error" });
      setAdLoading(false);
    }
  };

  /* -------------------- UI rendering -------------------- */

  return (
    <div className="min-h-screen flex app-page">
      <Sidebar logoUrl="/brand/logo.png" onLogoClick={() => {}} />

      <div className="flex-1" style={{ marginLeft: 0 }}>
        <main className="max-w-6xl mx-auto p-6 pb-56">
          <div className="mb-6">
            <h2 className="text-2xl font-semibold">Generated contents</h2>
            <p
              className="text-sm mt-1"
              style={{ color: colors.mutedForeground }}
            >
              {contentType === "poster"
                ? (loading ? "Loading your images…" : `All images generated by ${greet}.`)
                : (videosLoading ? "Loading your videos…" : `All videos generated by ${greet}.`)}
            </p>
            {/* Toggle: Poster generation | Video generation */}
            <div
              className="inline-flex rounded-lg p-1 mt-4 gap-0"
              style={{ background: colors.muted, border: `1px solid ${colors.border}` }}
            >
              <button
                type="button"
                onClick={() => setContentType("poster")}
                className="flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition-colors"
                style={{
                  background: contentType === "poster" ? colors.primary : "transparent",
                  color: contentType === "poster" ? colors.primaryForeground : colors.mutedForeground,
                }}
              >
                <ImageIcon size={18} />
                Poster generation
              </button>
              <button
                type="button"
                onClick={() => setContentType("video")}
                className="flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition-colors"
                style={{
                  background: contentType === "video" ? "hsl(270 80% 55%)" : "transparent",
                  color: contentType === "video" ? "white" : colors.mutedForeground,
                }}
              >
                <Video size={18} />
                Video generation
              </button>
            </div>
          </div>

          {contentType === "poster" && (
          <Card
            className="p-4 optim-deep-shadow"
            style={{
              background: colors.card,
              border: `1px solid ${colors.border}`,
            }}
          >
            {loading ? (
              <SkeletonImageGrid count={12} />
            ) : images.length === 0 ? (
              <div style={{ color: colors.mutedForeground }}>
                No generated images found. Create a campaign to generate images
                and they'll appear here.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {images.map((img) => (
                  <button
                    key={img.id}
                    onClick={() => setSelectedImage(img)}
                    className="rounded overflow-hidden border focus:ring-2 focus:ring-sky-500"
                    style={{ borderColor: colors.border }}
                  >
                    <img
                      src={img.imageUrl}
                      alt="generated"
                      className="w-full h-40 object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </Card>
          )}

          {contentType === "video" && (
          <Card
            className="p-4 optim-deep-shadow"
            style={{
              background: colors.card,
              border: `1px solid ${colors.border}`,
            }}
          >
            {videosLoading ? (
              <SkeletonVideoGrid count={8} />
            ) : videos.length === 0 ? (
              <div style={{ color: colors.mutedForeground }}>
                No generated videos found. Create a video in Creative Studio and they&apos;ll appear here.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {videos.map(({ sessionId, sessionName, video }) => (
                  <button
                    key={video.id}
                    onClick={() => setSelectedVideo({ sessionId, sessionName, video })}
                    className="rounded overflow-hidden border focus:ring-2 focus:ring-sky-500 text-left"
                    style={{ borderColor: colors.border }}
                  >
                    <div className="aspect-video w-full bg-black/80 relative">
                      <video
                        src={video.url}
                        className="w-full h-full object-cover"
                        muted
                        preload="metadata"
                        playsInline
                      />
                    </div>
                    <div className="p-2">
                      <p className="text-xs truncate" style={{ color: colors.mutedForeground }}>{sessionName}</p>
                      <p className="text-xs" style={{ color: colors.foreground }}>
                        {new Date(video.timestamp).toLocaleDateString()}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </Card>
          )}
        </main>
      </div>

      {/* VIDEO FULL SCREEN VIEWER */}
      {selectedVideo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="rounded-xl max-w-4xl w-full mx-4 p-4 md:p-6 shadow-xl relative" style={{ backgroundColor: colors.card, border: `1px solid ${colors.border}` }}>
            <button
              type="button"
              onClick={() => setSelectedVideo(null)}
              className="absolute left-4 top-4 px-3 py-1 rounded-full border z-10"
              style={{ borderColor: colors.border, color: colors.foreground, backgroundColor: colors.muted }}
            >
              ← Back
            </button>

            <div className="mt-8 grid gap-4 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] items-start">
              <div className="w-full">
                <div className="overflow-hidden rounded-lg border" style={{ borderColor: colors.border }}>
                  <video
                    src={selectedVideo.video.url}
                    controls
                    className="w-full max-h-[70vh] object-contain"
                    style={{ backgroundColor: "#000" }}
                  />
                </div>
                <p className="text-xs mt-2" style={{ color: colors.mutedForeground }}>
                  {selectedVideo.sessionName} • Created at: {new Date(selectedVideo.video.timestamp).toLocaleString()}
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <h3 className="text-base font-semibold mb-1" style={{ color: colors.foreground }}>Actions</h3>

                <a
                  href={selectedVideo.video.url}
                  download={`video-${selectedVideo.video.id}.mp4`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full px-4 py-2 rounded-md border text-center"
                  style={{ borderColor: colors.border, color: colors.foreground }}
                >
                  Download
                </a>

                <a
                  href={`/creative-studio/video?id=${selectedVideo.sessionId}`}
                  className="w-full px-4 py-2 rounded-md border text-center text-sm"
                  style={{ borderColor: colors.border, color: colors.foreground }}
                >
                  Open in Creative Studio
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FULL SCREEN VIEWER */}
      {selectedImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-white rounded-xl max-w-4xl w-full mx-4 p-4 md:p-6 shadow-xl relative">
            <button
              type="button"
              onClick={() => setSelectedImage(null)}
              className="absolute left-4 top-4 px-3 py-1 rounded-full border hover:bg-slate-100"
            >
              ← Back
            </button>

            <div className="mt-8 grid gap-4 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] items-start">
              <div className="w-full">
                <div className="overflow-hidden rounded-lg border">
                  <img
                    src={selectedImage.imageUrl}
                    alt="selected"
                    className="w-full max-h-[70vh] object-contain bg-slate-100"
                  />
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  Created at: {new Date(selectedImage.createdAt).toLocaleString()}
                </p>
              </div>

              <div className="flex flex-col gap-2">
                <h3 className="text-base font-semibold mb-1">Actions</h3>

                <button
                  onClick={handleDownload}
                  className="w-full px-4 py-2 rounded-md border hover:bg-slate-50"
                >
                  Download
                </button>

                <button
                  onClick={handlePost}
                  className="w-full px-4 py-2 rounded-md border hover:bg-slate-50"
                >
                  Post
                </button>

                <button
                  onClick={handleDelete}
                  className="w-full px-4 py-2 rounded-md border border-red-500 text-red-600 hover:bg-red-50"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {showDeleteConfirm && selectedImage && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-lg">
            <h3 className="text-lg font-semibold mb-2">Delete image?</h3>
            <p className="text-sm text-slate-600 mb-4">
              Are you sure you want to permanently delete this image? This
              cannot be undone.
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleDeleteConfirmed}
                disabled={deleting}
                style={{ background: colors.destructive, color: "#fff" }}
              >
                {deleting ? "Deleting…" : "Delete"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* PUBLISH PANEL (copied/simplified from create-campaign) */}
      {showPublishPanel && selectedImage && (
        <div
          className="fixed inset-0"
          style={{
            background: `${colors.background}cc`,
            backdropFilter: "blur(6px)",
            zIndex: 70,
          }}
        >
          <div
            className="max-w-3xl mx-auto p-6"
            style={{
              marginTop: "auto",
              marginBottom: 120,
              maxHeight: "calc(100vh - 120px)",
              overflow: "auto",
            }}
          >
            <Card className="p-6 optim-deep-shadow">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Publish Your Campaign</h3>
                <Button size="sm" variant="ghost" onClick={() => setShowPublishPanel(false)}>
                  ×
                </Button>
              </div>
              <Separator className="my-3" />
              <div className="flex gap-2 mb-3">
                <Button variant={publishMode === "post" ? "default" : "outline"} onClick={() => setPublishMode("post")} className="flex-1">
                  <Sparkles className="w-4 h-4 mr-2" /> Post Publishing
                </Button>
                <Button variant={publishMode === "ad" ? "default" : "outline"} onClick={() => setPublishMode("ad")} className="flex-1">
                  <ImageIcon className="w-4 h-4 mr-2" /> Ad Publishing
                </Button>
              </div>

              {publishMode === "post" ? (
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="postName" className="text-sm">
                      Post Name
                    </Label>
                    <Input
                      id="postName"
                      value={postFormData.postName}
                      onChange={(e) =>
                        setPostFormData((p: any) => ({ ...p, postName: e.target.value }))
                      }
                      placeholder="Post title (optional)"
                      className="mt-2"
                    />
                  </div>

                  <div>
                    <Label htmlFor="caption" className="text-sm">
                      Caption
                    </Label>
                    {platformError && <div className="text-sm text-red-600 mb-2">{platformError}</div>}
                    <Textarea
                      id="caption"
                      value={postFormData.generatedCaption}
                      onChange={(e) =>
                        setPostFormData((p: any) => ({ ...p, generatedCaption: e.target.value }))
                      }
                      placeholder="Add your post caption..."
                      className="mt-2 min-h-[80px]"
                    />
                    <div className="mt-2 flex gap-2">
                      <Button
                        onClick={() => {
                          const seed =
                            (postFormData.generatedCaption && String(postFormData.generatedCaption).trim()) ||
                            (postFormData.prompt && String(postFormData.prompt).trim()) ||
                            (postFormData.postName && String(postFormData.postName).trim()) ||
                            "Write a caption";
                          generateCaption(seed, (text) =>
                            setPostFormData((p: any) => ({ ...p, generatedCaption: text }))
                          );
                        }}
                        variant="outline"
                      >
                        AI Caption
                      </Button>

                      <Button
                        onClick={() => {
                          const seed =
                            (postFormData.generatedCaption && String(postFormData.generatedCaption).trim()) ||
                            (postFormData.hashtags && String(postFormData.hashtags).trim()) ||
                            (postFormData.prompt && String(postFormData.prompt).trim()) ||
                            (postFormData.postName && String(postFormData.postName).trim()) ||
                            "Generate hashtags";
                          generateCaption(`Generate hashtags for: ${seed}`, (text) => {
                            const matches = (text || "").match(/#[\w-]+/g);
                            if (matches && matches.length)
                              setPostFormData((p: any) => ({ ...p, hashtags: matches.join(" ") }));
                            else setPostFormData((p: any) => ({ ...p, hashtags: text }));
                          });
                        }}
                        variant="outline"
                      >
                        AI Hashtags
                      </Button>

                      <div className="ml-auto flex items-center gap-2">
                        <label className="inline-flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={postFormData.platforms.includes("Instagram")}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setPostFormData((p: any) => ({
                                ...p,
                                platforms: checked
                                  ? Array.from(new Set([...(p.platforms || []), "Instagram"]))
                                  : (p.platforms || []).filter((x: any) => x !== "Instagram"),
                              }));
                              if (checked) setPlatformError(null);
                            }}
                          />
                          Instagram
                        </label>
                        <label className="inline-flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={postFormData.platforms.includes("Facebook")}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setPostFormData((p: any) => ({
                                ...p,
                                platforms: checked
                                  ? Array.from(new Set([...(p.platforms || []), "Facebook"]))
                                  : (p.platforms || []).filter((x: any) => x !== "Facebook"),
                              }));
                              if (checked) setPlatformError(null);
                            }}
                          />
                          Facebook
                        </label>
                      </div>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="hashtags" className="text-sm">
                      Hashtags
                    </Label>
                    <Input
                      id="hashtags"
                      value={postFormData.hashtags}
                      onChange={(e) => setPostFormData((p: any) => ({ ...p, hashtags: e.target.value }))}
                      placeholder="#marketing #socialmedia"
                      className="mt-2"
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button
                      className="flex-1 hover:scale-105 transition-transform flex items-center justify-center gap-2"
                      style={{
                        background: colors.gradientPrimary,
                        color: colors.primaryForeground,
                      }}
                      onClick={() => handlePublishPost()}
                      disabled={publishLoading}
                    >
                      {publishLoading ? <span>Publishing…</span> : <span>Publish Now</span>}
                    </Button>
                    <Button variant="outline" className="flex-1" onClick={() => toast("Schedule feature not implemented in this sample")}>
                      Schedule
                    </Button>
                  </div>

                  {publishStatus && (
                    <div className={`mt-2 text-sm ${publishStatus.type === "success" ? "text-green-600" : "text-red-600"}`}>
                      {publishStatus.text}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="campaignName" className="text-sm">
                        Campaign Name
                      </Label>
                      <Input
                        id="campaignName"
                        value={adFormData.campaignName}
                        onChange={(e) => setAdFormData((p: any) => ({ ...p, campaignName: e.target.value }))}
                        placeholder="My Campaign"
                        className="mt-2"
                      />
                    </div>
                    <div>
                      <Label htmlFor="adSetName" className="text-sm">
                        Ad Set Name
                      </Label>
                      <Input
                        id="adSetName"
                        value={adFormData.adSetName}
                        onChange={(e) => setAdFormData((p: any) => ({ ...p, adSetName: e.target.value }))}
                        placeholder="Ad Set Name (optional)"
                        className="mt-2"
                      />
                    </div>
                    <div>
                      <Label htmlFor="objective" className="text-sm">
                        Objective
                      </Label>
                      <select id="objective" value={adFormData.objective} onChange={(e) => setAdFormData((p: any) => ({ ...p, objective: e.target.value }))} className="mt-2 w-full h-9 rounded border px-2">
                        <option value="LINK_CLICKS">Link Clicks</option>
                        <option value="CONVERSIONS">Conversions</option>
                        <option value="BRAND_AWARENESS">Brand Awareness</option>
                        <option value="REACH">Reach</option>
                      </select>
                    </div>
                    <div>
                      <Label htmlFor="primaryCTA" className="text-sm">
                        Primary CTA
                      </Label>
                      <Input
                        id="primaryCTA"
                        value={adFormData.primaryCTA}
                        onChange={(e) => setAdFormData((p: any) => ({ ...p, primaryCTA: e.target.value }))}
                        placeholder="LEARN_MORE"
                        className="mt-2"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="destinationLink" className="text-sm">
                        Destination URL
                      </Label>
                      <Input
                        id="destinationLink"
                        value={adFormData.destinationLink}
                        onChange={(e) => setAdFormData((p: any) => ({ ...p, destinationLink: e.target.value }))}
                        placeholder="https://example.com"
                        className="mt-2"
                      />
                    </div>
                    <div>
                      <Label htmlFor="delivery" className="text-sm">
                        Delivery Type
                      </Label>
                      <select id="delivery" value={adFormData.delivery} onChange={(e) => setAdFormData((p: any) => ({ ...p, delivery: e.target.value }))} className="mt-2 w-full h-9 rounded border px-2">
                        <option value="">Default</option>
                        <option value="standard">Standard</option>
                        <option value="expedited">Expedited</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="budget" className="text-sm">
                        Budget
                      </Label>
                      <Input
                        id="budget"
                        type="number"
                        value={adFormData.budget}
                        onChange={(e) => setAdFormData((p: any) => ({ ...p, budget: Number(e.target.value) }))}
                        placeholder="5000"
                        className="mt-2"
                      />
                    </div>
                    <div>
                      <Label htmlFor="duration" className="text-sm">
                        Duration (days)
                      </Label>
                      <Input
                        id="duration"
                        type="number"
                        value={adFormData.duration || 7}
                        onChange={(e) => setAdFormData((p: any) => ({ ...p, duration: Number(e.target.value) }))}
                        placeholder="7"
                        className="mt-2"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="targeting" className="text-sm">
                      Audience Targeting (interests)
                    </Label>
                    <Input
                      id="targeting"
                      value={adFormData.interests}
                      onChange={(e) => setAdFormData((p: any) => ({ ...p, interests: e.target.value }))}
                      placeholder="e.g., Fashion, Fitness"
                      className="mt-2"
                    />
                    <div className="mt-2 flex gap-2 items-center">
                      <div className="flex items-center gap-2">
                        <label className="inline-flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={adFormData.platforms.includes("Instagram")}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setAdFormData((p: any) => ({
                                ...p,
                                platforms: checked
                                  ? Array.from(new Set([...(p.platforms || []), "Instagram"]))
                                  : (p.platforms || []).filter((x: any) => x !== "Instagram"),
                              }));
                            }}
                          />
                          Instagram
                        </label>
                        <label className="inline-flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={adFormData.platforms.includes("Facebook")}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setAdFormData((p: any) => ({
                                ...p,
                                platforms: checked
                                  ? Array.from(new Set([...(p.platforms || []), "Facebook"]))
                                  : (p.platforms || []).filter((x: any) => x !== "Facebook"),
                              }));
                            }}
                          />
                          Facebook
                        </label>
                      </div>
                      <div className="ml-auto flex items-center gap-2">
                        <label className="inline-flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={!!adFormData.autoOptimise}
                            onChange={(e) => setAdFormData((p: any) => ({ ...p, autoOptimise: e.target.checked }))}
                          />
                          Auto Optimise
                        </label>
                        <label className="inline-flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={!!adFormData.autoTarget}
                            onChange={(e) => setAdFormData((p: any) => ({ ...p, autoTarget: e.target.checked }))}
                          />
                          Auto target
                        </label>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      className="flex-1 hover:scale-105 transition-transform flex items-center justify-center gap-2"
                      style={{
                        background: colors.gradientPrimary,
                        color: colors.primaryForeground,
                      }}
                      onClick={() => handleLaunchAd()}
                      disabled={adLoading}
                    >
                      {adLoading ? <span>Running ad…</span> : <span>Launch Ad Campaign</span>}
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={async () => {
                        try {
                          const token =
                            (await supabase.auth.getSession()).data?.session
                              ?.access_token ?? null;
                          if (!token) {
                            toast.error("Sign in to save draft");
                            return;
                          }
                          await fetch("/api/campaigns/save-draft", {
                            method: "POST",
                            headers: {
                              "Content-Type": "application/json",
                              Authorization: `Bearer ${token}`,
                            },
                            body: JSON.stringify({
                              mode: "ad",
                              name: adFormData.campaignName,
                              inputs: adFormData,
                            }),
                          });
                          toast.success("Draft saved");
                        } catch (e) {
                          console.error("save-draft failed", e);
                          toast.error("Save failed");
                        }
                      }}
                    >
                      Save Draft
                    </Button>
                  </div>

                  {adStatus && <div className={`mt-2 text-sm ${adStatus.type === "success" ? "text-green-600" : "text-red-600"}`}>{adStatus.text}</div>}
                </div>
              )}
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
