// pages/api/auth/instagram/login.ts
import type { NextApiRequest, NextApiResponse } from "next";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const appId = process.env.FACEBOOK_APP_ID!;
  const version = process.env.FACEBOOK_API_VERSION || "23.0";
  const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/instagram/callback`;

  // NOTE: expanded scopes required for reading posts/comments/likes and managing comments
  const scopes = [
    "instagram_basic",
    "instagram_content_publish",      // publishing posts
    "pages_show_list",                 // list pages user admin of
    "pages_read_engagement",           // read page engagement (likes/comments)
    "pages_read_user_content",         // read user-generated content on pages
    "pages_manage_posts",              // manage page posts (delete)
    "instagram_manage_comments",       // manage IG comments (post/delete) — may require review
    "leads_retrieval"
    // "instagram_manage_insights"        // optional: get insights
  ].join(",");

  // minimal state — in production use a secure random value and save in session
  const state = "optm_state_" + Math.random().toString(36).slice(2, 9);

  const oauth = `https://www.facebook.com/v${version}/dialog/oauth` +
    `?client_id=${encodeURIComponent(appId)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&scope=${encodeURIComponent(scopes)}` +
    `&response_type=code` +
    `&state=${encodeURIComponent(state)}`;

  res.redirect(oauth);
}
