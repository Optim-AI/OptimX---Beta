// pages/api/instagram/media.ts

import { NextApiRequest, NextApiResponse } from 'next';
import fetch from 'node-fetch';
import cookie from 'cookie';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    // Read cookies
    const cookies = cookie.parse(req.headers.cookie || '');
    const pageToken = cookies.page_token;
    const igAccountId = cookies.ig_acctid;

    if (!pageToken || !igAccountId) {
      return res.status(401).json({ error: 'Not authenticated with Instagram' });
    }

    const version = 'v23.0';

    // Fetch media (recent media for the IG Business Account)
    const mediaUrl = `https://graph.facebook.com/${version}/${igAccountId}/media?fields=id,media_url,caption,permalink&access_token=${pageToken}`;
    const mediaResp = await fetch(mediaUrl);
    const mediaJson = await mediaResp.json();

    if (!mediaResp.ok) {
      throw new Error(mediaJson.error?.message || 'Failed to fetch media from Instagram');
    }

    // Return data
    return res.status(200).json({ success: true, data: mediaJson.data });
  } catch (error: any) {
    console.error('Error in /api/instagram/media:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
