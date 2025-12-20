// lib/meta/ads.ts

const VERSION = process.env.FACEBOOK_API_VERSION || "23.0";

/**
 * Strip "act_" prefix from ad account ID if present
 */
function stripActPrefix(id?: string | null): string | null {
  if (!id) return null;
  return String(id).replace(/^act_/, "").replace(/^act_act_/, "");
}

/**
 * Ensure ad account ID has "act_" prefix for Graph API calls
 */
function ensureActPrefix(id?: string | null): string | null {
  if (!id) return null;
  const numeric = stripActPrefix(id);
  return `act_${numeric}`;
}

export type Campaign = {
  id: string;
  name?: string;
  objective?: string;
  status?: string;
  start_time?: string;
  stop_time?: string;
  daily_budget?: string;
  lifetime_budget?: string;
};

export type AdSet = {
  id: string;
  name?: string;
  status?: string;
  daily_budget?: string | null;
  lifetime_budget?: string | null;
  start_time?: string | null;
  end_time?: string | null;
};

export type Ad = {
  id: string;
  name?: string;
  status?: string;
  effective_status?: string;
};

export type AdInsights = {
  impressions?: number;
  clicks?: number;
  spend?: number;
  reach?: number;
  ctr?: number;
  cpc?: number;
  cpm?: number;
};

/**
 * Get campaigns for ad account
 */
export async function getCampaigns({
  adAccountId,
  accessToken,
  fields = "id,name,objective,status,start_time,stop_time,daily_budget,lifetime_budget",
  limit = 50,
}: {
  adAccountId: string;
  accessToken: string;
  fields?: string;
  limit?: number;
}): Promise<{ data: Campaign[] }> {
  const accountId = ensureActPrefix(adAccountId);
  if (!accountId) throw new Error("Invalid ad account ID");

  const url = `https://graph.facebook.com/v${VERSION}/${encodeURIComponent(accountId)}/campaigns?fields=${encodeURIComponent(fields)}&limit=${limit}&access_token=${encodeURIComponent(accessToken)}`;

  const response = await fetch(url);
  const json = await response.json();

  if (json.error) {
    throw new Error(`Failed to get campaigns: ${json.error.message || JSON.stringify(json.error)}`);
  }

  return json;
}

/**
 * Get ad sets for ad account or campaign
 */
export async function getAdSets({
  adAccountId,
  campaignId,
  accessToken,
  fields = "id,name,status,daily_budget,lifetime_budget,start_time,end_time",
  limit = 50,
}: {
  adAccountId?: string;
  campaignId?: string;
  accessToken: string;
  fields?: string;
  limit?: number;
}): Promise<{ data: AdSet[] }> {
  let parentId: string;

  if (campaignId) {
    parentId = campaignId;
  } else if (adAccountId) {
    const accountId = ensureActPrefix(adAccountId);
    if (!accountId) throw new Error("Invalid ad account ID");
    parentId = accountId;
  } else {
    throw new Error("Either adAccountId or campaignId must be provided");
  }

  const url = `https://graph.facebook.com/v${VERSION}/${encodeURIComponent(parentId)}/adsets?fields=${encodeURIComponent(fields)}&limit=${limit}&access_token=${encodeURIComponent(accessToken)}`;

  const response = await fetch(url);
  const json = await response.json();

  if (json.error) {
    throw new Error(`Failed to get ad sets: ${json.error.message || JSON.stringify(json.error)}`);
  }

  return json;
}

/**
 * Get ads for ad account, campaign, or ad set
 */
export async function getAds({
  adAccountId,
  campaignId,
  adSetId,
  accessToken,
  fields = "id,name,status,effective_status",
  limit = 50,
}: {
  adAccountId?: string;
  campaignId?: string;
  adSetId?: string;
  accessToken: string;
  fields?: string;
  limit?: number;
}): Promise<{ data: Ad[] }> {
  let parentId: string;

  if (adSetId) {
    parentId = adSetId;
  } else if (campaignId) {
    parentId = campaignId;
  } else if (adAccountId) {
    const accountId = ensureActPrefix(adAccountId);
    if (!accountId) throw new Error("Invalid ad account ID");
    parentId = accountId;
  } else {
    throw new Error("Either adAccountId, campaignId, or adSetId must be provided");
  }

  const url = `https://graph.facebook.com/v${VERSION}/${encodeURIComponent(parentId)}/ads?fields=${encodeURIComponent(fields)}&limit=${limit}&access_token=${encodeURIComponent(accessToken)}`;

  const response = await fetch(url);
  const json = await response.json();

  if (json.error) {
    throw new Error(`Failed to get ads: ${json.error.message || JSON.stringify(json.error)}`);
  }

  return json;
}

/**
 * Get insights for ad account, campaign, ad set, or ad
 */
export async function getInsights({
  objectId,
  accessToken,
  fields = "impressions,clicks,spend,reach,ctr,cpc,cpm",
  timeRange,
  level = "account",
  limit = 50,
}: {
  objectId: string;
  accessToken: string;
  fields?: string;
  timeRange?: { since: string; until: string };
  level?: "account" | "campaign" | "adset" | "ad";
  limit?: number;
}): Promise<{ data: AdInsights[] }> {
  let url = `https://graph.facebook.com/v${VERSION}/${encodeURIComponent(objectId)}/insights?fields=${encodeURIComponent(fields)}&level=${level}&limit=${limit}&access_token=${encodeURIComponent(accessToken)}`;

  if (timeRange) {
    url += `&time_range=${encodeURIComponent(JSON.stringify(timeRange))}`;
  }

  const response = await fetch(url);
  const json = await response.json();

  if (json.error) {
    throw new Error(`Failed to get insights: ${json.error.message || JSON.stringify(json.error)}`);
  }

  return json;
}

/**
 * Get leads from lead ads forms
 */
export async function getLeads({
  formId,
  accessToken,
  limit = 50,
}: {
  formId: string;
  accessToken: string;
  limit?: number;
}): Promise<{ data: any[] }> {
  const url = `https://graph.facebook.com/v${VERSION}/${encodeURIComponent(formId)}/leads?access_token=${encodeURIComponent(accessToken)}&limit=${limit}`;

  const response = await fetch(url);
  const json = await response.json();

  if (json.error) {
    throw new Error(`Failed to get leads: ${json.error.message || JSON.stringify(json.error)}`);
  }

  return json;
}

/**
 * Get all lead forms for ad account
 */
export async function getLeadForms({
  adAccountId,
  accessToken,
  limit = 50,
}: {
  adAccountId: string;
  accessToken: string;
  limit?: number;
}): Promise<{ data: any[] }> {
  const accountId = ensureActPrefix(adAccountId);
  if (!accountId) throw new Error("Invalid ad account ID");

  const url = `https://graph.facebook.com/v${VERSION}/${encodeURIComponent(accountId)}/leadgen_forms?access_token=${encodeURIComponent(accessToken)}&limit=${limit}`;

  const response = await fetch(url);
  const json = await response.json();

  if (json.error) {
    throw new Error(`Failed to get lead forms: ${json.error.message || JSON.stringify(json.error)}`);
  }

  return json;
}
