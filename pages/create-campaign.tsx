// pages/create-campaign.tsx
"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "../app/web/src/components/Sidebar";
import { Button } from "../app/web/src/components/ui/button";
import { Card } from "../app/web/src/components/ui/card";
import { Input } from "../app/web/src/components/ui/input";
import { Label } from "../app/web/src/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../app/web/src/components/ui/select";
import { Slider } from "../app/web/src/components/ui/slider";
import { Textarea } from "../app/web/src/components/ui/textarea";
import { Switch } from "../app/web/src/components/ui/switch";
import { Badge } from "../app/web/src/components/ui/badge";
import { Progress } from "../app/web/src/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../app/web/src/components/ui/tooltip";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Upload,
  MapPin,
  MessageCircle,
  Save,
  Rocket,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

// exact colors import path you requested — DO NOT change
import colors from "C:/Users/jpsha/Documents/OPTIM - Copy/demo-repository/lib/colors";

// supabase client for browser usage (assumes you have this export)
import { supabase } from "../lib/supabaseClient";

/* -------------------- color tokens (fallback-safe) -------------------- */
const { primary, primary5 } = (colors as any) || {};
const primaryColor: string | undefined = typeof primary === "string" ? primary : undefined;
const primaryBg5: string | undefined = typeof primary5 === "string" ? primary5 : undefined;

/* -------------------- IndexedDB helpers -------------------- */
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

async function idbPut(key: string, value: Blob | string) {
  const db = await openDb();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const r = store.put(value, key);
    r.onsuccess = () => resolve();
    r.onerror = () => reject(r.error);
    tx.oncomplete = () => db.close();
  });
}

async function idbGet(key: string) {
  const db = await openDb();
  return new Promise<any>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const r = store.get(key);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    tx.oncomplete = () => db.close();
  });
}

function dataURLtoBlob(dataurl: string): Blob {
  const arr = dataurl.split(",");
  const mimeMatch = arr[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : "image/png";
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) u8arr[n] = bstr.charCodeAt(n);
  return new Blob([u8arr], { type: mime });
}

/* helper used when uploading "data:" URLs to Supabase as Files */
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

/* -------------------- mapping helpers for FB Graph API -------------------- */
/**
 * UI objective (free text) -> Graph campaign objective
 * Uses conservative mapping to Graph-supported options.
 */
function mapObjective(uiObjective: string | undefined | null): string {
  if (!uiObjective) return "OUTCOME_TRAFFIC";
  const s = String(uiObjective).trim().toLowerCase();
  if (s.includes("sales") || s.includes("conversion")) return "OUTCOME_SALES";
  if (s.includes("lead")) return "OUTCOME_LEADS";
  if (s.includes("engag")) return "POST_ENGAGEMENT";
  if (s.includes("awareness") || s.includes("brand")) return "OUTCOME_AWARENESS";
  if (s.includes("traffic") || s.includes("link")) return "OUTCOME_TRAFFIC";
  if (s.includes("app")) return "APP_INSTALLS";
  if (s.includes("video")) return "VIDEO_VIEWS";
  if (s.includes("reach")) return "REACH";
  return "OUTCOME_TRAFFIC";
}

/**
 * Campaign objective -> adset optimization_goal (compatible)
 */
function optimizationGoalForObjective(obj: string): string {
  const o = (obj || "").toUpperCase();
  if (o.includes("SALES") || o.includes("CONVERSION") || o === "OUTCOME_SALES") return "OFFSITE_CONVERSIONS";
  if (o.includes("LEAD")) return "LEAD_GENERATION";
  if (o.includes("ENGAGEMENT")) return "POST_ENGAGEMENT";
  if (o.includes("AWARENESS")) return "BRAND_AWARENESS";
  if (o.includes("TRAFFIC") || o === "OUTCOME_TRAFFIC") return "LINK_CLICKS";
  if (o.includes("APP")) return "APP_INSTALLS";
  if (o.includes("VIDEO")) return "VIDEO_VIEWS";
  return "LINK_CLICKS";
}

/* -------------------- prompt builder -------------------- */
function buildPromptClient(adFormData: any) {
  const parts: string[] = [];
  if (adFormData.campaignName) parts.push(`Campaign: ${adFormData.campaignName}`);
  if (adFormData.brandName) parts.push(`Brand: ${adFormData.brandName}`);
  if (adFormData.tagline) parts.push(`Tagline: ${adFormData.tagline}`);
  if (adFormData.description) parts.push(`Description: ${adFormData.description}`);
  if (adFormData.emotion) parts.push(`Vibe: ${adFormData.emotion}`);
  if (adFormData.offerInfo) parts.push(`Offer: ${adFormData.offerInfo}`);
  if (Array.isArray(adFormData.platforms) && adFormData.platforms.length)
    parts.push(`Platforms: ${adFormData.platforms.join(", ")}`);
  parts.push(`Produce a high-quality social media image suitable for 1080x1080. Keep central composition and negative space for headline text. Do not copy copyrighted work.`);
  return parts.join("\n\n");
}

/* -------------------- Component -------------------- */
const CampaignCreate: React.FC = () => {
  const router = useRouter();

  const [mode, setMode] = useState<"ad" | "post">("ad");
  const [step, setStep] = useState<number>(1);
  const totalSteps = mode === "ad" ? 6 : 4;

  type AdState = {
    campaignName: string;
    objective: string;
    platforms: string[];
    campaignType: string;
    brandName: string;
    tagline: string;
    tone: string;
    primaryCTA: string;
    location: string;
    ageRange: [number, number];
    gender: string;
    interests: string;
    autoTarget: boolean;
    budgetType: string;
    budget: number;
    startDate: string;
    endDate: string;
    autoOptimize: boolean;
    description: string;
    emotion: string;
    offerInfo: string;
    multipleVariations: boolean;
    logoPublicUrl: string | null;
    logoDataUrl: string | null;
  };

  const [adFormData, setAdFormData] = useState<AdState>({
    campaignName: "",
    objective: "",
    platforms: [],
    campaignType: "",
    brandName: "",
    tagline: "",
    tone: "",
    primaryCTA: "",
    location: "",
    ageRange: [18, 65],
    gender: "all",
    interests: "",
    autoTarget: true,
    budgetType: "daily",
    budget: 5000,
    startDate: "",
    endDate: "",
    autoOptimize: true,
    description: "",
    emotion: "",
    offerInfo: "",
    multipleVariations: false,
    logoPublicUrl: null,
    logoDataUrl: null,
  });

  type PostState = {
    postName: string;
    platforms: string[];
    postType: string;
    goal: string;
    brandName: string;
    tone: string;
    primaryCTA: string;
    hashtags: string;
    prompt: string;
    generatedCaption: string;
    multipleVersions: boolean;
    logoPublicUrl: string | null;
    logoDataUrl: string | null;
  };

  const [postFormData, setPostFormData] = useState<PostState>({
    postName: "",
    platforms: [],
    postType: "",
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

  const adStepTitles = [
    "Campaign Basics",
    "Brand & Creative Details",
    "Audience Targeting",
    "Budget & Schedule",
    "Creative Direction",
    "Review & Launch",
  ];

  const postStepTitles = ["Post Basics", "Brand & Creative Info", "AI Post Generator", "Review & Publish"];
  const stepTitles = mode === "ad" ? adStepTitles : postStepTitles;
  const progress = (step / totalSteps) * 100;

  // generated image(s) state (we will only use the first for ads)
  const [generating, setGenerating] = useState<boolean>(false);
  const [generatedImages, setGeneratedImages] = useState<string[]>([]); // only first used for ads
  const [generationPrompt, setGenerationPrompt] = useState<string>("");

  // post image generation state
  const [isGeneratingPostImage, setIsGeneratingPostImage] = useState<boolean>(false);
  const [generatedPostImage, setGeneratedPostImage] = useState<string | null>(null);
  const [generatedPostImageKey, setGeneratedPostImageKey] = useState<string | null>(null);
  const [postGenerationPrompt, setPostGenerationPrompt] = useState<string>("");

  const [previewTemplate, setPreviewTemplate] = useState<"insta_feed" | "insta_story" | "facebook_feed" | "youtube_thumb">("insta_feed");

  const [postingNow, setPostingNow] = useState(false);

  // load user profile for autofill
  useEffect(() => {
    (async () => {
      try {
        const { data: userData } = await supabase.auth.getUser();
        const user = (userData as any) && (userData as any).user ? (userData as any).user : null;
        if (!user) return;
        const { data, error } = await supabase.from("profiles").select("*").eq("id", user.id).single();
        if (!error && data) {
          if (data.company_name) {
            setAdFormData((prev) => ({ ...prev, brandName: prev.brandName || data.company_name }));
            setPostFormData((prev) => ({ ...prev, brandName: prev.brandName || data.company_name }));
          }
          if (data.tagline) {
            setAdFormData((prev) => ({ ...prev, tagline: prev.tagline || data.tagline }));
          }
          if (data.logo_path) {
            try {
              const pubRes = supabase.storage.from("user-uploads").getPublicUrl(data.logo_path);
              const pub = (pubRes as any)?.data ?? null;
              const publicUrl = pub && (pub as any).publicUrl ? (pub as any).publicUrl : null;
              if (publicUrl) {
                setAdFormData((prev) => ({ ...prev, logoPublicUrl: prev.logoPublicUrl || publicUrl }));
                setPostFormData((prev) => ({ ...prev, logoPublicUrl: prev.logoPublicUrl || publicUrl }));
              }
            } catch (e) {
              console.warn("logo public url failed", e);
            }
          }
        }
      } catch (e) {
        console.warn("profile load failed", e);
      }
    })();
  }, []);

  // Auth token helper (returns provider token/session token as available)
  async function getAccessToken(): Promise<string | null> {
    try {
      const s = await supabase.auth.getSession();
      const session = (s as any) && (s as any).data ? (s as any).data.session || (s as any).data.session : null;
      if (!session) return null;
      const token = (session as any).access_token || (session as any).accessToken || (session as any).provider_token || null;
      return token || null;
    } catch (e) {
      return null;
    }
  }

  // save draft
  async function saveDraft(payload: any) {
    try {
      const token = await getAccessToken();
      if (!token) {
        toast.error("Not signed in. Please sign in to save drafts.");
        console.error("saveDraft aborted: missing token");
        return null;
      }

      const resp = await fetch("/api/campaigns/save-draft", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const json = await resp.json();
      if (!resp.ok || !json || !json.ok) {
        throw new Error((json && json.error) || `Save draft failed: ${resp.status}`);
      }
      toast.success("Draft saved");
      return json.draft || null;
    } catch (err: any) {
      console.error("saveDraft error", err);
      toast.error("Save failed: " + (err.message || String(err)));
      return null;
    }
  }

  // onClick Save as Draft
  const handleSaveAsDraft = async () => {
    const payload =
      mode === "ad"
        ? { mode: "ad", name: adFormData.campaignName, inputs: adFormData, ...adFormData }
        : { mode: "post", postName: postFormData.postName, inputs: postFormData, ...postFormData };

    if (adFormData.logoDataUrl) payload.logoDataUrl = adFormData.logoDataUrl;
    if (postFormData.logoDataUrl) payload.logoDataUrl = postFormData.logoDataUrl;

    await saveDraft(payload);
  };

  // Called when moving to next step — persist the current full form to server
  const handleNext = async () => {
    try {
      const payload =
        mode === "ad"
          ? {
              mode: "ad",
              name: adFormData.campaignName,
              inputs: adFormData,
              campaignType: adFormData.campaignType,
            }
          : {
              mode: "post",
              postName: postFormData.postName,
              inputs: postFormData,
              postType: postFormData.postType,
            };

      if (adFormData.logoDataUrl) payload.logoDataUrl = adFormData.logoDataUrl;
      if (postFormData.logoDataUrl) payload.logoDataUrl = postFormData.logoDataUrl;

      await saveDraft(payload);
    } catch (e) {
      console.warn("autosave failed", e);
    } finally {
      if (step < totalSteps) setStep(step + 1);
      else {
        if (mode === "ad") {
          // final step handled by Review panel buttons
        } else {
          await handlePublishPost();
        }
      }
    }
  };

  // file->dataURL helper
  const fileToDataUrl = (file: File): Promise<string> =>
    new Promise((res, rej) => {
      const fr = new FileReader();
      fr.onload = () => res(String(fr.result));
      fr.onerror = rej;
      fr.readAsDataURL(file);
    });

  // Logo upload handlers
  const handleAdLogoChange = async (f?: File | null) => {
    if (!f) {
      setAdFormData((p) => ({ ...p, logoDataUrl: null, logoPublicUrl: null }));
      return;
    }
    try {
      const dataUrl = await fileToDataUrl(f);
      setAdFormData((p) => ({ ...p, logoDataUrl: dataUrl }));
    } catch (e) {
      toast.error("Logo read failed");
    }
  };
  const handlePostLogoChange = async (f?: File | null) => {
    if (!f) {
      setPostFormData((p) => ({ ...p, logoDataUrl: null, logoPublicUrl: null }));
      return;
    }
    try {
      const dataUrl = await fileToDataUrl(f);
      setPostFormData((p) => ({ ...p, logoDataUrl: dataUrl }));
    } catch (e) {
      toast.error("Logo read failed");
    }
  };
  const removeAdLogo = () => setAdFormData((p) => ({ ...p, logoPublicUrl: null, logoDataUrl: null }));
  const removePostLogo = () => setPostFormData((p) => ({ ...p, logoPublicUrl: null, logoDataUrl: null }));

  // AI: generate caption / hashtags using your generateCaption endpoint (sends token)
  const generateCaption = async (prompt: string, setResult: (text: string) => void) => {
    try {
      if (!prompt || prompt.trim().length === 0) {
        toast.error("Please provide some text for AI to work with.");
        return;
      }
      const token = await getAccessToken();
      if (!token) {
        toast.error("Not signed in. Please sign in to use AI features.");
        return;
      }

      const resp = await fetch("/api/generateCaption", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ prompt }),
      });
      const json = await resp.json();
      if (!resp.ok || !json) {
        throw new Error((json && json.error) || "AI generation failed");
      }
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

  // Final: call /api/generate-campaign to create AI image & store preview inline (ad flow)
  const handleGenerateCampaign = async (options?: { promptOverride?: string }) => {
    try {
      if (!adFormData.campaignName || !adFormData.description) {
        toast.error("Please fill Campaign Name and Description before generating.");
        return;
      }

      if (!generationPrompt) {
        const p = buildPromptClient(adFormData);
        setGenerationPrompt(p);
      }

      const payload: any = {
        mode: "generate",
        campaignName: adFormData.campaignName,
        objective: adFormData.objective,
        platforms: adFormData.platforms,
        campaignType: adFormData.campaignType,
        brandName: adFormData.brandName,
        tagline: adFormData.tagline,
        tone: adFormData.tone,
        primaryCTA: adFormData.primaryCTA,
        location: adFormData.location,
        ageRange: adFormData.ageRange,
        gender: adFormData.gender,
        interests: adFormData.interests,
        autoTarget: adFormData.autoTarget,
        budgetType: adFormData.budgetType,
        budget: adFormData.budget,
        startDate: adFormData.startDate,
        endDate: adFormData.endDate,
        autoOptimize: adFormData.autoOptimize,
        description: adFormData.description,
        emotion: adFormData.emotion,
        offerInfo: adFormData.offerInfo,
        // send the prompt we're using (editable by user)
        prompt: options?.promptOverride || generationPrompt || buildPromptClient(adFormData),
        target: { id: "insta_feed", width: 1080, height: 1080 },
        aiCustomization: {
          colorPrimary: undefined,
          colorSecondary: undefined,
          logoUrl: adFormData.logoPublicUrl || null,
        },
      };

      if (adFormData.logoDataUrl) payload.logoDataUrl = adFormData.logoDataUrl;

      const token = await getAccessToken();
      if (!token) {
        toast.error("Not signed in. Please sign in to generate images.");
        return;
      }

      setGenerating(true);
      setGeneratedImages([]);

      const resp = await fetch("/api/generate-campaign", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });

      const json = await resp.json();
      if (!resp.ok || !json || !json.ok) {
        throw new Error((json && json.error) || `Generation failed: ${resp.status}`);
      }

      const imgs: string[] = [];
      if (json.image && typeof json.image === "string") imgs.push(json.image);
      if (Array.isArray(json.images) && json.images.length) {
        json.images.forEach((i: any) => {
          if (typeof i === "string") imgs.push(i);
        });
      }

      // Use only first image (per your original ad flow requirement)
      if (imgs.length) {
        setGeneratedImages([imgs[0]]);
        toast.success("Image generated — shown below.");
        try {
          const previewObj = { inputs: payload, image: imgs[0], images: [imgs[0]], output: json.output ?? null };
          sessionStorage.setItem("preview", JSON.stringify(previewObj));
        } catch (e) {
          console.warn("session set failed", e);
        }
      } else {
        toast.error("Generation returned no usable image");
      }
    } catch (err: any) {
      console.error("handleGenerateCampaign error", err);
      toast.error("Generate failed: " + (err.message || String(err)));
    } finally {
      setGenerating(false);
    }
  };

  // --- NEW FUNCTION: generate single image for POST flow (calls /api/generate-campaign-post) ---
  const generatePostImage = async (overridePrompt?: string) => {
    try {
      if (!postFormData.postName && !(postFormData.prompt && postFormData.prompt.trim().length)) {
        toast.error("Set a Post Name or write a prompt before generating.");
        return null;
      }

      const token = await getAccessToken();
      if (!token) {
        toast.error("Sign in to generate images.");
        return null;
      }

      const promptToUse = overridePrompt ?? (postGenerationPrompt || postFormData.prompt || `Create a social post for ${postFormData.postName || "my brand"}`);

      const payload: any = {
        postName: postFormData.postName,
        platforms: postFormData.platforms,
        postType: postFormData.postType,
        goal: postFormData.goal,
        brandName: postFormData.brandName,
        tone: postFormData.tone,
        primaryCTA: postFormData.primaryCTA,
        hashtags: postFormData.hashtags,
        prompt: promptToUse,
        logoDataUrl: postFormData.logoDataUrl ?? null,
        target: { width: 1080, height: 1080 },
        saveTemp: false,
      };

      setIsGeneratingPostImage(true);
      setGeneratedPostImage(null);
      setGeneratedPostImageKey(null);

      const resp = await fetch("/api/generate-campaign-post", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });

      const json = await resp.json();
      if (!resp.ok || !json || !json.ok) {
        throw new Error(json?.error || "Generation failed");
      }

      // Expect exactly one image — prefer savedPublicUrl if provided
      const first = typeof json.image === "string" ? json.image : (Array.isArray(json.images) && json.images.length ? json.images[0] : null);
      if (!first) throw new Error("No image returned");

      // If savedPublicUrl present — we can store that directly in session
      if (json.savedPublicUrl && typeof json.savedPublicUrl === "string") {
        const preview = { inputs: payload, image: json.savedPublicUrl, images: [json.savedPublicUrl], output: json.output ?? null };
        try {
          sessionStorage.setItem("preview", JSON.stringify(preview));
        } catch (e) {
          console.warn("session set failed", e);
        }
        setGeneratedPostImage(json.savedPublicUrl);
        toast.success("Generated (public URL).");
        return json.savedPublicUrl;
      }

      // If image is data: URL, store blob in IDB and place pointer into sessionStorage
      if (first.startsWith("data:")) {
        try {
          const blob = dataURLtoBlob(first);
          const key = `post_preview_${Date.now()}`;
          await idbPut(key, blob);
          const preview = { inputs: payload, imageKey: key, images: [], output: json.output ?? null };
          try {
            sessionStorage.setItem("preview", JSON.stringify(preview));
          } catch (e) {
            console.warn("session set failed", e);
          }
          setGeneratedPostImage(first);
          setGeneratedPostImageKey(key);
          toast.success("Generated and stored locally (IndexedDB).");
          return first;
        } catch (e) {
          console.warn("idb put failed, falling back to session dataUrl", e);
          // fallback: put dataUrl directly in session (could hit quota)
          const preview = { inputs: payload, image: first, images: [first], output: json.output ?? null };
          try {
            sessionStorage.setItem("preview", JSON.stringify(preview));
          } catch (e2) {
            console.warn("session set failed", e2);
          }
          setGeneratedPostImage(first);
          setGeneratedPostImageKey(null);
          toast.warning("Generated but failed to persist in IndexedDB; preview stored in session.");
          return first;
        }
      }

      // else it's a public URL
      const preview = { inputs: payload, image: first, images: [first], output: json.output ?? null };
      try {
        sessionStorage.setItem("preview", JSON.stringify(preview));
      } catch (e) {
        console.warn("session set failed", e);
      }
      setGeneratedPostImage(first);
      toast.success("Generated image ready.");
      return first;
    } catch (err: any) {
      console.error("generatePostImage error", err);
      toast.error("Generate failed: " + (err?.message ?? String(err)));
      return null;
    } finally {
      setIsGeneratingPostImage(false);
    }
  };

  // Download or open generated post image
  const downloadGeneratedPostImage = async () => {
    try {
      if (!generatedPostImage) return toast.error("No generated image to download");
      if (generatedPostImage.startsWith("data:")) {
        const blob = dataURLtoBlob(generatedPostImage);
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `post_generated_${Date.now()}.png`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        toast.success("Downloaded image");
        return;
      }
      // public url - open in new tab / let user save
      window.open(generatedPostImage, "_blank", "noopener,noreferrer");
    } catch (e) {
      console.error("downloadGeneratedPostImage error", e);
      toast.error("Download failed");
    }
  };

  // navigate to finalize — create-campaign-finalize reads sessionStorage.preview
  const goToFinalize = () => {
    const raw = sessionStorage.getItem("preview");
    if (!raw) {
      toast.error("No preview saved. Generate an image first.");
      return;
    }
    router.push("/create-campaign-finalize");
  };

  /* -------------------- Supabase upload helper for FB creative fallback -------------------- */
  const uploadFileToSupabase = async (file: File, filenamePrefix = "fb_upload") => {
    const { data: userData } = await supabase.auth.getUser();
    const user = (userData as any)?.user;
    const safeName = ((adFormData.campaignName || "campaign") + "").replace(/[^a-z0-9_\-]/gi, "_").toLowerCase();
    const filename = `${user?.id || "anon"}_${Date.now()}_${filenamePrefix}_${safeName}.png`;
    const path = `campaigns/${user?.id || "anon"}/${filename}`;

    const { error: uploadError } = await supabase.storage.from("campaign-assets").upload(path, file, {
      cacheControl: "3600",
      upsert: true,
    });

    if (uploadError) {
      console.error("Supabase upload error", uploadError);
      throw uploadError;
    }

    const { data: publicData } = supabase.storage.from("campaign-assets").getPublicUrl(path);
    const publicUrl = (publicData as any)?.publicUrl ?? null;
    if (!publicUrl) throw new Error("Failed to get public URL after upload");
    return publicUrl;
  };

  /* -------------------- POST AD TO FACEBOOK (client) --------------------
   * - Prepares payload using current adFormData + generated image (first).
   * - Uploads data: images to Supabase if necessary.
   * - Calls /api/auth/facebook/ads with token.
   * - On success, shows toast + redirect to /dashboard.
   * - Logs entire request/response to console for debugging.
   * ----------------------------------------------------------------- */
  const postAdToFacebook = async () => {
    setPostingNow(true);
    try {
      // required checks
      if (!adFormData.campaignName || !adFormData.budget) {
        toast.error("Campaign name and budget required.");
        setPostingNow(false);
        return;
      }

      // map objective -> Graph API objective
      const mappedObjective = mapObjective(adFormData.objective);
      const optimizationGoal = optimizationGoalForObjective(mappedObjective);

      // prepare base payload
      const body: any = {
        campaignName: adFormData.campaignName,
        adSetName: `${adFormData.campaignName || "Campaign"} - AdSet`,
        budget: Number(adFormData.budget) || 0,
        budgetType: adFormData.budgetType || "daily",
        startDate: adFormData.startDate || undefined,
        endDate: adFormData.endDate || undefined,
        campaignType: adFormData.campaignType,
        brandName: adFormData.brandName,
        tagline: adFormData.tagline,
        tone: adFormData.tone,
        primaryCTA: adFormData.primaryCTA,
        location: adFormData.location,
        ageRange: adFormData.ageRange,
        gender: adFormData.gender,
        interests: adFormData.interests,
        autoTarget: adFormData.autoTarget,
        autoOptimize: adFormData.autoOptimize,
        objective: mappedObjective,
        optimization_goal: optimizationGoal,
      };

      // Validate numeric budget
      const budgetNumber = Number(body.budget);
      if (!Number.isFinite(budgetNumber) || budgetNumber <= 0) {
        toast.error("Invalid budget value.");
        setPostingNow(false);
        return;
      }
      // convert to minor units (e.g., INR -> paise). Adjust multiplier per your account currency
      const budgetMultiplier = 100;
      body.budgetMinor = Math.round(budgetNumber * budgetMultiplier);

      // Validate and normalize dates
      if (body.startDate) {
        const start = new Date(body.startDate);
        if (isNaN(start.getTime())) {
          toast.error("Invalid start date format.");
          setPostingNow(false);
          return;
        }
        if (start.getTime() < Date.now() - 60 * 1000) {
          // remove start if in past (prevents Graph rejection)
          delete body.startDate;
        } else {
          body.startDateISO = start.toISOString();
        }
      }
      if (body.endDate) {
        const end = new Date(body.endDate);
        if (isNaN(end.getTime())) {
          toast.error("Invalid end date format.");
          setPostingNow(false);
          return;
        }
        body.endDateISO = end.toISOString();
      }

      // Build targeting
      let finalTargeting: any = null;
      if (adFormData.autoTarget) {
        finalTargeting = { geo_locations: { countries: ["IN"] }, age_min: 18, age_max: 65 };
      } else {
        finalTargeting = {};
        if (adFormData.location) {
          const loc = String(adFormData.location || "").trim();
          if (/^[A-Z]{2}$/i.test(loc)) {
            finalTargeting.geo_locations = { countries: [loc.toUpperCase()] };
          } else {
            finalTargeting.geo_locations = { countries: ["IN"] };
          }
        } else {
          finalTargeting.geo_locations = { countries: ["IN"] };
        }
        if (Array.isArray(adFormData.ageRange) && adFormData.ageRange.length === 2) {
          finalTargeting.age_min = Number(adFormData.ageRange[0]);
          finalTargeting.age_max = Number(adFormData.ageRange[1]);
        } else {
          finalTargeting.age_min = 18;
          finalTargeting.age_max = 65;
        }
        if (adFormData.gender && String(adFormData.gender).toLowerCase() !== "all") {
          const g = String(adFormData.gender).toLowerCase();
          finalTargeting.genders = g === "male" ? [1] : g === "female" ? [2] : [];
        }
        if (adFormData.interests) {
          finalTargeting.flexible_spec = [{ interests: [{ id: null, name: String(adFormData.interests) }] }];
        }
      }
      body.targeting = finalTargeting;

      // Determine creative image public URL (prefer generatedImages[0] or generatedPostImage)
      let creativePublicUrl: string | null = null;
      if (generatedImages && generatedImages.length) {
        const cand = generatedImages[0];
        if (cand && !cand.startsWith("data:")) creativePublicUrl = cand;
      }
      if (!creativePublicUrl && generatedPostImage && !generatedPostImage.startsWith("data:")) creativePublicUrl = generatedPostImage;

      // fallback: check session preview
      if (!creativePublicUrl) {
        try {
          const raw = sessionStorage.getItem("preview");
          if (raw) {
            const preview = JSON.parse(raw);
            if (preview.image && typeof preview.image === "string" && !preview.image.startsWith("data:")) creativePublicUrl = preview.image;
            else if (Array.isArray(preview.images) && preview.images.length && typeof preview.images[0] === "string" && !preview.images[0].startsWith("data:")) creativePublicUrl = preview.images[0];
          }
        } catch (e) {
          console.warn("session preview read failed", e);
        }
      }

      // If creative is data: URL, upload to supabase to get public URL
      if (!creativePublicUrl) {
        if (generatedPostImage && generatedPostImage.startsWith("data:")) {
          const blob = dataURLtoBlob(generatedPostImage);
          const file = new File([blob], `fb_${Date.now()}.png`, { type: blob.type || "image/png" });
          try {
            creativePublicUrl = await uploadFileToSupabase(file, "fb_image");
          } catch (e) {
            console.error("upload generatedPostImage failed", e);
            toast.error("Upload failed — can't prepare creative for Facebook.");
            setPostingNow(false);
            return;
          }
        } else if (generatedImages && generatedImages.length && generatedImages[0].startsWith("data:")) {
          const blob = dataURLtoBlob(generatedImages[0]);
          const file = new File([blob], `fb_${Date.now()}.png`, { type: blob.type || "image/png" });
          try {
            creativePublicUrl = await uploadFileToSupabase(file, "fb_image");
          } catch (e) {
            console.error("upload generatedImages[0] failed", e);
            toast.error("Upload failed — can't prepare creative for Facebook.");
            setPostingNow(false);
            return;
          }
        }
      }

      // IDB fallback
      if (!creativePublicUrl) {
        try {
          const raw = sessionStorage.getItem("preview");
          if (raw) {
            const preview = JSON.parse(raw);
            if (preview.imageKey) {
              const stored = await idbGet(preview.imageKey);
              if (stored instanceof Blob) {
                const file = new File([stored], `fb_${Date.now()}.png`, { type: stored.type || "image/png" });
                creativePublicUrl = await uploadFileToSupabase(file, "fb_image");
              } else if (typeof stored === "string") {
                if (stored.startsWith("data:")) {
                  const file = dataURLtoFile(stored, `fb_${Date.now()}.png`);
                  creativePublicUrl = await uploadFileToSupabase(file, "fb_image");
                } else {
                  creativePublicUrl = stored;
                }
              }
            }
          }
        } catch (e) {
          console.warn("IDB read/upload fallback failed", e);
        }
      }

      if (!creativePublicUrl) {
        toast.error("No public creative image available. Generate an image or ensure it's uploaded publicly.");
        setPostingNow(false);
        return;
      }

      body.creativeImageUrl = creativePublicUrl;
      body.creativeCaption = adFormData.tagline || adFormData.description || "";

      // final debug
      console.debug("[postAdToFacebook] final payload:", body);

      const token = await getAccessToken();
      if (!token) {
        toast.error("You must be signed in to run ads.");
        setPostingNow(false);
        return;
      }

      // Call server endpoint (your pages/api/auth/facebook/ads.ts)
      let resp: Response;
      try {
        resp = await fetch("/api/auth/facebook/ads", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(body),
        });
      } catch (networkErr) {
        console.error("Network error calling /api/auth/facebook/ads", networkErr);
        toast.error("Network error contacting server — check server is running and reachable.");
        setPostingNow(false);
        return;
      }

      let json: any = null;
      try {
        json = await resp.json();
      } catch (e) {
        console.error("Failed to parse JSON from /api/auth/facebook/ads", e);
      }

      if (!resp.ok) {
        console.error("facebook ads endpoint returned error", json);
        const message = (json && (json.error?.message || json.error || JSON.stringify(json))) || `HTTP ${resp.status}`;
        toast.error("Facebook ad failed: " + message);
        setPostingNow(false);
        return;
      }

      // success
      console.debug("[postAdToFacebook] success response:", json);
      toast.success("Facebook ad created successfully. Redirecting to dashboard...");
      try {
        sessionStorage.removeItem("preview");
      } catch (e) {}
      setTimeout(() => router.push("/dashboard"), 900);
    } catch (err: any) {
      console.error("postAdToFacebook error", err);
      toast.error("Post to Facebook failed: " + (err?.message || String(err)));
    } finally {
      setPostingNow(false);
    }
  };

  // publish campaign only (save record)
  const publishCampaignOnly = async () => {
    try {
      const payload = { mode: "ad", name: adFormData.campaignName, inputs: adFormData, output: { images: generatedImages } };
      const saved = await saveDraft(payload);
      if (!saved) {
        toast.error("Save failed.");
        return;
      }
      toast.success("Campaign published (saved). Redirecting to dashboard...");
      try {
        sessionStorage.removeItem("preview");
      } catch (e) {}
      setTimeout(() => router.push("/dashboard"), 900);
    } catch (e: any) {
      console.error("publishCampaignOnly error", e);
      toast.error("Publish failed: " + (e?.message || String(e)));
    }
  };

  /* --------------------
     NEW: Unified publish/post logic (from create-campaign-post)
     - ensures sign-in
     - ensures image to publish
     - uploads to Supabase 'campaign-assets'
     - inserts campaigns row
     - optionally posts to Instagram / Facebook
  --------------------- */
  const handlePublishPost = async () => {
    let postingNowLocal = false;
    try {
      if (!postFormData.postName || postFormData.platforms.length === 0) {
        toast.error("Please set Post Name and pick at least one platform.");
        return;
      }

      // Ensure we have an image; if not, try to generate one first
      let imageToPublish = generatedPostImage;
      if (!imageToPublish) {
        const gen = await generatePostImage(postGenerationPrompt || undefined);
        imageToPublish = gen || generatedPostImage;
        if (!imageToPublish) {
          toast.error("Failed to generate image for publishing.");
          return;
        }
      }

      postingNowLocal = true;
      // ensure user logged in
      const { data: userData } = await supabase.auth.getUser();
      const user = (userData as any)?.user;
      if (!user) {
        toast.error("You must be signed in to publish a post.");
        router.push("/auth/signin");
        return;
      }

      // Upload the image to Supabase 'campaign-assets'
      const image_url: string[] = [];
      const image_path: string[] = [];

      // single image case — build filename & path
      const safeName = (postFormData.postName || "post").replace(/[^a-z0-9_\-]/gi, "_").toLowerCase();
      const filename = `${user.id}_${Date.now()}_1_${safeName}.png`;
      const path = `campaigns/${user.id}/${filename}`;

      let fileToUpload: File | null = null;

      if (typeof imageToPublish === "string" && imageToPublish.startsWith("data:")) {
        fileToUpload = dataURLtoFile(imageToPublish, filename);
      } else if (typeof imageToPublish === "string" && (imageToPublish.startsWith("http") || imageToPublish.startsWith("blob:"))) {
        // public url or blob url - fetch
        const resp = await fetch(imageToPublish);
        if (!resp.ok) {
          throw new Error(`Failed to fetch image for upload: ${resp.status} ${resp.statusText}`);
        }
        const blob = await resp.blob();
        fileToUpload = new File([blob], filename, { type: blob.type || "image/png" });
      } else if (generatedPostImageKey) {
        // read from IDB
        try {
          const stored = await idbGet(generatedPostImageKey);
          if (stored instanceof Blob) {
            fileToUpload = new File([stored], filename, { type: stored.type || "image/png" });
          } else if (typeof stored === "string" && stored.startsWith("data:")) {
            fileToUpload = dataURLtoFile(stored, filename);
          } else if (typeof stored === "string") {
            // maybe a public url string
            const resp2 = await fetch(stored);
            if (!resp2.ok) throw new Error(`Failed to fetch stored image: ${resp2.status}`);
            const blob2 = await resp2.blob();
            fileToUpload = new File([blob2], filename, { type: blob2.type || "image/png" });
          }
        } catch (e) {
          console.warn("read idb failed", e);
        }
      }

      if (!fileToUpload) {
        // fallback: if imageToPublish is a public url, we won't upload file but will store url directly
        if (typeof imageToPublish === "string" && imageToPublish.startsWith("http")) {
          image_url.push(imageToPublish);
          image_path.push(""); // no path
        } else {
          throw new Error("Could not obtain a file to upload for the image.");
        }
      } else {
        const { error: uploadError } = await supabase.storage
          .from("campaign-assets")
          .upload(path, fileToUpload, { cacheControl: "3600", upsert: false });

        if (uploadError) {
          console.error("Upload error", uploadError);
          throw uploadError;
        }

        const { data: publicData } = supabase.storage.from("campaign-assets").getPublicUrl(path);
        const publicUrl = (publicData as any)?.publicUrl;
        if (!publicUrl) throw new Error("Could not obtain public URL for uploaded image.");
        image_url.push(publicUrl);
        image_path.push(path);
      }

      // insert campaign row
      const payload = {
        user_id: user.id,
        name: postFormData.postName || null,
        audience: null,
        campaign_type: "post",
        brand_voice: postFormData.tone || null,
        content_types: [postFormData.postType || "image"],
        vision: postFormData.prompt || null,
        output: { caption: postFormData.generatedCaption || null } || null,
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

      // posting: prefer Instagram endpoint (it supports cross-post to Facebook)
      const doPostToInstagram = postFormData.platforms.includes("Instagram");
      const doCrosspostToFacebook = postFormData.platforms.includes("Facebook");

      const postResults: Array<{ image: string; result: any; error?: string }> = [];

      if (doPostToInstagram) {
        const caption = postFormData.generatedCaption || postFormData.postName || "";

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
            postResults.push({ image: image_url[i], result: null, error: (err && err.message) || String(err) });
          }
        }
      } else if (!doPostToInstagram && doCrosspostToFacebook) {
        // Facebook-only: best-effort call to a facebook post endpoint if exists
        // backend should accept { image_url, caption }
        const caption = postFormData.generatedCaption || postFormData.postName || "";
        for (let i = 0; i < image_url.length; i++) {
          const imgUrl = image_url[i];
          try {
            const resp = await fetch("/api/auth/facebook/post", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ image_url: imgUrl, caption }),
            });
            const json = await resp.json();
            if (!resp.ok) {
              postResults.push({ image: imgUrl, result: json, error: json?.error || `HTTP ${resp.status}` });
            } else {
              postResults.push({ image: imgUrl, result: json });
            }
          } catch (err: any) {
            console.error("Post to Facebook failed", err);
            postResults.push({ image: image_url[i], result: null, error: (err && err.message) || String(err) });
          }
        }
      }

      // finalize
      try {
        sessionStorage.removeItem("preview");
      } catch (e) {
        /* ignore */
      }

      let finalMsg = "Post published successfully!";
      if (postResults.length) {
        const failures = postResults.filter((r) => r.error);
        if (failures.length === 0) {
          finalMsg += " Social posting succeeded.";
          toast.success(finalMsg);
        } else {
          finalMsg += ` Social posting had ${failures.length} failure(s). Check console.`;
          toast.error(finalMsg);
          console.warn("Post Results:", postResults);
        }
      } else {
        // no posting attempted (image URL saved but no platform endpoint called) — still treat as success of saving & uploading
        toast.success(finalMsg);
      }

      // Always redirect to /dashboard after post flow (per request)
      router.push("/dashboard");
    } catch (err: any) {
      console.error("handlePublishPost error", err);
      toast.error("Publish failed: " + (err?.message || String(err)));
      // still redirect to dashboard so user can continue (optional)
      try {
        router.push("/dashboard");
      } catch (e) {
        /* ignore */
      }
    } finally {
      postingNowLocal = false;
    }
  };

  // Publish Post: legacy /api/publish flow (kept for compatibility)
  const publishPost = async () => {
    try {
      if (!postFormData.postName || postFormData.platforms.length === 0) {
        toast.error("Please set Post Name and pick at least one platform.");
        return;
      }

      // Ensure we have an image; if not, try to generate one first
      let imageToPublish = generatedPostImage;
      if (!imageToPublish) {
        const gen = await generatePostImage(postGenerationPrompt || undefined);
        imageToPublish = gen || generatedPostImage;
        if (!imageToPublish) {
          toast.error("Failed to generate image for publishing.");
          return;
        }
      }

      const token = await getAccessToken();
      if (!token) {
        toast.error("Sign in to publish.");
        return;
      }

      // Build a FormData which allows file upload or URL
      const form = new FormData();
      form.append("postName", postFormData.postName);
      form.append("platforms", JSON.stringify(postFormData.platforms));
      form.append("postType", postFormData.postType || "image");
      form.append("goal", postFormData.goal || "");
      form.append("brandName", postFormData.brandName || "");
      form.append("caption", postFormData.generatedCaption || "");
      form.append("hashtags", postFormData.hashtags || "");

      // If image is a data: URL, convert to Blob and append as file
      if (imageToPublish.startsWith("data:")) {
        const blob = dataURLtoBlob(imageToPublish);
        form.append("image", blob, `post_${Date.now()}.png`);
      } else if (generatedPostImageKey) {
        // attempt to read from IDB
        try {
          const stored = await idbGet(generatedPostImageKey);
          if (stored instanceof Blob) {
            form.append("image", stored, `post_${Date.now()}.png`);
          } else if (typeof stored === "string") {
            // fallback string (data url)
            if (stored.startsWith("data:")) {
              const blob = dataURLtoBlob(stored);
              form.append("image", blob, `post_${Date.now()}.png`);
            } else {
              form.append("imageUrl", stored);
            }
          } else {
            form.append("imageUrl", imageToPublish);
          }
        } catch (e) {
          console.warn("read idb failed", e);
          form.append("imageUrl", imageToPublish);
        }
      } else {
        // public url
        form.append("imageUrl", imageToPublish);
      }

      // attach platform-specific brief metadata
      form.append("selectedPlatforms", JSON.stringify(postFormData.platforms));

      // send to unified publish endpoint — backend should handle per-platform posting using stored credentials
      const resp = await fetch("/api/publish", {
        method: "POST",
        headers: { Authorization: `Bearer ${await getAccessToken()}` },
        body: form,
      });

      const json = await resp.json();
      if (!resp.ok) {
        throw new Error((json && json.error) || JSON.stringify(json));
      }

      toast.success("Post published (or queued) to selected platforms.");
      console.log("publish response", json);

      // optionally: save as draft / record
      try {
        await fetch("/api/campaigns/save-draft", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${await getAccessToken()}` },
          body: JSON.stringify({ mode: "post", postName: postFormData.postName, inputs: postFormData, publishedTo: postFormData.platforms }),
        });
      } catch (e) {
        /* ignore save-fail */
      }

      // Redirect to dashboard after publish
      router.push("/dashboard");
    } catch (err: any) {
      console.error("publishPost error", err);
      toast.error("Publish failed: " + (err?.message || String(err)));
      try {
        router.push("/dashboard");
      } catch (e) { /* ignore */ }
    }
  };

  const handleGenerateHashtags = async () => {
    await generateCaption(postFormData.prompt || postFormData.postName || "Create hashtags", (text) => {
      const matches = (text || "").match(/#[\w-]+/g);
      if (matches && matches.length) {
        setPostFormData((p) => ({ ...p, hashtags: matches.join(" ") }));
      } else {
        setPostFormData((p) => ({ ...p, hashtags: text }));
      }
    });
  };

  const handleGeneratePostCaption = async () => {
    await generateCaption(postFormData.prompt || postFormData.postName || "Create caption", (text) => {
      setPostFormData((p) => ({ ...p, generatedCaption: text }));
    });
  };

  /* -------------------- UI (kept intact with requested small edits) -------------------- */

  return (
    <div className="min-h-screen flex bg-slate-50">
      <Sidebar />

      <div className="flex-1">
        <div className="sticky top-0 z-50 backdrop-blur-xl bg-background/80 border-b border-border/50">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between mb-4">
              <h1
                className="text-2xl font-bold"
                style={
                  primaryColor
                    ? { backgroundImage: `linear-gradient(90deg, ${primaryColor}, ${primaryColor}99)`, WebkitBackgroundClip: "text", color: "transparent" }
                    : undefined
                }
              >
                Create Campaign
              </h1>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Save className="h-4 w-4" />
                  <span>Draft Saved</span>
                </div>
              </div>
            </div>

            <div className="flex justify-center mb-6">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="glass-card p-1.5 rounded-full inline-flex gap-1">
                      <button
                        onClick={() => {
                          setMode("ad");
                          setStep(1);
                          setGenerationPrompt("");
                          setGeneratedImages([]);
                        }}
                        className={`relative px-6 py-2.5 rounded-full font-medium text-sm transition-all duration-300 flex items-center gap-2 ${
                          mode === "ad" ? "bg-gradient-to-r from-primary to-secondary text-primary-foreground shadow-lg" : "text-muted-foreground hover:text-foreground"
                        }`}
                        style={mode === "ad" && primaryColor ? { boxShadow: `0 6px 18px ${primaryColor}22` } : undefined}
                      >
                        <Rocket className="h-4 w-4" />
                        Ad Generation
                      </button>

                      <button
                        onClick={() => {
                          setMode("post");
                          setStep(1);
                          setGenerationPrompt("");
                          setGeneratedImages([]);
                        }}
                        className={`relative px-6 py-2.5 rounded-full font-medium text-sm transition-all duration-300 flex items-center gap-2 ${
                          mode === "post" ? "bg-gradient-to-r from-primary to-secondary text-primary-foreground shadow-lg" : "text-muted-foreground hover:text-foreground"
                        }`}
                        style={mode === "post" && primaryColor ? { boxShadow: `0 6px 18px ${primaryColor}22` } : undefined}
                      >
                        <Sparkles className="h-4 w-4" />
                        Post Generation
                      </button>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Switch between paid ad setup and organic post creation</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  Step {step} of {totalSteps}: {stepTitles[step - 1]}
                </span>
                <span className="text-muted-foreground">{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Form Section */}
            <div className="lg:col-span-2">
              <Card className="glass-card p-8 rounded-2xl border-border/50">
                {mode === "ad" ? (
                  <>
                    {/* AD flow — steps 1..6 */}
                    {step === 1 && (
                      <div className="space-y-6">
                        <div>
                          <Label htmlFor="campaignName">Campaign Name</Label>
                          <Input
                            id="campaignName"
                            placeholder="Diwali Sale 2025"
                            value={adFormData.campaignName}
                            onChange={(e) => setAdFormData({ ...adFormData, campaignName: e.target.value })}
                            className="mt-2"
                          />
                        </div>

                        <div>
                          <Label>Objective</Label>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-2">
                            {["Sales", "Traffic", "Engagement", "Awareness", "App Installs", "Custom"].map((obj) => (
                              <Button
                                key={obj}
                                variant={adFormData.objective === obj ? "default" : "outline"}
                                onClick={() => setAdFormData({ ...adFormData, objective: obj })}
                                className="justify-start"
                              >
                                {obj}
                              </Button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <Label>Platform Selection</Label>
                          <div className="flex flex-wrap gap-2 mt-2">
                            {["Facebook", "Instagram"].map((platform) => (
                              <Badge
                                key={platform}
                                variant={adFormData.platforms.includes(platform) ? "default" : "outline"}
                                className="cursor-pointer px-4 py-2"
                                onClick={() => {
                                  const newPlatforms = adFormData.platforms.includes(platform)
                                    ? adFormData.platforms.filter((p) => p !== platform)
                                    : [...adFormData.platforms, platform];
                                  setAdFormData({ ...adFormData, platforms: newPlatforms });
                                }}
                              >
                                {platform}
                              </Badge>
                            ))}
                          </div>
                        </div>

                        <div>
                          <Label htmlFor="campaignType">Campaign Type</Label>
                          <Select
                            value={adFormData.campaignType}
                            onValueChange={(value) => setAdFormData({ ...adFormData, campaignType: value })}
                          >
                            <SelectTrigger className="mt-2">
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="single">Single Product</SelectItem>
                              <SelectItem value="multi">Multi-Product</SelectItem>
                              <SelectItem value="event">Event</SelectItem>
                              <SelectItem value="brand">Brand Promo</SelectItem>
                              <SelectItem value="announcement">Announcement</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    )}

                    {step === 2 && (
                      <div className="space-y-6">
                        <div>
                          <Label htmlFor="brandName">Brand Name</Label>
                          <Input
                            id="brandName"
                            placeholder="Your Brand"
                            value={adFormData.brandName}
                            onChange={(e) => setAdFormData({ ...adFormData, brandName: e.target.value })}
                            className="mt-2"
                          />
                        </div>

                        <div>
                          <Label>Logo Upload (Optional)</Label>
                          <div className="mt-2">
                            <div className="mt-2 border-2 border-dashed border-border rounded-xl p-6 text-center hover:border-primary/50 transition-colors cursor-pointer">
                              <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                              <p className="text-sm text-muted-foreground">Click to upload or drag and drop</p>
                              <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => {
                                  const f = e.target.files ? e.target.files[0] : null;
                                  if (f) handleAdLogoChange(f);
                                }}
                                className="mt-3"
                              />
                            </div>

                            <div className="mt-3 flex items-center gap-3">
                              <div className="w-28 h-20 bg-white border rounded flex items-center justify-center overflow-hidden">
                                {adFormData.logoDataUrl ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={adFormData.logoDataUrl} alt="logo" className="w-full h-full object-contain" />
                                ) : adFormData.logoPublicUrl ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={adFormData.logoPublicUrl} alt="logo" className="w-full h-full object-contain" />
                                ) : (
                                  <div className="text-xs text-slate-400">No logo</div>
                                )}
                              </div>
                              <div>
                                <button
                                  onClick={() => {
                                    handleAdLogoChange(null);
                                  }}
                                  className="px-2 py-1 border rounded text-sm mr-2"
                                >
                                  Remove Upload
                                </button>
                                <button
                                  onClick={() => removeAdLogo()}
                                  className="px-2 py-1 border rounded text-sm"
                                >
                                  Remove Stored Logo
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div>
                          <Label htmlFor="tagline">Tagline</Label>
                          <Input
                            id="tagline"
                            placeholder="Luxury that feels local."
                            value={adFormData.tagline}
                            onChange={(e) => setAdFormData({ ...adFormData, tagline: e.target.value })}
                            className="mt-2"
                          />
                        </div>

                        <div>
                          <Label htmlFor="tone">Tone of Voice</Label>
                          <Select value={adFormData.tone} onValueChange={(value) => setAdFormData({ ...adFormData, tone: value })}>
                            <SelectTrigger className="mt-2">
                              <SelectValue placeholder="Select tone" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="friendly">Friendly</SelectItem>
                              <SelectItem value="bold">Bold</SelectItem>
                              <SelectItem value="professional">Professional</SelectItem>
                              <SelectItem value="playful">Playful</SelectItem>
                              <SelectItem value="luxury">Luxury</SelectItem>
                              <SelectItem value="genz">Gen Z</SelectItem>
                              <SelectItem value="minimal">Minimal</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <Label htmlFor="primaryCTA">Primary CTA</Label>
                          <Select value={adFormData.primaryCTA} onValueChange={(value) => setAdFormData({ ...adFormData, primaryCTA: value })}>
                            <SelectTrigger className="mt-2">
                              <SelectValue placeholder="Select CTA" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="shop">Shop Now</SelectItem>
                              <SelectItem value="learn">Learn More</SelectItem>
                              <SelectItem value="book">Book Now</SelectItem>
                              <SelectItem value="signup">Sign Up</SelectItem>
                              <SelectItem value="contact">Contact Us</SelectItem>
                              <SelectItem value="custom">Custom</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    )}

                    {step === 3 && (
                      <div className="space-y-6">
                        <div className="flex items-center justify-between">
                          <Label>Let AI Auto-Target Audience</Label>
                          <Switch
                            checked={adFormData.autoTarget}
                            onCheckedChange={(checked) => setAdFormData({ ...adFormData, autoTarget: checked })}
                          />
                        </div>

                        {!adFormData.autoTarget && (
                          <>
                            <div>
                              <Label htmlFor="location">Location</Label>
                              <div className="relative mt-2">
                                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                  id="location"
                                  placeholder="City, State, or Country"
                                  value={adFormData.location}
                                  onChange={(e) => setAdFormData({ ...adFormData, location: e.target.value })}
                                  className="pl-10"
                                />
                              </div>
                            </div>

                            <div>
                              <Label>
                                Age Range: {adFormData.ageRange[0]} - {adFormData.ageRange[1]}
                              </Label>
                              <Slider
                                value={adFormData.ageRange}
                                onValueChange={(value) => setAdFormData({ ...adFormData, ageRange: value as [number, number] })}
                                min={18}
                                max={65}
                                step={1}
                                className="mt-4"
                              />
                            </div>

                            <div>
                              <Label>Gender</Label>
                              <div className="flex gap-2 mt-2">
                                {["All", "Male", "Female", "Custom"].map((g) => (
                                  <Button
                                    key={g}
                                    variant={adFormData.gender === g.toLowerCase() ? "default" : "outline"}
                                    onClick={() => setAdFormData({ ...adFormData, gender: g.toLowerCase() })}
                                    size="sm"
                                  >
                                    {g}
                                  </Button>
                                ))}
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    )}

                    {step === 4 && (
                      <div className="space-y-6">
                        <div>
                          <Label>Budget Type</Label>
                          <div className="flex gap-4 mt-2">
                            {["daily", "lifetime"].map((type) => (
                              <Button
                                key={type}
                                variant={adFormData.budgetType === type ? "default" : "outline"}
                                onClick={() => setAdFormData({ ...adFormData, budgetType: type })}
                                className="flex-1 capitalize"
                              >
                                {type}
                              </Button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <Label>Budget: ₹{adFormData.budget.toLocaleString()}</Label>
                          <Slider
                            value={[adFormData.budget]}
                            onValueChange={(value) => setAdFormData({ ...adFormData, budget: value[0] })}
                            min={500}
                            max={500000}
                            step={500}
                            className="mt-4"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="startDate">Start Date</Label>
                            <Input
                              id="startDate"
                              type="date"
                              value={adFormData.startDate}
                              onChange={(e) => setAdFormData({ ...adFormData, startDate: e.target.value })}
                              className="mt-2"
                            />
                          </div>
                          <div>
                            <Label htmlFor="endDate">End Date</Label>
                            <Input
                              id="endDate"
                              type="date"
                              value={adFormData.endDate}
                              onChange={(e) => setAdFormData({ ...adFormData, endDate: e.target.value })}
                              className="mt-2"
                            />
                          </div>
                        </div>

                        <div className="flex items-center justify-between">
                          <Label>Auto-optimize Spend</Label>
                          <Switch
                            checked={adFormData.autoOptimize}
                            onCheckedChange={(checked) => setAdFormData({ ...adFormData, autoOptimize: checked })}
                          />
                        </div>
                      </div>
                    )}

                    {step === 5 && (
                      <div className="space-y-6">
                        <div>
                          <Label htmlFor="description">Campaign Description</Label>
                          <Textarea
                            id="description"
                            placeholder="Promoting our Diwali discounts on home decor products in Chennai."
                            value={adFormData.description}
                            onChange={(e) => setAdFormData({ ...adFormData, description: e.target.value })}
                            rows={4}
                            className="mt-2"
                          />
                        </div>

                        <div>
                          <Button
                            variant="outline"
                            onClick={() =>
                              generateCaption(adFormData.description || adFormData.campaignName || "Write a campaign description", (text) => {
                                setAdFormData((p) => ({ ...p, description: text }));
                              })
                            }
                          >
                            <Sparkles className="h-4 w-4 mr-2" />
                            AI Assist Description
                          </Button>
                        </div>

                        <div>
                          <Label htmlFor="emotion">Emotion / Vibe</Label>
                          <Select value={adFormData.emotion} onValueChange={(value) => setAdFormData({ ...adFormData, emotion: value })}>
                            <SelectTrigger className="mt-2">
                              <SelectValue placeholder="Select emotion" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="festive">Festive</SelectItem>
                              <SelectItem value="aspirational">Aspirational</SelectItem>
                              <SelectItem value="witty">Witty</SelectItem>
                              <SelectItem value="premium">Premium</SelectItem>
                              <SelectItem value="casual">Casual</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <Label htmlFor="offerInfo">Offer Info</Label>
                          <Input
                            id="offerInfo"
                            placeholder="Use code DIWALI20 for 20% off"
                            value={adFormData.offerInfo}
                            onChange={(e) => setAdFormData({ ...adFormData, offerInfo: e.target.value })}
                            className="mt-2"
                          />
                        </div>

                        <div className="flex items-center justify-between">
                          <Label>Generate Multiple Variations</Label>
                          <Switch
                            checked={adFormData.multipleVariations}
                            onCheckedChange={(checked) => setAdFormData({ ...adFormData, multipleVariations: checked })}
                          />
                        </div>
                      </div>
                    )}

                    {step === 6 && (
                      <div className="space-y-6">
                        <div className="p-6 bg-muted/50 rounded-xl space-y-4">
                          <h3 className="font-semibold text-lg">Campaign Summary</h3>
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="text-muted-foreground">Campaign:</span>
                              <p className="font-medium">{adFormData.campaignName || "Untitled"}</p>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Objective:</span>
                              <p className="font-medium">{adFormData.objective || "Not set"}</p>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Platforms:</span>
                              <p className="font-medium">{adFormData.platforms.join(", ") || "None"}</p>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Budget:</span>
                              <p className="font-medium">
                                ₹{adFormData.budget.toLocaleString()} / {adFormData.budgetType}
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="p-6 bg-primary/5 rounded-xl border border-primary/20">
                          <h4 className="font-semibold mb-3">Post Preview & Launch</h4>

                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label>Editable Image Prompt</Label>
                              <Textarea
                                rows={6}
                                value={generationPrompt || buildPromptClient(adFormData)}
                                onChange={(e) => setGenerationPrompt(e.target.value)}
                                className="mt-2"
                              />
                              <div className="flex gap-2 mt-2">
                                <Button onClick={async () => { if (!generationPrompt) setGenerationPrompt(buildPromptClient(adFormData)); await handleGenerateCampaign(); }} disabled={generating}>
                                  {generating ? "Generating..." : "Generate & Preview"}
                                </Button>
                                <Button variant="outline" onClick={() => { handleGenerateCampaign({ promptOverride: generationPrompt || buildPromptClient(adFormData) }); }}>
                                  Regenerate
                                </Button>
                                <Button onClick={() => { const p = buildPromptClient(adFormData); setGenerationPrompt(p); toast.success("Prompt reset to auto-generated version"); }}>
                                  Reset Prompt
                                </Button>
                              </div>
                            </div>

                            <div>
                              <Label>Generated Image (single)</Label>
                              <div className="mt-2 border rounded bg-white p-3">
                                {generatedImages.length === 0 ? (
                                  <div className="text-sm text-muted-foreground">No image generated — click Generate & Preview above to create.</div>
                                ) : (
                                  <>
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={generatedImages[0]} alt="generated" className="w-full h-64 object-contain rounded" />
                                    <div className="mt-3 flex gap-2">
                                      <Button onClick={async () => {
                                        try {
                                          if (generatedImages[0].startsWith("data:")) {
                                            const blob = dataURLtoBlob(generatedImages[0]);
                                            const key = `generated_${Date.now()}`;
                                            await idbPut(key, blob);
                                            toast.success("Saved generated image to IndexedDB (preview key).");
                                          } else {
                                            const a = document.createElement("a");
                                            a.href = generatedImages[0];
                                            a.download = `generated_${Date.now()}.png`;
                                            document.body.appendChild(a);
                                            a.click();
                                            a.remove();
                                          }
                                        } catch (e) {
                                          console.warn("save image failed", e);
                                          toast.error("Save failed");
                                        }
                                      }}>Download</Button>
                                      <Button variant="outline" onClick={() => publishCampaignOnly()}>Publish Campaign</Button>
                                      <Button onClick={() => postAdToFacebook()} disabled={postingNow}>
                                        {postingNow ? "Posting…" : "Post Ad in Facebook"}
                                      </Button>
                                    </div>
                                    <div className="text-xs text-muted-foreground mt-2">Posting results and debug will appear in console; you'll be redirected to /dashboard on success.</div>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    {/* POST GENERATION FLOW (steps 1..4) */}
                    {step === 1 && (
                      <div className="space-y-6">
                        <div>
                          <Label htmlFor="postName">Post Name</Label>
                          <Input
                            id="postName"
                            placeholder="Summer Collection Launch"
                            value={postFormData.postName}
                            onChange={(e) => setPostFormData({ ...postFormData, postName: e.target.value })}
                            className="mt-2"
                          />
                        </div>

                        <div>
                          <Label>Platform Selection</Label>
                          <div className="flex flex-wrap gap-2 mt-2">
                            {["Instagram", "Facebook"].map((platform) => (
                              <Badge
                                key={platform}
                                variant={postFormData.platforms.includes(platform) ? "default" : "outline"}
                                className="cursor-pointer px-4 py-2"
                                onClick={() => {
                                  const newPlatforms = postFormData.platforms.includes(platform)
                                    ? postFormData.platforms.filter((p) => p !== platform)
                                    : [...postFormData.platforms, platform];
                                  setPostFormData({ ...postFormData, platforms: newPlatforms });
                                }}
                              >
                                {platform}
                              </Badge>
                            ))}
                          </div>
                        </div>

                        <div>
                          <Label htmlFor="postType">Post Type</Label>
                          <Select value={postFormData.postType} onValueChange={(value) => setPostFormData({ ...postFormData, postType: value })}>
                            <SelectTrigger className="mt-2">
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="image">Image</SelectItem>
                              <SelectItem value="carousel">Carousel</SelectItem>
                              <SelectItem value="video">Video</SelectItem>
                              <SelectItem value="story">Story</SelectItem>
                              <SelectItem value="text">Text</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <Label htmlFor="goal">Goal</Label>
                          <Select value={postFormData.goal} onValueChange={(value) => setPostFormData({ ...postFormData, goal: value })}>
                            <SelectTrigger className="mt-2">
                              <SelectValue placeholder="Select goal" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="engagement">Engagement</SelectItem>
                              <SelectItem value="awareness">Awareness</SelectItem>
                              <SelectItem value="announcement">Announcement</SelectItem>
                              <SelectItem value="product">Product Highlight</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <Label>Upload Assets (Optional)</Label>
                          <div className="mt-2 border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-primary/50 transition-colors cursor-pointer">
                            <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                            <p className="text-sm text-muted-foreground">Click to upload images or videos</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {step === 2 && (
                      <div className="space-y-6">
                        <div>
                          <Label htmlFor="brandName">Brand Name</Label>
                          <Input id="brandName" placeholder="Your Brand" value={postFormData.brandName} onChange={(e) => setPostFormData({ ...postFormData, brandName: e.target.value })} className="mt-2" />
                        </div>

                        <div>
                          <Label>Logo (Optional)</Label>
                          <div className="mt-2 border-2 border-dashed border-border rounded-xl p-6 text-center hover:border-primary/50 transition-colors cursor-pointer">
                            <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                            <p className="text-sm text-muted-foreground">Upload your logo</p>
                            <input
                              type="file"
                              accept="image/*"
                              onChange={(e) => {
                                const f = e.target.files ? e.target.files[0] : null;
                                if (f) handlePostLogoChange(f);
                              }}
                              className="mt-3"
                            />
                          </div>

                          <div className="mt-3 flex items-center gap-3">
                            <div className="w-28 h-20 bg-white border rounded flex items-center justify-center overflow-hidden">
                              {postFormData.logoDataUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={postFormData.logoDataUrl} alt="logo" className="w-full h-full object-contain" />
                              ) : postFormData.logoPublicUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={postFormData.logoPublicUrl} alt="logo" className="w-full h-full object-contain" />
                              ) : (
                                <div className="text-xs text-slate-400">No logo</div>
                              )}
                            </div>
                            <div>
                              <button onClick={() => handlePostLogoChange(null)} className="px-2 py-1 border rounded text-sm mr-2">
                                Remove Upload
                              </button>
                              <button onClick={() => removePostLogo()} className="px-2 py-1 border rounded text-sm">
                                Remove Stored Logo
                              </button>
                            </div>
                          </div>
                        </div>

                        <div>
                          <Label htmlFor="tone">Tone of Voice</Label>
                          <Select value={postFormData.tone} onValueChange={(value) => setPostFormData({ ...postFormData, tone: value })}>
                            <SelectTrigger className="mt-2">
                              <SelectValue placeholder="Select tone" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="friendly">Friendly</SelectItem>
                              <SelectItem value="bold">Bold</SelectItem>
                              <SelectItem value="playful">Playful</SelectItem>
                              <SelectItem value="minimal">Minimal</SelectItem>
                              <SelectItem value="luxury">Luxury</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <Label htmlFor="primaryCTA">Primary CTA (Optional)</Label>
                          <Input id="primaryCTA" placeholder="Shop Now, Learn More, etc." value={postFormData.primaryCTA} onChange={(e) => setPostFormData({ ...postFormData, primaryCTA: e.target.value })} className="mt-2" />
                        </div>

                        <div>
                          <Label htmlFor="hashtags">Hashtag Suggestions</Label>
                          <div className="flex gap-2 mt-2">
                            <Input id="hashtags" placeholder="#fashion #style #trending" value={postFormData.hashtags} onChange={(e) => setPostFormData({ ...postFormData, hashtags: e.target.value })} />
                            <Button variant="outline" onClick={handleGenerateHashtags}>
                              <Sparkles className="h-4 w-4 mr-2" />
                              AI Generate
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}

                    {step === 3 && (
                      <div className="space-y-6">
                        <div>
                          <Label htmlFor="prompt">Describe your post or campaign idea</Label>
                          <Textarea
                            id="prompt"
                            placeholder="Create an engaging post about our new summer collection launch. Focus on vibrant colors and beach vibes..."
                            value={postFormData.prompt}
                            onChange={(e) => setPostFormData({ ...postFormData, prompt: e.target.value })}
                            rows={6}
                            className="mt-2"
                          />
                        </div>

                        <div className="flex items-center justify-between">
                          <Label>Generate multiple versions</Label>
                          <Switch checked={postFormData.multipleVersions} onCheckedChange={(checked) => setPostFormData({ ...postFormData, multipleVersions: checked })} />
                        </div>

                        <div className="p-6 bg-muted/50 rounded-xl">
                          <h4 className="font-semibold mb-3">AI Generated Caption Preview</h4>
                          <div className="space-y-3">
                            <p className="text-sm text-muted-foreground">{postFormData.generatedCaption || "Your AI-generated caption will appear here after generation..."}</p>
                          </div>
                        </div>

                        <Button className="w-full" size="lg" onClick={handleGeneratePostCaption}>
                          <Sparkles className="h-5 w-5 mr-2" />
                          Generate Post Caption
                        </Button>
                      </div>
                    )}

                    {step === 4 && (
                      <div className="space-y-6">
                        <div className="p-6 bg-muted/50 rounded-xl space-y-4">
                          <h3 className="font-semibold text-lg">Post Summary</h3>
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="text-muted-foreground">Post Name:</span>
                              <p className="font-medium">{postFormData.postName || "Untitled"}</p>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Platforms:</span>
                              <p className="font-medium">{postFormData.platforms.join(", ") || "None"}</p>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Post Type:</span>
                              <p className="font-medium">{postFormData.postType || "Not set"}</p>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Goal:</span>
                              <p className="font-medium">{postFormData.goal || "Not set"}</p>
                            </div>
                          </div>
                        </div>

                        {/* NEW: Post Review & Generate area */}
                        <div className="p-6 bg-primary/5 rounded-xl border border-primary/20">
                          <h4 className="font-semibold mb-3">Post Preview & Publish</h4>

                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <Label>Editable Image Prompt</Label>
                              <Textarea
                                rows={6}
                                value={postGenerationPrompt || postFormData.prompt || `Create a social post for ${postFormData.postName || "my brand"}`}
                                onChange={(e) => setPostGenerationPrompt(e.target.value)}
                                className="mt-2"
                              />
                              <div className="flex gap-2 mt-2">
                                <Button onClick={() => { setPostGenerationPrompt(postFormData.prompt || `Create a social post for ${postFormData.postName || "my brand"}`); toast.success("Prompt initialized"); }}>
                                  Init Prompt
                                </Button>
                                <Button onClick={() => generatePostImage(postGenerationPrompt || undefined)} disabled={isGeneratingPostImage}>
                                  {isGeneratingPostImage ? "Generating…" : "Generate & Review"}
                                </Button>
                                <Button variant="outline" onClick={() => { setPostGenerationPrompt(""); setGeneratedPostImage(null); setGeneratedPostImageKey(null); try { sessionStorage.removeItem("preview"); } catch (e) { } }}>
                                  Clear
                                </Button>
                              </div>
                            </div>

                            <div>
                              <Label>Generated Image (single)</Label>
                              <div className="mt-2 border rounded bg-white p-3">
                                {isGeneratingPostImage ? (
                                  <div>Generating image…</div>
                                ) : generatedPostImage ? (
                                  <>
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={generatedPostImage} alt="generated-post" className="w-full h-64 object-contain rounded" />
                                    <div className="mt-3 flex gap-2">
                                      <Button onClick={downloadGeneratedPostImage}>Download</Button>
                                      <Button variant="outline" onClick={goToFinalize}>Finalize & Publish</Button>
                                    </div>
                                    <div className="text-xs text-muted-foreground mt-2">Stored: {generatedPostImageKey ? "IndexedDB (local preview)" : (generatedPostImage.startsWith("data:") ? "session (dataURL)" : "public URL")}</div>
                                  </>
                                ) : (
                                  <div className="text-sm text-muted-foreground">No image generated — click Generate & Review to create one image inline.</div>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="mt-4 flex gap-2">
                            <Button variant="outline" onClick={() => saveDraft({ mode: "post", postName: postFormData.postName, inputs: postFormData })}>Save Template</Button>
                            <Button onClick={() => { if (!generatedPostImage) generatePostImage(); else handlePublishPost(); }} className="ml-auto">
                              {generatedPostImage ? "Publish & Post" : "Generate & Publish"}
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </Card>
            </div>

            {/* Live Preview Panel - show ONLY on final step */}
            <div className="lg:col-span-1">
              {step === totalSteps ? (
                <Card className="glass-card p-6 rounded-2xl border-border/50 sticky top-32">
                  <h3 className="font-semibold mb-4">Live Preview</h3>
                  <div className="space-y-4">
                    <div className="aspect-square bg-gradient-to-br from-primary/20 to-secondary/20 rounded-xl flex items-center justify-center">
                      <p className="text-sm text-muted-foreground">{mode === "ad" ? "Ad" : "Post"} Preview</p>
                    </div>
                    <div className="space-y-2 text-sm">
                      {mode === "ad" ? (
                        <>
                          <div className="flex justify-between"><span className="text-muted-foreground">Campaign:</span><span className="font-medium">{adFormData.campaignName || "—"}</span></div>
                          <div className="flex justify-between"><span className="text-muted-foreground">Platforms:</span><span className="font-medium">{adFormData.platforms.length || 0}</span></div>
                          <div className="flex justify-between"><span className="text-muted-foreground">Budget:</span><span className="font-medium">₹{adFormData.budget.toLocaleString()}</span></div>
                        </>
                      ) : (
                        <>
                          <div className="flex justify-between"><span className="text-muted-foreground">Post:</span><span className="font-medium">{postFormData.postName || "—"}</span></div>
                          <div className="flex justify-between"><span className="text-muted-foreground">Platforms:</span><span className="font-medium">{postFormData.platforms.length || 0}</span></div>
                          <div className="flex justify-between"><span className="text-muted-foreground">Type:</span><span className="font-medium">{postFormData.postType || "—"}</span></div>
                        </>
                      )}
                    </div>
                  </div>
                </Card>
              ) : null}
            </div>
          </div>
        </div>

        {/* Sticky Bottom Navigation */}
        <div className="sticky bottom-0 z-50 backdrop-blur-xl bg-background/80 border-t border-border/50">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <Button variant="ghost" onClick={() => (step > 1 ? setStep(step - 1) : router.push("/campaigns"))} size="lg">
                <ArrowLeft className="mr-2 h-5 w-5" />
                {step === 1 ? "Cancel" : "Back"}
              </Button>

              <div className="flex gap-3">
                <Button variant="outline" size="lg" onClick={handleSaveAsDraft}>
                  Save as Draft
                </Button>
                {step < totalSteps ? (
                  <Button onClick={handleNext} size="lg" className="min-w-[140px]">
                    Next
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                ) : (
                  <Button
                    onClick={() => {
                      if (mode === "ad") {
                        toast("Use the Publish Campaign or Post Ad in Facebook buttons in the Review panel");
                      } else {
                        if (generatedPostImage) handlePublishPost();
                        else generatePostImage();
                      }
                    }}
                    size="lg"
                    className="min-w-[140px]"
                  >
                    <CheckCircle2 className="mr-2 h-5 w-5" />
                    {mode === "ad" ? "Review & Launch" : (generatedPostImage ? "Publish & Post" : "Generate & Publish")}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Floating AI Help */}
        <button className="fixed bottom-24 right-8 w-14 h-14 bg-gradient-to-r from-primary to-secondary rounded-full shadow-lg flex items-center justify-center hover:scale-110 transition-transform z-50" aria-label="AI help">
          <MessageCircle className="h-6 w-6 text-primary-foreground" />
        </button>
      </div>
    </div>
  );
};

export default CampaignCreate;
