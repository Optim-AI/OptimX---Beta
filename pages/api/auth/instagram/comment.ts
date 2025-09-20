// pages/api/instagram/comment.ts
import { NextApiRequest, NextApiResponse } from 'next';
import fetch from 'node-fetch';

interface CommentRequestBody {
  media_id: string;
  message: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { media_id, message }: CommentRequestBody = req.body;

  // Hardcoded credentials for testing
  const pageToken = 'IGAAeZCmYKatLNBZAE1qOUVVeDU5S0tBWkNEYUhMaVVNMEctSGJwZADZAPLXB1RW11Vkw5SFp0ZAEs3c1c0cy05c0kyNThERVZA3QzNOckQ3NHJWbHFpRjdQUUdYaUhreU5NaUZAqY0laQVV3UEtBcmE1R2JfWmY2QnRYSV94cm82ekRaNAZDZD';
  const version = 'v23.0';

  if (!media_id || !message) {
    return res.status(400).json({ error: 'Missing media_id or message' });
  }

  try {
    const resp = await fetch(
      `https://graph.facebook.com/${version}/${media_id}/comments?` +
        `message=${encodeURIComponent(message)}&access_token=${pageToken}`,
      { method: 'POST' }
    );
    const json = await resp.json();
    if (!resp.ok) throw json;

    res.status(200).json({ success: true, comment_id: json.id });
  } catch (e) {
    console.error('Error posting comment:', e);
    res.status(500).json({ error: e.message || 'Internal Server Error' });
  }
}
