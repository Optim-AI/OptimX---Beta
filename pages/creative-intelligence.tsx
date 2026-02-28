// pages/creative-intelligence.tsx
// Creative Intelligence: AI-powered Creative Strategy + Competitive Intelligence + Ads Studio

import React, { useState } from "react";
import Sidebar from "@/app/web/src/components/Sidebar";
import colors from "@/lib/ui/colors";
import { authFetch } from "@/lib/utils";
import { showError, showSuccess } from "@/app/web/src/components/ui/AlertModal";
import {
  Search,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  BarChart3,
  Target,
  Lightbulb,
  Zap,
  Download,
  Send,
  Loader2,
  Megaphone,
  ImageIcon,
  Sparkles,
} from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/app/web/src/components/ui/collapsible";
import { Progress } from "@/app/web/src/components/ui/progress";
import { Slider } from "@/app/web/src/components/ui/slider";
import { Button } from "@/app/web/src/components/ui/button";
import { Input } from "@/app/web/src/components/ui/input";
import { Label } from "@/app/web/src/components/ui/label";
import { buildPosterPrompt } from "@/app/web/src/components/creative-studio";

const INDUSTRIES = [
  "SaaS",
  "E-commerce",
  "D2C",
  "Fintech",
  "Health & Wellness",
  "Education",
  "Real Estate",
  "Food & Beverage",
  "Fashion",
  "Other",
];

const CAMPAIGN_GOALS = [
  "Awareness",
  "Conversions",
  "Lead generation",
  "App installs",
  "Engagement",
];

const PLATFORMS = ["Instagram", "Meta", "TikTok", "Google", "LinkedIn"];

const ASPECT_OPTIONS = [
  { value: "1:1", label: "1:1", w: 1080, h: 1080 },
  { value: "4:5", label: "4:5", w: 1080, h: 1350 },
  { value: "9:16", label: "9:16", w: 1080, h: 1920 },
];

type RunData = {
  run: { id: string; status: string; brandUrl: string; industry: string | null; createdAt: string };
  brand: {
    productSummary: string | null;
    positioningStatement: string | null;
    targetPersonaGuess: string | null;
    emotionalTone: string | null;
    corePainsAddressed: string[] | null;
  } | null;
  competitors: Array<{
    id: string;
    name: string | null;
    domain: string | null;
    corePositioning: string | null;
    primaryHook: string | null;
    pricingTier: string | null;
    weaknessDetected: string | null;
    saturationLevel: string | null;
  }>;
  reviews: Array<{
    clusterType: string;
    clusterLabel: string | null;
    frequencyPct: number | null;
    samplePhrases: string[] | null;
  }>;
  hooks: Array<{
    id: string;
    hookStatement: string;
    hookType: string | null;
    whyItWorks: string | null;
    supportingReviewPhrase: string | null;
    competitorOverlapLevel: string | null;
    confidenceScore: number | null;
    rank: number | null;
  }>;
  strategies: {
    underserved_angles?: string[];
    white_space_opportunities?: string[];
    differentiation_map?: Record<string, string>;
  } | null;
  metaAds?: Array<{
    id: string;
    searchKeyword: string;
    pageName: string | null;
    bodyText: string | null;
    ctaText: string | null;
    displayFormat: string | null;
    platforms: string[] | null;
    imageUrl: string | null;
  }>;
};

type GeneratedPoster = {
  url: string;
  hookId: string;
  hookStatement: string;
  prompt: string;
};

export default function CreativeIntelligencePage() {
  const [brandUrl, setBrandUrl] = useState("");
  const [competitorUrls, setCompetitorUrls] = useState<string[]>([""]);
  const [industry, setIndustry] = useState("");
  const [targetAudience, setTargetAudience] = useState("");
  const [campaignGoal, setCampaignGoal] = useState("");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [theme, setTheme] = useState("");
  const [preferredFont, setPreferredFont] = useState("");
  const [brandColors, setBrandColors] = useState("");
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [toneSlider, setToneSlider] = useState([50]);
  const [generateFromScratch, setGenerateFromScratch] = useState(false);

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progressStep, setProgressStep] = useState(0);
  const [runId, setRunId] = useState<string | null>(null);
  const [runData, setRunData] = useState<RunData | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Ads Studio state
  const [adsStudioPosters, setAdsStudioPosters] = useState<GeneratedPoster[]>([]);
  const [generatingHookId, setGeneratingHookId] = useState<string | null>(null);
  const [posterAspect, setPosterAspect] = useState<"1:1" | "4:5" | "9:16">("1:1");
  const [posterTheme, setPosterTheme] = useState("commercial");

  const addCompetitorUrl = () => setCompetitorUrls((p) => [...p, ""]);
  const removeCompetitorUrl = (i: number) =>
    setCompetitorUrls((p) => p.filter((_, j) => j !== i));
  const updateCompetitorUrl = (i: number, v: string) =>
    setCompetitorUrls((p) => {
      const n = [...p];
      n[i] = v;
      return n;
    });

  const togglePlatform = (p: string) =>
    setPlatforms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    );

  async function handleAnalyze() {
    if (!brandUrl.trim()) {
      showError("Please enter a brand URL");
      return;
    }
    setIsAnalyzing(true);
    setProgressStep(0);
    setRunData(null);
    setAdsStudioPosters([]);
    try {
      const res = await authFetch("/api/creative-intelligence/analyze", {
        method: "POST",
        body: JSON.stringify({
          brandUrl: brandUrl.trim(),
          competitorUrls: competitorUrls.filter(Boolean),
          industry: industry || undefined,
          targetAudience: targetAudience || undefined,
          campaignGoal: campaignGoal || undefined,
          advancedSettings: advancedOpen
            ? {
                theme,
                preferredFont,
                brandColors: brandColors.split(",").map((c) => c.trim()).filter(Boolean),
                platforms,
                toneEmotional: toneSlider[0] / 100,
                generateFromScratch,
              }
            : {},
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        showError(data.error || "Analysis failed");
        return;
      }
      setRunId(data.runId);
      for (let i = 0; i < 60; i++) {
        await new Promise((r) => setTimeout(r, 2000));
        setProgressStep(Math.min(i + 1, 6));
        const runRes = await authFetch(`/api/creative-intelligence/run?id=${data.runId}`);
        const runJson = await runRes.json();
        if (runJson.ok && runJson.run?.status === "completed") {
          setRunData(runJson);
          break;
        }
        if (runJson.ok && runJson.run?.status === "failed") {
          showError(runJson.run?.errorMessage || "Analysis failed");
          break;
        }
      }
      const runRes = await authFetch(`/api/creative-intelligence/run?id=${data.runId}`);
      const runJson = await runRes.json();
      if (runJson.ok && runJson.run?.status === "completed") {
        setRunData(runJson);
      }
    } catch (err: any) {
      showError(err?.message || "Analysis failed");
    } finally {
      setIsAnalyzing(false);
      setProgressStep(6);
    }
  }

  async function fetchRunData(id: string) {
    const res = await authFetch(`/api/creative-intelligence/run?id=${id}`);
    const data = await res.json();
    if (data.ok) setRunData(data);
  }

  React.useEffect(() => {
    if (runId && !runData && !isAnalyzing) {
      fetchRunData(runId);
    }
  }, [runId, runData, isAnalyzing]);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  async function handleGenerateCampaign(hook: RunData["hooks"][0]) {
    if (!runData?.run?.id) return;
    setGeneratingHookId(hook.id);
    try {
      // 1. Get creatives (ad concepts, headlines, visual direction)
      const creativesRes = await authFetch("/api/creative-intelligence/generate-creatives", {
        method: "POST",
        body: JSON.stringify({
          runId: runData.run.id,
          hookId: hook.id,
        }),
      });
      const creativesData = await creativesRes.json();
      if (!creativesData.ok) throw new Error(creativesData.error || "Failed to generate creatives");

      const creatives = creativesData.creatives || {};
      const adConcepts = creatives.ad_concepts || [];
      const headlines = creatives.headlines || [];
      const visualDir = creatives.visual_direction || {};
      const vdParts = [
        visualDir.lighting && `Lighting: ${visualDir.lighting}`,
        visualDir.composition && `Composition: ${visualDir.composition}`,
        visualDir.color_dominance && `Colors: ${visualDir.color_dominance}`,
        visualDir.emotion_tone && `Mood: ${visualDir.emotion_tone}`,
      ].filter(Boolean);

      const userRequest = [
        `Hook: ${hook.hookStatement}`,
        hook.whyItWorks && `Why it works: ${hook.whyItWorks}`,
        adConcepts.length > 0 && `Ad concepts to visualize: ${adConcepts.slice(0, 2).join("; ")}`,
        headlines.length > 0 && `Headline options: ${headlines.slice(0, 2).join("; ")}`,
        vdParts.length > 0 && `Visual direction: ${vdParts.join(". ")}`,
      ].filter(Boolean).join("\n\n");

      const brandSnapshot = runData.brand ? {
        name: runData.brand.productSummary?.split(" ").slice(0, 3).join(" ") || "Brand",
        description: runData.brand.productSummary || "",
        audience: runData.brand.targetPersonaGuess || "",
        offering: runData.brand.productSummary || "",
        tone: runData.brand.emotionalTone || "Professional",
        coreValueProp: hook.hookStatement,
      } : null;

      const aspectConfig = ASPECT_OPTIONS.find((a) => a.value === posterAspect) || ASPECT_OPTIONS[0];
      const posterPrompt = buildPosterPrompt({
        userRequest,
        theme: posterTheme || "commercial",
        aspectRatio: posterAspect,
        brand: brandSnapshot as any,
        hasProductImage: false,
        variant: 1,
      });

      const res = await authFetch("/api/generate-campaign", {
        method: "POST",
        body: JSON.stringify({
          mode: "generate",
          prompt: posterPrompt,
          description: posterPrompt,
          theme: posterTheme || "commercial",
          target: { width: aspectConfig.w, height: aspectConfig.h },
          aspectLabel: posterAspect,
          brandName: brandSnapshot?.name || "",
          brandSnapshot: brandSnapshot,
          productDataUrl: undefined,
          productProvided: false,
          refDataUrls: [],
          logoDataUrl: undefined,
          logoProvided: false,
        }),
      });

      const data = await res.json();
      if (!data.ok) {
        if (data.error?.toLowerCase().includes("credit")) {
          showError("No image credits available. Please purchase more credits.");
        } else {
          throw new Error(data.error || "Poster generation failed");
        }
        return;
      }

      const imageUrl = data.image || (Array.isArray(data.images) && data.images[0]) || null;
      if (imageUrl) {
        setAdsStudioPosters((prev) => [
          ...prev,
          {
            url: imageUrl,
            hookId: hook.id,
            hookStatement: hook.hookStatement,
            prompt: posterPrompt,
          },
        ]);
        showSuccess("Poster generated! Check Ads Studio below.");
      }
    } catch (err: any) {
      showError(err?.message || "Failed to generate poster");
    } finally {
      setGeneratingHookId(null);
    }
  }

  const painPoints = runData?.reviews?.filter((r) => r.clusterType === "pain_points") || [];
  const desiredOutcomes =
    runData?.reviews?.filter((r) => r.clusterType === "desired_outcomes") || [];

  return (
    <div className="min-h-screen flex overflow-hidden app-page">
      <div className="flex-shrink-0 h-full">
        <Sidebar showChatHistory={false} />
      </div>

      <div
        className="flex-1 flex flex-col h-full overflow-hidden"
        style={{
          backgroundColor: colors.card,
          borderLeft: `1px solid ${colors.border}`,
        }}
      >
        {/* Header */}
        <div
          className="border-b flex-shrink-0"
          style={{
            borderColor: colors.border,
            background: colors.gradientMesh,
            backgroundColor: colors.card,
          }}
        >
          <div className="max-w-6xl mx-auto px-6 py-6">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: colors.primary + "20" }}
              >
                <Sparkles size={22} style={{ color: colors.primary }} />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight" style={{ color: colors.foreground }}>
                  Creative Intelligence
                </h1>
                <p className="text-sm mt-0.5" style={{ color: colors.mutedForeground }}>
                  Research → Strategize → Create. AI-powered competitive intelligence & ad generation.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="max-w-6xl mx-auto px-6 py-8">
            {/* Hero Input Card */}
            <div
              className="rounded-2xl p-6 mb-8 shadow-lg"
              style={{
                background: colors.gradientCard,
                border: `1px solid ${colors.border}`,
                boxShadow: colors.shadowMedium,
              }}
            >
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2" style={{ color: colors.foreground }}>
                <Search size={20} style={{ color: colors.primary }} />
                Analyze a Brand
              </h2>

              <div className="space-y-4">
                <div>
                  <Label style={{ color: colors.foreground }}>Brand/Product URL *</Label>
                  <Input
                    value={brandUrl}
                    onChange={(e) => setBrandUrl(e.target.value)}
                    placeholder="https://example.com"
                    className="mt-1"
                    style={{
                      backgroundColor: colors.muted,
                      borderColor: colors.border,
                      color: colors.foreground,
                    }}
                  />
                </div>

                <div>
                  <Label style={{ color: colors.foreground }}>Competitor URLs (optional)</Label>
                  {competitorUrls.map((url, i) => (
                    <div key={i} className="flex gap-2 mt-1 mb-2">
                      <Input
                        value={url}
                        onChange={(e) => updateCompetitorUrl(i, e.target.value)}
                        placeholder="https://competitor.com"
                        style={{
                          backgroundColor: colors.muted,
                          borderColor: colors.border,
                          color: colors.foreground,
                        }}
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => removeCompetitorUrl(i)}
                        disabled={competitorUrls.length <= 1}
                      >
                        −
                      </Button>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={addCompetitorUrl}>
                    + Add competitor
                  </Button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label style={{ color: colors.foreground }}>Industry</Label>
                    <select
                      value={industry}
                      onChange={(e) => setIndustry(e.target.value)}
                      className="w-full mt-1 px-3 py-2 rounded-lg border"
                      style={{
                        backgroundColor: colors.muted,
                        borderColor: colors.border,
                        color: colors.foreground,
                      }}
                    >
                      <option value="">Select industry</option>
                      {INDUSTRIES.map((ind) => (
                        <option key={ind} value={ind}>{ind}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label style={{ color: colors.foreground }}>Campaign goal</Label>
                    <select
                      value={campaignGoal}
                      onChange={(e) => setCampaignGoal(e.target.value)}
                      className="w-full mt-1 px-3 py-2 rounded-lg border"
                      style={{
                        backgroundColor: colors.muted,
                        borderColor: colors.border,
                        color: colors.foreground,
                      }}
                    >
                      <option value="">Select goal</option>
                      {CAMPAIGN_GOALS.map((g) => (
                        <option key={g} value={g}>{g}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <Label style={{ color: colors.foreground }}>Target audience</Label>
                  <Input
                    value={targetAudience}
                    onChange={(e) => setTargetAudience(e.target.value)}
                    placeholder="e.g. Young professionals, 25-34"
                    className="mt-1"
                    style={{
                      backgroundColor: colors.muted,
                      borderColor: colors.border,
                      color: colors.foreground,
                    }}
                  />
                </div>

                <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
                  <CollapsibleTrigger className="flex items-center gap-2 py-2">
                    {advancedOpen ? (
                      <ChevronUp size={18} style={{ color: colors.primary }} />
                    ) : (
                      <ChevronDown size={18} style={{ color: colors.primary }} />
                    )}
                    <span style={{ color: colors.primary }}>Advanced Settings</span>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-4 pt-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <Label>Theme</Label>
                        <Input
                          value={theme}
                          onChange={(e) => setTheme(e.target.value)}
                          placeholder="e.g. Minimal, Bold"
                          style={{
                            backgroundColor: colors.muted,
                            borderColor: colors.border,
                            color: colors.foreground,
                          }}
                        />
                      </div>
                      <div>
                        <Label>Preferred font</Label>
                        <Input
                          value={preferredFont}
                          onChange={(e) => setPreferredFont(e.target.value)}
                          placeholder="e.g. Inter, Georgia"
                          style={{
                            backgroundColor: colors.muted,
                            borderColor: colors.border,
                            color: colors.foreground,
                          }}
                        />
                      </div>
                    </div>
                    <div>
                      <Label>Brand colors (hex, comma-separated)</Label>
                      <Input
                        value={brandColors}
                        onChange={(e) => setBrandColors(e.target.value)}
                        placeholder="#FF0000, #00FF00"
                        style={{
                          backgroundColor: colors.muted,
                          borderColor: colors.border,
                          color: colors.foreground,
                        }}
                      />
                    </div>
                    <div>
                      <Label>Platforms</Label>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {PLATFORMS.map((p) => (
                          <button
                            key={p}
                            onClick={() => togglePlatform(p)}
                            className="px-3 py-1 rounded-lg text-sm transition-colors"
                            style={{
                              backgroundColor: platforms.includes(p) ? colors.primary : colors.muted,
                              color: platforms.includes(p) ? colors.primaryForeground : colors.foreground,
                              border: `1px solid ${colors.border}`,
                            }}
                          >
                            {p}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <Label>Tone: Emotional ↔ Performance</Label>
                      <Slider
                        value={toneSlider}
                        onValueChange={setToneSlider}
                        max={100}
                        step={1}
                        className="mt-2"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="scratch"
                        checked={generateFromScratch}
                        onChange={(e) => setGenerateFromScratch(e.target.checked)}
                      />
                      <Label htmlFor="scratch">Generate from scratch</Label>
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                <Button
                  onClick={handleAnalyze}
                  disabled={isAnalyzing}
                  className="w-full py-6 text-base font-semibold rounded-xl"
                  style={{
                    background: colors.gradientPrimary,
                    color: colors.primaryForeground,
                    border: "none",
                    boxShadow: colors.shadowGlow,
                  }}
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      {progressStep > 0 && progressStep <= 6
                        ? ["Analyzing website…", "Discovering competitors…", "Fetching Meta & Google ad intelligence…", "Mining reviews…", "Identifying hooks…", "Building strategy…"][progressStep - 1]
                        : "Analyze & Generate Strategy"}
                    </>
                  ) : (
                    <>
                      <Search className="mr-2 h-5 w-5" />
                      Analyze & Generate Strategy
                    </>
                  )}
                </Button>

                {isAnalyzing && (
                  <div className="pt-2">
                    <Progress value={(progressStep / 6) * 100} className="h-2 rounded-full" />
                  </div>
                )}
              </div>
            </div>

            {/* Output Sections */}
            {runData && (
              <>
                {/* Brand Summary */}
                {runData.brand && (
                  <SectionCard title="Brand Summary" icon={<Target size={20} />}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <InsightBlock label="Product summary" value={runData.brand.productSummary} />
                      <InsightBlock label="Target persona" value={runData.brand.targetPersonaGuess} />
                      <InsightBlock label="Current positioning" value={runData.brand.positioningStatement} />
                      <InsightBlock label="Brand tone" value={runData.brand.emotionalTone} />
                    </div>
                  </SectionCard>
                )}

                {/* Competitive Landscape */}
                {runData.competitors?.length > 0 && (
                  <SectionCard title="Competitive Landscape" icon={<BarChart3 size={20} />}>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {runData.competitors.map((c) => (
                        <div
                          key={c.id}
                          className="p-4 rounded-xl transition-colors hover:border-opacity-80"
                          style={{
                            backgroundColor: colors.background,
                            border: `1px solid ${colors.border}`,
                          }}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-semibold" style={{ color: colors.foreground }}>
                              {c.name || c.domain}
                            </span>
                            <SaturationBadge level={c.saturationLevel} />
                          </div>
                          <p className="text-sm mb-2 line-clamp-2" style={{ color: colors.mutedForeground }}>
                            {c.corePositioning?.slice(0, 120)}…
                          </p>
                          {c.primaryHook && (
                            <p className="text-xs italic" style={{ color: colors.mutedForeground }}>
                              Hook: {c.primaryHook}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </SectionCard>
                )}

                {/* Meta & Google Ad Intelligence */}
                {runData.metaAds && runData.metaAds.length > 0 && (
                  <SectionCard title="Meta & Google Ad Intelligence" icon={<Megaphone size={20} />}>
                    <p className="text-sm mb-4" style={{ color: colors.mutedForeground }}>
                      Competitor ads from Meta Ad Library to inform your creative strategy.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {runData.metaAds.slice(0, 12).map((ad) => (
                        <div
                          key={ad.id}
                          className="rounded-xl overflow-hidden group"
                          style={{
                            backgroundColor: colors.background,
                            border: `1px solid ${colors.border}`,
                          }}
                        >
                          {ad.imageUrl && (
                            <div className="aspect-square bg-muted overflow-hidden">
                              <img
                                src={ad.imageUrl}
                                alt={ad.pageName || "Ad"}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              />
                            </div>
                          )}
                          <div className="p-4">
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-semibold text-sm" style={{ color: colors.foreground }}>
                                {ad.pageName || "Unknown"}
                              </span>
                              {ad.platforms && ad.platforms.length > 0 && (
                                <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: colors.muted, color: colors.mutedForeground }}>
                                  {ad.platforms.slice(0, 2).join(", ")}
                                </span>
                              )}
                            </div>
                            {ad.bodyText && (
                              <p className="text-xs line-clamp-3 mb-2" style={{ color: colors.mutedForeground }}>
                                {ad.bodyText}
                              </p>
                            )}
                            {ad.ctaText && (
                              <span className="text-xs font-medium" style={{ color: colors.primary }}>
                                CTA: {ad.ctaText}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </SectionCard>
                )}

                {/* Customer Psychology */}
                {(painPoints.length > 0 || desiredOutcomes.length > 0) && (
                  <SectionCard title="Customer Psychology" icon={<BarChart3 size={20} />}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <h4 className="font-medium mb-3" style={{ color: colors.foreground }}>Top Pain Points</h4>
                        <ul className="space-y-2">
                          {painPoints.slice(0, 5).map((r, i) => (
                            <li key={i} className="flex items-start gap-2">
                              <span className="text-xs px-2 py-0.5 rounded shrink-0" style={{ backgroundColor: "hsl(0 84% 55% / 0.2)", color: colors.destructive }}>
                                {r.frequencyPct ?? "—"}%
                              </span>
                              <span style={{ color: colors.foreground }}>{r.clusterLabel}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <h4 className="font-medium mb-3" style={{ color: colors.foreground }}>Top Desired Outcomes</h4>
                        <ul className="space-y-2">
                          {desiredOutcomes.slice(0, 5).map((r, i) => (
                            <li key={i} className="flex items-start gap-2">
                              <span className="text-xs px-2 py-0.5 rounded shrink-0" style={{ backgroundColor: "hsl(142 76% 36% / 0.2)", color: colors.green600 }}>
                                {r.frequencyPct ?? "—"}%
                              </span>
                              <span style={{ color: colors.foreground }}>{r.clusterLabel}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                    <div className="mt-4">
                      <h4 className="font-medium mb-2" style={{ color: colors.foreground }}>Common Phrases (click to copy)</h4>
                      <div className="flex flex-wrap gap-2">
                        {runData.reviews
                          .flatMap((r) => r.samplePhrases || [])
                          .slice(0, 8)
                          .map((phrase, i) => (
                            <button
                              key={i}
                              onClick={() => copyToClipboard(phrase, `phrase-${i}`)}
                              className="text-sm px-3 py-1.5 rounded-lg transition-colors hover:opacity-90"
                              style={{
                                backgroundColor: colors.muted,
                                border: `1px solid ${colors.border}`,
                                color: colors.foreground,
                              }}
                            >
                              {phrase}
                              {copiedId === `phrase-${i}` ? <Check size={14} className="inline ml-1" /> : <Copy size={14} className="inline ml-1 opacity-60" />}
                            </button>
                          ))}
                      </div>
                    </div>
                  </SectionCard>
                )}

                {/* Market Opportunities */}
                {runData.strategies && (
                  <SectionCard title="Market Opportunities" icon={<Lightbulb size={20} />}>
                    <div className="space-y-4">
                      {(runData.strategies.underserved_angles?.length ?? 0) > 0 && (
                        <div>
                          <h4 className="font-medium mb-2" style={{ color: colors.foreground }}>Underserved Angles</h4>
                          <ul className="list-disc list-inside space-y-1" style={{ color: colors.mutedForeground }}>
                            {(runData.strategies.underserved_angles ?? []).map((a, i) => (
                              <li key={i}>{a}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {(runData.strategies.white_space_opportunities?.length ?? 0) > 0 && (
                        <div>
                          <h4 className="font-medium mb-2" style={{ color: colors.foreground }}>White Space Opportunities</h4>
                          <ul className="list-disc list-inside space-y-1" style={{ color: colors.mutedForeground }}>
                            {(runData.strategies.white_space_opportunities ?? []).map((w, i) => (
                              <li key={i}>{w}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </SectionCard>
                )}

                {/* Ranked Hooks */}
                {runData.hooks?.length > 0 && (
                  <SectionCard title="Ranked Hooks" icon={<Zap size={20} />}>
                    <div className="space-y-4">
                      {runData.hooks.map((hook) => (
                        <div
                          key={hook.id}
                          className="p-5 rounded-xl transition-colors"
                          style={{
                            backgroundColor: colors.background,
                            border: `1px solid ${colors.border}`,
                          }}
                        >
                          <p className="text-lg font-bold mb-2" style={{ color: colors.foreground }}>
                            {hook.hookStatement}
                          </p>
                          <div className="flex flex-wrap gap-2 mb-2">
                            <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: colors.muted, color: colors.mutedForeground }}>
                              {hook.hookType || "—"}
                            </span>
                            <SaturationBadge level={hook.competitorOverlapLevel} />
                          </div>
                          {hook.whyItWorks && (
                            <p className="text-sm mb-2" style={{ color: colors.mutedForeground }}>{hook.whyItWorks}</p>
                          )}
                          {hook.confidenceScore != null && (
                            <div className="mb-3">
                              <div className="flex justify-between text-xs mb-1">
                                <span style={{ color: colors.mutedForeground }}>Confidence</span>
                                <span style={{ color: colors.foreground }}>{hook.confidenceScore}%</span>
                              </div>
                              <Progress value={hook.confidenceScore} className="h-1.5 rounded-full" />
                            </div>
                          )}
                          <Button
                            size="sm"
                            onClick={() => handleGenerateCampaign(hook)}
                            disabled={generatingHookId !== null}
                            style={{
                              backgroundColor: colors.primary,
                              color: colors.primaryForeground,
                            }}
                          >
                            {generatingHookId === hook.id ? (
                              <>
                                <Loader2 size={14} className="mr-2 animate-spin" />
                                Generating poster…
                              </>
                            ) : (
                              <>
                                <ImageIcon size={14} className="mr-2" />
                                Generate Poster for This Hook
                              </>
                            )}
                          </Button>
                        </div>
                      ))}
                    </div>
                  </SectionCard>
                )}

                {/* Ads Studio - Poster Generation */}
                <div
                  className="rounded-2xl p-6 mt-8"
                  style={{
                    background: colors.gradientCard,
                    border: `2px solid ${colors.primary + "40"}`,
                    boxShadow: colors.shadowMedium,
                  }}
                >
                  <div className="flex items-center gap-3 mb-6">
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center"
                      style={{ backgroundColor: colors.primary + "25" }}
                    >
                      <ImageIcon size={24} style={{ color: colors.primary }} />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold" style={{ color: colors.foreground }}>
                        Ads Studio
                      </h3>
                      <p className="text-sm mt-0.5" style={{ color: colors.mutedForeground }}>
                        Generated posters from your hooks. Uses the same AI as Creative Studio.
                      </p>
                    </div>
                  </div>

                  {/* Poster settings (when runData exists) */}
                  {runData && runData.hooks?.length > 0 && (
                    <div className="flex flex-wrap gap-4 mb-6 p-4 rounded-xl" style={{ backgroundColor: colors.background, border: `1px solid ${colors.border}` }}>
                      <div>
                        <Label className="text-xs" style={{ color: colors.mutedForeground }}>Aspect ratio</Label>
                        <div className="flex gap-2 mt-1">
                          {ASPECT_OPTIONS.map((a) => (
                            <button
                              key={a.value}
                              onClick={() => setPosterAspect(a.value as any)}
                              className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                              style={{
                                backgroundColor: posterAspect === a.value ? colors.primary : colors.muted,
                                color: posterAspect === a.value ? colors.primaryForeground : colors.foreground,
                                border: `1px solid ${colors.border}`,
                              }}
                            >
                              {a.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs" style={{ color: colors.mutedForeground }}>Theme</Label>
                        <select
                          value={posterTheme}
                          onChange={(e) => setPosterTheme(e.target.value)}
                          className="mt-1 px-3 py-2 rounded-lg border text-sm"
                          style={{
                            backgroundColor: colors.muted,
                            borderColor: colors.border,
                            color: colors.foreground,
                          }}
                        >
                          <option value="commercial">Commercial</option>
                          <option value="professional">Professional</option>
                          <option value="minimal">Minimal</option>
                          <option value="premium">Premium</option>
                          <option value="bold">Bold</option>
                          <option value="playful">Playful</option>
                        </select>
                      </div>
                    </div>
                  )}

                  {adsStudioPosters.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                      {adsStudioPosters.map((p, i) => (
                        <div
                          key={`${p.hookId}-${i}`}
                          className="rounded-xl overflow-hidden group"
                          style={{
                            backgroundColor: colors.background,
                            border: `1px solid ${colors.border}`,
                            boxShadow: colors.shadowSoft,
                          }}
                        >
                          <div className="aspect-square bg-muted overflow-hidden">
                            <img
                              src={p.url}
                              alt={`Poster ${i + 1}`}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                          </div>
                          <div className="p-4">
                            <p className="text-sm font-medium mb-2 line-clamp-2" style={{ color: colors.foreground }}>
                              {p.hookStatement}
                            </p>
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => window.open(p.url, "_blank")}
                                style={{ borderColor: colors.border, color: colors.foreground }}
                              >
                                Open
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  const a = document.createElement("a");
                                  a.href = p.url;
                                  a.download = `poster-${i + 1}.png`;
                                  a.click();
                                }}
                                style={{ borderColor: colors.border, color: colors.foreground }}
                              >
                                <Download size={14} className="mr-1" />
                                Download
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div
                      className="rounded-xl p-12 text-center"
                      style={{
                        backgroundColor: colors.background,
                        border: `2px dashed ${colors.border}`,
                      }}
                    >
                      <ImageIcon size={48} className="mx-auto mb-4 opacity-40" style={{ color: colors.mutedForeground }} />
                      <p className="text-base font-medium mb-2" style={{ color: colors.foreground }}>
                        No posters yet
                      </p>
                      <p className="text-sm max-w-md mx-auto" style={{ color: colors.mutedForeground }}>
                        Click &quot;Generate Poster for This Hook&quot; on any hook above. Posters will appear here. Uses the same /api/generate-campaign logic as Creative Studio.
                      </p>
                    </div>
                  )}
                </div>

                {/* Export */}
                <div
                  className="rounded-2xl p-6 mt-8"
                  style={{
                    backgroundColor: colors.background,
                    border: `1px solid ${colors.border}`,
                  }}
                >
                  <h3 className="font-semibold mb-4" style={{ color: colors.foreground }}>Export</h3>
                  <div className="flex flex-wrap gap-3">
                    <Button variant="outline" size="sm">
                      <Download size={16} className="mr-2" />
                      Export Creative Pack
                    </Button>
                    <Button variant="outline" size="sm">
                      <Download size={16} className="mr-2" />
                      Export Strategy PDF
                    </Button>
                    <Button variant="outline" size="sm">
                      <Download size={16} className="mr-2" />
                      Export Copy CSV
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      className="rounded-2xl p-6 mb-8"
      style={{
        backgroundColor: colors.background,
        border: `1px solid ${colors.border}`,
        boxShadow: colors.shadowSoft,
      }}
    >
      <div className="flex items-center gap-2 mb-4" style={{ color: colors.primary }}>
        {icon}
        <h3 className="text-lg font-semibold" style={{ color: colors.foreground }}>
          {title}
        </h3>
      </div>
      {children}
    </div>
  );
}

function InsightBlock({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-xs font-medium mb-1" style={{ color: colors.mutedForeground }}>{label}</p>
      <p className="text-sm" style={{ color: colors.foreground }}>{value}</p>
    </div>
  );
}

function SaturationBadge({ level }: { level: string | null }) {
  if (!level) return null;
  const styles: Record<string, { bg: string; color: string }> = {
    high: { bg: "hsl(0 84% 55% / 0.2)", color: colors.destructive },
    moderate: { bg: "hsl(45 93% 47% / 0.2)", color: "#f59e0b" },
    low: { bg: "hsl(142 76% 36% / 0.2)", color: colors.green600 },
  };
  const s = styles[level.toLowerCase()] || styles.moderate;
  return (
    <span className="text-xs px-2 py-0.5 rounded font-medium" style={{ backgroundColor: s.bg, color: s.color }}>
      {level}
    </span>
  );
}
