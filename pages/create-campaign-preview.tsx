// pages/create-campaign-preview.tsx
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Sidebar from '../app/web/src/components/Sidebar';

type PreviewStore = {
  inputs: any;
  output: any;
  images?: string[];  // public URLs if returned
  image?: string;
  imageKey?: string;  // key in IndexedDB if blob stored there
  selectedImages?: string[];
};

export default function CreateCampaignPreview() {
  const router = useRouter();
  const [preview, setPreview] = useState<PreviewStore | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loadingImage, setLoadingImage] = useState(false);

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

  useEffect(() => {
    const raw = sessionStorage.getItem("preview");
    if (!raw) {
      router.push("/create-campaign");
      return;
    }
    try {
      const parsed: PreviewStore = JSON.parse(raw);
      setPreview(parsed);

      // If there is a public URL, use it directly
      if (parsed.image && typeof parsed.image === "string" && parsed.image.length > 0) {
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
    // For this simplified flow we assume single image only
    const selectedImages = imageUrl ? [imageUrl] : [];
    const newPreview = { ...preview, images: selectedImages, selectedImages };
    sessionStorage.setItem("preview", JSON.stringify(newPreview));
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

  // optional: remove stored blob from IndexedDB after publish or if you want to clean
  const removeBlobIfAny = async () => {
    if (!preview?.imageKey) return;
    try {
      await idbDelete(preview.imageKey);
      console.log("Deleted image blob from IndexedDB:", preview.imageKey);
    } catch (e) {
      console.warn("Failed to delete image blob:", e);
    }
  };

  return (
    <div className="min-h-screen flex bg-slate-50">
      <Sidebar />

      <div className="flex-1 p-8">
        <h2 className="text-2xl font-bold mb-1">Campaign Preview</h2>
        <p className="text-slate-500 mb-6">Review your campaign visual & copy before confirming.</p>

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
                <p className="font-medium">{inputs.name}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Target Audience</p>
                <p className="font-medium">{inputs.audience}</p>
              </div>
            </div>
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
              <div className="text-sm text-amber-700">No image available. You can regenerate.</div>
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
              <button onClick={() => { removeBlobIfAny(); alert('Removed any stored blob (if present).'); }} className="px-3 py-2 rounded border">Remove stored blob</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
