// pages/create-campaign-finalize.tsx
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient"; // adjust if your path is different
import Sidebar from '../app/web/src/components/Sidebar';
export default function CreateCampaignFinalize() {
  const router = useRouter();
  const [preview, setPreview] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem("preview");
    if (!raw) {
      router.push("/create-campaign");
      return;
    }
    try {
      setPreview(JSON.parse(raw));
    } catch (e) {
      console.error("Invalid preview JSON", e);
      router.push("/create-campaign");
    }
  }, [router]);

  if (!preview) {
    return <div className="min-h-screen flex items-center justify-center">Loading…</div>;
  }

  const { inputs = {}, output = null, image = null } = preview;

  // helper: convert dataURL -> File
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
    const user = userData?.user;
    if (!user) {
      setError("You must be signed in to publish a campaign.");
      setLoading(false);
      router.push("/auth/signin");
      return;
    }

    // Log user ID for debugging
    console.log("Authenticated User ID:", user);
    console.log("Authenticated User ID:", user.id);

    // 2) Optionally upload image if present
    let image_url: string | null = null;
    let image_path: string | null = null;

    if (image) {
      const safeName = (inputs?.name || "campaign").replace(/[^a-z0-9_\-]/gi, "_").toLowerCase();
      const filename = `${user.id}_${Date.now()}_${safeName}.png`;
      const path = `campaigns/${user.id}/${filename}`;

      let fileToUpload: File;
      if (typeof image === "string" && image.startsWith("data:")) {
        fileToUpload = dataURLtoFile(image, filename);
      } else {
        const resp = await fetch(image);
        const blob = await resp.blob();
        fileToUpload = new File([blob], filename, { type: blob.type || "image/png" });
      }

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("campaign-assets")
        .upload(path, fileToUpload, { cacheControl: "3600", upsert: false });

      if (uploadError) {
        throw uploadError;
      }

      const { data: publicData } = supabase.storage.from("campaign-assets").getPublicUrl(path);
      image_url = publicData?.publicUrl || null;
      image_path = path;
    }

    // 3) Prepare payload and log for debugging
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

    console.log("Insert Payload:", payload);

    // 4) Insert into campaigns table
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
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <div className="flex-1 p-8">
        <h2 className="text-2xl font-bold mb-1">Finalize Campaign</h2>
        <p className="text-slate-500 mb-6">Last chance—review and confirm your campaign before publishing.</p>

        {/* Progress */}
        <div className="w-full bg-slate-200 h-2 rounded mb-8">
          <div className="bg-blue-600 h-2 w-full rounded" />
        </div>

        <div className="space-y-8 max-w-3xl">
          {/* Final Summary */}
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

          {/* Generated Visual */}
          <div className="bg-white rounded-xl shadow p-6 space-y-4">
            <h3 className="font-semibold">Generated Visual</h3>
            {image ? (
              // image may be data URL or remote URL
              // eslint-disable-next-line @next/next/no-img-element
              <img src={image} alt="Generated Campaign Visual" className="w-full max-w-md rounded" />
            ) : (
              <p>No image available</p>
            )}
          </div>

          {/* Generated Copy */}
          <div className="bg-white rounded-xl shadow p-6 space-y-4">
            <h3 className="font-semibold">Generated Copy</h3>
            <pre className="whitespace-pre-wrap bg-slate-100 p-4 rounded">
              {JSON.stringify(output, null, 2)}
            </pre>
          </div>

          {/* Actions */}
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
