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
  X,
  Megaphone,
  Target,
  Zap,
  ExternalLink,
  Pencil,
} from "lucide-react";
import PosterEditModal from "@/app/web/src/components/content-studio/PosterEditModal";
import { Button } from "@/app/web/src/components/ui/button";
import { Input } from "@/app/web/src/components/ui/input";
import { Progress } from "@/app/web/src/components/ui/progress";

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
  "Scanning your website...",
  "Identifying product pages...",
  "Extracting product data...",
  "Understanding brand identity...",
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
  const [brand, setBrand] = useState<BrandSummary | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [adAngles, setAdAngles] = useState<AdAngle[]>([]);
  const [loadingAngles, setLoadingAngles] = useState(false);
  const [generatedPosters, setGeneratedPosters] = useState<string[]>([]);
  const [generatingPosters, setGeneratingPosters] = useState(false);
  const [campaign, setCampaign] = useState<{ name: string; ads: CampaignAd[] } | null>(null);
  const [loadingCampaign, setLoadingCampaign] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [brandGuideline, setBrandGuideline] = useState<BrandSnapshot | null>(null);
  const [showBrandGuidelineModal, setShowBrandGuidelineModal] = useState(false);
  const [showBrandOnboarding, setShowBrandOnboarding] = useState(false);
  const [isAnalyzingBrand, setIsAnalyzingBrand] = useState(false);
  const [onboardingMode, setOnboardingMode] = useState<"website" | "manual">("website");
  const [editingPosterIndex, setEditingPosterIndex] = useState<number | null>(null);
  const [creatingVideoSession, setCreatingVideoSession] = useState(false);
  const [editingPosterUrl, setEditingPosterUrl] = useState<string | null>(null);

  useEffect(() => {
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

    const interval = setInterval(() => {
      setScanMessageIndex((i) => (i + 1) % SCAN_MESSAGES.length);
    }, 2000);

    try {
      const res = await authFetch("/api/content-studio/scan", {
        method: "POST",
        body: JSON.stringify({ url: normalized }),
      });
      const data = await res.json();

      clearInterval(interval);

      if (!data.ok) {
        throw new Error(data.error || "Scan failed");
      }

      setBrand(data.brand);
      setProducts(data.products || []);
      setStep("results");
      setSelectedProduct(null);
      setAdAngles([]);
      setCampaign(null);

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
        localStorage.setItem("brand:snapshot", JSON.stringify(merged));
      }
    } catch (err: any) {
      clearInterval(interval);
      setError(err.message || "Failed to scan website");
      setStep("entry");
      showError(err.message || "Failed to scan website");
    }
  };

  const handleProductClick = async (product: Product) => {
    setSelectedProduct(product);
    setAdAngles([]);
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
    setGeneratingPosters(true);
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
      } else {
        showError(lastError || "Failed to generate posters");
      }
    } catch (err: any) {
      showError(err.message || "Failed to generate poster");
    } finally {
      setGeneratingPosters(false);
    }
  };

  const handleCreateCampaign = async (product?: Product) => {
    const p = product || selectedProduct;
    if (!p) return;
    setLoadingCampaign(true);
    try {
      const res = await authFetch("/api/content-studio/generate-campaign", {
        method: "POST",
        body: JSON.stringify({ product: selectedProduct, brand }),
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
    setCreatingVideoSession(true);
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
      setCreatingVideoSession(false);
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
        setEditingPosterIndex(null);
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
    setAdAngles([]);
    setGeneratedPosters([]);
    setCampaign(null);
    setError(null);
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
        localStorage.setItem("brand:snapshot", JSON.stringify(brandSnapshot));
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
    localStorage.setItem("brand:snapshot", JSON.stringify(brandSnapshot));
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
    localStorage.setItem("brand:snapshot", JSON.stringify(minimalBrand));
    setShowBrandOnboarding(false);
    setShowBrandGuidelineModal(true);
  }

  function updateBrandGuideline(updated: BrandSnapshot) {
    setBrandGuideline(updated);
    localStorage.setItem("brand:snapshot", JSON.stringify(updated));
    localStorage.setItem("brand:guideline_seen", "true");
    setShowBrandGuidelineModal(false);
  }

  return (
    <div className="flex min-h-screen" style={{ background: colors.background }}>
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="max-w-6xl mx-auto px-6 py-10">
          {step === "entry" && (
            <div className="flex flex-col items-center py-12">
              <div className="flex flex-col items-center mb-8">
                <div className="flex items-center justify-center w-14 h-14 rounded-full mb-4" style={{ background: "hsl(213 100% 55% / 0.15)" }}>
                  <Sparkles className="w-7 h-7" style={{ color: colors.primary }} />
                </div>
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium mb-4" style={{ background: "hsl(213 100% 55% / 0.15)", color: colors.primary }}>
                  AI-Powered Content Studio
                </div>
                <h1 className="text-4xl md:text-5xl font-bold tracking-tight max-w-6xl mx-auto text-center" style={{ color: colors.foreground }}>
                  Let's turn your website into high converting ads
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

              <p className="text-sm mt-6 text-center" style={{ color: colors.mutedForeground }}>
              </p>
            </div>
          )}

          {step === "scanning" && (
            <div className="text-center py-24 space-y-10">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl" style={{ background: "hsl(213 100% 55% / 0.2)" }}>
                <Loader2 className="w-10 h-10 animate-spin" style={{ color: colors.primary }} />
              </div>
              <h2 className="text-xl font-semibold" style={{ color: colors.foreground }}>
                {SCAN_MESSAGES[scanMessageIndex]}
              </h2>
              <Progress value={33} className="max-w-md mx-auto h-2 rounded-full" />
            </div>
          )}

          {step === "results" && (
            <div className="space-y-10">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold" style={{ color: colors.foreground }}>
                    Content Studio
                  </h1>
                  <p className="text-sm mt-1" style={{ color: colors.mutedForeground }}>
                    {brand?.name && `${brand.name} • `}
                    {products.length} products detected
                  </p>
                </div>
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
                    <div
                      key={i}
                      onClick={() => handleProductClick(p)}
                      className="rounded-xl p-4 border-2 cursor-pointer transition-all hover:border-[hsl(213_100%_55%)] hover:shadow-lg"
                      style={{
                        background: colors.card,
                        borderColor:
                          selectedProduct === p ? colors.primary : colors.border,
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
                            handleProductClick(p);
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
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleProductClick(p);
                          }}
                          style={{
                            borderColor: colors.border,
                            color: colors.foreground,
                            fontSize: 11,
                          }}
                        >
                          View Insights
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
                {products.length === 0 && (
                  <p className="text-center py-8" style={{ color: colors.mutedForeground }}>
                    No products detected. Try a different URL or ensure the site has product pages.
                  </p>
                )}
              </section>

              {selectedProduct && (
                <section
                  className="rounded-xl p-6 border overflow-y-auto max-h-[600px]"
                  style={{
                    background: colors.card,
                    borderColor: colors.border,
                  }}
                >
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-lg font-semibold" style={{ color: colors.foreground }}>
                        Ad Angles
                      </h2>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setSelectedProduct(null)}
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
                        {adAngles.map((angle, i) => (
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
                                disabled={generatingPosters}
                                style={{
                                  background: colors.primary,
                                  color: colors.primaryForeground,
                                  fontSize: 11,
                                }}
                              >
                                {generatingPosters ? (
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
                                disabled={creatingVideoSession}
                                style={{
                                  borderColor: colors.border,
                                  color: colors.foreground,
                                  fontSize: 11,
                                }}
                              >
                                {creatingVideoSession ? (
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
              )}

              {generatedPosters.length > 0 && (
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
                    {generatedPosters.map((img, i) => (
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

              {campaign && (
                <section
                  className="rounded-xl p-6 border"
                  style={{
                    background: colors.card,
                    borderColor: colors.border,
                  }}
                >
                  <h2 className="text-lg font-semibold mb-4" style={{ color: colors.foreground }}>
                    Campaign: {campaign.name}
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {campaign.ads.map((ad, i) => (
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
    </div>
  );
}
