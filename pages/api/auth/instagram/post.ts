// pages/api/auth/instagram/post.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { readSavedIntegration } from "../../../../lib/integrationStore";

const version = process.env.FACEBOOK_API_VERSION || "23.0";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<void> {
  if (req.method !== "POST") {
    res.status(405).end();
    return;
  }
  const { image_url, caption, alsoPostToFacebook } = req.body;
  if (!image_url) {
    res.status(400).json({ error: "image_url required" });
    return;
  }

  try {
    const saved = await readSavedIntegration({ provider: "meta" });
    if (!saved) return res.status(500).json({ error: "Missing integration in Supabase" });

    const igUserId = saved.igUserId;
    const pageAccessToken = saved.pageAccessToken;
    const pageId = saved.pageId;

    if (!igUserId || !pageAccessToken) {
      return res.status(500).json({ error: "Missing igUserId or pageAccessToken" });
    }

    const createUrl = `https://graph.facebook.com/v${version}/${igUserId}/media`;
    const createParams = new URLSearchParams({
      image_url,
      caption: caption || "",
      access_token: pageAccessToken,
    });
    const createResp = await fetch(createUrl, {
      method: "POST",
      body: createParams,
    });
    const createJson = await createResp.json();
    if (createJson.error) {
      res.status(400).json(createJson);
      return;
    }

    const creationId = createJson.id;
    const publishUrl = `https://graph.facebook.com/v${version}/${igUserId}/media_publish`;
    const publishParams = new URLSearchParams({
      creation_id: creationId,
      access_token: pageAccessToken,
    });
    const publishResp = await fetch(publishUrl, {
      method: "POST",
      body: publishParams,
    });
    const publishJson = await publishResp.json();

    let fbPostResult = null;
    if (alsoPostToFacebook && pageId) {
      const fbUrl = `https://graph.facebook.com/v${version}/${pageId}/photos`;
      const fbParams = new URLSearchParams({
        url: image_url,
        caption: caption || "",
        access_token: pageAccessToken,
      });
      const fbResp = await fetch(fbUrl, {
        method: "POST",
        body: fbParams,
      });
      fbPostResult = await fbResp.json();
    }

    res.status(200).json({
      createJson,
      publishJson,
      fbPostResult,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "post failed", details: (err as any).toString() });
  }
}
