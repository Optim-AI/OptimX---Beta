// pages/api/images/upload.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { getUserIdFromRequest } from '@/auth/request';
import { GeneratedImageDAO } from '@/database';

/**
 * POST /api/images/upload
 * Records a generated/uploaded image in the database
 * Note: Actual file upload to Supabase Storage should be done client-side,
 * this just records the metadata
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const userId = await getUserIdFromRequest(req);

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { imageUrl, imagePath } = req.body;

    if (!imageUrl) {
      return res.status(400).json({ error: 'imageUrl is required' });
    }

    const { recordGeneratedCreative } = await import(
      "@/lib/social/generated-contents/record"
    );
    const recorded = await recordGeneratedCreative({
      userId,
      mediaUrl: imageUrl,
      storagePath: imagePath || null,
      mediaType: "image",
      source: "images-upload",
    });

    const generatedImage = recorded
      ? await GeneratedImageDAO.getById(recorded.id)
      : await GeneratedImageDAO.insert(userId, imageUrl, imagePath || null);

    return res.status(201).json({
      success: true,
      data: generatedImage,
      created: recorded?.created ?? true,
    });
  } catch (error: any) {
    console.error('Image upload record error:', error);
    return res.status(500).json({
      error: 'Failed to record image',
      message: error.message
    });
  }
}
