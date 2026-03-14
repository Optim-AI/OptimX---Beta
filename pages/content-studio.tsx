// pages/content-studio.tsx
// Content Studio: Turn your website into high-converting ads

import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
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
import { DEFAULT_AD_BUILDER_DATA } from "@/app/web/src/components/creative-studio/utils";
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
import { CreditDisplay } from "@/app/web/src/components/billing/CreditDisplay";
import { InsufficientCreditsAlert } from "@/app/web/src/components/billing/InsufficientCreditsAlert";
import { useSubscription } from "@/app/web/src/hooks/use-subscription";

type BrandSummary = {
  name: string;
  tone: string;
  industry: string;
  targetAudience: string;
  primaryValueProposition: string;
};

type Product = {
  product_name: string;
  price: string | null;
  description: string;
  key_benefits: string[];
  product_images: string[];
  target_audience: string;
  emotional_angles: string[];
  use_cases: string[];
  short_benefit: string;
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
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [expandedProductIndex, setExpandedProductIndex] = useState<number | null>(null);
  const [adAngles, setAdAngles] = useState<AdAngle[]>([]);
  const [loadingAngles, setLoadingAngles] = useState(false);
  const [generatedPosters, setGeneratedPosters] = useState<string[]>([]);
  const [generatingAngleId, setGeneratingAngleId] = useState<string | null>(null);
  const [campaign, setCampaign] = useState<{ name: string; ads: CampaignAd[] } | null>(null);
  const [loadingCampaign, setLoadingCampaign] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanId, setScanId] = useState<string | null>(null);

  const [brandGuideline, setBrandGuideline] = useState<BrandSnapshot | null>(null);
  const [showBrandGuidelineModal, setShowBrandGuidelineModal] = useState(false);
  const [showBrandOnboarding, setShowBrandOnboarding] = useState(false);
  const [isAnalyzingBrand, setIsAnalyzingBrand] = useState(false);
  const [onboardingMode, setOnboardingMode] = useState<"website" | "manual">("website");
  const [editingPosterIndex, setEditingPosterIndex] = useState<number | null>(null);
  const [creatingVideoAngleId, setCreatingVideoAngleId] = useState<string | null>(null);
  const [editingPosterUrl, setEditingPosterUrl] = useState<string | null>(null);
  const [productsCollapsed, setProductsCollapsed] = useState(false);
  const [insufficientCreditsType, setInsufficientCreditsType] = useState<"image" | "video" | null>(null);

  const { credits, fetchSubscription } = useSubscription();

  function saveBrandSnapshot(snapshot: BrandSnapshot) {
    localStorage.setItem("brand:snapshot", JSON.stringify(snapshot));
    authFetch("/api/brand/snapshot", {
      method: "PUT",
      body: JSON.stringify({ brandSnapshot: snapshot }),
    }).catch(() => {});
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Try loading from DB first
      try {
        const res = await authFetch("/api/brand/snapshot");
        const data = await res.json();
        if (!cancelled && data.brandSnapshot) {
          setBrandGuideline(data.brandSnapshot);
          localStorage.setItem("brand:snapshot", JSON.stringify(data.brandSnapshot));
          return;
        }
      } catch {
        /* fall through to localStorage */
      }
      if (cancelled) return;
      // Fall back to localStorage
      const stored = localStorage.getItem("brand:snapshot");
      if (stored) {
        try {
          const parsed = JSON.parse(stored) as BrandSnapshot;
          setBrandGuideline(parsed);
        } catch {
          setShowBrandOnboarding(true);
        }
      } else {
        setShowBrandOnboarding(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Restore last scan from DB when user returns to the page
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await authFetch("/api/content-studio/scans");
        const data = await res.json();
        if (cancelled) return;
        if (data.ok && data.scans?.length > 0) {
          const latest = data.scans[0];
          const brand = latest.brandSummary as BrandSummary | null;
          const products = (latest.products || []) as Product[];
          if (products.length > 0 || brand) {
            setUrl(latest.url || "");
            setBrand(brand);
            setProducts(products);
            setScanId(latest.id);
            setStep("results");

            // Also load campaigns and posters for this scan
            try {
              const detailRes = await authFetch(`/api/content-studio/scans?id=${latest.id}`);
              const detailData = await detailRes.json();
              if (!cancelled && detailData.ok) {
                if (detailData.campaigns?.length > 0) {
                  const c = detailData.campaigns[0];
                  setCampaign({ name: c.campaignName || "Campaign", ads: c.ads || [] });
                }
                if (detailData.posters?.length > 0) {
                  const allUrls = detailData.posters.flatMap((p: any) => p.imageUrls || []);
                  if (allUrls.length > 0) setGeneratedPosters(allUrls);
                }
              }
            } catch {
              /* non-critical */
            }
          }
        }
      } catch {
        /* ignore - user may not have any scans yet */
      }
    })();
    return () => { cancelled = true; };
  }, []);

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
      setSelectedProduct(null);
      setExpandedProductIndex(null);
      setAdAngles([]);
      setCampaign(null);
      setGeneratedPosters([]);
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
      // Collapse if clicking the same product
      setExpandedProductIndex(null);
      setSelectedProduct(null);
      setAdAngles([]);
      return;
    }
    setExpandedProductIndex(index);
    setSelectedProduct(product);
    setAdAngles([]);
    setGeneratedPosters([]);
    setCampaign(null);
    setLoadingAngles(true);
    try {
      const res = await authFetch("/api/content-studio/ad-angles", {
        method: "POST",
        body: JSON.stringify({ product, brand }),
      });
      const data = await res.json();
      if (data.ok && data.angles) {
        setAdAngles(data.angles);
      }
    } catch {
      setAdAngles([]);
    } finally {
      setLoadingAngles(false);
    }
  };

  const handleGeneratePoster = async (angle?: AdAngle) => {
    if (!selectedProduct) return;
    if (!credits || credits.imageCredits.total < 3) {
      setInsufficientCreditsType("image");
      return;
    }
    const angleId = angle ? angle.title : "__default__";
    setGeneratingAngleId(angleId);
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
        setGeneratedPosters((prev) => [...prev, ...posters]);
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
      setGeneratingAngleId(null);
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
      if (data.ok && data.campaign) {
        setCampaign(data.campaign);
      } else {
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
    if (!selectedProduct || (!brandGuideline && !brand)) {
      showError("Please set up brand guidelines first");
      return;
    }
    if (!credits || credits.videoCredits.total < 1) {
      setInsufficientCreditsType("video");
      return;
    }
    setCreatingVideoAngleId(angle.title);
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
      setCreatingVideoAngleId(null);
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
      if (data.ok && data.image) {
        setGeneratedPosters((prev) =>
          prev.map((url, i) => (i === posterIndex ? data.image : url))
        );
      } else {
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
    setSelectedProduct(null);
    setExpandedProductIndex(null);
    setAdAngles([]);
    setGeneratedPosters([]);
    setCampaign(null);
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
    localStorage.setItem("brand:guideline_seen", "true");
    setShowBrandGuidelineModal(false);
  }

  const hasFetchedProducts = products.length > 0 || brand !== null;

  return (
    <div className="flex min-h-screen" style={{ background: colors.background }}>
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="max-w-6xl mx-auto px-6 py-10">
          {(step === "entry" || step === "results") && (
            <div className="flex flex-col items-center py-12">
              <div className="flex flex-col items-center mb-8">
                <div className="flex items-center justify-center w-14 h-14 rounded-full mb-4" style={{ background: "hsl(213 100% 55% / 0.15)" }}>
                  <Sparkles className="w-7 h-7" style={{ color: colors.primary }} />
                </div>
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium mb-4" style={{ background: "hsl(213 100% 55% / 0.15)", color: colors.primary }}>
                  AI-Powered Content Studio
                </div>
                <h1 className="text-4xl md:text-5xl font-bold tracking-tight max-w-6xl mx-auto text-center" style={{ color: colors.foreground }}>
                  Let&apos;s turn your website into high converting ads
                </h1>
                <div className="mt-3">
                  <CreditDisplay variant="compact" showRefresh />
                </div>
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
                  {products.map((p, i) => (
                    <React.Fragment key={i}>
                    <div
                      onClick={() => handleProductClick(p, i)}
                      className="rounded-xl p-4 border-2 cursor-pointer transition-all hover:border-[hsl(213_100%_55%)] hover:shadow-lg"
                      style={{
                        background: colors.card,
                        borderColor:
                          expandedProductIndex === i ? colors.primary : colors.border,
                      }}
                    >
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
                      <div className="flex flex-wrap gap-2 mt-3">
                        <Button
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleProductClick(p, i);
                          }}
                          style={{
                            background: colors.primary,
                            color: colors.primaryForeground,
                            fontSize: 11,
                          }}
                        >
                          Generate Ads
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedProduct(p);
                            setExpandedProductIndex(i);
                            handleCreateCampaign(p);
                          }}
                          style={{
                            borderColor: colors.border,
                            color: colors.foreground,
                            fontSize: 11,
                          }}
                        >
                          Create Campaign
                        </Button>
                      </div>
                    </div>

                    {/* Inline expanded panel for this product */}
                    {expandedProductIndex === i && (
                      <div
                        className="col-span-full rounded-xl p-6 border space-y-6"
                        style={{
                          background: colors.card,
                          borderColor: colors.border,
                        }}
                      >
                        {/* Ad Angles */}
                        <div>
                          <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-semibold" style={{ color: colors.foreground }}>
                              Ad Angles for {p.product_name}
                            </h2>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => { setExpandedProductIndex(null); setSelectedProduct(null); }}
                              style={{ color: colors.mutedForeground }}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                          {loadingAngles ? (
                            <div className="flex items-center justify-center py-8">
                              <Loader2 className="w-8 h-8 animate-spin" style={{ color: colors.primary }} />
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {adAngles.map((angle, ai) => (
                                <div
                                  key={ai}
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
                                      disabled={generatingAngleId === angle.title}
                                      style={{
                                        background: colors.primary,
                                        color: colors.primaryForeground,
                                        fontSize: 11,
                                      }}
                                    >
                                      {generatingAngleId === angle.title ? (
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
                                      disabled={creatingVideoAngleId === angle.title}
                                      style={{
                                        borderColor: colors.border,
                                        color: colors.foreground,
                                        fontSize: 11,
                                      }}
                                    >
                                      {creatingVideoAngleId === angle.title ? (
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
                        </div>

                        {/* Generated Posters (inline) */}
                        {generatedPosters.length > 0 && (
                          <div>
                            <h2 className="text-xl font-semibold mb-2" style={{ color: colors.foreground }}>
                              Generated Creatives
                            </h2>
                            <p className="text-sm mb-6" style={{ color: colors.mutedForeground }}>
                              Click Edit to describe the exact change you want (e.g. fix a typo, add text) and regenerate.
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                              {generatedPosters.map((img, pi) => (
                                <div
                                  key={pi}
                                  className="group rounded-xl overflow-hidden border-2 transition-all hover:border-[hsl(213_100%_55%)] hover:shadow-xl"
                                  style={{
                                    borderColor: colors.border,
                                    background: colors.muted,
                                  }}
                                >
                                  <div className="aspect-[4/5] relative overflow-hidden">
                                    <img
                                      src={img}
                                      alt={`Creative ${pi + 1}`}
                                      className="w-full h-full object-cover"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                    <div className="absolute bottom-0 left-0 right-0 p-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <Button
                                        size="sm"
                                        onClick={() => setEditingPosterIndex(pi)}
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
                                        onClick={() => handleDownload(img, `creative-${pi + 1}.png`)}
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
                                      Poster {pi + 1}
                                    </span>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => setEditingPosterIndex(pi)}
                                      style={{ color: colors.primary, fontSize: 12 }}
                                    >
                                      Edit
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Campaign (inline) */}
                        {campaign && (
                          <div>
                            <h2 className="text-lg font-semibold mb-4" style={{ color: colors.foreground }}>
                              Campaign: {campaign.name}
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {campaign.ads.map((ad, ci) => (
                                <div
                                  key={ci}
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
                          </div>
                        )}

                        {loadingCampaign && (
                          <div className="flex items-center justify-center py-6">
                            <Loader2 className="w-6 h-6 animate-spin" style={{ color: colors.primary }} />
                            <span className="ml-2 text-sm" style={{ color: colors.mutedForeground }}>Generating campaign...</span>
                          </div>
                        )}
                      </div>
                    )}
                    </React.Fragment>
                  ))}
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
      </main>

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
            localStorage.setItem("brand:guideline_seen", "true");
            setShowBrandGuidelineModal(false);
          }}
          onWebsiteAnalyze={handleWebsiteAnalyzeForEdit}
        />
      )}

      {/* Poster Edit Modal */}
      {editingPosterIndex !== null && generatedPosters[editingPosterIndex] && (
        <PosterEditModal
          imageUrl={generatedPosters[editingPosterIndex]}
          posterIndex={editingPosterIndex}
          onClose={() => setEditingPosterIndex(null)}
          onRegenerate={(editPrompt) =>
            handleRegenerateWithEdit(
              generatedPosters[editingPosterIndex],
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
