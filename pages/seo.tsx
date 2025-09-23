// pages/seo.tsx
import React, { useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';
// If you already have a supabase client set up elsewhere, import that instead.
// const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || '', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '');

export default function SEOPage() {
  const [keyword, setKeyword] = useState('');
  const [locale, setLocale] = useState('United States');
  const [useSerp, setUseSerp] = useState(true);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!keyword.trim()) return setError('Please enter a keyword');
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch('/api/seo-analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword, locale, useSerp }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Unknown error');
      setResult(json);

      // Save a lightweight history entry to Supabase (optional) — requires client keys
      try {
        if (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
          await supabase.from('seo_queries').insert([{ keyword, created_at: new Date(), data: json }]);
        }
      } catch (e) {
        // ignore errors storing history — optional
      }
    } catch (err: any) {
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-3xl font-semibold mb-4">SEO Keyword Analyzer</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium">Keyword</label>
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2"
            placeholder="e.g. best running shoes for flat feet"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium">Locale</label>
            <input value={locale} onChange={(e)=> setLocale(e.target.value)} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2" />
          </div>
          <div>
            <label className="block text-sm font-medium">Use SERP scraping (optional)</label>
            <div className="mt-1">
              <label className="inline-flex items-center">
                <input type="checkbox" checked={useSerp} onChange={e=>setUseSerp(e.target.checked)} className="mr-2" />
                Try to use SerpApi (requires server env `SERPAPI_API_KEY`)
              </label>
            </div>
          </div>
        </div>

        <div>
          <button type="submit" disabled={loading} className="px-4 py-2 rounded bg-blue-600 text-white">
            {loading ? 'Analyzing…' : 'Analyze'}
          </button>
          {error && <p className="text-red-600 mt-2">{error}</p>}
        </div>
      </form>

      {result && (
        <div className="mt-6 space-y-4">
          <div className="p-4 border rounded">
            <h2 className="font-semibold">Quick score</h2>
            <p className="text-2xl mt-2">{result.overallScore} / 100</p>
            <p className="text-sm text-gray-600">{result.summary}</p>
          </div>

          <div className="p-4 border rounded">
            <h3 className="font-semibold">Details</h3>
            <pre className="text-xs mt-2 whitespace-pre-wrap">{JSON.stringify(result.details, null, 2)}</pre>
          </div>

          {result.topResults?.length > 0 && (
            <div className="p-4 border rounded">
              <h3 className="font-semibold">Top SERP results (first 5)</h3>
              <ul className="list-disc ml-6 mt-2">
                {result.topResults.slice(0,5).map((r:any, i:number)=> (
                  <li key={i}><a href={r.link} target="_blank" rel="noreferrer" className="text-blue-600 underline">{r.title}</a> — {r.displayed_link}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
