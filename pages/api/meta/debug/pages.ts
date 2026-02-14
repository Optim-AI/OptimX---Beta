// pages/api/meta/debug/pages.ts
import type { NextApiRequest, NextApiResponse } from "next";
import { getUserIdFromRequest } from '@/auth/request';
import { supabaseAdmin } from '@/auth/supabase/client';

const VERSION = process.env.FACEBOOK_API_VERSION || "23.0";

/**
 * Debug endpoint to see what Facebook is returning for pages
 * GET /api/meta/debug/pages
 * Development only - returns integration details
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ error: 'Not found' });
  }
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const userId = await getUserIdFromRequest(req);
    if (!userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    // Get Meta integration
    const { data: integration, error } = await supabaseAdmin
      .from('integrations')
      .select('*')
      .eq('user_id', userId)
      .eq('platform', 'meta')
      .single();

    if (error || !integration) {
      return res.status(404).json({ error: "Meta integration not found" });
    }

    const userAccessToken = integration.user_access_token;
    if (!userAccessToken) {
      return res.status(400).json({ error: "No user access token found" });
    }

    // Call Facebook API - same as OAuth callback
    const pagesUrl = `https://graph.facebook.com/v${VERSION}/me/accounts?fields=id,name,category,access_token,tasks,instagram_business_account&access_token=${encodeURIComponent(userAccessToken)}`;

    console.log('Fetching pages from Facebook...');
    const pagesResp = await fetch(pagesUrl);
    const pagesJson = await pagesResp.json();

    if (pagesJson.error) {
      return res.status(500).json({
        error: 'Facebook API error',
        details: pagesJson.error
      });
    }

    // Return detailed debug info
    return res.status(200).json({
      success: true,
      totalPages: pagesJson.data?.length || 0,
      pages: pagesJson.data || [],
      currentIntegration: {
        pageId: integration.page_id,
        pageName: integration.page_name,
        igUserId: integration.ig_user_id,
        igUsername: integration.ig_username,
        hasInstagram: integration.has_instagram,
        hasFacebook: integration.has_facebook,
      },
      debug: {
        apiVersion: VERSION,
        tokenPresent: !!userAccessToken,
        tokenLength: userAccessToken?.length,
      }
    });
  } catch (err: any) {
    console.error('Debug pages error:', err);
    return res.status(500).json({
      error: err.message || 'Internal server error'
    });
  }
}
