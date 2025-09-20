// pages/api/instagram/post.ts
import { NextApiRequest, NextApiResponse } from 'next';
import fetch from 'node-fetch';

interface PostRequestBody {
  image_url: string;
  caption: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { image_url, caption }: PostRequestBody = req.body;

  // Hardcoded credentials for testing
  const pageToken = 'IGAAeZCmYKatLNBZAE1qOUVVeDU5S0tBWkNEYUhMaVVNMEctSGJwZADZAPLXB1RW11Vkw5SFp0ZAEs3c1c0cy05c0kyNThERVZA3QzNOckQ3NHJWbHFpRjdQUUdYaUhreU5NaUZAqY0laQVV3UEtBcmE1R2JfWmY2QnRYSV94cm82ekRaNAZDZD';
  const igAccountId = '2180990879052979';
  const version = 'v23.0';

  if (!pageToken || !igAccountId) {
    return res.status(400).json({ error: 'Missing required credentials' });
  }

  try {
    // Step 1: Create Media Container
    const createResp = await fetch(
      `https://graph.facebook.com/${version}/${igAccountId}/media?` +
        `image_url=${encodeURIComponent(image_url)}&` +
        `caption=${encodeURIComponent(caption)}&` +
        `access_token=${pageToken}`,
      { method: 'POST' }
    );
    const createJson = await createResp.json();
    if (!createResp.ok) throw createJson;

    const creationId = createJson.id;

    // Step 2: Publish Media
    const publishResp = await fetch(
      `https://graph.facebook.com/${version}/${igAccountId}/media_publish?` +
        `creation_id=${creationId}&` +
        `access_token=${pageToken}`,
      { method: 'POST' }
    );
    const publishJson = await publishResp.json();
    if (!publishResp.ok) throw publishJson;

    res.status(200).json({ success: true, post_id: publishJson.id });
  } catch (error) {
    console.error('Error posting to Instagram:', error);
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
