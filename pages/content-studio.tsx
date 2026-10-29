// pages/content-studio.tsx
// Ad Studio: Turn your website into high-converting ads

import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import BrandKitCard from "@/app/web/src/components/creative-studio/BrandKitCard";
import Sidebar from "@/app/web/src/components/Sidebar";
import colors from "@/lib/ui/colors";
import { authFetch, safeResponseJson } from "@/lib/utils";
import { friendlyError } from "@/lib/api-errors";
import { showError, showAlert } from "@/app/web/src/components/ui/alert-modal-api";
import {
  type BrandSnapshot,
  BrandOnboarding,
  mapFullAnalyzeToBrandSnapshot,
} from "@/app/web/src/components/creative-studio";
import { DEFAULT_AD_BUILDER_DATA, saveBrandSnapshot } from "@/app/web/src/components/creative-studio/utils";
import type { Product } from "@/app/web/src/components/creative-studio/types";
import {
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
import { ArcSpinner, StepProgress } from "@/app/web/src/components/ui/loaders";
import PosterEditModal from "@/app/web/src/components/content-studio/PosterEditModal";
import {
  AngleMeta,
  StrategyBriefPanel,
  StrategyLoading,
  angleCreativeBrief,
} from "@/app/web/src/components/content-studio/StrategyBrief";
import type { StrategyAngle, StrategyBrief } from "@/lib/research/product-strategy";
import { CarouselStudio } from "@/app/web/src/components/creative-studio/CarouselStudio";
import CreativeViewer from "@/app/web/src/components/creative-studio/CreativeViewer";
import type { PublicCarouselCampaign } from "@/app/web/src/components/creative-studio/carousel-client";
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

/** Older saved versions only have title + explanation; new strategy adds the reasoning. */
type AdAngle = Partial<StrategyAngle> & {
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
  angle?: string;
  rationale?: string;
};

type CampaignStrategy = {
  product_category: string;
  target_audience: string;
  content_themes: string[];
  brief?: StrategyBrief;
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
  /** Carousel plan items → a planned/generating carousel from the Brand Studio engine */
  carousel?: { itemIndex: number; campaign: PublicCarouselCampaign } | null;
  planningCarouselItem?: number | null;
};

const SCAN_MESSAGES = [
  { text: "Crawling your website...", detail: "Discovering pages and structure" },
  { text: "Identifying product pages...", detail: "Finding shop, collections & product URLs" },
  { text: "Extracting product data...", detail: "Pulling images, prices & descriptions" },
  { text: "Understanding brand identity...", detail: "Analyzing tone, audience & value proposition" },
];

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
  const [brandLoaded, setBrandLoaded] = useState(false);
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

  const [recentlyClosed, setRecentlyClosed] = useState<Product[]>([]);
  const [showRecentlyClosed, setShowRecentlyClosed] = useState(false);
  const recentlyClosedBtnRef = React.useRef<HTMLButtonElement>(null);

  const { credits, fetchSubscription } = useSubscription();
  /** Slides per carousel plan item (by plan index); 5 by default. */
  const [carouselSlides, setCarouselSlides] = useState<Record<number, number>>({});
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  const [imageCredits, setImageCredits] = useState<number | null>(null);
  const [videoCredits, setVideoCredits] = useState<number | null>(null);
  const [creditsPending, setCreditsPending] = useState(false);

  const activeSession = activeSessionId ? sessions.find((s) => s.id === activeSessionId) : null;
  const selectedProduct = activeSession?.product ?? null;

  useEffect(() => {
    if (!router.isReady) return;
    setCreditsPending(router.query.credits === 'pending');
  }, [router.isReady, router.query.credits]);

  useEffect(() => {
    async function loadCredits() {
      try {
        // Always hit the server — do not trust persisted zeros after checkout
        await fetchSubscription({ force: true });
        const response = await authFetch('/api/credits/balance');
        const data = await response.json();
        if (data.success) {
          const img = data.imageCredits?.total ?? 0;
          const vid = data.videoCredits?.total ?? 0;
          setImageCredits(img);
          setVideoCredits(vid);
          if (img > 0 || vid > 0) {
            setCreditsPending(false);
          }
        }
      } catch (err) {
        console.error('Error loading credits:', err);
      }
    }
    void loadCredits();
    const onFocus = () => {
      void loadCredits();
    };
    window.addEventListener('focus', onFocus);
    const intervalId = window.setInterval(
      () => {
        void loadCredits();
      },
      creditsPending ? 4000 : 30000
    );
    return () => {
      window.removeEventListener('focus', onFocus);
      window.clearInterval(intervalId);
    };
  }, [fetchSubscription, creditsPending]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Try loading from DB first
      try {
        const res = await authFetch("/api/brand/snapshot");
        const data = await res.json();
        if (!cancelled && data.brandSnapshot) {
          setBrandGuideline(data.brandSnapshot);
          setBrandLoaded(true);
          return;
        }
      } catch {
        // no snapshot available
      }
      if (cancelled) return;
      setBrandLoaded(true);
      // No brand yet: a banner suggests the Brand Kit; the scan still works without it.
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
      // Brand Research in the background, so product strategies can build on it.
      void authFetch("/api/brand/research", { method: "POST", body: JSON.stringify({ url: normalized }) }).catch(() => null);
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
      setError(friendlyError(err, "Failed to scan website"));
      setStep("entry");
      showError(friendlyError(err, "Failed to scan website"));
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
        body: JSON.stringify({ product, brand, website: url ? normalizeUrl(url) : undefined }),
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
      const closed = prev.find((s) => s.id === sessionId);
      if (closed) {
        setRecentlyClosed((rc) => {
          const already = rc.some((p) => p.product_name === closed.product.product_name);
          if (already) return rc;
          return [closed.product, ...rc].slice(0, 10);
        });
      }
      const next = prev.filter((s) => s.id !== sessionId);
      if (activeSessionId === sessionId) {
        setActiveSessionId(next[0]?.id ?? null);
      }
      return next;
    });
    setExpandedProductIndex(null);
  };

  const reopenClosedTab = (product: Product) => {
    setRecentlyClosed((rc) => rc.filter((p) => p.product_name !== product.product_name));
    setShowRecentlyClosed(false);
    const existingSession = sessions.find((s) => s.product.product_name === product.product_name);
    if (existingSession) {
      setActiveSessionId(existingSession.id);
      return;
    }
    const idx = products.findIndex((p) => p.product_name === product.product_name);
    handleProductClick(product, idx >= 0 ? idx : 0);
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
        body: JSON.stringify({ product, brand, website: url ? normalizeUrl(url) : undefined }),
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

  const viewerBrand = {
    name: brandGuideline?.name || brand?.name || "yourbrand",
    logo: brandGuideline?.logo || brandGuideline?.logoUrl || null,
    website: url ? normalizeUrl(url) : brandGuideline?.website_url || null,
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
      // Same poster engine as Brand Studio (strategist → concepts → art-directed posters),
      // driven by this angle and the product's campaign strategy.
      const brief = activeSession.campaignStrategy?.brief;
      const res = await authFetch("/api/content-studio/engine-posters", {
        method: "POST",
        body: JSON.stringify({
          product: selectedProduct,
          brand,
          angle: angle
            ? {
                title: angle.title,
                explanation: angle.explanation,
                angle: angle.angle,
                insight: angle.insight,
                message: angle.message,
                proof: angle.proof,
                audience: angle.audience,
                funnel: angle.funnel,
              }
            : null,
          campaign: brief
            ? { bigIdea: brief.big_idea.line, positioning: brief.positioning, avoid: brief.avoid }
            : null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 402) {
        setInsufficientCreditsType("image");
        return;
      }
      const posters: string[] = data.ok && Array.isArray(data.images) ? data.images : [];
      const lastError: string = data.error || "";

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
      showError(friendlyError(err, "Failed to generate poster"));
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
      const source = item.angle
        ? activeSession.adAngles.find((a) => a.angle?.toLowerCase() === item.angle?.toLowerCase())
        : undefined;
      const angle: AdAngle = {
        ...(source || {}),
        title: item.hook,
        explanation: `${item.content_type} for ${item.platform}. Goal: ${item.goal}. ${item.description}`,
        message: item.description || source?.message,
      };
      if (isVideo) {
        await handleVideoAdClick(angle);
      } else if (/carousel/i.test(item.content_type)) {
        await handlePlanCarousel(angle, index, false);
      } else {
        await handleGeneratePoster(angle);
      }
    } finally {
      updateSession(sessionId, () => ({ generatingCampaignItem: null }));
    }
  };

  /** Plan a carousel (story across N slides, no credits); CarouselStudio then generates it. */
  const handlePlanCarousel = async (angle: AdAngle, index: number, replan: boolean) => {
    if (!activeSession || !selectedProduct) return;
    const sessionId = activeSession.id;
    const slideCount = carouselSlides[index] ?? 5;
    updateSession(sessionId, () => ({ planningCarouselItem: index }));
    try {
      const brief = activeSession.campaignStrategy?.brief;
      const res = await authFetch("/api/content-studio/engine-carousel", {
        method: "POST",
        body: JSON.stringify({
          product: selectedProduct,
          brand,
          slideCount,
          angle: {
            title: angle.title,
            explanation: angle.explanation,
            angle: angle.angle,
            insight: angle.insight,
            message: angle.message,
            proof: angle.proof,
            audience: angle.audience,
            funnel: angle.funnel,
          },
          campaign: brief ? { bigIdea: brief.big_idea.line, positioning: brief.positioning, avoid: brief.avoid } : null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.campaign) throw new Error(data.error || "Couldn't plan the carousel.");
      updateSession(sessionId, () => ({ carousel: { itemIndex: index, campaign: data.campaign } }));
      if (!replan) {
        setTimeout(() => document.getElementById("adstudio-carousel")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
      }
    } catch (err: any) {
      showError(friendlyError(err, "Couldn't plan the carousel."));
    } finally {
      updateSession(sessionId, () => ({ planningCarouselItem: null }));
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
      showError(friendlyError(err, "Failed to generate campaign"));
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
    if (!credits || credits.videoCredits.total < 300) {
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
        userDescription: `Ad angle: ${angleCreativeBrief(angle)}`,
        adSetup: {
          ...DEFAULT_AD_BUILDER_DATA.adSetup,
          hookType: "Auto" as const,
          campaignGoal: "Drive Sales" as const,
        },
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
      showError(friendlyError(err, "Failed to create video session"));
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
      showError(friendlyError(err, "Failed to regenerate poster"));
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

  async function handleWebsiteBrandSetup(website: string) {
    setIsAnalyzingBrand(true);
    try {
      const response = await authFetch("/api/brand/fullAnalyze", {
        method: "POST",
        body: JSON.stringify({ url: website }),
      });
      const data = await safeResponseJson<{ result?: unknown; error?: string }>(response);
      if (data.result) {
        const brandSnapshot = mapFullAnalyzeToBrandSnapshot(data.result);
        setBrandGuideline(brandSnapshot);
        saveBrandSnapshot(brandSnapshot);
        setShowBrandOnboarding(false);
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
  }

  const hasFetchedProducts = products.length > 0 || brand !== null;

  return (
    <div className="h-screen flex overflow-hidden app-page">
      <div className="flex-shrink-0 h-full">
        <Sidebar />
      </div>
      <div className="flex-1 flex flex-col h-full overflow-hidden" style={{ backgroundColor: colors.card, borderLeft: `1px solid ${colors.border}` }}>
        {/* Header */}
        <div className="flex-shrink-0 border-b" style={{ borderColor: colors.border, backgroundColor: colors.card }}>
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-4">
            <div>
              <h1 className="flex items-center gap-2 text-2xl font-semibold" style={{ color: colors.foreground }}>
                Ad Studio
                <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold" style={{ background: "rgba(34, 197, 94, 0.18)", color: "#22c55e" }}>Beta</span>
              </h1>
              <p className="mt-0.5 text-sm" style={{ color: colors.mutedForeground }}>
                Your website → a marketer&apos;s strategy for each product → ready-to-run ads.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {creditsPending && (imageCredits === 0 || imageCredits === null) && (
                <span className="rounded-full px-3 py-1.5 text-xs" style={{ background: "hsl(45 90% 50% / 0.15)", color: colors.foreground }}>
                  Payment received — credits are confirming…
                </span>
              )}
              {imageCredits !== null && (
                <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs" style={{ border: `1px solid ${colors.border}`, color: colors.mutedForeground }}>
                  <ImageIcon className="h-3.5 w-3.5" style={{ color: colors.primary }} />
                  <strong style={{ color: colors.foreground }}>{imageCredits}</strong> image credits
                </span>
              )}
              {videoCredits !== null && (
                <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs" style={{ border: `1px solid ${colors.border}`, color: colors.mutedForeground }}>
                  <Video className="h-3.5 w-3.5" style={{ color: "hsl(270 80% 70%)" }} />
                  <strong style={{ color: colors.foreground }}>{videoCredits}</strong> video credits
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto px-6 py-10">
          {(step === "entry" || step === "results") && (
            <div className="flex flex-col items-center">
              {/* No Brand Kit yet: suggest it, without blocking the scan */}
              {brandLoaded && !brandGuideline && (
                <div className="mb-6 flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 rounded-xl px-4 py-3" style={{ background: "hsl(213 100% 55% / 0.1)", border: "1px solid hsl(213 100% 55% / 0.3)" }}>
                  <p className="text-sm" style={{ color: colors.foreground }}>
                    Set up your Brand Kit so every ad uses your logo, colours and fonts.
                  </p>
                  <Link href="/brand-kit?welcome=1" className="inline-flex items-center gap-1 text-sm font-medium" style={{ color: colors.primary }}>
                    Set up Brand Kit <ChevronRight className="h-4 w-4" />
                  </Link>
                </div>
              )}

              {!hasFetchedProducts ? (
                <div className="flex w-full flex-col items-center py-10">
                  <h2 className="max-w-3xl text-center text-3xl font-semibold tracking-tight md:text-4xl" style={{ color: colors.foreground }}>
                    Turn your website into ads that sell
                  </h2>
                  <p className="mt-3 max-w-xl text-center text-base" style={{ color: colors.mutedForeground }}>
                    We read your site, find your products and build a strategy for each one — angles, hooks and finished creatives.
                  </p>
                  <form
                    className="mt-8 flex w-full max-w-2xl flex-col gap-2 rounded-2xl p-2 sm:flex-row"
                    style={{ background: colors.card, border: `1px solid ${colors.border}` }}
                    onSubmit={(e) => { e.preventDefault(); handleAnalyze(); }}
                  >
                    <div className="relative flex-1">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: colors.mutedForeground }} />
                      <Input
                        placeholder="yourbrand.com"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        aria-label="Website URL"
                        className="h-12 border-0 bg-transparent pl-9 text-sm shadow-none focus-visible:ring-0"
                        style={{ color: colors.foreground }}
                      />
                    </div>
                    <Button type="submit" disabled={!url.trim()} className="h-12 rounded-xl px-6 text-sm font-medium" style={{ background: colors.primary, color: colors.primaryForeground }}>
                      <Sparkles className="mr-2 h-4 w-4" /> Find my products
                    </Button>
                  </form>
                  <ol className="mt-10 grid w-full max-w-3xl grid-cols-1 gap-3 sm:grid-cols-3">
                    {[
                      ["1", "Paste your website", "We find your products, prices and photos."],
                      ["2", "Pick a product", "Get a strategy: buyer, angles and hooks."],
                      ["3", "Create the ads", "Posters, carousels and videos per angle."],
                    ].map(([n, t, d]) => (
                      <li key={n} className="rounded-xl p-4" style={{ background: colors.card, border: `1px solid ${colors.border}` }}>
                        <span className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold" style={{ background: "hsl(213 100% 55% / 0.15)", color: colors.primary }}>{n}</span>
                        <p className="mt-2 text-sm font-medium" style={{ color: colors.foreground }}>{t}</p>
                        <p className="mt-0.5 text-xs" style={{ color: colors.mutedForeground }}>{d}</p>
                      </li>
                    ))}
                  </ol>
                </div>
              ) : (
                <form
                  className="flex w-full max-w-6xl flex-wrap items-center gap-2 rounded-xl p-2"
                  style={{ background: colors.card, border: `1px solid ${colors.border}` }}
                  onSubmit={(e) => { e.preventDefault(); handleAnalyze(); }}
                >
                  <div className="relative min-w-[220px] flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: colors.mutedForeground }} />
                    <Input
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      aria-label="Website URL"
                      placeholder="yourbrand.com"
                      className="h-10 border-0 bg-transparent pl-9 text-sm shadow-none focus-visible:ring-0"
                      style={{ color: colors.foreground }}
                    />
                  </div>
                  <Button type="submit" variant="outline" disabled={!url.trim()} className="h-10 rounded-lg text-sm" style={{ borderColor: colors.border, color: colors.foreground }}>
                    <RefreshCw className="mr-2 h-4 w-4" /> Scan again
                  </Button>
                  <Button type="button" variant="ghost" onClick={handleStartOver} className="h-10 rounded-lg text-sm" style={{ color: colors.mutedForeground }}>
                    Start over
                  </Button>
                </form>
              )}

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
                          <span className="text-xs" style={{ color: colors.mutedForeground }}>Pick one to plan its ads</span>
                        </div>

              {/* Brand Kit (replaces the old Brand Guideline) */}
              {brandLoaded && (
                <section className="mb-6">
                  <BrandKitCard brand={brandGuideline} />
                </section>
              )}

              <section>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                  {products.map((p, i) => {
                    const isSelected = selectedProduct?.product_name === p.product_name;
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => handleProductClick(p, i)}
                        className="group relative overflow-hidden rounded-xl text-left transition-all hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
                        style={{ background: colors.card, border: `1px solid ${isSelected ? colors.primary : colors.border}`, boxShadow: isSelected ? `0 0 0 1px ${colors.primary}` : undefined }}
                      >
                        <div className="relative aspect-[4/5] w-full overflow-hidden" style={{ background: colors.secondary }}>
                          {p.product_images?.[0] ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={p.product_images[0]} alt={p.product_name} loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
                          ) : (
                            <span className="flex h-full w-full items-center justify-center" style={{ color: colors.mutedForeground }}>
                              <ImageIcon className="h-10 w-10" />
                            </span>
                          )}
                          {p.price && (
                            <span className="absolute left-2 top-2 rounded-full px-2 py-0.5 text-[11px] font-medium backdrop-blur" style={{ background: "rgba(0,0,0,0.6)", color: "#fff" }}>
                              {p.price}
                            </span>
                          )}
                          {isSelected ? (
                            <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full" style={{ background: colors.primary }}>
                              <Check className="h-3.5 w-3.5" style={{ color: colors.primaryForeground }} />
                            </span>
                          ) : (
                            <span className="absolute inset-x-2 bottom-2 flex items-center justify-center gap-1 rounded-lg py-1.5 text-xs font-medium opacity-0 transition-opacity group-hover:opacity-100" style={{ background: colors.primary, color: colors.primaryForeground }}>
                              Plan ads <ChevronRight className="h-3.5 w-3.5" />
                            </span>
                          )}
                        </div>
                        <div className="px-3 py-2.5">
                          <p className="truncate text-sm font-medium" style={{ color: colors.foreground }}>{p.product_name}</p>
                          <p className="mt-0.5 line-clamp-2 text-xs" style={{ color: colors.mutedForeground }}>
                            {p.short_benefit || p.description || "—"}
                          </p>
                        </div>
                      </button>
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
                {/* Open products — one pill per product being planned */}
                <div className="mt-6 flex w-full max-w-6xl items-center gap-2 pb-3" style={{ borderBottom: `1px solid ${colors.border}` }}>
                  <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto">
                    {sessions.map((s) => {
                      const on = activeSessionId === s.id;
                      const thumb = s.product.product_images?.[0];
                      return (
                        <div
                          key={s.id}
                          className="flex shrink-0 items-center gap-1 rounded-full py-1 pl-1 pr-2 text-sm transition-colors"
                          style={{
                            background: on ? colors.card : "transparent",
                            color: on ? colors.foreground : colors.mutedForeground,
                            border: `1px solid ${on ? colors.primary : colors.border}`,
                          }}
                        >
                          <button type="button" onClick={() => setActiveSessionId(s.id)} className="flex items-center gap-2 rounded-full pr-1">
                            <span className="h-7 w-7 shrink-0 overflow-hidden rounded-full" style={{ background: colors.secondary }}>
                              {thumb ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={thumb} alt="" className="h-full w-full object-cover" />
                              ) : null}
                            </span>
                            <span className="max-w-[160px] truncate font-medium">{s.product.product_name}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => closeSession(s.id)}
                            aria-label={`Close ${s.product.product_name}`}
                            className="rounded-full p-1 hover:bg-white/10"
                            style={{ color: colors.mutedForeground }}
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  {/* Recently closed tabs history button */}
                  {recentlyClosed.length > 0 && (
                    <div className="relative shrink-0 ml-auto">
                      <button
                        ref={recentlyClosedBtnRef}
                        onClick={() => setShowRecentlyClosed((v) => !v)}
                        className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-medium transition-colors hover:bg-white/5"
                        style={{ color: colors.mutedForeground }}
                        title="Recently closed tabs"
                      >
                        <History className="w-4 h-4" />
                        <span className="flex items-center justify-center w-4.5 h-4.5 rounded-full text-[10px] font-bold" style={{ background: colors.primary, color: colors.primaryForeground }}>
                          {recentlyClosed.length}
                        </span>
                      </button>

                      {showRecentlyClosed && (
                        <>
                          <div className="fixed inset-0 z-[9998]" onClick={() => setShowRecentlyClosed(false)} />
                          <div
                            className="absolute right-0 top-full mt-1 w-72 rounded-lg border shadow-xl z-[9999] overflow-hidden"
                            style={{ background: colors.card, borderColor: colors.border }}
                          >
                            <div className="px-3 py-2.5 border-b flex items-center justify-between" style={{ borderColor: colors.border }}>
                              <span className="text-xs font-semibold" style={{ color: colors.foreground }}>Recently Closed</span>
                              <button
                                onClick={() => { setRecentlyClosed([]); setShowRecentlyClosed(false); }}
                                className="text-[10px] px-1.5 py-0.5 rounded hover:bg-white/5 transition-colors"
                                style={{ color: colors.mutedForeground }}
                              >
                                Clear all
                              </button>
                            </div>
                            <div className="max-h-64 overflow-y-auto py-1">
                              {recentlyClosed.map((product) => (
                                <button
                                  key={product.product_name}
                                  onClick={() => reopenClosedTab(product)}
                                  className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-white/5 transition-colors"
                                >
                                  {product.product_images?.[0] ? (
                                    <img
                                      src={product.product_images[0]}
                                      alt=""
                                      className="w-8 h-8 rounded object-cover shrink-0"
                                      style={{ border: `1px solid ${colors.border}` }}
                                    />
                                  ) : (
                                    <div className="w-8 h-8 rounded shrink-0 flex items-center justify-center" style={{ background: colors.muted }}>
                                      <ImageIcon className="w-4 h-4" style={{ color: colors.mutedForeground }} />
                                    </div>
                                  )}
                                  <span className="text-sm truncate" style={{ color: colors.foreground }}>
                                    {product.product_name}
                                  </span>
                                  <RefreshCw className="w-3.5 h-3.5 shrink-0 ml-auto" style={{ color: colors.mutedForeground }} />
                                </button>
                              ))}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  )}
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

                {!activeSession.loadingAngles && activeSession.campaignStrategy?.brief && (
                  <StrategyBriefPanel brief={activeSession.campaignStrategy.brief} />
                )}

                <section
                  className="rounded-xl p-6 border overflow-y-auto max-h-[720px]"
                  style={{
                    background: colors.card,
                    borderColor: colors.border,
                  }}
                >
                    <div className="mb-4">
                      <h2 className="text-lg font-semibold" style={{ color: colors.foreground }}>
                        Ad Angles
                      </h2>
                      {!activeSession.loadingAngles && activeSession.adAngles.length > 0 && !activeSession.campaignStrategy?.brief && (
                        <p className="text-xs mt-0.5" style={{ color: colors.mutedForeground }}>
                          Basic angles from the product page. Regenerate for a researched strategy.
                        </p>
                      )}
                    </div>
                    {activeSession.loadingAngles ? (
                      <StrategyLoading />
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
                            {angle.message ? (
                              <AngleMeta angle={angle} />
                            ) : (
                              <p className="text-xs mt-1" style={{ color: colors.mutedForeground }}>
                                {angle.explanation}
                              </p>
                            )}
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
                                  <>
                                    <ArcSpinner className="w-3 h-3 animate-spin mr-1" />
                                    Designing 3 posters… 1–2 min
                                  </>
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
                                  <ArcSpinner className="w-3 h-3 animate-spin" />
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
                      const isCarousel = /carousel/i.test(item.content_type);
                      const isPosterOrCarousel = !isCarousel && /poster/i.test(item.content_type);
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
                            <p className="text-xs mb-2" style={{ color: colors.mutedForeground }}>
                              {item.description}
                            </p>
                          )}
                          {(item.angle || item.rationale) && (
                            <p className="text-[11px] mb-4 leading-relaxed" style={{ color: colors.mutedForeground }}>
                              {item.angle && <span className="font-medium" style={{ color: colors.foreground }}>{item.angle}. </span>}
                              {item.rationale}
                            </p>
                          )}
                          {!item.angle && !item.rationale && <div className="mb-2" />}

                          {isCarousel && (
                            <label className="flex items-center justify-between gap-2 mb-2 text-xs" style={{ color: colors.mutedForeground }}>
                              Slides
                              <select
                                value={carouselSlides[i] ?? 5}
                                onChange={(e) => setCarouselSlides((m) => ({ ...m, [i]: Number(e.target.value) }))}
                                className="rounded-md px-2 py-1 text-xs"
                                style={{ background: colors.muted, color: colors.foreground, border: `1px solid ${colors.border}` }}
                              >
                                {[3, 4, 5, 6, 7, 8].map((n) => (
                                  <option key={n} value={n}>{n} slides · {n} credits</option>
                                ))}
                              </select>
                            </label>
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
                              <ArcSpinner className="w-3.5 h-3.5 animate-spin mr-1.5" />
                            ) : isVideo ? (
                              <Play className="w-3.5 h-3.5 mr-1.5" />
                            ) : (
                              <ImageIcon className="w-3.5 h-3.5 mr-1.5" />
                            )}
                            {isGenerating
                              ? isCarousel
                                ? "Planning the slide story…"
                                : "Generating..."
                              : isVideo
                                ? "Generate Video Ad"
                                : isCarousel
                                  ? activeSession.carousel?.itemIndex === i
                                    ? "Plan carousel again"
                                    : `Plan ${carouselSlides[i] ?? 5}-slide carousel`
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

              {activeSession.carousel && (
                <section id="adstudio-carousel" className="rounded-xl p-6 border" style={{ background: colors.card, borderColor: colors.border }}>
                  <h2 className="text-lg font-semibold" style={{ color: colors.foreground }}>
                    Carousel · Day {activeSession.campaignPlan[activeSession.carousel.itemIndex]?.day ?? ""}
                  </h2>
                  <p className="text-xs mt-0.5 mb-4" style={{ color: colors.mutedForeground }}>
                    &ldquo;{activeSession.campaignPlan[activeSession.carousel.itemIndex]?.hook}&rdquo; — one story across {activeSession.carousel.campaign.slideCount} slides. Review the story, then generate the slides.
                  </p>
                  <CarouselStudio
                    campaign={activeSession.carousel.campaign}
                    onCampaignChange={(c) =>
                      updateSession(activeSession.id, (s) => ({ carousel: s.carousel ? { ...s.carousel, campaign: c } : s.carousel }))
                    }
                    onRegenerateStory={async () => {
                      const idx = activeSession.carousel!.itemIndex;
                      const item = activeSession.campaignPlan[idx];
                      if (!item) return;
                      const source = item.angle
                        ? activeSession.adAngles.find((a) => a.angle?.toLowerCase() === item.angle?.toLowerCase())
                        : undefined;
                      await handlePlanCarousel(
                        { ...(source || {}), title: item.hook, explanation: item.description, message: item.description || source?.message },
                        idx,
                        true
                      );
                    }}
                    isPlanning={activeSession.planningCarouselItem != null}
                    creditsAvailable={credits?.imageCredits.total ?? null}
                    onCreditsChanged={() => void fetchSubscription({ force: true })}
                    onError={(message) => showError(message)}
                    onNotice={(message) => showAlert(message)}
                    brand={viewerBrand}
                  />
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
                            className="w-full h-full object-cover cursor-zoom-in"
                            onClick={() => setViewerIndex(i)}
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
            <div className="mx-auto flex max-w-md flex-col items-center py-24">
              <div className="w-full rounded-2xl p-6" style={{ background: colors.card, border: `1px solid ${colors.border}` }}>
                <StepProgress
                  step={scanMessageIndex}
                  estimatedMs={240_000}
                  hint="usually 3–6 minutes — you can grab a coffee"
                  steps={SCAN_MESSAGES.map((m) => m.text)}
                />
                <p className="mt-3 text-xs" style={{ color: colors.mutedForeground }}>{SCAN_MESSAGES[scanMessageIndex].detail}</p>
              </div>
            </div>
          )}

          {/* Beta note — quiet footnote */}
          <p className="mt-12 pb-6 text-center text-xs" style={{ color: colors.mutedForeground }}>
            Ad Studio is in beta. Something look off?{" "}
            <Link href="/report" className="underline underline-offset-2" style={{ color: colors.foreground }}>Tell us</Link>
            {" "}— it helps us improve it.
          </p>
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

      {/* Creative viewer: full size or Instagram / Facebook feed preview */}
      {viewerIndex !== null && activeSession && activeSession.generatedPosters[viewerIndex] && (
        <CreativeViewer
          items={activeSession.generatedPosters.map((img, i) => ({
            id: `${i}-${img.slice(-24)}`,
            images: [img],
            title: `Poster ${i + 1}`,
            caption: selectedProduct?.short_benefit || selectedProduct?.description?.slice(0, 160),
            headline: selectedProduct?.product_name,
          }))}
          index={viewerIndex}
          onIndexChange={setViewerIndex}
          onClose={() => setViewerIndex(null)}
          brand={viewerBrand}
          renderActions={(item, i) => (
            <>
              <Button size="sm" variant="secondary" onClick={() => handleDownload(item.images[0], `creative-${i + 1}.png`)}>
                <Download className="w-3.5 h-3.5 mr-1" /> Download
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  setViewerIndex(null);
                  setEditingPosterIndex(i);
                }}
                style={{ background: colors.primary, color: colors.primaryForeground }}
              >
                <Pencil className="w-3.5 h-3.5 mr-1" /> Edit
              </Button>
            </>
          )}
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
