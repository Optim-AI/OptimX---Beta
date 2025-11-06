// pages/create-campaign.tsx
import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";
import Sidebar from '../app/web/src/components/Sidebar';
import { supabase } from "../lib/supabaseClient";

type APIReturn = {
  ok: boolean;
  image?: string;    // url or data:image/png;base64,...
  images?: string[]; // array with url(s)
  copy?: any;
  imageId?: string;
  error?: string;
};

const DIMENSION_OPTIONS = [
  { id: 'insta_feed', label: 'Instagram Post (1:1) — 1080×1080', width: 1080, height: 1080 },
  { id: 'insta_story', label: 'Instagram Story (9:16) — 1080×1920', width: 1080, height: 1920 },
  { id: 'facebook_feed', label: 'Facebook Feed (1.91:1) — 1200×630', width: 1200, height: 630 },
  { id: 'youtube_thumb', label: 'YouTube Thumb (16:9) — 1280×720', width: 1280, height: 720 },
];

export default function CreateCampaign() {
  const router = useRouter();

  // main fields (existing)
  const [name, setName] = useState("");
  const [audience, setAudience] = useState("");
  const [campaignType, setCampaignType] = useState("");
  const [brandVoice, setBrandVoice] = useState("");
  const [contentTypes, setContentTypes] = useState<string[]>([]);
  const [vision, setVision] = useState("");
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);

  // ---------- AI customization & onboarding-derived inputs ----------
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [logoPublicUrl, setLogoPublicUrl] = useState<string | null>(null); // stored logo public URL from onboarding (if any)
  const [refPublicUrls, setRefPublicUrls] = useState<string[]>([]); // stored ref images public urls from onboarding

  // local edits/uploads (overrides)
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null); // preview & send to API as data URL (if provided)
  const [refFiles, setRefFiles] = useState<File[]>([]);
  const [refDataUrls, setRefDataUrls] = useState<string[]>([]);

  // colors only (kept)
  const [colorPrimary, setColorPrimary] = useState("#0ea5e9");
  const [colorSecondary, setColorSecondary] = useState("#0b74ff");

  // output dimension choice
  const [selectedDimensionId, setSelectedDimensionId] = useState(DIMENSION_OPTIONS[0].id);

  // IndexedDB keys / helpers (same names you had)
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

  // util: convert dataURL -> Blob
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

  // convert blob -> dataURL
  function blobToDataURL(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result));
      fr.onerror = reject;
      fr.readAsDataURL(blob);
    });
  }

  // load onboarding profile (logo_path and ref_images from profiles)
  useEffect(() => {
    (async () => {
      try {
        const { data: userData } = await supabase.auth.getUser();
        const user = (userData as any)?.user;
        if (!user) return; // not signed in; keep going but don't block UI
        const { data, error } = await supabase.from('profiles').select('*').eq('id', user.id).single();
        if (!error && data) {
          setProfile(data);
          // colors defaults if present
          if (data.color_primary) setColorPrimary(data.color_primary);
          if (data.color_secondary) setColorSecondary(data.color_secondary);
          // logo/ref paths -> get public urls
          if (data.logo_path) {
            try {
              const { data: pub } = supabase.storage.from('user-uploads').getPublicUrl(data.logo_path);
              if ((pub as any)?.publicUrl) setLogoPublicUrl((pub as any).publicUrl);
            } catch (e) {
              console.warn('logo public url failed', e);
            }
          }
          if (Array.isArray(data.ref_images) && data.ref_images.length) {
            const arr: string[] = [];
            for (const p of data.ref_images) {
              try {
                const { data: pd } = supabase.storage.from('user-uploads').getPublicUrl(p);
                if ((pd as any)?.publicUrl) arr.push((pd as any).publicUrl);
              } catch (e) {
                console.warn('ref public url failed', e);
              }
            }
            setRefPublicUrls(arr);
          }
        }
      } catch (err) {
        console.warn('profile load failed', err);
      } finally {
        setProfileLoaded(true);
      }
    })();
  }, []);

  // file previews -> set dataURLs
  useEffect(() => {
    if (logoFile) {
      const fr = new FileReader();
      fr.onload = () => setLogoDataUrl(String(fr.result));
      fr.readAsDataURL(logoFile);
    } else {
      setLogoDataUrl(null);
    }
  }, [logoFile]);

  useEffect(() => {
    if (refFiles && refFiles.length > 0) {
      const readers = refFiles.map(f => {
        return new Promise<string>((resolve, reject) => {
          const fr = new FileReader();
          fr.onload = () => resolve(String(fr.result));
          fr.onerror = reject;
          fr.readAsDataURL(f);
        });
      });
      Promise.all(readers).then((res) => setRefDataUrls(res)).catch(e => {
        console.warn('ref file read failed', e);
        setRefDataUrls([]);
      });
    } else {
      setRefDataUrls([]);
    }
  }, [refFiles]);

  const toggleContentType = (t: string) => {
    setContentTypes(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
  };

  // small helper to set preview in session (keeps your original structure)
  function setPreviewInSession(payload: any, apiResponse: APIReturn, imageKey?: string | null) {
    const previewObj: any = {
      inputs: payload,
      output: apiResponse?.copy ?? null,
    };

    if (apiResponse?.image && typeof apiResponse.image === "string" && !apiResponse.image.startsWith("data:")) {
      previewObj.image = apiResponse.image;
      previewObj.images = Array.isArray(apiResponse.images) && apiResponse.images.length ? apiResponse.images : [apiResponse.image];
    } else if (imageKey) {
      previewObj.image = null;
      previewObj.images = [];
      previewObj.imageKey = imageKey;
    } else {
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

  // Canvas resize & center-crop to target width/height, returns dataURL (png)
  async function resizeAndCropDataUrl(sourceDataUrl: string, targetW: number, targetH: number): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const sw = img.naturalWidth, sh = img.naturalHeight;
        const scale = Math.max(targetW / sw, targetH / sh);
        const dw = Math.round(sw * scale), dh = Math.round(sh * scale);
        const offsetX = Math.round((dw - targetW) / 2);
        const offsetY = Math.round((dh - targetH) / 2);

        const tmpCanvas = document.createElement('canvas');
        tmpCanvas.width = targetW;
        tmpCanvas.height = targetH;
        const ctx = tmpCanvas.getContext('2d');
        if (!ctx) return reject(new Error('Canvas not supported'));
        ctx.drawImage(img, -offsetX, -offsetY, dw, dh);
        const outDataUrl = tmpCanvas.toDataURL('image/png');
        resolve(outDataUrl);
      };
      img.onerror = (e) => reject(new Error('Failed to load image for resize'));
      img.src = sourceDataUrl;
    });
  }

  // ---------- generate flow ----------
  const handleGenerate = async () => {
    if (!name || !vision || contentTypes.length === 0) {
      alert("Please fill in Campaign Name, Vision, and pick at least one content type.");
      return;
    }
    setLoading(true);

    const selectedDimension = DIMENSION_OPTIONS.find(d => d.id === selectedDimensionId) || DIMENSION_OPTIONS[0];

    const aiCustomization: any = {
      colorPrimary,
      colorSecondary,
      // include onboarding stored URLs if no upload override
      logoUrl: logoDataUrl ? null : logoPublicUrl ?? null,
      refUrls: refDataUrls.length ? [] : (refPublicUrls && refPublicUrls.length ? refPublicUrls : []),
    };

    const payload: any = {
      name, audience, campaignType, brandVoice, contentTypes, vision,
      mode: "generate",
      aiCustomization,
      target: { id: selectedDimension.id, width: selectedDimension.width, height: selectedDimension.height },
    };

    if (logoDataUrl) payload.logoDataUrl = logoDataUrl;
    if (refDataUrls && refDataUrls.length) payload.refDataUrls = refDataUrls;

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

      // handle remote url or data url similar to previous logic
      if (data.image && typeof data.image === "string" && !data.image.startsWith("data:")) {
        try {
          const fetched = await fetch(data.image);
          if (!fetched.ok) throw new Error(`Failed to fetch returned image: ${fetched.status}`);
          const blob = await fetched.blob();
          const origDataUrl = await blobToDataURL(blob);

          if (selectedDimension.width && selectedDimension.height) {
            const resizedDataUrl = await resizeAndCropDataUrl(origDataUrl, selectedDimension.width, selectedDimension.height);
            const resizedBlob = dataURLtoBlob(resizedDataUrl);
            const imageKey = `preview_image_${Date.now()}`;
            await idbPut(imageKey, resizedBlob);
            setPreviewInSession(payload, { ok: true, copy: data.copy }, imageKey);
            router.push("/create-campaign-preview");
            return;
          } else {
            setPreviewInSession(payload, data, null);
            router.push("/create-campaign-preview");
            return;
          }
        } catch (e) {
          console.warn("Failed to fetch/resize remote image, falling back to public URL session", e);
          setPreviewInSession(payload, data, null);
          router.push("/create-campaign-preview");
          return;
        }
      }

      if (data.image && typeof data.image === "string" && data.image.startsWith("data:")) {
        try {
          let finalDataUrl = data.image;
          if (selectedDimension.width && selectedDimension.height) {
            try {
              finalDataUrl = await resizeAndCropDataUrl(data.image, selectedDimension.width, selectedDimension.height);
            } catch (resizeErr) {
              console.warn("resize failed, using original data URL", resizeErr);
            }
          }

          const blob = dataURLtoBlob(finalDataUrl);
          const imageKey = `preview_image_${Date.now()}`;
          await idbPut(imageKey, blob);
          setPreviewInSession(payload, data, imageKey);
          router.push("/create-campaign-preview");
          return;
        } catch (e) {
          console.error("Failed to store image in IndexedDB:", e);
          setPreviewInSession(payload, data, null);
          router.push("/create-campaign-preview");
          return;
        }
      }

      setPreviewInSession(payload, data, null);
      router.push("/create-campaign-preview");
    } catch (err: any) {
      console.error("Generation failed:", err);
      alert("Generation failed: " + (err.message || String(err)));
    } finally {
      setLoading(false);
    }
  };

  // AI Assist
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
        <p className="text-slate-500 mb-6">Describe your vision and include your brand assets & theme — we'll feed these to the image generator.</p>

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

          {/* AI Customization (colors, logo & refs only) */}
          <div className="bg-white rounded-xl shadow p-6 space-y-4">
            <h3 className="font-semibold">🎨 AI Customization (brand assets & theme)</h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium">Primary color</p>
                <input type="color" value={colorPrimary} onChange={e => setColorPrimary(e.target.value)} className="mt-2 h-10 w-20 p-0 border rounded" />
              </div>
              <div>
                <p className="text-sm font-medium">Secondary color</p>
                <input type="color" value={colorSecondary} onChange={e => setColorSecondary(e.target.value)} className="mt-2 h-10 w-20 p-0 border rounded" />
              </div>
            </div>

            {/* Logo selection / upload */}
            <div>
              <p className="text-sm font-medium">Logo (from onboarding or upload)</p>
              <div className="mt-2 flex items-center gap-3">
                <div className="w-28 h-20 bg-white border rounded flex items-center justify-center overflow-hidden">
                  {logoDataUrl ? (
                    <img src={logoDataUrl} alt="logo-preview" className="w-full h-full object-contain" />
                  ) : logoPublicUrl ? (
                    <img src={logoPublicUrl} alt="logo-public" className="w-full h-full object-contain" />
                  ) : (
                    <div className="text-xs text-slate-400">No logo</div>
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  <input type="file" accept="image/*" onChange={e => setLogoFile(e.target.files ? e.target.files[0] : null)} />
                  <button onClick={() => { setLogoFile(null); setLogoDataUrl(null); }} className="px-2 py-1 border rounded text-sm">Remove Upload</button>
                </div>
              </div>
            </div>

            {/* Reference images */}
            <div>
              <p className="text-sm font-medium">Reference images (from onboarding or upload)</p>
              <div className="mt-2 flex gap-2 items-center overflow-auto">
                {[...refDataUrls, ...refPublicUrls].map((u, i) => (
                  <div key={u + i} className="w-20 h-20 rounded overflow-hidden border">
                    <img src={u} alt={`ref-${i}`} className="w-full h-full object-cover" />
                  </div>
                ))}
                {(!refDataUrls.length && !refPublicUrls.length) && <div className="text-xs text-slate-500">No reference images</div>}
              </div>

              <div className="mt-2">
                <input type="file" accept="image/*" multiple onChange={e => setRefFiles(e.target.files ? Array.from(e.target.files) : [])} />
                <div className="mt-2 text-xs text-slate-500">Upload reference images that the AI should use for style/brand clues.</div>
              </div>
            </div>
          </div>

          {/* Output dimensions */}
          <div className="bg-white rounded-xl shadow p-6 space-y-4">
            <h3 className="font-semibold">🖼️ Output size</h3>
            <div className="flex gap-3 items-center flex-wrap">
              <select value={selectedDimensionId} onChange={e => setSelectedDimensionId(e.target.value)} className="rounded border px-3 py-2">
                {DIMENSION_OPTIONS.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
              </select>
            </div>
            <div className="text-xs text-slate-500">Note: the image generator might return a square; client-side will crop/resize to the selected target ratio for preview/download.</div>
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
