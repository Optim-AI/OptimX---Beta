// pages/create-campaign-finalize.tsx
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient"; // adjust path if necessary
import Sidebar from '../app/web/src/components/Sidebar';

type PreviewStore = {
  inputs: any;
  output: any;
  images?: string[] | null;
  image?: string | null;
  imageKey?: string | null;
  selectedImages?: string[] | null;
};

export default function CreateCampaignFinalize() {
  const router = useRouter();
  const [preview, setPreview] = useState<PreviewStore | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);

  // Visual preview modal state
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<
    "insta_feed" | "insta_story" | "facebook_feed" | "youtube_thumb"
  >("insta_feed");

  // natural image dims
  const [imgDims, setImgDims] = useState<{ width: number | null; height: number | null }>({ width: null, height: null });

  // Publish & Post confirm modal
  const [isPostConfirmOpen, setIsPostConfirmOpen] = useState(false);
  const [postToInstagram, setPostToInstagram] = useState<boolean>(true);
  const [crosspostToFacebook, setCrosspostToFacebook] = useState<boolean>(false);
  const [postingNow, setPostingNow] = useState<boolean>(false);

  useEffect(() => {
    const raw = sessionStorage.getItem("preview");
    if (!raw) {
      router.push("/create-campaign");
      return;
    }
    try {
      const p: PreviewStore = JSON.parse(raw);
      setPreview(p);

      // Determine images array to use: priority selectedImages -> images -> image
      let imgs: string[] = [];
      if (Array.isArray(p.selectedImages) && p.selectedImages.length > 0) imgs = p.selectedImages as string[];
      else if (Array.isArray(p.images) && p.images.length > 0) imgs = p.images as string[];
      else if (typeof p.image === "string" && p.image) imgs = [p.image];

      setSelectedImages(imgs.length ? [imgs[0]] : []);
      setPreview((prev) => ({ ...(p || {}), images: imgs }));
      setPreviewImageUrl(imgs.length ? imgs[0] : null);
    } catch (e) {
      console.error("Invalid preview JSON", e);
      router.push("/create-campaign");
    }
  }, [router]);

  // detect natural image dims for preview info
  useEffect(() => {
    if (!previewImageUrl) {
      setImgDims({ width: null, height: null });
      return;
    }
    const img = new Image();
    let mounted = true;
    img.onload = () => {
      if (!mounted) return;
      setImgDims({ width: img.naturalWidth || null, height: img.naturalHeight || null });
    };
    img.onerror = () => {
      if (!mounted) return;
      setImgDims({ width: null, height: null });
    };
    img.src = previewImageUrl;
    return () => {
      mounted = false;
    };
  }, [previewImageUrl]);

  if (!preview) {
    return <div className="min-h-screen flex items-center justify-center">Loading…</div>;
  }

  const { inputs = {}, output = null, images = [] } = preview as any;

  // helper: download remote image to user's device
  const downloadImage = async (url: string, filename?: string) => {
    try {
      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`Failed to fetch image for download: ${resp.status} ${resp.statusText}`);
      const blob = await resp.blob();
      const link = document.createElement("a");
      const objectUrl = window.URL.createObjectURL(blob);
      link.href = objectUrl;
      link.download = filename || `image_${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(objectUrl);
    } catch (err: any) {
      console.error("Download failed", err);
      alert("Download failed: " + (err?.message || err));
    }
  };

  const downloadAll = async () => {
    if (selectedImages.length === 0) return alert("No images selected to download.");
    for (let i = 0; i < selectedImages.length; i++) {
      const url = selectedImages[i];
      await downloadImage(url, `${(inputs?.name || "campaign")}_img${i + 1}.png`);
    }
  };

  const toggleImageInclusion = (url: string) => {
    setSelectedImages(prev => (prev.includes(url) ? prev.filter(u => u !== url) : [...prev, url]));
  };

  // convert dataURL -> File
  function dataURLtoFile(dataurl: string, filename: string) {
    const arr = dataurl.split(",");
    const mimeMatch = arr[0].match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : "image/png";
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) u8arr[n] = bstr.charCodeAt(n);
    return new File([u8arr], filename, { type: mime });
  }

  const handlePublish = async (postOptions?: { postToInstagram?: boolean; crosspostToFacebook?: boolean }) => {
    setError(null);
    setSuccessMsg(null);
    setLoading(true);

    const doPost = !!(postOptions && (postOptions.postToInstagram || postOptions.crosspostToFacebook));
    const doPostToInstagram = !!(postOptions && postOptions.postToInstagram);
    const doCrosspostToFacebook = !!(postOptions && postOptions.crosspostToFacebook);

    try {
      // ensure user logged in
      const { data: userData } = await supabase.auth.getUser();
      const user = (userData as any)?.user;
      if (!user) {
        setError("You must be signed in to publish a campaign.");
        setLoading(false);
        router.push("/auth/signin");
        return;
      }

      // validate selected images
      if (!selectedImages || selectedImages.length === 0) {
        setError("Please select at least one image to publish.");
        setLoading(false);
        return;
      }

      // upload selected images to supabase storage
      const image_url: string[] = [];
      const image_path: string[] = [];

      for (let i = 0; i < selectedImages.length; i++) {
        const url = selectedImages[i];
        const safeName = (inputs?.name || "campaign").replace(/[^a-z0-9_\-]/gi, "_").toLowerCase();
        const filename = `${user.id}_${Date.now()}_${i + 1}_${safeName}.png`;
        const path = `campaigns/${user.id}/${filename}`;

        let fileToUpload: File;
        if (typeof url === "string" && url.startsWith("data:")) {
          fileToUpload = dataURLtoFile(url, filename);
        } else {
          const resp = await fetch(url);
          if (!resp.ok) throw new Error(`Failed to fetch image for upload: ${resp.status} ${resp.statusText}`);
          const blob = await resp.blob();
          fileToUpload = new File([blob], filename, { type: blob.type || "image/png" });
        }

        const { error: uploadError } = await supabase.storage
          .from("campaign-assets")
          .upload(path, fileToUpload, { cacheControl: "3600", upsert: false });

        if (uploadError) {
          console.error("Upload error", uploadError);
          throw uploadError;
        }

        const { data: publicData } = supabase.storage.from("campaign-assets").getPublicUrl(path);
        const publicUrl = (publicData as any)?.publicUrl;

        if (!publicUrl) {
          throw new Error(`Could not obtain public URL for uploaded image at path: ${path}`);
        }

        image_url.push(publicUrl);
        image_path.push(path);
      }

      // insert campaign row
      const payload = {
        user_id: user.id,
        name: inputs?.name || null,
        audience: inputs?.audience || null,
        campaign_type: inputs?.campaignType || null,
        brand_voice: inputs?.brandVoice || null,
        content_types: inputs?.contentTypes || [],
        vision: inputs?.vision || null,
        output: output || null,
        image_url,
        image_path,
        is_published: true,
      };

      const { data: inserted, error: insertError } = await supabase
        .from("campaigns")
        .insert([payload])
        .select();

      if (insertError) {
        console.error("Insert Error:", insertError);
        throw insertError;
      }

      // optionally post to IG / FB
      let postResults: Array<{ image: string; result: any; error?: string }> = [];
      if (doPost && doPostToInstagram) {
        const caption =
          (output && (output.caption || output.copy || output.text || JSON.stringify(output))) ||
          inputs?.name ||
          "";

        for (let i = 0; i < image_url.length; i++) {
          const imgUrl = image_url[i];
          try {
            const resp = await fetch("/api/auth/instagram/post", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                image_url: imgUrl,
                caption,
                alsoPostToFacebook: doCrosspostToFacebook,
              }),
            });
            const json = await resp.json();
            if (!resp.ok) {
              postResults.push({ image: imgUrl, result: json, error: json?.error || `HTTP ${resp.status}` });
            } else {
              postResults.push({ image: imgUrl, result: json });
            }
          } catch (err: any) {
            console.error("Post to IG failed", err);
            postResults.push({ image: imgUrl, result: null, error: (err && err.message) || String(err) });
          }
        }
      }

      sessionStorage.removeItem("preview");
      let finalMsg = "Campaign published successfully!";
      if (doPost) {
        const failures = postResults.filter(r => r.error);
        if (postResults.length && failures.length === 0) finalMsg += " Social posting succeeded.";
        else if (postResults.length && failures.length > 0) {
          finalMsg += ` Social posting had ${failures.length} failures (see console).`;
          setError(`Some social posts failed (${failures.length}/${postResults.length}).`);
          console.warn("Post Results:", postResults);
        }
      }
      setSuccessMsg(finalMsg);
      setTimeout(() => router.push("/dashboard"), 900);
    } catch (err: any) {
      console.error("Error:", err);
      setError(err?.message || String(err));
    } finally {
      setLoading(false);
      setPostingNow(false);
    }
  };

  // open preview modal for given url/template
  const openPreviewModal = (url?: string, template?: "insta_feed" | "insta_story" | "facebook_feed" | "youtube_thumb") => {
    const u = url || (selectedImages.length ? selectedImages[0] : null);
    if (!u) return alert("No image selected for preview.");
    setPreviewImageUrl(u);
    if (template) setPreviewTemplate(template);
    setIsPreviewOpen(true);
  };

  const closePreviewModal = () => setIsPreviewOpen(false);

  // Template components (defined once)
  function TemplateInstaFeed({ src }: { src: string | null }) {
    return (
      <div className="flex flex-col items-center gap-3">
        <div className="w-[420px] h-[420px] bg-black/5 rounded overflow-hidden border">
          {src ? <img src={src} alt="insta-feed" className="w-full h-full object-cover" /> : null}
        </div>
      </div>
    );
  }

  function TemplateInstaStory({ src }: { src: string | null }) {
    return (
      <div className="flex flex-col items-center gap-3">
        <div className="w-[320px] h-[568px] bg-black rounded-3xl p-4 flex items-center justify-center">
          <div className="w-full h-full bg-white rounded-2xl overflow-hidden relative">
            {src ? <img src={src} alt="insta-story" className="w-full h-full object-cover" /> : null}
          </div>
        </div>
      </div>
    );
  }

  function TemplateFacebookFeed({ src }: { src: string | null }) {
    return (
      <div className="flex flex-col items-center gap-3">
        <div className="w-[640px] h-[335px] bg-black/5 rounded overflow-hidden border">
          {src ? <img src={src} alt="fb-feed" className="w-full h-full object-cover" /> : null}
        </div>
      </div>
    );
  }

  function TemplateYouTubeThumb({ src }: { src: string | null }) {
    return (
      <div className="flex flex-col items-center gap-3">
        <div className="w-[640px] h-[360px] bg-black/5 rounded overflow-hidden relative border">
          {src ? <img src={src} alt="yt-thumb" className="w-full h-full object-cover" /> : null}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-20 h-20 rounded-full bg-black/50 flex items-center justify-center">
              <div style={{ borderLeft: "18px solid white", borderTop: "10px solid transparent", borderBottom: "10px solid transparent", marginLeft: "6px" }} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  function renderSelectedTemplate(template: typeof previewTemplate, src: string | null) {
    switch (template) {
      case "insta_feed":
        return <TemplateInstaFeed src={src} />;
      case "insta_story":
        return <TemplateInstaStory src={src} />;
      case "facebook_feed":
        return <TemplateFacebookFeed src={src} />;
      case "youtube_thumb":
        return <TemplateYouTubeThumb src={src} />;
      default:
        return <TemplateInstaFeed src={src} />;
    }
  }

  return (
    <div className="min-h-screen flex bg-slate-50">
      <Sidebar />

      <div className="flex-1 p-8">
        <h2 className="text-2xl font-bold mb-1">Finalize Campaign</h2>
        <p className="text-slate-500 mb-6">Last chance—review and confirm your campaign before publishing.</p>

        <div className="w-full bg-slate-200 h-2 rounded mb-8">
          <div className="bg-blue-600 h-2 w-full rounded" />
        </div>

        <div className="space-y-8 max-w-4xl">
          <div className="bg-white rounded-xl shadow p-6 space-y-4">
            <h3 className="font-semibold flex items-center gap-2">✅ Final Campaign Summary</h3>
            <ul className="list-disc pl-5 text-slate-600 text-sm">
              <li>Campaign: <span className="font-medium">{inputs?.name}</span></li>
              <li>Audience: <span className="font-medium">{inputs?.audience}</span></li>
              <li>Type: <span className="font-medium">{inputs?.campaignType}</span></li>
              <li>Brand Voice: <span className="font-medium">{inputs?.brandVoice}</span></li>
              <li>Content Types: <span className="font-medium">{(inputs?.contentTypes || []).join(", ")}</span></li>
              <li>Vision: <span className="font-medium">{inputs?.vision}</span></li>
            </ul>
          </div>

          <div className="bg-white rounded-xl shadow p-6 space-y-4">
            <h3 className="font-semibold">Generated Visuals to Publish</h3>
            <div className="mb-3 flex gap-2 items-center">
              <button onClick={downloadAll} className="px-3 py-2 rounded bg-indigo-500 text-white hover:bg-indigo-600">Download All Selected</button>

              <div className="ml-2 flex items-center gap-2">
                <select className="border rounded px-2 py-1" defaultValue="" onChange={(e) => {
                  const val = e.target.value;
                  if (!val) return;
                  const map: Record<string, any> = {
                    "insta_feed": "insta_feed",
                    "insta_story": "insta_story",
                    "facebook_feed": "facebook_feed",
                    "youtube_thumb": "youtube_thumb"
                  };
                  openPreviewModal(undefined, map[val]);
                  (e.target as HTMLSelectElement).value = "";
                }}>
                  <option value="">Quick Preview →</option>
                  <option value="insta_feed">Instagram Feed (1:1)</option>
                  <option value="insta_story">Instagram Story (9:16)</option>
                  <option value="facebook_feed">Facebook Feed (1.91:1)</option>
                  <option value="youtube_thumb">YouTube Thumbnail (16:9)</option>
                </select>
              </div>

              <div className="text-sm text-slate-600 ml-auto">Toggle which images to include in the campaign publish.</div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {(images || []).map((url: string, idx: number) => {
                const included = selectedImages.includes(url);
                return (
                  <div key={url} className={`border rounded-lg p-2 ${included ? "ring-2 ring-green-500" : ""}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt={`Selected ${idx + 1}`} className="w-full h-64 object-cover rounded" />
                    <div className="mt-2 flex justify-between items-center">
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input type="checkbox" checked={included} onChange={() => toggleImageInclusion(url)} />
                        <span className="text-sm">Include</span>
                      </label>

                      <div className="flex items-center gap-2">
                        <button onClick={() => downloadImage(url, `${(inputs?.name || "campaign")}_img${idx + 1}.png`)} className="text-xs px-2 py-1 border rounded">Download</button>
                        <button onClick={() => { window.open(url, "_blank"); }} className="text-xs px-2 py-1 border rounded">View</button>
                        <button onClick={() => openPreviewModal(url, "insta_feed")} className="text-xs px-2 py-1 border rounded">Preview</button>
                      </div>
                    </div>
                  </div>
                );
              })}
              {(images || []).length === 0 && <div className="text-sm text-amber-700">No images available to publish.</div>}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow p-6 space-y-4">
            <h3 className="font-semibold">Generated Copy</h3>
            <pre className="whitespace-pre-wrap bg-slate-100 p-4 rounded">{JSON.stringify(output, null, 2)}</pre>
          </div>

          <div className="flex justify-between items-center">
            <Link href="/create-campaign-preview" className="px-4 py-2 rounded-lg border text-slate-600 hover:bg-slate-100">Back</Link>

            <div className="flex items-center gap-4">
              {error && <div className="text-red-600 text-sm">{error}</div>}
              {successMsg && <div className="text-green-600 text-sm">{successMsg}</div>}

              <button
                onClick={() => handlePublish({ postToInstagram: false, crosspostToFacebook: false })}
                disabled={loading}
                className={`px-4 py-2 rounded-lg border text-slate-700 hover:bg-slate-100 ${loading ? "opacity-60 cursor-not-allowed" : ""}`}
              >
                {loading ? "Publishing…" : "Publish Campaign"}
              </button>

              <button
                onClick={() => {
                  setPostToInstagram(true);
                  setCrosspostToFacebook(false);
                  setIsPostConfirmOpen(true);
                }}
                disabled={loading}
                className={`px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 ${loading ? "opacity-60 cursor-not-allowed" : ""}`}
              >
                {loading ? "Publishing…" : "Publish & Post"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* VISUAL PREVIEW MODAL */}
      {isPreviewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full p-4 relative">
            <button onClick={closePreviewModal} className="absolute right-4 top-4 text-slate-600 border rounded p-1">Close</button>

            <div className="flex gap-6">
              <div className="w-72 p-3">
                <div className="text-sm font-semibold mb-2">Templates</div>

                <div className="grid grid-cols-2 gap-2 mb-4">
                  <button onClick={() => setPreviewTemplate("insta_feed")} className={`p-2 border rounded ${previewTemplate === "insta_feed" ? "ring-2 ring-blue-500" : ""}`}>IG Feed</button>
                  <button onClick={() => setPreviewTemplate("insta_story")} className={`p-2 border rounded ${previewTemplate === "insta_story" ? "ring-2 ring-blue-500" : ""}`}>IG Story</button>
                  <button onClick={() => setPreviewTemplate("facebook_feed")} className={`p-2 border rounded ${previewTemplate === "facebook_feed" ? "ring-2 ring-blue-500" : ""}`}>FB Feed</button>
                  <button onClick={() => setPreviewTemplate("youtube_thumb")} className={`p-2 border rounded ${previewTemplate === "youtube_thumb" ? "ring-2 ring-blue-500" : ""}`}>YouTube</button>
                </div>

                <div className="text-sm font-semibold mb-2">Thumbnails</div>
                <div className="flex gap-2 flex-wrap mb-4">
                  {(images || []).map((u: string, i: number) => (
                    <button key={u} onClick={() => setPreviewImageUrl(u)} className={`w-20 h-20 overflow-hidden rounded border ${previewImageUrl === u ? "ring-2 ring-blue-500" : ""}`}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={u} alt={`thumb-${i}`} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>

                <div className="text-xs text-slate-500 mb-3">
                  Actual: {imgDims.width ? `${imgDims.width} × ${imgDims.height}px` : "unknown"}
                </div>

                <div className="flex gap-2">
                  <button onClick={() => previewImageUrl && downloadImage(previewImageUrl, `${(inputs?.name || 'preview')}_preview.png`)} className="px-3 py-2 border rounded text-sm">Download</button>
                  <button onClick={() => setIsPreviewOpen(false)} className="px-3 py-2 border rounded text-sm">Close</button>
                </div>
              </div>

              <div className="flex-1 flex items-center justify-center p-4">
                {renderSelectedTemplate(previewTemplate, previewImageUrl)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Publish & Post confirm modal */}
      {isPostConfirmOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 relative">
            <button onClick={() => setIsPostConfirmOpen(false)} className="absolute right-3 top-3 text-slate-600 border rounded p-1">X</button>
            <h3 className="text-lg font-semibold mb-3">Publish & Post Options</h3>

            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <input id="postIG" type="checkbox" checked={postToInstagram} onChange={(e) => setPostToInstagram(e.target.checked)} />
                <label htmlFor="postIG" className="text-sm">Post to Instagram</label>
              </div>

              <div className="flex items-center gap-2">
                <input id="postFB" type="checkbox" checked={crosspostToFacebook} onChange={(e) => setCrosspostToFacebook(e.target.checked)} />
                <label htmlFor="postFB" className="text-sm">Also post to Facebook</label>
              </div>

              <div className="text-xs text-slate-500">
                When confirmed, the campaign will be published and selected images will be posted via your integration.
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button onClick={() => setIsPostConfirmOpen(false)} className="px-3 py-2 border rounded">Cancel</button>
              <button
                onClick={async () => {
                  setPostingNow(true);
                  await handlePublish({ postToInstagram, crosspostToFacebook });
                  setIsPostConfirmOpen(false);
                }}
                disabled={postingNow}
                className="px-4 py-2 bg-green-600 text-white rounded"
              >
                {postingNow ? "Publishing…" : "Confirm & Publish & Post"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
