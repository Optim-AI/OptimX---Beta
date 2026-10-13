/**
 * Normalize Instagram media engagement into explicit zero vs unavailable.
 */

import {
  getInstagramMedia,
  getInstagramMediaInsights,
} from "@/integrations/meta/instagram";

export type MetricValue =
  | { available: true; value: number }
  | { available: false; value: null; reason?: string };

export type InstagramMediaEngagement = {
  mediaId: string;
  likeCount: MetricValue;
  commentsCount: MetricValue;
  insights: Record<string, MetricValue>;
  permalink?: string | null;
  mediaType?: string | null;
  caption?: string | null;
  timestamp?: string | null;
};

function metricFromNumber(n: unknown): MetricValue {
  if (typeof n === "number" && Number.isFinite(n)) {
    return { available: true, value: n };
  }
  return { available: false, value: null, reason: "field_omitted" };
}

function metricFromInsights(
  rows: Array<{ name: string; values?: Array<{ value: number }> }>,
  name: string
): MetricValue {
  const row = rows.find((r) => r.name === name);
  if (!row) {
    return { available: false, value: null, reason: "unavailable" };
  }
  const v = row.values?.[0]?.value;
  if (typeof v === "number" && Number.isFinite(v)) {
    return { available: true, value: v };
  }
  return { available: false, value: null, reason: "unavailable" };
}

export async function loadInstagramMediaEngagement(opts: {
  mediaId: string;
  accessToken: string;
  getMedia?: typeof getInstagramMedia;
  getInsights?: typeof getInstagramMediaInsights;
}): Promise<InstagramMediaEngagement> {
  const getMedia = opts.getMedia ?? getInstagramMedia;
  const getInsights = opts.getInsights ?? getInstagramMediaInsights;

  const media = await getMedia({
    mediaId: opts.mediaId,
    accessToken: opts.accessToken,
  });

  let insightRows: Array<{ name: string; values?: Array<{ value: number }> }> =
    [];
  try {
    const insights = await getInsights({
      mediaId: opts.mediaId,
      accessToken: opts.accessToken,
      metrics: ["likes", "comments", "reach", "saved", "shares", "views"],
    });
    insightRows = insights.data || [];
  } catch {
    insightRows = [];
  }

  const insightsMap: Record<string, MetricValue> = {
    likes: metricFromInsights(insightRows, "likes"),
    comments: metricFromInsights(insightRows, "comments"),
    reach: metricFromInsights(insightRows, "reach"),
    saved: metricFromInsights(insightRows, "saved"),
    shares: metricFromInsights(insightRows, "shares"),
    views: metricFromInsights(insightRows, "views"),
  };

  // Prefer media fields for like/comment counts; fall back to insights.
  const likeCount =
    metricFromNumber(media.like_count).available
      ? metricFromNumber(media.like_count)
      : insightsMap.likes;
  const commentsCount =
    metricFromNumber(media.comments_count).available
      ? metricFromNumber(media.comments_count)
      : insightsMap.comments;

  return {
    mediaId: media.id,
    likeCount,
    commentsCount,
    insights: insightsMap,
    permalink: media.permalink || null,
    mediaType: media.media_type || null,
    caption: media.caption || null,
    timestamp: media.timestamp || null,
  };
}
