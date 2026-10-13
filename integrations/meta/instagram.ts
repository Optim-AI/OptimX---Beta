// integrations/meta/instagram.ts — Instagram Graph helpers (Facebook Login)

const VERSION = process.env.FACEBOOK_API_VERSION || "23.0";

export type InstagramPost = {
  id: string;
  caption?: string;
  media_type?: string;
  media_url?: string;
  permalink?: string;
  timestamp?: string;
  like_count?: number;
  comments_count?: number;
  thumbnail_url?: string;
};

export type InstagramComment = {
  id: string;
  text?: string;
  username?: string;
  timestamp?: string;
  hidden?: boolean;
  like_count?: number;
  replies?: { data?: InstagramComment[] };
};

export type ContainerStatusCode =
  | "EXPIRED"
  | "ERROR"
  | "FINISHED"
  | "IN_PROGRESS"
  | "PUBLISHED"
  | string;

function throwGraph(prefix: string, json: any): never {
  throw new Error(
    `${prefix}: ${json?.error?.message || JSON.stringify(json?.error || json)}`
  );
}

/**
 * Create Instagram media container (IMAGE feed post).
 */
export async function createInstagramMedia({
  igUserId,
  imageUrl,
  caption,
  accessToken,
}: {
  igUserId: string;
  imageUrl: string;
  caption?: string;
  accessToken: string;
}): Promise<{ id: string }> {
  const url = `https://graph.facebook.com/v${VERSION}/${encodeURIComponent(igUserId)}/media`;

  const params = new URLSearchParams({
    image_url: imageUrl,
    access_token: accessToken,
  });
  if (caption) params.append("caption", caption);

  const response = await fetch(url, { method: "POST", body: params });
  const json = await response.json();
  if (json.error) throwGraph("Instagram media creation failed", json);
  return json;
}

/**
 * Create Instagram REELS / video container.
 */
export async function createInstagramVideoMedia({
  igUserId,
  videoUrl,
  caption,
  accessToken,
  mediaType = "REELS",
  shareToFeed = true,
}: {
  igUserId: string;
  videoUrl: string;
  caption?: string;
  accessToken: string;
  mediaType?: "REELS" | "VIDEO";
  shareToFeed?: boolean;
}): Promise<{ id: string }> {
  const url = `https://graph.facebook.com/v${VERSION}/${encodeURIComponent(igUserId)}/media`;

  const params = new URLSearchParams({
    media_type: mediaType,
    video_url: videoUrl,
    access_token: accessToken,
  });
  if (caption) params.append("caption", caption);
  if (mediaType === "REELS") {
    params.append("share_to_feed", shareToFeed ? "true" : "false");
  }

  const response = await fetch(url, { method: "POST", body: params });
  const json = await response.json();
  if (json.error) throwGraph("Instagram video container creation failed", json);
  return json;
}

/**
 * Poll IG container status_code until FINISHED / ERROR / EXPIRED / timeout.
 */
export async function waitForInstagramContainerReady(opts: {
  containerId: string;
  accessToken: string;
  /** Max wait ms (default 90s) */
  timeoutMs?: number;
  /** Poll interval ms (default 2s) */
  intervalMs?: number;
  sleep?: (ms: number) => Promise<void>;
  fetchStatus?: typeof getInstagramContainerStatus;
}): Promise<{ statusCode: ContainerStatusCode; status?: string }> {
  const timeoutMs = opts.timeoutMs ?? 90_000;
  const intervalMs = opts.intervalMs ?? 2_000;
  const sleep =
    opts.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  const fetchStatus = opts.fetchStatus ?? getInstagramContainerStatus;
  const started = Date.now();

  let last: { statusCode: ContainerStatusCode; status?: string } = {
    statusCode: "IN_PROGRESS",
  };

  while (Date.now() - started < timeoutMs) {
    last = await fetchStatus({
      containerId: opts.containerId,
      accessToken: opts.accessToken,
    });
    const code = String(last.statusCode || "").toUpperCase();
    if (code === "FINISHED") return last;
    if (code === "ERROR" || code === "EXPIRED") {
      throw new Error(
        `Instagram media container ${code}${last.status ? `: ${last.status}` : ""}`
      );
    }
    if (code === "PUBLISHED") return last;
    await sleep(intervalMs);
  }

  throw new Error(
    `Instagram media container still ${last.statusCode} after ${timeoutMs}ms`
  );
}

export async function getInstagramContainerStatus({
  containerId,
  accessToken,
}: {
  containerId: string;
  accessToken: string;
}): Promise<{ statusCode: ContainerStatusCode; status?: string }> {
  const url =
    `https://graph.facebook.com/v${VERSION}/${encodeURIComponent(containerId)}` +
    `?fields=status_code,status` +
    `&access_token=${encodeURIComponent(accessToken)}`;
  const response = await fetch(url);
  const json = await response.json();
  if (json.error) throwGraph("Failed to get Instagram container status", json);
  return {
    statusCode: json.status_code || "IN_PROGRESS",
    status: json.status,
  };
}

/**
 * Publish Instagram media container.
 */
export async function publishInstagramMedia({
  igUserId,
  creationId,
  accessToken,
}: {
  igUserId: string;
  creationId: string;
  accessToken: string;
}): Promise<{ id: string }> {
  const url = `https://graph.facebook.com/v${VERSION}/${encodeURIComponent(igUserId)}/media_publish`;

  const params = new URLSearchParams({
    creation_id: creationId,
    access_token: accessToken,
  });

  const response = await fetch(url, { method: "POST", body: params });
  const json = await response.json();
  if (json.error) throwGraph("Instagram media publish failed", json);
  return json;
}

export async function getInstagramPosts({
  igUserId,
  accessToken,
  limit = 25,
  after,
}: {
  igUserId: string;
  accessToken: string;
  limit?: number;
  after?: string;
}): Promise<{ data: InstagramPost[]; paging?: { cursors?: { after?: string }; next?: string } }> {
  const fields =
    "id,caption,media_type,media_url,permalink,timestamp,like_count,comments_count,thumbnail_url";
  let url =
    `https://graph.facebook.com/v${VERSION}/${encodeURIComponent(igUserId)}/media` +
    `?fields=${encodeURIComponent(fields)}` +
    `&limit=${Math.min(Math.max(limit, 1), 50)}` +
    `&access_token=${encodeURIComponent(accessToken)}`;
  if (after) url += `&after=${encodeURIComponent(after)}`;

  const response = await fetch(url);
  const json = await response.json();
  if (json.error) throwGraph("Failed to get Instagram posts", json);
  return json;
}

export async function getInstagramMedia({
  mediaId,
  accessToken,
}: {
  mediaId: string;
  accessToken: string;
}): Promise<InstagramPost> {
  const fields =
    "id,caption,media_type,media_url,permalink,timestamp,like_count,comments_count,thumbnail_url";
  const url =
    `https://graph.facebook.com/v${VERSION}/${encodeURIComponent(mediaId)}` +
    `?fields=${encodeURIComponent(fields)}` +
    `&access_token=${encodeURIComponent(accessToken)}`;
  const response = await fetch(url);
  const json = await response.json();
  if (json.error) throwGraph("Failed to get Instagram media", json);
  return json;
}

export async function deleteInstagramMedia({
  mediaId,
  accessToken,
}: {
  mediaId: string;
  accessToken: string;
}): Promise<{ success: boolean }> {
  const url = `https://graph.facebook.com/v${VERSION}/${encodeURIComponent(mediaId)}?access_token=${encodeURIComponent(accessToken)}`;
  const response = await fetch(url, { method: "DELETE" });
  const json = await response.json();
  if (json.error) throwGraph("Failed to delete Instagram media", json);
  return json;
}

export async function getInstagramComments({
  mediaId,
  accessToken,
  after,
  limit = 25,
}: {
  mediaId: string;
  accessToken: string;
  after?: string;
  limit?: number;
}): Promise<{
  data: InstagramComment[];
  paging?: { cursors?: { after?: string }; next?: string };
}> {
  const fields = "id,text,username,timestamp,hidden,like_count,replies{id,text,username,timestamp}";
  let url =
    `https://graph.facebook.com/v${VERSION}/${encodeURIComponent(mediaId)}/comments` +
    `?fields=${encodeURIComponent(fields)}` +
    `&limit=${Math.min(Math.max(limit, 1), 50)}` +
    `&access_token=${encodeURIComponent(accessToken)}`;
  if (after) url += `&after=${encodeURIComponent(after)}`;

  const response = await fetch(url);
  const json = await response.json();
  if (json.error) throwGraph("Failed to get Instagram comments", json);
  return json;
}

export async function postInstagramComment({
  mediaId,
  message,
  accessToken,
}: {
  mediaId: string;
  message: string;
  accessToken: string;
}): Promise<{ id: string }> {
  const url = `https://graph.facebook.com/v${VERSION}/${encodeURIComponent(mediaId)}/comments`;
  const params = new URLSearchParams({
    message,
    access_token: accessToken,
  });
  const response = await fetch(url, { method: "POST", body: params });
  const json = await response.json();
  if (json.error) throwGraph("Failed to post Instagram comment", json);
  return json;
}

/** Reply to a comment (POST /{comment-id}/replies). */
export async function replyToInstagramComment({
  commentId,
  message,
  accessToken,
}: {
  commentId: string;
  message: string;
  accessToken: string;
}): Promise<{ id: string }> {
  const url = `https://graph.facebook.com/v${VERSION}/${encodeURIComponent(commentId)}/replies`;
  const params = new URLSearchParams({
    message,
    access_token: accessToken,
  });
  const response = await fetch(url, { method: "POST", body: params });
  const json = await response.json();
  if (json.error) throwGraph("Failed to reply to Instagram comment", json);
  return json;
}

/** Hide/unhide a comment when supported. */
export async function setInstagramCommentHidden({
  commentId,
  hide,
  accessToken,
}: {
  commentId: string;
  hide: boolean;
  accessToken: string;
}): Promise<{ success?: boolean }> {
  const url = `https://graph.facebook.com/v${VERSION}/${encodeURIComponent(commentId)}`;
  const params = new URLSearchParams({
    hide: hide ? "true" : "false",
    access_token: accessToken,
  });
  const response = await fetch(url, { method: "POST", body: params });
  const json = await response.json();
  if (json.error) throwGraph("Failed to update Instagram comment visibility", json);
  return json;
}

/**
 * Read media insights. Empty data means unavailable (not zero).
 */
export async function getInstagramMediaInsights({
  mediaId,
  accessToken,
  metrics,
}: {
  mediaId: string;
  accessToken: string;
  metrics?: string[];
}): Promise<{
  data: Array<{
    name: string;
    period?: string;
    values?: Array<{ value: number }>;
    title?: string;
    description?: string;
  }>;
}> {
  const metricList = (metrics || ["likes", "comments", "reach", "saved"]).join(
    ","
  );
  const url =
    `https://graph.facebook.com/v${VERSION}/${encodeURIComponent(mediaId)}/insights` +
    `?metric=${encodeURIComponent(metricList)}` +
    `&access_token=${encodeURIComponent(accessToken)}`;
  const response = await fetch(url);
  const json = await response.json();
  if (json.error) {
    // Some metrics unavailable for media type — surface as empty rather than crash callers
    if (
      /invalid metric|metric.*not.*available|does not support/i.test(
        String(json.error.message || "")
      )
    ) {
      return { data: [] };
    }
    throwGraph("Failed to get Instagram insights", json);
  }
  return { data: Array.isArray(json.data) ? json.data : [] };
}
