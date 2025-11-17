"use client";

// pages/create-campaign.tsx
// Supabase-only persistence: chats in user_chats, generated images in campaign-assets + user_generated_image.
// Logo & reference images are uploaded to the same path style as onboardingInfo:
//   user-uploads/{USER_ID}/{optional-folder}/{filename}

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import Sidebar from "../app/web/src/components/Sidebar";
import NavBar from "../app/web/src/components/navBar";
import { Button } from "../app/web/src/components/ui/button";
import { Input } from "../app/web/src/components/ui/input";
import { Label } from "../app/web/src/components/ui/label";
import { Textarea } from "../app/web/src/components/ui/textarea";
import { Badge } from "../app/web/src/components/ui/badge";
import { Card } from "../app/web/src/components/ui/card";
import { Separator } from "../app/web/src/components/ui/separator";
import {
  Plus,
  Send,
  Mic,
  Sparkles,
  Copy,
  Download,
  Image as ImageIcon,
  Palette,
  LayoutTemplate,
  Smile,
  Users,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import colors from "../lib/colors";
import { supabase } from "../lib/supabaseClient";

/* -------------------- Mic Recorder -------------------- */
type MicRecorderProps = {
  onText: (chunk: string) => void;
  lang?: string;
  className?: string;
  small?: boolean;
};

const MicRecorder: React.FC<MicRecorderProps> = ({
  onText,
  lang = "ta-IN",
  className,
  small,
}) => {
  const [recording, setRecording] = useState(false);
  const recognitionRef = useRef<any>(null);
  const supported =
    typeof window !== "undefined" && (window as any).webkitSpeechRecognition;

  const start = () => {
    if (!supported) {
      toast.error("Speech recognition not supported in this browser.");
      return;
    }
    try {
      const Rec = (window as any).webkitSpeechRecognition;
      const rec = new Rec();
      rec.lang = lang;
      rec.interimResults = true;
      rec.continuous = true;

      rec.onresult = (e: any) => {
        let finalText = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const r = e.results[i];
          if (r.isFinal) {
            finalText += r[0].transcript;
          }
        }
        if (finalText.trim().length) {
          onText(finalText.trim());
        }
      };
      rec.onerror = (err: any) => {
        console.warn("speech error", err);
        toast.error("Mic error — check permissions.");
        setRecording(false);
        try {
          rec.stop();
        } catch {}
      };
      rec.onend = () => {
        setRecording(false);
      };
      recognitionRef.current = rec;
      rec.start();
      setRecording(true);
      toast.success("Listening… speak in Tamil");
    } catch (e) {
      console.warn("speech start failed", e);
      toast.error("Could not start mic.");
      setRecording(false);
    }
  };

  const stop = () => {
    try {
      recognitionRef.current?.stop?.();
    } catch {}
    setRecording(false);
  };

  return (
    <Button
      type="button"
      variant={recording ? "destructive" : "outline"}
      onClick={recording ? stop : start}
      className={className}
      size={small ? "sm" : "default"}
      title="Speak in Tamil — will be transcribed to text"
    >
      {recording ? (
        <>
          <X className="h-4 w-4 mr-2" />
          Stop
        </>
      ) : (
        <>
          <Mic className="h-4 w-4 mr-2" />
          Mic (TA)
        </>
      )}
    </Button>
  );
};

/* -------------------- Types -------------------- */
type Chat = {
  id: string;
  title: string | null;
  messages: any[];
  createdAt: number | null;
  updatedAt: number | null;
};

/* -------------------- Helpers -------------------- */
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

const isProbablyUUID = (s?: string | null) => {
  if (!s) return false;
  return /^[0-9a-fA-F]{8}\-[0-9a-fA-F]{4}\-[0-9a-fA-F]{4}\-[0-9a-fA-F]{4}\-[0-9a-fA-F]{12}$/.test(
    s
  );
};

async function getCurrentUser() {
  const { data } = await supabase.auth.getUser();
  return (data as any)?.user ?? null;
}

/* -------------------- Storage + DB helpers -------------------- */

/**
 * Upload a data URL or remote image to Supabase storage and insert row into user_generated_image.
 * Returns { publicUrl, path, row }.
 */
async function uploadAndRecordGeneratedImage(
  imageUrl: string,
  filenamePrefix = "generated"
) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error("Not authenticated");

    let uploadedPath = "";
    let publicUrl = imageUrl;

    if (imageUrl.startsWith("data:")) {
      // upload data url
      const blob = dataURLtoBlob(imageUrl);
      const safeName = `${user.id}_${Date.now()}_${filenamePrefix
        .replace(/[^a-z0-9_\-]/gi, "_")
        .toLowerCase()}.png`;
      const path = `campaigns/${user.id}/${safeName}`;
      const { error } = await supabase.storage
        .from("campaign-assets")
        .upload(path, blob, { cacheControl: "3600", upsert: true });
      if (!error) {
        uploadedPath = path;
        const { data: publicData } = supabase.storage
          .from("campaign-assets")
          .getPublicUrl(path);
        publicUrl = (publicData as any)?.publicUrl ?? publicUrl;
      } else {
        console.warn("storage upload error (dataUrl)", error);
      }
    } else {
      // try fetching remote and re-upload (may fail due to CORS)
      try {
        const fetched = await fetch(imageUrl);
        if (fetched.ok) {
          const blob = await fetched.blob();
          const ext = (blob.type || "png").split("/").pop() ?? "png";
          const safeName = `${user.id}_${Date.now()}_${filenamePrefix
            .replace(/[^a-z0-9_\-]/gi, "_")
            .toLowerCase()}.${ext}`;
          const path = `campaigns/${user.id}/${safeName}`;
          const { error } = await supabase.storage
            .from("campaign-assets")
            .upload(path, blob, { cacheControl: "3600", upsert: true });
          if (!error) {
            uploadedPath = path;
            const { data: publicData } = supabase.storage
              .from("campaign-assets")
              .getPublicUrl(path);
            publicUrl = (publicData as any)?.publicUrl ?? publicUrl;
          } else {
            console.warn("storage upload error (fetch)", error);
          }
        }
      } catch (e) {
        console.warn("fetch+reupload failed (CORS?) — keeping original url", e);
      }
    }

    // insert row into user_generated_image
    try {
      const payload = {
        user_id: user.id,
        image_url: publicUrl,
        image_path: uploadedPath || null,
        source: "generated",
        metadata: {},
      };
      const { data, error } = await supabase
        .from("user_generated_image")
        .insert([payload])
        .select()
        .single();
      if (error) {
        console.warn("insert user_generated_image failed", error);
      }
      return { publicUrl, path: uploadedPath, row: data };
    } catch (e) {
      console.warn("record generated image failed", e);
      return { publicUrl, path: uploadedPath, row: null };
    }
  } catch (e) {
    console.error("uploadAndRecordGeneratedImage failed", e);
    throw e;
  }
}

/** fetch recent generated images for signed-in user */
async function fetchRecentGeneratedImages(limit = 20) {
  try {
    const user = await getCurrentUser();
    if (!user) return [];
    const { data, error } = await supabase
      .from("user_generated_image")
      .select("image_url, image_path, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) {
      console.warn("fetchRecentGeneratedImages error", error);
      return [];
    }
    return (data || []).map((r: any) => r.image_url).filter(Boolean);
  } catch (e) {
    console.warn("fetchRecentGeneratedImages failed", e);
    return [];
  }
}

/* -------------------- Chat server helpers -------------------- */
async function fetchChatsFromServer() {
  try {
    const user = await getCurrentUser();
    if (!user) return [];
    const { data, error } = await supabase
      .from("user_chats")
      .select("id, title, messages, created_at, updated_at")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });
    if (error) {
      console.warn("fetchChatsFromServer error", error);
      return [];
    }
    const mapped: Chat[] = (data || []).map((r: any) => ({
      id: r.id,
      title: r.title || "Chat",
      messages: Array.isArray(r.messages) ? r.messages : [],
      createdAt: r.created_at ? new Date(r.created_at).getTime() : null,
      updatedAt: r.updated_at ? new Date(r.updated_at).getTime() : null,
    }));
    return mapped;
  } catch (e) {
    console.warn("fetchChatsFromServer failed", e);
    return [];
  }
}

async function createChatOnServer(title = "New Chat") {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");
  const payload = {
    user_id: user.id,
    title: title || "New Chat",
    messages: [],
    consent_for_training: false,
    client_version: "client-1",
  };
  const { data, error } = await supabase
    .from("user_chats")
    .insert([payload])
    .select()
    .single();
  if (error) throw error;
  return {
    id: data.id,
    title: data.title || "New Chat",
    messages: Array.isArray(data.messages) ? data.messages : [],
    createdAt: data.created_at ? new Date(data.created_at).getTime() : null,
    updatedAt: data.updated_at ? new Date(data.updated_at).getTime() : null,
  } as Chat;
}

async function updateChatMessagesOnServer(
  chatId: string,
  messagesPayload: any[]
) {
  try {
    if (!isProbablyUUID(chatId)) throw new Error("invalid chat id");
    const { error } = await supabase
      .from("user_chats")
      .update({ messages: messagesPayload })
      .eq("id", chatId);
    if (error) throw error;
    return true;
  } catch (e) {
    console.warn("updateChatMessagesOnServer failed", e);
    return false;
  }
}

async function renameChatOnServer(chatId: string, newTitle: string) {
  try {
    if (!isProbablyUUID(chatId)) throw new Error("invalid chat id");
    const { error } = await supabase
      .from("user_chats")
      .update({ title: newTitle })
      .eq("id", chatId);
    if (error) throw error;
    return true;
  } catch (e) {
    console.warn("renameChatOnServer failed", e);
    return false;
  }
}

async function deleteChatOnServer(chatId: string) {
  try {
    if (!isProbablyUUID(chatId)) throw new Error("invalid chat id");
    const { error } = await supabase
      .from("user_chats")
      .delete()
      .eq("id", chatId);
    if (error) throw error;
    return true;
  } catch (e) {
    console.warn("deleteChatOnServer failed", e);
    return false;
  }
}

/* -------------------- Profile upload helpers (user-uploads) -------------------- */
/**
 * Upload to user-uploads bucket while ensuring the path begins with userId as the first path segment.
 * folderPrefix is appended AFTER the userId (so final path looks like: `${userId}/${folderPrefix? + '/' : ''}${safe}`)
 * This matches onboardingInfo behavior.
 */
async function uploadFileToUserUploads(file: File, folderPrefix = "") {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not authenticated");
  const safe = `${user.id}_${Date.now()}_${file.name.replace(/\s+/g, "_")}`;
  const sanitizedPrefix = folderPrefix
    ? String(folderPrefix).replace(/^\/|\/$/g, "")
    : "";
  const path = `${user.id}/${
    sanitizedPrefix ? sanitizedPrefix + "/" : ""
  }${safe}`;
  const { error } = await supabase.storage
    .from("user-uploads")
    .upload(path, file, { cacheControl: "3600", upsert: true });
  if (error) {
    console.warn("uploadFileToUserUploads error", error);
    throw error;
  }
  const { data } = supabase.storage.from("user-uploads").getPublicUrl(path);
  const publicUrl = (data as any)?.publicUrl ?? null;
  return { path, publicUrl };
}

async function addReferenceImagesToProfile(urls: string[]) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error("Not authenticated");
    // fetch existing ref_images
    const { data: profile } = await supabase
      .from("profiles")
      .select("ref_images")
      .eq("id", user.id)
      .single();
    const existing: string[] = (profile as any)?.ref_images || [];
    const merged = Array.from(new Set([...existing, ...urls]));
    // <-- FIX: removed invalid `returning` option
    await supabase.from("profiles").upsert({ id: user.id, ref_images: merged });
    return merged;
  } catch (e) {
    console.warn("addReferenceImagesToProfile failed", e);
    throw e;
  }
}

async function removeReferenceImageFromProfile(url: string) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error("Not authenticated");
    const { data: profile } = await supabase
      .from("profiles")
      .select("ref_images")
      .eq("id", user.id)
      .single();
    const existing: string[] = (profile as any)?.ref_images || [];
    const next = existing.filter((x: string) => x !== url);
    // <-- FIX: removed invalid `returning` option
    await supabase.from("profiles").upsert({ id: user.id, ref_images: next });
    return next;
  } catch (e) {
    console.warn("removeReferenceImageFromProfile failed", e);
    throw e;
  }
}

/* -------------------- Component -------------------- */
const CampaignCreate: React.FC = () => {
  const router = useRouter();

  const [credits, setCredits] = useState<number>(10);
  const useCredit = () => {
    if (credits <= 0) return false;
    setCredits((c) => c - 1);
    return true;
  };

  const [chats, setChats] = useState<Chat[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]);

  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const [uploadedPreviews, setUploadedPreviews] = useState<string[]>([]);
  const [logoPublicUrl, setLogoPublicUrl] = useState<string | null>(null);

  // renamed `prompt` -> `inputText`
  const [inputText, setInputText] = useState("");

  const [isGenerating, setIsGenerating] = useState(false);
  const [showUploadPanel, setShowUploadPanel] = useState(false);
  const [showPublishPanel, setShowPublishPanel] = useState(false);
  const [publishMode, setPublishMode] = useState<"post" | "ad">("post");

  const [uploadedImages, setUploadedImages] = useState<File[]>([]);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoGlowing, setLogoGlowing] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const [quickSettings, setQuickSettings] = useState({
    logoEnabled: false,
    themeEnabled: false,
    aspectRatio: "1:1",
    tone: "playful", // default changed from "professional" to "playful" per request
    audience: "",
  });

  const [aspectChosen, setAspectChosen] = useState(false); // new: tracks if aspect was selected by user

  const [showThemeOptions, setShowThemeOptions] = useState(false);
  const [showAspectOptions, setShowAspectOptions] = useState(false);

  const [adFormData, setAdFormData] = useState<any>({
    campaignName: "",
    objective: "LINK_CLICKS",
    platforms: [],
    campaignType: "",
    brandName: "",
    tagline: "",
    tone: "",
    primaryCTA: "LEARN_MORE",
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
    adSetName: "",
    destinationLink: "",
    delivery: "",
    duration: 7,
  });

  const [postFormData, setPostFormData] = useState<any>({
    postName: "",
    platforms: [],
    postType: "image",
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

  const [pendingGeneratedImage, setPendingGeneratedImage] = useState<
    string | null
  >(null);

  // portal host reference for sidebar
  const [sidebarHost, setSidebarHost] = useState<HTMLElement | null>(null);
  const [sidebarRight, setSidebarRight] = useState<number>(0);

  // store previous sidebar styles so we can restore
  const sidebarPrevStylesRef = useRef<{
    boxShadow?: string;
    filter?: string;
    position?: string;
    border?: string;
    height?: string;
    overflowY?: string;
    top?: string;
    left?: string;
    zIndex?: string;
  } | null>(null);

  // user/profile name (for greeting)
  const [profileFullName, setProfileFullName] = useState<string | null>(null);

  // platform error state for publish panel
  const [platformError, setPlatformError] = useState<string | null>(null);

  // textarea autosize
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const resizeTextarea = () => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    const max = 220; // max height in px
    const newH = Math.min(ta.scrollHeight, max);
    ta.style.height = `${newH}px`;
  };

  useEffect(() => {
    resizeTextarea();
  }, [inputText]);

  /* -------------------- Initial load -------------------- */
  useEffect(() => {
    (async () => {
      try {
        const user = await getCurrentUser();
        if (!user) {
          toast.error("Sign in to persist chats to Supabase");
          return;
        }

        // profile
        try {
          const { data: profile, error: pErr } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", user.id)
            .single();
          if (!pErr && profile) {
            // set readable profile name for greeting
            const nameSource =
              (profile.full_name && String(profile.full_name).trim()) ||
              (user.email ? user.email.split("@")[0] : null);
            setProfileFullName(nameSource);

            if (profile.tagline) {
              setAdFormData((p: any) => ({
                ...p,
                tagline: p.tagline || profile.tagline,
              }));
              setPostFormData((p: any) => ({
                ...p,
                tagline: p.tagline || profile.tagline,
              }));
            }
            const logoPath = profile.logo_path ?? null;
            // IMPORTANT: set glow immediately if logo_path exists (even if getPublicUrl fails)
            if (logoPath) {
              setLogoGlowing(true);
              try {
                const { data: publicData } = supabase.storage
                  .from("user-uploads")
                  .getPublicUrl(logoPath);
                const publicUrl = (publicData as any)?.publicUrl ?? null;
                if (publicUrl) {
                  setLogoPublicUrl(publicUrl);
                  setAdFormData((p: any) => ({
                    ...p,
                    logoPublicUrl: p.logoPublicUrl || publicUrl,
                  }));
                  setPostFormData((p: any) => ({
                    ...p,
                    logoPublicUrl: p.logoPublicUrl || publicUrl,
                  }));
                } else {
                  // if profile has a path but getPublicUrl didn't produce usable URL, still mark glow
                  setLogoPublicUrl(null);
                }
              } catch (e) {
                console.warn("getPublicUrl error", e);
              }
            }
            if ((profile as any).credits !== undefined)
              setCredits(Number((profile as any).credits) || 0);

            // set reference images into uploadedPreviews for easy display
            if (
              (profile as any).ref_images &&
              Array.isArray((profile as any).ref_images)
            ) {
              setUploadedPreviews((p) => {
                // merge keeping existing previews
                const merged = Array.from(
                  new Set([...p, ...((profile as any).ref_images || [])])
                );
                return merged;
              });
            }
          } else {
            // fallback name from auth if profiles row missing
            const fallbackName =
              (user.email && user.email.split("@")[0]) || null;
            setProfileFullName(fallbackName);
          }
        } catch (e) {
          console.warn("profile fetch error", e);
          // fallback name from auth
          const user = await getCurrentUser();
          setProfileFullName(user?.email ? user.email.split("@")[0] : null);
        }

        // fetch chats
        const serverChats = await fetchChatsFromServer();
        if (serverChats && serverChats.length > 0) {
          setChats(serverChats);
          setCurrentChatId(serverChats[0].id);
          setMessages(serverChats[0].messages || []);
        } else {
          try {
            const created = await createChatOnServer("New Chat");
            setChats([created]);
            setCurrentChatId(created.id);
            setMessages(created.messages || []);
          } catch (e) {
            console.warn("create default chat failed", e);
            toast.error("Could not create chat on server");
          }
        }

        // fetch recent generated images
        try {
          const urls = await fetchRecentGeneratedImages(20);
          if (urls && urls.length) setGeneratedImages(urls);
        } catch (e) {
          console.warn("fetchRecentGeneratedImages failed", e);
        }
      } catch (e) {
        console.warn("initial load failed", e);
      }
    })();

    // locate the Sidebar's aside to portal chat list into it (retry until found)
    let tries = 0;
    const findHost = () => {
      // Try a few selectors (common patterns)
      const selectors = [
        "aside[aria-expanded]",
        "aside",
        "[data-sidebar]",
        "div.sidebar",
        'nav[role="navigation"]',
      ];
      for (const s of selectors) {
        const el = document.querySelector<HTMLElement>(s);
        if (el) return el;
      }
      return null;
    };

    const applyHostStyles = (host: HTMLElement) => {
      // store previous inline styles
      if (!sidebarPrevStylesRef.current) {
        sidebarPrevStylesRef.current = {
          boxShadow: host.style.boxShadow,
          filter: host.style.filter,
          position: host.style.position,
          border: host.style.border,
          height: host.style.height,
          overflowY: host.style.overflowY,
          top: host.style.top,
          left: host.style.left,
          zIndex: host.style.zIndex,
        };
      }
      // enforce full-height scrollable sidebar that sits at left 0
      host.style.position = host.style.position || "fixed";
      host.style.top = "0";
      host.style.left = host.style.left || "0";
      host.style.height = "100vh";
      host.style.overflowY = "auto";
      (host.style as any).webkitOverflowScrolling = "touch";
      host.style.zIndex = host.style.zIndex || "20";
      // ensure it has a background so it visually separates
      host.style.background =
        host.style.background || "var(--background, #fff)";
      // add subtle right border to separate
      host.style.borderRight =
        host.style.borderRight || `1px solid rgba(15,23,42,0.04)`;
    };

    const restoreHostStyles = (host: HTMLElement | null) => {
      const prev = sidebarPrevStylesRef.current;
      if (!host || !prev) return;
      if (prev.boxShadow !== undefined) host.style.boxShadow = prev.boxShadow;
      if (prev.filter !== undefined) host.style.filter = prev.filter;
      if (prev.border !== undefined) host.style.border = prev.border;
      if (prev.position !== undefined) host.style.position = prev.position;
      if (prev.height !== undefined) host.style.height = prev.height;
      if (prev.overflowY !== undefined) host.style.overflowY = prev.overflowY;
      if (prev.top !== undefined) host.style.top = prev.top;
      if (prev.left !== undefined) host.style.left = prev.left;
      if (prev.zIndex !== undefined) host.style.zIndex = prev.zIndex;
    };

    const interval = setInterval(() => {
      tries++;
      const host = findHost();
      if (host) {
        applyHostStyles(host);
        setSidebarHost(host);
        const rect = host.getBoundingClientRect();
        setSidebarRight(rect.right || rect.width || 0);
        clearInterval(interval);
      } else if (tries > 60) {
        // stop after ~6s
        clearInterval(interval);
      }
    }, 100);

    // also attempt once immediately
    const immediate = findHost();
    if (immediate) {
      applyHostStyles(immediate);
      setSidebarHost(immediate);
      const rect = immediate.getBoundingClientRect();
      setSidebarRight(rect.right || rect.width || 0);
      clearInterval(interval);
    }

    // update on resize
    const onResize = () => {
      const host = findHost();
      if (host) {
        const rect = host.getBoundingClientRect();
        setSidebarRight(rect.right || rect.width || 0);
      } else {
        setSidebarRight(0);
      }
    };
    window.addEventListener("resize", onResize);

    return () => {
      clearInterval(interval);
      window.removeEventListener("resize", onResize);
      // restore host styles on unmount
      if (sidebarHost) restoreHostStyles(sidebarHost);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* inject glow & professional logo stylesheet once (and deep shadow) */
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (document.getElementById("optim-sidebar-glow-style")) return;
    const style = document.createElement("style");
    style.id = "optim-sidebar-glow-style";
    style.innerHTML = `
      /* sidebar glow applied to the aside element */
      .optim-logo-glow {
        box-shadow: 0 12px 48px rgba(99,102,241,0.16) !important;
        transition: box-shadow .18s ease, transform .18s ease;
      }
      .optim-logo-glow::after {
        content: "";
        position: absolute;
        inset: 0;
        pointer-events: none;
        border-radius: 12px;
        box-shadow: 0 0 36px rgba(99,102,241,0.10);
      }
      /* small pulse for the logo card inside upload panel */
      .optim-logo-card-glow {
        box-shadow: 0 12px 36px rgba(99,102,241,0.14);
        transform: translateY(-2px);
        transition: transform .18s ease, box-shadow .18s ease;
      }
      .optim-logo-card-glow img { animation: optimPulse 1.6s infinite ease-in-out; }
      @keyframes optimPulse { 0% { opacity: 1 } 50% { opacity: 0.92 } 100% { opacity: 1 } }

      /* professional logo card styling */
      .optim-logo-card-professional {
        background: linear-gradient(180deg, rgba(255,255,255,0.98), rgba(245,245,250,0.98));
        border-radius: 10px;
        padding: 6px;
        border: 1px solid rgba(15,23,42,0.06);
        box-shadow: 0 8px 28px rgba(12,18,36,0.08);
      }
      .optim-logo-card-professional img { border-radius: 8px; max-width: 100%; height: auto; display:block; }

      /* ensure portal chat list allows scroll on touch devices too */
      .optim-chat-list { -webkit-overflow-scrolling: touch; }

      /* active chat - use box-shadow so it's not clipped by outline */
      .optim-active-chat {
        box-shadow: 0 0 0 3px rgba(59,130,246,0.12), 0 6px 18px rgba(2,6,23,0.06);
        border-radius: 8px;
        padding: 6px;
        background-clip: padding-box;
      }

      /* stronger, consistent "deep" shadow for primary cards */
      .optim-deep-shadow {
        box-shadow: 0 14px 64px rgba(2,6,23,0.18), 0 6px 22px rgba(2,6,23,0.08) !important;
      }

      /* subtle separation of main content when sidebar fixed */
      .optim-main-separated { position: relative; z-index: 10; }

      /* selected quick-item glow (logo/aspect/theme) */
      .optim-selected-glow {
        box-shadow: 0 12px 44px rgba(99,102,241,0.14) !important;
        border: 1px solid rgba(99,102,241,0.14) !important;
        transform: translateY(-2px);
      }
    `;
    document.head.appendChild(style);
  }, []);

  /* Keep quickSettings.logoEnabled in sync with logoPublicUrl.
     If logoPublicUrl exists, logoEnabled is forced true; only removal of logo sets it false. */
  useEffect(() => {
    setQuickSettings((q) => ({ ...q, logoEnabled: !!logoPublicUrl }));
  }, [logoPublicUrl]);

  /* Apply glow class to the aside (sidebar) element when logoGlowing toggles.
     We store previous styles and restore them on cleanup/when turning glow off. */
  useEffect(() => {
    const host = sidebarHost;
    if (!host) return;
    if (logoGlowing) {
      host.classList.add("optim-logo-glow");
    } else {
      host.classList.remove("optim-logo-glow");
    }
    return () => {
      /* no-op cleanup here (restore handled on outer unmount) */
    };
  }, [logoGlowing, sidebarHost]);

  /* -------------------- Chat CRUD -------------------- */

  const createNewChat = async (title = "New Chat") => {
    try {
      const created = await createChatOnServer(title);
      setChats((prev) => [created, ...prev]);
      setCurrentChatId(created.id);
      setMessages([]);
      toast.success("New chat created");
    } catch (e: any) {
      console.error("createNewChat error", e);
      toast.error("Create chat failed");
    }
  };

  const switchToChat = async (chatId: string) => {
    try {
      const c = chats.find((x) => x.id === chatId);
      if (c) {
        setCurrentChatId(chatId);
        setMessages(c.messages || []);
      } else {
        const serverChats = await fetchChatsFromServer();
        setChats(serverChats);
        const found = serverChats.find((s) => s.id === chatId);
        if (found) {
          setCurrentChatId(chatId);
          setMessages(found.messages || []);
        }
      }
    } catch (e) {
      console.warn("switchToChat failed", e);
    }
  };

  const updateCurrentChatMessages = async (newMessages: any[]) => {
    setMessages(newMessages);
    if (!currentChatId) return;
    setChats((prev) =>
      prev.map((c) =>
        c.id === currentChatId
          ? { ...c, messages: newMessages, updatedAt: Date.now() }
          : c
      )
    );
    const ok = await updateChatMessagesOnServer(currentChatId, newMessages);
    if (!ok) {
      toast.error("Failed to save messages to server");
    }
  };

  const renameChat = async (chatId: string, newTitle: string) => {
    setChats((prev) => {
      const next = prev.map((c) =>
        c.id === chatId
          ? { ...c, title: newTitle || c.title, updatedAt: Date.now() }
          : c
      );
      return next;
    });
    const ok = await renameChatOnServer(chatId, newTitle);
    if (ok === false) toast.error("Failed to rename on server");
  };

  const deleteChat = async (chatId: string) => {
    setChats((prev) => {
      const next = prev.filter((c) => c.id !== chatId);
      if (chatId === currentChatId) {
        if (next.length > 0) {
          const first = next[0];
          setCurrentChatId(first.id);
          setMessages(first.messages || []);
        } else {
          setCurrentChatId(null);
          setMessages([]);
        }
      }
      return next;
    });
    const ok = await deleteChatOnServer(chatId);
    if (!ok) toast.error("Failed to delete chat on server");
    else toast.success("Chat deleted");
  };

  /* -------------------- File & Logo Uploads -------------------- */

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (uploadedImages.length + files.length > 3) {
      toast.error("Maximum 3 images allowed");
      return;
    }
    setUploadedImages((prev) => [...prev, ...files.slice(0, 3 - prev.length)]);
    Array.from(files).forEach((f) => {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = String(reader.result);
        setUploadedPreviews((prev) => [...prev, dataUrl]);
      };
      reader.readAsDataURL(f);
    });
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    if (!file) return;
    setLogoFile(file);
    const localPreview = URL.createObjectURL(file);
    setLogoPreview(localPreview);
    toast.success("Logo selected (local preview)");

    try {
      const user = await getCurrentUser();
      if (!user) {
        toast.error("Sign in to upload logo");
        return;
      }
      // upload and save profile.logo_path
      try {
        // upload to user-uploads/{user.id}/logo/{filename} (matches onboarding)
        const { path, publicUrl } = await uploadFileToUserUploads(file, "logo");
        if (publicUrl) {
          setLogoPublicUrl(publicUrl);
          setLogoGlowing(true);
          setAdFormData((p: any) => ({
            ...p,
            logoPublicUrl: p.logoPublicUrl || publicUrl,
          }));
          setPostFormData((p: any) => ({
            ...p,
            logoPublicUrl: p.logoPublicUrl || publicUrl,
          }));
        } else {
          // if no publicUrl, still glow (we saved path)
          setLogoGlowing(true);
        }
        // save logo_path in profile (use path)
        // <-- FIX: removed invalid `returning` option
        await supabase
          .from("profiles")
          .upsert({
            id: user.id,
            logo_path: path,
            tagline: adFormData.tagline || null,
          });
        toast.success("Logo uploaded and saved to profile");
      } catch (uploadErr) {
        console.warn("logo upload error", uploadErr);
        setLogoGlowing(true); // still show glow for local preview
        toast.warning("Logo selected locally but public upload failed.");
      }
    } catch (e) {
      console.warn("handleLogoUpload error", e);
    }
  };

  const handleRemoveLogo = async () => {
    setLogoFile(null);
    setLogoPreview(null);
    setLogoPublicUrl(null);
    setLogoGlowing(false);
    try {
      const user = await getCurrentUser();
      if (user) {
        // <-- FIX: removed invalid `returning` option
        await supabase
          .from("profiles")
          .upsert({ id: user.id, logo_path: null });
      }
    } catch (e) {
      console.warn("failed to remove logo_path", e);
    }
    toast.success("Logo removed");
  };

  const handleRemoveImage = (index: number) => {
    setUploadedImages((prev) => prev.filter((_, i) => i !== index));
    setUploadedPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  /* Save the reference images shown in uploadedPreviews to the profiles.ref_images */
  const handleSaveReferenceImages = async () => {
    try {
      const user = await getCurrentUser();
      if (!user) {
        toast.error("Sign in to save reference images");
        return;
      }

      // If there are File objects in uploadedImages, upload them and capture public URLs.
      const uploadedUrls: string[] = [];
      for (const f of uploadedImages) {
        try {
          // upload to user-uploads/{user.id}/{filename} (no extra prefix) to mirror onboarding
          const { path, publicUrl } = await uploadFileToUserUploads(f, "");
          if (publicUrl) uploadedUrls.push(publicUrl);
        } catch (e) {
          console.warn("upload reference image failed", e);
        }
      }

      // also include any preview URLs that are already http(s)
      const previewUrls = uploadedPreviews.filter(
        (u) => typeof u === "string" && u.startsWith("http")
      );
      const toAdd = Array.from(new Set([...uploadedUrls, ...previewUrls]));

      if (toAdd.length === 0) {
        toast.error("No reference images to save. Upload first.");
        return;
      }

      await addReferenceImagesToProfile(toAdd);
      toast.success("Reference images saved to profile");
      // refresh uploadedPreviews from profile or keep what we have (we'll keep)
    } catch (e) {
      console.error("handleSaveReferenceImages error", e);
      toast.error("Saving reference images failed");
    }
  };

  const handleRemoveReferenceImage = async (url: string) => {
    try {
      await removeReferenceImageFromProfile(url);
      setUploadedPreviews((prev) => prev.filter((p) => p !== url));
      toast.success("Reference image removed from profile");
    } catch (e) {
      console.warn("handleRemoveReferenceImage failed", e);
      toast.error("Remove failed");
    }
  };

  /* -------------------- Generation flow -------------------- */

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      startGenerate();
    }
  };

  const enhancePrompt = async (text: string) => {
    try {
      if (!text || !text.trim()) {
        toast.error("Write something to enhance.");
        return null;
      }
      const token =
        (await supabase.auth.getSession()).data?.session?.access_token ?? null;
      if (!token) {
        toast.error("Sign in to use enhancer.");
        return null;
      }
      const promptBody = `Enhance the following campaign description for clarity, persuasion, and ad copy effectiveness. Keep brand names intact. Only return the enhanced text (no commentary).\n\n---\n${text}`;
      const resp = await fetch("/api/enhancePrompt", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ prompt: promptBody }),
      });
      const json = await resp.json();
      if (!resp.ok || !json) {
        throw new Error((json && json.error) || "Enhance failed");
      }
      const enhanced = json.caption ?? json.result ?? null;
      if (!enhanced) {
        toast.error("Enhancer returned nothing.");
        return null;
      }
      toast.success("Prompt enhanced");
      return enhanced;
    } catch (e: any) {
      console.error("enhancePrompt error", e);
      toast.error("Enhance failed: " + (e.message || String(e)));
      return null;
    }
  };

  const startGenerate = async () => {
    if (!inputText.trim() && uploadedImages.length === 0) {
      toast.error("Please describe your campaign or upload images");
      return;
    }

    if (credits <= 0) {
      toast.error("No credits available", {
        description: "Please upgrade your plan to continue creating campaigns.",
      });
      return;
    }

    const ok = useCredit();
    if (!ok) return;

    const userMessage = {
      role: "user",
      content: inputText || "Generate from uploaded images",
      imageUrl: null,
    };
    const newMessages = [...messages, userMessage];
    updateCurrentChatMessages(newMessages);

    setInputText("");
    setShowUploadPanel(false);
    setIsGenerating(true);

    try {
      const token =
        (await supabase.auth.getSession()).data?.session?.access_token ?? null;
      if (!token) {
        toast.error("Sign in to generate images.");
        setIsGenerating(false);
        return;
      }

      const payload: any = {
        mode: "generate",
        campaignName: adFormData.campaignName,
        objective: adFormData.objective,
        platforms: adFormData.platforms,
        campaignType: adFormData.campaignType,
        brandName: adFormData.brandName,
        tagline: adFormData.tagline,
        tone: quickSettings.tone || adFormData.tone,
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
        description: inputText || adFormData.description,
        emotion: adFormData.emotion,
        offerInfo: adFormData.offerInfo,
        prompt:
          inputText ||
          (uploadedPreviews.length ? "Generate from uploaded images" : ""),
        target: {
          width: quickSettings.aspectRatio === "9:16" ? 1080 : 1080,
          height: quickSettings.aspectRatio === "9:16" ? 1920 : 1080,
        },
        aiCustomization: {
          colorPrimary: adFormData.logoPublicUrl || undefined,
          logoUrl: adFormData.logoPublicUrl || logoPublicUrl || null,
        },
      };

      let resp: Response;
      if (uploadedImages && uploadedImages.length) {
        const fd = new FormData();
        fd.append("payload", JSON.stringify(payload));
        uploadedImages.forEach((f) => fd.append("files", f, f.name));
        resp = await fetch("/api/generate-campaign", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: fd,
        });
      } else {
        resp = await fetch("/api/generate-campaign", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });
      }

      const json = await resp.json();
      if (!resp.ok || !json || !json.ok) {
        console.error("generate error", json);
        throw new Error(
          (json && json.error) || `Generation failed: ${resp.status}`
        );
      }

      const first =
        typeof json.image === "string"
          ? json.image
          : Array.isArray(json.images) && json.images.length
          ? json.images[0]
          : null;
      let imageUrl = first ?? uploadedPreviews[0] ?? null;
      if (!imageUrl) throw new Error("No image returned");

      // upload + record in user_generated_image
      try {
        const uploaded = await uploadAndRecordGeneratedImage(
          imageUrl,
          (adFormData.campaignName || "gen").slice(0, 30)
        );
        if (uploaded && uploaded.publicUrl) imageUrl = uploaded.publicUrl;
      } catch (e) {
        console.warn("auto upload failed", e);
      }

      const assistantMessage = {
        role: "assistant",
        content: `Generated preview${
          adFormData.brandName ? ` for ${adFormData.brandName}` : ""
        }. Verify and proceed to publish.`,
        imageUrl: imageUrl,
      };
      const after = [...newMessages, assistantMessage];
      updateCurrentChatMessages(after);

      try {
        if (
          json.creditsRemaining !== undefined &&
          json.creditsRemaining !== null
        ) {
          setCredits(Number(json.creditsRemaining));
        }
      } catch (e) {}

      setPendingGeneratedImage(imageUrl);
      setIsGenerating(false);
      toast.success("Image ready — verify before publishing");

      setGeneratedImages((prev) => [imageUrl, ...prev]);
    } catch (e) {
      console.error("startGenerate error", e);
      setIsGenerating(false);
      toast.error("Generation failed — check console");
    }
  };

  const handleProceedToPublish = async () => {
    if (!pendingGeneratedImage) {
      toast.error("No generated image to proceed with");
      return;
    }

    setGeneratedImages((prev) => {
      const next = [
        pendingGeneratedImage!,
        ...prev.filter((p) => p !== pendingGeneratedImage),
      ];
      return next;
    });

    const confirmMsg = {
      role: "assistant",
      content: "User proceeded to publish with this creative.",
      imageUrl: pendingGeneratedImage,
    };
    const newMsgs = [...messages, confirmMsg];
    updateCurrentChatMessages(newMsgs);

    setPendingGeneratedImage(null);
    setShowPublishPanel(true);
  };

  /* -------------------- Caption & Publish flows -------------------- */

  const generateCaption = async (
    promptText: string,
    setResult: (text: string) => void
  ) => {
    try {
      if (!promptText || !promptText.trim()) {
        toast.error("Please provide some text for AI to work with.");
        return;
      }
      const token =
        (await supabase.auth.getSession()).data?.session?.access_token ?? null;
      if (!token) {
        toast.error("Not signed in. Please sign in to use AI features.");
        return;
      }

      const resp = await fetch("/api/generateCaption", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ prompt: promptText }),
      });
      const json = await resp.json();
      if (!resp.ok || !json)
        throw new Error((json && json.error) || "AI generation failed");
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

  const handlePublishPost = async () => {
    try {
      if (generatedImages.length === 0) {
        toast.error(
          "No generated image to publish. Generate and proceed first."
        );
        return;
      }

      if (!postFormData.platforms || postFormData.platforms.length === 0) {
        // set inline platform error for the UI
        setPlatformError(
          "Please choose at least one platform (Instagram / Facebook)."
        );
        return;
      }

      // clear any previous platform error
      setPlatformError(null);

      const user = await getCurrentUser();
      if (!user) {
        toast.error("You must be signed in to publish a post.");
        router.push("/auth/signin");
        return;
      }

      let finalName = (postFormData.postName || "").trim();
      if (!finalName) {
        finalName = `Post_${Date.now()}`;
        setPostFormData((p: any) => ({ ...p, postName: finalName }));
      }

      const imageToPublish = generatedImages[0];
      let image_url = imageToPublish;
      let image_path = "";

      if (imageToPublish.startsWith("data:")) {
        const blob = dataURLtoBlob(imageToPublish);
        const safeName = (finalName || "post")
          .replace(/[^a-z0-9_\-]/gi, "_")
          .toLowerCase();
        const filename = `${user.id}_${Date.now()}_${safeName}.png`;
        const path = `campaigns/${user.id}/${filename}`;
        const { error: uploadError } = await supabase.storage
          .from("campaign-assets")
          .upload(path, blob, { cacheControl: "3600", upsert: false });
        if (uploadError) throw uploadError;
        const { data: publicData } = supabase.storage
          .from("campaign-assets")
          .getPublicUrl(path);
        image_url = (publicData as any)?.publicUrl ?? imageToPublish;
        image_path = path;
        try {
          await supabase
            .from("user_generated_image")
            .insert([
              {
                user_id: user.id,
                image_url: image_url,
                image_path: image_path,
                source: "generated",
              },
            ]);
        } catch (e) {
          console.warn("failed to insert generated image record", e);
        }
      } else if (imageToPublish.startsWith("http")) {
        image_url = imageToPublish;
        image_path = "";
      }

      const payload = {
        user_id: user.id,
        name: finalName,
        audience: null,
        campaign_type: "post",
        brand_voice: postFormData.tone || null,
        content_types: [postFormData.postType || "image"],
        vision: postFormData.prompt || null,
        output: {
          caption: postFormData.generatedCaption || null,
        },
        image_url: [image_url],
        image_path: [image_path],
        is_published: true,
      };

      const { data: inserted, error: insertError } = await supabase
        .from("campaigns")
        .insert([payload])
        .select();
      if (insertError) throw insertError;

      // Try to post to Instagram (if selected)
      if (postFormData.platforms.includes("Instagram")) {
        try {
          await fetch("/api/auth/instagram/post", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              image_url,
              caption:
                postFormData.generatedCaption || postFormData.postName || "",
              alsoPostToFacebook: postFormData.platforms.includes("Facebook"),
            }),
          });
        } catch (e) {
          console.error("Instagram post failed", e);
          // continue — we've saved the campaign regardless
        }
      }

      // If user opted only Facebook (and not Instagram) or also requested FB separately, call FB endpoint
      if (
        postFormData.platforms.includes("Facebook") &&
        !postFormData.platforms.includes("Instagram")
      ) {
        try {
          await fetch("/api/auth/facebook/post", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              image_url,
              caption:
                postFormData.generatedCaption || postFormData.postName || "",
            }),
          });
        } catch (e) {
          console.error("Facebook post failed", e);
          // continue
        }
      }

      // Success: show the requested message then redirect
      toast.success(
        "Post has been successfully posted and you are redirected to dashboard."
      );
      setShowPublishPanel(false);
      router.push("/dashboard");
    } catch (e: any) {
      console.error("handlePublishPost error", e);
      toast.error("Publish failed: " + (e?.message || String(e)));
    }
  };

  /* -------------------- Launch Ad (same logic as earlier) -------------------- */

  const handleLaunchAd = async () => {
    try {
      if (!adFormData.campaignName || !adFormData.campaignName.trim()) {
        toast.error("Campaign name required");
        return;
      }
      if (generatedImages.length === 0) {
        toast.error("No creative available — generate an image first");
        return;
      }

      const user = await getCurrentUser();
      if (!user) {
        toast.error("You must be signed in to run ads.");
        router.push("/auth/signin");
        return;
      }

      const mapObjectiveToMeta = (obj: string | undefined | null) => {
        const o = (obj || "").toString().trim().toUpperCase();
        switch (o) {
          case "LINK_CLICKS":
          case "TRAFFIC":
            return "OUTCOME_TRAFFIC";
          case "CONVERSIONS":
          case "SALES":
            return "OUTCOME_SALES";
          case "BRAND_AWARENESS":
            return "OUTCOME_AWARENESS";
          case "REACH":
            return "OUTCOME_AWARENESS";
          case "ENGAGEMENT":
            return "OUTCOME_ENGAGEMENT";
          case "APP_PROMOTION":
          case "APP_INSTALLS":
            return "OUTCOME_APP_PROMOTION";
          case "LEADS":
          case "OUTCOME_LEADS":
            return "OUTCOME_LEADS";
          default:
            return "OUTCOME_TRAFFIC";
        }
      };

      const imageToUse = generatedImages[0];
      let creativeImageUrl = "";
      let creativeImageDataUrl: string | undefined = undefined;

      if (imageToUse.startsWith("data:")) {
        try {
          const blob = dataURLtoBlob(imageToUse);
          const safeName = (adFormData.campaignName || "ad")
            .replace(/[^a-z0-9_\-]/gi, "_")
            .toLowerCase();
          const filename = `${user.id}_${Date.now()}_${safeName}.png`;
          const path = `campaigns/${user.id}/${filename}`;
          const { error: uploadError } = await supabase.storage
            .from("campaign-assets")
            .upload(path, blob, { cacheControl: "3600", upsert: true });
          if (uploadError) throw uploadError;
          const { data: publicData } = supabase.storage
            .from("campaign-assets")
            .getPublicUrl(path);
          creativeImageUrl = (publicData as any)?.publicUrl ?? "";
          if (!creativeImageUrl) creativeImageDataUrl = imageToUse;
        } catch (e) {
          console.error("upload creative to supabase failed", e);
          creativeImageDataUrl = imageToUse;
        }
      } else if (imageToUse.startsWith("http")) {
        creativeImageUrl = imageToUse;
      }

      const payloadDb = {
        user_id: user.id,
        name: adFormData.campaignName,
        campaign_type: "ad",
        brand_voice: adFormData.tone || null,
        content_types: ["image"],
        vision: adFormData.description || null,
        output: { images: generatedImages },
        image_url: generatedImages,
        image_path: [""],
        is_published: true,
      };

      const { data: inserted, error } = await supabase
        .from("campaigns")
        .insert([payloadDb])
        .select();
      if (error) throw error;

      const mappedObjective = mapObjectiveToMeta(adFormData.objective);

      const adPayload: any = {
        campaignName: adFormData.campaignName,
        objective: mappedObjective,
        platforms: adFormData.platforms,
        adSetName:
          adFormData.adSetName ||
          `${adFormData.campaignName || "Campaign"} AdSet ${Date.now()}`,
        targeting: undefined,
        creativeCaption: adFormData.tagline || adFormData.description || "",
        creativeImageUrl: creativeImageUrl || undefined,
        creativeImageDataUrl: creativeImageDataUrl || undefined,
        destinationLink: adFormData.destinationLink || "",
        budget: adFormData.budget,
        budgetType: adFormData.budgetType || "daily",
        startDate: adFormData.startDate || null,
        endDate: adFormData.endDate || null,
        delivery: adFormData.delivery || undefined,
        campaignType: adFormData.campaignType || "ad",
        brandName: adFormData.brandName || undefined,
        tagline: adFormData.tagline || undefined,
        tone: adFormData.tone || undefined,
        primaryCTA: adFormData.primaryCTA || undefined,
        location: adFormData.location || undefined,
        ageRange: adFormData.ageRange || undefined,
        gender: adFormData.gender || undefined,
        interests: adFormData.interests || undefined,
        autoTarget: !!adFormData.autoTarget,
        autoOptimize: !!adFormData.autoOptimize,
      };

      try {
        const token =
          (await supabase.auth.getSession()).data?.session?.access_token ??
          null;
        if (!token) {
          toast.error("You must be signed in to run ads.");
          return;
        }

        const resp = await fetch("/api/auth/facebook/ads", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(adPayload),
        });

        const json = await resp.json();
        if (!resp.ok) {
          console.error("facebook/ads returned error:", json);
          toast.error("Facebook Ads creation failed. See console for details.");
        } else {
          // On success, show the requested message and redirect
          toast.success("Ad has been posted. You are redirected to dashboard.");
          setShowPublishPanel(false);
          router.push("/dashboard");
        }
      } catch (e) {
        console.error("facebook/ads call failed", e);
        toast.error("Facebook Ads creation failed (see console).");
      }
    } catch (e: any) {
      console.error("handleLaunchAd error", e);
      toast.error("Launch failed: " + (e?.message || String(e)));
    }
  };

  /* -------------------- Portal content for Sidebar (New chat + chats) -------------------- */

  const sidebarChatPortal = (
    <div
      style={{
        padding: 20, // increased top padding to prevent clipping of active outline
        paddingTop: 36,
        borderTop: `1px solid rgba(255,255,255,0.04)`,
        background: "transparent",
      }}
    >
      <div className="mb-4">
        {" "}
        {/* increased vertical spacing */}
        <Button size="sm" className="w-full" onClick={() => createNewChat()}>
          <Plus className="w-4 h-4 mr-2" /> New Chat
        </Button>
      </div>

      <div
        className="optim-chat-list"
        style={{
          maxHeight: "calc(100vh - 240px)", // slightly larger reserved space
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 10, // increased gap
          paddingRight: 6,
        }}
      >
        {chats.map((c) => (
          <div
            key={c.id}
            className={`flex items-center justify-between p-2 rounded-md ${
              c.id === currentChatId ? "optim-active-chat" : "hover:bg-slate-50"
            }`}
            style={{ cursor: "pointer", alignItems: "center", gap: 8 }}
          >
            <button
              onClick={() => switchToChat(c.id)}
              className="text-sm text-left flex-1 truncate"
              title={c.title ?? "Chat"}
              style={{ textTransform: "capitalize" }}
            >
              {c.title}
            </button>
            <div className="flex items-center gap-1 ml-2">
              <button
                title="Rename"
                onClick={() => {
                  const t = window.prompt("Rename chat", c.title || "Chat");
                  if (t !== null) {
                    const trimmed = t.trim();
                    if (trimmed.length) renameChat(c.id, trimmed);
                    else toast.error("Title cannot be empty");
                  }
                }}
                className="text-xs px-1"
              >
                ✎
              </button>
              <button
                title="Delete"
                onClick={() => {
                  if (confirm("Delete this chat?")) deleteChat(c.id);
                }}
                className="text-xs px-1"
              >
                🗑
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  /* -------------------- Render -------------------- */

  const firstName = (() => {
    const n = profileFullName?.trim();
    if (!n) return "There";
    const f = n.split(" ")[0];
    return f.charAt(0).toUpperCase() + f.slice(1).toLowerCase();
  })();

  const ASPECT_OPTIONS = ["1:1", "4:5", "9:16"]; // removed 16:9 per request

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Left: canonical Sidebar (we portal chats into it) */}
      <Sidebar
        logoUrl={"/brand/logo.png"}
        onLogoClick={() => toast("Logo clicked")}
      />

      {/* Render portal into Sidebar element (if found) */}
      {sidebarHost && createPortal(sidebarChatPortal, sidebarHost)}

      {/* Main content area — shifted right to avoid sidebar overlay */}
      <div
        className="flex-1 optim-main-separated"
        style={{
          marginLeft: sidebarRight > 0 ? `${sidebarRight}px` : undefined,
        }}
      >
        {/* NavBar only (set extended height) with deeper shadow */}
        <div
          style={{ boxShadow: "0 20px 60px rgba(6,18,60,0.18)", minHeight: 72 }}
          className="sticky top-0 z-40 bg-background/95"
        >
          <NavBar />
        </div>

        <main className="max-w-6xl mx-auto p-6 pb-56">
          {" "}
          {/* increased bottom padding */}
          {/* If no messages show welcome */}
          {messages.length === 0 ? (
            <div className="flex items-center justify-center py-24">
              <div className="text-center">
                <div
                  className="mx-auto w-28 h-28 rounded-full flex items-center justify-center"
                  style={{ background: colors.gradientHero }}
                >
                  <Sparkles className="w-12 h-12 text-white" />
                </div>
                <h2 className="text-4xl font-bold mt-6">Hello, {firstName}</h2>
                <p
                  className="text-lg mt-3"
                  style={{ color: colors.mutedForeground }}
                >
                  Describe your campaign idea or upload product images to get
                  started with AI-powered creation
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-6 mb-8">
              {messages.map((m, idx) => (
                <div
                  key={idx}
                  className={`flex ${
                    m.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <Card
                    className="max-w-2xl p-5 optim-deep-shadow"
                    style={{
                      background:
                        m.role === "user" ? `${colors.primary}0c` : colors.card,
                      border: `1px solid ${colors.border}`,
                    }}
                  >
                    <p style={{ color: colors.cardForeground }}>{m.content}</p>
                    {m.imageUrl && (
                      <div className="mt-3">
                        <img
                          src={m.imageUrl}
                          alt="generated"
                          className="w-full rounded-lg border"
                          style={{ borderColor: colors.border }}
                        />
                        <div className="mt-2 flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              navigator.clipboard?.writeText(m.imageUrl || "");
                              toast.success("Image URL copied");
                            }}
                          >
                            <Copy className="w-3 h-3 mr-2" /> Copy URL
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              const a = document.createElement("a");
                              a.href = m.imageUrl!;
                              a.download = `creative_${Date.now()}.png`;
                              document.body.appendChild(a);
                              a.click();
                              a.remove();
                            }}
                          >
                            <Download className="w-3 h-3 mr-2" /> Download
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              const filtered = messages.filter(
                                (_, i) => i !== idx
                              );
                              updateCurrentChatMessages(filtered);
                              toast.success("Deleted message");
                            }}
                          >
                            <X className="w-3 h-3 mr-2" /> Delete
                          </Button>
                        </div>
                      </div>
                    )}
                  </Card>
                </div>
              ))}
              {isGenerating && (
                <div className="flex justify-start">
                  <Card
                    className="p-4 optim-deep-shadow"
                    style={{
                      background: colors.card,
                      border: `1px solid ${colors.border}`,
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-3 h-3 rounded-full animate-pulse"
                        style={{ background: colors.primary }}
                      />
                      <div style={{ color: colors.mutedForeground }}>
                        Generating your campaign...
                      </div>
                    </div>
                  </Card>
                </div>
              )}
            </div>
          )}
          {/* Pending preview */}
          {pendingGeneratedImage && (
            <div className="mb-6">
              <Card className="p-4 optim-deep-shadow">
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1">
                    <img
                      src={pendingGeneratedImage}
                      alt="preview"
                      className="w-full rounded-lg object-contain"
                    />
                  </div>
                  <div className="w-full md:w-80">
                    <h4 className="font-semibold">Preview ready</h4>
                    <p
                      className="text-sm mt-2"
                      style={{ color: colors.mutedForeground }}
                    >
                      Verify the generated image here. If it looks good, click
                      Proceed to Publish. Otherwise, Regenerate or Dismiss.
                    </p>
                    <div className="mt-4 flex gap-2">
                      <Button
                        onClick={() => {
                          setPendingGeneratedImage(null);
                          toast("Preview dismissed");
                        }}
                        variant="outline"
                      >
                        Dismiss
                      </Button>
                      <Button
                        style={{
                          background: colors.gradientPrimary,
                          color: colors.primaryForeground,
                        }}
                        onClick={handleProceedToPublish}
                        className="hover:scale-105 transition-transform"
                      >
                        Proceed to Publish
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setPendingGeneratedImage(null);
                          startGenerate();
                        }}
                      >
                        Regenerate
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          )}
          {/* Generated gallery */}
          {generatedImages.length > 0 && (
            <div className="mb-6">
              <h3 className="font-semibold mb-3">Generated Images</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {generatedImages.map((g, idx) => (
                  <div
                    key={idx}
                    className="relative group rounded overflow-hidden shadow-sm"
                  >
                    <img
                      src={g}
                      alt={`generated-${idx}`}
                      className="w-full h-40 object-cover"
                    />
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          setGeneratedImages((prev) =>
                            prev.filter((_, i) => i !== idx)
                          )
                        }
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>

        {/* Bottom fixed input - avoid overlap by using measured sidebarRight */}
        <div
          className="fixed bottom-0 right-0"
          style={{
            left: sidebarRight > 0 ? sidebarRight : 0,
            width: sidebarRight > 0 ? `calc(100% - ${sidebarRight}px)` : "100%",
            background: `${colors.background}`,
            borderTop: `1px solid ${colors.border}`,
            zIndex: 60, // keep bottom input z-index at 60; publish modal will be above it
          }}
        >
          <div className="max-w-6xl mx-auto px-6 py-4 space-y-4">
            <div className="flex flex-wrap gap-2 items-center">
              {/* Logo button - if logoPublicUrl exists it acts like selected and cannot be toggled off; clicking opens logo picker */}
              <Button
                size="sm"
                variant={quickSettings.logoEnabled ? "default" : "outline"}
                onClick={() => {
                  if (logoPublicUrl) {
                    // don't allow unselect; open logo picker to replace
                    logoInputRef.current?.click();
                    return;
                  }
                  // no logo: toggle selection
                  setQuickSettings((q) => ({
                    ...q,
                    logoEnabled: !q.logoEnabled,
                  }));
                }}
                className={
                  quickSettings.logoEnabled ? "optim-selected-glow" : ""
                }
                title={
                  logoPublicUrl
                    ? "Logo applied — click to replace"
                    : "Toggle logo usage"
                }
              >
                <ImageIcon className="w-3 h-3 mr-2" />
                Logo
              </Button>

              {/* Theme button with drop-up */}
              <div className="relative">
                <Button
                  size="sm"
                  variant={quickSettings.themeEnabled ? "default" : "outline"}
                  onClick={() => setShowThemeOptions((s) => !s)}
                  className={
                    quickSettings.themeEnabled ? "optim-selected-glow" : ""
                  }
                >
                  <Palette className="w-3 h-3 mr-2" />
                  {quickSettings.themeEnabled ? quickSettings.tone : "Theme"}
                </Button>
                {showThemeOptions && (
                  <div className="absolute bottom-full mb-2 right-0 bg-white border p-2 rounded shadow-lg z-40 w-44">
                    <div className="text-xs font-semibold mb-2">Pick theme</div>
                    <div className="flex flex-col gap-2">
                      {["professional", "playful", "festive", "minimal"].map(
                        (t) => (
                          <button
                            key={t}
                            onClick={() => {
                              setQuickSettings((q) => ({
                                ...q,
                                tone: t,
                                themeEnabled: true,
                              }));
                              setShowThemeOptions(false);
                              toast.success(`Theme: ${t}`);
                            }}
                            className={`text-left px-2 py-1 rounded ${
                              quickSettings.tone === t ? "bg-primary/10" : ""
                            }`}
                          >
                            {t}
                          </button>
                        )
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Aspect ratio button with drop-up (only 1:1, 4:5, 9:16) */}
              <div className="relative">
                <Button
                  size="sm"
                  variant={aspectChosen ? "default" : "outline"}
                  onClick={() => setShowAspectOptions((s) => !s)}
                  className={aspectChosen ? "optim-selected-glow" : ""}
                >
                  <LayoutTemplate className="w-3 h-3 mr-2" />
                  Aspect — {quickSettings.aspectRatio}
                </Button>
                {showAspectOptions && (
                  <div className="absolute bottom-full mb-2 right-0 bg-white border p-2 rounded shadow-lg z-40 w-40">
                    <div className="text-xs font-semibold mb-2">
                      Aspect ratio
                    </div>
                    <div className="flex flex-col gap-2">
                      {ASPECT_OPTIONS.map((r) => (
                        <button
                          key={r}
                          onClick={() => {
                            setQuickSettings((q) => ({ ...q, aspectRatio: r }));
                            setShowAspectOptions(false);
                            setAspectChosen(true); // mark aspect as chosen (button becomes selected)
                            toast.success(`Aspect: ${r}`);
                          }}
                          className={`text-left px-2 py-1 rounded hover:bg-slate-50 ${
                            quickSettings.aspectRatio === r
                              ? "font-medium optim-selected-glow"
                              : ""
                          }`}
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {quickSettings.audience && (
                <Badge variant="secondary" className="px-3 py-1.5">
                  <Users className="w-3 h-3 mr-1" />
                  {quickSettings.audience}
                </Badge>
              )}
            </div>

            {/* Input bar */}
            <div className="relative">
              <div
                className="flex items-end gap-3 p-2 rounded-3xl"
                style={{
                  background: colors.card,
                  border: `2px solid ${colors.border}`,
                }}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept="image/*"
                  multiple
                  className="hidden"
                />
                <input
                  type="file"
                  ref={logoInputRef}
                  onChange={handleLogoUpload}
                  accept="image/*"
                  className="hidden"
                />

                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setShowUploadPanel((s) => !s)}
                  className="rounded-full"
                >
                  <Plus className="w-5 h-5" />
                </Button>

                <Textarea
                  ref={textareaRef}
                  value={inputText}
                  onChange={(e) => {
                    setInputText(e.target.value);
                    resizeTextarea();
                  }}
                  onKeyDown={handleKeyPress}
                  placeholder="Describe your campaign idea or upload product images to get started…"
                  className="flex-1 min-h-[52px] max-h-[220px] bg-transparent border-0 resize-none text-base"
                  disabled={isGenerating || credits <= 0}
                />

                <div className="flex items-center gap-2">
                  <MicRecorder
                    onText={(chunk) =>
                      setInputText((p) => (p ? p + " " + chunk : chunk))
                    }
                    lang="ta-IN"
                    small
                  />
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={async () => {
                      const enhanced = await enhancePrompt(
                        inputText || adFormData.description || ""
                      );
                      if (enhanced) setInputText(enhanced);
                    }}
                    title="Enhance prompt"
                  >
                    <Sparkles className="w-5 h-5" />
                  </Button>
                  <Button
                    size="icon"
                    onClick={startGenerate}
                    disabled={
                      isGenerating ||
                      credits <= 0 ||
                      (!inputText.trim() && uploadedImages.length === 0)
                    }
                    className="rounded-full"
                    style={{ background: colors.gradientPrimary }}
                  >
                    <Send className="w-5 h-5 text-white" />
                  </Button>
                </div>
              </div>

              {/* Upload panel */}
              {showUploadPanel && (
                <Card className="mt-3 p-4 optim-deep-shadow">
                  <div className="flex items-center justify-between mb-3">
                    <div className="font-semibold">Upload & Brand Settings</div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setShowUploadPanel(false)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                  <Separator />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                    <div>
                      <Label className="text-xs mb-2 block">
                        Product / Reference Images (max 3)
                      </Label>
                      <div className="flex gap-2 items-center">
                        <div className="flex gap-2">
                          {uploadedPreviews.map((src, index) => (
                            <div key={index} className="relative group">
                              <img
                                src={src}
                                alt={`Upload ${index + 1}`}
                                className="w-16 h-16 rounded-lg object-cover border"
                                style={{ borderColor: colors.border }}
                              />
                              <button
                                onClick={() => handleRemoveImage(index)}
                                className="absolute -top-2 -right-2 w-5 h-5 bg-destructive text-white rounded-full text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                                style={{ background: colors.destructive }}
                              >
                                ×
                              </button>
                              <button
                                onClick={() => handleRemoveReferenceImage(src)}
                                className="absolute -bottom-2 left-0 text-xs bg-white px-1 rounded opacity-80"
                              >
                                Remove from profile
                              </button>
                            </div>
                          ))}
                        </div>
                        {uploadedPreviews.length < 3 && (
                          <button
                            onClick={() => fileInputRef.current?.click()}
                            className="w-16 h-16 rounded-lg border-2 border-dashed hover:border-primary transition-colors flex items-center justify-center"
                            style={{ borderColor: colors.border }}
                          >
                            <Plus className="w-5 h-5 text-muted-foreground" />
                          </button>
                        )}
                      </div>

                      <div className="mt-3 flex gap-2">
                        <Button size="sm" onClick={handleSaveReferenceImages}>
                          Save Reference Images to Profile
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setUploadedImages([]);
                            setUploadedPreviews([]);
                            toast.success("Cleared previews");
                          }}
                        >
                          Clear
                        </Button>
                      </div>
                    </div>

                    <div>
                      <Label className="text-xs mb-2 block">Brand Logo</Label>
                      <div className="flex items-center gap-3">
                        <div
                          onClick={() => logoInputRef.current?.click()}
                          className={`w-20 h-20 rounded-lg hover:border-primary transition-colors flex items-center justify-center cursor-pointer ${
                            logoGlowing ? "optim-logo-card-glow" : ""
                          } optim-logo-card-professional`}
                          style={{
                            borderColor: colors.border,
                          }}
                          title={
                            logoPublicUrl
                              ? "Logo saved — click to change"
                              : "Upload or apply logo"
                          }
                        >
                          {logoPreview ? (
                            <img
                              src={logoPreview}
                              alt="Logo"
                              className={`w-full h-full rounded-lg object-cover`}
                            />
                          ) : logoPublicUrl ? (
                            <img
                              src={logoPublicUrl}
                              alt="logo"
                              className={`w-full h-full rounded-lg object-cover`}
                            />
                          ) : (
                            <Upload className="w-5 h-5 text-muted-foreground" />
                          )}
                        </div>
                        <div className="flex-1">
                          <Label htmlFor="brandName" className="text-xs">
                            Brand Name
                          </Label>
                          <Input
                            id="brandName"
                            value={adFormData.brandName}
                            onChange={(e) => {
                              setAdFormData((p: any) => ({
                                ...p,
                                brandName: e.target.value,
                              }));
                              setPostFormData((p: any) => ({
                                ...p,
                                brandName: e.target.value,
                              }));
                            }}
                            className="mt-1 h-9 text-sm"
                            placeholder="Brand name"
                          />
                          <Label htmlFor="tagline" className="text-xs mt-2">
                            Tagline
                          </Label>
                          <Input
                            id="tagline"
                            value={adFormData.tagline}
                            onChange={(e) => {
                              setAdFormData((p: any) => ({
                                ...p,
                                tagline: e.target.value,
                              }));
                              setPostFormData((p: any) => ({
                                ...p,
                                tagline: e.target.value,
                              }));
                            }}
                            className="mt-1 h-9 text-sm"
                            placeholder="Tagline"
                          />
                          <div className="mt-2 flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={handleRemoveLogo}
                            >
                              Remove Logo
                            </Button>
                            <Button
                              size="sm"
                              onClick={async () => {
                                const user = await getCurrentUser();
                                if (!user) {
                                  toast.error("Sign in to save logo");
                                  return;
                                }
                                if (!logoFile) {
                                  toast.error("No logo selected");
                                  return;
                                }
                                try {
                                  // save under user-uploads/{user.id}/logo/{filename} to match onboarding
                                  const { path, publicUrl } =
                                    await uploadFileToUserUploads(
                                      logoFile,
                                      "logo"
                                    );
                                  // <-- FIX: removed invalid `returning` option
                                  await supabase
                                    .from("profiles")
                                    .upsert({ id: user.id, logo_path: path });
                                  if (publicUrl) {
                                    setLogoPublicUrl(publicUrl);
                                    setLogoGlowing(true);
                                    setAdFormData((p: any) => ({
                                      ...p,
                                      logoPublicUrl: publicUrl,
                                    }));
                                    setPostFormData((p: any) => ({
                                      ...p,
                                      logoPublicUrl: publicUrl,
                                    }));
                                  } else {
                                    setLogoGlowing(true);
                                  }
                                  toast.success("Logo saved to profile");
                                } catch (e) {
                                  console.error(
                                    "save logo to profile failed",
                                    e
                                  );
                                  toast.error("Save logo failed");
                                }
                              }}
                            >
                              Apply Logo (save to profile)
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              )}
            </div>
          </div>
        </div>

        {/* Publish panel (same flows) */}
        {showPublishPanel && (
          /* IMPORTANT: set higher zIndex so this panel always appears above the bottom fixed input (which is zIndex:60).
             Also make modal content scrollable and reserve bottom space so the fixed input doesn't cover controls. */
          <div
            className="fixed inset-0"
            style={{
              background: `${colors.background}cc`,
              backdropFilter: "blur(6px)",
              zIndex: 200, // much higher than bottom input
            }}
          >
            <div
              className="max-w-3xl mx-auto p-6"
              style={{
                marginTop: "auto",
                marginBottom: 120, // reserve space above the bottom input
                maxHeight: "calc(100vh - 120px)",
                overflow: "auto", // make content scrollable if tall
              }}
            >
              <Card className="p-6 optim-deep-shadow">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">
                    Publish Your Campaign
                  </h3>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowPublishPanel(false)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                <Separator className="my-3" />
                <div className="flex gap-2 mb-3">
                  <Button
                    variant={publishMode === "post" ? "default" : "outline"}
                    onClick={() => setPublishMode("post")}
                    className="flex-1"
                  >
                    <Sparkles className="w-4 h-4 mr-2" /> Post Publishing
                  </Button>
                  <Button
                    variant={publishMode === "ad" ? "default" : "outline"}
                    onClick={() => setPublishMode("ad")}
                    className="flex-1"
                  >
                    <ImageIcon className="w-4 h-4 mr-2" /> Ad Publishing
                  </Button>
                </div>

                {publishMode === "post" ? (
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="postName" className="text-sm">
                        Post Name
                      </Label>
                      <Input
                        id="postName"
                        value={postFormData.postName}
                        onChange={(e) =>
                          setPostFormData((p: any) => ({
                            ...p,
                            postName: e.target.value,
                          }))
                        }
                        placeholder="Post title (optional)"
                        className="mt-2"
                      />
                    </div>

                    <div>
                      <Label htmlFor="caption" className="text-sm">
                        Caption
                      </Label>
                      {/* platform error text */}
                      {platformError && (
                        <div className="text-sm text-red-600 mb-2">
                          {platformError}
                        </div>
                      )}
                      <Textarea
                        id="caption"
                        value={postFormData.generatedCaption}
                        onChange={(e) =>
                          setPostFormData((p: any) => ({
                            ...p,
                            generatedCaption: e.target.value,
                          }))
                        }
                        placeholder="Add your post caption..."
                        className="mt-2 min-h-[80px]"
                      />
                      <div className="mt-2 flex gap-2">
                        <Button
                          onClick={() => {
                            // Use what's currently in the caption textarea first; fall back to prompt or postName
                            const seed =
                              (postFormData.generatedCaption &&
                                String(postFormData.generatedCaption).trim()) ||
                              (postFormData.prompt &&
                                String(postFormData.prompt).trim()) ||
                              (postFormData.postName &&
                                String(postFormData.postName).trim()) ||
                              "Write a caption";
                            generateCaption(seed, (text) =>
                              setPostFormData((p: any) => ({
                                ...p,
                                generatedCaption: text,
                              }))
                            );
                          }}
                          variant="outline"
                        >
                          AI Caption
                        </Button>

                        <Button
                          onClick={() => {
                            // Prefer caption text as seed; if not present, prefer hashtags field, then prompt/postName
                            const seed =
                              (postFormData.generatedCaption &&
                                String(postFormData.generatedCaption).trim()) ||
                              (postFormData.hashtags &&
                                String(postFormData.hashtags).trim()) ||
                              (postFormData.prompt &&
                                String(postFormData.prompt).trim()) ||
                              (postFormData.postName &&
                                String(postFormData.postName).trim()) ||
                              "Generate hashtags";
                            generateCaption(
                              `Generate hashtags for: ${seed}`,
                              (text) => {
                                const matches = (text || "").match(/#[\w-]+/g);
                                if (matches && matches.length)
                                  setPostFormData((p: any) => ({
                                    ...p,
                                    hashtags: matches.join(" "),
                                  }));
                                else
                                  setPostFormData((p: any) => ({
                                    ...p,
                                    hashtags: text,
                                  }));
                              }
                            );
                          }}
                          variant="outline"
                        >
                          AI Hashtags
                        </Button>

                        <div className="ml-auto flex items-center gap-2">
                          <label className="inline-flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={postFormData.platforms.includes(
                                "Instagram"
                              )}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                setPostFormData((p: any) => ({
                                  ...p,
                                  platforms: checked
                                    ? Array.from(
                                        new Set([
                                          ...(p.platforms || []),
                                          "Instagram",
                                        ])
                                      )
                                    : (p.platforms || []).filter(
                                        (x: any) => x !== "Instagram"
                                      ),
                                }));
                                if (checked) setPlatformError(null);
                              }}
                            />
                            Instagram
                          </label>
                          <label className="inline-flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={postFormData.platforms.includes(
                                "Facebook"
                              )}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                setPostFormData((p: any) => ({
                                  ...p,
                                  platforms: checked
                                    ? Array.from(
                                        new Set([
                                          ...(p.platforms || []),
                                          "Facebook",
                                        ])
                                      )
                                    : (p.platforms || []).filter(
                                        (x: any) => x !== "Facebook"
                                      ),
                                }));
                                if (checked) setPlatformError(null);
                              }}
                            />
                            Facebook
                          </label>
                        </div>
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="hashtags" className="text-sm">
                        Hashtags
                      </Label>
                      <Input
                        id="hashtags"
                        value={postFormData.hashtags}
                        onChange={(e) =>
                          setPostFormData((p: any) => ({
                            ...p,
                            hashtags: e.target.value,
                          }))
                        }
                        placeholder="#marketing #socialmedia"
                        className="mt-2"
                      />
                    </div>

                    <div className="flex gap-2">
                      <Button
                        className="flex-1 hover:scale-105 transition-transform"
                        style={{
                          background: colors.gradientPrimary,
                          color: colors.primaryForeground,
                        }}
                        onClick={() => handlePublishPost()}
                      >
                        Publish Now
                      </Button>
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={() =>
                          toast(
                            "Schedule feature not implemented in this sample"
                          )
                        }
                      >
                        Schedule
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* AD inputs */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="campaignName" className="text-sm">
                          Campaign Name
                        </Label>
                        <Input
                          id="campaignName"
                          value={adFormData.campaignName}
                          onChange={(e) =>
                            setAdFormData((p: any) => ({
                              ...p,
                              campaignName: e.target.value,
                            }))
                          }
                          placeholder="My Campaign"
                          className="mt-2"
                        />
                      </div>
                      <div>
                        <Label htmlFor="adSetName" className="text-sm">
                          Ad Set Name
                        </Label>
                        <Input
                          id="adSetName"
                          value={adFormData.adSetName}
                          onChange={(e) =>
                            setAdFormData((p: any) => ({
                              ...p,
                              adSetName: e.target.value,
                            }))
                          }
                          placeholder="Ad Set Name (optional)"
                          className="mt-2"
                        />
                      </div>
                      <div>
                        <Label htmlFor="objective" className="text-sm">
                          Objective
                        </Label>
                        <select
                          id="objective"
                          value={adFormData.objective}
                          onChange={(e) =>
                            setAdFormData((p: any) => ({
                              ...p,
                              objective: e.target.value,
                            }))
                          }
                          className="mt-2 w-full h-9 rounded border px-2"
                        >
                          <option value="LINK_CLICKS">Link Clicks</option>
                          <option value="CONVERSIONS">Conversions</option>
                          <option value="BRAND_AWARENESS">
                            Brand Awareness
                          </option>
                          <option value="REACH">Reach</option>
                        </select>
                      </div>
                      <div>
                        <Label htmlFor="primaryCTA" className="text-sm">
                          Primary CTA
                        </Label>
                        <Input
                          id="primaryCTA"
                          value={adFormData.primaryCTA}
                          onChange={(e) =>
                            setAdFormData((p: any) => ({
                              ...p,
                              primaryCTA: e.target.value,
                            }))
                          }
                          placeholder="LEARN_MORE"
                          className="mt-2"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="destinationLink" className="text-sm">
                          Destination URL
                        </Label>
                        <Input
                          id="destinationLink"
                          value={adFormData.destinationLink}
                          onChange={(e) =>
                            setAdFormData((p: any) => ({
                              ...p,
                              destinationLink: e.target.value,
                            }))
                          }
                          placeholder="https://example.com"
                          className="mt-2"
                        />
                      </div>
                      <div>
                        <Label htmlFor="delivery" className="text-sm">
                          Delivery Type
                        </Label>
                        <select
                          id="delivery"
                          value={adFormData.delivery}
                          onChange={(e) =>
                            setAdFormData((p: any) => ({
                              ...p,
                              delivery: e.target.value,
                            }))
                          }
                          className="mt-2 w-full h-9 rounded border px-2"
                        >
                          <option value="">Default</option>
                          <option value="standard">Standard</option>
                          <option value="expedited">Expedited</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="budget" className="text-sm">
                          Budget
                        </Label>
                        <Input
                          id="budget"
                          type="number"
                          value={adFormData.budget}
                          onChange={(e) =>
                            setAdFormData((p: any) => ({
                              ...p,
                              budget: Number(e.target.value),
                            }))
                          }
                          placeholder="5000"
                          className="mt-2"
                        />
                      </div>
                      <div>
                        <Label htmlFor="duration" className="text-sm">
                          Duration (days)
                        </Label>
                        <Input
                          id="duration"
                          type="number"
                          value={adFormData.duration || 7}
                          onChange={(e) =>
                            setAdFormData((p: any) => ({
                              ...p,
                              duration: Number(e.target.value),
                            }))
                          }
                          placeholder="7"
                          className="mt-2"
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="targeting" className="text-sm">
                        Audience Targeting (interests)
                      </Label>
                      <Input
                        id="targeting"
                        value={adFormData.interests}
                        onChange={(e) =>
                          setAdFormData((p: any) => ({
                            ...p,
                            interests: e.target.value,
                          }))
                        }
                        placeholder="e.g., Fashion, Fitness"
                        className="mt-2"
                      />
                      <div className="mt-2 flex gap-2 items-center">
                        <div className="flex items-center gap-2">
                          <label className="inline-flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={adFormData.platforms.includes(
                                "Instagram"
                              )}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                setAdFormData((p: any) => ({
                                  ...p,
                                  platforms: checked
                                    ? Array.from(
                                        new Set([
                                          ...(p.platforms || []),
                                          "Instagram",
                                        ])
                                      )
                                    : (p.platforms || []).filter(
                                        (x: any) => x !== "Instagram"
                                      ),
                                }));
                              }}
                            />
                            Instagram
                          </label>
                          <label className="inline-flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={adFormData.platforms.includes(
                                "Facebook"
                              )}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                setAdFormData((p: any) => ({
                                  ...p,
                                  platforms: checked
                                    ? Array.from(
                                        new Set([
                                          ...(p.platforms || []),
                                          "Facebook",
                                        ])
                                      )
                                    : (p.platforms || []).filter(
                                        (x: any) => x !== "Facebook"
                                      ),
                                }));
                              }}
                            />
                            Facebook
                          </label>
                        </div>
                        <div className="ml-auto flex items-center gap-2">
                          <label className="inline-flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={!!adFormData.autoOptimize}
                              onChange={(e) =>
                                setAdFormData((p: any) => ({
                                  ...p,
                                  autoOptimize: e.target.checked,
                                }))
                              }
                            />
                            Auto optimize
                          </label>
                          <label className="inline-flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={!!adFormData.autoTarget}
                              onChange={(e) =>
                                setAdFormData((p: any) => ({
                                  ...p,
                                  autoTarget: e.target.checked,
                                }))
                              }
                            />
                            Auto target
                          </label>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        className="flex-1 hover:scale-105 transition-transform"
                        style={{
                          background: colors.gradientPrimary,
                          color: colors.primaryForeground,
                        }}
                        onClick={() => handleLaunchAd()}
                      >
                        Launch Ad Campaign
                      </Button>
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={async () => {
                          try {
                            const token =
                              (await supabase.auth.getSession()).data?.session
                                ?.access_token ?? null;
                            if (!token) {
                              toast.error("Sign in to save draft");
                              return;
                            }
                            await fetch("/api/campaigns/save-draft", {
                              method: "POST",
                              headers: {
                                "Content-Type": "application/json",
                                Authorization: `Bearer ${token}`,
                              },
                              body: JSON.stringify({
                                mode: "ad",
                                name: adFormData.campaignName,
                                inputs: adFormData,
                              }),
                            });
                            toast.success("Draft saved");
                          } catch (e) {
                            console.error("save-draft failed", e);
                            toast.error("Save failed");
                          }
                        }}
                      >
                        Save Draft
                      </Button>
                    </div>
                  </div>
                )}
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CampaignCreate;
