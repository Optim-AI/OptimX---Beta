// pages/api/auth/instagram/debugAll.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { promises as fs } from "fs";
import path from "path";
const DATA_FILE = path.join(process.cwd(), "data", "instagram.json");
const VERSION = process.env.FACEBOOK_API_VERSION || "23.0";

function safeJsonParse(text: string) {
  try { return JSON.parse(text); } catch { return text; }
}

async function readSaved() {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf8");
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const saved = await readSaved();
    if (!saved) {
      return res.status(200).json({ ok: false, reason: "no_saved_file", message: `Missing or unreadable ${DATA_FILE}` });
    }

    const igUserId = saved.igUserId || null;
    const pageId = saved.pageId || null;
    const pageAccessToken = saved.pageAccessToken || null;
    const longUserToken = saved.longUserToken || null; // optional

    const result: any = {
      fileExists: true,
      file: {
        igUserId,
        pageId,
        hasPageAccessToken: !!pageAccessToken,
        hasLongUserToken: !!longUserToken,
        rawSaved: saved
      },
      checks: {}
    };

    // 1) Validate instagram_business_account by requesting the page object (if pageId+token exist)
    if (pageId && pageAccessToken) {
      const pageUrl = `https://graph.facebook.com/v${VERSION}/${encodeURIComponent(pageId)}?fields=instagram_business_account&access_token=${encodeURIComponent(pageAccessToken)}`;
      const pageRes = await fetch(pageUrl);
      const pageText = await pageRes.text();
      result.checks.pageInstagramBusiness = {
        status: pageRes.status,
        ok: pageRes.ok,
        body: safeJsonParse(pageText),
        urlCalled: pageUrl
      };
    } else {
      result.checks.pageInstagramBusiness = { skipped: true, reason: "missing pageId or pageAccessToken" };
    }

    // 2) Fetch IG media for igUserId using pageAccessToken
    if (igUserId && pageAccessToken) {
      const fields = ["id","caption","media_type","media_url","permalink","timestamp","like_count","comments_count"].join(",");
      const igMediaUrl = `https://graph.facebook.com/v${VERSION}/${encodeURIComponent(igUserId)}/media?fields=${encodeURIComponent(fields)}&access_token=${encodeURIComponent(pageAccessToken)}&limit=50`;
      const igRes = await fetch(igMediaUrl);
      const igText = await igRes.text();
      result.checks.igMedia = {
        status: igRes.status,
        ok: igRes.ok,
        body: safeJsonParse(igText),
        urlCalled: igMediaUrl
      };
    } else {
      result.checks.igMedia = { skipped: true, reason: "missing igUserId or pageAccessToken" };
    }

    // 3) If you have a recent publish id in saved (maybe you saved lastPublishId), fetch that media directly
    if (saved.lastPublishId && pageAccessToken) {
      const mediaId = saved.lastPublishId;
      const fields = ["id","caption","media_type","media_url","permalink","timestamp","like_count","comments_count"].join(",");
      const mediaUrl = `https://graph.facebook.com/v${VERSION}/${encodeURIComponent(mediaId)}?fields=${encodeURIComponent(fields)}&access_token=${encodeURIComponent(pageAccessToken)}`;
      const mRes = await fetch(mediaUrl);
      const mText = await mRes.text();
      result.checks.lastPublishId = {
        mediaId,
        status: mRes.status,
        ok: mRes.ok,
        body: safeJsonParse(mText),
        urlCalled: mediaUrl
      };
    } else {
      result.checks.lastPublishId = { skipped: true, reason: "no saved.lastPublishId in data file or missing page token" };
    }

    // 4) Fetch Page posts (in case you posted to page instead of IG)
    if (pageId && pageAccessToken) {
      const fields = ["id","message","created_time","permalink_url","full_picture","comments.summary(true)","reactions.summary(true)"].join(",");
      const pagePostsUrl = `https://graph.facebook.com/v${VERSION}/${encodeURIComponent(pageId)}/posts?fields=${encodeURIComponent(fields)}&access_token=${encodeURIComponent(pageAccessToken)}&limit=25`;
      const pRes = await fetch(pagePostsUrl);
      const pText = await pRes.text();
      result.checks.pagePosts = {
        status: pRes.status,
        ok: pRes.ok,
        body: safeJsonParse(pText),
        urlCalled: pagePostsUrl
      };
    } else {
      result.checks.pagePosts = { skipped: true, reason: "missing pageId or pageAccessToken" };
    }

    // 5) Check token debug if you have app secret available
    if (pageAccessToken && process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET) {
      const debugUrl = `https://graph.facebook.com/debug_token?input_token=${encodeURIComponent(pageAccessToken)}&access_token=${encodeURIComponent(`${process.env.FACEBOOK_APP_ID}|${process.env.FACEBOOK_APP_SECRET}`)}`;
      const dRes = await fetch(debugUrl);
      const dText = await dRes.text();
      result.checks.tokenDebug = {
        status: dRes.status,
        ok: dRes.ok,
        body: safeJsonParse(dText),
        urlCalled: debugUrl
      };
    } else {
      result.checks.tokenDebug = { skipped: true, reason: "missing page token or app credentials" };
    }

    // quick human verdict heuristics
    const verdict: string[] = [];
    const igMediaBody = result.checks.igMedia?.body;
    if (result.checks.igMedia?.ok && Array.isArray(igMediaBody?.data) && igMediaBody.data.length > 0) {
      verdict.push("IG media endpoint returned items ✅");
    } else if (result.checks.igMedia?.ok && Array.isArray(igMediaBody?.data) && igMediaBody.data.length === 0) {
      verdict.push("IG media returned empty array — likely you're looking at the correct IG user but it has no published media (or posts were published to the Page, not IG).");
    } else if (result.checks.igMedia?.ok === false) {
      verdict.push("IG media call failed — check Graph error in checks.igMedia.body (token/permissions/incorrect igUserId).");
    }

    const pageIg = result.checks.pageInstagramBusiness?.body?.instagram_business_account;
    if (pageIg) verdict.push(`Page is linked to IG account id ${pageIg.id} ✅`);
    else if (result.checks.pageInstagramBusiness?.ok === false) verdict.push("Page -> instagram_business_account lookup failed — token probably wrong / lacks permissions.");
    else verdict.push("Page -> instagram_business_account not available (page not linked to IG or missing token).");

    result.verdict = verdict;
    return res.status(200).json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("debugAll error:", err);
    return res.status(500).json({ error: message });
  }
}
