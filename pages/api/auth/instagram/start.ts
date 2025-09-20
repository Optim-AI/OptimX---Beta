// pages/api/auth/instagram/start.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const APP_ID = process.env.INSTAGRAM_APP_ID || '780669451611596';
    const REDIRECT_URI =
      process.env.INSTAGRAM_REDIRECT_URI || 'http://localhost:3000/integrationsInstagram';

    if (!APP_ID || !REDIRECT_URI) {
      return res.status(500).json({ error: 'Missing required environment variables' });
    }

    // Generate a random state parameter for CSRF protection
    const state = crypto.randomBytes(16).toString('hex');

    // Set the state in a secure, HttpOnly cookie
    res.setHeader('Set-Cookie', `oauth_state=${state}; Path=/; HttpOnly; SameSite=Lax`);

    // Define required Instagram Graph API permissions
    const scopes = [
      'pages_show_list',
      'instagram_basic',
      'instagram_content_publish',
      'instagram_manage_comments',
    ].join(',');

    // API version
    const version = 'v23.0';

    // Construct the OAuth URL
    const oauthUrl = `https://www.facebook.com/${version}/dialog/oauth?client_id=${APP_ID}&redirect_uri=${encodeURIComponent(
      REDIRECT_URI
    )}&scope=${encodeURIComponent(scopes)}&response_type=code&state=${state}`;

    // Redirect the user to Instagram OAuth
    res.writeHead(302, { Location: oauthUrl });
    res.end();
  } catch (err) {
    console.error('Instagram OAuth error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}
