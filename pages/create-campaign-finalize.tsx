// pages/create-campaign-finalize.tsx
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient"; // adjust if path differs
import Sidebar from '../app/web/src/components/Sidebar';

export default function CreateCampaignFinalize() {
  const router = useRouter();
  const [preview, setPreview] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [selectedImages, setSelectedImages] = useState<string[]>([]);

  useEffect(() => {
    const raw = sessionStorage.getItem("preview");
    if (!raw) {
      router.push("/create-campaign");
      return;
    }
    try {
      const p = JSON.parse(raw);
      setPreview(p);

      // Priority: preview.selectedImages -> preview.images -> preview.image
      let imgs: string[] = [];
      if (Array.isArray(p.selectedImages) && p.selectedImages.length > 0) imgs = p.selectedImages;
      else if (Array.isArray(p.images) && p.images.length > 0) imgs = p.images;
      else if (typeof p.image === "string" && p.image) imgs = [p.image];

      // If no images (edge case), try generating 4 client-side pollinations urls if vision is present
      if (imgs.length === 0 && p?.inputs?.vision) {
        const width = 1024;
        const height = 1024;
        for (let i = 1; i <= 4; i++) {
          const pmt = `${p.inputs.vision} :: variation ${i}`;
          imgs.push(`https://image.pollinations.ai/prompt/${encodeURIComponent(pmt)}?width=${width}&height=${height}&nologo=true`);
        }
      }

      setSelectedImages(imgs.length ? [imgs[0]] : []); // default include first
      // store images array back on preview so UI uses preview.images
      setPreview((prev: any) => ({ ...p, images: imgs }));
    } catch (e) {
      console.error("Invalid preview JSON", e);
      router.push("/create-campaign");
    }
  }, [router]);

  if (!preview) {
    return <div className="min-h-screen flex items-center justify-center">Loading…</div>;
  }

  const { inputs = {}, output = null, images = [] } = preview;

  // helper: download a remote image URL to local device
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

  // convert dataURL -> File (keeps your previous helper)
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

  const handlePublish = async () => {
    setError(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      // 1) Ensure user is logged in
      const { data: userData, error: authError } = await supabase.auth.getUser();
      const user = (userData as any)?.user;
      if (!user) {
        setError("You must be signed in to publish a campaign.");
        setLoading(false);
        router.push("/auth/signin");
        return;
      }

      // 2) Validate selected images
      if (!selectedImages || selectedImages.length === 0) {
        setError("Please select at least one image to publish.");
        setLoading(false);
        return;
      }

      // 3) Upload each selected image to Supabase storage, collect public URLs
      const image_urls: string[] = [];
      const image_paths: string[] = [];

      for (let i = 0; i < selectedImages.length; i++) {
        const url = selectedImages[i];
        // create a safe filename
        const safeName = (inputs?.name || "campaign").replace(/[^a-z0-9_\-]/gi, "_").toLowerCase();
        const filename = `${user.id}_${Date.now()}_${i + 1}_${safeName}.png`;
        const path = `campaigns/${user.id}/${filename}`;

        let fileToUpload: File;
        if (typeof url === "string" && url.startsWith("data:")) {
          fileToUpload = dataURLtoFile(url, filename);
        } else {
          // fetch remote image as blob
          const resp = await fetch(url);
          if (!resp.ok) throw new Error(`Failed to fetch image for upload: ${resp.status} ${resp.statusText}`);
          const blob = await resp.blob();
          fileToUpload = new File([blob], filename, { type: blob.type || "image/png" });
        }

        // Upload file to Supabase storage
        const { error: uploadError } = await supabase.storage
          .from("campaign-assets")
          .upload(path, fileToUpload, { cacheControl: "3600", upsert: false });

        if (uploadError) {
          console.error("Upload error", uploadError);
          throw uploadError;
        }

        // Get the public URL and validate it BEFORE pushing
        const { data: publicData } = supabase.storage.from("campaign-assets").getPublicUrl(path);
        const publicUrl = (publicData as any)?.publicUrl;

        if (!publicUrl) {
          throw new Error(`Could not obtain public URL for uploaded image at path: ${path}`);
        }

        image_urls.push(publicUrl);
        image_paths.push(path);
      }

      // 4) Prepare payload and insert into DB
      const payload = {
        user_id: user.id,
        name: inputs?.name || null,
        audience: inputs?.audience || null,
        campaign_type: inputs?.campaignType || null,
        brand_voice: inputs?.brandVoice || null,
        content_types: inputs?.contentTypes || [],
        vision: inputs?.vision || null,
        output: output || null,
        image_urls, // array of public URLs
        image_paths, // array of storage paths
        is_published: true,
      };

      console.log("Insert Payload:", payload);

      const { data: inserted, error: insertError } = await supabase
        .from("campaigns")
        .insert([payload])
        .select();

      if (insertError) {
        console.error("Insert Error:", insertError);
        throw insertError;
      }

      // Success: Clear preview & redirect
      sessionStorage.removeItem("preview");
      setSuccessMsg("Campaign published successfully!");
      setTimeout(() => router.push("/dashboard"), 700);
    } catch (err: any) {
      console.error("Error:", err);
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  };

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
              <button
                onClick={downloadAll}
                className="px-3 py-2 rounded bg-indigo-500 text-white hover:bg-indigo-600"
              >
                Download All Selected
              </button>
              <div className="text-sm text-slate-600">Toggle which images to include in the campaign publish.</div>
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
                        <input
                          type="checkbox"
                          checked={included}
                          onChange={() => toggleImageInclusion(url)}
                        />
                        <span className="text-sm">Include</span>
                      </label>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => downloadImage(url, `${(inputs?.name || "campaign")}_img${idx + 1}.png`)}
                          className="text-xs px-2 py-1 border rounded"
                        >
                          Download
                        </button>
                        <button
                          onClick={() => window.open(url, "_blank")}
                          className="text-xs px-2 py-1 border rounded"
                        >
                          View
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow p-6 space-y-4">
            <h3 className="font-semibold">Generated Copy</h3>
            <pre className="whitespace-pre-wrap bg-slate-100 p-4 rounded">
              {JSON.stringify(output, null, 2)}
            </pre>
          </div>

          <div className="flex justify-between items-center">
            <Link
              href="/create-campaign-preview"
              className="px-4 py-2 rounded-lg border text-slate-600 hover:bg-slate-100"
            >
              Back
            </Link>

            <div className="flex items-center gap-4">
              {error && <div className="text-red-600 text-sm">{error}</div>}
              {successMsg && <div className="text-green-600 text-sm">{successMsg}</div>}
              <button
                onClick={handlePublish}
                disabled={loading}
                className={`px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 ${loading ? "opacity-60 cursor-not-allowed" : ""}`}
              >
                {loading ? "Publishing…" : "🚀 Publish Campaign"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
