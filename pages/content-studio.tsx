// pages/content-studio.tsx
// Content Studio: Turn your website into high-converting ads

import React, { useState } from "react";
import { useRouter } from "next/router";
import Sidebar from "@/app/web/src/components/Sidebar";
import colors from "@/lib/ui/colors";
import { authFetch } from "@/lib/utils";
import { showError } from "@/app/web/src/components/ui/AlertModal";
import {
  buildPosterPrompt,
  type BrandSnapshot,
} from "@/app/web/src/components/creative-studio";
import {
  Loader2,
  Search,
  ImageIcon,
  Video,
  FileText,
  Download,
  Sparkles,
  ChevronRight,
  X,
  Megaphone,
  Target,
  Zap,
  ExternalLink,
} from "lucide-react";
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
        body: JSON.stringify({ product }),
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

      const brandSnapshot: BrandSnapshot | null = brand
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
        : null;

      const angleText = angle
        ? `${angle.title}. ${angle.explanation}`
        : selectedProduct.short_benefit || selectedProduct.description;
      const benefitsText =
        selectedProduct.key_benefits?.length > 0
          ? `\nKey benefits:\n${selectedProduct.key_benefits.map((b) => `- ${b}`).join("\n")}`
          : "";
      const userRequest = `${selectedProduct.product_name}. Ad angle: ${angleText}.${benefitsText}\n\nCreate a high-converting, scroll-stopping ad poster. Bold headline, clear product focus, strong CTA space.`;

      const theme =
        angle && /clinical|proven|science|lab|performance/i.test(angle.title)
          ? "professional"
          : "commercial";
      const aspectRatio: "1:1" | "4:5" | "9:16" | "1.91:1" = "4:5";
      const target = { width: 1080, height: 1350 };

      const variantPrompts = [1, 2, 3].map((variantNum) =>
        buildPosterPrompt({
          userRequest,
          theme,
          aspectRatio,
          brand: brandSnapshot,
          hasProductImage: !!productDataUrl,
          variant: variantNum,
        })
      );

      const basePayload = {
        mode: "generate" as const,
        theme,
        target,
        aspectLabel: aspectRatio,
        brandName: brand?.name || "",
        brandSnapshot,
        tone: brand?.tone || theme,
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

  return (
    <div className="flex min-h-screen" style={{ background: colors.background }}>
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="max-w-5xl mx-auto px-6 py-10">
          {step === "entry" && (
            <div className="text-center space-y-8">
              <h1 className="text-3xl font-bold" style={{ color: colors.foreground }}>
                Turn your website into high-converting ads
              </h1>
              <p className="text-lg" style={{ color: colors.mutedForeground }}>
                Paste your website and we&apos;ll generate ad creatives, campaigns, and videos for your products.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 max-w-xl mx-auto">
                <Input
                  placeholder="Paste Website URL"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAnalyze()}
                  className="flex-1 bg-[hsl(0_0%_15%)] border-[hsl(0_0%_22%)] text-[hsl(0_0%_95%)] placeholder:text-[hsl(0_0%_50%)]"
                  style={{ minHeight: 48 }}
                />
                <Button
                  onClick={handleAnalyze}
                  disabled={!url.trim()}
                  className="px-8"
                  style={{
                    background: colors.primary,
                    color: colors.primaryForeground,
                    minHeight: 48,
                  }}
                >
                  <Search className="w-4 h-4 mr-2" />
                  Analyze Website
                </Button>
              </div>
              <p className="text-sm" style={{ color: colors.mutedForeground }}>
                example: true-elements.com
              </p>
            </div>
          )}

          {step === "scanning" && (
            <div className="text-center py-20 space-y-8">
              <Loader2 className="w-16 h-16 mx-auto animate-spin" style={{ color: colors.primary }} />
              <h2 className="text-xl font-semibold" style={{ color: colors.foreground }}>
                {SCAN_MESSAGES[scanMessageIndex]}
              </h2>
              <Progress value={33} className="max-w-md mx-auto h-2" />
            </div>
          )}

          {step === "results" && (
            <div className="space-y-10">
              <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold" style={{ color: colors.foreground }}>
                  Content Studio
                </h1>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleStartOver}
                  style={{ color: colors.mutedForeground }}
                >
                  Start over
                </Button>
              </div>

              {brand && (
                <section
                  className="rounded-xl p-6 border"
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

              <section>
                <h2 className="text-lg font-semibold mb-4" style={{ color: colors.foreground }}>
                  Product Library
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {products.map((p, i) => (
                    <div
                      key={i}
                      onClick={() => handleProductClick(p)}
                      className="rounded-xl p-4 border cursor-pointer transition-all hover:border-[hsl(213_100%_55%)]"
                      style={{
                        background: colors.card,
                        borderColor:
                          selectedProduct === p ? colors.primary : colors.border,
                      }}
                    >
                      <div
                        className="aspect-square rounded-lg mb-3 overflow-hidden bg-[hsl(0_0%_18%)]"
                        style={{ minHeight: 120 }}
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
                <div className="flex gap-6 flex-col lg:flex-row">
                  <section
                    className="flex-1 rounded-xl p-6 border"
                    style={{
                      background: colors.card,
                      borderColor: colors.border,
                    }}
                  >
                    <h2 className="text-lg font-semibold mb-4" style={{ color: colors.foreground }}>
                      Product Intelligence
                    </h2>
                    <div className="space-y-4">
                      <div>
                        <span className="text-sm" style={{ color: colors.mutedForeground }}>
                          Key Benefits
                        </span>
                        <ul className="list-disc list-inside mt-1" style={{ color: colors.foreground }}>
                          {(selectedProduct.key_benefits || []).map((b, i) => (
                            <li key={i}>{b}</li>
                          ))}
                          {(!selectedProduct.key_benefits || selectedProduct.key_benefits.length === 0) && (
                            <li>—</li>
                          )}
                        </ul>
                      </div>
                      <div>
                        <span className="text-sm" style={{ color: colors.mutedForeground }}>
                          Target Audience
                        </span>
                        <p style={{ color: colors.foreground }}>
                          {selectedProduct.target_audience || "—"}
                        </p>
                      </div>
                      <div>
                        <span className="text-sm" style={{ color: colors.mutedForeground }}>
                          Emotional Angles
                        </span>
                        <ul className="list-disc list-inside mt-1" style={{ color: colors.foreground }}>
                          {(selectedProduct.emotional_angles || []).map((a, i) => (
                            <li key={i}>{a}</li>
                          ))}
                          {(!selectedProduct.emotional_angles || selectedProduct.emotional_angles.length === 0) && (
                            <li>—</li>
                          )}
                        </ul>
                      </div>
                      <div>
                        <span className="text-sm" style={{ color: colors.mutedForeground }}>
                          Use Cases
                        </span>
                        <ul className="list-disc list-inside mt-1" style={{ color: colors.foreground }}>
                          {(selectedProduct.use_cases || []).map((u, i) => (
                            <li key={i}>{u}</li>
                          ))}
                          {(!selectedProduct.use_cases || selectedProduct.use_cases.length === 0) && (
                            <li>—</li>
                          )}
                        </ul>
                      </div>
                    </div>
                  </section>

                  <section
                    className="lg:w-[400px] rounded-xl p-6 border overflow-y-auto max-h-[600px]"
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
                                style={{
                                  borderColor: colors.border,
                                  color: colors.foreground,
                                  fontSize: 11,
                                }}
                              >
                                <Video className="w-3 h-3 mr-1" />
                                Video Ad
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                style={{
                                  borderColor: colors.border,
                                  color: colors.foreground,
                                  fontSize: 11,
                                }}
                              >
                                <FileText className="w-3 h-3 mr-1" />
                                UGC Script
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                </div>
              )}

              {generatedPosters.length > 0 && (
                <section
                  className="rounded-xl p-6 border"
                  style={{
                    background: colors.card,
                    borderColor: colors.border,
                  }}
                >
                  <h2 className="text-lg font-semibold mb-4" style={{ color: colors.foreground }}>
                    Generated Creatives
                  </h2>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {generatedPosters.map((img, i) => (
                      <div
                        key={i}
                        className="rounded-lg overflow-hidden border"
                        style={{ borderColor: colors.border }}
                      >
                        <img
                          src={img}
                          alt={`Creative ${i + 1}`}
                          className="w-full aspect-square object-cover"
                        />
                        <div className="flex gap-1 p-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="flex-1"
                            onClick={() => handleDownload(img, `creative-${i + 1}.png`)}
                          >
                            <Download className="w-3 h-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="flex-1"
                            onClick={() => window.open(img, "_blank")}
                          >
                            <ExternalLink className="w-3 h-3" />
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
    </div>
  );
}
