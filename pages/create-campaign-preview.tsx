// pages/create-campaign-preview.tsx
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Sidebar from '../app/web/src/components/Sidebar';

type PreviewStore = {
  inputs: any;
  output: any;
  // either `images` (preferred) or the legacy `image`
  images?: string[];
  image?: string;
  selectedImages?: string[]; // will be set when user confirms selection
};

export default function CreateCampaignPreview() {
  const router = useRouter();
  const [preview, setPreview] = useState<PreviewStore | null>(null);
  const [images, setImages] = useState<string[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [loadingRefresh, setLoadingRefresh] = useState(false);

  useEffect(() => {
    const raw = sessionStorage.getItem("preview");
    if (!raw) {
      router.push("/create-campaign");
      return;
    }
    try {
      const parsed: PreviewStore = JSON.parse(raw);
      setPreview(parsed);

      // Normalize images array
      let imgs: string[] = [];
      if (Array.isArray(parsed.images) && parsed.images.length > 0) {
        imgs = parsed.images;
      } else if (parsed.image) {
        imgs = [parsed.image];
      } else {
        imgs = [];
      }

      // If fewer than 4 images, optionally fill using client variations (keeps UI stable)
      if (imgs.length < 4 && parsed.inputs?.vision) {
        const width = 1024;
        const height = 1024;
        const more: string[] = [];
        for (let i = 1; i <= 4; i++) {
          const p = `${parsed.inputs.vision} :: variation ${i}`;
          more.push(`https://image.pollinations.ai/prompt/${encodeURIComponent(p)}?width=${width}&height=${height}&nologo=true`);
        }
        imgs = more;
      }

      setImages(imgs);
      // default select first image
      const selObj: Record<string, boolean> = {};
      imgs.forEach((u, idx) => (selObj[u] = idx === 0));
      setSelected(selObj);
    } catch (e) {
      console.error("Invalid preview JSON", e);
      router.push("/create-campaign");
    }
  }, [router]);

  if (!preview) return <div className="min-h-screen flex items-center justify-center">Loading…</div>;

  const { inputs, output } = preview;

  const toggleSelect = (url: string) => {
    setSelected(prev => ({ ...prev, [url]: !prev[url] }));
  };

  const refreshImages = async () => {
    if (!inputs) return;
    setLoadingRefresh(true);
    try {
      const resp = await fetch("/api/generate-campaign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(inputs),
      });
      const data = await resp.json();
      if (!data.ok) throw new Error(data.error || "API failed");

      let imgs: string[] = [];
      if (Array.isArray(data.images)) imgs = data.images;
      else if (data.image) imgs = [data.image];
      else {
        // fallback client-side variations
        const width = 1024;
        const height = 1024;
        for (let i = 1; i <= 4; i++) {
          const p = `${inputs.vision} :: variation ${i}`;
          imgs.push(`https://image.pollinations.ai/prompt/${encodeURIComponent(p)}?width=${width}&height=${height}&nologo=true`);
        }
      }

      // set new images and default select first
      setImages(imgs);
      const selObj: Record<string, boolean> = {};
      imgs.forEach((u, idx) => (selObj[u] = idx === 0));
      setSelected(selObj);

      // update sessionStorage preview.images for persistence
      const newPreview = { ...preview, images: imgs };
      sessionStorage.setItem("preview", JSON.stringify(newPreview));
      setPreview(newPreview);
    } catch (err: any) {
      console.error("Refresh failed:", err);
      alert("Could not refresh images: " + (err.message || err));
    } finally {
      setLoadingRefresh(false);
    }
  };

  const useSelectedAndContinue = () => {
    // collect selected image urls
    const selectedImages = images.filter(u => selected[u]);
    if (selectedImages.length === 0) {
      alert("Please select at least one image to continue.");
      return;
    }
    const newPreview = { ...preview, images, selectedImages };
    sessionStorage.setItem("preview", JSON.stringify(newPreview));
    router.push("/create-campaign-finalize");
  };

  return (
    <div className="min-h-screen flex bg-slate-50">
      <Sidebar />

      <div className="flex-1 p-8">
        <h2 className="text-2xl font-bold mb-1">Campaign Preview</h2>
        <p className="text-slate-500 mb-6">Review your campaign visuals & copy before confirming.</p>

        <div className="w-full bg-slate-200 h-2 rounded mb-8">
          <div className="bg-blue-600 h-2 w-2/3 rounded" />
        </div>

        <div className="space-y-8 max-w-4xl">
          {/* Info blocks */}
          <div className="bg-white rounded-xl shadow p-6 space-y-4">
            <h3 className="font-semibold flex items-center gap-2">📑 Campaign Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-slate-500">Campaign Name</p>
                <p className="font-medium">{inputs.name}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Target Audience</p>
                <p className="font-medium">{inputs.audience}</p>
              </div>
            </div>
            <div>
              <p className="text-xs text-slate-500">Campaign Type</p>
              <p className="font-medium">{inputs.campaignType}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Brand Voice</p>
              <p className="font-medium">{inputs.brandVoice}</p>
            </div>
          </div>

          {/* Content types */}
          <div className="bg-white rounded-xl shadow p-6 space-y-4">
            <h3 className="font-semibold">🖼️ Generated Visuals</h3>

            <div className="flex items-center justify-between mb-3">
              <div className="text-sm text-slate-600">Choose which images you'd like to use in the campaign.</div>
              <div className="flex gap-2">
                <button
                  onClick={refreshImages}
                  disabled={loadingRefresh}
                  className="px-3 py-2 rounded bg-yellow-500 text-white hover:bg-yellow-600"
                >
                  {loadingRefresh ? "Refreshing…" : "Refresh Images"}
                </button>
                <button
                  onClick={useSelectedAndContinue}
                  className="px-3 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
                >
                  Use Selected → Finalize
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {images.map((url, idx) => {
                const isSelected = !!selected[url];
                return (
                  <div key={url} className={`border rounded-lg p-2 relative ${isSelected ? "ring-2 ring-blue-500" : ""}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt={`Generated ${idx + 1}`} className="w-full h-64 object-cover rounded" />
                    <div className="mt-2 flex justify-between items-center">
                      <div className="text-sm font-medium">Variation {idx + 1}</div>
                      <div className="flex items-center gap-2">
                        <label className="flex items-center gap-1 text-sm cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelect(url)}
                          />
                          <span className="ml-1">Select</span>
                        </label>
                        <button
                          onClick={() => {
                            // open full image in new tab
                            window.open(url, "_blank");
                          }}
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

          {/* Copy */}
          <div className="bg-white rounded-xl shadow p-6 space-y-4">
            <h3 className="font-semibold">Caption & Copy</h3>
            <pre className="whitespace-pre-wrap bg-slate-100 p-4 rounded">
              {JSON.stringify(output, null, 2)}
            </pre>
          </div>

          {/* Nav */}
          <div className="flex justify-between">
            <Link
              href="/create-campaign"
              className="px-4 py-2 rounded-lg border text-slate-600 hover:bg-slate-100"
            >
              Back
            </Link>
            <div>
              <button
                onClick={useSelectedAndContinue}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
              >
                Use Selected → Finalize
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
