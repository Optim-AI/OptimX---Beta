/**
 * Maps an audit idea onto a draft Creative Studio session. Creating a session
 * grants nothing: generation inside the studio stays gated by plan credits.
 */

import type { AuditBrand, ContentIdea } from './types';

export type CampaignSessionPayload = {
  userId: string;
  name: string;
  sessionType: 'poster' | 'video';
  brandSnapshot: Record<string, unknown>;
  phase?: string;
  posterPrompt?: string;
  adBuilderData?: Record<string, unknown>;
};

export function auditBrandSnapshot(brand: AuditBrand | null, websiteUrl: string, host: string) {
  const i = brand?.interpretation;
  const description =
    i?.positioning || brand?.facts.find((f) => f.label === 'Meta description')?.value || '';
  return {
    name: brand?.name || host,
    description,
    audience: i?.audience || '',
    offering: i?.products.join(', ') || i?.productCategory || '',
    tone: i?.tone || 'professional',
    industry: i?.industry || undefined,
    productCategory: i?.productCategory || undefined,
    business_overview: description || undefined,
    website_url: websiteUrl,
  };
}

export function ideaToCreativeDirection(idea: ContentIdea): string {
  return [
    `Campaign idea: ${idea.title}`,
    `Hook: ${idea.hook}`,
    `Creative brief: ${idea.brief}`,
    `Format: ${idea.format}`,
    `Audience: ${idea.audience}`,
    `Call to action: ${idea.cta}`,
  ].join('\n');
}

export function buildCampaignSessionPayload(input: {
  userId: string;
  idea: ContentIdea;
  brand: AuditBrand | null;
  websiteUrl: string;
  host: string;
  defaultAdBuilderData: Record<string, unknown>;
}): CampaignSessionPayload {
  const { idea } = input;
  const brandSnapshot = auditBrandSnapshot(input.brand, input.websiteUrl, input.host);
  const name = `${idea.title}`.slice(0, 90);
  if (idea.studio === 'video') {
    return {
      userId: input.userId,
      name,
      sessionType: 'video',
      brandSnapshot,
      adBuilderData: {
        ...input.defaultAdBuilderData,
        userDescription: ideaToCreativeDirection(idea),
      },
    };
  }
  return {
    userId: input.userId,
    name,
    sessionType: 'poster',
    brandSnapshot,
    phase: 'brand-review',
    posterPrompt: ideaToCreativeDirection(idea),
  };
}

export function campaignPath(sessionType: 'poster' | 'video', sessionId: string) {
  return `/brand-studio/${sessionType}?id=${encodeURIComponent(sessionId)}`;
}
