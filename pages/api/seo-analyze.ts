// pages/api/seo-analyze.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import fetch from 'node-fetch';
import { supabase } from '../../lib/supabaseClient';
import { createServerSupabase } from '../../lib/supabase.server';

const SUPABASE_SERVICE_ROLE = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxrcnZ3c3pldmV1cHlxZWJ4ZWhxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NjQ2MTMzMSwiZXhwIjoyMDcyMDM3MzMxfQ.ECObhariyPswcK4oHwdlrwAZm3Cgl7VAhjcWgBpinyY";
const SERPAPI_KEY = "b2c6907280142da7487c23ed925c4ddb8d22e66a75ecebc435c08661b9d88b84";

function guessIntent(keyword: string) {
  const k = keyword.toLowerCase();
  if (/\b(buy|price|sale|cheap|discount|coupon|best price)\b/.test(k)) return 'commercial (transactional)';
  if (/\b(how|what|why|guide|tutorial|best way|tips)\b/.test(k)) return 'informational';
  if (/\b(near me|location|address|map)\b/.test(k)) return 'local/navigational';
  return 'mixed/unsure';
}

function simpleDifficultyEstimate(numTopResults:number, containsHighAuthority:boolean){
  // naive heuristic: more top results from big sites => harder
  let score = 50; // 0-100 (lower = easier)
  score += Math.max(0, Math.min(40, numTopResults * 5));
  if (containsHighAuthority) score += 20;
  return Math.min(100, score);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { keyword, locale = 'United States', useSerp = true } = req.body;
  if (!keyword || typeof keyword !== 'string') return res.status(400).json({ error: 'keyword is required' });

  const summary: any = {
    keyword,
    length: keyword.length,
    words: keyword.trim().split(/\s+/).length,
    intent: guessIntent(keyword),
    topResults: [],
    details: {},
  };

  try {
    if (useSerp && SERPAPI_KEY) {
      const q = `https://serpapi.com/search.json?q=${encodeURIComponent(keyword)}&location=${encodeURIComponent(locale)}&google_domain=google.com&hl=en&num=10&api_key=${SERPAPI_KEY}`;
      const r = await fetch(q);
      if (r.ok) {
        const json = await r.json();
        // pick some fields safely
        summary.topResults = (json.organic_results || []).map((o:any) => ({ title: o.title, link: o.link, displayed_link: o.displayed_link || o.source }));
        // detect presence of 'ads' or 'top_ad' (varies by engine)
        summary.details.totalOrganic = (json.organic_results || []).length;
        summary.details.hasAds = !!json.advertisements || !!json.inline_ads || !!json.top_ads || !!json.ad_results;
        // naive authority detection — check some well-known authoritative hosts
        const topDomains = (summary.topResults || []).map((r:any)=> new URL(r.link).hostname.replace('www.',''));
        const highAuth = topDomains.some((d:any)=> ['wikipedia.org','forbes.com','nytimes.com','theguardian.com','amazon.com'].some(x=> d.includes(x)));
        summary.details.topDomains = topDomains;
        summary.details.highAuthorityPresent = highAuth;

        summary.details.serpMetadata = {
          search_information: json.search_information || null,
          related_questions: json.related_questions || null,
        };

        const difficulty = simpleDifficultyEstimate(summary.details.totalOrganic, highAuth);
        summary.difficulty = difficulty;
        summary.overallScore = Math.max(0, 100 - Math.round(difficulty));
        summary.summary = `Estimated difficulty ${difficulty}/100 — intent: ${summary.intent}`;
      } else {
        summary.details.serpError = await r.text();
      }
    } else {
      // fallback: quick heuristics without SERP data
      const highAuthority = /\b(amazon|wikipedia|youtube|facebook|twitter|forbes|nytimes)\b/i.test(keyword);
      const diff = simpleDifficultyEstimate(3, highAuthority);
      summary.difficulty = diff;
      summary.overallScore = Math.max(0, 100 - Math.round(diff));
      summary.summary = `Heuristic estimate (no SERP API) — difficulty ${diff}/100`;
    }

    // store to Supabase history (optional) — requires service role key
    if (SUPABASE_SERVICE_ROLE) {
      try {
        const sb = createServerSupabase();
        await sb.from('seo_queries').insert([{ keyword, created_at: new Date().toISOString(), data: summary }]);
      } catch (e) { /* ignore storage errors */ }
    }

    return res.status(200).json(summary);
  } catch (err:any) {
    console.error('seo-analyze error', err.message || err);
    return res.status(500).json({ error: 'internal', details: String(err) });
  }
}