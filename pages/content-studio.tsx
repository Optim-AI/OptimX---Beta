// pages/content-studio.tsx
// Ad Studio: Turn your website into high-converting ads

import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import Sidebar from "@/app/web/src/components/Sidebar";
import colors from "@/lib/ui/colors";
import { authFetch } from "@/lib/utils";
import { showError, showAlert } from "@/app/web/src/components/ui/AlertModal";
import {
  type BrandSnapshot,
  BrandGuidelineModal,
  BrandOnboarding,
  mapFullAnalyzeToBrandSnapshot,
} from "@/app/web/src/components/creative-studio";
import { DEFAULT_AD_BUILDER_DATA, saveBrandSnapshot } from "@/app/web/src/components/creative-studio/utils";
import type { Product } from "@/app/web/src/components/creative-studio/types";
import {
  Loader2,
  Search,
  ImageIcon,
  Video,
  Download,
  Sparkles,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  X,
  ExternalLink,
  Pencil,
  Calendar,
  Play,
  Check,
  RefreshCw,
  History,
} from "lucide-react";
import PosterEditModal from "@/app/web/src/components/content-studio/PosterEditModal";
import { Button } from "@/app/web/src/components/ui/button";
import { Input } from "@/app/web/src/components/ui/input";
import { Progress } from "@/app/web/src/components/ui/progress";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/app/web/src/components/ui/collapsible";
import { InsufficientCreditsAlert } from "@/app/web/src/components/billing/InsufficientCreditsAlert";
import { useSubscription } from "@/app/web/src/hooks/use-subscription";

type BrandSummary = {
  name: string;
  tone: string;
  industry: string;
  targetAudience: string;
  primaryValueProposition: string;
};

type AdAngle = {
  title: string;
  explanation: string;
};

type CampaignAd = {
  type: string;
  title: string;
  description: string;
  hook: string;
  cta: string;
};

type CampaignPlanItem = {
  day: number;
  goal: string;
  platform: string;
  content_type: string;
  hook: string;
  description: string;
};

type CampaignStrategy = {
  product_category: string;
  target_audience: string;
  content_themes: string[];
};

const MAX_SESSIONS = 20;
const OPEN_TABS_KEY = "content-studio:openTabs";

type VersionHistoryItem = {
  id: string;
  versionNumber: number;
  createdAt: string;
};

type AdGenerationSession = {
  id: string;
  product: Product;
  adAngles: AdAngle[];
  campaignPlan: CampaignPlanItem[];
  campaignStrategy: CampaignStrategy | null;
  generatedPosters: string[];
  campaign: { name: string; ads: CampaignAd[] } | null;
  loadingAngles: boolean;
  generatingAngleId: string | null;
  creatingVideoAngleId: string | null;
  generatingCampaignItem: number | null;
  createdAt: number;
  versionHistory?: VersionHistoryItem[];
  currentVersionId?: string | null;
  isRegenerating?: boolean;
};

const SCAN_MESSAGES = [
  { text: "Crawling your website...", detail: "Discovering pages and structure" },
  { text: "Identifying product pages...", detail: "Finding shop, collections & product URLs" },
  { text: "Extracting product data...", detail: "Pulling images, prices & descriptions" },
  { text: "Understanding brand identity...", detail: "Analyzing tone, audience & value proposition" },
];

/**
 * Build a poster prompt thinking like a graphic designer.
 * Understands brand + theme + product, no rigid rules from Brand Studio.
 */
function buildContentStudioPosterPrompt(options: {
  productName: string;
  angleText: string;
  benefits: string[];
  brand: BrandSnapshot | null;
  theme: "commercial" | "professional";
  variant: 1 | 2 | 3;
}): string {
  const { productName, angleText, benefits, brand, theme, variant } = options;

  const parts: string[] = [];

  parts.push("You are a senior graphic designer creating a scroll-stopping ad poster.");
  parts.push("");
  parts.push(`Product: ${productName}`);
  parts.push(`Ad angle: ${angleText}`);
  if (benefits.length > 0) {
    parts.push(`Key benefits: ${benefits.join("; ")}`);
  }
  parts.push("");

  if (brand) {
    parts.push("Brand context:");
    parts.push(`- Brand: ${brand.name}`);
    if (brand.tone || brand.personality) parts.push(`- Tone: ${brand.tone || brand.personality}`);
    if (brand.audience) parts.push(`- Audience: ${brand.audience}`);
    if (brand.coreValueProp || brand.description)
      parts.push(`- Value: ${brand.coreValueProp || brand.description}`);
    if (brand.primaryColors?.length)
      parts.push(`- Colors: ${brand.primaryColors.join(", ")}`);
    else if (brand.colors?.primary)
      parts.push(`- Colors: ${brand.colors.primary}${brand.colors.secondary ? `, ${brand.colors.secondary}` : ""}${brand.colors.accent ? `, ${brand.colors.accent}` : ""}`);
    parts.push("");
  }

  if (theme === "professional") {
    parts.push("Visual direction: Clean, credible, premium. Trust-building. Subtle gradients, refined typography, clinical or performance-focused mood.");
  } else {
    parts.push("Visual direction: Energetic, aspirational, emotionally engaging. Bold typography, strong contrast, lifestyle or product-in-use feel.");
  }
  parts.push("");

  const variantHints: Record<number, string> = {
    1: "Design approach: On-brand, safe, familiar. Maximum clarity.",
    2: "Design approach: Bolder typography, stronger visual impact. Still brand-aligned.",
    3: "Design approach: Creative composition, different layout. Fresh but commercial.",
  };
  parts.push(variantHints[variant] || variantHints[1]);
  parts.push("");

  parts.push("Create a single marketing poster. Clear hierarchy: hero visual, headline space, CTA area. No overlapping text and graphics. High-quality, 8K, commercial finish.");
  parts.push("");
  parts.push("CRITICAL: Never use asterisks (*) in any text. No * between words or sentences (e.g. no *and* or *bold*). Plain text only for headlines, body copy, and CTAs.");

  return parts.join("\n");
}

export default function ContentStudioPage() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [step, setStep] = useState<"entry" | "scanning" | "results">("entry");
  const [scanMessageIndex, setScanMessageIndex] = useState(0);
  const [scanProgress, setScanProgress] = useState(0);
  const [brand, setBrand] = useState<BrandSummary | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [expandedProductIndex, setExpandedProductIndex] = useState<number | null>(null);
  const [sessions, setSessions] = useState<AdGenerationSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [loadingCampaign, setLoadingCampaign] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanId, setScanId] = useState<string | null>(null);

  const [brandGuideline, setBrandGuideline] = useState<BrandSnapshot | null>(null);
  const [showBrandGuidelineModal, setShowBrandGuidelineModal] = useState(false);
  const [showBrandOnboarding, setShowBrandOnboarding] = useState(false);
  const [isAnalyzingBrand, setIsAnalyzingBrand] = useState(false);
  const [onboardingMode, setOnboardingMode] = useState<"website" | "manual">("website");
  const [editingPosterIndex, setEditingPosterIndex] = useState<number | null>(null);
  const [editingPosterUrl, setEditingPosterUrl] = useState<string | null>(null);
  const [productsCollapsed, setProductsCollapsed] = useState(false);
  const [insufficientCreditsType, setInsufficientCreditsType] = useState<"image" | "video" | null>(null);
  const [showVersionDropdown, setShowVersionDropdown] = useState(false);
  const versionBtnRef = React.useRef<HTMLButtonElement>(null);
  const tabsRestoredRef = React.useRef(false);

  const { credits, fetchSubscription } = useSubscription();

  const [imageCredits, setImageCredits] = useState<number | null>(null);
  const [videoCredits, setVideoCredits] = useState<number | null>(null);

  const activeSession = activeSessionId ? sessions.find((s) => s.id === activeSessionId) : null;
  const selectedProduct = activeSession?.product ?? null;


  useEffect(() => {
    async function loadCredits() {
      try {
        const response = await authFetch('/api/credits/balance');
        const data = await response.json();
        if (data.success) {
          setImageCredits(data.imageCredits?.total ?? 0);
          setVideoCredits(data.videoCredits?.total ?? 0);
        }
      } catch (err) {
        console.error('Error loading credits:', err);
      }
    }
    loadCredits();
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Try loading from DB first
      try {
        const res = await authFetch("/api/brand/snapshot");
        const data = await res.json();
        if (!cancelled && data.brandSnapshot) {
          setBrandGuideline(data.brandSnapshot);
          return;
        }
      } catch {
        // no snapshot available
      }
      if (cancelled) return;
      setShowBrandOnboarding(true);
    })();
    return () => { cancelled = true; };
  }, []);

  // Restore last scan from DB, then restore open tabs from localStorage
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await authFetch("/api/content-studio/scans");
        const data = await res.json();
        if (cancelled) return;
        if (data.ok && data.scans?.length > 0) {
          const latest = data.scans[0];
          const scannedBrand = latest.brandSummary as BrandSummary | null;
          const scannedProducts = (latest.products || []) as Product[];
          if (scannedProducts.length > 0 || scannedBrand) {
            setUrl(latest.url || "");
            setBrand(scannedBrand);
            setProducts(scannedProducts);
            setScanId(latest.id);
            setStep("results");

            // Restore open tabs from localStorage
            try {
              const stored = localStorage.getItem(OPEN_TABS_KEY);
              if (stored) {
                const tabInfo = JSON.parse(stored) as { productNames: string[]; activeProduct: string | null };
                if (tabInfo.productNames?.length > 0) {
                  const restoredSessions: AdGenerationSession[] = [];
                  let restoredActiveId: string | null = null;

                  for (const pName of tabInfo.productNames) {
                    const product = scannedProducts.find((p) => p.product_name === pName);
                    if (!product) continue;

                    const sessionId = `session_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
                    const session: AdGenerationSession = {
                      id: sessionId,
                      product,
                      adAngles: [],
                      campaignPlan: [],
                      campaignStrategy: null,
                      generatedPosters: [],
                      campaign: null,
                      loadingAngles: true,
                      generatingAngleId: null,
                      creatingVideoAngleId: null,
                      generatingCampaignItem: null,
                      createdAt: Date.now(),
                    };

                    // Load latest version from DB
                    try {
                      const vhRes = await authFetch(`/api/content-studio/versions?productName=${encodeURIComponent(pName)}&_t=${Date.now()}`);
                      const vhData = await vhRes.json();
                      if (vhData.ok && Array.isArray(vhData.versions) && vhData.versions.length > 0) {
                        const latestId = vhData.versions[0].id;
                        const vRes = await authFetch(`/api/content-studio/versions?id=${latestId}&_t=${Date.now()}`);
                        const vText = await vRes.text();
                        let vData: any;
                        try { vData = JSON.parse(vText); } catch { vData = null; }
                        if (vData?.ok && vData.version) {
                          const v = vData.version;
                          session.adAngles = Array.isArray(v.adAngles) ? v.adAngles : [];
                          session.campaignPlan = Array.isArray(v.campaignPlan) ? v.campaignPlan : [];
                          session.campaignStrategy = v.campaignStrategy || null;
                          session.generatedPosters = Array.isArray(v.generatedPosters) ? v.generatedPosters : [];
                          session.campaign = v.campaign || null;
                          session.loadingAngles = false;
                          session.currentVersionId = latestId;
                          session.versionHistory = vhData.versions.map((vh: any) => ({
                            id: vh.id,
                            versionNumber: vh.versionNumber,
                            createdAt: vh.createdAt,
                          }));
                        } else {
                          session.loadingAngles = false;
                        }
                      } else {
                        session.loadingAngles = false;
                      }
                    } catch {
                      session.loadingAngles = false;
                    }

                    restoredSessions.push(session);
                    if (pName === tabInfo.activeProduct) {
                      restoredActiveId = sessionId;
                    }
                  }

                  if (cancelled) return;
                  if (restoredSessions.length > 0) {
                    setSessions(restoredSessions);
                    setActiveSessionId(restoredActiveId || restoredSessions[0].id);
                    setProductsCollapsed(true);
                  }
                }
              }
            } catch {
              /* ignore tab restore errors */
            }
            tabsRestoredRef.current = true;
          }
        }
      } catch {
        /* ignore - user may not have any scans yet */
      }
      tabsRestoredRef.current = true;
    })();
    return () => { cancelled = true; };
  }, []);

  // Persist open tabs to localStorage whenever sessions or active tab changes
  useEffect(() => {
    if (!tabsRestoredRef.current) return;
    try {
      if (sessions.length === 0) {
        localStorage.removeItem(OPEN_TABS_KEY);
        return;
      }
      const tabInfo = {
        productNames: sessions.map((s) => s.product.product_name),
        activeProduct: activeSession?.product.product_name ?? null,
      };
      localStorage.setItem(OPEN_TABS_KEY, JSON.stringify(tabInfo));
    } catch { /* ignore */ }
  }, [sessions, activeSessionId]);

  const normalizeUrl = (input: string) => {
    const trimmed = input.trim();
    if (!trimmed) return "";
    if (!/^https?:\/\//i.test(trimmed)) return `https://${trimmed}`;
    return trimmed;
  };

  const handleAnalyze = async () => {
    const normalized = normalizeUrl(url);
    if (!normalized) {
      showError("Please enter a valid website URL");
      return;
    }

    setError(null);
    setStep("scanning");
    setScanMessageIndex(0);
    setScanProgress(0);

    const msgInterval = setInterval(() => {
      setScanMessageIndex((i) => (i + 1) % SCAN_MESSAGES.length);
    }, 2000);
    const progressInterval = setInterval(() => {
      setScanProgress((p) => Math.min(p + 6, 92));
    }, 10000);

    try {
      const res = await authFetch("/api/content-studio/scan", {
        method: "POST",
        body: JSON.stringify({ url: normalized }),
      });
      const data = await res.json();

      clearInterval(msgInterval);
      clearInterval(progressInterval);
      setScanProgress(100);

      if (!data.ok) {
        throw new Error(data.error || "Scan failed");
      }

      setBrand(data.brand);
      setProducts(data.products || []);
      setStep("results");
      setExpandedProductIndex(null);
      setSessions([]);
      setActiveSessionId(null);
      if (data.scanId) {
        setScanId(data.scanId);
      }

      const scanBrand = data.brand;
      if (scanBrand) {
        const merged: BrandSnapshot = brandGuideline
          ? {
              ...brandGuideline,
              name: scanBrand.name || brandGuideline.name,
              description: scanBrand.primaryValueProposition || brandGuideline.description,
              audience: scanBrand.targetAudience || brandGuideline.audience,
              offering: scanBrand.industry || brandGuideline.offering,
              tone: scanBrand.tone || brandGuideline.tone,
              coreValueProp: scanBrand.primaryValueProposition || brandGuideline.coreValueProp,
            }
          : {
              name: scanBrand.name || "Unknown",
              description: scanBrand.primaryValueProposition || "",
              audience: scanBrand.targetAudience || "",
              offering: scanBrand.industry || "",
              tone: scanBrand.tone || "professional",
              coreValueProp: scanBrand.primaryValueProposition,
            };
        setBrandGuideline(merged);
        saveBrandSnapshot(merged);
      }
    } catch (err: any) {
      clearInterval(msgInterval);
      clearInterval(progressInterval);
      setError(err.message || "Failed to scan website");
      setStep("entry");
      showError(err.message || "Failed to scan website");
    }
  };

  const handleProductClick = async (product: Product, index: number) => {
    if (expandedProductIndex === index) {
      setExpandedProductIndex(null);
      return;
    }
    setExpandedProductIndex(index);

    // Check if we already have a session for this product
    const existing = sessions.find((s) => s.product.product_name === product.product_name);
    if (existing) {
      setActiveSessionId(existing.id);
      setExpandedProductIndex(index);
      setProductsCollapsed(true);
      if (!existing.versionHistory) {
        fetchVersionHistory(product.product_name).then((vh) => {
          if (vh.length > 0) updateSession(existing.id, () => ({ versionHistory: vh }));
        });
      }
      return;
    }

    // Create new session tab
    const newId = `session_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const newSession: AdGenerationSession = {
      id: newId,
      product,
      adAngles: [],
      campaignPlan: [],
      campaignStrategy: null,
      generatedPosters: [],
      campaign: null,
      loadingAngles: true,
      generatingAngleId: null,
      creatingVideoAngleId: null,
      generatingCampaignItem: null,
      createdAt: Date.now(),
    };
    setSessions((prev) => [newSession, ...prev].slice(0, MAX_SESSIONS));
    setActiveSessionId(newId);
    setProductsCollapsed(true);

    try {
      // Check DB for existing versions — restore latest instead of regenerating
      const versionHistory = await fetchVersionHistory(product.product_name);
      if (versionHistory.length > 0) {
        const latestId = versionHistory[0].id;
        const vRes = await authFetch(`/api/content-studio/versions?id=${latestId}&_t=${Date.now()}`);
        const vText = await vRes.text();
        let vData: any;
        try { vData = JSON.parse(vText); } catch { vData = null; }
        if (vData?.ok && vData.version) {
          const v = vData.version;
          setSessions((prev) =>
            prev.map((s) =>
              s.id === newId
                ? {
                    ...s,
                    adAngles: Array.isArray(v.adAngles) ? v.adAngles : [],
                    campaignPlan: Array.isArray(v.campaignPlan) ? v.campaignPlan : [],
                    campaignStrategy: v.campaignStrategy || null,
                    generatedPosters: Array.isArray(v.generatedPosters) ? v.generatedPosters : [],
                    campaign: v.campaign || null,
                    loadingAngles: false,
                    versionHistory,
                    currentVersionId: latestId,
                  }
                : s
            )
          );
          return;
        }
      }

      // No saved versions — generate fresh
      const res = await authFetch("/api/content-studio/ad-angles", {
        method: "POST",
        body: JSON.stringify({ product, brand }),
      });
      const data = await res.json();

      const newAngles = data.ok && data.angles ? data.angles : [];
      const newPlan = Array.isArray(data.campaign_plan) ? data.campaign_plan : [];
      const newStrategy = data.campaign_strategy ?? null;

      setSessions((prev) =>
        prev.map((s) =>
          s.id === newId
            ? {
                ...s,
                adAngles: newAngles,
                campaignPlan: newPlan,
                campaignStrategy: newStrategy,
                loadingAngles: false,
              }
            : s
        )
      );

      // Save this first generation to DB
      const tempSession: AdGenerationSession = {
        ...newSession,
        adAngles: newAngles,
        campaignPlan: newPlan,
        campaignStrategy: newStrategy,
        loadingAngles: false,
      };
      const savedId = await saveVersionToDb(tempSession);
      const freshHistory = await fetchVersionHistory(product.product_name);
      updateSession(newId, () => ({
        versionHistory: freshHistory,
        currentVersionId: savedId,
      }));
    } catch {
      setSessions((prev) =>
        prev.map((s) => (s.id === newId ? { ...s, loadingAngles: false } : s))
      );
    }
  };

  const updateSession = (sessionId: string, updater: (s: AdGenerationSession) => Partial<AdGenerationSession>) => {
    setSessions((prev) =>
      prev.map((s) => (s.id === sessionId ? { ...s, ...updater(s) } : s))
    );
  };

  const closeSession = (sessionId: string) => {
    setShowVersionDropdown(false);
    setSessions((prev) => {
      const next = prev.filter((s) => s.id !== sessionId);
      if (activeSessionId === sessionId) {
        setActiveSessionId(next[0]?.id ?? null);
      }
      return next;
    });
    setExpandedProductIndex(null);
  };

  const fetchVersionHistory = async (productName: string): Promise<VersionHistoryItem[]> => {
    try {
      const res = await authFetch(`/api/content-studio/versions?productName=${encodeURIComponent(productName)}&_t=${Date.now()}`);
      const data = await res.json();
      if (data.ok && Array.isArray(data.versions)) {
        return data.versions.map((v: any) => ({
          id: v.id,
          versionNumber: v.versionNumber,
          createdAt: v.createdAt,
        }));
      }
    } catch { /* ignore */ }
    return [];
  };

  const saveVersionToDb = async (session: AdGenerationSession): Promise<string | null> => {
    try {
      const res = await authFetch("/api/content-studio/versions", {
        method: "POST",
        body: JSON.stringify({
          scanId: scanId || undefined,
          productName: session.product.product_name,
          adAngles: session.adAngles,
          campaignPlan: session.campaignPlan,
          campaignStrategy: session.campaignStrategy,
          generatedPosters: session.generatedPosters,
          campaign: session.campaign,
          productData: session.product,
        }),
      });
      const data = await res.json();
      return data.ok ? data.version?.id ?? null : null;
    } catch {
      return null;
    }
  };

  const handleRestoreVersion = async (versionId: string) => {
    if (!activeSession) return;
    const sessionId = activeSession.id;
    try {
      const res = await authFetch(`/api/content-studio/versions?id=${versionId}&_t=${Date.now()}`);
      const text = await res.text();
      let data: any;
      try { data = JSON.parse(text); } catch { data = null; }
      if (!data || !data.ok || !data.version) {
        showError("Could not load version data");
        return;
      }
      const v = data.version;
      setSessions((prev) =>
        prev.map((s) =>
          s.id === sessionId
            ? {
                ...s,
                adAngles: Array.isArray(v.adAngles) ? [...v.adAngles] : [],
                campaignPlan: Array.isArray(v.campaignPlan) ? [...v.campaignPlan] : [],
                campaignStrategy: v.campaignStrategy ? { ...v.campaignStrategy } : null,
                generatedPosters: Array.isArray(v.generatedPosters) ? [...v.generatedPosters] : [],
                campaign: v.campaign ? { ...v.campaign } : null,
                currentVersionId: versionId,
              }
            : s
        )
      );
    } catch (err: any) {
      showError(err?.message || "Failed to restore version");
    }
  };

  const handleRegenerate = async () => {
    if (!activeSession || activeSession.loadingAngles || activeSession.isRegenerating) return;
    const sessionId = activeSession.id;
    const product = activeSession.product;

    updateSession(sessionId, () => ({ isRegenerating: true }));

    // Save current state as a version before regenerating
    await saveVersionToDb(activeSession);

    updateSession(sessionId, () => ({
      loadingAngles: true,
      adAngles: [],
      campaignPlan: [],
      campaignStrategy: null,
      campaign: null,
    }));

    try {
      const res = await authFetch("/api/content-studio/ad-angles", {
        method: "POST",
        body: JSON.stringify({ product, brand }),
      });
      const data = await res.json();

      const newAngles = data.ok && data.angles ? data.angles : [];
      const newPlan = Array.isArray(data.campaign_plan) ? data.campaign_plan : [];
      const newStrategy = data.campaign_strategy ?? null;

      // Update session with new data first
      updateSession(sessionId, () => ({
        adAngles: newAngles,
        campaignPlan: newPlan,
        campaignStrategy: newStrategy,
        loadingAngles: false,
        isRegenerating: false,
      }));

      // Save the new generation to DB as well
      const newVersionId = await saveVersionToDb({
        ...activeSession,
        adAngles: newAngles,
        campaignPlan: newPlan,
        campaignStrategy: newStrategy,
        generatedPosters: activeSession.generatedPosters,
        campaign: activeSession.campaign,
      });

      // Refresh version history
      const versionHistory = await fetchVersionHistory(product.product_name);
      updateSession(sessionId, () => ({
        versionHistory,
        currentVersionId: newVersionId,
      }));
    } catch {
      updateSession(sessionId, () => ({ loadingAngles: false, isRegenerating: false }));
    }
  };

  const handleGeneratePoster = async (angle?: AdAngle) => {
    if (!activeSession || !selectedProduct) return;
    const sessionId = activeSession.id;
    if (!credits || credits.imageCredits.total < 3) {
      setInsufficientCreditsType("image");
      return;
    }
    const angleId = angle ? angle.title : "__default__";
    updateSession(sessionId, () => ({ generatingAngleId: angleId }));
    try {
      const productImages = selectedProduct.product_images || [];
      const productImage = productImages[0];
      let productDataUrl: string | undefined;
      const refDataUrls: string[] = [];

      if (productImage && productImage.startsWith("http")) {
        const fetchRes = await authFetch("/api/creative-studio/fetch-image", {
          method: "POST",
          body: JSON.stringify({ url: productImage }),
        });
        const fetchData = await fetchRes.json();
        if (fetchData.ok && fetchData.dataUrl) {
          productDataUrl = fetchData.dataUrl;
        }
      }

      for (const imgUrl of productImages.slice(1, 3)) {
        if (imgUrl?.startsWith("http")) {
          try {
            const r = await authFetch("/api/creative-studio/fetch-image", {
              method: "POST",
              body: JSON.stringify({ url: imgUrl }),
            });
            const d = await r.json();
            if (d.ok && d.dataUrl) refDataUrls.push(d.dataUrl);
          } catch {
            /* skip */
          }
        }
      }

      const brandSnapshot: BrandSnapshot | null =
        brandGuideline ||
        (brand
          ? {
              name: brand.name,
              description: brand.primaryValueProposition,
              audience: brand.targetAudience,
              offering: brand.industry,
              tone: brand.tone,
              brandVoice:
                /professional|corporate/i.test(brand.tone)
                  ? "Professional"
                  : /playful|fun|energetic/i.test(brand.tone)
                    ? "Playful"
                    : /minimal|clean|simple/i.test(brand.tone)
                      ? "Minimalist"
                      : "Bold",
              coreValueProp: brand.primaryValueProposition,
            }
          : null);

      const angleText = angle
        ? `${angle.title}. ${angle.explanation}`
        : selectedProduct.short_benefit || selectedProduct.description;
      const benefits = selectedProduct.key_benefits || [];

      const theme: "commercial" | "professional" =
        angle && /clinical|proven|science|lab|performance/i.test(angle.title)
          ? "professional"
          : "commercial";
      const aspectRatio: "1:1" | "4:5" | "9:16" | "1.91:1" = "4:5";
      const target = { width: 1080, height: 1350 };

      const variantPrompts = ([1, 2, 3] as const).map((variantNum) =>
        buildContentStudioPosterPrompt({
          productName: selectedProduct.product_name,
          angleText,
          benefits,
          brand: brandSnapshot,
          theme,
          variant: variantNum,
        })
      );

      const basePayload = {
        mode: "generate" as const,
        theme,
        target,
        aspectLabel: aspectRatio,
        brandName: brandGuideline?.name || brand?.name || "",
        brandSnapshot,
        tone: brandGuideline?.tone || brand?.tone || theme,
        productDataUrl,
        productProvided: !!productDataUrl,
        refDataUrls,
      };

      const results = await Promise.allSettled(
        variantPrompts.map((prompt) =>
          authFetch("/api/generate-campaign", {
            method: "POST",
            body: JSON.stringify({
              ...basePayload,
              prompt,
              description: prompt,
            }),
          })
        )
      );

      const posters: string[] = [];
      let lastError = "";
      for (const result of results) {
        if (result.status === "fulfilled") {
          const data = await result.value.json();
          if (data.ok && data.image) posters.push(data.image);
          else if (data.error) lastError = data.error;
        } else {
          lastError = result.reason?.message || "Unknown error";
        }
      }

      if (posters.length > 0) {
        updateSession(sessionId, (s) => ({
          generatedPosters: [...s.generatedPosters, ...posters],
        }));
        // Save poster URLs to DB
        if (scanId && selectedProduct) {
          authFetch("/api/content-studio/posters", {
            method: "POST",
            body: JSON.stringify({
              scanId,
              productName: selectedProduct.product_name,
              angle: angle || null,
              imageUrls: posters,
            }),
          }).catch(() => { /* non-critical */ });
        }
        // Refresh credit balance
        fetchSubscription();
      } else {
        showError(lastError || "Failed to generate posters");
      }
    } catch (err: any) {
      showError(err.message || "Failed to generate poster");
    } finally {
      updateSession(sessionId, () => ({ generatingAngleId: null }));
    }
  };

  const handleCampaignItemGenerate = async (item: CampaignPlanItem, index: number) => {
    if (!activeSession || !selectedProduct) return;
    const sessionId = activeSession.id;
    updateSession(sessionId, () => ({ generatingCampaignItem: index }));
    try {
      const isVideo = /video/i.test(item.content_type);
      const angle: AdAngle = {
        title: item.hook,
        explanation: `${item.content_type} for ${item.platform}. Goal: ${item.goal}. ${item.description}`,
      };
      if (isVideo) {
        await handleVideoAdClick(angle);
      } else {
        await handleGeneratePoster(angle);
      }
    } finally {
      updateSession(sessionId, () => ({ generatingCampaignItem: null }));
    }
  };

  const handleCreateCampaign = async (product?: Product) => {
    const p = product || selectedProduct;
    if (!p) return;
    setLoadingCampaign(true);
    try {
      const res = await authFetch("/api/content-studio/generate-campaign", {
        method: "POST",
        body: JSON.stringify({ product: p, brand, scanId }),
      });
      const data = await res.json();
      if (data.ok && data.campaign && activeSession) {
        updateSession(activeSession.id, () => ({ campaign: data.campaign }));
      } else if (!data.ok) {
        showError(data.error || "Failed to generate campaign");
      }
    } catch (err: any) {
      showError(err.message || "Failed to generate campaign");
    } finally {
      setLoadingCampaign(false);
    }
  };

  const handleDownload = (url: string, name: string) => {
    const a = document.createElement("a");
    a.href = url;
    a.download = name || "creative.png";
    a.click();
  };

  const handleVideoAdClick = async (angle: AdAngle) => {
    if (!activeSession || !selectedProduct || (!brandGuideline && !brand)) {
      showError("Please set up brand guidelines first");
      return;
    }
    const sessionId = activeSession.id;
    if (!credits || credits.videoCredits.total < 1) {
      setInsufficientCreditsType("video");
      return;
    }
    updateSession(sessionId, () => ({ creatingVideoAngleId: angle.title }));
    try {
      const productData = {
        product_name: selectedProduct.product_name,
        brand_name: brand?.name || brandGuideline?.name || "Brand",
        product_images: selectedProduct.product_images || [],
        hero_image: selectedProduct.product_images?.[0] || null,
        brand_logo: brandGuideline?.logo || brandGuideline?.logoUrl || null,
        category: brand?.industry || "",
      };
      const adBuilderData = {
        ...DEFAULT_AD_BUILDER_DATA,
        product: productData,
        userDescription: `Ad angle: ${angle.title}. ${angle.explanation}`,
      };
      const brandSnapshot = brandGuideline || (brand ? {
        name: brand.name,
        description: brand.primaryValueProposition,
        audience: brand.targetAudience,
        offering: brand.industry,
        tone: brand.tone,
      } : { name: "Brand", description: "", audience: "", offering: "", tone: "professional" });
      const res = await authFetch("/api/creative-studio/sessions", {
        method: "POST",
        body: JSON.stringify({
          name: `${selectedProduct.product_name} - Video Ad`,
          sessionType: "video",
          brandSnapshot,
          adBuilderData,
        }),
      });
      const data = await res.json();
      if (data.ok && data.session?.id) {
        router.push(`/brand-studio/video?id=${data.session.id}`);
      } else {
        showError(data.error || "Failed to create video session");
      }
    } catch (err: any) {
      showError(err.message || "Failed to create video session");
    } finally {
      updateSession(sessionId, () => ({ creatingVideoAngleId: null }));
    }
  };

  const handleRegenerateWithEdit = async (
    posterUrl: string,
    posterIndex: number,
    editPrompt: string
  ) => {
    let posterDataUrl = posterUrl;
    if (posterUrl.startsWith("http")) {
      try {
        const res = await authFetch("/api/creative-studio/fetch-image", {
          method: "POST",
          body: JSON.stringify({ url: posterUrl, directFetch: true }),
        });
        const data = await res.json();
        if (data.ok && data.dataUrl) posterDataUrl = data.dataUrl;
      } catch {
        showError("Could not load poster for editing");
        return;
      }
    }

    const brandSnapshot =
      brandGuideline ||
      (brand
        ? {
            name: brand.name,
            description: brand.primaryValueProposition,
            audience: brand.targetAudience,
            offering: brand.industry,
            tone: brand.tone,
          }
        : null);

    const editDescription = `EDIT MODE: The image provided below is the current marketing poster. Make ONLY this exact change: "${editPrompt}". Keep everything else identical—same layout, product, colors, branding, and all other text. Only apply the requested modification. Output the modified poster. 4:5 aspect ratio, high quality. Never use asterisks (*) in any text. Plain text only.`;

    try {
      const res = await authFetch("/api/generate-campaign", {
        method: "POST",
        body: JSON.stringify({
          mode: "edit",
          editMode: true,
          description: editDescription,
          prompt: editDescription,
          refDataUrls: [posterDataUrl],
          target: { width: 1080, height: 1350 },
          aspectLabel: "4:5",
          theme: "commercial",
          brandName: brand?.name || "",
          brandSnapshot,
        }),
      });
      const data = await res.json();
      if (data.ok && data.image && activeSession) {
        updateSession(activeSession.id, (s) => ({
          generatedPosters: s.generatedPosters.map((url, i) =>
            i === posterIndex ? data.image : url
          ),
        }));
      } else if (!data.ok) {
        showError(data.error || "Failed to regenerate poster");
      }
    } catch (err: any) {
      showError(err.message || "Failed to regenerate poster");
    }
  };

  const handleStartOver = () => {
    setStep("entry");
    setUrl("");
    setBrand(null);
    setProducts([]);
    setExpandedProductIndex(null);
    setSessions([]);
    setActiveSessionId(null);
    setError(null);
    setScanId(null);
  };

  async function handleWebsiteAnalyzeForEdit(website: string): Promise<BrandSnapshot | null> {
    try {
      const response = await authFetch("/api/brand/fullAnalyze", {
        method: "POST",
        body: JSON.stringify({ url: website }),
      });
      const data = await response.json();
      if (!data.result) {
        showError(data.error || "Could not analyze website. Please try manual setup.");
        return null;
      }
      return mapFullAnalyzeToBrandSnapshot(data.result);
    } catch (err: any) {
      showError(`Error analyzing website: ${err?.message || "Unknown error"}. Please try manual setup.`);
      return null;
    }
  }

  async function handleWebsiteBrandSetup(website: string) {
    setIsAnalyzingBrand(true);
    try {
      const response = await authFetch("/api/brand/fullAnalyze", {
        method: "POST",
        body: JSON.stringify({ url: website }),
      });
      const data = await response.json();
      if (data.result) {
        const brandSnapshot = mapFullAnalyzeToBrandSnapshot(data.result);
        setBrandGuideline(brandSnapshot);
        saveBrandSnapshot(brandSnapshot);
        setShowBrandOnboarding(false);
        setShowBrandGuidelineModal(true);
      } else {
        showError(data.error || "Could not analyze website. Please try manual setup.");
      }
    } catch (err: any) {
      showError(`Error analyzing website: ${err?.message || "Unknown error"}. Please try manual setup.`);
    } finally {
      setIsAnalyzingBrand(false);
    }
  }

  function handleManualBrandSetup(data: {
    name: string;
    offering: string;
    audience: string;
    personality?: string;
    colors?: { primary?: string; secondary?: string; accent?: string };
    tagline?: string;
  }) {
    const brandSnapshot: BrandSnapshot = {
      name: data.name,
      description: `${data.name} offers ${data.offering} to ${data.audience}.`,
      audience: data.audience,
      offering: data.offering,
      tone: data.personality || "professional",
      colors: data.colors,
      tagline: data.tagline,
      personality: data.personality,
    };
    setBrandGuideline(brandSnapshot);
    saveBrandSnapshot(brandSnapshot);
    setShowBrandOnboarding(false);
    setShowBrandGuidelineModal(true);
  }

  function handleSkipBrandSetup() {
    const minimalBrand: BrandSnapshot = {
      name: "My Brand",
      description: "",
      audience: "",
      offering: "",
      tone: "professional",
    };
    setBrandGuideline(minimalBrand);
    saveBrandSnapshot(minimalBrand);
    setShowBrandOnboarding(false);
    setShowBrandGuidelineModal(true);
  }

  function updateBrandGuideline(updated: BrandSnapshot) {
    setBrandGuideline(updated);
    saveBrandSnapshot(updated);
    authFetch("/api/user/preferences", { method: "PUT", body: JSON.stringify({ preferences: { guideline_seen: true } }) }).catch(() => {});
    setShowBrandGuidelineModal(false);
  }

  const hasFetchedProducts = products.length > 0 || brand !== null;

  return (
    <div className="h-screen flex overflow-hidden app-page">
      <div className="flex-shrink-0 h-full">
        <Sidebar />
      </div>
      <div className="flex-1 flex flex-col h-full overflow-hidden" style={{ backgroundColor: colors.card, borderLeft: `1px solid ${colors.border}` }}>
        {/* Sticky Header */}
        <div className="border-b flex-shrink-0" style={{ borderColor: colors.border, backgroundColor: colors.card }}>
          <div className="max-w-6xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-semibold flex items-center gap-2" style={{ color: colors.foreground }}>
                  Content Studio
                  <span
                    className="shrink-0"
                    style={{
                      fontSize: 10,
                      padding: '2px 6px',
                      borderRadius: 4,
                      background: 'rgba(34, 197, 94, 0.2)',
                      color: '#22c55e',
                      fontWeight: 600,
                    }}
                  >
                    Beta
                  </span>
                </h1>
                <p className="text-sm mt-1" style={{ color: colors.mutedForeground }}>
                  Turn your website into high-converting ads
                </p>
              </div>
              <div className="flex items-center gap-3">
                {imageCredits !== null && (
                  <div className="flex items-center gap-2 px-4 py-2 rounded-lg" style={{ background: 'hsl(213 100% 55% / 0.15)', border: '1px solid hsl(213 100% 55% / 0.35)' }}>
                    <svg className="w-5 h-5" style={{ color: colors.primary }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="font-semibold" style={{ color: colors.primary }}>{imageCredits}</span>
                    <span className="text-sm" style={{ color: colors.primary }}>images</span>
                  </div>
                )}
                {videoCredits !== null && (
                  <div className="flex items-center gap-2 px-4 py-2 rounded-lg" style={{ background: 'hsl(270 80% 55% / 0.15)', border: '1px solid hsl(270 80% 55% / 0.3)' }}>
                    <svg className="w-5 h-5" style={{ color: 'hsl(270 80% 65%)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    <span className="font-semibold" style={{ color: 'hsl(270 80% 70%)' }}>{videoCredits}s</span>
                    <span className="text-sm" style={{ color: 'hsl(270 80% 65%)' }}>video</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto px-6 py-10">
          {/* Beta feature note */}
          <div className="mb-6 p-4 rounded-xl" style={{ backgroundColor: 'rgba(34, 197, 94, 0.12)', border: '1px solid rgba(34, 197, 94, 0.35)' }}>
            <p className="text-sm leading-relaxed" style={{ color: '#e8f5e9' }}>
              <strong style={{ color: '#e8f5e9' }}>Beta Feature:</strong> This feature is still in Beta, so you might notice occasional glitches or unexpected results. If you spot anything off or have ideas for improvement,{' '}
              <Link href="/report" className="font-medium underline" style={{ color: '#4ade80' }}>
                send us feedback here
              </Link>
              . Your input directly helps us refine the experience.
            </p>
          </div>

          {(step === "entry" || step === "results") && (
            <div className="flex flex-col items-center py-12">
              <div className="flex flex-col items-center mb-8">
                <div className="flex items-center justify-center w-14 h-14 rounded-full mb-4" style={{ background: "hsl(213 100% 55% / 0.15)" }}>
                  <Sparkles className="w-7 h-7" style={{ color: colors.primary }} />
                </div>
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium mb-4" style={{ background: "hsl(213 100% 55% / 0.15)", color: colors.primary }}>
                  AI-Powered Ad Studio
                  <span
                    className="shrink-0"
                    style={{
                      fontSize: 10,
                      padding: '2px 6px',
                      borderRadius: 4,
                      background: 'rgba(34, 197, 94, 0.2)',
                      color: '#22c55e',
                      fontWeight: 600,
                    }}
                  >
                    Beta
                  </span>
                </div>
                <h1 className="text-4xl md:text-5xl font-bold tracking-tight max-w-6xl mx-auto text-center" style={{ color: colors.foreground }}>
                  Let&apos;s turn your website into high converting ads
                </h1>
                <p className="text-lg max-w-2xl mx-auto text-center mt-2" style={{ color: colors.mutedForeground }}>
                  Paste your website URL and we&apos;ll extract products, generate ad creatives, and build campaigns all in one place.
                </p>
              </div>

              <div
                className="w-full max-w-4xl rounded-2xl border p-6 sm:p-8"
                style={{
                  background: colors.card,
                  borderColor: colors.border,
                }}
              >
                <div className="flex gap-3">
                  <Input
                    placeholder="Paste Website URL"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAnalyze()}
                    className="flex-1 min-w-0 bg-[hsl(0_0%_12%)] text-[hsl(0_0%_95%)] placeholder:text-[hsl(0_0%_50%)] rounded-lg h-12 text-sm"
                    style={{ border: "1px solid hsl(213 100% 55%)" }}
                  />
                  <Button
                    onClick={handleAnalyze}
                    disabled={!url.trim()}
                    className="flex-shrink-0 px-12 rounded-lg h-12 text-sm font-medium"
                    style={{
                      background: colors.primary,
                      color: colors.primaryForeground,
                    }}
                  >
                    <Search className="w-5 h-5 mr-2" />
                    Analyze Website
                  </Button>
                </div>
              </div>

              {hasFetchedProducts && (
                <div className="w-full max-w-6xl mt-8">
                  <Collapsible
                    open={!productsCollapsed}
                    onOpenChange={(open) => setProductsCollapsed(!open)}
                    className="rounded-2xl border overflow-hidden"
                    style={{ borderColor: colors.border, background: colors.card }}
                  >
                    <CollapsibleTrigger
                      className="flex items-center justify-between w-full px-6 py-4 text-left hover:opacity-90 transition-opacity"
                      style={{
                        background: colors.card,
                        borderBottom: `1px solid ${colors.border}`,
                      }}
                    >
                      <span className="font-semibold truncate mr-2" style={{ color: colors.foreground }}>
                        Fetched products from {url ? url.replace(/^https?:\/\//, "").split("/")[0] : "website"}
                        {brand?.name && ` • ${brand.name}`}
                        {products.length > 0 && ` • ${products.length} products`}
                      </span>
                      {productsCollapsed ? (
                        <ChevronDown className="w-5 h-5 shrink-0" style={{ color: colors.mutedForeground }} />
                      ) : (
                        <ChevronUp className="w-5 h-5 shrink-0" style={{ color: colors.mutedForeground }} />
                      )}
                    </CollapsibleTrigger>
                    <CollapsibleContent style={{ background: colors.background }}>
                      <div className="p-6 space-y-10">
                        <div className="flex items-center justify-between">
                          <h2 className="text-lg font-semibold" style={{ color: colors.foreground }}>
                            {brand?.name && `${brand.name} • `}
                            {products.length} products detected
                          </h2>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleStartOver}
                            style={{ borderColor: colors.border, color: colors.mutedForeground }}
                          >
                            Start over
                          </Button>
                        </div>

                        {brand && (
                <section
                  className="rounded-2xl p-6 border shadow-sm"
                  style={{
                    background: colors.card,
                    borderColor: colors.border,
                  }}
                >
                  <h2 className="text-lg font-semibold mb-4" style={{ color: colors.foreground }}>
                    Brand Summary
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <span className="text-sm" style={{ color: colors.mutedForeground }}>
                        Brand Name
                      </span>
                      <p className="font-medium" style={{ color: colors.foreground }}>
                        {brand.name}
                      </p>
                    </div>
                    <div>
                      <span className="text-sm" style={{ color: colors.mutedForeground }}>
                        Brand Tone
                      </span>
                      <p className="font-medium" style={{ color: colors.foreground }}>
                        {brand.tone || "—"}
                      </p>
                    </div>
                    <div>
                      <span className="text-sm" style={{ color: colors.mutedForeground }}>
                        Industry
                      </span>
                      <p className="font-medium" style={{ color: colors.foreground }}>
                        {brand.industry || "—"}
                      </p>
                    </div>
                    <div>
                      <span className="text-sm" style={{ color: colors.mutedForeground }}>
                        Target Audience
                      </span>
                      <p className="font-medium" style={{ color: colors.foreground }}>
                        {brand.targetAudience || "—"}
                      </p>
                    </div>
                    <div className="md:col-span-2">
                      <span className="text-sm" style={{ color: colors.mutedForeground }}>
                        Primary Value Proposition
                      </span>
                      <p className="font-medium" style={{ color: colors.foreground }}>
                        {brand.primaryValueProposition || "—"}
                      </p>
                    </div>
                  </div>
                </section>
              )}

              {/* Brand Guideline Section - shared with Brand Studio */}
              {(brandGuideline || brand) && (
                <section className="mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold" style={{ color: colors.foreground }}>
                      Brand Guideline
                    </h2>
                    <button
                      onClick={() => setShowBrandGuidelineModal(true)}
                      className="text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-black/10 transition-colors"
                      style={{ color: colors.primary }}
                    >
                      View / Edit
                    </button>
                  </div>
                  <div
                    className="p-4 rounded-xl border"
                    style={{
                      backgroundColor: colors.muted,
                      borderColor: colors.border,
                    }}
                  >
                    <div className="flex items-center gap-4">
                      {(brandGuideline?.logo || brandGuideline?.logoUrl) && (
                        <img
                          src={brandGuideline.logo || brandGuideline.logoUrl}
                          alt={brandGuideline.name}
                          className="h-12 w-12 object-contain rounded-lg p-1"
                          style={{
                            border: `1px solid ${colors.border}`,
                            backgroundColor: colors.card,
                          }}
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = "none";
                          }}
                        />
                      )}
                      <div>
                        <h3 className="font-semibold" style={{ color: colors.foreground }}>
                          {brandGuideline?.name || brand?.name}
                        </h3>
                        <p className="text-sm" style={{ color: colors.mutedForeground }}>
                          {brandGuideline?.offering ||
                            brandGuideline?.description ||
                            brand?.primaryValueProposition ||
                            brand?.industry ||
                            "—"}
                        </p>
                      </div>
                    </div>
                  </div>
                </section>
              )}

              <section>
                <h2 className="text-lg font-semibold mb-4" style={{ color: colors.foreground }}>
                  Product Library
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {products.map((p, i) => {
                    const isSelected = selectedProduct?.product_name === p.product_name;
                    return (
                      <div
                        key={i}
                        onClick={() => handleProductClick(p, i)}
                        className="relative rounded-xl p-4 border-2 cursor-pointer transition-all hover:border-[hsl(213_100%_55%)] hover:shadow-lg"
                        style={{
                          background: colors.card,
                          borderColor: isSelected ? colors.primary : colors.border,
                        }}
                      >
                        {isSelected && (
                          <div
                            className="absolute top-3 right-3 z-10 flex items-center justify-center w-6 h-6 rounded-full"
                            style={{ background: colors.primary }}
                          >
                            <Check className="w-3.5 h-3.5" style={{ color: colors.primaryForeground }} />
                          </div>
                        )}
                        <div
                          className="aspect-square rounded-lg mb-3 overflow-hidden bg-[hsl(0_0%_18%)]"
                          style={{ minHeight: 140 }}
                        >
                          {p.product_images?.[0] ? (
                            <img
                              src={p.product_images[0]}
                              alt={p.product_name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div
                              className="w-full h-full flex items-center justify-center"
                              style={{ color: colors.mutedForeground }}
                            >
                              <ImageIcon className="w-12 h-12" />
                            </div>
                          )}
                        </div>
                        <h3 className="font-semibold truncate" style={{ color: colors.foreground }}>
                          {p.product_name}
                        </h3>
                        {p.price && (
                          <p className="text-sm font-medium" style={{ color: colors.primary }}>
                            {p.price}
                          </p>
                        )}
                        <p className="text-sm truncate" style={{ color: colors.mutedForeground }}>
                          {p.short_benefit || p.description || "—"}
                        </p>
                      </div>
                    );
                  })}
                </div>
                {products.length === 0 && (
                  <p className="text-center py-8" style={{ color: colors.mutedForeground }}>
                    No products detected. Try a different URL or ensure the site has product pages.
                  </p>
                )}
              </section>
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  </div>
                )}

              {/* Ad Generation Section - tab-based, opens when product is selected */}
              {sessions.length > 0 && (
                <>
                {/* Tab bar - browser-like */}
                <div className="w-full max-w-6xl mt-6 flex items-center gap-1 overflow-x-auto pb-2" style={{ borderBottom: `1px solid ${colors.border}` }}>
                  {sessions.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setActiveSessionId(s.id)}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-t-lg text-sm font-medium shrink-0 transition-colors"
                      style={{
                        background: activeSessionId === s.id ? colors.card : "transparent",
                        color: activeSessionId === s.id ? colors.foreground : colors.mutedForeground,
                        border: `1px solid ${activeSessionId === s.id ? colors.border : "transparent"}`,
                        borderBottom: activeSessionId === s.id ? `1px solid ${colors.card}` : "none",
                      }}
                    >
                      <span className="truncate max-w-[140px]">{s.product.product_name}</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); closeSession(s.id); }}
                        className="p-0.5 rounded hover:bg-black/10"
                        style={{ color: colors.mutedForeground }}
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </button>
                  ))}
                </div>

              {activeSession && (
                <div className="w-full max-w-6xl mt-8 space-y-8">
                  <div className="rounded-2xl border overflow-hidden" style={{ borderColor: colors.border, background: colors.card }}>
                    <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: colors.border, background: "hsl(213 100% 55% / 0.06)" }}>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-10 h-10 rounded-lg" style={{ background: "hsl(213 100% 55% / 0.15)" }}>
                          <Sparkles className="w-5 h-5" style={{ color: colors.primary }} />
                        </div>
                        <div>
                          <h2 className="text-lg font-semibold" style={{ color: colors.foreground }}>
                            Ad Generation
                          </h2>
                          <p className="text-sm" style={{ color: colors.mutedForeground }}>
                            {activeSession.product.product_name}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {/* Version history dropdown */}
                        {activeSession.versionHistory && activeSession.versionHistory.length > 1 && (
                          <>
                            <Button
                              ref={versionBtnRef}
                              size="sm"
                              variant="ghost"
                              className="flex items-center gap-1.5"
                              style={{ color: colors.mutedForeground }}
                              onClick={() => setShowVersionDropdown(!showVersionDropdown)}
                            >
                              <History className="w-4 h-4" />
                              <span className="text-xs">
                                {(() => {
                                  const idx = activeSession.versionHistory!.findIndex((v) => v.id === activeSession.currentVersionId);
                                  return idx >= 0 ? `v${activeSession.versionHistory!.length - idx}` : `v${activeSession.versionHistory!.length}`;
                                })()}
                                {" / "}{activeSession.versionHistory.length}
                              </span>
                              <ChevronDown className="w-3 h-3" />
                            </Button>
                            {showVersionDropdown && (
                              <>
                                <div className="fixed inset-0 z-[9998]" onClick={() => setShowVersionDropdown(false)} />
                                <div
                                  className="fixed w-64 rounded-lg border shadow-lg z-[9999]"
                                  style={{
                                    background: colors.card,
                                    borderColor: colors.border,
                                    top: versionBtnRef.current
                                      ? versionBtnRef.current.getBoundingClientRect().bottom + 4
                                      : 0,
                                    left: versionBtnRef.current
                                      ? Math.min(
                                          versionBtnRef.current.getBoundingClientRect().right - 256,
                                          window.innerWidth - 272
                                        )
                                      : 0,
                                  }}
                                >
                                  <div className="p-2">
                                    <p className="text-xs font-medium px-2 py-1 mb-1" style={{ color: colors.mutedForeground }}>
                                      Versions ({activeSession.versionHistory.length})
                                    </p>
                                    <div className="max-h-60 overflow-y-auto space-y-0.5">
                                      {activeSession.versionHistory.map((v, idx) => {
                                        const isCurrent = v.id === activeSession.currentVersionId;
                                        const label = `Version ${activeSession.versionHistory!.length - idx}`;
                                        return (
                                          <button
                                            key={v.id}
                                            onClick={async () => {
                                              setShowVersionDropdown(false);
                                              if (!isCurrent) await handleRestoreVersion(v.id);
                                            }}
                                            className="w-full text-left px-2 py-1.5 rounded text-sm transition-colors"
                                            style={{
                                              color: isCurrent ? colors.primary : colors.foreground,
                                              background: isCurrent ? colors.primary + "15" : "transparent",
                                            }}
                                            onMouseEnter={(e) => { if (!isCurrent) e.currentTarget.style.background = colors.muted; }}
                                            onMouseLeave={(e) => { if (!isCurrent) e.currentTarget.style.background = isCurrent ? colors.primary + "15" : "transparent"; }}
                                          >
                                            <span className="font-medium">{label}</span>
                                            {isCurrent && <span className="text-xs ml-1">(current)</span>}
                                            <span className="text-xs ml-2" style={{ color: colors.mutedForeground }}>
                                              {new Date(v.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                                            </span>
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>
                                </div>
                              </>
                            )}
                          </>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleRegenerate}
                          disabled={activeSession.loadingAngles || !!activeSession.isRegenerating}
                          className="flex items-center gap-1.5"
                          style={{ borderColor: colors.border, color: colors.primary }}
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${activeSession.isRegenerating ? "animate-spin" : ""}`} />
                          {activeSession.isRegenerating ? "Regenerating..." : "Regenerate"}
                        </Button>
                      </div>
                    </div>
                    <div className="p-6 space-y-8">
                {/* Product image & details */}
                <section className="rounded-xl p-6 border" style={{ background: colors.secondary, borderColor: colors.border }}>
                  <h2 className="text-lg font-semibold mb-4" style={{ color: colors.foreground }}>Product</h2>
                  <div className="flex gap-6">
                    <div className="aspect-square w-32 shrink-0 rounded-lg overflow-hidden bg-[hsl(0_0%_18%)]">
                      {activeSession.product.product_images?.[0] ? (
                        <img src={activeSession.product.product_images[0]} alt={activeSession.product.product_name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center" style={{ color: colors.mutedForeground }}>
                          <ImageIcon className="w-10 h-10" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold" style={{ color: colors.foreground }}>{activeSession.product.product_name}</h3>
                      {activeSession.product.price && (
                        <p className="text-sm font-medium mt-1" style={{ color: colors.primary }}>{activeSession.product.price}</p>
                      )}
                      <p className="text-sm mt-2 line-clamp-3" style={{ color: colors.mutedForeground }}>
                        {activeSession.product.short_benefit || activeSession.product.description || "—"}
                      </p>
                    </div>
                  </div>
                </section>

                <section
                  className="rounded-xl p-6 border overflow-y-auto max-h-[600px]"
                  style={{
                    background: colors.card,
                    borderColor: colors.border,
                  }}
                >
                    <div className="mb-4">
                      <h2 className="text-lg font-semibold" style={{ color: colors.foreground }}>
                        Ad Angles
                      </h2>
                    </div>
                    {activeSession.loadingAngles ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="w-8 h-8 animate-spin" style={{ color: colors.primary }} />
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {activeSession.adAngles.map((angle, i) => (
                          <div
                            key={i}
                            className="rounded-lg p-3 border"
                            style={{
                              background: colors.secondary,
                              borderColor: colors.border,
                            }}
                          >
                            <p className="font-medium text-sm" style={{ color: colors.foreground }}>
                              {angle.title}
                            </p>
                            <p className="text-xs mt-1" style={{ color: colors.mutedForeground }}>
                              {angle.explanation}
                            </p>
                            <div className="flex gap-2 mt-2">
                              <Button
                                size="sm"
                                onClick={() => handleGeneratePoster(angle)}
                                disabled={activeSession.generatingAngleId !== null}
                                style={{
                                  background: colors.primary,
                                  color: colors.primaryForeground,
                                  fontSize: 11,
                                }}
                              >
                                {activeSession.generatingAngleId === angle.title ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <>
                                    <ImageIcon className="w-3 h-3 mr-1" />
                                    Generate Poster
                                  </>
                                )}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleVideoAdClick(angle)}
                                disabled={activeSession.creatingVideoAngleId !== null}
                                style={{
                                  borderColor: colors.border,
                                  color: colors.foreground,
                                  fontSize: 11,
                                }}
                              >
                                {activeSession.creatingVideoAngleId === angle.title ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <>
                                    <Video className="w-3 h-3 mr-1" />
                                    Video Ad
                                  </>
                                )}
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>

              {activeSession.campaignPlan.length > 0 && !activeSession.loadingAngles && (
                <section
                  className="rounded-xl p-6 border"
                  style={{
                    background: colors.card,
                    borderColor: colors.border,
                  }}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div
                      className="flex items-center justify-center w-9 h-9 rounded-lg"
                      style={{ background: "hsl(213 100% 55% / 0.15)" }}
                    >
                      <Calendar className="w-5 h-5" style={{ color: colors.primary }} />
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold" style={{ color: colors.foreground }}>
                        Campaign Plan
                      </h2>
                      <p className="text-xs" style={{ color: colors.mutedForeground }}>
                        AI-generated strategy for {activeSession.product.product_name}
                      </p>
                    </div>
                  </div>

                  {activeSession.campaignStrategy && (
                    <div
                      className="rounded-lg p-4 mb-5 mt-3"
                      style={{
                        background: "hsl(213 100% 55% / 0.06)",
                        border: "1px solid hsl(213 100% 55% / 0.15)",
                      }}
                    >
                      <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs mb-2.5">
                        {activeSession.campaignStrategy.product_category && (
                          <span style={{ color: colors.mutedForeground }}>
                            Category:{" "}
                            <span style={{ color: colors.foreground, fontWeight: 500 }}>
                              {activeSession.campaignStrategy.product_category}
                            </span>
                          </span>
                        )}
                        {activeSession.campaignStrategy.target_audience && (
                          <span style={{ color: colors.mutedForeground }}>
                            Audience:{" "}
                            <span style={{ color: colors.foreground, fontWeight: 500 }}>
                              {activeSession.campaignStrategy.target_audience}
                            </span>
                          </span>
                        )}
                      </div>
                      {activeSession.campaignStrategy.content_themes?.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {activeSession.campaignStrategy.content_themes!.map((theme, ti) => (
                            <span
                              key={ti}
                              className="text-xs px-2.5 py-1 rounded-full"
                              style={{
                                background: "hsl(213 100% 55% / 0.12)",
                                color: colors.primary,
                              }}
                            >
                              {theme}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    {activeSession.campaignPlan.map((item, i) => {
                      const isVideo = /video/i.test(item.content_type);
                      const isPosterOrCarousel = /poster|carousel/i.test(item.content_type);
                      const isGenerating = activeSession.generatingCampaignItem === i;
                      return (
                        <div
                          key={i}
                          className="rounded-xl p-5 border transition-all hover:border-[hsl(213_100%_55%/0.5)]"
                          style={{
                            background: colors.secondary,
                            borderColor: colors.border,
                          }}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span
                              className="text-xs font-bold px-2.5 py-1 rounded-md"
                              style={{
                                background: "hsl(213 100% 55% / 0.15)",
                                color: colors.primary,
                              }}
                            >
                              Day {item.day}
                            </span>
                          </div>
                          <p
                            className="text-sm font-semibold mb-3"
                            style={{ color: colors.foreground }}
                          >
                            Goal: {item.goal}
                          </p>

                          <div className="flex items-center gap-2 mb-3">
                            <span
                              className="text-xs font-medium px-2 py-0.5 rounded"
                              style={{
                                background: colors.muted,
                                color: colors.foreground,
                              }}
                            >
                              {item.content_type}
                            </span>
                            <span
                              className="text-xs px-2 py-0.5 rounded"
                              style={{
                                background: colors.muted,
                                color: colors.mutedForeground,
                              }}
                            >
                              {item.platform}
                            </span>
                          </div>

                          <div
                            className="rounded-lg px-3 py-2.5 mb-2"
                            style={{ background: "hsl(0 0% 12%)" }}
                          >
                            <p className="text-xs font-medium mb-0.5" style={{ color: colors.mutedForeground }}>
                              Hook
                            </p>
                            <p
                              className="text-sm font-medium leading-relaxed"
                              style={{ color: colors.foreground }}
                            >
                              &ldquo;{item.hook}&rdquo;
                            </p>
                          </div>

                          {item.description && (
                            <p className="text-xs mb-4" style={{ color: colors.mutedForeground }}>
                              {item.description}
                            </p>
                          )}

                          <Button
                            size="sm"
                            onClick={() => handleCampaignItemGenerate(item, i)}
                            disabled={isGenerating || activeSession.generatingAngleId !== null || activeSession.creatingVideoAngleId !== null}
                            className="w-full mt-1"
                            style={{
                              background: isVideo
                                ? "hsl(213 100% 55%)"
                                : "hsl(213 100% 55% / 0.15)",
                              color: isVideo ? colors.primaryForeground : colors.primary,
                              fontSize: 12,
                              fontWeight: 600,
                            }}
                          >
                            {isGenerating ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                            ) : isVideo ? (
                              <Play className="w-3.5 h-3.5 mr-1.5" />
                            ) : (
                              <ImageIcon className="w-3.5 h-3.5 mr-1.5" />
                            )}
                            {isGenerating
                              ? "Generating..."
                              : isVideo
                                ? "Generate Video Ad"
                                : isPosterOrCarousel
                                  ? "Generate Poster"
                                  : "Generate Creative"}
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              {activeSession.generatedPosters.length > 0 && (
                <section
                  className="rounded-2xl p-8 border shadow-lg"
                  style={{
                    background: colors.card,
                    borderColor: colors.border,
                  }}
                >
                  <h2 className="text-xl font-semibold mb-2" style={{ color: colors.foreground }}>
                    Generated Creatives
                  </h2>
                  <p className="text-sm mb-6" style={{ color: colors.mutedForeground }}>
                    Click Edit to describe the exact change you want (e.g. fix a typo, add text) and regenerate.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {activeSession.generatedPosters.map((img, i) => (
                      <div
                        key={i}
                        className="group rounded-xl overflow-hidden border-2 transition-all hover:border-[hsl(213_100%_55%)] hover:shadow-xl"
                        style={{
                          borderColor: colors.border,
                          background: colors.muted,
                        }}
                      >
                        <div className="aspect-[4/5] relative overflow-hidden">
                          <img
                            src={img}
                            alt={`Creative ${i + 1}`}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                          <div className="absolute bottom-0 left-0 right-0 p-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              size="sm"
                              onClick={() => setEditingPosterIndex(i)}
                              className="flex-1"
                              style={{
                                background: colors.primary,
                                color: colors.primaryForeground,
                              }}
                            >
                              <Pencil className="w-3.5 h-3.5 mr-1" />
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => handleDownload(img, `creative-${i + 1}.png`)}
                              style={{ color: colors.foreground }}
                            >
                              <Download className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => window.open(img, "_blank")}
                              style={{ color: colors.foreground }}
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                        <div className="p-3 flex items-center justify-between" style={{ background: colors.card }}>
                          <span className="text-sm font-medium" style={{ color: colors.foreground }}>
                            Poster {i + 1}
                          </span>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditingPosterIndex(i)}
                            style={{ color: colors.primary, fontSize: 12 }}
                          >
                            Edit
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {activeSession.campaign && (
                <section
                  className="rounded-xl p-6 border"
                  style={{
                    background: colors.card,
                    borderColor: colors.border,
                  }}
                >
                  <h2 className="text-lg font-semibold mb-4" style={{ color: colors.foreground }}>
                    Campaign: {activeSession.campaign.name}
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {activeSession.campaign.ads.map((ad, i) => (
                      <div
                        key={i}
                        className="rounded-lg p-4 border"
                        style={{
                          background: colors.secondary,
                          borderColor: colors.border,
                        }}
                      >
                        <span
                          className="text-xs font-medium px-2 py-0.5 rounded"
                          style={{
                            background: colors.primary,
                            color: colors.primaryForeground,
                          }}
                        >
                          {ad.type}
                        </span>
                        <h3 className="font-medium mt-2" style={{ color: colors.foreground }}>
                          {ad.title}
                        </h3>
                        <p className="text-sm mt-1" style={{ color: colors.mutedForeground }}>
                          {ad.description}
                        </p>
                        <p className="text-xs mt-2" style={{ color: colors.foreground }}>
                          Hook: {ad.hook}
                        </p>
                        <p className="text-xs" style={{ color: colors.primary }}>
                          CTA: {ad.cta}
                        </p>
                      </div>
                    ))}
                  </div>
                </section>
              )}
                    </div>
                  </div>
                </div>
              )}
                </>
              )}
            </div>
          )}

          {step === "scanning" && (
            <div className="text-center py-24 space-y-8 max-w-lg mx-auto">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl" style={{ background: "hsl(213 100% 55% / 0.2)" }}>
                <Loader2 className="w-10 h-10 animate-spin" style={{ color: colors.primary }} />
              </div>
              <div className="space-y-1">
                <h2 className="text-xl font-semibold" style={{ color: colors.foreground }}>
                  {SCAN_MESSAGES[scanMessageIndex].text}
                </h2>
                <p className="text-sm" style={{ color: colors.mutedForeground }}>
                  {SCAN_MESSAGES[scanMessageIndex].detail}
                </p>
              </div>
              <div className="space-y-2">
                <Progress value={scanProgress} className="max-w-md mx-auto h-2.5 rounded-full" />
                <p className="text-xs" style={{ color: colors.mutedForeground }}>
                  Estimated time: 3–6 minutes
                </p>
              </div>
              <div
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm animate-pulse"
                style={{
                  background: "hsl(213 100% 55% / 0.08)",
                  color: colors.mutedForeground,
                }}
              >
                <span className="text-lg" role="img" aria-hidden>☕</span>
                <span>Grab a coffee and relax in the meantime</span>
              </div>
            </div>
          )}
        </div>
        </div>
      </div>

      {/* Brand Onboarding Modal */}
      {showBrandOnboarding && (
        <BrandOnboarding
          mode={onboardingMode}
          onModeChange={setOnboardingMode}
          onWebsiteSubmit={handleWebsiteBrandSetup}
          onManualSubmit={handleManualBrandSetup}
          onSkip={handleSkipBrandSetup}
          isLoading={isAnalyzingBrand}
        />
      )}

      {/* Brand Guideline Modal */}
      {showBrandGuidelineModal && (brandGuideline || brand) && (
        <BrandGuidelineModal
          brand={
            brandGuideline ||
            (brand
              ? {
                  name: brand.name,
                  description: brand.primaryValueProposition,
                  audience: brand.targetAudience,
                  offering: brand.industry,
                  tone: brand.tone,
                }
              : { name: "", description: "", audience: "", offering: "", tone: "professional" })
          }
          onUpdate={updateBrandGuideline}
          onClose={() => {
            authFetch("/api/user/preferences", { method: "PUT", body: JSON.stringify({ preferences: { guideline_seen: true } }) }).catch(() => {});
            setShowBrandGuidelineModal(false);
          }}
          onWebsiteAnalyze={handleWebsiteAnalyzeForEdit}
        />
      )}

      {/* Poster Edit Modal */}
      {editingPosterIndex !== null && activeSession?.generatedPosters[editingPosterIndex] && (
        <PosterEditModal
          imageUrl={activeSession.generatedPosters[editingPosterIndex]}
          posterIndex={editingPosterIndex}
          onClose={() => setEditingPosterIndex(null)}
          onRegenerate={(editPrompt) =>
            handleRegenerateWithEdit(
              activeSession!.generatedPosters[editingPosterIndex],
              editingPosterIndex,
              editPrompt
            )
          }
        />
      )}

      {/* Insufficient Credits Alert */}
      {insufficientCreditsType && (
        <InsufficientCreditsAlert
          type={insufficientCreditsType}
          onClose={() => setInsufficientCreditsType(null)}
        />
      )}
    </div>
  );
}
