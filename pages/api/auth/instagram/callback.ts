// pages/api/auth/instagram/callback.ts
import { NextApiRequest, NextApiResponse } from 'next';
import fetch from 'node-fetch';
import cookie from 'cookie';
import { parse } from 'cookie';
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { code, state: returnedState } = req.query;

  // Parse cookies to retrieve the saved state
  const cookies = cookie.parse(req.headers.cookie || '');
  const savedState = cookies.oauth_state;

  // Validate the state parameter to prevent CSRF attacks
  if (!code || returnedState !== savedState) {
    return res.status(400).send('Invalid state');
  }

  // Retrieve environment variables
  const APP_ID = "780669451611596";
  const APP_SECRET = "2f0da87538fb861927d6b92a0e65fcc9";
  const REDIRECT_URI = "http://localhost:3000/integrationsInstagram";
  const version = 'v23.0';

  try {
    // Exchange the authorization code for a short-lived user access token
    const tokenResp = await fetch(
      `https://graph.facebook.com/${version}/oauth/access_token?` +
        `client_id=${APP_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
        `&client_secret=${APP_SECRET}&code=${code}`
    );
    const tokenData = await tokenResp.json();
    if (!tokenResp.ok) {
      throw new Error(`Token exchange failed: ${tokenData.error.message}`);
    }
    const userAccessToken = tokenData.access_token;

    // Retrieve the list of pages the user manages
    const pagesResp = await fetch(
      `https://graph.facebook.com/${version}/me/accounts?access_token=${userAccessToken}`
    );
    const pagesData = await pagesResp.json();
    if (!pagesResp.ok) {
      throw new Error(`Failed to fetch pages: ${pagesData.error.message}`);
    }

    // Select the first page (or implement logic to let the user choose)
    const page = pagesData.data && pagesData.data[0];
    if (!page) {
      throw new Error('User has no Facebook Page');
    }
    const pageAccessToken = page.access_token;
    const pageId = page.id;

    // Retrieve the Instagram Business Account ID associated with the page
    const pageInfoResp = await fetch(
      `https://graph.facebook.com/${version}/${pageId}?` +
        `fields=instagram_business_account&access_token=${pageAccessToken}`
    );
    const pageInfo = await pageInfoResp.json();
    if (!pageInfoResp.ok) {
      throw new Error(`Failed to fetch page info: ${pageInfo.error.message}`);
    }
    const igAccountId = pageInfo.instagram_business_account?.id;
    if (!igAccountId) {
      throw new Error('Page is not linked to an Instagram Business account');
    }

    // Retrieve basic Instagram user information
    const igUserInfoResp = await fetch(
      `https://graph.facebook.com/${version}/${igAccountId}?` +
        `fields=id,username,profile_picture_url&access_token=${pageAccessToken}`
    );
    const igUserInfo = await igUserInfoResp.json();
    if (!igUserInfoResp.ok) {
      throw new Error(`Failed to fetch Instagram user info: ${igUserInfo.error.message}`);
    }

    // Set cookies to store user information (consider using secure, HttpOnly cookies)
    res.setHeader('Set-Cookie', [
      `ig_username=${igUserInfo.username}; Path=/; HttpOnly`,
      `ig_acctid=${igAccountId}; Path=/; HttpOnly`,
      `page_token=${pageAccessToken}; Path=/; HttpOnly`,
    ]);

    // Redirect to the integrations page
    res.redirect('/integrationsinstagram');
  } catch (error) {
    // Handle errors and respond with an appropriate message
    console.error('Instagram OAuth callback error:', error);
    res.status(500).json({ error: error.message });
  }
}

