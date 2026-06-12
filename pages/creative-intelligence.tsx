// pages/creative-intelligence.tsx
// Creative Intelligence: AI-powered Creative Strategy + Competitive Intelligence

import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import Sidebar from "@/app/web/src/components/Sidebar";
import colors from "@/lib/ui/colors";
import { authFetch } from "@/lib/utils";
import { showError, showSuccess } from "@/app/web/src/components/ui/AlertModal";
import {
  Search,
  Copy,
  Check,
  BarChart3,
  Target,
  Zap,
  Download,
  Loader2,
  Megaphone,
  Sparkles,
  Facebook,
  TrendingUp,
  Users,
  Clock,
  GitCompare,
  Video,
  Image,
  LayoutGrid,
  MessageSquare,
  MapPin,
  Grid3X3,
  RefreshCw,
  History,
  ChevronDown,
} from "lucide-react";
import {
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import type { BrandSnapshot } from "@/app/web/src/components/creative-studio";
import { DEFAULT_AD_BUILDER_DATA } from "@/app/web/src/components/creative-studio/utils";
import type { Product } from "@/app/web/src/components/creative-studio/types";
import {
  fetchCreativeStudioContext,
  mergeBrandSnapshots,
  buildPosterPromptFromHook,
  buildVideoDescriptionFromHook,
  productToProductData,
  productToPosterProductData,
  mapHookTypeToVideoStyle,
  resolvePrimaryProductImageDataUrl,
} from "@/lib/creative-studio/hook-creative-context";
import { Progress } from "@/app/web/src/components/ui/progress";
import { Button } from "@/app/web/src/components/ui/button";
import { Input } from "@/app/web/src/components/ui/input";
import { Label } from "@/app/web/src/components/ui/label";

type InsightCard = {
  title: string;
  description: string;
  opportunity: string;
  ad_angle: string;
};

type CompareInsights = {
  tldr?: {
    biggest_opportunity: string;
    biggest_strength: string;
    biggest_weakness: string;
    recommended_ad_strategy: string;
  };
  comparison?: {
    brand_strengths: string[];
    competitor_strengths: string[];
    key_market_gap: string;
    strategic_opportunity: string;
  };
  working_well?: InsightCard[];
  gaps?: InsightCard[];
  recommended_strategy?: Array<{ title: string; description: string }>;
};

type RunData = {
  run: { id: string; status: string; brandUrl: string; industry: string | null; createdAt: string; comparisonInsights?: CompareInsights | null; competitorRunIds?: string[] | null };
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
    strategy_snapshot?: {
      market_gap?: string;
      winning_angle?: string;
      best_creative_direction?: string;
      recommended_ad_format?: string;
    } | null;
    ad_format_recommendations?: Array<{ format: string; score: number; reasoning?: string }>;
    underserved_angles?: string[];
    white_space_opportunities?: string[];
    differentiation_map?: Record<string, string>;
    market_gap_analysis?: Array<{
      opportunity_statement?: string;
      why_it_exists?: string;
      supporting_review_signal?: string;
      competitor_overlap_level?: string;
      confidence_score?: number;
    }>;
    campaign_blueprints?: Array<{
      hook_rank?: number;
      recommended_platform?: string;
      target_audience_segment?: string;
      ad_format?: string;
      emotional_tone_direction?: string;
      messaging_focus?: string;
      cta_strategy?: string;
      test_variations?: string[];
    }>;
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
  facebookPages?: Array<{
    id: string;
    source: string;
    entityName: string | null;
    pageName: string | null;
    pageLink: string | null;
    followersCount: number | null;
    category: string | null;
    ratings: string | null;
    reviewsCount: number | null;
    profilePhotoUrl: string | null;
  }>;
  googleRanks?: Array<{
    id: string;
    searchQuery: string;
    brandDomain: string | null;
    brandPosition: number | null;
    competitorRanks: Array<{ domain: string; position: number; title?: string }> | null;
  }>;
  creatives?: Array<{
    id: string;
    hookId: string | null;
    creativeType: string;
    content: any;
  }>;
};

type AnalysisMode = "brand" | "competitors";

function mapCreativeIntelligenceBrandToSnapshot(
  brand: RunData["brand"],
  brandUrl: string
): BrandSnapshot {
  const raw = (brand as any)?.rawAnalysis || {};
  let domain = "Brand";
  try {
    domain = new URL(brandUrl).hostname.replace("www.", "").split(".")[0];
    domain = domain.charAt(0).toUpperCase() + domain.slice(1);
  } catch {
    // ignore
  }
  const name = raw.product_name || domain;
  return {
    name,
    description: brand?.productSummary || raw.current_positioning_statement || "",
    audience: raw.primary_target_audience || brand?.targetPersonaGuess || "",
    offering: brand?.productSummary || raw.product_category || "",
    tone: raw.brand_tone || brand?.emotionalTone || "professional",
    logo: raw.logo,
    logoUrl: raw.logoUrl,
    primaryColors: raw.primaryColors || [],
    fontStyles: raw.fontStyles,
    coreValueProp: raw.core_value_prop,
    productCategory: raw.product_category,
    pricePositioning: raw.price_positioning,
  };
}

export default function CreativeIntelligencePage() {
  const router = useRouter();
  const [mode, setMode] = useState<AnalysisMode>("brand");
  const [brandUrl, setBrandUrl] = useState("");

  // Competitor Analysis mode: user pastes competitor URLs only
  const [competitorAnalysisUrls, setCompetitorAnalysisUrls] = useState<string[]>([""]);
  const [competitorAnalysisResults, setCompetitorAnalysisResults] = useState<RunData[]>([]);
  const [isAnalyzingCompetitors, setIsAnalyzingCompetitors] = useState(false);
  const [expandedCompetitorId, setExpandedCompetitorId] = useState<string | null>(null);
  const [comparisonInsights, setComparisonInsights] = useState<CompareInsights | null>(null);
  const [isLoadingComparisonSummary, setIsLoadingComparisonSummary] = useState(false);
  const [comparisonError, setComparisonError] = useState<string | null>(null);

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [historyRuns, setHistoryRuns] = useState<Array<{ id: string; brandUrl: string; createdAt: string }>>([]);
  const historyRef = React.useRef<HTMLDivElement>(null);
  const comparisonRef = React.useRef<HTMLDivElement>(null);
  const [progressStep, setProgressStep] = useState(0);
  const [runId, setRunId] = useState<string | null>(null);
  const [runData, setRunData] = useState<RunData | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [generatingCreativeHookId, setGeneratingCreativeHookId] = useState<string | null>(null);
  const [generatingFromHook, setGeneratingFromHook] = useState<{ hookId: string; type: "poster" | "video" } | null>(null);
  const [generatedCreatives, setGeneratedCreatives] = useState<Record<string, any>>({});

  const [imageCredits, setImageCredits] = useState<number | null>(null);
  const [videoCredits, setVideoCredits] = useState<number | null>(null);
  const [brandUrlVersions, setBrandUrlVersions] = useState<Array<{ id: string; brandUrl: string; createdAt: string }>>([]);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [showVersionDropdown, setShowVersionDropdown] = useState(false);

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

  const addCompetitorAnalysisUrl = () => setCompetitorAnalysisUrls((p) => [...p, ""]);
  const removeCompetitorAnalysisUrl = (i: number) =>
    setCompetitorAnalysisUrls((p) => p.filter((_, j) => j !== i));
  const updateCompetitorAnalysisUrl = (i: number, v: string) =>
    setCompetitorAnalysisUrls((p) => {
      const n = [...p];
      n[i] = v;
      return n;
    });

  useEffect(() => {
    const url = router.query.brandUrl;
    if (typeof url === "string" && url.trim()) {
      setBrandUrl(url.trim());
      setMode("brand");
    }
  }, [router.query.brandUrl]);

  async function handlePasteCompetitors() {
    try {
      const text = await navigator.clipboard.readText();
      const urls = text
        .split(/[\n,\s]+/)
        .map((u) => u.trim())
        .filter((u) => u.startsWith("http://") || u.startsWith("https://"));
      if (urls.length > 0) {
        setCompetitorAnalysisUrls(urls.length === 1 ? urls : [...urls, ""]);
        setMode("competitors");
        showSuccess(`Pasted ${urls.length} competitor URL(s)`);
      } else {
        showError("Clipboard does not contain valid URLs. Paste one URL per line.");
      }
    } catch {
      showError("Could not read clipboard. Please paste URLs manually.");
    }
  }

  async function handleAnalyzeCompetitors() {
    const urls = competitorAnalysisUrls.filter((u) => u.trim());
    if (urls.length === 0) {
      showError("Please add at least one competitor URL");
      return;
    }
    setIsAnalyzingCompetitors(true);
    setCompetitorAnalysisResults([]);
    const results: RunData[] = [];
    try {
      for (let i = 0; i < urls.length; i++) {
        const url = urls[i].trim();
        const res = await authFetch("/api/creative-intelligence/analyze", {
          method: "POST",
          body: JSON.stringify({ brandUrl: url, competitorUrls: [] }),
        });
        const data = await res.json();
        if (!data.ok) {
          showError(`Failed to analyze ${url}: ${data.error || "Unknown error"}`);
          continue;
        }
        for (let j = 0; j < 60; j++) {
          await new Promise((r) => setTimeout(r, 2000));
          const runRes = await authFetch(`/api/creative-intelligence/run?id=${data.runId}`);
          const runJson = await runRes.json();
          if (runJson.ok && runJson.run?.status === "completed") {
            results.push(runJson);
            setCompetitorAnalysisResults([...results]);
            break;
          }
          if (runJson.ok && runJson.run?.status === "failed") {
            showError(`Analysis failed for ${url}`);
            break;
          }
        }
      }
      if (results.length > 0) {
        showSuccess(`Analyzed ${results.length} competitor(s)`);
      }
    } catch (err: any) {
      showError(err?.message || "Competitor analysis failed");
    } finally {
      setIsAnalyzingCompetitors(false);
    }
  }

  async function handleAnalyze() {
    if (!brandUrl.trim()) {
      showError("Please enter a brand URL");
      return;
    }
    setIsAnalyzing(true);
    setProgressStep(0);
    setRunData(null);
    try {
      const res = await authFetch("/api/creative-intelligence/analyze", {
        method: "POST",
        body: JSON.stringify({
          brandUrl: brandUrl.trim(),
          competitorUrls: [],
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
      setProgressStep(7);
    }
  }

  async function fetchRunData(id: string) {
    const res = await authFetch(`/api/creative-intelligence/run?id=${id}`);
    const data = await res.json();
    if (data.ok) {
      setRunData(data);
      // Prefill the brand URL input from the restored run
      if (data.run?.brandUrl) {
        setBrandUrl(data.run.brandUrl);
      }
      // Restore comparison insights from DB if available
      if (data.run?.comparisonInsights) {
        setComparisonInsights(data.run.comparisonInsights);
      }
      // Restore competitor runs if saved
      if (data.run?.competitorRunIds?.length > 0 && competitorAnalysisResults.length === 0) {
        const competitorResults: RunData[] = [];
        for (const cId of data.run.competitorRunIds) {
          try {
            const cRes = await authFetch(`/api/creative-intelligence/run?id=${cId}`);
            const cData = await cRes.json();
            if (cData.ok) competitorResults.push(cData);
          } catch {
            // skip failed competitor fetches
          }
        }
        if (competitorResults.length > 0) {
          setCompetitorAnalysisResults(competitorResults);
        }
      }
      // Update URL for session persistence
      router.replace({ query: { runId: id } }, undefined, { shallow: true });
    }
  }

  async function fetchHistory() {
    try {
      const res = await authFetch("/api/creative-intelligence/list");
      const data = await res.json();
      if (data.ok && data.runs) setHistoryRuns(data.runs);
    } catch {
      // ignore
    }
  }

  async function fetchBrandUrlVersions(url: string) {
    try {
      const res = await authFetch(`/api/creative-intelligence/list?brandUrl=${encodeURIComponent(url)}`);
      const data = await res.json();
      if (data.ok && data.runs) {
        setBrandUrlVersions(data.runs);
      }
    } catch {
      // ignore
    }
  }

  async function handleRegenerate() {
    if (!brandUrl.trim() || isAnalyzing || isRegenerating) return;
    setIsRegenerating(true);
    setProgressStep(0);
    try {
      const res = await authFetch("/api/creative-intelligence/analyze", {
        method: "POST",
        body: JSON.stringify({
          brandUrl: brandUrl.trim(),
          competitorUrls: [],
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        showError(data.error || "Regeneration failed");
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
          setGeneratedCreatives({});
          break;
        }
        if (runJson.ok && runJson.run?.status === "failed") {
          showError(runJson.run?.errorMessage || "Regeneration failed");
          break;
        }
      }
      const runRes = await authFetch(`/api/creative-intelligence/run?id=${data.runId}`);
      const runJson = await runRes.json();
      if (runJson.ok && runJson.run?.status === "completed") {
        setRunData(runJson);
      }
    } catch (err: any) {
      showError(err?.message || "Regeneration failed");
    } finally {
      setIsRegenerating(false);
      setProgressStep(7);
    }
  }

  React.useEffect(() => {
    if (runId && !runData && !isAnalyzing) {
      fetchRunData(runId);
    }
  }, [runId, runData, isAnalyzing]);

  useEffect(() => {
    (async () => {
      await fetchHistory();
      // Auto-restore: check URL query for a specific run, or load the most recent
      const queryRunId = router.query.runId as string | undefined;
      if (queryRunId) {
        setRunId(queryRunId);
        fetchRunData(queryRunId);
      } else {
        // Load most recent completed run
        try {
          const res = await authFetch("/api/creative-intelligence/list");
          const data = await res.json();
          if (data.ok && data.runs?.length > 0) {
            const latestId = data.runs[0].id;
            setRunId(latestId);
            fetchRunData(latestId);
            router.replace({ query: { runId: latestId } }, undefined, { shallow: true });
          }
        } catch {
          // ignore
        }
      }
    })();
  }, []);

  useEffect(() => {
    if (runData?.run?.id) {
      fetchHistory();
      if (runData.run.brandUrl) {
        fetchBrandUrlVersions(runData.run.brandUrl);
      }
    }
  }, [runData?.run?.id]);

  useEffect(() => {
    if (runData && competitorAnalysisResults.length > 0 && !comparisonInsights && !isLoadingComparisonSummary && !runData.run?.comparisonInsights) {
      fetchComparisonSummary();
    }
  }, [runData?.run?.id, competitorAnalysisResults.length]);

  const scrollToHistory = () => historyRef.current?.scrollIntoView({ behavior: "smooth" });
  const scrollToComparison = () => comparisonRef.current?.scrollIntoView({ behavior: "smooth" });

  async function fetchComparisonSummary() {
    if (!runData || competitorAnalysisResults.length === 0) return;
    setIsLoadingComparisonSummary(true);
    setComparisonError(null);
    setComparisonInsights(null);
    try {
      const res = await authFetch("/api/creative-intelligence/compare-summary", {
        method: "POST",
        body: JSON.stringify({
          brand: runData,
          competitors: competitorAnalysisResults,
          runId: runData.run.id,
          competitorRunIds: competitorAnalysisResults.map((r) => r.run.id),
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setComparisonInsights({
          tldr: data.tldr,
          comparison: data.comparison,
          working_well: data.working_well || [],
          gaps: data.gaps || [],
          recommended_strategy: data.recommended_strategy || [],
        });
      } else {
        const msg = data.error || "Failed to generate insights";
        setComparisonError(msg);
        showError(msg);
      }
    } catch (err: any) {
      const msg = err?.message || "Failed to generate insights";
      setComparisonError(msg);
      showError(msg);
    } finally {
      setIsLoadingComparisonSummary(false);
    }
  }

  function handleGenerateAdFromInsight(insight: string, type: "ugc" | "commercial") {
    const prompt = type === "ugc"
      ? `Create a UGC-style (user-generated content) ad. ${insight}`
      : `Create a professional commercial ad. ${insight}`;
    router.push({
      pathname: "/brand-studio",
      query: { adPrompt: prompt, adType: type },
    });
  }

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Populate generatedCreatives from persisted DB data
  useEffect(() => {
    if (runData?.creatives && runData.creatives.length > 0) {
      const map: Record<string, any> = {};
      for (const c of runData.creatives) {
        if (c.hookId) map[c.hookId] = c.content;
      }
      setGeneratedCreatives(map);
    }
  }, [runData?.creatives]);

  async function handleGenerateCreatives(hookId: string) {
    if (!runId) return;
    setGeneratingCreativeHookId(hookId);
    try {
      const res = await authFetch("/api/creative-intelligence/generate-creatives", {
        method: "POST",
        body: JSON.stringify({ runId, hookId }),
      });
      const data = await res.json();
      if (!data.ok) {
        showError(data.error || "Failed to generate creatives");
        return;
      }
      setGeneratedCreatives((prev) => ({ ...prev, [hookId]: data.creatives }));
      showSuccess("Creatives generated!");
    } catch (err: any) {
      showError(err.message || "Failed to generate creatives");
    } finally {
      setGeneratingCreativeHookId(null);
    }
  }

  function exportCreativePack() {
    if (!runData) return;
    const blob = new Blob([JSON.stringify(runData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const domain = runData.run.brandUrl.replace(/https?:\/\//, "").replace(/\/$/, "");
    a.href = url;
    a.download = `creative-intelligence-pack-${domain}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportCopyCSV() {
    if (!runData?.hooks?.length) return;
    const header = "Rank,Hook Statement,Hook Type,Why It Works,Confidence Score";
    const rows = runData.hooks.map((h) =>
      [
        h.rank ?? "",
        `"${(h.hookStatement || "").replace(/"/g, '""')}"`,
        h.hookType || "",
        `"${(h.whyItWorks || "").replace(/"/g, '""')}"`,
        h.confidenceScore ?? "",
      ].join(",")
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const domain = runData.run.brandUrl.replace(/https?:\/\//, "").replace(/\/$/, "");
    a.href = url;
    a.download = `creative-intelligence-hooks-${domain}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportStrategyPDF() {
    if (!runData) return;
    const brand = runData.brand;
    const strategies = runData.strategies;
    const hooks = runData.hooks;
    const domain = runData.run.brandUrl.replace(/https?:\/\//, "").replace(/\/$/, "");

    const html = `<!DOCTYPE html><html><head><title>Creative Intelligence Report - ${domain}</title>
<style>body{font-family:system-ui,sans-serif;max-width:800px;margin:0 auto;padding:40px;color:#1a1a1a}
h1{font-size:24px;margin-bottom:4px}h2{font-size:18px;margin-top:32px;border-bottom:1px solid #ddd;padding-bottom:8px}
h3{font-size:15px;margin-top:20px}.meta{color:#666;font-size:13px;margin-bottom:24px}
table{width:100%;border-collapse:collapse;margin:12px 0}th,td{text-align:left;padding:8px;border-bottom:1px solid #eee;font-size:13px}
th{font-weight:600;background:#f5f5f5}.badge{display:inline-block;padding:2px 8px;border-radius:4px;font-size:11px;background:#f0f0f0}
ul{padding-left:20px}li{margin-bottom:6px;font-size:13px}@media print{body{padding:20px}}</style></head><body>
<h1>Creative Intelligence Report</h1>
<p class="meta">${domain} &mdash; ${new Date(runData.run.createdAt).toLocaleDateString()}</p>
${brand ? `<h2>Brand Summary</h2>
<p><strong>Product:</strong> ${brand.productSummary || "N/A"}</p>
<p><strong>Positioning:</strong> ${brand.positioningStatement || "N/A"}</p>
<p><strong>Target Persona:</strong> ${brand.targetPersonaGuess || "N/A"}</p>
<p><strong>Emotional Tone:</strong> ${brand.emotionalTone || "N/A"}</p>
${brand.corePainsAddressed?.length ? `<p><strong>Core Pains:</strong> ${brand.corePainsAddressed.join(", ")}</p>` : ""}` : ""}
${runData.competitors?.length ? `<h2>Competitors</h2><table><tr><th>Name</th><th>Positioning</th><th>Primary Hook</th><th>Weakness</th></tr>
${runData.competitors.map((c) => `<tr><td>${c.name || c.domain || ""}</td><td>${c.corePositioning || ""}</td><td>${c.primaryHook || ""}</td><td>${c.weaknessDetected || ""}</td></tr>`).join("")}</table>` : ""}
${hooks?.length ? `<h2>Ranked Hooks</h2><table><tr><th>#</th><th>Hook</th><th>Type</th><th>Confidence</th></tr>
${hooks.map((h) => `<tr><td>${h.rank ?? ""}</td><td>${h.hookStatement}</td><td>${h.hookType || ""}</td><td>${h.confidenceScore ?? ""}%</td></tr>`).join("")}</table>` : ""}
${strategies ? `<h2>Strategy</h2>
${strategies.underserved_angles?.length ? `<h3>Underserved Angles</h3><ul>${strategies.underserved_angles.map((a) => `<li>${a}</li>`).join("")}</ul>` : ""}
${strategies.white_space_opportunities?.length ? `<h3>White Space Opportunities</h3><ul>${strategies.white_space_opportunities.map((o) => `<li>${o}</li>`).join("")}</ul>` : ""}
${strategies.market_gap_analysis?.length ? `<h3>Market Gap Analysis</h3><ul>${strategies.market_gap_analysis.map((g) => `<li><strong>${g.opportunity_statement || ""}</strong> — ${g.why_it_exists || ""} (${g.confidence_score ?? ""}%)</li>`).join("")}</ul>` : ""}` : ""}
</body></html>`;

    const win = window.open("", "_blank");
    if (win) {
      win.document.write(html);
      win.document.close();
      setTimeout(() => win.print(), 500);
    }
  }
  async function handleGenerateFromHook(hook: RunData["hooks"][0], type: "poster" | "video") {
    if (!runData?.brand || !runData?.run?.brandUrl) return;

    setGeneratingFromHook({ hookId: hook.id, type });
    try {
      const ciBrandSnapshot = mapCreativeIntelligenceBrandToSnapshot(
        runData.brand,
        runData.run.brandUrl
      );

      const { brandGuideline, scan, product } = await fetchCreativeStudioContext(
        authFetch,
        runData.run.brandUrl
      );

      const brandSnapshot = mergeBrandSnapshots(
        brandGuideline,
        ciBrandSnapshot,
        scan?.brandSummary
      );

      if (!product) {
        showError(
          "No products found in Ad Studio. Scan your website in Ad Studio first, then try again.",
          "Product Required"
        );
        return;
      }

      const hookInput = {
        hookStatement: hook.hookStatement,
        hookType: hook.hookType,
        whyItWorks: hook.whyItWorks,
        supportingReviewPhrase: hook.supportingReviewPhrase,
      };

      const sessionName = `Hook: ${hook.hookStatement.slice(0, 40)}${hook.hookStatement.length > 40 ? "…" : ""}`;

      const payload: Record<string, unknown> = {
        name: sessionName,
        sessionType: type,
        brandSnapshot,
      };

      if (type === "poster") {
        const heroImageUrl = product.product_images?.[0];
        if (!heroImageUrl) {
          showError(
            "This product has no image in Ad Studio. Re-scan your website in Ad Studio and try again.",
            "Product Image Required"
          );
          return;
        }

        const primaryImageDataUrl = await resolvePrimaryProductImageDataUrl(authFetch, product);
        if (!primaryImageDataUrl) {
          showError(
            "Could not load the product image from Ad Studio. Open Ad Studio, confirm the product photo loads, then try again.",
            "Image Load Failed"
          );
          return;
        }

        const posterPrompt = buildPosterPromptFromHook(hookInput, brandSnapshot, product);
        payload.phase = "config";
        payload.posterPrompt = posterPrompt;
        payload.config = {
          theme: "commercial",
          aspectRatio: "9:16",
          variantCount: 3,
        };
        payload.productData = productToPosterProductData(
          product,
          posterPrompt,
          primaryImageDataUrl
        );
      } else {
        const videoStyle = mapHookTypeToVideoStyle(hook.hookType);
        const userDescription = buildVideoDescriptionFromHook(hookInput, brandSnapshot, product);
        const videoProduct = productToProductData(product, brandSnapshot);
        const heroDataUrl = await resolvePrimaryProductImageDataUrl(authFetch, product);
        if (heroDataUrl) {
          videoProduct.product_images = [heroDataUrl, ...videoProduct.product_images.filter((u) => u !== product.product_images?.[0])].slice(0, 3);
          videoProduct.hero_image = heroDataUrl;
        }
        payload.adBuilderData = {
          ...DEFAULT_AD_BUILDER_DATA,
          step: 3,
          product: videoProduct,
          adSetup: {
            ...DEFAULT_AD_BUILDER_DATA.adSetup,
            style: videoStyle,
          },
          userDescription,
          voiceover: {
            ...DEFAULT_AD_BUILDER_DATA.voiceover,
            enabled: true,
            key_message: hook.hookStatement,
            cta: product?.short_benefit ? `Try ${product.product_name} today` : `Discover ${brandSnapshot.name}`,
          },
        };
      }

      const res = await authFetch("/api/creative-studio/sessions", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Failed to create session");

      router.push(`/brand-studio/${type}?id=${data.session.id}&autoGenerate=1`);
    } catch (err: any) {
      showError(err?.message || "Failed to create session");
    } finally {
      setGeneratingFromHook(null);
    }
  }

  const painPoints = runData?.reviews?.filter((r) => r.clusterType === "pain_points") || [];
  const desiredOutcomes =
    runData?.reviews?.filter((r) => r.clusterType === "desired_outcomes") || [];

  const creativeAngleCards = (runData?.strategies?.campaign_blueprints?.length ?? 0) > 0
    ? (runData?.strategies?.campaign_blueprints ?? []).slice(0, 6)
    : (runData?.hooks ?? []).slice(0, 6).map((h) => ({
        emotional_tone_direction: h.hookType || "Engagement",
        messaging_focus: h.hookStatement,
        ad_format: "Short video / Poster",
      }));

  return (
    <div className="min-h-screen flex overflow-hidden app-page">
      <div className="flex-shrink-0 h-full">
        <Sidebar showChatHistory={false} />
      </div>

      <div
        className="flex-1 flex flex-col h-full overflow-hidden"
        style={{
          backgroundColor: colors.background,
          borderLeft: `1px solid ${colors.border}`,
        }}
      >
        {/* Sticky Header */}
      <div
        className="border-b flex-shrink-0"
        style={{
          borderColor: colors.border,
          background: colors.gradientMesh,
          backgroundColor: colors.background,
        }}
      >
          <div className="max-w-6xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-semibold flex items-center gap-2" style={{ color: colors.foreground }}>
                  Creative Intelligence
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
                  AI-powered competitive intelligence &amp; ad generation
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
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => historyRef.current?.scrollIntoView({ behavior: "smooth" })}
                  className="flex items-center gap-2"
                  style={{ color: colors.mutedForeground }}
                >
                  <Clock size={18} />
                  <span className="text-sm">History</span>
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="max-w-6xl mx-auto px-6 py-8">
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

            {/* Quick CTAs */}
            <div className="flex flex-wrap gap-3 mb-6">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setMode("brand")}
                className="rounded-lg"
                style={{
                  borderColor: mode === "brand" ? colors.primary : colors.border,
                  color: mode === "brand" ? colors.primary : colors.foreground,
                  backgroundColor: mode === "brand" ? colors.primary + "15" : colors.muted,
                }}
              >
                <Search size={16} className="mr-2" />
                Analyze your brand
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setMode("competitors")}
                className="rounded-lg"
                style={{
                  borderColor: mode === "competitors" ? colors.primary : colors.border,
                  color: mode === "competitors" ? colors.primary : colors.foreground,
                  backgroundColor: mode === "competitors" ? colors.primary + "15" : colors.muted,
                }}
              >
                <Users size={16} className="mr-2" />
                Competitor Analysis
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handlePasteCompetitors}
                className="rounded-lg"
                style={{
                  borderColor: colors.border,
                  color: colors.foreground,
                  backgroundColor: colors.muted,
                }}
              >
                <Copy size={16} className="mr-2" />
                Paste competitors
              </Button>
              {runData && competitorAnalysisResults.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={scrollToComparison}
                  className="rounded-lg"
                  style={{
                    borderColor: colors.primary,
                    color: colors.primary,
                    backgroundColor: colors.primary + "15",
                  }}
                >
                  <GitCompare size={16} className="mr-2" />
                  Comparison
                </Button>
              )}
              {runData && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setRunData(null);
                    setRunId(null);
                    setBrandUrl("");
                    setCompetitorAnalysisResults([]);
                    setComparisonInsights(null);
                    setComparisonError(null);
                    setGeneratedCreatives({});
                    setProgressStep(0);
                    setMode("brand");
                    router.replace({ query: {} }, undefined, { shallow: true });
                  }}
                  className="rounded-lg"
                  style={{
                    borderColor: colors.border,
                    color: colors.foreground,
                    backgroundColor: colors.muted,
                  }}
                >
                  + New Analysis
                </Button>
              )}
            </div>

            {/* Competitor Analysis Section */}
            {mode === "competitors" && (
              <div
                className="rounded-2xl p-6 mb-8 shadow-lg"
                style={{
                  background: colors.gradientCard,
                  border: `1px solid ${colors.border}`,
                  boxShadow: colors.shadowMedium,
                }}
              >
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2" style={{ color: colors.foreground }}>
                  <Users size={20} style={{ color: colors.primary }} />
                  Competitor Analysis
                </h2>
                <p className="text-sm mb-4" style={{ color: colors.mutedForeground }}>
                  Paste competitor URLs below. We&apos;ll analyze each one the same way (brand extraction, positioning, hooks, etc.).
                </p>
                <div className="space-y-4">
                  <div>
                    <Label style={{ color: colors.foreground }}>Competitor URLs *</Label>
                    {competitorAnalysisUrls.map((url, i) => (
                      <div key={i} className="flex gap-2 mt-1 mb-2">
                        <Input
                          value={url}
                          onChange={(e) => updateCompetitorAnalysisUrl(i, e.target.value)}
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
                          onClick={() => removeCompetitorAnalysisUrl(i)}
                          disabled={competitorAnalysisUrls.length <= 1}
                        >
                          −
                        </Button>
                      </div>
                    ))}
                    <Button variant="outline" size="sm" onClick={addCompetitorAnalysisUrl}>
                      + Add competitor
                    </Button>
                  </div>
                  <Button
                    onClick={handleAnalyzeCompetitors}
                    disabled={isAnalyzingCompetitors}
                    className="w-full py-6 text-base font-semibold rounded-xl"
                    style={{
                      background: colors.gradientPrimary,
                      color: colors.primaryForeground,
                      border: "none",
                      boxShadow: colors.shadowGlow,
                    }}
                  >
                    {isAnalyzingCompetitors ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Analyzing {competitorAnalysisResults.length + 1} of {competitorAnalysisUrls.filter(Boolean).length}…
                      </>
                    ) : (
                      <>
                        <Search className="mr-2 h-5 w-5" />
                        Analyze Competitors
                      </>
                    )}
                  </Button>
                </div>
                {competitorAnalysisResults.length > 0 && (
                  <div className="mt-6 pt-6" style={{ borderTop: `1px solid ${colors.border}` }}>
                    <h3 className="text-sm font-semibold mb-3" style={{ color: colors.foreground }}>
                      Results ({competitorAnalysisResults.length})
                    </h3>
                    <div className="space-y-4">
                      {competitorAnalysisResults.map((r, idx) => {
                        const runId = r.run?.id || `idx-${idx}`;
                        const isExpanded = expandedCompetitorId === runId;
                        return (
                          <div
                            key={runId}
                            className="rounded-xl overflow-hidden"
                            style={{
                              backgroundColor: colors.background,
                              border: `1px solid ${colors.border}`,
                            }}
                          >
                            <button
                              onClick={() => setExpandedCompetitorId(isExpanded ? null : runId)}
                              className="w-full p-4 text-left flex items-center justify-between hover:opacity-90 transition-opacity"
                            >
                              <div>
                                <p className="font-medium" style={{ color: colors.foreground }}>
                                  {(() => {
                                    if (!r.run?.brandUrl) return `Competitor ${idx + 1}`;
                                    try { return new URL(r.run.brandUrl).hostname.replace("www.", ""); }
                                    catch { return r.run.brandUrl.slice(0, 40); }
                                  })()}
                                </p>
                                {r.brand && (
                                  <p className="text-xs mt-1" style={{ color: colors.mutedForeground }}>
                                    {(r.brand as any).rawAnalysis?.product_name || r.brand.productSummary}
                                  </p>
                                )}
                              </div>
                              <span className="text-sm" style={{ color: colors.primary }}>
                                {isExpanded ? "Collapse" : "View full analysis"}
                              </span>
                            </button>
                            {isExpanded && (
                              <div className="px-4 pb-6 pt-2 border-t" style={{ borderColor: colors.border }}>
                                <CompetitorAnalysisOutput
                                  data={r}
                                  onHistoryClick={scrollToHistory}
                                  copyToClipboard={copyToClipboard}
                                  copiedId={copiedId}
                                  copyIdPrefix={`comp-${runId}`}
                                />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Compare Data CTA - when brand analysis exists */}
                {competitorAnalysisResults.length > 0 && runData && (
                  <div className="mt-8 pt-6" style={{ borderTop: `1px solid ${colors.border}` }}>
                    <Button
                      onClick={scrollToComparison}
                      className="w-full py-6 text-base font-semibold rounded-xl flex items-center justify-center gap-2"
                      style={{
                        background: colors.gradientPrimary,
                        color: colors.primaryForeground,
                        border: "none",
                        boxShadow: colors.shadowGlow,
                      }}
                    >
                      <GitCompare size={20} />
                      View Comparison
                    </Button>
                    <p className="text-xs mt-2 text-center" style={{ color: colors.mutedForeground }}>
                      Compare your brand analysis with competitor insights
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Hero Input Card - Analyze your brand */}
            {mode === "brand" && (
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
                Analyze your brand
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
                    <Progress value={(progressStep / 7) * 100} className="h-2 rounded-full" />
                  </div>
                )}
              </div>
            </div>
            )}

            {/* Output Sections - Brand analysis only (not shown in Competitor Analysis mode) */}
            {mode === "brand" && runData && (
              <>
                {/* Regenerate bar + version dropdown */}
                <div
                  className="flex items-center justify-between rounded-xl p-4 mb-6"
                  style={{
                    background: colors.card,
                    border: `1px solid ${colors.border}`,
                  }}
                >
                  <div className="flex items-center gap-3">
                    <Sparkles size={20} style={{ color: colors.primary }} />
                    <div>
                      <p className="text-sm font-medium" style={{ color: colors.foreground }}>
                        Analysis for{" "}
                        {(() => {
                          try { return new URL(runData.run.brandUrl).hostname.replace("www.", ""); }
                          catch { return runData.run.brandUrl; }
                        })()}
                      </p>
                      <p className="text-xs" style={{ color: colors.mutedForeground }}>
                        Generated {new Date(runData.run.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {brandUrlVersions.length > 1 && (
                      <div className="relative">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="flex items-center gap-1.5"
                          style={{ color: colors.mutedForeground }}
                          onClick={() => setShowVersionDropdown(!showVersionDropdown)}
                        >
                          <History className="w-4 h-4" />
                          <span className="text-xs">
                            v{brandUrlVersions.findIndex((v) => v.id === runData.run.id) + 1 || brandUrlVersions.length} of {brandUrlVersions.length}
                          </span>
                          <ChevronDown className="w-3 h-3" />
                        </Button>
                        {showVersionDropdown && (
                          <>
                            <div className="fixed inset-0 z-40" onClick={() => setShowVersionDropdown(false)} />
                            <div
                              className="absolute right-0 top-full mt-1 w-64 rounded-lg border shadow-lg z-50"
                              style={{ background: colors.card, borderColor: colors.border }}
                            >
                              <div className="p-2">
                                <p className="text-xs font-medium px-2 py-1 mb-1" style={{ color: colors.mutedForeground }}>
                                  Previous Versions ({brandUrlVersions.length})
                                </p>
                                <div className="max-h-60 overflow-y-auto space-y-0.5">
                                  {brandUrlVersions.map((v, idx) => {
                                    const isCurrent = v.id === runData.run.id;
                                    return (
                                      <button
                                        key={v.id}
                                        onClick={() => {
                                          if (!isCurrent) {
                                            fetchRunData(v.id);
                                          }
                                          setShowVersionDropdown(false);
                                        }}
                                        className="w-full text-left px-2 py-1.5 rounded text-sm transition-colors"
                                        style={{
                                          color: isCurrent ? colors.primary : colors.foreground,
                                          background: isCurrent ? colors.primary + "15" : "transparent",
                                        }}
                                        onMouseEnter={(e) => { if (!isCurrent) e.currentTarget.style.background = colors.muted; }}
                                        onMouseLeave={(e) => { if (!isCurrent) e.currentTarget.style.background = "transparent"; }}
                                      >
                                        <span className="font-medium">Version {idx + 1}</span>
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
                      </div>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleRegenerate}
                      disabled={isAnalyzing || isRegenerating}
                      className="flex items-center gap-1.5"
                      style={{
                        borderColor: colors.border,
                        color: colors.primary,
                      }}
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isRegenerating ? "animate-spin" : ""}`} />
                      {isRegenerating ? "Regenerating..." : "Regenerate"}
                    </Button>
                  </div>
                </div>

                {/* Regeneration progress */}
                {isRegenerating && (
                  <div className="mb-6 p-4 rounded-xl" style={{ background: colors.card, border: `1px solid ${colors.border}` }}>
                    <div className="flex items-center gap-3 mb-2">
                      <Loader2 className="w-5 h-5 animate-spin" style={{ color: colors.primary }} />
                      <p className="text-sm font-medium" style={{ color: colors.foreground }}>Re-analyzing brand...</p>
                    </div>
                    <Progress value={(progressStep / 7) * 100} className="h-2 rounded-full" />
                  </div>
                )}

                {/* Strategy Snapshot - AI-generated, executive clarity in 5 seconds */}
                {runData.brand && (
                  <SectionCard title="Strategy Snapshot" icon={<Sparkles size={20} />} onHistoryClick={scrollToHistory}>
                    <p className="text-sm mb-4" style={{ color: colors.mutedForeground }}>
                      AI ad analyst synthesis from brand, competitors, reviews & Meta ads.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-4 rounded-xl" style={{ backgroundColor: colors.background, border: `1px solid ${colors.border}` }}>
                        <p className="text-xs font-medium mb-1" style={{ color: colors.mutedForeground }}>Market gap</p>
                        <p className="text-sm font-medium" style={{ color: colors.foreground }}>
                          {runData.strategies?.strategy_snapshot?.market_gap || runData.strategies?.market_gap_analysis?.[0]?.opportunity_statement || runData.strategies?.market_gap_analysis?.[0]?.why_it_exists || "—"}
                        </p>
                      </div>
                      <div className="p-4 rounded-xl" style={{ backgroundColor: colors.background, border: `1px solid ${colors.border}` }}>
                        <p className="text-xs font-medium mb-1" style={{ color: colors.mutedForeground }}>Winning angle</p>
                        <p className="text-sm font-medium" style={{ color: colors.foreground }}>
                          {runData.strategies?.strategy_snapshot?.winning_angle || runData.hooks?.[0]?.hookStatement || runData.strategies?.underserved_angles?.[0] || "—"}
                        </p>
                      </div>
                      <div className="p-4 rounded-xl" style={{ backgroundColor: colors.background, border: `1px solid ${colors.border}` }}>
                        <p className="text-xs font-medium mb-1" style={{ color: colors.mutedForeground }}>Best creative direction</p>
                        <p className="text-sm font-medium" style={{ color: colors.foreground }}>
                          {runData.strategies?.strategy_snapshot?.best_creative_direction || runData.strategies?.campaign_blueprints?.[0]?.messaging_focus || runData.strategies?.campaign_blueprints?.[0]?.emotional_tone_direction || runData.brand.emotionalTone || "—"}
                        </p>
                      </div>
                      <div className="p-4 rounded-xl" style={{ backgroundColor: colors.background, border: `1px solid ${colors.border}` }}>
                        <p className="text-xs font-medium mb-1" style={{ color: colors.mutedForeground }}>Recommended ad format</p>
                        <p className="text-sm font-medium" style={{ color: colors.foreground }}>
                          {runData.strategies?.strategy_snapshot?.recommended_ad_format || runData.strategies?.campaign_blueprints?.[0]?.ad_format || runData.strategies?.campaign_blueprints?.[0]?.recommended_platform || "Short video / UGC"}
                        </p>
                      </div>
                    </div>
                  </SectionCard>
                )}

                {/* Brand Summary */}
                {runData.brand && (
                  <SectionCard title="Brand Summary" icon={<Target size={20} />} onHistoryClick={scrollToHistory}>
                    {((runData.brand as any).rawAnalysis?.industry_category || (runData.brand as any).rawAnalysis?.product_category || (runData.brand as any).rawAnalysis?.country) && (
                      <div className="flex flex-wrap gap-2 mb-4 pb-4" style={{ borderBottom: `1px solid ${colors.border}` }}>
                        {(runData.brand as any).rawAnalysis?.industry_category && (
                          <span className="text-xs px-2 py-1 rounded" style={{ backgroundColor: colors.muted, color: colors.mutedForeground }}>
                            Industry: {(runData.brand as any).rawAnalysis.industry_category}
                          </span>
                        )}
                        {(runData.brand as any).rawAnalysis?.product_category && (
                          <span className="text-xs px-2 py-1 rounded" style={{ backgroundColor: colors.muted, color: colors.mutedForeground }}>
                            Product: {(runData.brand as any).rawAnalysis.product_category}
                          </span>
                        )}
                        {(runData.brand as any).rawAnalysis?.country && (
                          <span className="text-xs px-2 py-1 rounded" style={{ backgroundColor: colors.muted, color: colors.mutedForeground }}>
                            Market: {(runData.brand as any).rawAnalysis.country}
                          </span>
                        )}
                      </div>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <InsightBlock label="Product" value={(runData.brand as any).rawAnalysis?.product_name || runData.brand.productSummary} />
                      <InsightBlock label="Core problem solved" value={(runData.brand as any).rawAnalysis?.core_problem_solved} />
                      <InsightBlock label="Target persona" value={(runData.brand as any).rawAnalysis?.primary_target_audience || runData.brand.targetPersonaGuess} />
                      <InsightBlock label="Positioning" value={runData.brand.positioningStatement || (runData.brand as any).rawAnalysis?.current_positioning_statement} />
                      <InsightBlock label="Brand tone" value={(runData.brand as any).rawAnalysis?.brand_tone || runData.brand.emotionalTone} />
                      <InsightBlock label="Pricing" value={(runData.brand as any).rawAnalysis?.pricing_positioning} />
                      {(runData.brand as any).rawAnalysis?.key_benefits?.length > 0 && (
                        <div className="md:col-span-2">
                          <p className="text-xs font-medium mb-1" style={{ color: colors.mutedForeground }}>Key benefits</p>
                          <ul className="list-disc list-inside text-sm" style={{ color: colors.foreground }}>
                            {((runData.brand as any).rawAnalysis.key_benefits || []).slice(0, 5).map((b: string, i: number) => (
                              <li key={i}>{b}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </SectionCard>
                )}

                {/* Products */}
                {(() => {
                  const products = ((runData.brand as any)?.products || []) as Product[];
                  if (!products?.length) return null;
                  return (
                    <SectionCard title="Products" icon={<LayoutGrid size={20} />} onHistoryClick={scrollToHistory}>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {products.map((p, i) => (
                          <div
                            key={i}
                            className="p-4 rounded-xl"
                            style={{
                              backgroundColor: colors.background,
                              border: `1px solid ${colors.border}`,
                            }}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-semibold text-sm" style={{ color: colors.foreground }}>
                                {p.product_name}
                              </span>
                              {p.price && (
                                <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: colors.muted, color: colors.mutedForeground }}>
                                  {p.price}
                                </span>
                              )}
                            </div>
                            {p.category && (
                              <span className="text-xs px-1.5 py-0.5 rounded mb-2 inline-block" style={{ backgroundColor: colors.primary + "15", color: colors.primary }}>
                                {p.category}
                              </span>
                            )}
                            <p className="text-xs line-clamp-2 mt-1" style={{ color: colors.mutedForeground }}>
                              {p.description}
                            </p>
                            {p.key_benefits?.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-1">
                                {p.key_benefits.slice(0, 3).map((b, bi) => (
                                  <span key={bi} className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: colors.muted, color: colors.mutedForeground }}>
                                    {b}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </SectionCard>
                  );
                })()}

                {/* Competitive Landscape */}
                {runData.competitors?.length > 0 && (
                  <SectionCard title="Competitive Landscape" icon={<BarChart3 size={20} />} onHistoryClick={scrollToHistory}>
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
                            <div className="flex items-center gap-2">
                              {(c as any).relevanceScore != null && (
                                <span className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: colors.muted, color: colors.mutedForeground }}>
                                  {(c as any).relevanceScore}% match
                                </span>
                              )}
                              <SaturationBadge level={c.saturationLevel} />
                            </div>
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

                {/* Market Position Map */}
                {runData.competitors?.length > 0 && (
                  <SectionCard title="Market Position Map" icon={<MapPin size={20} />} onHistoryClick={scrollToHistory}>
                    <p className="text-sm mb-4" style={{ color: colors.mutedForeground }}>
                      Market gap discovery: affordable vs premium, functional vs lifestyle.
                    </p>
                    <MarketPositionMap
                      brandPoint={runData.brand ? (() => {
                        const raw = (runData.brand as any)?.rawAnalysis || {};
                        const t = [raw.pricing_positioning, runData.brand.emotionalTone, raw.current_positioning_statement].filter(Boolean).join(" ");
                        const pos = inferPosition(t);
                        return { name: raw.product_name || "Your brand", price: pos.price, lifestyle: pos.lifestyle };
                      })() : null}
                      competitorPoints={runData.competitors.map((c) => {
                        const t = [c.pricingTier, c.corePositioning, c.primaryHook].filter(Boolean).join(" ");
                        const pos = inferPosition(t);
                        return { name: c.name || c.domain || "Competitor", price: pos.price, lifestyle: pos.lifestyle };
                      })}
                    />
                  </SectionCard>
                )}

                {/* Competitor Messaging Matrix */}
                {runData.competitors?.length > 0 && (
                  <SectionCard title="Competitor Messaging Matrix" icon={<Grid3X3 size={20} />} onHistoryClick={scrollToHistory}>
                    <p className="text-sm mb-4" style={{ color: colors.mutedForeground }}>
                      See competitor messaging patterns at a glance.
                    </p>
                    <CompetitorMessagingMatrix
                      rows={[
                        ...(runData.brand ? [{
                          brand: (runData.brand as any)?.rawAnalysis?.product_name || "Your brand",
                          priceTier: (runData.brand as any)?.rawAnalysis?.pricing_positioning || "—",
                          mainAngle: (runData.brand.positioningStatement || (runData.brand as any)?.rawAnalysis?.current_positioning_statement || "").slice(0, 50) || "—",
                          emotionalHook: runData.brand.emotionalTone || (runData.brand as any)?.rawAnalysis?.brand_tone || "—",
                        }] : []),
                        ...runData.competitors.map((c) => ({
                          brand: c.name || c.domain || "—",
                          priceTier: c.pricingTier || "—",
                          mainAngle: (c.corePositioning || "").slice(0, 50) || "—",
                          emotionalHook: c.primaryHook || "—",
                        })),
                      ]}
                    />
                  </SectionCard>
                )}

                {/* Meta & Google Ad Intelligence - shown for both brand and competitor analysis */}
                <SectionCard title="Meta & Google Ad Intelligence" icon={<Megaphone size={20} />} onHistoryClick={scrollToHistory}>
                  <p className="text-sm mb-4" style={{ color: colors.mutedForeground }}>
                    Ads from Meta Ad Library to inform your creative strategy.
                  </p>
                  {runData.metaAds && runData.metaAds.length > 0 ? (
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
                  ) : (
                    <div
                      className="rounded-xl p-8 text-center"
                      style={{
                        backgroundColor: colors.muted + "40",
                        border: `1px dashed ${colors.border}`,
                      }}
                    >
                      <Megaphone size={32} className="mx-auto mb-2 opacity-50" style={{ color: colors.mutedForeground }} />
                      <p className="text-sm" style={{ color: colors.mutedForeground }}>
                        No Meta ads data for this analysis. The pipeline fetches ads from Meta Ad Library when SEARCH_API_KEY is configured.
                      </p>
                    </div>
                  )}
                </SectionCard>

                {/* Facebook Business Pages */}
                {runData.facebookPages && runData.facebookPages.length > 0 && (
                  <SectionCard title="Facebook Business Pages" icon={<Facebook size={20} />} onHistoryClick={scrollToHistory}>
                    <p className="text-sm mb-4" style={{ color: colors.mutedForeground }}>
                      Brand and competitor Facebook page details: followers, ratings, category, and contact info.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {runData.facebookPages.map((fb) => (
                        <div
                          key={fb.id}
                          className="rounded-xl overflow-hidden"
                          style={{
                            backgroundColor: colors.background,
                            border: `1px solid ${colors.border}`,
                          }}
                        >
                          <div className="flex items-start gap-4 p-4">
                            {fb.profilePhotoUrl && (
                              <img
                                src={fb.profilePhotoUrl}
                                alt={fb.pageName || ""}
                                className="w-14 h-14 rounded-lg object-cover shrink-0"
                              />
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-semibold" style={{ color: colors.foreground }}>
                                  {fb.pageName || fb.entityName}
                                </span>
                                <span
                                  className="text-xs px-2 py-0.5 rounded"
                                  style={{
                                    backgroundColor: fb.source === "brand" ? colors.primary + "30" : colors.muted,
                                    color: fb.source === "brand" ? colors.primary : colors.mutedForeground,
                                  }}
                                >
                                  {fb.source}
                                </span>
                              </div>
                              {fb.category && (
                                <p className="text-xs mb-1" style={{ color: colors.mutedForeground }}>
                                  {fb.category}
                                </p>
                              )}
                              {fb.followersCount != null && (
                                <p className="text-sm font-medium" style={{ color: colors.foreground }}>
                                  {fb.followersCount.toLocaleString()} followers
                                </p>
                              )}
                              {fb.ratings && (
                                <p className="text-xs" style={{ color: colors.mutedForeground }}>
                                  {fb.ratings}
                                  {fb.reviewsCount != null && ` (${fb.reviewsCount} reviews)`}
                                </p>
                              )}
                              {fb.pageLink && (
                                <a
                                  href={fb.pageLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs mt-1 inline-block"
                                  style={{ color: colors.primary }}
                                >
                                  View on Facebook →
                                </a>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </SectionCard>
                )}

                {/* Google Rank Tracking */}
                {runData.googleRanks && runData.googleRanks.length > 0 && (
                  <SectionCard title="Google Search Visibility" icon={<TrendingUp size={20} />} onHistoryClick={scrollToHistory}>
                    <p className="text-sm mb-4" style={{ color: colors.mutedForeground }}>
                      Where your brand and competitors rank for key search terms.
                    </p>
                    <div className="space-y-4">
                      {runData.googleRanks.map((r) => (
                        <div
                          key={r.id}
                          className="p-4 rounded-xl"
                          style={{
                            backgroundColor: colors.background,
                            border: `1px solid ${colors.border}`,
                          }}
                        >
                          <p className="font-medium mb-3" style={{ color: colors.foreground }}>
                            &ldquo;{r.searchQuery}&rdquo;
                          </p>
                          <div className="flex flex-wrap gap-4">
                            {r.brandPosition != null && (
                              <div className="flex items-center gap-2">
                                <span className="text-xs" style={{ color: colors.mutedForeground }}>Your brand:</span>
                                <span
                                  className="text-sm font-bold px-2 py-0.5 rounded"
                                  style={{ backgroundColor: colors.primary + "30", color: colors.primary }}
                                >
                                  #{r.brandPosition}
                                </span>
                              </div>
                            )}
                            {r.competitorRanks && r.competitorRanks.length > 0 && (
                              <div className="flex flex-wrap gap-2">
                                {r.competitorRanks.map((c, i) => (
                                  <span key={i} className="text-xs" style={{ color: colors.mutedForeground }}>
                                    {c.domain}: <strong style={{ color: colors.foreground }}>#{c.position}</strong>
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </SectionCard>
                )}

                {/* Customer Psychology Heatmap - where messaging should focus */}
                {(painPoints.length > 0 || desiredOutcomes.length > 0) && (
                  <SectionCard title="Customer Psychology Heatmap" icon={<BarChart3 size={20} />} onHistoryClick={scrollToHistory}>
                    <p className="text-sm mb-4" style={{ color: colors.mutedForeground }}>
                      Pain frequency, opportunity score, and impact on messaging.
                    </p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr style={{ borderBottom: `1px solid ${colors.border}` }}>
                            <th className="text-left py-2 px-3 font-medium" style={{ color: colors.mutedForeground }}>Insight</th>
                            <th className="text-left py-2 px-3 font-medium" style={{ color: colors.mutedForeground }}>Pain frequency</th>
                            <th className="text-left py-2 px-3 font-medium" style={{ color: colors.mutedForeground }}>Opportunity score</th>
                            <th className="text-left py-2 px-3 font-medium" style={{ color: colors.mutedForeground }}>Impact on messaging</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[...painPoints, ...desiredOutcomes]
                            .sort((a, b) => (b.frequencyPct ?? 0) - (a.frequencyPct ?? 0))
                            .slice(0, 8)
                            .map((r, i) => {
                              const freq = r.frequencyPct ?? 0;
                              const oppScore = r.clusterType === "pain_points" ? Math.min(100, 100 - freq + 20) : Math.min(100, freq + 10);
                              const impact = Math.round((freq * 0.6 + oppScore * 0.4));
                              return (
                                <tr key={i} style={{ borderBottom: `1px solid ${colors.border}` }}>
                                  <td className="py-2 px-3 font-medium" style={{ color: colors.foreground }}>{r.clusterLabel || "—"}</td>
                                  <td className="py-2 px-3">
                                    <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: "hsl(0 84% 55% / 0.2)", color: colors.destructive }}>
                                      {freq}%
                                    </span>
                                  </td>
                                  <td className="py-2 px-3">
                                    <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: "hsl(142 76% 36% / 0.2)", color: colors.green600 }}>
                                      {oppScore}%
                                    </span>
                                  </td>
                                  <td className="py-2 px-3">
                                    <div className="flex items-center gap-2">
                                      <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: colors.muted }}>
                                        <div className="h-full rounded-full" style={{ width: `${impact}%`, backgroundColor: colors.primary }} />
                                      </div>
                                      <span style={{ color: colors.mutedForeground }}>{impact}%</span>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>
                  </SectionCard>
                )}

                {/* Customer Language Cloud - real phrases from reviews */}
                {runData.reviews?.some((r) => r.samplePhrases?.length) && (
                  <SectionCard title="Customer Language Cloud" icon={<MessageSquare size={20} />} onHistoryClick={scrollToHistory}>
                    <p className="text-sm mb-4" style={{ color: colors.mutedForeground }}>
                      Real phrases from reviews — use customer language in ads.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {runData.reviews
                        .flatMap((r) => r.samplePhrases || [])
                        .filter(Boolean)
                        .slice(0, 16)
                        .map((phrase, i) => (
                          <button
                            key={i}
                            onClick={() => copyToClipboard(phrase, `phrase-${i}`)}
                            className="text-sm px-3 py-2 rounded-lg transition-all hover:scale-105"
                            style={{
                              backgroundColor: colors.muted,
                              border: `1px solid ${colors.border}`,
                              color: colors.foreground,
                              fontSize: ["0.75rem", "0.8rem", "0.9rem", "1rem"][i % 4],
                            }}
                          >
                            &ldquo;{phrase}&rdquo;
                            {copiedId === `phrase-${i}` ? <Check size={14} className="inline ml-1" /> : <Copy size={14} className="inline ml-1 opacity-60" />}
                          </button>
                        ))}
                    </div>
                  </SectionCard>
                )}

                {/* Opportunity Radar - brand strengths & weaknesses */}
                {runData.reviews?.length > 0 && (() => {
                  const dims = ["Taste", "Health credibility", "Price perception", "Convenience", "Brand excitement"];
                  const keywords: Record<string, string[]> = {
                    Taste: ["taste", "flavor", "bland", "delicious", "yummy"],
                    "Health credibility": ["health", "protein", "natural", "organic", "clean"],
                    "Price perception": ["price", "expensive", "cheap", "value", "worth"],
                    Convenience: ["convenient", "easy", "quick", "portable", "on-the-go"],
                    "Brand excitement": ["love", "great", "amazing", "recommend", "excited"],
                  };
                  const radarData = dims.map((d) => {
                    const kws = keywords[d].map((k) => k.toLowerCase());
                    const matching = runData.reviews.filter((r) => {
                      const label = (r.clusterLabel || "").toLowerCase();
                      const phrases = (r.samplePhrases || []).join(" ").toLowerCase();
                      return kws.some((k) => label.includes(k) || phrases.includes(k));
                    });
                    const score = matching.length > 0
                      ? Math.min(100, matching.reduce((s, m) => s + (m.frequencyPct ?? 0), 0) / matching.length + 30)
                      : 50;
                    return { subject: d, value: Math.round(score), fullMark: 100 };
                  });
                  return (
                    <SectionCard title="Opportunity Radar" icon={<Target size={20} />} onHistoryClick={scrollToHistory}>
                      <p className="text-sm mb-4" style={{ color: colors.mutedForeground }}>
                        Visualize brand strengths & weaknesses across key dimensions.
                      </p>
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <RadarChart data={radarData}>
                            <PolarGrid stroke={colors.border} />
                            <PolarAngleAxis dataKey="subject" tick={{ fill: colors.mutedForeground, fontSize: 11 }} />
                            <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fill: colors.mutedForeground, fontSize: 10 }} />
                            <Radar name="Score" dataKey="value" stroke={colors.primary} fill={colors.primary + "40"} strokeWidth={2} />
                          </RadarChart>
                        </ResponsiveContainer>
                      </div>
                    </SectionCard>
                  );
                })()}

                {/* Ranked Hooks */}
                {runData.hooks?.length > 0 && (
                  <SectionCard title="Ranked Hooks" icon={<Zap size={20} />} onHistoryClick={scrollToHistory}>
                    <p className="text-sm mb-4" style={{ color: colors.mutedForeground }}>
                      Choose the best creative hook with strength, opportunity, and evidence.
                    </p>
                    <div className="space-y-4">
                      {runData.hooks.map((hook) => {
                        const strength = hook.confidenceScore ?? 70;
                        const oppScore =
                          hook.competitorOverlapLevel === "low" || hook.competitorOverlapLevel === "low_overlap"
                            ? 85
                            : hook.competitorOverlapLevel === "medium"
                            ? 60
                            : 40;
                        const saturation =
                          hook.competitorOverlapLevel === "high"
                            ? "High"
                            : hook.competitorOverlapLevel === "medium"
                            ? "Medium"
                            : "Low";

                        return (
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
                            {/* Hook strength meter */}
                            <div className="mb-2">
                              <div className="flex justify-between text-xs mb-1">
                                <span style={{ color: colors.mutedForeground }}>Hook strength</span>
                                <span style={{ color: colors.foreground }}>{strength}%</span>
                              </div>
                              <Progress value={strength} className="h-1.5 rounded-full" />
                            </div>
                            {/* Opportunity score & Market saturation */}
                            <div className="flex flex-wrap gap-4 mb-2 text-xs">
                              <div>
                                <span style={{ color: colors.mutedForeground }}>Opportunity score: </span>
                                <span className="font-medium" style={{ color: colors.foreground }}>{oppScore}%</span>
                              </div>
                              <div>
                                <span style={{ color: colors.mutedForeground }}>Market saturation: </span>
                                <span className="font-medium" style={{ color: colors.foreground }}>{saturation}</span>
                              </div>
                            </div>
                            {/* Market Saturation Indicator */}
                            <MarketSaturationIndicator
                              label="Competitor usage of this angle"
                              pct={(hook as any).saturation_score ?? (hook.competitorOverlapLevel === "high" ? 70 : hook.competitorOverlapLevel === "medium" ? 50 : 25)}
                            />
                            {/* Evidence from reviews */}
                            {hook.supportingReviewPhrase && (
                              <div className="mb-2 p-2 rounded-lg" style={{ backgroundColor: colors.muted + "60", borderLeft: `3px solid ${colors.primary}` }}>
                                <p className="text-xs font-medium mb-0.5" style={{ color: colors.mutedForeground }}>Evidence from reviews</p>
                                <p className="text-sm italic" style={{ color: colors.foreground }}>&ldquo;{hook.supportingReviewPhrase}&rdquo;</p>
                              </div>
                            )}
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
                            <div className="flex items-center gap-2 mt-3 flex-wrap">
                              <Button
                                size="sm"
                                disabled={generatingFromHook?.hookId === hook.id && generatingFromHook?.type === "poster"}
                                onClick={() => handleGenerateFromHook(hook, "poster")}
                                style={{ backgroundColor: colors.primary, color: colors.primaryForeground }}
                              >
                                {generatingFromHook?.hookId === hook.id && generatingFromHook?.type === "poster" ? (
                                  <Loader2 size={14} className="mr-1.5 animate-spin" />
                                ) : (
                                  <Image size={14} className="mr-1.5" />
                                )}
                                Generate Poster
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={generatingFromHook?.hookId === hook.id && generatingFromHook?.type === "video"}
                                onClick={() => handleGenerateFromHook(hook, "video")}
                                style={{ borderColor: colors.border, color: colors.foreground }}
                              >
                                {generatingFromHook?.hookId === hook.id && generatingFromHook?.type === "video" ? (
                                  <Loader2 size={14} className="mr-1.5 animate-spin" />
                                ) : (
                                  <Video size={14} className="mr-1.5" />
                                )}
                                Generate Video
                              </Button>
                              <button
                                type="button"
                                onClick={() => copyToClipboard(hook.hookStatement + (hook.whyItWorks ? `\n\nWhy it works: ${hook.whyItWorks}` : ""), `hook-${hook.id}`)}
                                className="p-2 rounded-lg hover:opacity-80 transition-opacity"
                                style={{ backgroundColor: colors.muted, color: colors.foreground }}
                                title="Copy hook"
                              >
                                {copiedId === `hook-${hook.id}` ? <Check size={16} /> : <Copy size={16} />}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleGenerateCreatives(hook.id)}
                                disabled={generatingCreativeHookId === hook.id}
                                className="p-2 rounded-lg hover:opacity-80 transition-opacity flex items-center gap-1.5 text-sm"
                                style={{ backgroundColor: colors.primary, color: colors.primaryForeground }}
                                title="Generate creatives from this hook"
                              >
                                {generatingCreativeHookId === hook.id ? (
                                  <Loader2 size={16} className="animate-spin" />
                                ) : (
                                  <Sparkles size={16} />
                                )}
                                <span>{generatingCreativeHookId === hook.id ? "Generating..." : generatedCreatives[hook.id] ? "Regenerate" : "Generate Creatives"}</span>
                              </button>
                            </div>
                            {/* Generated Creatives Display */}
                            {generatedCreatives[hook.id] && (
                              <div className="w-full mt-4 space-y-4">
                                {/* Poster Concepts */}
                                {generatedCreatives[hook.id].posters?.map((poster: any, pi: number) => (
                                  <div key={pi} className="p-4 rounded-lg" style={{ backgroundColor: colors.muted + "60", border: `1px solid ${colors.border}` }}>
                                    <h5 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: colors.foreground }}>
                                      <Target size={14} />
                                      Poster Concept
                                      {poster.confidence_score != null && (
                                        <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: colors.primary + "20", color: colors.primary }}>{poster.confidence_score}%</span>
                                      )}
                                    </h5>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                      <div>
                                        <p className="text-xs font-medium mb-1.5" style={{ color: colors.mutedForeground }}>Primary Text Options</p>
                                        {poster.primary_text_options?.map((t: string, i: number) => (
                                          <div key={i} className="flex items-center gap-1 mb-1">
                                            <span className="text-sm" style={{ color: colors.foreground }}>{t}</span>
                                            <button type="button" onClick={() => copyToClipboard(t, `poster-primary-${pi}-${i}`)} className="opacity-60 hover:opacity-100">
                                              {copiedId === `poster-primary-${pi}-${i}` ? <Check size={12} /> : <Copy size={12} />}
                                            </button>
                                          </div>
                                        ))}
                                      </div>
                                      <div>
                                        <p className="text-xs font-medium mb-1.5" style={{ color: colors.mutedForeground }}>Secondary Text Options</p>
                                        {poster.secondary_text_options?.map((t: string, i: number) => (
                                          <div key={i} className="flex items-center gap-1 mb-1">
                                            <span className="text-sm" style={{ color: colors.foreground }}>{t}</span>
                                            <button type="button" onClick={() => copyToClipboard(t, `poster-secondary-${pi}-${i}`)} className="opacity-60 hover:opacity-100">
                                              {copiedId === `poster-secondary-${pi}-${i}` ? <Check size={12} /> : <Copy size={12} />}
                                            </button>
                                          </div>
                                        ))}
                                      </div>
                                      <div>
                                        <p className="text-xs font-medium mb-1.5" style={{ color: colors.mutedForeground }}>CTA Options</p>
                                        {poster.cta_options?.map((t: string, i: number) => (
                                          <div key={i} className="flex items-center gap-1 mb-1">
                                            <span className="text-sm" style={{ color: colors.foreground }}>{t}</span>
                                            <button type="button" onClick={() => copyToClipboard(t, `poster-cta-${pi}-${i}`)} className="opacity-60 hover:opacity-100">
                                              {copiedId === `poster-cta-${pi}-${i}` ? <Check size={12} /> : <Copy size={12} />}
                                            </button>
                                          </div>
                                        ))}
                                      </div>
                                      {poster.visual_direction && (
                                        <div>
                                          <p className="text-xs font-medium mb-1.5" style={{ color: colors.mutedForeground }}>Visual Direction</p>
                                          {Object.entries(poster.visual_direction).map(([key, val]) => (
                                            <p key={key} className="text-xs mb-0.5" style={{ color: colors.foreground }}>
                                              <span style={{ color: colors.mutedForeground }}>{key.replace(/_/g, " ")}:</span> {String(val)}
                                            </p>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                ))}
                                {/* Video Scripts */}
                                {generatedCreatives[hook.id].video_scripts_8s?.length > 0 && (
                                  <div className="p-4 rounded-lg" style={{ backgroundColor: colors.muted + "60", border: `1px solid ${colors.border}` }}>
                                    <h5 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: colors.foreground }}>
                                      <Video size={14} />
                                      8s Video Scripts
                                    </h5>
                                    <div className="space-y-3">
                                      {generatedCreatives[hook.id].video_scripts_8s.map((script: any, si: number) => (
                                        <div key={si} className="p-3 rounded-lg" style={{ backgroundColor: colors.background, border: `1px solid ${colors.border}` }}>
                                          <div className="flex items-center justify-between mb-2">
                                            <span className="text-xs font-medium" style={{ color: colors.mutedForeground }}>Script {script.script_number || si + 1}</span>
                                            {script.confidence_score != null && (
                                              <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: colors.primary + "20", color: colors.primary }}>{script.confidence_score}%</span>
                                            )}
                                          </div>
                                          <div className="space-y-1.5">
                                            {[
                                              { label: "0-2s Hook", value: script.hook_line },
                                              { label: "2-5s Problem/Desire", value: script.problem_or_desire },
                                              { label: "5-7s Solution", value: script.solution },
                                              { label: "7-8s CTA", value: script.cta },
                                            ].map((part) => (
                                              <div key={part.label} className="flex items-start gap-2">
                                                <span className="text-xs font-medium shrink-0 w-32" style={{ color: colors.mutedForeground }}>{part.label}</span>
                                                <span className="text-sm flex-1" style={{ color: colors.foreground }}>{part.value}</span>
                                                <button type="button" onClick={() => copyToClipboard(part.value || "", `script-${si}-${part.label}`)} className="opacity-60 hover:opacity-100 shrink-0">
                                                  {copiedId === `script-${si}-${part.label}` ? <Check size={12} /> : <Copy size={12} />}
                                                </button>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </SectionCard>
                )}

                {/* Ad Format Recommendation - AI ad analyst research */}
                {runData.brand && (() => {
                  const aiRecs = runData.strategies?.ad_format_recommendations || [];
                  const hasAiData = aiRecs.length >= 4;
                  const data = hasAiData
                    ? aiRecs.map((r: { format: string; score: number }) => ({ name: r.format, value: Math.min(100, Math.max(0, r.score ?? 0)), reasoning: (r as any).reasoning }))
                    : [
                        { name: "Short Video Ads", value: 78, reasoning: "" },
                        { name: "UGC Style Ads", value: 71, reasoning: "" },
                        { name: "Static Posters", value: 65, reasoning: "" },
                        { name: "Carousel Ads", value: 42, reasoning: "" },
                      ];
                  return (
                    <SectionCard title="Ad Format Recommendation" icon={<Video size={20} />} onHistoryClick={scrollToHistory}>
                      <p className="text-sm mb-4" style={{ color: colors.mutedForeground }}>
                        {hasAiData ? "AI ad analyst research based on Meta ads, competitors & audience fit." : "Execution guidance (run a new analysis for AI-derived recommendations)."}
                      </p>
                      <div className="h-48">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={data} layout="vertical" margin={{ top: 0, right: 20, left: 80, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke={colors.border} />
                            <XAxis type="number" domain={[0, 100]} tick={{ fill: colors.mutedForeground, fontSize: 11 }} />
                            <YAxis type="category" dataKey="name" width={70} tick={{ fill: colors.mutedForeground, fontSize: 11 }} />
                            <Bar dataKey="value" fill={colors.primary} radius={[0, 4, 4, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                      {hasAiData && data.some((d: any) => d.reasoning) && (
                        <div className="mt-4 space-y-2">
                          <p className="text-xs font-medium" style={{ color: colors.mutedForeground }}>AI reasoning</p>
                          {data.filter((d: any) => d.reasoning).map((d: any, i: number) => (
                            <div key={i} className="text-xs" style={{ color: colors.foreground }}>
                              <span className="font-medium">{d.name}:</span> {d.reasoning}
                            </div>
                          ))}
                        </div>
                      )}
                    </SectionCard>
                  );
                })()}

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
                    <Button variant="outline" size="sm" onClick={exportCreativePack}>
                      <Download size={16} className="mr-2" />
                      Export Creative Pack
                    </Button>
                    <Button variant="outline" size="sm" onClick={exportStrategyPDF}>
                      <Download size={16} className="mr-2" />
                      Export Strategy PDF
                    </Button>
                    <Button variant="outline" size="sm" onClick={exportCopyCSV}>
                      <Download size={16} className="mr-2" />
                      Export Copy CSV
                    </Button>
                  </div>
                </div>
              </>
            )}

            {/* Comparison Section - when both brand and competitor data exist */}
            {runData && competitorAnalysisResults.length > 0 && (
              <div ref={comparisonRef} className="mt-12 pt-8" style={{ borderTop: `1px solid ${colors.border}` }}>
                <div className="flex items-center gap-2 mb-6">
                  <GitCompare size={24} style={{ color: colors.primary }} />
                  <h3 className="text-xl font-bold" style={{ color: colors.foreground }}>
                    Comparison
                  </h3>
                </div>

                {/* 1. AI Summary - TL;DR (first, scannable) */}
                <div
                  className="rounded-2xl p-6 mb-6"
                  style={{
                    backgroundColor: colors.card,
                    border: `2px solid ${colors.primary + "40"}`,
                    boxShadow: colors.shadowMedium,
                  }}
                >
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-base font-semibold flex items-center gap-2" style={{ color: colors.foreground }}>
                      <Sparkles size={18} style={{ color: colors.primary }} />
                      AI Summary
                    </h4>
                    {!comparisonInsights && !isLoadingComparisonSummary && (
                      <Button size="sm" onClick={fetchComparisonSummary} style={{ backgroundColor: colors.primary, color: colors.primaryForeground }}>
                        <Sparkles size={14} className="mr-2" />
                        {comparisonError ? "Retry" : "Generate Insights"}
                      </Button>
                    )}
                  </div>
                  {isLoadingComparisonSummary && (
                    <div className="flex items-center gap-3 py-8" style={{ color: colors.mutedForeground }}>
                      <Loader2 size={24} className="animate-spin" />
                      <span>Generating insights…</span>
                    </div>
                  )}
                  {comparisonInsights?.tldr && !isLoadingComparisonSummary && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="p-3 rounded-lg" style={{ backgroundColor: colors.primary + "15", border: `1px solid ${colors.primary + "40"}` }}>
                        <p className="text-xs font-medium mb-1" style={{ color: colors.primary }}>🔥 Biggest Opportunity</p>
                        <p className="text-sm" style={{ color: colors.foreground }}>{comparisonInsights.tldr.biggest_opportunity}</p>
                      </div>
                      <div className="p-3 rounded-lg" style={{ backgroundColor: colors.background, border: `1px solid ${colors.border}` }}>
                        <p className="text-xs font-medium mb-1" style={{ color: colors.mutedForeground }}>💪 Biggest Strength</p>
                        <p className="text-sm" style={{ color: colors.foreground }}>{comparisonInsights.tldr.biggest_strength}</p>
                      </div>
                      <div className="p-3 rounded-lg" style={{ backgroundColor: "hsl(0 84% 55% / 0.1)", border: `1px solid hsl(0 84% 55% / 0.3)` }}>
                        <p className="text-xs font-medium mb-1" style={{ color: "hsl(0 84% 55%)" }}>🚨 Biggest Weakness</p>
                        <p className="text-sm" style={{ color: colors.foreground }}>{comparisonInsights.tldr.biggest_weakness}</p>
                      </div>
                      <div className="p-3 rounded-lg" style={{ backgroundColor: colors.background, border: `1px solid ${colors.border}` }}>
                        <p className="text-xs font-medium mb-1" style={{ color: colors.mutedForeground }}>🎯 Best Ad Strategy</p>
                        <p className="text-sm" style={{ color: colors.foreground }}>{comparisonInsights.tldr.recommended_ad_strategy}</p>
                      </div>
                    </div>
                  )}
                  {!comparisonInsights && !isLoadingComparisonSummary && (
                    <div className="py-6 px-4 rounded-xl text-center" style={{ backgroundColor: colors.muted + "40", border: `1px dashed ${colors.border}` }}>
                      <p className="text-sm mb-3" style={{ color: colors.foreground }}>Get scannable insights in under 5 seconds.</p>
                      {comparisonError && <p className="text-xs mb-2" style={{ color: "hsl(0 84% 55%)" }}>{comparisonError}</p>}
                      <Button size="sm" onClick={fetchComparisonSummary} style={{ backgroundColor: colors.primary, color: colors.primaryForeground }}>
                        <Sparkles size={14} className="mr-2" />
                        Generate Insights
                      </Button>
                    </div>
                  )}
                </div>

                {/* 2. Brand Comparison - structured two-column */}
                <div
                  className="rounded-2xl p-6 mb-6"
                  style={{ backgroundColor: colors.background, border: `1px solid ${colors.border}`, boxShadow: colors.shadowSoft }}
                >
                  <h4 className="text-base font-semibold mb-4" style={{ color: colors.foreground }}>Brand Comparison</h4>
                  {comparisonInsights?.comparison ? (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div className="rounded-xl p-4" style={{ backgroundColor: colors.card, border: `1px solid ${colors.border}` }}>
                        <p className="text-xs font-medium mb-2" style={{ color: colors.primary }}>Your Brand Strengths</p>
                        <ul className="text-sm space-y-1" style={{ color: colors.foreground }}>
                          {(comparisonInsights.comparison.brand_strengths || []).map((s, i) => (
                            <li key={i}>• {s}</li>
                          ))}
                        </ul>
                      </div>
                      <div className="rounded-xl p-4" style={{ backgroundColor: colors.card, border: `1px solid ${colors.border}` }}>
                        <p className="text-xs font-medium mb-2" style={{ color: colors.mutedForeground }}>Competitor Strengths</p>
                        <ul className="text-sm space-y-1" style={{ color: colors.foreground }}>
                          {(comparisonInsights.comparison.competitor_strengths || []).map((s, i) => (
                            <li key={i}>• {s}</li>
                          ))}
                        </ul>
                      </div>
                      <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="p-3 rounded-lg" style={{ backgroundColor: "hsl(0 84% 55% / 0.1)", border: `1px solid hsl(0 84% 55% / 0.3)` }}>
                          <p className="text-xs font-medium mb-1" style={{ color: "hsl(0 84% 55%)" }}>🚨 Key Market Gap</p>
                          <p className="text-sm" style={{ color: colors.foreground }}>{comparisonInsights.comparison.key_market_gap}</p>
                        </div>
                        <div className="p-3 rounded-lg" style={{ backgroundColor: colors.primary + "15", border: `1px solid ${colors.primary + "40"}` }}>
                          <p className="text-xs font-medium mb-1" style={{ color: colors.primary }}>🔥 Strategic Opportunity</p>
                          <p className="text-sm" style={{ color: colors.foreground }}>{comparisonInsights.comparison.strategic_opportunity}</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      <div className="rounded-xl p-4" style={{ backgroundColor: colors.card, border: `1px solid ${colors.border}` }}>
                        <p className="text-xs font-medium mb-2" style={{ color: colors.primary }}><Target size={14} className="inline mr-1" /> Your Brand</p>
                        <p className="text-xs mb-2 truncate" style={{ color: colors.mutedForeground }}>{runData.run?.brandUrl}</p>
                        <div className="flex flex-wrap gap-1.5">
                          {runData.hooks?.slice(0, 3).map((h) => (
                            <span key={h.id} className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: colors.primary + "20", color: colors.foreground }}>{h.hookStatement.slice(0, 45)}{h.hookStatement.length > 45 ? "…" : ""}</span>
                          ))}
                        </div>
                      </div>
                      {competitorAnalysisResults.map((r, idx) => (
                        <div key={r.run?.id || idx} className="rounded-xl p-4" style={{ backgroundColor: colors.card, border: `1px solid ${colors.border}` }}>
                          <p className="text-xs font-medium mb-2" style={{ color: colors.mutedForeground }}><Users size={14} className="inline mr-1" /> Competitor {idx + 1}</p>
                          <p className="text-xs mb-2 truncate" style={{ color: colors.mutedForeground }}>{r.run?.brandUrl}</p>
                          <div className="flex flex-wrap gap-1.5">
                            {r.hooks?.slice(0, 3).map((h) => (
                              <span key={h.id} className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: colors.muted, color: colors.foreground }}>{h.hookStatement.slice(0, 45)}{h.hookStatement.length > 45 ? "…" : ""}</span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Market Position Map - Comparison view */}
                {(runData.brand || competitorAnalysisResults.some((r) => r.brand)) && (
                  <div className="rounded-2xl p-6 mb-6" style={{ backgroundColor: colors.background, border: `1px solid ${colors.border}` }}>
                    <h4 className="text-base font-semibold mb-2 flex items-center gap-2" style={{ color: colors.foreground }}>
                      <MapPin size={18} />
                      Market Position Map
                    </h4>
                    <p className="text-sm mb-4" style={{ color: colors.mutedForeground }}>
                      Market gap discovery: your brand vs competitors on affordable↔premium, functional↔lifestyle.
                    </p>
                    <MarketPositionMap
                      brandPoint={runData.brand ? (() => {
                        const raw = (runData.brand as any)?.rawAnalysis || {};
                        const t = [raw.pricing_positioning, runData.brand.emotionalTone, raw.current_positioning_statement].filter(Boolean).join(" ");
                        const pos = inferPosition(t);
                        return { name: raw.product_name || "Your brand", price: pos.price, lifestyle: pos.lifestyle };
                      })() : null}
                      competitorPoints={[
                        ...(runData.competitors || []).map((c) => {
                          const t = [c.pricingTier, c.corePositioning, c.primaryHook].filter(Boolean).join(" ");
                          const pos = inferPosition(t);
                          return { name: c.name || c.domain || "Competitor", price: pos.price, lifestyle: pos.lifestyle };
                        }),
                        ...competitorAnalysisResults.filter((r) => r.brand).map((r) => {
                          const raw = (r.brand as any)?.rawAnalysis || {};
                          const t = [raw.pricing_positioning, r.brand!.emotionalTone, raw.current_positioning_statement].filter(Boolean).join(" ");
                          const pos = inferPosition(t);
                          let name = raw.product_name;
                          if (!name && r.run?.brandUrl) try { name = new URL(r.run.brandUrl).hostname; } catch { name = "Competitor"; }
                          return { name: name || "Competitor", price: pos.price, lifestyle: pos.lifestyle };
                        }),
                      ]}
                    />
                  </div>
                )}

                {/* Competitor Messaging Matrix - Comparison view */}
                {(runData.brand || competitorAnalysisResults.length > 0) && (
                  <div className="rounded-2xl p-6 mb-6" style={{ backgroundColor: colors.background, border: `1px solid ${colors.border}` }}>
                    <h4 className="text-base font-semibold mb-2 flex items-center gap-2" style={{ color: colors.foreground }}>
                      <Grid3X3 size={18} />
                      Competitor Messaging Matrix
                    </h4>
                    <p className="text-sm mb-4" style={{ color: colors.mutedForeground }}>
                      See competitor messaging patterns at a glance.
                    </p>
                    <CompetitorMessagingMatrix
                      rows={[
                        ...(runData.brand ? [{
                          brand: (runData.brand as any)?.rawAnalysis?.product_name || "Your brand",
                          priceTier: (runData.brand as any)?.rawAnalysis?.pricing_positioning || "—",
                          mainAngle: (runData.brand.positioningStatement || (runData.brand as any)?.rawAnalysis?.current_positioning_statement || "").slice(0, 50) || "—",
                          emotionalHook: runData.brand.emotionalTone || (runData.brand as any)?.rawAnalysis?.brand_tone || "—",
                        }] : []),
                        ...(runData.competitors || []).map((c) => ({
                          brand: c.name || c.domain || "—",
                          priceTier: c.pricingTier || "—",
                          mainAngle: (c.corePositioning || "").slice(0, 50) || "—",
                          emotionalHook: c.primaryHook || "—",
                        })),
                        ...competitorAnalysisResults.filter((r) => r.brand).map((r) => {
                          const raw = (r.brand as any)?.rawAnalysis || {};
                          let brandName = raw.product_name;
                          if (!brandName && r.run?.brandUrl) try { brandName = new URL(r.run.brandUrl).hostname; } catch { brandName = "Competitor"; }
                          return {
                            brand: brandName || "Competitor",
                            priceTier: raw.pricing_positioning || "—",
                            mainAngle: (r.brand!.positioningStatement || raw.current_positioning_statement || "").slice(0, 50) || "—",
                            emotionalHook: r.brand!.emotionalTone || raw.brand_tone || "—",
                          };
                        }),
                      ]}
                    />
                  </div>
                )}

                {/* 3. What's Working Well - Insight Cards */}
                {comparisonInsights?.working_well && comparisonInsights.working_well.length > 0 && (
                  <div className="mb-6">
                    <h4 className="text-base font-semibold mb-3 flex items-center gap-2" style={{ color: colors.foreground }}>
                      <span>🔥</span> What&apos;s Working Well
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {comparisonInsights.working_well.map((card, i) => (
                        <InsightCardBlock key={i} card={card} type="strength" onGenerateAd={handleGenerateAdFromInsight} />
                      ))}
                    </div>
                  </div>
                )}

                {/* 4. What's Going Wrong / Gaps - Insight Cards */}
                {comparisonInsights?.gaps && comparisonInsights.gaps.length > 0 && (
                  <div className="mb-6">
                    <h4 className="text-base font-semibold mb-3 flex items-center gap-2" style={{ color: colors.foreground }}>
                      <span>🚨</span> What&apos;s Going Wrong / Gaps
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {comparisonInsights.gaps.map((card, i) => (
                        <InsightCardBlock key={i} card={card} type="gap" onGenerateAd={handleGenerateAdFromInsight} />
                      ))}
                    </div>
                  </div>
                )}

                {/* 5. Recommended Strategy */}
                {comparisonInsights?.recommended_strategy && comparisonInsights.recommended_strategy.length > 0 && (
                  <div
                    className="rounded-2xl p-6"
                    style={{ backgroundColor: colors.background, border: `1px solid ${colors.border}` }}
                  >
                    <h4 className="text-base font-semibold mb-3 flex items-center gap-2" style={{ color: colors.foreground }}>
                      <span>🎯</span> Recommended Strategy
                    </h4>
                    <div className="space-y-2">
                      {comparisonInsights.recommended_strategy.map((s, i) => (
                        <div key={i} className="p-3 rounded-lg flex items-start gap-2" style={{ backgroundColor: colors.card, border: `1px solid ${colors.border}` }}>
                          <span className="text-xs font-medium shrink-0" style={{ color: colors.primary }}>{s.title}</span>
                          <p className="text-sm" style={{ color: colors.foreground }}>{s.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Previous Analysis - History */}
            <div ref={historyRef} className="mt-12 pt-8" style={{ borderTop: `1px solid ${colors.border}` }}>
              <div className="flex items-center gap-2 mb-4">
                <Clock size={20} style={{ color: colors.primary }} />
                <h3 className="text-lg font-semibold" style={{ color: colors.foreground }}>
                  Previous Analysis
                </h3>
              </div>
              {historyRuns.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {historyRuns.map((r) => {
                    let domain = "Unknown";
                    try {
                      if (r.brandUrl) domain = new URL(r.brandUrl).hostname.replace("www.", "");
                    } catch {
                      domain = r.brandUrl?.slice(0, 30) || "Unknown";
                    }
                    const date = r.createdAt ? new Date(r.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "";
                    return (
                      <button
                        key={r.id}
                        onClick={() => {
                          setMode("brand");
                          fetchRunData(r.id);
                        }}
                        className="px-4 py-2.5 rounded-lg text-left text-sm transition-colors flex items-center gap-2"
                        style={{
                          backgroundColor: runData?.run?.id === r.id ? colors.primary + "20" : colors.muted,
                          border: `1px solid ${runData?.run?.id === r.id ? colors.primary : colors.border}`,
                          color: runData?.run?.id === r.id ? colors.primary : colors.foreground,
                        }}
                      >
                        <span className="font-medium truncate max-w-[180px]">{domain}</span>
                        <span className="text-xs opacity-70">{date}</span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm" style={{ color: colors.mutedForeground }}>
                  No previous analyses yet. Run your first analysis above.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function InsightCardBlock({
  card,
  type,
  onGenerateAd,
}: {
  card: InsightCard;
  type: "strength" | "gap";
  onGenerateAd: (insight: string, adType: "ugc" | "commercial") => void;
}) {
  const insightText = [card.title, card.description, card.opportunity, card.ad_angle].filter(Boolean).join(". ");
  const borderColor = type === "gap" ? "hsl(0 84% 55% / 0.3)" : colors.primary + "40";
  const bgColor = type === "gap" ? "hsl(0 84% 55% / 0.08)" : colors.primary + "10";

  return (
    <div
      className="rounded-xl p-4"
      style={{
        backgroundColor: colors.card,
        border: `1px solid ${borderColor}`,
        boxShadow: colors.shadowSoft,
      }}
    >
      <h5 className="font-semibold text-sm mb-1" style={{ color: colors.foreground }}>{card.title}</h5>
      <p className="text-xs mb-2" style={{ color: colors.mutedForeground }}>{card.description}</p>
      <div className="space-y-1.5 mb-3">
        <p className="text-xs">
          <span style={{ color: colors.primary }}>🔥 Opportunity:</span>{" "}
          <span style={{ color: colors.foreground }}>{card.opportunity}</span>
        </p>
        <p className="text-xs">
          <span style={{ color: colors.primary }}>🎯 Ad Angle:</span>{" "}
          <span style={{ color: colors.foreground }}>{card.ad_angle}</span>
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          className="text-xs"
          onClick={() => onGenerateAd(insightText, "ugc")}
          style={{ borderColor: colors.border }}
        >
          <Video size={12} className="mr-1" />
          Generate UGC Ad
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="text-xs"
          onClick={() => onGenerateAd(insightText, "commercial")}
          style={{ borderColor: colors.border }}
        >
          <Video size={12} className="mr-1" />
          Generate Commercial Ad
        </Button>
      </div>
    </div>
  );
}

function CompetitorAnalysisOutput({
  data,
  onHistoryClick,
  copyToClipboard,
  copiedId,
  copyIdPrefix = "comp",
}: {
  data: RunData;
  onHistoryClick: () => void;
  copyToClipboard: (text: string, id: string) => void;
  copiedId: string | null;
  copyIdPrefix?: string;
}) {
  const painPoints = (data.reviews || []).filter((r) => r.clusterType === "pain_points");
  const desiredOutcomes = (data.reviews || []).filter((r) => r.clusterType === "desired_outcomes");

  return (
    <div className="space-y-6 mt-4">
      {data.brand && (
        <SectionCard title="Brand Summary" icon={<Target size={20} />} onHistoryClick={onHistoryClick}>
          {((data.brand as any).rawAnalysis?.industry_category || (data.brand as any).rawAnalysis?.product_category || (data.brand as any).rawAnalysis?.country) && (
            <div className="flex flex-wrap gap-2 mb-4 pb-4" style={{ borderBottom: `1px solid ${colors.border}` }}>
              {(data.brand as any).rawAnalysis?.industry_category && (
                <span className="text-xs px-2 py-1 rounded" style={{ backgroundColor: colors.muted, color: colors.mutedForeground }}>
                  Industry: {(data.brand as any).rawAnalysis.industry_category}
                </span>
              )}
              {(data.brand as any).rawAnalysis?.product_category && (
                <span className="text-xs px-2 py-1 rounded" style={{ backgroundColor: colors.muted, color: colors.mutedForeground }}>
                  Product: {(data.brand as any).rawAnalysis.product_category}
                </span>
              )}
              {(data.brand as any).rawAnalysis?.country && (
                <span className="text-xs px-2 py-1 rounded" style={{ backgroundColor: colors.muted, color: colors.mutedForeground }}>
                  Market: {(data.brand as any).rawAnalysis.country}
                </span>
              )}
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <InsightBlock label="Product" value={(data.brand as any).rawAnalysis?.product_name || data.brand.productSummary} />
            <InsightBlock label="Core problem solved" value={(data.brand as any).rawAnalysis?.core_problem_solved} />
            <InsightBlock label="Target persona" value={(data.brand as any).rawAnalysis?.primary_target_audience || data.brand.targetPersonaGuess} />
            <InsightBlock label="Positioning" value={data.brand.positioningStatement || (data.brand as any).rawAnalysis?.current_positioning_statement} />
            <InsightBlock label="Brand tone" value={(data.brand as any).rawAnalysis?.brand_tone || data.brand.emotionalTone} />
            <InsightBlock label="Pricing" value={(data.brand as any).rawAnalysis?.pricing_positioning} />
            {((data.brand as any).rawAnalysis?.key_benefits?.length ?? 0) > 0 && (
              <div className="md:col-span-2">
                <p className="text-xs font-medium mb-1" style={{ color: colors.mutedForeground }}>Key benefits</p>
                <ul className="list-disc list-inside text-sm" style={{ color: colors.foreground }}>
                  {((data.brand as any).rawAnalysis.key_benefits || []).slice(0, 5).map((b: string, i: number) => (
                    <li key={i}>{b}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </SectionCard>
      )}

      {data.competitors && data.competitors.length > 0 && (
        <SectionCard title="Competitive Landscape" icon={<BarChart3 size={20} />} onHistoryClick={onHistoryClick}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.competitors.map((c) => (
              <div key={c.id} className="p-4 rounded-xl" style={{ backgroundColor: colors.background, border: `1px solid ${colors.border}` }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold" style={{ color: colors.foreground }}>{c.name || c.domain}</span>
                  <SaturationBadge level={c.saturationLevel} />
                </div>
                <p className="text-sm mb-2 line-clamp-2" style={{ color: colors.mutedForeground }}>{c.corePositioning}</p>
                {c.primaryHook && <p className="text-xs italic" style={{ color: colors.mutedForeground }}>Hook: {c.primaryHook}</p>}
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* Market Position Map - for competitor analysis */}
      {data.competitors && data.competitors.length > 0 && (
        <SectionCard title="Market Position Map" icon={<MapPin size={20} />} onHistoryClick={onHistoryClick}>
          <p className="text-sm mb-4" style={{ color: colors.mutedForeground }}>
            Market gap discovery: affordable vs premium, functional vs lifestyle.
          </p>
          <MarketPositionMap
            brandPoint={data.brand ? (() => {
              const raw = (data.brand as any)?.rawAnalysis || {};
              const t = [raw.pricing_positioning, data.brand.emotionalTone, raw.current_positioning_statement].filter(Boolean).join(" ");
              const pos = inferPosition(t);
              return { name: raw.product_name || "This brand", price: pos.price, lifestyle: pos.lifestyle };
            })() : null}
            competitorPoints={data.competitors.map((c) => {
              const t = [c.pricingTier, c.corePositioning, c.primaryHook].filter(Boolean).join(" ");
              const pos = inferPosition(t);
              return { name: c.name || c.domain || "Competitor", price: pos.price, lifestyle: pos.lifestyle };
            })}
          />
        </SectionCard>
      )}

      {/* Competitor Messaging Matrix */}
      {(data.brand || (data.competitors && data.competitors.length > 0)) && (
        <SectionCard title="Competitor Messaging Matrix" icon={<Grid3X3 size={20} />} onHistoryClick={onHistoryClick}>
          <p className="text-sm mb-4" style={{ color: colors.mutedForeground }}>
            See competitor messaging patterns at a glance.
          </p>
          <CompetitorMessagingMatrix
            rows={[
              ...(data.brand ? [{
                brand: (data.brand as any)?.rawAnalysis?.product_name || "This brand",
                priceTier: (data.brand as any)?.rawAnalysis?.pricing_positioning || "—",
                mainAngle: (data.brand.positioningStatement || (data.brand as any)?.rawAnalysis?.current_positioning_statement || "").slice(0, 50) || "—",
                emotionalHook: data.brand.emotionalTone || (data.brand as any)?.rawAnalysis?.brand_tone || "—",
              }] : []),
              ...(data.competitors || []).map((c) => ({
                brand: c.name || c.domain || "—",
                priceTier: c.pricingTier || "—",
                mainAngle: (c.corePositioning || "").slice(0, 50) || "—",
                emotionalHook: c.primaryHook || "—",
              })),
            ]}
          />
        </SectionCard>
      )}

      <SectionCard title="Meta & Google Ad Intelligence" icon={<Megaphone size={20} />} onHistoryClick={onHistoryClick}>
        {data.metaAds && data.metaAds.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.metaAds.slice(0, 12).map((ad) => (
              <div key={ad.id} className="rounded-xl overflow-hidden group" style={{ backgroundColor: colors.background, border: `1px solid ${colors.border}` }}>
                {ad.imageUrl && (
                  <div className="aspect-square bg-muted overflow-hidden">
                    <img src={ad.imageUrl} alt={ad.pageName || "Ad"} className="w-full h-full object-cover" />
                  </div>
                )}
                <div className="p-4">
                  <span className="font-semibold text-sm" style={{ color: colors.foreground }}>{ad.pageName || "Unknown"}</span>
                  {ad.bodyText && <p className="text-xs line-clamp-3 mt-2" style={{ color: colors.mutedForeground }}>{ad.bodyText}</p>}
                  {ad.ctaText && <span className="text-xs font-medium mt-2 block" style={{ color: colors.primary }}>CTA: {ad.ctaText}</span>}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl p-8 text-center" style={{ backgroundColor: colors.muted + "40", border: `1px dashed ${colors.border}` }}>
            <p className="text-sm" style={{ color: colors.mutedForeground }}>No Meta ads data for this competitor.</p>
          </div>
        )}
      </SectionCard>

      {data.facebookPages && data.facebookPages.length > 0 && (
        <SectionCard title="Facebook Business Pages" icon={<Facebook size={20} />} onHistoryClick={onHistoryClick}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.facebookPages.map((fb) => (
              <div key={fb.id} className="p-4 rounded-xl" style={{ backgroundColor: colors.background, border: `1px solid ${colors.border}` }}>
                <span className="font-semibold" style={{ color: colors.foreground }}>{fb.pageName || fb.entityName}</span>
                {fb.category && <p className="text-xs" style={{ color: colors.mutedForeground }}>{fb.category}</p>}
                {fb.followersCount != null && <p className="text-sm" style={{ color: colors.foreground }}>{fb.followersCount.toLocaleString()} followers</p>}
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {data.googleRanks && data.googleRanks.length > 0 && (
        <SectionCard title="Google Search Visibility" icon={<TrendingUp size={20} />} onHistoryClick={onHistoryClick}>
          <div className="space-y-3">
            {data.googleRanks.map((r) => (
              <div key={r.id} className="p-3 rounded-lg" style={{ backgroundColor: colors.background, border: `1px solid ${colors.border}` }}>
                <p className="font-medium text-sm" style={{ color: colors.foreground }}>&ldquo;{r.searchQuery}&rdquo;</p>
                {r.brandPosition != null && <span className="text-xs" style={{ color: colors.primary }}>Position: #{r.brandPosition}</span>}
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {(painPoints.length > 0 || desiredOutcomes.length > 0) && (
        <SectionCard title="Customer Psychology" icon={<BarChart3 size={20} />} onHistoryClick={onHistoryClick}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium mb-3" style={{ color: colors.foreground }}>Top Pain Points</h4>
              <ul className="space-y-2">
                {painPoints.slice(0, 5).map((r, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-xs px-2 py-0.5 rounded shrink-0" style={{ backgroundColor: "hsl(0 84% 55% / 0.2)", color: colors.destructive }}>{r.frequencyPct ?? "—"}%</span>
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
                    <span className="text-xs px-2 py-0.5 rounded shrink-0" style={{ backgroundColor: "hsl(142 76% 36% / 0.2)", color: colors.green600 }}>{r.frequencyPct ?? "—"}%</span>
                    <span style={{ color: colors.foreground }}>{r.clusterLabel}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          {(data.reviews || []).flatMap((r) => r.samplePhrases || []).length > 0 && (
            <div className="mt-4">
              <h4 className="font-medium mb-2" style={{ color: colors.foreground }}>Common Phrases (click to copy)</h4>
              <div className="flex flex-wrap gap-2">
                {(data.reviews || []).flatMap((r) => r.samplePhrases || []).slice(0, 8).map((phrase, i) => (
                  <button
                    key={i}
                    onClick={() => copyToClipboard(phrase, `${copyIdPrefix}-phrase-${i}`)}
                    className="text-sm px-3 py-1.5 rounded-lg"
                    style={{ backgroundColor: colors.muted, border: `1px solid ${colors.border}`, color: colors.foreground }}
                  >
                    {phrase}
                    {copiedId === `${copyIdPrefix}-phrase-${i}` ? <Check size={14} className="inline ml-1" /> : <Copy size={14} className="inline ml-1 opacity-60" />}
                  </button>
                ))}
              </div>
            </div>
          )}
        </SectionCard>
      )}

      {data.hooks && data.hooks.length > 0 && (
        <SectionCard title="Ranked Hooks" icon={<Zap size={20} />} onHistoryClick={onHistoryClick}>
          <div className="space-y-4">
            {data.hooks.map((hook) => (
              <div key={hook.id} className="p-5 rounded-xl" style={{ backgroundColor: colors.background, border: `1px solid ${colors.border}` }}>
                <p className="text-lg font-bold mb-2" style={{ color: colors.foreground }}>{hook.hookStatement}</p>
                <div className="flex flex-wrap gap-2 mb-2">
                  <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: colors.muted, color: colors.mutedForeground }}>{hook.hookType || "—"}</span>
                  <SaturationBadge level={hook.competitorOverlapLevel} />
                </div>
                <MarketSaturationIndicator
                  label="Competitor usage of this angle"
                  pct={(hook as any).saturation_score ?? (hook.competitorOverlapLevel === "high" ? 70 : hook.competitorOverlapLevel === "medium" ? 50 : 25)}
                />
                {hook.whyItWorks && <p className="text-sm mb-2" style={{ color: colors.mutedForeground }}>{hook.whyItWorks}</p>}
                {hook.confidenceScore != null && (
                  <div className="mb-3">
                    <div className="flex justify-between text-xs mb-1">
                      <span style={{ color: colors.mutedForeground }}>Confidence</span>
                      <span style={{ color: colors.foreground }}>{hook.confidenceScore}%</span>
                    </div>
                    <Progress value={hook.confidenceScore} className="h-1.5 rounded-full" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </SectionCard>
      )}
    </div>
  );
}

function SectionCard({
  title,
  icon,
  children,
  onHistoryClick,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  onHistoryClick?: () => void;
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
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2" style={{ color: colors.primary }}>
          {icon}
          <h3 className="text-lg font-semibold" style={{ color: colors.foreground }}>
            {title}
          </h3>
        </div>
        {onHistoryClick && (
          <button
            onClick={onHistoryClick}
            className="p-1.5 rounded-lg hover:opacity-80 transition-opacity"
            style={{ color: colors.mutedForeground }}
            title="View history"
          >
            <Clock size={18} />
          </button>
        )}
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
    low_overlap: { bg: "hsl(142 76% 36% / 0.2)", color: colors.green600 },
  };
  const s = styles[level.toLowerCase()] || styles.moderate;
  return (
    <span className="text-xs px-2 py-0.5 rounded font-medium" style={{ backgroundColor: s.bg, color: s.color }}>
      {level}
    </span>
  );
}

/** Infer price (0=Affordable, 100=Premium) and lifestyle (0=Functional, 100=Lifestyle) from text */
function inferPosition(text: string | null | undefined): { price: number; lifestyle: number } {
  const t = (text || "").toLowerCase();
  let price = 50;
  if (/\b(budget|affordable|value|cheap|low.?cost)\b/.test(t)) price = 15;
  else if (/\b(mid|moderate|mid-range|average)\b/.test(t)) price = 50;
  else if (/\b(premium|luxury|high-end|expensive)\b/.test(t)) price = 85;
  let lifestyle = 50;
  if (/\b(functional|technical|performance|specs|utility)\b/.test(t)) lifestyle = 20;
  else if (/\b(lifestyle|aspirational|identity|status|youth|energy)\b/.test(t)) lifestyle = 80;
  return { price, lifestyle };
}

function MarketPositionMap({
  brandPoint,
  competitorPoints,
}: {
  brandPoint: { name: string; price: number; lifestyle: number } | null;
  competitorPoints: Array<{ name: string; price: number; lifestyle: number }>;
}) {
  const all = brandPoint ? [brandPoint, ...competitorPoints] : competitorPoints;
  if (all.length === 0) return null;
  return (
    <div className="relative h-72 rounded-xl overflow-hidden" style={{ backgroundColor: colors.muted + "30", border: `1px solid ${colors.border}` }}>
      {/* Axes labels */}
      <div className="absolute left-0 right-0 top-2 text-center text-xs font-medium" style={{ color: colors.mutedForeground }}>
        Affordable ← — — — — — — — — — → Premium
      </div>
      <div className="absolute left-2 top-1/2 -translate-y-1/2 -rotate-90 text-xs font-medium whitespace-nowrap" style={{ color: colors.mutedForeground }}>
        Functional ← — — — → Lifestyle
      </div>
      {/* Plot area with quadrant grid */}
      <div className="absolute inset-0 pt-8 pl-14 pr-4 pb-10">
        <div className="relative w-full h-full" style={{ backgroundColor: colors.background + "80", borderRadius: 8 }}>
          {/* Center crosshair for quadrants */}
          <div className="absolute left-1/2 top-0 bottom-0 w-px" style={{ backgroundColor: colors.border + "60" }} />
          <div className="absolute top-1/2 left-0 right-0 h-px" style={{ backgroundColor: colors.border + "60" }} />
          {all.map((p, i) => {
            const isBrand = i === 0 && brandPoint;
            const left = `${p.price}%`;
            const bottom = `${p.lifestyle}%`;
            return (
              <div
                key={i}
                className="absolute -translate-x-1/2 translate-y-1/2"
                style={{ left, bottom }}
              >
                <div
                  className="rounded-full border-2 shadow-md"
                  style={{
                    width: isBrand ? 14 : 10,
                    height: isBrand ? 14 : 10,
                    backgroundColor: isBrand ? colors.primary : colors.mutedForeground,
                    borderColor: isBrand ? colors.primary : colors.border,
                  }}
                />
                <span
                  className="absolute left-1/2 -translate-x-1/2 mt-1 text-xs font-medium whitespace-nowrap px-2 py-0.5 rounded max-w-[120px] truncate"
                  style={{
                    backgroundColor: isBrand ? colors.primary + "20" : colors.muted,
                    color: isBrand ? colors.primary : colors.foreground,
                    border: `1px solid ${isBrand ? colors.primary + "50" : colors.border}`,
                  }}
                  title={p.name}
                >
                  {p.name}
                </span>
              </div>
            );
          })}
        </div>
      </div>
      {/* Legend with matching colors */}
      <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-6 text-xs">
        {brandPoint && (
          <span className="flex items-center gap-1.5" style={{ color: colors.mutedForeground }}>
            <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: colors.primary }} />
            Your brand
          </span>
        )}
        {competitorPoints.length > 0 && (
          <span className="flex items-center gap-1.5" style={{ color: colors.mutedForeground }}>
            <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: colors.mutedForeground }} />
            Competitors
          </span>
        )}
      </div>
      {all.length === 1 && (
        <p className="absolute bottom-8 left-0 right-0 text-center text-xs" style={{ color: colors.mutedForeground }}>
          Add more competitors to discover positioning gaps
        </p>
      )}
    </div>
  );
}

function CompetitorMessagingMatrix({
  rows,
}: {
  rows: Array<{ brand: string; priceTier: string; mainAngle: string; emotionalHook: string }>;
}) {
  if (rows.length === 0) return null;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr style={{ borderBottom: `2px solid ${colors.border}` }}>
            <th className="text-left py-2 px-3 font-medium" style={{ color: colors.mutedForeground }}>Brand</th>
            <th className="text-left py-2 px-3 font-medium" style={{ color: colors.mutedForeground }}>Price Tier</th>
            <th className="text-left py-2 px-3 font-medium" style={{ color: colors.mutedForeground }}>Main Angle</th>
            <th className="text-left py-2 px-3 font-medium" style={{ color: colors.mutedForeground }}>Emotional Hook</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} style={{ borderBottom: `1px solid ${colors.border}` }}>
              <td className="py-2 px-3 font-medium" style={{ color: colors.foreground }}>{r.brand}</td>
              <td className="py-2 px-3" style={{ color: colors.foreground }}>{r.priceTier}</td>
              <td className="py-2 px-3" style={{ color: colors.foreground }}>{r.mainAngle}</td>
              <td className="py-2 px-3" style={{ color: colors.foreground }}>{r.emotionalHook}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MarketSaturationIndicator({ label, pct }: { label: string; pct: number }) {
  const blocks = 10;
  const filledBlocks = Math.round((pct / 100) * blocks);
  return (
    <div className="mt-4">
      <p className="text-xs font-medium mb-1" style={{ color: colors.mutedForeground }}>{label}</p>
      <div className="flex items-center gap-2">
        <div className="flex gap-0.5">
          {Array.from({ length: blocks }).map((_, i) => (
            <div
              key={i}
              className="w-2 h-3 rounded-sm"
              style={{ backgroundColor: i < filledBlocks ? colors.primary : colors.muted }}
            />
          ))}
        </div>
        <span className="text-xs font-medium" style={{ color: colors.foreground }}>{pct}%</span>
      </div>
    </div>
  );
}
