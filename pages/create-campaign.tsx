"use client";

// pages/create-campaign.tsx
// FULL working file — includes robust IndexedDB helpers that auto-recreate missing stores.
// Minimal change: robust openDb/idb helpers, persistence for chats, generated images, uploaded previews and logoPublicUrl.

import React, { useEffect, useRef, useState } from "react";
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
  ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";
import colors from "../lib/colors";
import { supabase } from "../lib/supabaseClient";

/* -------------------- Robust IndexedDB helpers -------------------- */
const DB_NAME = "optim-app-db";
const STORE_NAME = "images"; // existing store used elsewhere
const KV_STORE = "kv"; // simple key/value store

function createStoresOnUpgrade(db: IDBDatabase) {
  try {
    if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
    if (!db.objectStoreNames.contains(KV_STORE)) db.createObjectStore(KV_STORE);
  } catch (e) {
    console.warn("createStoresOnUpgrade error", e);
  }
}

/**
 * Open DB robustly. If the DB exists but missing stores, delete & recreate it automatically.
 * Returns a Promise<IDBDatabase>.
 */
function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    let triedRecreate = false;

    const tryOpen = () => {
      const req = indexedDB.open(DB_NAME, 1);

      req.onupgradeneeded = () => {
        const db = req.result as IDBDatabase;
        createStoresOnUpgrade(db);
      };

      req.onsuccess = () => {
        const db = req.result as IDBDatabase;
        // Quick check: if a required object store is missing, delete DB and recreate once
        if (!db.objectStoreNames.contains(STORE_NAME) || !db.objectStoreNames.contains(KV_STORE)) {
          db.close();
          if (triedRecreate) {
            // Something weird — give up
            reject(new Error("IndexedDB missing required stores after recreate attempt"));
            return;
          }
          triedRecreate = true;
          const delReq = indexedDB.deleteDatabase(DB_NAME);
          delReq.onsuccess = () => {
            // small delay to ensure deletion propagated
            setTimeout(() => tryOpen(), 50);
          };
          delReq.onerror = () => {
            reject(delReq.error || new Error("Failed to delete corrupt IndexedDB"));
          };
          return;
        }
        resolve(db);
      };

      req.onerror = () => {
        reject(req.error);
      };
    };

    tryOpen();
  });
}

async function idbPut(key: string, value: Blob | string) {
  try {
    const db = await openDb();
    return await new Promise<void>((resolve, reject) => {
      try {
        const tx = db.transaction(KV_STORE, "readwrite");
        const store = tx.objectStore(KV_STORE);
        const r = store.put(value, key);
        r.onsuccess = () => resolve();
        r.onerror = () => reject(r.error);
        tx.oncomplete = () => db.close();
      } catch (err) {
        db.close();
        reject(err);
      }
    });
  } catch (err: any) {
    // If the store was missing (NotFoundError), attempt to delete & recreate DB once, then retry
    if (err && (err.name === "NotFoundError" || /object store/i.test(String(err.message || "")))) {
      try {
        await new Promise<void>((res, rej) => {
          const del = indexedDB.deleteDatabase(DB_NAME);
          del.onsuccess = () => res();
          del.onerror = () => rej(del.error);
        });
        // retry once
        const db = await openDb();
        return await new Promise<void>((resolve, reject) => {
          try {
            const tx = db.transaction(KV_STORE, "readwrite");
            const store = tx.objectStore(KV_STORE);
            const r = store.put(value, key);
            r.onsuccess = () => resolve();
            r.onerror = () => reject(r.error);
            tx.oncomplete = () => db.close();
          } catch (e) {
            db.close();
            reject(e);
          }
        });
      } catch (e2) {
        throw e2;
      }
    }
    throw err;
  }
}

async function idbGet(key: string) {
  try {
    const db = await openDb();
    return await new Promise<any>((resolve, reject) => {
      try {
        const tx = db.transaction(KV_STORE, "readonly");
        const store = tx.objectStore(KV_STORE);
        const r = store.get(key);
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error);
        tx.oncomplete = () => db.close();
      } catch (err) {
        db.close();
        reject(err);
      }
    });
  } catch (err: any) {
    if (err && (err.name === "NotFoundError" || /object store/i.test(String(err.message || "")))) {
      // recreate DB and retry once
      await new Promise<void>((res, rej) => {
        const del = indexedDB.deleteDatabase(DB_NAME);
        del.onsuccess = () => res();
        del.onerror = () => rej(del.error);
      });
      const db = await openDb();
      return await new Promise<any>((resolve, reject) => {
        try {
          const tx = db.transaction(KV_STORE, "readonly");
          const store = tx.objectStore(KV_STORE);
          const r = store.get(key);
          r.onsuccess = () => resolve(r.result);
          r.onerror = () => reject(r.error);
          tx.oncomplete = () => db.close();
        } catch (e) {
          db.close();
          reject(e);
        }
      });
    }
    throw err;
  }
}

// image store helpers (same pattern)
async function idbPutImage(key: string, value: Blob | string) {
  try {
    const db = await openDb();
    return await new Promise<void>((resolve, reject) => {
      try {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        const r = store.put(value, key);
        r.onsuccess = () => resolve();
        r.onerror = () => reject(r.error);
        tx.oncomplete = () => db.close();
      } catch (err) {
        db.close();
        reject(err);
      }
    });
  } catch (err: any) {
    if (err && (err.name === "NotFoundError" || /object store/i.test(String(err.message || "")))) {
      await new Promise<void>((res, rej) => {
        const del = indexedDB.deleteDatabase(DB_NAME);
        del.onsuccess = () => res();
        del.onerror = () => rej(del.error);
      });
      const db = await openDb();
      return await new Promise<void>((resolve, reject) => {
        try {
          const tx = db.transaction(STORE_NAME, "readwrite");
          const store = tx.objectStore(STORE_NAME);
          const r = store.put(value, key);
          r.onsuccess = () => resolve();
          r.onerror = () => reject(r.error);
          tx.oncomplete = () => db.close();
        } catch (e) {
          db.close();
          reject(e);
        }
      });
    }
    throw err;
  }
}

async function idbGetImage(key: string) {
  try {
    const db = await openDb();
    return await new Promise<any>((resolve, reject) => {
      try {
        const tx = db.transaction(STORE_NAME, "readonly");
        const store = tx.objectStore(STORE_NAME);
        const r = store.get(key);
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error);
        tx.oncomplete = () => db.close();
      } catch (err) {
        db.close();
        reject(err);
      }
    });
  } catch (err: any) {
    if (err && (err.name === "NotFoundError" || /object store/i.test(String(err.message || "")))) {
      await new Promise<void>((res, rej) => {
        const del = indexedDB.deleteDatabase(DB_NAME);
        del.onsuccess = () => res();
        del.onerror = () => rej(del.error);
      });
      const db = await openDb();
      return await new Promise<any>((resolve, reject) => {
        try {
          const tx = db.transaction(STORE_NAME, "readonly");
          const store = tx.objectStore(STORE_NAME);
          const r = store.get(key);
          r.onsuccess = () => resolve(r.result);
          r.onerror = () => reject(r.error);
          tx.oncomplete = () => db.close();
        } catch (e) {
          db.close();
          reject(e);
        }
      });
    }
    throw err;
  }
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

/* -------------------- Mic Recorder (original logic) -------------------- */
type MicRecorderProps = {
  onText: (chunk: string) => void;
  lang?: string;
  className?: string;
  small?: boolean;
};

const MicRecorder: React.FC<MicRecorderProps> = ({ onText, lang = "ta-IN", className, small }) => {
  const [recording, setRecording] = useState(false);
  const recognitionRef = useRef<any>(null);
  const supported = typeof window !== "undefined" && (window as any).webkitSpeechRecognition;

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

/* -------------------- Chat persistence types -------------------- */
type Chat = {
  id: string;
  title: string;
  messages: any[]; // use same message shape you already have
  createdAt: number;
  updatedAt: number;
};

/* -------------------- Keys for persistence -------------------- */
const CHATS_KEY = "optim_chats_v1";
const GENERATED_KEY = "optim_generated_images_v1";
const UPLOADED_KEY = "optim_uploaded_images_v1";
const LOGO_KEY = "optim_logo_v1";

/* -------------------- Main Component -------------------- */
const CampaignCreate: React.FC = () => {
  const router = useRouter();

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Credits simple local state (replace with your actual hook if you want)
  const [credits, setCredits] = useState<number>(10);
  const useCredit = () => {
    if (credits <= 0) return false;
    setCredits((c) => c - 1);
    return true;
  };

  // Chat state
  const [chats, setChats] = useState<Chat[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<any[]>([]); // mirror of active chat messages

  // Loading / UI state
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [showUploadPanel, setShowUploadPanel] = useState(false);
  const [showPublishPanel, setShowPublishPanel] = useState(false);
  const [publishMode, setPublishMode] = useState<"post" | "ad">("post");

  const [uploadedImages, setUploadedImages] = useState<File[]>([]);
  const [uploadedPreviews, setUploadedPreviews] = useState<string[]>([]);

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoPublicUrl, setLogoPublicUrl] = useState<string | null>(null);
  const [logoGlowing, setLogoGlowing] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const [quickSettings, setQuickSettings] = useState({
    logoEnabled: false,
    themeEnabled: false,
    aspectRatio: "1:1",
    tone: "professional",
    audience: "",
  });

  // form data (keeps compatibility with your backend)
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
    // extra fields for Ads
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

  // generated images
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  // pending image that user must verify before publishing
  const [pendingGeneratedImage, setPendingGeneratedImage] = useState<string | null>(null);

  const [showThemeOptions, setShowThemeOptions] = useState(false);
  const [showAspectOptions, setShowAspectOptions] = useState(false);

  /* -------------------- Previews management -------------------- */
  useEffect(() => {
    uploadedPreviews.forEach((u) => {
      try {
        URL.revokeObjectURL(u);
      } catch {}
    });
    const newPreviews = uploadedImages.map((f) => URL.createObjectURL(f));
    setUploadedPreviews(newPreviews);
    return () => newPreviews.forEach((u) => {
      try {
        URL.revokeObjectURL(u);
      } catch {}
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uploadedImages]);

  useEffect(() => {
    if (logoFile) {
      const u = URL.createObjectURL(logoFile);
      setLogoPreview(u);
      return () => {
        try {
          URL.revokeObjectURL(u);
        } catch {}
      };
    } else {
      setLogoPreview(null);
    }
  }, [logoFile]);

  /* -------------------- Load profile + initial credits + chats + persisted UI state -------------------- */
  useEffect(() => {
    (async () => {
      try {
        const { data: userData } = await supabase.auth.getUser();
        const user = (userData as any)?.user;
        if (!user) return;

        const { data: profile, error } = await supabase.from("profiles").select("*").eq("id", user.id).single();
        if (!error && profile) {
          if (profile.tagline) {
            setAdFormData((p: any) => ({ ...p, tagline: p.tagline || profile.tagline }));
            setPostFormData((p: any) => ({ ...p, tagline: p.tagline || profile.tagline }));
          }
          const logoPath = profile.logo_path ?? null;
          if (logoPath) {
            const { data: publicData } = supabase.storage.from("user-uploads").getPublicUrl(logoPath);
            const publicUrl = (publicData as any)?.publicUrl ?? null;
            if (publicUrl) {
              setLogoPublicUrl(publicUrl);
              setLogoGlowing(true);
              setAdFormData((p: any) => ({ ...p, logoPublicUrl: p.logoPublicUrl || publicUrl }));
              setPostFormData((p: any) => ({ ...p, logoPublicUrl: p.logoPublicUrl || publicUrl }));
            }
          }
          if ((profile as any).credits !== undefined) setCredits(Number((profile as any).credits) || 0);
        }
      } catch (e) {
        console.warn("profile fetch error", e);
      }

      // load chats from IndexedDB
      try {
        const raw = await idbGet(CHATS_KEY);
        if (raw) {
          const parsed: Chat[] = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setChats(parsed);
            setCurrentChatId(parsed[0].id);
            setMessages(parsed[0].messages || []);
          }
        }
      } catch (e) {
        console.warn("failed to load chats from idb", e);
      }

      // if no chats found, create a default one
      try {
        const existing = await idbGet(CHATS_KEY);
        if (existing == null) {
          const defaultChat: Chat = {
            id: `chat_${Date.now()}`,
            title: "New Chat",
            messages: [],
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };
          setChats([defaultChat]);
          setCurrentChatId(defaultChat.id);
          setMessages([]);
          try {
            await idbPut(CHATS_KEY, JSON.stringify([defaultChat]));
          } catch (e) {
            console.warn("failed to save default chat", e);
          }
        }
      } catch (e) {
        console.warn("check existing chats failed", e);
      }

      // rehydrate generated images
      try {
        const genRaw = await idbGet(GENERATED_KEY);
        if (genRaw) {
          const parsedGen = JSON.parse(genRaw as string);
          if (Array.isArray(parsedGen)) setGeneratedImages(parsedGen);
        }
      } catch (e) {
        console.warn("failed to load generated images from idb", e);
      }

      // rehydrate uploaded previews (we stored dataurls as a convenience so the UI shows images)
      try {
        const upRaw = await idbGet(UPLOADED_KEY);
        if (upRaw) {
          const parsedUp: string[] = JSON.parse(upRaw as string);
          if (Array.isArray(parsedUp)) {
            setUploadedPreviews(parsedUp);
            // Note: we cannot reconstruct File objects from the browser for security reasons.
            // If the user needs to send the original files later, they should re-upload. The preview keeps the UX.
          }
        }
      } catch (e) {
        console.warn("failed to load uploaded images from idb", e);
      }

      // rehydrate logoPublicUrl
      try {
        const logoRaw = await idbGet(LOGO_KEY);
        if (logoRaw) {
          const logo = String(logoRaw || "") || null;
          if (logo) {
            setLogoPublicUrl(logo);
            setLogoGlowing(true);
          }
        }
      } catch (e) {
        console.warn("failed to load logo from idb", e);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* -------------------- Chat persistence helpers -------------------- */
  const saveChatsToDb = async (nextChats: Chat[]) => {
    try {
      await idbPut(CHATS_KEY, JSON.stringify(nextChats));
    } catch (e) {
      console.warn("saveChatsToDb failed", e);
    }
  };

  const createNewChat = async (title = "New Chat") => {
    const nc: Chat = {
      id: `chat_${Date.now()}`,
      title: title || "New Chat",
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setChats((prevChats) => {
      const next = [nc, ...prevChats];
      setCurrentChatId(nc.id);
      setMessages([]);
      // persist
      saveChatsToDb(next).catch((e) => console.warn("saveChatsToDb failed", e));
      return next;
    });
    toast.success("New chat created");
  };

  const switchToChat = (chatId: string) => {
    const c = chats.find((x) => x.id === chatId);
    if (!c) return;
    setCurrentChatId(chatId);
    setMessages(c.messages || []);
  };

  const updateCurrentChatMessages = (newMessages: any[]) => {
    setMessages(newMessages);
    setChats((prev) => {
      const next = prev.map((c) => (c.id === currentChatId ? { ...c, messages: newMessages, updatedAt: Date.now() } : c));
      // persist
      saveChatsToDb(next).catch((e) => console.warn(e));
      return next;
    });
  };

  const renameChat = async (chatId: string, newTitle: string) => {
    setChats((prev) => {
      const next = prev.map((c) => (c.id === chatId ? { ...c, title: newTitle || c.title, updatedAt: Date.now() } : c));
      // persist
      saveChatsToDb(next).catch((e) => console.warn("saveChatsToDb failed", e));
      return next;
    });
  };

  const deleteChat = async (chatId: string) => {
    setChats((prev) => {
      const next = prev.filter((c) => c.id !== chatId);
      // if active chat got deleted, switch to first or create default
      if (chatId === currentChatId) {
        if (next.length > 0) {
          const first = next[0];
          setCurrentChatId(first.id);
          setMessages(first.messages || []);
        } else {
          const defaultChat: Chat = {
            id: `chat_${Date.now()}`,
            title: "New Chat",
            messages: [],
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };
          setCurrentChatId(defaultChat.id);
          setMessages([]);
          // persist default
          saveChatsToDb([defaultChat]).catch((e) => console.warn(e));
          return [defaultChat];
        }
      }
      // persist
      saveChatsToDb(next).catch((e) => console.warn(e));
      return next;
    });
  };

  /* -------------------- Persist other UI state helpers -------------------- */
  const saveGeneratedToDb = async (arr: string[]) => {
    try {
      await idbPut(GENERATED_KEY, JSON.stringify(arr || []));
    } catch (e) {
      console.warn("saveGeneratedToDb failed", e);
    }
  };

  const saveUploadsToDb = async (filesDataUrls: string[]) => {
    try {
      await idbPut(UPLOADED_KEY, JSON.stringify(filesDataUrls || []));
    } catch (e) {
      console.warn("saveUploadsToDb failed", e);
    }
  };

  const saveLogoToDb = async (logoUrl: string | null) => {
    try {
      await idbPut(LOGO_KEY, logoUrl || "");
    } catch (e) {
      console.warn("saveLogoToDb failed", e);
    }
  };

  // persist generated images when changed
  useEffect(() => {
    saveGeneratedToDb(generatedImages).catch((e) => console.warn(e));
  }, [generatedImages]);

  // persist uploaded images (we'll store them as dataURLs so they can be rehydrated)
  useEffect(() => {
    (async () => {
      try {
        const dataUrls = await Promise.all(
          uploadedImages.map(async (f) => {
            if (f instanceof File || f instanceof Blob) {
              return await new Promise<string>((res, rej) => {
                const r = new FileReader();
                r.onload = () => res(String(r.result));
                r.onerror = rej;
                r.readAsDataURL(f);
              });
            }
            return "";
          })
        );
        await saveUploadsToDb(dataUrls.filter(Boolean));
      } catch (e) {
        console.warn("persist uploadedImages failed", e);
      }
    })();
  }, [uploadedImages]);

  // persist logoPublicUrl
  useEffect(() => {
    saveLogoToDb(logoPublicUrl).catch((e) => console.warn(e));
  }, [logoPublicUrl]);

  /* -------------------- Access token helper -------------------- */
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

  /* -------------------- Handlers -------------------- */

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (uploadedImages.length + files.length > 3) {
      toast.error("Maximum 3 images allowed");
      return;
    }
    setUploadedImages((prev) => [...prev, ...files.slice(0, 3 - prev.length)]);
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    if (!file) return;
    setLogoFile(file);
    toast.success("Logo selected (local preview)");

    // Upload to supabase user-uploads and update profile.logo_path
    try {
      const { data: userData } = await supabase.auth.getUser();
      const user = (userData as any)?.user;
      if (!user) return;
      const safe = `${user.id}_${Date.now()}_${file.name.replace(/\s+/g, "_")}`;
      const path = `profiles/${user.id}/${safe}`;
      const { error: uploadError } = await supabase.storage.from("user-uploads").upload(path, file, { cacheControl: "3600", upsert: true });
      if (uploadError) {
        console.warn("logo upload error", uploadError);
        toast.warning("Logo uploaded locally but public upload failed.");
        return;
      }
      const { data: publicData } = supabase.storage.from("user-uploads").getPublicUrl(path);
      const publicUrl = (publicData as any)?.publicUrl ?? null;
      if (publicUrl) {
        setLogoPublicUrl(publicUrl);
        setLogoGlowing(true);
        try {
          await supabase.from("profiles").upsert({ id: user.id, logo_path: path, tagline: adFormData.tagline || null }, { returning: "minimal" });
          toast.success("Logo uploaded and saved to profile");
        } catch (e) {
          console.warn("save logo path failed", e);
          toast.success("Logo uploaded but profile update failed");
        }
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
      const { data: userData } = await supabase.auth.getUser();
      const user = (userData as any)?.user;
      if (user) {
        await supabase.from("profiles").upsert({ id: user.id, logo_path: null }, { returning: "minimal" });
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

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      startGenerate();
    }
  };

  /* -------------------- Caption enhancer -------------------- */
  const enhancePrompt = async (text: string) => {
    try {
      if (!text || !text.trim()) {
        toast.error("Write something to enhance.");
        return null;
      }
      const token = await getAccessToken();
      if (!token) {
        toast.error("Sign in to use enhancer.");
        return null;
      }
      const promptBody = `Enhance the following campaign description for clarity, persuasion, and ad copy effectiveness. Keep brand names intact. Only return the enhanced text (no commentary).\n\n---\n${text}`;
      const resp = await fetch("/api/enhancePrompt", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
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

  /* -------------------- Generation flow (image preview first) -------------------- */

  const startGenerate = async () => {
    if (!prompt.trim() && uploadedImages.length === 0) {
      toast.error("Please describe your campaign or upload images");
      return;
    }

    if (credits <= 0) {
      toast.error("No credits available", { description: "Please upgrade your plan to continue creating campaigns." });
      return;
    }

    const ok = useCredit();
    if (!ok) return;

    // Add user message to thread (and persist)
    const userMessage = { role: "user", content: prompt || "Generate from uploaded images", imageUrl: null };
    const newMessages = [...messages, userMessage];
    updateCurrentChatMessages(newMessages);

    setPrompt("");
    setShowUploadPanel(false);
    setIsGenerating(true);

    try {
      const token = await getAccessToken();
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
        description: prompt || adFormData.description,
        emotion: adFormData.emotion,
        offerInfo: adFormData.offerInfo,
        prompt: prompt || (uploadedPreviews.length ? "Generate from uploaded images" : ""),
        target: { width: quickSettings.aspectRatio === "16:9" ? 1920 : 1080, height: 1080 },
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
        resp = await fetch("/api/generate-campaign", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd });
      } else {
        resp = await fetch("/api/generate-campaign", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify(payload),
        });
      }

      const json = await resp.json();
      if (!resp.ok || !json || !json.ok) {
        console.error("generate error", json);
        throw new Error((json && json.error) || `Generation failed: ${resp.status}`);
      }

      const first = typeof json.image === "string" ? json.image : (Array.isArray(json.images) && json.images.length ? json.images[0] : null);
      const imageUrl = first ?? uploadedPreviews[0] ?? null;
      if (!imageUrl) throw new Error("No image returned");

      // Assistant message
      const assistantMessage = {
        role: "assistant",
        content: `Generated preview${adFormData.brandName ? ` for ${adFormData.brandName}` : ""}. Verify and proceed to publish.`,
        imageUrl: imageUrl,
      };
      const after = [...newMessages, assistantMessage];
      updateCurrentChatMessages(after);

      // If server returned creditsRemaining, update local credits too
      try {
        if (json.creditsRemaining !== undefined && json.creditsRemaining !== null) {
          setCredits(Number(json.creditsRemaining));
        }
      } catch (e) {
        // ignore
      }

      setPendingGeneratedImage(imageUrl);
      setIsGenerating(false);
      toast.success("Image ready — verify before publishing");

      // persist the generated image in the gallery
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

    // Save to generated images (most recent first) - already saved in startGenerate but ensure persist
    setGeneratedImages((prev) => {
      const next = [pendingGeneratedImage!, ...prev.filter((p) => p !== pendingGeneratedImage)];
      return next;
    });
    // Also append a confirmation assistant message to chat
    const confirmMsg = { role: "assistant", content: "User proceeded to publish with this creative.", imageUrl: pendingGeneratedImage };
    updateCurrentChatMessages([...messages, confirmMsg]);

    // clear pending
    setPendingGeneratedImage(null);
    // open publish modal
    setShowPublishPanel(true);
    // persist to session as preview (optional)
    try {
      const previewObj = { inputs: { adFormData, quickSettings }, image: pendingGeneratedImage, images: [pendingGeneratedImage] };
      sessionStorage.setItem("preview", JSON.stringify(previewObj));
    } catch (e) {
      console.warn("session set failed", e);
    }
  };

  /* -------------------- Caption & Hashtags wiring -------------------- */
  const generateCaption = async (promptText: string, setResult: (text: string) => void) => {
    try {
      if (!promptText || !promptText.trim()) {
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
        body: JSON.stringify({ prompt: promptText }),
      });
      const json = await resp.json();
      if (!resp.ok || !json) throw new Error((json && json.error) || "AI generation failed");
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

  /* -------------------- Publish flows -------------------- */

  // Handle publish post - will auto-generate post name if missing
  const handlePublishPost = async () => {
    try {
      if (generatedImages.length === 0) {
        toast.error("No generated image to publish. Generate and proceed first.");
        return;
      }

      if (!postFormData.platforms || postFormData.platforms.length === 0) {
        toast.error("Select at least one platform to post to (Instagram / Facebook).");
        return;
      }

      const { data: userData } = await supabase.auth.getUser();
      const user = (userData as any)?.user;
      if (!user) {
        toast.error("You must be signed in to publish a post.");
        router.push("/auth/signin");
        return;
      }

      // auto-generate post name if missing
      let finalName = (postFormData.postName || "").trim();
      if (!finalName) {
        finalName = `Post_${Date.now()}`;
        setPostFormData((p: any) => ({ ...p, postName: finalName }));
      }

      const imageToPublish = generatedImages[0];
      let image_url = imageToPublish;
      let image_path = "";

      // If image is dataURL, upload to supabase campaign-assets
      if (imageToPublish.startsWith("data:")) {
        const blob = dataURLtoBlob(imageToPublish);
        const safeName = (finalName || "post").replace(/[^a-z0-9_\-]/gi, "_").toLowerCase();
        const filename = `${user.id}_${Date.now()}_${safeName}.png`;
        const path = `campaigns/${user.id}/${filename}`;
        const { error: uploadError } = await supabase.storage.from("campaign-assets").upload(path, blob, { cacheControl: "3600", upsert: false });
        if (uploadError) throw uploadError;
        const { data: publicData } = supabase.storage.from("campaign-assets").getPublicUrl(path);
        image_url = (publicData as any)?.publicUrl ?? imageToPublish;
        image_path = path;
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
        output: { caption: postFormData.generatedCaption || null } || null,
        image_url: [image_url],
        image_path: [image_path],
        is_published: true,
      };

      const { data: inserted, error: insertError } = await supabase.from("campaigns").insert([payload]).select();
      if (insertError) throw insertError;

      // ----------------------------
      // 🔥 INSTAGRAM POSTING LOGIC
      // ----------------------------
      if (postFormData.platforms.includes("Instagram")) {
        try {
          await fetch("/api/auth/instagram/post", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              image_url,
              caption: postFormData.generatedCaption || postFormData.postName || "",
              alsoPostToFacebook: postFormData.platforms.includes("Facebook"),
            }),
          });
        } catch (e) {
          console.error("Instagram post failed", e);
          toast.error("Instagram posting failed (see console).");
        }
      }

      // ---------------------------------
      // 🔥 FACEBOOK POSTING (if selected and not cross-posted)
      // ---------------------------------
      if (postFormData.platforms.includes("Facebook") && !postFormData.platforms.includes("Instagram")) {
        try {
          await fetch("/api/auth/facebook/post", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              image_url,
              caption: postFormData.generatedCaption || postFormData.postName || "",
            }),
          });
        } catch (e) {
          console.error("Facebook post failed", e);
          toast.error("Facebook posting failed (see console).");
        }
      }

      toast.success("Post published (saved).");
      setShowPublishPanel(false);
      router.push("/dashboard");
    } catch (e: any) {
      console.error("handlePublishPost error", e);
      toast.error("Publish failed: " + (e?.message || String(e)));
    }
  };

  // Replace your existing handleLaunchAd with this function (drop-in)
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

      const { data: userData } = await supabase.auth.getUser();
      const user = (userData as any)?.user;
      if (!user) {
        toast.error("You must be signed in to run ads.");
        router.push("/auth/signin");
        return;
      }

      // Helper: map legacy/UX objective strings to Meta's OUTCOME_* values
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
            // REACH is commonly used for awareness/reach — map to awareness outcome
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
            // safe default: traffic
            return "OUTCOME_TRAFFIC";
        }
      };

      // Prepare image: if data URL upload to supabase, else use public HTTP URL
      const imageToUse = generatedImages[0];
      let creativeImageUrl = "";
      let creativeImageDataUrl: string | undefined = undefined;

      if (imageToUse.startsWith("data:")) {
        try {
          const blob = dataURLtoBlob(imageToUse);
          const safeName = (adFormData.campaignName || "ad").replace(/[^a-z0-9_\-]/gi, "_").toLowerCase();
          const filename = `${user.id}_${Date.now()}_${safeName}.png`;
          const path = `campaigns/${user.id}/${filename}`;
          const { error: uploadError } = await supabase.storage.from("campaign-assets").upload(path, blob, { cacheControl: "3600", upsert: true });
          if (uploadError) throw uploadError;
          const { data: publicData } = supabase.storage.from("campaign-assets").getPublicUrl(path);
          creativeImageUrl = (publicData as any)?.publicUrl ?? "";
          if (!creativeImageUrl) creativeImageDataUrl = imageToUse; // fallback
        } catch (e) {
          console.error("upload creative to supabase failed", e);
          creativeImageDataUrl = imageToUse; // still send data URL if upload failed
        }
      } else if (imageToUse.startsWith("http")) {
        creativeImageUrl = imageToUse;
      }

      // Save campaign record locally (unchanged behaviour)
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

      const { data: inserted, error } = await supabase.from("campaigns").insert([payloadDb]).select();
      if (error) throw error;

      // Map your objective to Meta expected value
      const mappedObjective = mapObjectiveToMeta(adFormData.objective);

      // Build payload for facebook/ads endpoint (matches server expectations)
      const adPayload: any = {
        campaignName: adFormData.campaignName,
        // send the mapped objective (OUTCOME_*)
        objective: mappedObjective,
        platforms: adFormData.platforms,
        adSetName: adFormData.adSetName || `${adFormData.campaignName || "Campaign"} AdSet ${Date.now()}`,
        targeting: undefined, // server will fallback to adFormData fields if needed
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

      // Call server endpoint to create FB campaign/adset/creative/ad, include Authorization token
      try {
        const token = await getAccessToken();
        if (!token) {
          toast.error("You must be signed in to run ads.");
          return;
        }

        const resp = await fetch("/api/auth/facebook/ads", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify(adPayload),
        });

        // Properly parse and show server response
        const json = await resp.json();
        if (!resp.ok) {
          console.error("facebook/ads returned error:", json);
          // if the server returns step-specific error forward it to console and toast
          toast.error("Facebook Ads creation failed. See console for details.");
        } else {
          toast.success("Facebook Ads created (or saved).");
          console.info("facebook/ads response:", json);
        }
      } catch (e) {
        console.error("facebook/ads call failed", e);
        toast.error("Facebook Ads creation failed (see console).");
      }

      setShowPublishPanel(false);
      router.push("/dashboard");
    } catch (e: any) {
      console.error("handleLaunchAd error", e);
      toast.error("Launch failed: " + (e?.message || String(e)));
    }
  };

  /* -------------------- UI Render -------------------- */

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Sidebar */}
      <aside className={`transition-all duration-300 ${sidebarCollapsed ? "w-16" : "w-64"} bg-white border-r`} style={{ minHeight: "100vh" }}>
        <div className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${logoGlowing ? "ring-4 ring-offset-2" : ""}`} style={{ background: colors.primary, boxShadow: logoGlowing ? `0 6px 20px ${colors.primary}33` : undefined }}>
              {logoPublicUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoPublicUrl} alt="logo" className="w-8 h-8 rounded-full object-cover" />
              ) : (
                <span className="text-white font-bold">OP</span>
              )}
            </div>
            {!sidebarCollapsed && <div className="font-semibold">OPTIM</div>}
          </div>
          <button onClick={() => setSidebarCollapsed((s) => !s)} className="p-1 rounded">
            <ArrowLeft className={`transform ${sidebarCollapsed ? "rotate-180" : ""}`} />
          </button>
        </div>

        <nav className="px-3 mt-4">
          <button onClick={() => router.push("/dashboard")} className="w-full text-left px-3 py-2 rounded hover:bg-slate-50">
            Dashboard
          </button>
          <button onClick={() => router.push("/campaigns")} className="w-full text-left px-3 py-2 rounded hover:bg-slate-50">
            Campaigns
          </button>
          <button onClick={() => router.push("/create-campaign")} className="w-full text-left px-3 py-2 rounded bg-primary/5">
            Create Campaign
          </button>
        </nav>
      </aside>

      {/* Main content area */}
      <div className="flex-1">
        <NavBar />
        <div className="sticky top-0 z-40 bg-background/80 border-b px-6 py-3">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Create Campaign</h1>
              <div className="text-sm text-muted-foreground">Chat: {chats.find((c) => c.id === currentChatId)?.title || "—"}</div>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant="secondary">Credits: {credits}</Badge>
            </div>
          </div>

          {/* Chat switcher row */}
          <div className="max-w-7xl mx-auto mt-3 flex items-center gap-2">
            <Button size="sm" onClick={() => createNewChat()}>
              <Plus className="w-4 h-4 mr-2" /> New Chat
            </Button>
            <div className="flex gap-2 overflow-x-auto">
              {chats.map((c) => (
                <div key={c.id} className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border ${c.id === currentChatId ? "bg-primary/10 border-primary" : "bg-white"}`}>
                  <button onClick={() => switchToChat(c.id)} className="text-sm font-medium">
                    {c.title}
                  </button>
                  <button
                    title="Rename"
                    onClick={() => {
                      const t = prompt("Rename chat", c.title);
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
                    title="Delete chat"
                    onClick={() => {
                      if (confirm("Delete this chat?")) deleteChat(c.id);
                    }}
                    className="text-xs px-1"
                  >
                    🗑
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <main className="max-w-6xl mx-auto p-6 pb-40">
          {/* If no messages show welcome */}
          {messages.length === 0 ? (
            <div className="flex items-center justify-center py-24">
              <div className="text-center">
                <div className="mx-auto w-28 h-28 rounded-full flex items-center justify-center" style={{ background: colors.gradientHero }}>
                  <Sparkles className="w-12 h-12 text-white" />
                </div>
                <h2 className="text-4xl font-bold mt-6">Hello, Creator</h2>
                <p className="text-lg mt-3" style={{ color: colors.mutedForeground }}>
                  Describe your campaign idea or upload product images to get started with AI-powered creation
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-6 mb-8">
              {messages.map((m, idx) => (
                <div key={idx} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <Card className="max-w-2xl p-5" style={{ background: m.role === "user" ? `${colors.primary}0c` : colors.card, border: `1px solid ${colors.border}` }}>
                    <p style={{ color: colors.cardForeground }}>{m.content}</p>
                    {m.imageUrl && (
                      <div className="mt-3">
                        <img src={m.imageUrl} alt="generated" className="w-full rounded-lg border" style={{ borderColor: colors.border }} />
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
                              const filtered = messages.filter((_, i) => i !== idx);
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
                  <Card className="p-4" style={{ background: colors.card, border: `1px solid ${colors.border}` }}>
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full animate-pulse" style={{ background: colors.primary }} />
                      <div style={{ color: colors.mutedForeground }}>Generating your campaign...</div>
                    </div>
                  </Card>
                </div>
              )}
            </div>
          )}

          {/* Pending preview */}
          {pendingGeneratedImage && (
            <div className="mb-6">
              <Card className="p-4">
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1">
                    <img src={pendingGeneratedImage} alt="preview" className="w-full rounded-lg object-contain" />
                  </div>
                  <div className="w-full md:w-80">
                    <h4 className="font-semibold">Preview ready</h4>
                    <p className="text-sm mt-2" style={{ color: colors.mutedForeground }}>
                      Verify the generated image here. If it looks good, click Proceed to Publish. Otherwise, Regenerate or Dismiss.
                    </p>
                    <div className="mt-4 flex gap-2">
                      <Button onClick={() => { setPendingGeneratedImage(null); toast("Preview dismissed"); }} variant="outline">
                        Dismiss
                      </Button>
                      <Button style={{ background: colors.gradientPrimary, color: colors.primaryForeground }} onClick={handleProceedToPublish}>
                        Proceed to Publish
                      </Button>
                      <Button variant="outline" onClick={() => { setPendingGeneratedImage(null); startGenerate(); }}>
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
                  <div key={idx} className="relative group border rounded overflow-hidden">
                    <img src={g} alt={`generated-${idx}`} className="w-full h-40 object-cover" />
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button size="sm" variant="ghost" onClick={() => setGeneratedImages((prev) => prev.filter((_, i) => i !== idx))}>
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>

        {/* Bottom fixed input */}
        <div className="fixed bottom-0 left-0 right-0" style={{ background: `${colors.background}ee`, borderTop: `1px solid ${colors.border}` }}>
          <div className="max-w-6xl mx-auto px-6 py-4 space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant={quickSettings.logoEnabled ? "default" : "outline"} onClick={() => setQuickSettings((q) => ({ ...q, logoEnabled: !q.logoEnabled }))}>
                <ImageIcon className="w-3 h-3 mr-2" />
                Logo
              </Button>

              <div className="relative">
                <Button size="sm" variant={quickSettings.themeEnabled ? "default" : "outline"} onClick={() => setShowThemeOptions((s) => !s)}>
                  <Palette className="w-3 h-3 mr-2" />
                  {quickSettings.themeEnabled ? quickSettings.tone : "Theme"}
                </Button>
                {showThemeOptions && (
                  <div className="absolute bottom-full mb-2 right-0 bg-white border p-2 rounded shadow-lg z-40 w-44">
                    <div className="text-xs font-semibold mb-2">Pick theme</div>
                    <div className="flex flex-col gap-2">
                      {["professional", "playful", "festive", "minimal"].map((t) => (
                        <button key={t} onClick={() => { setQuickSettings((q) => ({ ...q, tone: t, themeEnabled: true })); setShowThemeOptions(false); toast.success(`Theme: ${t}`); }} className={`text-left px-2 py-1 rounded ${quickSettings.tone === t ? "bg-primary/10" : ""}`}>
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="relative">
                <Button size="sm" variant="outline" onClick={() => setShowAspectOptions((s) => !s)}>
                  <LayoutTemplate className="w-3 h-3 mr-2" />
                  {quickSettings.aspectRatio}
                </Button>
                {showAspectOptions && (
                  <div className="absolute bottom-full mb-2 right-0 bg-white border p-2 rounded shadow-lg z-40 w-40">
                    <div className="text-xs font-semibold mb-2">Aspect ratio</div>
                    <div className="flex flex-col gap-2">
                      {["1:1", "4:5", "9:16", "16:9"].map((r) => (
                        <button key={r} onClick={() => { setQuickSettings((q) => ({ ...q, aspectRatio: r })); setShowAspectOptions(false); toast.success(`Aspect: ${r}`); }} className="text-left px-2 py-1 rounded hover:bg-slate-50">
                          {r}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <Button size="sm" variant="outline" onClick={() => setQuickSettings((q) => ({ ...q, tone: q.tone === "professional" ? "playful" : "professional" }))}>
                <Smile className="w-3 h-3 mr-2" />
                {quickSettings.tone}
              </Button>

              {quickSettings.audience && (
                <Badge variant="secondary" className="px-3 py-1.5">
                  <Users className="w-3 h-3 mr-1" />
                  {quickSettings.audience}
                </Badge>
              )}
            </div>

            {/* Input bar */}
            <div className="relative">
              <div className="flex items-end gap-3 p-2 rounded-3xl" style={{ background: colors.card, border: `2px solid ${colors.border}` }}>
                <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*" multiple className="hidden" />
                <input type="file" ref={logoInputRef} onChange={handleLogoUpload} accept="image/*" className="hidden" />

                <Button size="icon" variant="ghost" onClick={() => setShowUploadPanel((s) => !s)} className="rounded-full">
                  <Plus className="w-5 h-5" />
                </Button>

                <Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} onKeyDown={handleKeyPress} placeholder="Describe your campaign idea or upload product images to get started…" className="flex-1 min-h-[52px] max-h-32 bg-transparent border-0 resize-none text-base" disabled={isGenerating || credits <= 0} />

                <div className="flex items-center gap-2">
                  <MicRecorder onText={(chunk) => setPrompt((p) => (p ? p + " " + chunk : chunk))} lang="ta-IN" small />
                  <Button size="icon" variant="outline" onClick={async () => { const enhanced = await enhancePrompt(prompt || adFormData.description || ""); if (enhanced) setPrompt(enhanced); }} title="Enhance prompt">
                    <Sparkles className="w-5 h-5" />
                  </Button>
                  <Button size="icon" onClick={startGenerate} disabled={isGenerating || credits <= 0 || (!prompt.trim() && uploadedImages.length === 0)} className="rounded-full" style={{ background: colors.gradientPrimary }}>
                    <Send className="w-5 h-5 text-white" />
                  </Button>
                </div>
              </div>

              {/* Upload panel */}
              {showUploadPanel && (
                <Card className="mt-3 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="font-semibold">Upload & Brand Settings</div>
                    <Button size="sm" variant="ghost" onClick={() => setShowUploadPanel(false)}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                  <Separator />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                    <div>
                      <Label className="text-xs mb-2 block">Product Images (max 3)</Label>
                      <div className="flex gap-2">
                        {uploadedPreviews.map((src, index) => (
                          <div key={index} className="relative group">
                            <img src={src} alt={`Upload ${index + 1}`} className="w-16 h-16 rounded-lg object-cover border" style={{ borderColor: colors.border }} />
                            <button onClick={() => handleRemoveImage(index)} className="absolute -top-2 -right-2 w-5 h-5 bg-destructive text-white rounded-full text-xs opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: colors.destructive }}>
                              ×
                            </button>
                          </div>
                        ))}
                        {uploadedPreviews.length < 3 && (
                          <button onClick={() => fileInputRef.current?.click()} className="w-16 h-16 rounded-lg border-2 border-dashed hover:border-primary transition-colors flex items-center justify-center" style={{ borderColor: colors.border }}>
                            <Plus className="w-5 h-5 text-muted-foreground" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div>
                      <Label className="text-xs mb-2 block">Brand Logo</Label>
                      <div className="flex items-center gap-3">
                        <div onClick={() => logoInputRef.current?.click()} className="w-16 h-16 rounded-lg border-2 border-dashed hover:border-primary transition-colors flex items-center justify-center cursor-pointer" style={{ borderColor: colors.border }}>
                          {logoPreview ? <img src={logoPreview} alt="Logo" className="w-full h-full rounded-lg object-cover" /> : logoPublicUrl ? <img src={logoPublicUrl} alt="logo" className="w-full h-full rounded-lg object-cover" /> : <Upload className="w-5 h-5 text-muted-foreground" />}
                        </div>
                        <div className="flex-1">
                          <Label htmlFor="brandName" className="text-xs">Brand Name</Label>
                          <Input id="brandName" value={adFormData.brandName} onChange={(e) => { setAdFormData((p: any) => ({ ...p, brandName: e.target.value })); setPostFormData((p: any) => ({ ...p, brandName: e.target.value })); }} className="mt-1 h-9 text-sm" placeholder="Brand name" />
                          <Label htmlFor="tagline" className="text-xs mt-2">Tagline</Label>
                          <Input id="tagline" value={adFormData.tagline} onChange={(e) => { setAdFormData((p: any) => ({ ...p, tagline: e.target.value })); setPostFormData((p: any) => ({ ...p, tagline: e.target.value })); }} className="mt-1 h-9 text-sm" placeholder="Tagline" />
                          <div className="mt-2 flex gap-2">
                            <Button size="sm" variant="outline" onClick={handleRemoveLogo}>Remove Logo</Button>
                            <Button size="sm" onClick={() => { if (logoPublicUrl) { setAdFormData((p: any) => ({ ...p, logoPublicUrl })); setPostFormData((p: any) => ({ ...p, logoPublicUrl })); toast.success("Logo applied to form"); } }}>
                              Apply Logo
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

        {/* Publish panel */}
        {showPublishPanel && (
          <div className="fixed inset-0 z-50" style={{ background: `${colors.background}cc`, backdropFilter: "blur(6px)" }}>
            <div className="max-w-3xl mx-auto p-6" style={{ marginTop: "auto", marginBottom: 40 }}>
              <Card className="p-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Publish Your Campaign</h3>
                  <Button size="sm" variant="ghost" onClick={() => setShowPublishPanel(false)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                <Separator className="my-3" />

                <div className="flex gap-2 mb-3">
                  <Button variant={publishMode === "post" ? "default" : "outline"} onClick={() => setPublishMode("post")} className="flex-1">
                    <Sparkles className="w-4 h-4 mr-2" /> Post Publishing
                  </Button>
                  <Button variant={publishMode === "ad" ? "default" : "outline"} onClick={() => setPublishMode("ad")} className="flex-1">
                    <ImageIcon className="w-4 h-4 mr-2" /> Ad Publishing
                  </Button>
                </div>

                {publishMode === "post" ? (
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="postName" className="text-sm">Post Name</Label>
                      <Input id="postName" value={postFormData.postName} onChange={(e) => setPostFormData((p: any) => ({ ...p, postName: e.target.value }))} placeholder="Post title (optional)" className="mt-2" />
                    </div>

                    <div>
                      <Label htmlFor="caption" className="text-sm">Caption</Label>
                      <Textarea id="caption" value={postFormData.generatedCaption} onChange={(e) => setPostFormData((p: any) => ({ ...p, generatedCaption: e.target.value }))} placeholder="Add your post caption..." className="mt-2 min-h-[80px]" />
                      <div className="mt-2 flex gap-2">
                        <Button onClick={() => generateCaption(postFormData.prompt || postFormData.postName || "Write a caption", (text) => setPostFormData((p: any) => ({ ...p, generatedCaption: text })))} variant="outline">
                          AI Caption
                        </Button>
                        <Button onClick={() => generateCaption(`Generate hashtags for: ${postFormData.generatedCaption || postFormData.prompt || postFormData.postName}`, (text) => {
                          const matches = (text || "").match(/#[\w-]+/g);
                          if (matches && matches.length) setPostFormData((p: any) => ({ ...p, hashtags: matches.join(" ") }));
                          else setPostFormData((p: any) => ({ ...p, hashtags: text }));
                        })} variant="outline">
                          AI Hashtags
                        </Button>
                        <div className="ml-auto flex items-center gap-2">
                          <label className="inline-flex items-center gap-2">
                            <input type="checkbox" checked={postFormData.platforms.includes("Instagram")} onChange={(e) => {
                              const checked = e.target.checked;
                              setPostFormData((p: any) => ({ ...p, platforms: checked ? Array.from(new Set([...(p.platforms || []), "Instagram"])) : (p.platforms || []).filter((x: any) => x !== "Instagram") }));
                            }} />
                            Instagram
                          </label>
                          <label className="inline-flex items-center gap-2">
                            <input type="checkbox" checked={postFormData.platforms.includes("Facebook")} onChange={(e) => {
                              const checked = e.target.checked;
                              setPostFormData((p: any) => ({ ...p, platforms: checked ? Array.from(new Set([...(p.platforms || []), "Facebook"])) : (p.platforms || []).filter((x: any) => x !== "Facebook") }));
                            }} />
                            Facebook
                          </label>
                        </div>
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="hashtags" className="text-sm">Hashtags</Label>
                      <Input id="hashtags" value={postFormData.hashtags} onChange={(e) => setPostFormData((p: any) => ({ ...p, hashtags: e.target.value }))} placeholder="#marketing #socialmedia" className="mt-2" />
                    </div>

                    <div className="flex gap-2">
                      <Button className="flex-1" style={{ background: colors.gradientPrimary, color: colors.primaryForeground }} onClick={() => handlePublishPost()}>
                        Publish Now
                      </Button>
                      <Button variant="outline" className="flex-1" onClick={() => toast("Schedule feature not implemented in this sample")}>
                        Schedule
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* AD Inputs (expanded to include FB Ads required fields) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="campaignName" className="text-sm">Campaign Name</Label>
                        <Input id="campaignName" value={adFormData.campaignName} onChange={(e) => setAdFormData((p: any) => ({ ...p, campaignName: e.target.value }))} placeholder="My Campaign" className="mt-2" />
                      </div>
                      <div>
                        <Label htmlFor="adSetName" className="text-sm">Ad Set Name</Label>
                        <Input id="adSetName" value={adFormData.adSetName} onChange={(e) => setAdFormData((p: any) => ({ ...p, adSetName: e.target.value }))} placeholder="Ad Set Name (optional)" className="mt-2" />
                      </div>
                      <div>
                        <Label htmlFor="objective" className="text-sm">Objective</Label>
                        <select id="objective" value={adFormData.objective} onChange={(e) => setAdFormData((p: any) => ({ ...p, objective: e.target.value }))} className="mt-2 w-full h-9 rounded border px-2">
                          <option value="LINK_CLICKS">Link Clicks</option>
                          <option value="CONVERSIONS">Conversions</option>
                          <option value="BRAND_AWARENESS">Brand Awareness</option>
                          <option value="REACH">Reach</option>
                        </select>
                      </div>
                      <div>
                        <Label htmlFor="primaryCTA" className="text-sm">Primary CTA</Label>
                        <Input id="primaryCTA" value={adFormData.primaryCTA} onChange={(e) => setAdFormData((p: any) => ({ ...p, primaryCTA: e.target.value }))} placeholder="LEARN_MORE" className="mt-2" />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="destinationLink" className="text-sm">Destination URL</Label>
                        <Input id="destinationLink" value={adFormData.destinationLink} onChange={(e) => setAdFormData((p: any) => ({ ...p, destinationLink: e.target.value }))} placeholder="https://example.com" className="mt-2" />
                      </div>
                      <div>
                        <Label htmlFor="delivery" className="text-sm">Delivery Type</Label>
                        <select id="delivery" value={adFormData.delivery} onChange={(e) => setAdFormData((p: any) => ({ ...p, delivery: e.target.value }))} className="mt-2 w-full h-9 rounded border px-2">
                          <option value="">Default</option>
                          <option value="standard">Standard</option>
                          <option value="expedited">Expedited</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label htmlFor="budget" className="text-sm">Budget</Label>
                        <Input id="budget" type="number" value={adFormData.budget} onChange={(e) => setAdFormData((p: any) => ({ ...p, budget: Number(e.target.value) }))} placeholder="5000" className="mt-2" />
                      </div>
                      <div>
                        <Label htmlFor="duration" className="text-sm">Duration (days)</Label>
                        <Input id="duration" type="number" value={(adFormData.duration || 7)} onChange={(e) => setAdFormData((p: any) => ({ ...p, duration: Number(e.target.value) }))} placeholder="7" className="mt-2" />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="targeting" className="text-sm">Audience Targeting (interests)</Label>
                      <Input id="targeting" value={adFormData.interests} onChange={(e) => setAdFormData((p: any) => ({ ...p, interests: e.target.value }))} placeholder="e.g., Fashion, Fitness" className="mt-2" />
                      <div className="mt-2 flex gap-2 items-center">
                        <div className="flex items-center gap-2">
                          <label className="inline-flex items-center gap-2">
                            <input type="checkbox" checked={adFormData.platforms.includes("Instagram")} onChange={(e) => {
                              const checked = e.target.checked;
                              setAdFormData((p: any) => ({ ...p, platforms: checked ? Array.from(new Set([...(p.platforms || []), "Instagram"])) : (p.platforms || []).filter((x: any) => x !== "Instagram") }));
                            }} />
                            Instagram
                          </label>
                          <label className="inline-flex items-center gap-2">
                            <input type="checkbox" checked={adFormData.platforms.includes("Facebook")} onChange={(e) => {
                              const checked = e.target.checked;
                              setAdFormData((p: any) => ({ ...p, platforms: checked ? Array.from(new Set([...(p.platforms || []), "Facebook"])) : (p.platforms || []).filter((x: any) => x !== "Facebook") }));
                            }} />
                            Facebook
                          </label>
                        </div>
                        <div className="ml-auto flex items-center gap-2">
                          <label className="inline-flex items-center gap-2">
                            <input type="checkbox" checked={!!adFormData.autoOptimize} onChange={(e) => setAdFormData((p: any) => ({ ...p, autoOptimize: e.target.checked }))} />
                            Auto optimize
                          </label>
                          <label className="inline-flex items-center gap-2">
                            <input type="checkbox" checked={!!adFormData.autoTarget} onChange={(e) => setAdFormData((p: any) => ({ ...p, autoTarget: e.target.checked }))} />
                            Auto target
                          </label>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button className="flex-1" style={{ background: colors.gradientPrimary, color: colors.primaryForeground }} onClick={() => handleLaunchAd()}>
                        Launch Ad Campaign
                      </Button>
                      <Button variant="outline" className="flex-1" onClick={async () => {
                        try {
                          const token = await getAccessToken();
                          if (!token) { toast.error("Sign in to save draft"); return; }
                          await fetch("/api/campaigns/save-draft", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ mode: "ad", name: adFormData.campaignName, inputs: adFormData }) });
                          toast.success("Draft saved");
                        } catch (e) {
                          console.error("save-draft failed", e);
                          toast.error("Save failed");
                        }
                      }}>
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
