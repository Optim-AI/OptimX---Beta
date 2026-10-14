/**
 * Free marketing audit — shared shapes for API, persistence, and UI.
 * "Observed" data comes from a fetched page or provider response and carries a
 * source id. "Interpretation" is AI reasoning over that evidence.
 */

export type AuditStatus = 'queued' | 'running' | 'completed' | 'partial' | 'failed';

export const AUDIT_STAGES = ['site', 'brand', 'competitors', 'posts', 'analysis'] as const;
export type AuditStageName = (typeof AUDIT_STAGES)[number];
export type AuditStage = 'queued' | AuditStageName;

export type SourceKind = 'website' | 'search_result' | 'ad_library' | 'social_post';

export type SourceRef = {
  id: string;
  kind: SourceKind;
  url: string;
  title: string | null;
  provider: 'website' | 'searchapi' | 'serpapi' | 'meta_ad_library' | 'google_ads';
  publishedAt: string | null;
  retrievedAt: string;
};

export type SiteSnapshot = {
  requestedUrl: string;
  finalUrl: string;
  title: string;
  description: string;
  headings: string[];
  excerpt: string;
  socialLinks: { facebook: string | null; instagram: string | null };
  retrievedAt: string;
  sourceId: string;
};

export type ObservedFact = { label: string; value: string; sourceId: string };

export type AuditBrand = {
  name: string;
  facts: ObservedFact[];
  interpretation: {
    products: string[];
    niche: string;
    industry: string;
    productCategory: string;
    positioning: string;
    audience: string;
    tone: string;
    country: string;
    searchKeywords: string[];
  };
  confidence: 'high' | 'medium' | 'low';
  basis: 'ai' | 'metadata_only';
};

export type CompetitorClassification = 'direct' | 'adjacent';

export type AuditCompetitor = {
  id: string;
  name: string;
  domain: string;
  url: string;
  snippet: string;
  sourceId: string;
  selectedBy: 'ai_from_search_results' | 'search_heuristic';
  /** Direct = same category & audience; adjacent = related but not 1:1. */
  classification?: CompetitorClassification;
  /** Short evidence-backed reason this brand competes. */
  overlapReason?: string;
  confidence?: 'high' | 'medium' | 'low';
};

export type EngagementSignal = {
  likes?: number;
  comments?: number;
  views?: number;
};

export type CompetitorPost = {
  id: string;
  competitorId: string;
  competitorName: string;
  platform: 'instagram' | 'facebook' | 'meta_ads' | 'google_ads';
  kind: 'organic_post' | 'ad';
  url: string;
  text: string;
  publishedAt: string | null;
  publishedLabel: string | null;
  engagement: EngagementSignal | null;
  engagementSource: 'search_snippet' | null;
  sourceId: string;
};

export type InsightBasis = 'evidence' | 'inference';

export type AuditTheme = {
  title: string;
  observation: string;
  evidenceIds: string[];
  basis: InsightBasis;
};

export type AuditOpportunity = {
  title: string;
  explanation: string;
  evidenceIds: string[];
  basis: InsightBasis;
};

export type EngagementHighlight = {
  postId: string;
  competitorName: string;
  platform: CompetitorPost['platform'];
  url: string;
  engagement: EngagementSignal;
  publishedAt: string | null;
};

export type AuditInsights = {
  summary: string;
  themes: AuditTheme[];
  opportunities: AuditOpportunity[];
  engagementHighlights: EngagementHighlight[];
  generatedBy: 'ai' | 'fallback';
};

export const IDEA_FORMATS = [
  'Static post',
  'Carousel',
  'Reel / short video',
  'Story',
] as const;
export type IdeaFormat = (typeof IDEA_FORMATS)[number];

export type ContentIdea = {
  title: string;
  hook: string;
  brief: string;
  format: IdeaFormat;
  audience: string;
  rationale: string;
  cta: string;
  evidenceIds: string[];
  studio: 'poster' | 'video';
};

export type AuditLimitation = { code: string; message: string };

export type AuditStageProgress = {
  stage: AuditStage;
  completed: AuditStageName[];
};

export type PublicAudit = {
  id: string;
  websiteUrl: string;
  host: string;
  status: AuditStatus;
  stage: AuditStage;
  progress: AuditStageProgress;
  canRetry: boolean;
  site: Pick<SiteSnapshot, 'finalUrl' | 'title' | 'description' | 'retrievedAt'> | null;
  brand: AuditBrand | null;
  competitors: AuditCompetitor[];
  competitorPosts: CompetitorPost[];
  insights: AuditInsights | null;
  ideas: ContentIdea[];
  sources: SourceRef[];
  limitations: AuditLimitation[];
  selectedIdeaIndex: number | null;
  campaignSessionId: string | null;
  error: { code: string; message: string } | null;
  ownedByGuest: boolean;
  createdAt: string | null;
  completedAt: string | null;
};
