import type { NextApiRequest, NextApiResponse } from "next";
import client from '../../googleAdsClient';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { getUserIdFromRequest } = await import("@/auth/request");
  const userId = await getUserIdFromRequest(req);
  if (!userId) return res.status(401).json({ error: "Authentication required" });

  const { keyword } = req.body;
  if (!keyword || typeof keyword !== 'string' || !keyword.trim()) {
    return res.status(400).json({ error: 'A non-empty keyword string is required' });
  }

  const customerId = process.env.GOOGLE_ADS_CUSTOMER_ID;
  if (!customerId) {
    return res.status(500).json({ error: 'Google Ads customer ID not configured' });
  }

  try {
    const keywordPlanIdeaService = client.getService('KeywordPlanIdeaService');
    const request = {
      customer_id: customerId,
      keyword_seed: { keywords: [keyword.trim()] },
      geo_target_constants: ['geoTargetConstants/2840'],
      language: 'languageConstants/1000',
    };

    const response = await keywordPlanIdeaService.generateKeywordIdeas(request);
    if (!response || !Array.isArray(response) || response.length === 0) {
      return res.status(404).json({ error: 'No keyword data found' });
    }

    const seoData = {
      searchVolume: response[0].search_volume,
      competition: response[0].competition,
      suggestedBid: response[0].suggested_bid,
    };

    res.status(200).json(seoData);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch SEO data' });
  }
}
