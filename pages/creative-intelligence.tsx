// pages/creative-intelligence.tsx
// Creative Intelligence: AI-powered Creative Strategy + Competitive Intelligence

import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
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
  Lightbulb,
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
} from "lucide-react";
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
  const [generatedCreatives, setGeneratedCreatives] = useState<Record<string, any>>({});

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
    if (data.ok) setRunData(data);
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

  React.useEffect(() => {
    if (runId && !runData && !isAnalyzing) {
      fetchRunData(runId);
    }
  }, [runId, runData, isAnalyzing]);

  useEffect(() => {
    fetchHistory();
  }, []);

  useEffect(() => {
    if (runData?.run?.id) fetchHistory();
  }, [runData?.run?.id]);

  useEffect(() => {
    if (runData && competitorAnalysisResults.length > 0 && !comparisonInsights && !isLoadingComparisonSummary) {
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
    try {
      sessionStorage.setItem("creative-intelligence:ad-prompt", prompt);
      sessionStorage.setItem("creative-intelligence:ad-type", type);
      router.push("/brand-studio");
    } catch {
      router.push("/brand-studio");
    }
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
          backgroundColor: colors.background,
          borderLeft: `1px solid ${colors.border}`,
        }}
      >
        {/* Header */}
        <div
          className="border-b flex-shrink-0"
          style={{
            borderColor: colors.border,
            background: colors.gradientMesh,
            backgroundColor: colors.background,
          }}
        >
          <div className="max-w-6xl mx-auto px-6 py-6">
            <div className="flex items-center justify-between">
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

        <div className="flex-1 overflow-y-auto">
          <div className="max-w-6xl mx-auto px-6 py-8">
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

                {/* Customer Psychology */}
                {(painPoints.length > 0 || desiredOutcomes.length > 0) && (
                  <SectionCard title="Customer Psychology" icon={<BarChart3 size={20} />} onHistoryClick={scrollToHistory}>
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
                    <div className="space-y-6">
                      {(runData.strategies.market_gap_analysis?.length ?? 0) > 0 && (
                        <div>
                          <h4 className="font-medium mb-2" style={{ color: colors.foreground }}>Market Gap Analysis</h4>
                          <div className="space-y-3">
                            {(runData.strategies.market_gap_analysis ?? []).map((g, i) => (
                              <div key={i} className="p-3 rounded-lg" style={{ backgroundColor: colors.background, border: `1px solid ${colors.border}` }}>
                                <p className="font-medium text-sm mb-1" style={{ color: colors.foreground }}>{g.opportunity_statement}</p>
                                {g.why_it_exists && <p className="text-xs mb-1" style={{ color: colors.mutedForeground }}>{g.why_it_exists}</p>}
                                {g.supporting_review_signal && <p className="text-xs italic" style={{ color: colors.mutedForeground }}>&ldquo;{g.supporting_review_signal}&rdquo;</p>}
                                <div className="flex gap-2 mt-2">
                                  {g.competitor_overlap_level && <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: colors.muted }}>{g.competitor_overlap_level}</span>}
                                  {g.confidence_score != null && <span className="text-xs" style={{ color: colors.primary }}>{g.confidence_score}% confidence</span>}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
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
                      {(runData.strategies.campaign_blueprints?.length ?? 0) > 0 && (
                        <div>
                          <h4 className="font-medium mb-2" style={{ color: colors.foreground }}>Campaign Blueprints (Top Hooks)</h4>
                          <div className="space-y-3">
                            {(runData.strategies.campaign_blueprints ?? []).map((b, i) => (
                              <div key={i} className="p-4 rounded-xl" style={{ backgroundColor: colors.background, border: `1px solid ${colors.border}` }}>
                                <p className="text-xs font-medium mb-2" style={{ color: colors.primary }}>Hook #{b.hook_rank ?? i + 1}</p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                                  {b.recommended_platform && <p><span style={{ color: colors.mutedForeground }}>Platform:</span> {b.recommended_platform}</p>}
                                  {b.ad_format && <p><span style={{ color: colors.mutedForeground }}>Format:</span> {b.ad_format}</p>}
                                  {b.target_audience_segment && <p><span style={{ color: colors.mutedForeground }}>Audience:</span> {b.target_audience_segment}</p>}
                                  {b.cta_strategy && <p><span style={{ color: colors.mutedForeground }}>CTA:</span> {b.cta_strategy}</p>}
                                </div>
                                {b.messaging_focus && <p className="text-sm mt-2" style={{ color: colors.foreground }}>{b.messaging_focus}</p>}
                                {b.test_variations && b.test_variations.length > 0 && (
                                  <p className="text-xs mt-2" style={{ color: colors.mutedForeground }}>Test: {b.test_variations.join(" • ")}</p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </SectionCard>
                )}

                {/* Ranked Hooks */}
                {runData.hooks?.length > 0 && (
                  <SectionCard title="Ranked Hooks" icon={<Zap size={20} />} onHistoryClick={scrollToHistory}>
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
                      ))}
                    </div>
                  </SectionCard>
                )}

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
  const strategies = data.strategies || {};

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

      {strategies && (Object.keys(strategies).length > 0) && (
        <SectionCard title="Market Opportunities" icon={<Lightbulb size={20} />} onHistoryClick={onHistoryClick}>
          <div className="space-y-6">
            {(strategies.market_gap_analysis?.length ?? 0) > 0 && (
              <div>
                <h4 className="font-medium mb-2" style={{ color: colors.foreground }}>Market Gap Analysis</h4>
                <div className="space-y-3">
                  {(strategies.market_gap_analysis ?? []).map((g: any, i: number) => (
                    <div key={i} className="p-3 rounded-lg" style={{ backgroundColor: colors.background, border: `1px solid ${colors.border}` }}>
                      <p className="font-medium text-sm mb-1" style={{ color: colors.foreground }}>{g.opportunity_statement}</p>
                      {g.why_it_exists && <p className="text-xs mb-1" style={{ color: colors.mutedForeground }}>{g.why_it_exists}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {(strategies.underserved_angles?.length ?? 0) > 0 && (
              <div>
                <h4 className="font-medium mb-2" style={{ color: colors.foreground }}>Underserved Angles</h4>
                <ul className="list-disc list-inside space-y-1" style={{ color: colors.mutedForeground }}>
                  {(strategies.underserved_angles ?? []).map((a: string, i: number) => (
                    <li key={i}>{a}</li>
                  ))}
                </ul>
              </div>
            )}
            {(strategies.white_space_opportunities?.length ?? 0) > 0 && (
              <div>
                <h4 className="font-medium mb-2" style={{ color: colors.foreground }}>White Space Opportunities</h4>
                <ul className="list-disc list-inside space-y-1" style={{ color: colors.mutedForeground }}>
                  {(strategies.white_space_opportunities ?? []).map((w: string, i: number) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            )}
            {(strategies.campaign_blueprints?.length ?? 0) > 0 && (
              <div>
                <h4 className="font-medium mb-2" style={{ color: colors.foreground }}>Campaign Blueprints (Top Hooks)</h4>
                <div className="space-y-3">
                  {(strategies.campaign_blueprints ?? []).map((b: any, i: number) => (
                    <div key={i} className="p-4 rounded-xl" style={{ backgroundColor: colors.background, border: `1px solid ${colors.border}` }}>
                      <p className="text-xs font-medium mb-2" style={{ color: colors.primary }}>Hook #{b.hook_rank ?? i + 1}</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                        {b.recommended_platform && <p><span style={{ color: colors.mutedForeground }}>Platform:</span> {b.recommended_platform}</p>}
                        {b.ad_format && <p><span style={{ color: colors.mutedForeground }}>Format:</span> {b.ad_format}</p>}
                        {b.cta_strategy && <p><span style={{ color: colors.mutedForeground }}>CTA:</span> {b.cta_strategy}</p>}
                      </div>
                      {b.messaging_focus && <p className="text-sm mt-2" style={{ color: colors.foreground }}>{b.messaging_focus}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
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
  };
  const s = styles[level.toLowerCase()] || styles.moderate;
  return (
    <span className="text-xs px-2 py-0.5 rounded font-medium" style={{ backgroundColor: s.bg, color: s.color }}>
      {level}
    </span>
  );
}
