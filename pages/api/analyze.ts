import client from '../../googleAdsClient';

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const { keyword } = req.body;

    try {
      const keywordPlanIdeaService = client.getService('KeywordPlanIdeaService');
      const request = {
        customer_id: '3154658970',
        keyword_seed: { keywords: [keyword] },
        geo_target_constants: ['geoTargetConstants/2840'], // United States
        language: 'languageConstants/1000', // English
      };

      const response = await keywordPlanIdeaService.generateKeywordIdeas(request);
      const seoData = {
        searchVolume: response[0].search_volume,
        competition: response[0].competition,
        suggestedBid: response[0].suggested_bid,
      };

      res.status(200).json(seoData);
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch SEO data' });
    }
  } else {
    res.status(405).json({ error: 'Method Not Allowed' });
  }
}
