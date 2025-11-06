// pages/create-campaign-preview.tsx
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Sidebar from '../app/web/src/components/Sidebar';

type PreviewStore = {
  inputs: any;
  output: any;
  images?: string[] | null;   // public URLs if returned
  image?: string | null;
  imageKey?: string | null;   // key in IndexedDB if blob stored there
  selectedImages?: string[] | null;
};

type APIReturn = {
  ok: boolean;
  image?: string | null;
  images?: string[] | null;
  copy?: any;
  imageId?: string;
  error?: string;
  assist?: string;
};

export default function CreateCampaignPreview() {
  const router = useRouter();
  const [preview, setPreview] = useState<PreviewStore | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loadingImage, setLoadingImage] = useState(false);

  // New states for editing/regenerating prompt
  const [isEditing, setIsEditing] = useState(false);
  const [editingVision, setEditingVision] = useState("");
  const [regenerating, setRegenerating] = useState(false);
  const [regenError, setRegenError] = useState<string | null>(null);

  const DB_NAME = "optim-app-db";
  const STORE_NAME = "images";

  function openDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  function idbPut(key: string, value: Blob | string): Promise<void> {
    return new Promise(async (resolve, reject) => {
      try {
        const db = await openDb();
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        const putReq = store.put(value, key);
        putReq.onsuccess = () => resolve();
        putReq.onerror = () => reject(putReq.error);
        tx.oncomplete = () => db.close();
      } catch (e) {
        reject(e);
      }
    });
  }

  function idbGet(key: string): Promise<any> {
    return new Promise(async (resolve, reject) => {
      try {
        const db = await openDb();
        const tx = db.transaction(STORE_NAME, "readonly");
        const store = tx.objectStore(STORE_NAME);
        const getReq = store.get(key);
        getReq.onsuccess = () => resolve(getReq.result);
        getReq.onerror = () => reject(getReq.error);
        tx.oncomplete = () => db.close();
      } catch (e) {
        reject(e);
      }
    });
  }

  function idbDelete(key: string): Promise<void> {
    return new Promise(async (resolve, reject) => {
      try {
        const db = await openDb();
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        const delReq = store.delete(key);
        delReq.onsuccess = () => resolve();
        delReq.onerror = () => reject(delReq.error);
        tx.oncomplete = () => db.close();
      } catch (e) {
        reject(e);
      }
    });
  }

  function dataURLtoBlob(dataurl: string): Blob {
    const arr = dataurl.split(',');
    const mimeMatch = arr[0].match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : 'image/png';
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) u8arr[n] = bstr.charCodeAt(n);
    return new Blob([u8arr], { type: mime });
  }

  useEffect(() => {
    const raw = sessionStorage.getItem("preview");
    if (!raw) {
      router.push("/create-campaign");
      return;
    }
    try {
      const parsed: PreviewStore = JSON.parse(raw);
      setPreview(parsed);

      // Initialize editingVision so user sees original prompt
      setEditingVision(parsed?.inputs?.vision || "");

      // If there is a public URL, use it directly
      if (parsed.image && typeof parsed.image === "string" && parsed.image.length > 0 && !parsed.image.startsWith("data:")) {
        setImageUrl(parsed.image);
        return;
      }

      // If preview stored imageKey, attempt to load blob from IndexedDB
      if (parsed.imageKey) {
        setLoadingImage(true);
        idbGet(parsed.imageKey)
          .then((result) => {
            if (!result) {
              console.warn("No image blob found in IndexedDB for key:", parsed.imageKey);
              setImageUrl(null);
              return;
            }
            // result is Blob
            const blob = result instanceof Blob ? result : new Blob([result]);
            const objUrl = URL.createObjectURL(blob);
            setImageUrl(objUrl);
          })
          .catch((e) => {
            console.error("Failed to read image from IndexedDB:", e);
            setImageUrl(null);
          })
          .finally(() => setLoadingImage(false));
      } else if (Array.isArray(parsed.images) && parsed.images.length > 0) {
        // if images array has public URLs use first
        const candidate = parsed.images.find((i) => typeof i === "string" && !i.startsWith("data:")) || null;
        if (candidate) {
          setImageUrl(candidate);
        } else {
          setImageUrl(null);
        }
      } else {
        setImageUrl(null);
      }
    } catch (e) {
      console.error("Invalid preview JSON", e);
      router.push("/create-campaign");
    }
  }, [router]);

  if (!preview) return <div className="min-h-screen flex items-center justify-center">Loading…</div>;

  const { inputs, output } = preview;

  const useSelectedAndContinue = () => {
    // Keep same behavior as before: mark selected images and go finalize
    const selectedImages = imageUrl ? [imageUrl] : [];
    const newPreview: PreviewStore = { ...preview, images: selectedImages, selectedImages };
    sessionStorage.setItem("preview", JSON.stringify(newPreview));
    setPreview(newPreview);
    router.push("/create-campaign-finalize");
  };

  const downloadImage = async (urlOrObjUrl: string) => {
    try {
      if (!urlOrObjUrl) return alert("No image to download.");
      const resp = await fetch(urlOrObjUrl);
      if (!resp.ok) throw new Error(`Failed to fetch image: ${resp.status}`);
      const blob = await resp.blob();
      const link = document.createElement("a");
      const objectUrl = window.URL.createObjectURL(blob);
      link.href = objectUrl;
      link.download = `${(inputs?.name || "campaign")}_image.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(objectUrl);
    } catch (err: any) {
      console.error("Download failed", err);
      alert("Download failed: " + (err.message || String(err)));
    }
  };

  // Regenerate/replace image with new prompt (editingVision)
  const handleRegenerate = async () => {
    setRegenError(null);
    if (!editingVision || editingVision.trim().length === 0) {
      setRegenError("Prompt cannot be empty.");
      return;
    }
    setRegenerating(true);

    try {
      // Optionally delete previously stored blob to avoid orphaning (if we will replace)
      const previousKey = preview?.imageKey ?? null;
      // Prepare payload: reuse inputs but update vision
      const payload = { ...inputs, vision: editingVision, mode: "generate" };

      const resp = await fetch("/api/generate-campaign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data: APIReturn = await resp.json();
      if (!resp.ok || !data?.ok) {
        throw new Error(data?.error || `API failed: ${resp.status} ${resp.statusText}`);
      }

      // Build new preview object to store in session
      const newPreview: PreviewStore = {
        inputs: { ...inputs, vision: editingVision },
        output: data.copy ?? output,
        images: null,
        image: null,
        imageKey: null,
        selectedImages: null,
      };

      // Clean up old blob if we will replace with a new blob
      if (previousKey) {
        try {
          await idbDelete(previousKey);
        } catch (e) {
          console.warn("Failed to delete previous blob from IDB", e);
        }
      }

      // Handle various response shapes
      // 1) images array present
      if (Array.isArray(data.images) && data.images.length > 0) {
        const first = data.images[0] ?? null;
        if (typeof first === "string" && first.startsWith("data:")) {
          // store blob in IDB
          try {
            const blob = dataURLtoBlob(first);
            const imageKey = `preview_image_${Date.now()}`;
            await idbPut(imageKey, blob);
            newPreview.image = null;
            newPreview.images = [];
            newPreview.imageKey = imageKey;
            setImageUrl(URL.createObjectURL(blob));
          } catch (e) {
            console.error("Failed to store image in IndexedDB:", e);
            newPreview.image = null;
            newPreview.images = [];
            newPreview.imageKey = null;
            setImageUrl(null);
          }
        } else {
          // assume public URLs
          newPreview.images = data.images as string[];
          newPreview.image = (data.images && data.images[0]) || null;
          newPreview.imageKey = null;
          setImageUrl(newPreview.image ?? null);
        }
      } else if (data.image && typeof data.image === "string") {
        if (data.image.startsWith("data:")) {
          try {
            const blob = dataURLtoBlob(data.image);
            const imageKey = `preview_image_${Date.now()}`;
            await idbPut(imageKey, blob);
            newPreview.image = null;
            newPreview.images = [];
            newPreview.imageKey = imageKey;
            setImageUrl(URL.createObjectURL(blob));
          } catch (e) {
            console.error("Failed to store image in IndexedDB:", e);
            newPreview.image = null;
            newPreview.images = [];
            newPreview.imageKey = null;
            setImageUrl(null);
          }
        } else {
          newPreview.image = data.image;
          newPreview.images = Array.isArray(data.images) && data.images.length ? data.images : [data.image];
          newPreview.imageKey = null;
          setImageUrl(data.image);
        }
      } else {
        // no image returned
        newPreview.image = null;
        newPreview.images = [];
        newPreview.imageKey = null;
        setImageUrl(null);
      }

      // Save updated preview (with updated inputs.vision) to session
      sessionStorage.setItem("preview", JSON.stringify(newPreview));
      setPreview(newPreview);
      setIsEditing(false);
    } catch (err: any) {
      console.error("Regeneration failed:", err);
      setRegenError(err.message || String(err));
    } finally {
      setRegenerating(false);
    }
  };

  // optional: remove stored blob from IndexedDB after publish or if you want to clean
  const removeBlobIfAny = async () => {
    if (!preview?.imageKey) return;
    try {
      await idbDelete(preview.imageKey);
      console.log("Deleted image blob from IndexedDB:", preview.imageKey);
      // update session preview to remove reference
      const newPreview: PreviewStore = { ...preview, imageKey: null, image: null, images: [] };
      sessionStorage.setItem("preview", JSON.stringify(newPreview));
      setPreview(newPreview);
      setImageUrl(null);
      alert('Removed any stored blob (if present).');
    } catch (e) {
      console.warn("Failed to delete image blob:", e);
      alert('Failed to remove stored blob. See console for details.');
    }
  };

  return (
    <div className="min-h-screen flex bg-slate-50">
      <Sidebar />

      <div className="flex-1 p-8">
        <h2 className="text-2xl font-bold mb-1">Campaign Preview</h2>
        <p className="text-slate-500 mb-6">Review your campaign visual & copy before confirming. You can edit the prompt here and regenerate the image.</p>

        <div className="w-full bg-slate-200 h-2 rounded mb-8">
          <div className="bg-blue-600 h-2 w-2/3 rounded" />
        </div>

        <div className="space-y-8 max-w-4xl">
          {/* Info */}
          <div className="bg-white rounded-xl shadow p-6 space-y-4">
            <h3 className="font-semibold flex items-center gap-2">📑 Campaign Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-slate-500">Campaign Name</p>
                <p className="font-medium">{inputs?.name}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Target Audience</p>
                <p className="font-medium">{inputs?.audience}</p>
              </div>
            </div>
          </div>

          {/* Prompt Edit & Regenerate */}
          <div className="bg-white rounded-xl shadow p-6 space-y-4">
            <h3 className="font-semibold">✍️ Prompt (Vision)</h3>
            {!isEditing ? (
              <>
                <div className="text-sm text-slate-700 whitespace-pre-wrap p-3 bg-slate-50 rounded">{editingVision || "— no prompt provided —"}</div>
                <div className="flex gap-2 mt-3">
                  <button onClick={() => setIsEditing(true)} className="px-3 py-2 rounded border">Edit Prompt</button>
                  <button onClick={handleRegenerate} disabled={regenerating} className="px-3 py-2 rounded bg-blue-600 text-white">
                    {regenerating ? "Regenerating..." : "Regenerate Image"}
                  </button>
                  <button onClick={() => { setEditingVision(inputs?.vision || ""); setIsEditing(true); }} className="px-3 py-2 rounded border">Reset to original</button>
                </div>
                {regenError && <div className="text-red-600 text-sm mt-2">{regenError}</div>}
              </>
            ) : (
              <>
                <textarea rows={4} value={editingVision} onChange={(e) => setEditingVision(e.target.value)} className="w-full border rounded-lg px-3 py-2" />
                <div className="flex gap-2">
                  <button onClick={handleRegenerate} disabled={regenerating} className="px-3 py-2 rounded bg-blue-600 text-white">
                    {regenerating ? "Regenerating..." : "Apply & Regenerate"}
                  </button>
                  <button onClick={() => { setIsEditing(false); setEditingVision(preview?.inputs?.vision || ""); }} className="px-3 py-2 rounded border">Cancel</button>
                </div>
                {regenError && <div className="text-red-600 text-sm mt-2">{regenError}</div>}
              </>
            )}
          </div>

          {/* Image */}
          <div className="bg-white rounded-xl shadow p-6 space-y-4">
            <h3 className="font-semibold">🖼️ Generated Visual</h3>
            {loadingImage ? (
              <div>Loading image…</div>
            ) : imageUrl ? (
              <div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imageUrl} alt="Generated" className="w-full h-80 object-cover rounded" />
                <div className="mt-3 flex gap-2">
                  <button onClick={() => downloadImage(imageUrl)} className="px-3 py-2 rounded bg-indigo-500 text-white">Download</button>
                  <button onClick={() => window.open(imageUrl, "_blank")} className="px-3 py-2 rounded border">Open</button>
                </div>
              </div>
            ) : (
              <div className="text-sm text-amber-700">No image available. You can regenerate using the prompt above.</div>
            )}
          </div>

          {/* Copy */}
          <div className="bg-white rounded-xl shadow p-6 space-y-4">
            <h3 className="font-semibold">Caption & Copy</h3>
            <pre className="whitespace-pre-wrap bg-slate-100 p-4 rounded">{JSON.stringify(output, null, 2)}</pre>
          </div>

          <div className="flex justify-between">
            <Link href="/create-campaign" className="px-4 py-2 rounded-lg border text-slate-600 hover:bg-slate-100">Back</Link>
            <div className="flex items-center gap-4">
              <button onClick={useSelectedAndContinue} className="px-3 py-2 rounded bg-blue-600 text-white">Use Selected → Finalize</button>
              <button onClick={removeBlobIfAny} className="px-3 py-2 rounded border">Remove stored blob</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
