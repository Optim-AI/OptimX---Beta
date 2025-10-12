// pages/create-campaign.tsx
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Sidebar from '../app/web/src/components/Sidebar';

type APIReturn = {
  ok: boolean;
  image?: string;    // url or data:image/png;base64,...
  images?: string[]; // array with url(s)
  copy?: any;
  imageId?: string;  // optional server side id (ignored here)
  error?: string;
};

export default function CreateCampaign() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [audience, setAudience] = useState("");
  const [campaignType, setCampaignType] = useState("");
  const [brandVoice, setBrandVoice] = useState("");
  const [contentTypes, setContentTypes] = useState<string[]>([]);
  const [vision, setVision] = useState("");
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false); // for AI helper

  const toggleContentType = (t: string) => {
    setContentTypes(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
  };

  // ---------- IndexedDB helpers ----------
  const DB_NAME = "optim-app-db";
  const STORE_NAME = "images";

  function openDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
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

  // returns Blob or string (if stored as URL)
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

  // optional cleanup
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

  // ---------- util: convert dataURL -> Blob ----------
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

  // safe sessionStorage setter that stores only small metadata; image stored in IndexedDB if needed
  function setPreviewInSession(payload: any, apiResponse: APIReturn, imageKey?: string | null) {
    const previewObj: any = {
      inputs: payload,
      output: apiResponse?.copy ?? null,
    };

    if (apiResponse?.image && typeof apiResponse.image === "string" && !apiResponse.image.startsWith("data:")) {
      // open URL returned from server -> safe to store directly
      previewObj.image = apiResponse.image;
      previewObj.images = Array.isArray(apiResponse.images) && apiResponse.images.length ? apiResponse.images : [apiResponse.image];
    } else if (imageKey) {
      // we stored the blob in IndexedDB under imageKey
      previewObj.image = null; // avoid large string
      previewObj.images = [];
      previewObj.imageKey = imageKey;
    } else {
      // no image (or couldn't store)
      previewObj.image = null;
      previewObj.images = [];
    }

    try {
      sessionStorage.setItem("preview", JSON.stringify(previewObj));
    } catch (e) {
      console.warn("sessionStorage set failed even for small preview. Storing lean fallback.", e);
      const lean = { inputs: payload, output: apiResponse?.copy ?? null, image: null, images: [] };
      try {
        sessionStorage.setItem("preview", JSON.stringify(lean));
      } catch (err) {
        console.error("Even fallback sessionStorage failed:", err);
      }
    }
  }

  // ---------- generate flow ----------
  const handleGenerate = async () => {
    if (!name || !vision || contentTypes.length === 0) {
      alert("Please fill in Campaign Name, Vision, and pick at least one content type.");
      return;
    }
    setLoading(true);

    const payload = { name, audience, campaignType, brandVoice, contentTypes, vision, mode: "generate" };

    try {
      const resp = await fetch("/api/generate-campaign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data: APIReturn = await resp.json();
      if (!resp.ok || !data?.ok) {
        throw new Error(data?.error || `API failed: ${resp.status} ${resp.statusText}`);
      }

      // If API returned a public/small URL -> store it in session and continue
      if (data.image && typeof data.image === "string" && !data.image.startsWith("data:")) {
        setPreviewInSession(payload, data, null);
        router.push("/create-campaign-preview");
        return;
      }

      // If API returned a data URL (huge base64), store blob in IndexedDB and keep only key in session
      if (data.image && typeof data.image === "string" && data.image.startsWith("data:")) {
        try {
          const blob = dataURLtoBlob(data.image);
          const imageKey = `preview_image_${Date.now()}`;
          await idbPut(imageKey, blob);
          setPreviewInSession(payload, data, imageKey);
          router.push("/create-campaign-preview");
          return;
        } catch (e) {
          console.error("Failed to store image in IndexedDB:", e);
          // fallback: don't store image (but store copy)
          setPreviewInSession(payload, data, null);
          router.push("/create-campaign-preview");
          return;
        }
      }

      // fallback: no image returned
      setPreviewInSession(payload, data, null);
      router.push("/create-campaign-preview");
    } catch (err: any) {
      console.error("Generation failed:", err);
      alert("Generation failed: " + (err.message || String(err)));
    } finally {
      setLoading(false);
    }
  };

  // AI Assist (calls same API with mode assist)
  const handleAiAssist = async () => {
    if (!vision) {
      alert("Please type something first for AI assistance.");
      return;
    }
    setAiLoading(true);
    try {
      const resp = await fetch("/api/generate-campaign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "assist", vision }),
      });

      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data?.error || `Assist failed: ${resp.status}`);
      }
      if (data?.ok && data?.assist) {
        setVision(data.assist);
      } else {
        alert("AI assistance failed. Try again.");
      }
    } catch (err: any) {
      console.error("AI assist failed:", err);
      alert("AI assistance error: " + (err.message || String(err)));
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-slate-50">
      <Sidebar />

      <div className="flex-1 p-8">
        <h2 className="text-2xl font-bold mb-1">Create AI Campaign</h2>
        <p className="text-slate-500 mb-6">Describe your vision and let the OpenAI image service generate a visual.</p>

        <div className="w-full bg-slate-200 h-2 rounded mb-8">
          <div className="bg-blue-600 h-2 w-1/3 rounded" />
        </div>

        <div className="space-y-8 max-w-3xl">
          {/* Campaign Info */}
          <div className="bg-white rounded-xl shadow p-6 space-y-4">
            <h3 className="font-semibold flex items-center gap-2">📑 Campaign Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <input placeholder="Campaign Name *" value={name} onChange={e => setName(e.target.value)} className="border rounded-lg px-3 py-2" />
              <input placeholder="Target Audience" value={audience} onChange={e => setAudience(e.target.value)} className="border rounded-lg px-3 py-2" />
            </div>
            <div>
              <p className="text-sm font-medium mb-2">Campaign Type *</p>
              <div className="grid grid-cols-2 gap-2">
                {["Flash Sale", "Product Launch", "Festival Promotion", "Brand Awareness"].map(t => (
                  <button key={t} onClick={() => setCampaignType(t)} className={`px-3 py-2 border rounded-lg ${campaignType === t ? "bg-blue-50" : ""}`}>{t}</button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-sm font-medium mb-2">Brand Voice</p>
              <div className="flex gap-2 flex-wrap">
                {["Professional", "Friendly", "Energetic", "Luxury"].map(v => (
                  <button key={v} onClick={() => setBrandVoice(v)} className={`px-3 py-1 border rounded-lg ${brandVoice === v ? "bg-blue-50" : ""}`}>{v}</button>
                ))}
              </div>
            </div>
          </div>

          {/* Content Type */}
          <div className="bg-white rounded-xl shadow p-6 space-y-4">
            <h3 className="font-semibold">🖼️ Content Type *</h3>
            <div className="grid grid-cols-2 gap-4">
              {[
                { title: "Social Media Poster", desc: "Eye-catching visual content" },
                { title: "Video Content", desc: "Dynamic video ads" },
                { title: "Caption & Copy", desc: "Compelling text and hashtags" },
                { title: "Email Campaign", desc: "Professional email templates" },
              ].map(item => (
                <button key={item.title} onClick={() => toggleContentType(item.title)} className={`border rounded-lg p-4 text-left ${contentTypes.includes(item.title) ? "bg-blue-50" : ""}`}>
                  <p className="font-medium">{item.title}</p>
                  <p className="text-xs text-slate-500">{item.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Vision */}
          <div className="bg-white rounded-xl shadow p-6 space-y-4">
            <h3 className="font-semibold">✨ Describe Your Vision *</h3>
            <textarea rows={4} placeholder="What do you want to create?" className="w-full border rounded-lg px-3 py-2" value={vision} onChange={e => setVision(e.target.value)} />
            <div className="flex gap-2">
              <button onClick={handleAiAssist} disabled={aiLoading} className="px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700">
                {aiLoading ? "Generating..." : "AI Assist Description"}
              </button>
              <button onClick={() => setVision("")} className="px-4 py-2 rounded-lg border text-slate-600 hover:bg-slate-100">Clear</button>
            </div>
            <textarea rows={2} placeholder="Additional Requirements (Optional)" className="w-full border rounded-lg px-3 py-2" />
          </div>

          {/* Actions */}
          <div className="flex justify-between">
            <Link href="/dashboard" className="px-4 py-2 rounded-lg border text-slate-600 hover:bg-slate-100">Cancel</Link>
            <button onClick={handleGenerate} disabled={loading} className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700">
              {loading ? "Generating..." : "Generate Content →"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
