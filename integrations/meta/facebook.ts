// lib/meta/facebook.ts

const VERSION = process.env.FACEBOOK_API_VERSION || "23.0";

export type FacebookPost = {
  id: string;
  message?: string;
  created_time?: string;
  permalink_url?: string;
  full_picture?: string;
  comments?: { summary: { total_count: number } };
  reactions?: { summary: { total_count: number } };
};

export type FacebookComment = {
  id: string;
  message?: string;
  created_time?: string;
  from?: { name: string; id: string };
};

export type CreateFacebookPostInput = {
  pageId: string;
  message?: string;
  /** Public HTTPS URL for Meta to fetch (never localhost). */
  imageUrl?: string;
  /** Raw image bytes for multipart `source` upload. */
  imageBuffer?: Buffer | Uint8Array;
  imageContentType?: string;
  imageFilename?: string;
  link?: string;
  accessToken: string;
};

/**
 * Create a Facebook Page post with text and/or image.
 * Photos: use multipart `source` when `imageBuffer` is set; otherwise `url`.
 */
export async function createFacebookPost({
  pageId,
  message,
  imageUrl,
  imageBuffer,
  imageContentType,
  imageFilename,
  link,
  accessToken,
}: CreateFacebookPostInput): Promise<{ id: string; post_id?: string }> {
  const hasMultipart = Boolean(imageBuffer && imageBuffer.byteLength > 0);
  const hasUrl = Boolean(imageUrl);
  const endpoint = hasMultipart || hasUrl ? "photos" : "feed";
  const url = `https://graph.facebook.com/v${VERSION}/${encodeURIComponent(pageId)}/${endpoint}`;

  if (hasMultipart) {
    const form = new FormData();
    form.append("access_token", accessToken);
    if (message) form.append("caption", message);
    const mime = imageContentType || "application/octet-stream";
    const name = imageFilename || "photo.jpg";
    const bytes =
      imageBuffer instanceof Buffer
        ? imageBuffer
        : Buffer.from(imageBuffer as Uint8Array);
    form.append(
      "source",
      new Blob([new Uint8Array(bytes)], { type: mime }),
      name
    );

    const response = await fetch(url, {
      method: "POST",
      body: form,
    });
    const json = await response.json();
    if (json.error) {
      throw new Error(
        `Facebook post creation failed: ${json.error.message || JSON.stringify(json.error)}`
      );
    }
    return json;
  }

  const params = new URLSearchParams({
    access_token: accessToken,
  });

  if (imageUrl) {
    params.append("url", imageUrl);
    if (message) params.append("caption", message);
  } else {
    if (message) params.append("message", message);
    if (link) params.append("link", link);
  }

  const response = await fetch(url, {
    method: "POST",
    body: params,
  });

  const json = await response.json();

  if (json.error) {
    throw new Error(
      `Facebook post creation failed: ${json.error.message || JSON.stringify(json.error)}`
    );
  }

  return json;
}

/**
 * Get Facebook Page posts
 */
export async function getFacebookPosts({
  pageId,
  accessToken,
  limit = 25,
}: {
  pageId: string;
  accessToken: string;
  limit?: number;
}): Promise<{ data: FacebookPost[] }> {
  const fields = [
    "id",
    "message",
    "created_time",
    "permalink_url",
    "full_picture",
    "comments.summary(true)",
    "reactions.summary(true)",
  ].join(",");

  const url = `https://graph.facebook.com/v${VERSION}/${encodeURIComponent(pageId)}/posts?fields=${encodeURIComponent(fields)}&access_token=${encodeURIComponent(accessToken)}&limit=${limit}`;

  const response = await fetch(url);
  const json = await response.json();

  if (json.error) {
    throw new Error(`Failed to get Facebook posts: ${json.error.message || JSON.stringify(json.error)}`);
  }

  return json;
}

/**
 * Get single Facebook post
 */
export async function getFacebookPost({
  postId,
  accessToken,
}: {
  postId: string;
  accessToken: string;
}): Promise<FacebookPost> {
  const fields = [
    "id",
    "message",
    "created_time",
    "permalink_url",
    "full_picture",
    "comments.summary(true)",
    "reactions.summary(true)",
  ].join(",");

  const url = `https://graph.facebook.com/v${VERSION}/${encodeURIComponent(postId)}?fields=${encodeURIComponent(fields)}&access_token=${encodeURIComponent(accessToken)}`;

  const response = await fetch(url);
  const json = await response.json();

  if (json.error) {
    throw new Error(`Failed to get Facebook post: ${json.error.message || JSON.stringify(json.error)}`);
  }

  return json;
}

/**
 * Delete Facebook post
 */
export async function deleteFacebookPost({
  postId,
  accessToken,
}: {
  postId: string;
  accessToken: string;
}): Promise<{ success: boolean }> {
  const url = `https://graph.facebook.com/v${VERSION}/${encodeURIComponent(postId)}?access_token=${encodeURIComponent(accessToken)}`;

  const response = await fetch(url, {
    method: "DELETE",
  });

  const json = await response.json();

  if (json.error) {
    throw new Error(`Failed to delete Facebook post: ${json.error.message || JSON.stringify(json.error)}`);
  }

  return json;
}

/**
 * Get comments on a Facebook post
 */
export async function getFacebookComments({
  postId,
  accessToken,
  limit = 25,
}: {
  postId: string;
  accessToken: string;
  limit?: number;
}): Promise<{ data: FacebookComment[] }> {
  const url = `https://graph.facebook.com/v${VERSION}/${encodeURIComponent(postId)}/comments?access_token=${encodeURIComponent(accessToken)}&limit=${limit}`;

  const response = await fetch(url);
  const json = await response.json();

  if (json.error) {
    throw new Error(`Failed to get Facebook comments: ${json.error.message || JSON.stringify(json.error)}`);
  }

  return json;
}

/**
 * Post a comment on Facebook post
 */
export async function postFacebookComment({
  postId,
  message,
  accessToken,
}: {
  postId: string;
  message: string;
  accessToken: string;
}): Promise<{ id: string }> {
  const url = `https://graph.facebook.com/v${VERSION}/${encodeURIComponent(postId)}/comments`;

  const params = new URLSearchParams({
    message,
    access_token: accessToken,
  });

  const response = await fetch(url, {
    method: "POST",
    body: params,
  });

  const json = await response.json();

  if (json.error) {
    throw new Error(`Failed to post Facebook comment: ${json.error.message || JSON.stringify(json.error)}`);
  }

  return json;
}

/**
 * Get Facebook Page insights
 */
export async function getPageInsights({
  pageId,
  accessToken,
  metrics = ["page_impressions", "page_engaged_users", "page_post_engagements"],
  period = "day",
}: {
  pageId: string;
  accessToken: string;
  metrics?: string[];
  period?: "day" | "week" | "days_28";
}): Promise<{ data: any[] }> {
  const metricsStr = metrics.join(",");
  const url = `https://graph.facebook.com/v${VERSION}/${encodeURIComponent(pageId)}/insights?metric=${encodeURIComponent(metricsStr)}&period=${period}&access_token=${encodeURIComponent(accessToken)}`;

  const response = await fetch(url);
  const json = await response.json();

  if (json.error) {
    throw new Error(`Failed to get Page insights: ${json.error.message || JSON.stringify(json.error)}`);
  }

  return json;
}
