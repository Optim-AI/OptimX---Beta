// lib/meta/instagram.ts

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
};

export type InstagramComment = {
  id: string;
  text?: string;
  username?: string;
  timestamp?: string;
};

/**
 * Create Instagram media container (step 1 of posting)
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

  if (caption) {
    params.append("caption", caption);
  }

  const response = await fetch(url, {
    method: "POST",
    body: params,
  });

  const json = await response.json();

  if (json.error) {
    throw new Error(`Instagram media creation failed: ${json.error.message || JSON.stringify(json.error)}`);
  }

  return json;
}

/**
 * Publish Instagram media container (step 2 of posting)
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

  const response = await fetch(url, {
    method: "POST",
    body: params,
  });

  const json = await response.json();

  if (json.error) {
    throw new Error(`Instagram media publish failed: ${json.error.message || JSON.stringify(json.error)}`);
  }

  return json;
}

/**
 * Get Instagram posts for a user
 */
export async function getInstagramPosts({
  igUserId,
  accessToken,
  limit = 25,
}: {
  igUserId: string;
  accessToken: string;
  limit?: number;
}): Promise<{ data: InstagramPost[] }> {
  const fields = "id,caption,media_type,media_url,permalink,timestamp,like_count,comments_count";
  const url = `https://graph.facebook.com/v${VERSION}/${encodeURIComponent(igUserId)}/media?fields=${encodeURIComponent(fields)}&limit=${limit}&access_token=${encodeURIComponent(accessToken)}`;

  const response = await fetch(url);
  const json = await response.json();

  if (json.error) {
    throw new Error(`Failed to get Instagram posts: ${json.error.message || JSON.stringify(json.error)}`);
  }

  return json;
}

/**
 * Get single Instagram media item
 */
export async function getInstagramMedia({
  mediaId,
  accessToken,
}: {
  mediaId: string;
  accessToken: string;
}): Promise<InstagramPost> {
  const fields = "id,caption,media_type,media_url,permalink,timestamp,like_count,comments_count";
  const url = `https://graph.facebook.com/v${VERSION}/${encodeURIComponent(mediaId)}?fields=${encodeURIComponent(fields)}&access_token=${encodeURIComponent(accessToken)}`;

  const response = await fetch(url);
  const json = await response.json();

  if (json.error) {
    throw new Error(`Failed to get Instagram media: ${json.error.message || JSON.stringify(json.error)}`);
  }

  return json;
}

/**
 * Delete Instagram media
 */
export async function deleteInstagramMedia({
  mediaId,
  accessToken,
}: {
  mediaId: string;
  accessToken: string;
}): Promise<{ success: boolean }> {
  const url = `https://graph.facebook.com/v${VERSION}/${encodeURIComponent(mediaId)}?access_token=${encodeURIComponent(accessToken)}`;

  const response = await fetch(url, {
    method: "DELETE",
  });

  const json = await response.json();

  if (json.error) {
    throw new Error(`Failed to delete Instagram media: ${json.error.message || JSON.stringify(json.error)}`);
  }

  return json;
}

/**
 * Get comments on an Instagram post
 */
export async function getInstagramComments({
  mediaId,
  accessToken,
}: {
  mediaId: string;
  accessToken: string;
}): Promise<{ data: InstagramComment[] }> {
  const url = `https://graph.facebook.com/v${VERSION}/${encodeURIComponent(mediaId)}/comments?access_token=${encodeURIComponent(accessToken)}`;

  const response = await fetch(url);
  const json = await response.json();

  if (json.error) {
    throw new Error(`Failed to get Instagram comments: ${json.error.message || JSON.stringify(json.error)}`);
  }

  return json;
}

/**
 * Post a comment on Instagram media
 */
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

  const response = await fetch(url, {
    method: "POST",
    body: params,
  });

  const json = await response.json();

  if (json.error) {
    throw new Error(`Failed to post Instagram comment: ${json.error.message || JSON.stringify(json.error)}`);
  }

  return json;
}
