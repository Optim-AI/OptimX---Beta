// pages/api/uploadImage.ts
import type { NextApiRequest, NextApiResponse } from "next";
import formidable from "formidable";
import fs from "fs";
import path from "path";
import FormData from "form-data";

export const config = { api: { bodyParser: false } };

const DATA_FILE = path.join(process.cwd(), "data", "instagram.json");
const version = process.env.FACEBOOK_API_VERSION || "23.0";
const GRAPH_BASE = `https://graph.facebook.com/v${version}`;

async function readSaved() {
  try {
    const raw = await fs.promises.readFile(DATA_FILE, "utf8");
    return JSON.parse(raw);
  } catch (e) {
    return {};
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const form = new formidable.IncomingForm();
  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error("form parse err", err);
      return res.status(500).json({ error: String(err) });
    }

    try {
      const file = (files as any).image as formidable.File | undefined;
      if (!file) return res.status(400).json({ error: "No file uploaded (field 'image')" });

      // Read credentials (same pattern as your post endpoint)
      const saved = await readSaved();
      const pageAccessToken = process.env.FB_PAGE_ACCESS_TOKEN || saved.pageAccessToken;
      const pageId = process.env.FB_PAGE_ID || saved.pageId;

      if (!pageAccessToken || !pageId) {
        return res.status(400).json({
          error:
            "Missing pageAccessToken or pageId. Put them in data/instagram.json or set FB_PAGE_ACCESS_TOKEN & FB_PAGE_ID env vars.",
        });
      }

      // read file buffer
      const buffer = await fs.promises.readFile(file.filepath);

      // upload to FB page photos (multipart)
      const uploadForm = new FormData();
      uploadForm.append("source", buffer, { filename: file.originalFilename || "upload.jpg" });
      uploadForm.append("published", "false"); // host image but don't publish on page feed

      const uploadUrl = `${GRAPH_BASE}/${pageId}/photos?access_token=${encodeURIComponent(pageAccessToken)}`;

      const fetchResp = await fetch(uploadUrl, {
        method: "POST",
        headers: uploadForm.getHeaders(),
        body: uploadForm as any,
      });

      const uploadJson = await fetchResp.json();

      if (!fetchResp.ok) {
        console.error("FB upload error", uploadJson);
        return res.status(500).json({ error: "Failed uploading to Page", details: uploadJson });
      }

      const photoId = uploadJson.id;
      if (!photoId) {
        return res.status(500).json({ error: "No photo id returned from FB", raw: uploadJson });
      }

      // fetch the hosted image URL
      const photoInfoResp = await fetch(
        `${GRAPH_BASE}/${photoId}?fields=images&access_token=${encodeURIComponent(pageAccessToken)}`
      );
      const photoInfo = await photoInfoResp.json();

      if (!photoInfoResp.ok) {
        console.error("photoInfo fetch failed", photoInfo);
        return res.status(500).json({ error: "Failed to fetch photo info", details: photoInfo });
      }

      const hostedUrl = photoInfo?.images?.[0]?.source;
      if (!hostedUrl) {
        return res.status(500).json({ error: "Hosted URL not found in photoInfo", raw: photoInfo });
      }

      return res.status(200).json({
        success: true,
        photoId,
        hostedUrl,
        raw: { uploadJson, photoInfo },
      });
    } catch (e: any) {
      console.error("uploadImage handler err", e);
      return res.status(500).json({ error: String(e) });
    }
  });
}
