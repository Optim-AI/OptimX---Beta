"use client";

import * as React from "react";
import Sidebar from "../app/web/src/components/Sidebar";
import { Card } from "../app/web/src/components/ui/card";
import { Button } from "../app/web/src/components/ui/button";
import { Textarea } from "../app/web/src/components/ui/textarea";
import { Label } from "../app/web/src/components/ui/label";
import colors from "../lib/colors";
import { supabase } from "../lib/supabaseClient";
import { toast } from "sonner";

/**
 * pages/image-library.tsx (updated)
 * - Reuses the same auth / upload / posting conventions used by your working
 *   CampaignCreate component: includes Authorization bearer token where available,
 *   saves campaign rows with select(), and records attempts defensively.
 * - Keeps same UI and behavior you provided but makes the repost flow call
 *   endpoints the same way your working code does (and adds token header if present).
 */

export default function ImageLibraryPage() {
  const [images, setImages] = React.useState<string[]>([]);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [firstName, setFirstName] = React.useState<string | null>(null);

  // Repost modal state
  const [repostOpen, setRepostOpen] = React.useState(false);
  const [repostImage, setRepostImage] = React.useState<string | null>(null);
  const [repostCaption, setRepostCaption] = React.useState<string>("");
  const [repostPlatforms, setRepostPlatforms] = React.useState<string[]>([]);
  const [repostLoading, setRepostLoading] = React.useState(false);

  /* ----------------- Helpers copied / aligned with working code ----------------- */
  async function getCurrentUser() {
    try {
      const { data } = await supabase.auth.getUser();
      return (data as any)?.user ?? null;
    } catch (e) {
      return null;
    }
  }

  async function getAccessToken() {
    try {
      const sess = await supabase.auth.getSession();
      return (sess.data?.session as any)?.access_token ?? null;
    } catch (e) {
      return null;
    }
  }

  /* ------------------- Load images + profile greeting ------------------- */
  React.useEffect(() => {
    let mounted = true;

    const fetchImages = async () => {
      if (!mounted) return;
      setLoading(true);
      try {
        const user = await getCurrentUser();
        if (!user) {
          setImages([]);
          setFirstName(null);
          setLoading(false);
          return;
        }

        // profile fetch for greeting
        try {
          const { data: profile } = await supabase
            .from("profiles")
            .select("full_name")
            .eq("id", user.id)
            .single();
          const name = (profile as any)?.full_name || (user.email ? user.email.split("@")[0] : null);
          if (mounted) setFirstName(name);
        } catch {
          if (mounted) setFirstName(user.email ? user.email.split("@")[0] : "There");
        }

        // fetch images (limit 500)
        const { data, error } = await supabase
          .from("user_generated_image")
          .select("image_url")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(500);

        if (error) {
          console.warn("fetch images error", error);
          toast.error("Failed to fetch images");
          if (mounted) setImages([]);
        } else {
          const urls = (data || [])
            .map((r: any) => (r && r.image_url ? String(r.image_url) : null))
            .filter((u): u is string => Boolean(u));
          if (mounted) setImages(urls);
        }
      } catch (e) {
        console.error("image library load failed", e);
        toast.error("Failed to load images");
        if (mounted) setImages([]);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchImages();

    const onFocus = () => fetchImages();
    window.addEventListener("focus", onFocus);

    return () => {
      mounted = false;
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  const greet = React.useMemo(() => {
    const n = firstName ? String(firstName).trim() : null;
    if (!n) return "There";
    const f = n.split(" ")[0];
    return f.charAt(0).toUpperCase() + f.slice(1).toLowerCase();
  }, [firstName]);

  /* ---------------- Repost flow (aligned with working code) ---------------- */
  const openRepostModal = (img: string) => {
    setRepostImage(img);
    setRepostCaption("");
    setRepostPlatforms([]);
    setRepostOpen(true);
  };

  const handleRepost = async () => {
    if (!repostImage) return;
    setRepostLoading(true);
    try {
      const user = await getCurrentUser();
      if (!user) {
        toast.error("Sign in to repost.");
        setRepostLoading(false);
        return;
      }

      // build campaign payload (same shape the other working page uses)
      const payload = {
        user_id: user.id,
        name: `Repost ${Date.now()}`,
        campaign_type: "post",
        brand_voice: null,
        content_types: ["image"],
        vision: null,
        output: { caption: repostCaption || null },
        image_url: [repostImage],
        image_path: [""],
        is_published: true,
      };

      try {
        // insert campaign row (select returned row like the working code)
        const { data: inserted, error: insertError } = await supabase
          .from("campaigns")
          .insert([payload])
          .select();
        if (insertError) {
          console.warn("save repost campaign failed", insertError);
          // continue even if it fails; user wanted flow to continue
        }
      } catch (e) {
        console.warn("campaign insert threw", e);
      }

      // prepare authorization header if available (some endpoints expect bearer token)
      const token = await getAccessToken();
      const commonHeaders: any = { "Content-Type": "application/json" };
      if (token) commonHeaders["Authorization"] = `Bearer ${token}`;

      // Post to Instagram (if selected)
      if (repostPlatforms.includes("Instagram")) {
        try {
          const resp = await fetch("/api/auth/instagram/post", {
            method: "POST",
            headers: commonHeaders,
            body: JSON.stringify({
              image_url: repostImage,
              caption: repostCaption || "",
              alsoPostToFacebook: repostPlatforms.includes("Facebook"),
            }),
          });
          if (!resp.ok) {
            const j = await resp.json().catch(() => null);
            throw new Error((j && (j.error || j.message)) || "Instagram post failed");
          }
        } catch (e: any) {
          console.error("Instagram post failed", e);
          toast.error("Instagram post failed: " + (e?.message || String(e)));
          setRepostLoading(false);
          return;
        }
      }

      // If Instagram posted and alsoPostToFacebook was true above, we already handled FB.
      // Otherwise, post directly to Facebook if selected and Instagram not used for FB crosspost.
      if (repostPlatforms.includes("Facebook") && !repostPlatforms.includes("Instagram")) {
        try {
          const resp = await fetch("/api/auth/facebook/post", {
            method: "POST",
            headers: commonHeaders,
            body: JSON.stringify({ image_url: repostImage, caption: repostCaption || "" }),
          });
          if (!resp.ok) {
            const j = await resp.json().catch(() => null);
            throw new Error((j && (j.error || j.message)) || "Facebook post failed");
          }
        } catch (e: any) {
          console.error("Facebook post failed", e);
          toast.error("Facebook post failed: " + (e?.message || String(e)));
          setRepostLoading(false);
          return;
        }
      }

      toast.success("Saved and posted (where selected).");
      setRepostOpen(false);
    } catch (e: any) {
      console.error("handleRepost failed", e);
      toast.error("Repost failed: " + (e?.message || String(e)));
    } finally {
      setRepostLoading(false);
    }
  };

  /* ---------------- UI helpers ---------------- */
  const hoverOverlay = (src: string) => (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(180deg, rgba(0,0,0,0.0), rgba(0,0,0,0.28))",
      }}
      className="opacity-0 group-hover:opacity-100 transition-opacity"
    >
      <div style={{ display: "flex", gap: 12 }}>
        <Button
          size="sm"
          variant="default"
          onClick={(e: any) => {
            e.stopPropagation();
            openRepostModal(src);
          }}
        >
          Repost
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Sidebar remains */}
      <Sidebar logoUrl={'/brand/logo.png'} onLogoClick={() => {}} />

      {/* Main content */}
      <div className="flex-1" style={{ marginLeft: 0 }}>
        <main className="max-w-7xl mx-auto p-6 pb-56">
          <div className="mb-6">
            <h2 className="text-2xl font-semibold">Image Library</h2>
            <p className="text-sm mt-1" style={{ color: colors.mutedForeground }}>
              {loading ? "Loading your images…" : `All images for ${greet}.`}
            </p>
          </div>

          <Card
            className="p-4 optim-deep-shadow"
            style={{ background: colors.card, border: `1px solid ${colors.border}` }}
          >
            {loading ? (
              <div style={{ color: colors.mutedForeground }}>Loading...</div>
            ) : images.length === 0 ? (
              <div style={{ color: colors.mutedForeground }}>
                No images found. Create or upload images and they'll appear here.
              </div>
            ) : (
              // Grid: 3 per row on small+ screens, responsive (mobile will stack)
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                {images.map((src, idx) => (
                  <div
                    key={idx}
                    className="rounded overflow-hidden border group relative"
                    style={{
                      borderColor: colors.border,
                      minHeight: 220,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: "#fff",
                    }}
                  >
                    <img src={src} alt={`generated-${idx}`} className="w-full h-56 object-cover" />
                    {hoverOverlay(src)}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </main>
      </div>

      {/* Repost Modal */}
      {repostOpen && repostImage && (
        <div
          className="fixed inset-0 flex items-center justify-center"
          style={{ zIndex: 220 }}
          aria-modal="true"
          role="dialog"
        >
          {/* Backdrop */}
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              zIndex: 221,
              background: `${colors.background}cc`,
              backdropFilter: "blur(6px)",
            }}
            onClick={() => { if (!repostLoading) setRepostOpen(false); }}
          />

          {/* Modal content */}
          <div style={{ position: "relative", zIndex: 222, width: 760, maxWidth: "96%" }}>
            <Card className="p-4 optim-deep-shadow" style={{ background: colors.card, border: `1px solid ${colors.border}` }}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-lg font-semibold">Repost image</h3>
                  <div className="text-sm" style={{ color: colors.mutedForeground }}>
                    Save and optionally post this image to Instagram / Facebook.
                  </div>
                </div>
                <div>
                  <Button size="sm" variant="ghost" onClick={() => { if (!repostLoading) setRepostOpen(false); }}>
                    Close
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <Label className="text-xs">Caption</Label>
                  <Textarea
                    value={repostCaption}
                    onChange={(e) => setRepostCaption(e.target.value)}
                    rows={5}
                    placeholder="Write a caption (optional)..."
                    className="mt-2"
                  />

                  <div className="mt-3">
                    <Label className="text-xs">Platforms</Label>
                    <div className="mt-2 flex gap-4 items-center">
                      <label className="inline-flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={repostPlatforms.includes("Instagram")}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setRepostPlatforms((p) => checked ? Array.from(new Set([...(p || []), "Instagram"])) : (p || []).filter((x) => x !== "Instagram"));
                          }}
                        />
                        Instagram
                      </label>
                      <label className="inline-flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={repostPlatforms.includes("Facebook")}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setRepostPlatforms((p) => checked ? Array.from(new Set([...(p || []), "Facebook"])) : (p || []).filter((x) => x !== "Facebook"));
                          }}
                        />
                        Facebook
                      </label>
                    </div>
                  </div>

                  <div className="mt-4 flex gap-3">
                    <Button
                      style={{ background: colors.gradientPrimary, color: colors.primaryForeground }}
                      onClick={handleRepost}
                      disabled={repostLoading}
                    >
                      {repostLoading ? "Posting…" : "Post / Save"}
                    </Button>

                    <Button
                      variant="outline"
                      onClick={() => {
                        navigator.clipboard?.writeText(repostImage).then(() => toast.success("Image URL copied"));
                      }}
                    >
                      Copy Image URL
                    </Button>
                  </div>
                </div>

                <div>
                  <Label className="text-xs">Preview</Label>
                  <div className="mt-2 border rounded overflow-hidden" style={{ borderColor: colors.border }}>
                    <img src={repostImage} alt="repost preview" className="w-full h-48 object-cover" />
                  </div>
                  <div className="text-xs mt-2" style={{ color: colors.mutedForeground }}>
                    Saved to campaigns and posted to selected platforms (if connected).
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
