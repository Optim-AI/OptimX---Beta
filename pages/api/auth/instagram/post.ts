// pages/api/auth/instagram/post.ts

import type { NextApiRequest, NextApiResponse } from "next";
import { promises as fs } from "fs";
import path from "path";
const DATA_FILE = path.join(process.cwd(), "data", "instagram.json");
const version = process.env.FACEBOOK_API_VERSION || "23.0";

async function readSaved() {
  const raw = await fs.readFile(DATA_FILE, "utf8");
  return JSON.parse(raw);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end();
  const { image_url, caption, alsoPostToFacebook } = req.body;
  if (!image_url) return res.status(400).json({ error: "image_url required" });

  try {
    const saved = await readSaved();
    const igUserId = saved.igUserId;
    const pageAccessToken = saved.pageAccessToken;
    const pageId = saved.pageId;

    // 1) create media container on IG
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
      return res.status(400).json(createJson);
    }

    // 2) publish the container
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

    // 3) optionally post same to Facebook Page
    let fbPostResult = null;
    if (alsoPostToFacebook) {
      // for image post on Page
      const fbUrl = `https://graph.facebook.com/v${version}/${pageId}/photos`;
      const fbParams = new URLSearchParams({
        url: image_url,           // using the same image URL
        caption: caption || "",
        access_token: pageAccessToken,
      });
      const fbResp = await fetch(fbUrl, {
        method: "POST",
        body: fbParams,
      });
      fbPostResult = await fbResp.json();
    }

    return res.status(200).json({
      createJson,
      publishJson,
      fbPostResult,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "post failed", details: (err as any).toString() });
  }
}
