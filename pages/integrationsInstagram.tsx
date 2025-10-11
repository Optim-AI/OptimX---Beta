// pages/integrationsInstagram.tsx
import React, { useEffect, useState } from "react";

type MeData = {
  connected: boolean;
  pageId?: string;
  igUserId?: string;
  createdAt?: string;
};

type Lead = {
  lead_id: string;
  full_name?: string;
  email?: string;
  phone?: string;
  status?: string;
  created_time?: string;
};

type SocialPost = {
  id: string;
  caption?: string;
  media_type?: string;
  media_url?: string;
  permalink?: string;
  timestamp?: string;
  like_count?: number;
  comments_count?: number;
  message?: string;
  full_picture?: string;
};

type Campaign = {
  id: string;
  name?: string;
  objective?: string;
  status?: string;
  start_time?: string;
  stop_time?: string;
  budget_remaining?: number;
  [k: string]: any;
};

type AdSet = {
  id: string;
  name?: string;
  status?: string;
  daily_budget?: number | string | null;
  lifetime_budget?: number | string | null;
  start_time?: string | null;
  end_time?: string | null;
  [k: string]: any;
};

type Ad = {
  id: string;
  name?: string;
  status?: string;
  effective_status?: string;
  [k: string]: any;
};

type Insights = Record<string, any>;

export default function IntegrationsInstagram() {
  // --- me / connection ---
  const [me, setMe] = useState<MeData | null>(null);

  // --- original post states ---
  const [imageUrl, setImageUrl] = useState("");
  const [caption, setCaption] = useState("");
  const [alsoPostToFacebook, setAlsoPostToFacebook] = useState(false);
  const [generatingCaption, setGeneratingCaption] = useState(false);

  // manual comment by id (old UI)
  const [mediaIdForComment, setMediaIdForComment] = useState("");
  const [comment, setComment] = useState("");

  // ad states (existing run ad)
  const [campaignName, setCampaignName] = useState("");
  const [dailyBudget, setDailyBudget] = useState("");
  const [adSetName, setAdSetName] = useState("");
  const [creativeImageUrl, setCreativeImageUrl] = useState("");
  const [creativeCaption, setCreativeCaption] = useState("");

  // result / logs
  const [result, setResult] = useState<any>(null);

  // leads
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [filter, setFilter] = useState<"all" | "new" | "contacted" | "converted">(
    "all"
  );

  // IG + FB posts lists and loading states
  const [igPosts, setIgPosts] = useState<SocialPost[]>([]);
  const [fbPosts, setFbPosts] = useState<SocialPost[]>([]);
  const [loadingIgPosts, setLoadingIgPosts] = useState(false);
  const [loadingFbPosts, setLoadingFbPosts] = useState(false);

  // map postId -> comments[]
  const [postComments, setPostComments] = useState<Record<string, any[]>>({});
  // map postId -> input comment text (for quick comment UI)
  const [newCommentText, setNewCommentText] = useState<Record<string, string>>({});

  // --- Ads dashboard state ---
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [adSetsByCampaign, setAdSetsByCampaign] = useState<Record<string, AdSet[]>>({});
  const [adsByAdSet, setAdsByAdSet] = useState<Record<string, Ad[]>>({});
  const [insightsByKey, setInsightsByKey] = useState<Record<string, Insights>>({});
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);
  const [loadingAdSets, setLoadingAdSets] = useState<Record<string, boolean>>({});
  const [loadingAds, setLoadingAds] = useState<Record<string, boolean>>({});
  const [loadingInsights, setLoadingInsights] = useState<Record<string, boolean>>({});

  // fetch me
  useEffect(() => {
    fetch("/api/auth/instagram/me")
      .then((r) => r.json().then((j) => j as MeData))
      .then(setMe)
      .catch((err) => {
        console.error("me fetch err", err);
        setMe(null);
      });
  }, []);

  // ---------------- Existing (posting / generate caption / old comment by id) ----------------
  async function handlePost(e: React.FormEvent) {
    e.preventDefault();
    setResult(null);
    try {
      const r = await fetch("/api/auth/instagram/post", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          image_url: imageUrl,
          caption,
          alsoPostToFacebook,
        }),
      });
      const j = (await r.json()) as any;
      setResult(j);
      setTimeout(() => {
        fetchIgPosts(true);
        fetchFbPosts(true);
        fetchCampaigns(); // refresh ads because you might have posted & cross-posted
      }, 1500);
    } catch (err: any) {
      setResult({ error: String(err) });
    }
  }

  async function handleCommentById(e: React.FormEvent) {
    e.preventDefault();
    setResult(null);
    try {
      const r = await fetch("/api/auth/instagram/comment", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          mediaId: mediaIdForComment,
          message: comment,
        }),
      });
      const j = (await r.json()) as any;
      setResult(j);
      if (mediaIdForComment) openCommentsFor(mediaIdForComment, "instagram");
    } catch (err: any) {
      setResult({ error: String(err) });
    }
  }

  async function handleGenerateCaption(mode: "replace" | "append" = "replace") {
    if (!caption || caption.trim().length === 0) {
      setResult({ error: "Type something in caption box to generate from" });
      return;
    }
    setGeneratingCaption(true);
    setResult(null);
    try {
      const res = await fetch("/api/generateCaption", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: caption, mode }),
      });
      const json = (await res.json()) as any;
      setResult(json);
      if (res.ok && json.caption) {
        if (mode === "replace") setCaption(json.caption);
        else setCaption((p) => (p ? p + "\n\n" + json.caption : json.caption));
      }
    } catch (err: any) {
      console.error("generate caption failed", err);
      setResult({ error: String(err) });
    } finally {
      setGeneratingCaption(false);
    }
  }

  async function handleRunAd(e: React.FormEvent) {
    e.preventDefault();
    setResult(null);
    try {
      const r = await fetch("/api/auth/facebook/ads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          campaignName,
          budget: Number(dailyBudget),
          adSetName,
          targeting: {},
          creativeImageUrl,
          creativeCaption,
        }),
      });
      const j = (await r.json()) as any;
      setResult(j);
      // refresh campaigns after ad creation
      setTimeout(() => fetchCampaigns(), 1500);
    } catch (err: any) {
      setResult({ error: String(err) });
    }
  }

  // ---------------- Leads functions (kept from your UI) ----------------
  async function fetchLeads() {
    setLoadingLeads(true);
    setResult(null);
    try {
      const url =
        filter === "all"
          ? "/api/auth/instagram/getLeads"
          : `/api/auth/instagram/getLeads?status=${filter}`;

      const res = await fetch(url);
      const json = (await res.json()) as any;
      const raw = json.data ?? json.leads ?? json.leadsData ?? [];

      const normalized: Lead[] = (raw as any[]).map((item: any) => {
        const full_name =
          item.full_name ||
          item.name ||
          (item.field_data &&
            item.field_data.find((f: any) => f.name === "full_name")?.values?.[0]) ||
          null;
        const email =
          item.email ||
          (item.field_data &&
            item.field_data.find((f: any) => f.name === "email")?.values?.[0]) ||
          null;
        const phone =
          item.phone ||
          item.phone_number ||
          (item.field_data &&
            item.field_data.find((f: any) => f.name === "phone_number")?.values?.[0]) ||
          null;
        const lead_id = item.lead_id || item.id || item.leadId || item.lead_id || "";
        const status = item.status || "new";
        const created_time = item.created_time || item.created_at || item.createdAt || null;

        return {
          lead_id,
          full_name,
          email,
          phone,
          status,
          created_time,
        } as Lead;
      });

      setLeads(normalized);
      setResult(json);
    } catch (err: any) {
      setResult({ error: err.message || String(err) });
      setLeads([]);
    } finally {
      setLoadingLeads(false);
    }
  }

  async function updateLeadStatus(lead_id: string, status: string) {
    if (!lead_id) {
      setResult({ error: "Missing lead id" });
      return;
    }
    setResult(null);
    try {
      const r = await fetch("/api/auth/instagram/updateLeadStatus", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ lead_id, status }),
      });
      const j = (await r.json()) as any;
      setResult(j);
      fetchLeads();
    } catch (err: any) {
      setResult({ error: err.message || String(err) });
    }
  }

  // ---------------- Posts management (IG + FB) ----------------

  async function fetchIgPosts(refresh = false) {
    setLoadingIgPosts(true);
    setResult(null);
    try {
      const url = "/api/auth/instagram/getMedia";
      const res = await fetch(url);
      const json = (await res.json()) as any;
      if (json?.error) {
        setResult(json);
        setIgPosts([]);
        setLoadingIgPosts(false);
        return;
      }
      const raw = json?.data ?? (json?.body?.data ?? []);
      const posts: SocialPost[] = (raw as any[]).map((p: any) => ({
        id: p.id,
        caption: p.caption,
        media_type: p.media_type,
        media_url: p.media_url,
        permalink: p.permalink,
        timestamp: p.timestamp,
        like_count: p.like_count,
        comments_count: p.comments_count,
      }));
      setIgPosts(posts);
      setResult(json);
    } catch (err: any) {
      setResult({ error: err.message || String(err) });
      setIgPosts([]);
    } finally {
      setLoadingIgPosts(false);
    }
  }

  async function fetchFbPosts(refresh = false) {
    setLoadingFbPosts(true);
    setResult(null);
    try {
      const url = "/api/auth/facebook/getPosts";
      const res = await fetch(url);
      const json = (await res.json()) as any;
      if (json?.error) {
        setResult(json);
        setFbPosts([]);
        setLoadingFbPosts(false);
        return;
      }
      const raw = json?.body?.data ?? json?.data ?? [];
      const posts: SocialPost[] = (raw as any[]).map((p: any) => ({
        id: p.id,
        message: p.message,
        full_picture: p.full_picture,
        permalink: p.permalink_url ?? p.permalink,
        timestamp: p.created_time,
        like_count: p.reactions?.summary?.total_count ?? p.reactions_count ?? 0,
        comments_count: p.comments?.summary?.total_count ?? 0,
      }));
      setFbPosts(posts);
      setResult(json);
    } catch (err: any) {
      setResult({ error: err.message || String(err) });
      setFbPosts([]);
    } finally {
      setLoadingFbPosts(false);
    }
  }

  // view comments for a single post (provider: "instagram" | "facebook")
  async function openCommentsFor(postId: string, provider: "instagram" | "facebook") {
    setResult(null);
    try {
      const res = await fetch(`/api/auth/${provider}/getPostComments?postId=${encodeURIComponent(postId)}`);
      const json = (await res.json()) as any;
      setPostComments((prev) => ({ ...prev, [postId]: json?.data ?? json?.body?.data ?? json ?? [] }));
      setResult(json);
    } catch (err: any) {
      setResult({ error: err.message || String(err) });
    }
  }

  async function postCommentTo(postId: string, provider: "instagram" | "facebook") {
    const text = newCommentText[postId];
    if (!text || text.trim().length === 0) {
      setResult({ error: "Comment cannot be empty" });
      return;
    }
    setResult(null);
    try {
      const res = await fetch(`/api/auth/${provider}/comment`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(provider === "instagram" ? { mediaId: postId, message: text } : { postId, message: text }),
      });
      const j = (await res.json()) as any;
      setResult(j);
      await openCommentsFor(postId, provider);
      if (provider === "instagram") {
        setIgPosts((prev) => prev.map(p => p.id === postId ? { ...p, comments_count: (p.comments_count ?? 0) + 1 } : p));
      } else {
        setFbPosts((prev) => prev.map(p => p.id === postId ? { ...p, comments_count: (p.comments_count ?? 0) + 1 } : p));
      }
      setNewCommentText((prev) => ({ ...prev, [postId]: "" }));
    } catch (err: any) {
      setResult({ error: err.message || String(err) });
    }
  }

  async function deletePost(provider: "instagram" | "facebook", postId: string) {
    if (!confirm("Delete this post? This cannot be undone.")) return;
    setResult(null);
    try {
      const res = await fetch(`/api/auth/${provider}/${provider === "instagram" ? "deleteMedia" : "deletePost"}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ postId }),
      });
      const json = (await res.json()) as any;
      setResult(json);
      if (json.success || json.id || json === true) {
        if (provider === "instagram") setIgPosts((p) => p.filter(x => x.id !== postId));
        else setFbPosts((p) => p.filter(x => x.id !== postId));
      } else if (json?.data?.success || json?.data?.id) {
        if (provider === "instagram") setIgPosts((p) => p.filter(x => x.id !== postId));
        else setFbPosts((p) => p.filter(x => x.id !== postId));
      }
    } catch (err: any) {
      setResult({ error: err.message || String(err) });
    }
  }

  // ---------------- Ads management (fetch campaigns / adsets / ads / insights) ----------------

  async function fetchCampaigns() {
    setLoadingCampaigns(true);
    setResult(null);
    try {
      const res = await fetch("/api/auth/facebook/getCampaigns");
      const json = (await res.json()) as any;
      if (!res.ok) {
        setResult(json);
        setCampaigns([]);
        setLoadingCampaigns(false);
        return;
      }
      // Expect json.data or json.body.data shape
      const raw = json.data ?? json.body?.data ?? json.body ?? [];
      const list: Campaign[] = (raw as any[]).map((c: any) => ({
        id: c.id,
        name: c.name,
        objective: c.objective,
        status: c.status,
        start_time: c.start_time,
        stop_time: c.stop_time,
        budget_remaining: c.budget_remaining,
        ...c,
      }));
      setCampaigns(list);
      setResult(json);
    } catch (err: any) {
      setResult({ error: err.message || String(err) });
      setCampaigns([]);
    } finally {
      setLoadingCampaigns(false);
    }
  }

  async function fetchAdSets(campaignId: string) {
    setLoadingAdSets(prev => ({ ...prev, [campaignId]: true }));
    setResult(null);
    try {
      const res = await fetch(`/api/auth/facebook/getAdSets?campaignId=${encodeURIComponent(campaignId)}`);
      const json = (await res.json()) as any;
      if (!res.ok) {
        setResult(json);
        setAdSetsByCampaign(prev => ({ ...prev, [campaignId]: [] }));
        setLoadingAdSets(prev => ({ ...prev, [campaignId]: false }));
        return;
      }
      const raw = json.data ?? json.body?.data ?? [];
      const list: AdSet[] = (raw as any[]).map((a: any) => ({
        id: a.id,
        name: a.name,
        status: a.status,
        daily_budget: a.daily_budget ?? a.daily_spend_cap,
        lifetime_budget: a.lifetime_budget,
        start_time: a.start_time ?? null,
        end_time: a.end_time ?? null,
        ...a,
      }));
      setAdSetsByCampaign(prev => ({ ...prev, [campaignId]: list }));
      setResult(json);
    } catch (err: any) {
      setResult({ error: err.message || String(err) });
      setAdSetsByCampaign(prev => ({ ...prev, [campaignId]: [] }));
    } finally {
      setLoadingAdSets(prev => ({ ...prev, [campaignId]: false }));
    }
  }

  async function fetchAds(adSetId: string) {
    setLoadingAds(prev => ({ ...prev, [adSetId]: true }));
    setResult(null);
    try {
      const res = await fetch(`/api/auth/facebook/getAds?adSetId=${encodeURIComponent(adSetId)}`);
      const json = (await res.json()) as any;
      if (!res.ok) {
        setResult(json);
        setAdsByAdSet(prev => ({ ...prev, [adSetId]: [] }));
        setLoadingAds(prev => ({ ...prev, [adSetId]: false }));
        return;
      }
      const raw = json.data ?? json.body?.data ?? [];
      const list: Ad[] = (raw as any[]).map((a: any) => ({
        id: a.id,
        name: a.name,
        status: a.status,
        effective_status: a.effective_status,
        ...a,
      }));
      setAdsByAdSet(prev => ({ ...prev, [adSetId]: list }));
      setResult(json);
    } catch (err: any) {
      setResult({ error: err.message || String(err) });
      setAdsByAdSet(prev => ({ ...prev, [adSetId]: [] }));
    } finally {
      setLoadingAds(prev => ({ ...prev, [adSetId]: false }));
    }
  }

  // level: "campaign" | "adset" | "ad"
  async function fetchInsights(level: "campaign" | "adset" | "ad", id: string) {
    const key = `${level}:${id}`;
    setLoadingInsights(prev => ({ ...prev, [key]: true }));
    setResult(null);
    try {
      const res = await fetch(`/api/auth/facebook/getAdInsights?level=${encodeURIComponent(level)}&id=${encodeURIComponent(id)}`);
      const json = (await res.json()) as any;
      if (!res.ok) {
        setResult(json);
        setInsightsByKey(prev => ({ ...prev, [key]: { error: json } }));
        setLoadingInsights(prev => ({ ...prev, [key]: false }));
        return;
      }

      // Graph usually returns { data: [ { id, insights: { data: [...] } } ] } or data: [{...}]
      // We'll attempt to normalize common shapes to an object of metrics
      let metricsObj: any = {};
      if (Array.isArray(json.data) && json.data.length > 0) {
        // Many endpoints return array of objects where each has 'insights' or 'insights.data'
        const entry = json.data[0];
        if (entry.insights && Array.isArray(entry.insights.data)) {
          // flatten insights.data -> { field: lastValue }
          (entry.insights.data as any[]).forEach((m: any) => {
            const keyName = m.name ?? m.title ?? m.field ?? m.metric;
            // value extraction: pick last value if values array
            if (Array.isArray(m.values) && m.values.length > 0) {
              const last = m.values[m.values.length - 1];
              metricsObj[keyName] = last.value ?? last;
            } else if (m.value !== undefined) {
              metricsObj[keyName] = m.value;
            } else {
              metricsObj[keyName] = m;
            }
          });
        } else if (entry.insights && entry.insights.data === undefined && entry.values) {
          // fallback
          metricsObj = entry;
        } else {
          // sometimes metrics come back directly as data[0].values
          if (entry.values && Array.isArray(entry.values) && entry.values.length > 0) {
            metricsObj = entry.values[entry.values.length - 1];
          } else {
            metricsObj = entry;
          }
        }
      } else if (json.data && !Array.isArray(json.data)) {
        metricsObj = json.data;
      } else {
        metricsObj = json;
      }

      setInsightsByKey(prev => ({ ...prev, [key]: metricsObj }));
      setResult(json);
    } catch (err: any) {
      setResult({ error: err.message || String(err) });
      setInsightsByKey(prev => ({ ...prev, [key]: { error: String(err) } }));
    } finally {
      setLoadingInsights(prev => ({ ...prev, [key]: false }));
    }
  }

  // ---------------- init ----------------
  useEffect(() => {
    fetchIgPosts();
    fetchFbPosts();
    fetchCampaigns();
    // don't auto-fetch leads by default
  }, []);

  // ---------------- UI ----------------
  return (
    <div className="min-h-screen p-6 bg-gray-50">
      <div className="max-w-5xl mx-auto bg-white p-6 rounded-xl shadow">
        <h2 className="text-2xl font-semibold mb-4">Instagram / Facebook Integration + Ads</h2>

        <div className="mb-6">
          {me?.connected ? (
            <div>
              <p className="text-sm">
                Connected to Page ID: <strong>{me.pageId}</strong>
              </p>
              <p className="text-sm">
                IG User ID: <strong>{me.igUserId}</strong>
              </p>
            </div>
          ) : (
            <div>
              <p className="text-sm">Not connected. Go to your Integrations page to connect.</p>
            </div>
          )}
        </div>

        {/* Create Post */}
        <form onSubmit={handlePost} className="mb-6">
          <h3 className="font-medium mb-2">Create a Post (Image URL)</h3>
          <input
            value={imageUrl}
            onChange={e => setImageUrl(e.target.value)}
            placeholder="https://..."
            className="w-full p-2 border rounded mb-2"
          />
          <textarea
            value={caption}
            onChange={e => setCaption(e.target.value)}
            placeholder="Caption"
            className="w-full p-2 border rounded mb-2"
          />

          <div className="flex gap-2 mb-3">
            <button
              type="button"
              onClick={() => handleGenerateCaption("replace")}
              className="px-3 py-1 bg-yellow-500 text-white rounded"
              disabled={generatingCaption}
            >
              {generatingCaption ? "Generating…" : "Generate Caption"}
            </button>

            <button
              type="button"
              onClick={() => handleGenerateCaption("append")}
              className="px-3 py-1 bg-gray-300 rounded"
              disabled={generatingCaption}
            >
              {generatingCaption ? "Generating…" : "Generate & Append"}
            </button>
          </div>

          <label className="flex items-center mb-2">
            <input
              type="checkbox"
              checked={alsoPostToFacebook}
              onChange={e => setAlsoPostToFacebook(e.target.checked)}
              className="mr-2"
            />
            Also post to Facebook Page
          </label>
          <button className="px-4 py-2 bg-blue-600 text-white rounded">Post Image</button>
        </form>

        {/* Manual comment by ID (legacy UI) */}
        <form onSubmit={handleCommentById} className="mb-6">
          <h3 className="font-medium mb-2">Create a Comment (by Media ID)</h3>
          <input
            value={mediaIdForComment}
            onChange={e => setMediaIdForComment(e.target.value)}
            placeholder="IG media ID (e.g. 179...)"
            className="w-full p-2 border rounded mb-2"
          />
          <input
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder="Comment text"
            className="w-full p-2 border rounded mb-2"
          />
          <button className="px-4 py-2 bg-green-600 text-white rounded">Post Comment</button>
        </form>

        {/* Run an Ad */}
        <div className="mb-6">
          <h3 className="font-medium mb-2">Run an Ad</h3>
          <form onSubmit={handleRunAd}>
            <input
              value={campaignName}
              onChange={e => setCampaignName(e.target.value)}
              placeholder="Campaign Name"
              className="w-full p-2 border rounded mb-2"
            />
            <input
              value={dailyBudget}
              onChange={e => setDailyBudget(e.target.value)}
              placeholder="Daily Budget"
              type="number"
              className="w-full p-2 border rounded mb-2"
            />
            <input
              value={adSetName}
              onChange={e => setAdSetName(e.target.value)}
              placeholder="Ad Set Name"
              className="w-full p-2 border rounded mb-2"
            />
            <input
              value={creativeImageUrl}
              onChange={e => setCreativeImageUrl(e.target.value)}
              placeholder="Creative Image URL"
              className="w-full p-2 border rounded mb-2"
            />
            <textarea
              value={creativeCaption}
              onChange={e => setCreativeCaption(e.target.value)}
              placeholder="Creative Caption / Message"
              className="w-full p-2 border rounded mb-2"
            />
            <button className="px-4 py-2 bg-purple-600 text-white rounded">Create Ad</button>
          </form>
        </div>

        {/* Leads Management */}
        <div className="mb-6">
          <h3 className="font-medium mb-2">Manage Leads</h3>

          <div className="flex items-center gap-3 mb-3">
            <div className="flex gap-2">
              {["all", "new", "contacted", "converted"].map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f as any)}
                  className={`px-3 py-1 rounded ${filter === f ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-700 hover:bg-gray-300"}`}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>

            <button onClick={fetchLeads} className="ml-auto px-4 py-2 bg-indigo-600 text-white rounded">
              {loadingLeads ? "Fetching..." : "Fetch Leads"}
            </button>
          </div>

          {loadingLeads ? (
            <p>Loading leads...</p>
          ) : leads.length === 0 ? (
            <p className="text-gray-500">No leads found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border border-gray-200 rounded-lg shadow-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="py-2 px-4 border-b">Name</th>
                    <th className="py-2 px-4 border-b">Email</th>
                    <th className="py-2 px-4 border-b">Phone</th>
                    <th className="py-2 px-4 border-b">Status</th>
                    <th className="py-2 px-4 border-b">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((lead) => (
                    <tr key={lead.lead_id || lead.email || lead.created_time}>
                      <td className="py-2 px-4 border-b">{lead.full_name || "N/A"}</td>
                      <td className="py-2 px-4 border-b">{lead.email || "N/A"}</td>
                      <td className="py-2 px-4 border-b">{lead.phone || "N/A"}</td>
                      <td className="py-2 px-4 border-b capitalize">{lead.status || "new"}</td>
                      <td className="py-2 px-4 border-b">
                        <button
                          className="bg-yellow-500 text-white px-2 py-1 rounded mr-2"
                          onClick={() => updateLeadStatus(lead.lead_id, "contacted")}
                          disabled={!lead.lead_id}
                        >
                          Contacted
                        </button>
                        <button
                          className="bg-green-600 text-white px-2 py-1 rounded"
                          onClick={() => updateLeadStatus(lead.lead_id, "converted")}
                          disabled={!lead.lead_id}
                        >
                          Converted
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ------------------ Instagram Posts ------------------ */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium">Instagram Posts</h3>
            <div className="flex gap-2">
              <button onClick={() => fetchIgPosts(true)} className="px-3 py-1 bg-indigo-600 text-white rounded">Refresh</button>
            </div>
          </div>

          {loadingIgPosts ? (
            <p>Loading Instagram posts...</p>
          ) : igPosts.length === 0 ? (
            <p className="text-gray-500">No Instagram posts found.</p>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {igPosts.map((post) => (
                <div key={post.id} className="border p-3 rounded flex gap-4">
                  <div className="w-28 h-28 flex-shrink-0 bg-gray-100 rounded overflow-hidden">
                    {post.media_url ? <img src={post.media_url} alt="" className="w-full h-full object-cover" /> : <div className="p-3 text-sm">No image</div>}
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between">
                      <div>
                        <div className="font-semibold">{post.caption ? (post.caption.length > 120 ? post.caption.slice(0, 120) + "…" : post.caption) : "(no caption)"}</div>
                        <div className="text-xs text-gray-500">{post.timestamp ? new Date(post.timestamp).toLocaleString() : ""}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm">❤️ {post.like_count ?? "-"}</div>
                        <div className="text-sm">💬 {post.comments_count ?? "-"}</div>
                      </div>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <button onClick={() => openCommentsFor(post.id, "instagram")} className="px-3 py-1 bg-blue-600 text-white rounded">View Comments</button>
                      <button onClick={() => setNewCommentText(prev => ({ ...prev, [post.id]: "" }))} className="px-3 py-1 bg-green-600 text-white rounded">Quick Comment</button>
                      <button onClick={() => deletePost("instagram", post.id)} className="px-3 py-1 bg-red-500 text-white rounded">Delete</button>
                      {post.permalink && <a href={post.permalink} target="_blank" rel="noreferrer" className="px-3 py-1 bg-gray-200 rounded">Open</a>}
                    </div>

                    {/* quick composer inline */}
                    <div className="mt-2 flex gap-2">
                      <input
                        value={newCommentText[post.id] ?? ""}
                        onChange={e => setNewCommentText(prev => ({ ...prev, [post.id]: e.target.value }))}
                        placeholder="Write a comment..."
                        className="flex-1 p-2 border rounded"
                      />
                      <button onClick={() => postCommentTo(post.id, "instagram")} className="px-3 py-1 bg-green-700 text-white rounded">Post</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ------------------ Facebook Posts ------------------ */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium">Facebook Page Posts</h3>
            <div className="flex gap-2">
              <button onClick={() => fetchFbPosts(true)} className="px-3 py-1 bg-indigo-600 text-white rounded">Refresh</button>
            </div>
          </div>

          {loadingFbPosts ? (
            <p>Loading Facebook posts...</p>
          ) : fbPosts.length === 0 ? (
            <p className="text-gray-500">No Facebook posts found.</p>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {fbPosts.map((post) => (
                <div key={post.id} className="border p-3 rounded flex gap-4">
                  <div className="w-28 h-28 flex-shrink-0 bg-gray-100 rounded overflow-hidden">
                    {post.full_picture ? <img src={post.full_picture} alt="" className="w-full h-full object-cover" /> : <div className="p-3 text-sm">No image</div>}
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between">
                      <div>
                        <div className="font-semibold">{post.message ? (post.message.length > 120 ? post.message.slice(0, 120) + "…" : post.message) : "(no message)"}</div>
                        <div className="text-xs text-gray-500">{post.timestamp ? new Date(post.timestamp).toLocaleString() : ""}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm">👍 {post.like_count ?? "-"}</div>
                        <div className="text-sm">💬 {post.comments_count ?? "-"}</div>
                      </div>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <button onClick={() => openCommentsFor(post.id, "facebook")} className="px-3 py-1 bg-blue-600 text-white rounded">View Comments</button>
                      <button onClick={() => setNewCommentText(prev => ({ ...prev, [post.id]: "" }))} className="px-3 py-1 bg-green-600 text-white rounded">Quick Comment</button>
                      <button onClick={() => deletePost("facebook", post.id)} className="px-3 py-1 bg-red-500 text-white rounded">Delete</button>
                      {post.permalink && <a href={post.permalink} target="_blank" rel="noreferrer" className="px-3 py-1 bg-gray-200 rounded">Open</a>}
                    </div>

                    {/* quick composer inline */}
                    <div className="mt-2 flex gap-2">
                      <input
                        value={newCommentText[post.id] ?? ""}
                        onChange={e => setNewCommentText(prev => ({ ...prev, [post.id]: e.target.value }))}
                        placeholder="Write a comment..."
                        className="flex-1 p-2 border rounded"
                      />
                      <button onClick={() => postCommentTo(post.id, "facebook")} className="px-3 py-1 bg-green-700 text-white rounded">Post</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ------------------ Ads Dashboard ------------------ */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium">Facebook Ads — Campaigns, Ad Sets & Ads</h3>
            <div className="flex gap-2">
              <button onClick={() => fetchCampaigns()} className="px-3 py-1 bg-indigo-600 text-white rounded">Refresh Campaigns</button>
            </div>
          </div>

          {loadingCampaigns ? (
            <p>Loading campaigns...</p>
          ) : campaigns.length === 0 ? (
            <p className="text-gray-500">No campaigns found.</p>
          ) : (
            <div className="space-y-4">
              {campaigns.map((c) => (
                <div key={c.id} className="border rounded p-3 bg-gray-50">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-semibold">{c.name ?? "(no name)"}</div>
                      <div className="text-xs text-gray-500">ID: {c.id} • Objective: {c.objective ?? "-"}</div>
                      <div className="text-xs text-gray-500">Status: {c.status ?? "-"}</div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => fetchAdSets(c.id)}
                        className="px-3 py-1 bg-blue-600 text-white rounded"
                      >
                        {loadingAdSets[c.id] ? "Loading…" : "View Ad Sets"}
                      </button>
                      <button
                        onClick={() => fetchInsights("campaign", c.id)}
                        className="px-3 py-1 bg-green-600 text-white rounded"
                      >
                        {loadingInsights[`campaign:${c.id}`] ? "Loading…" : "View Insights"}
                      </button>
                    </div>
                  </div>

                  {/* campaign insights */}
                  {insightsByKey[`campaign:${c.id}`] && (
                    <div className="mt-3 p-2 bg-white border rounded text-sm">
                      <div className="font-medium mb-2">Campaign Insights</div>
                      <pre className="text-xs max-h-44 overflow-auto">{JSON.stringify(insightsByKey[`campaign:${c.id}`], null, 2)}</pre>
                    </div>
                  )}

                  {/* ad sets */}
                  <div className="mt-3 space-y-2">
                    {(adSetsByCampaign[c.id] ?? []).length === 0 ? (
                      <div className="text-sm text-gray-500">No ad sets loaded. Click "View Ad Sets".</div>
                    ) : (
                      adSetsByCampaign[c.id].map((as) => (
                        <div key={as.id} className="border rounded p-2 bg-white">
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="font-medium">{as.name ?? "(no name)"}</div>
                              <div className="text-xs text-gray-500">ID: {as.id} • Status: {as.status ?? "-"}</div>
                              <div className="text-xs text-gray-500">Budget (daily): {as.daily_budget ?? "-"} • Lifetime: {as.lifetime_budget ?? "-"}</div>
                              <div className="text-xs text-gray-500">Start: {as.start_time ?? "-"} • End: {as.end_time ?? "-"}</div>
                            </div>
                            <div className="flex gap-2">
                              <button onClick={() => fetchAds(as.id)} className="px-2 py-1 bg-blue-600 text-white rounded">
                                {loadingAds[as.id] ? "Loading…" : "View Ads"}
                              </button>
                              <button onClick={() => fetchInsights("adset", as.id)} className="px-2 py-1 bg-green-600 text-white rounded">
                                {loadingInsights[`adset:${as.id}`] ? "Loading…" : "View Insights"}
                              </button>
                            </div>
                          </div>

                          {/* adset insights */}
                          {insightsByKey[`adset:${as.id}`] && (
                            <div className="mt-2 p-2 bg-gray-50 rounded text-sm">
                              <div className="font-medium mb-1">Ad Set Insights</div>
                              <pre className="text-xs max-h-36 overflow-auto">{JSON.stringify(insightsByKey[`adset:${as.id}`], null, 2)}</pre>
                            </div>
                          )}

                          {/* ads */}
                          <div className="mt-2">
                            {(adsByAdSet[as.id] ?? []).length === 0 ? (
                              <div className="text-sm text-gray-500">No ads loaded. Click "View Ads".</div>
                            ) : (
                              <div className="space-y-2">
                                {(adsByAdSet[as.id] ?? []).map((ad) => (
                                  <div key={ad.id} className="flex justify-between items-start p-2 border rounded bg-white">
                                    <div>
                                      <div className="font-medium">{ad.name ?? "(no name)"}</div>
                                      <div className="text-xs text-gray-500">ID: {ad.id} • Status: {ad.status ?? ad.effective_status ?? "-"}</div>
                                    </div>
                                    <div className="flex gap-2 items-center">
                                      <button onClick={() => fetchInsights("ad", ad.id)} className="px-2 py-1 bg-green-600 text-white rounded">
                                        {loadingInsights[`ad:${ad.id}`] ? "Loading…" : "View Insights"}
                                      </button>
                                      <a href={`https://www.facebook.com/ads/manager/creation/?act=YOUR_ACT_ID&adgroup_id=${encodeURIComponent(ad.id)}`} target="_blank" rel="noreferrer" className="px-2 py-1 bg-gray-200 rounded">Open in Ads Manager</a>
                                    </div>

                                    {/* show ad insights if loaded */}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Comments viewer for selected posts (compact) */}
        <div className="mb-6 border p-4 rounded">
          <h4 className="font-medium mb-2">Comments Viewer (click "View Comments")</h4>
          {Object.keys(postComments).length === 0 ? (
            <p className="text-gray-500">No comments loaded. Click "View Comments" on a post to load them.</p>
          ) : (
            <div className="space-y-3 max-h-64 overflow-auto">
              {Object.entries(postComments).map(([postId, comments]) => (
                <div key={postId}>
                  <div className="text-sm font-semibold mb-1">Comments for {postId}</div>
                  {comments.length === 0 ? <div className="text-gray-500">No comments</div> : comments.map((c: any) => (
                    <div key={c.id ?? c.comment_id ?? Math.random()} className="p-2 border rounded mb-1">
                      <div className="text-xs text-gray-500">{c.username ?? c.from?.name ?? c.from?.id}</div>
                      <div>{c.message ?? c.text ?? c.comment}</div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Result / Response */}
        <div>
          <h4 className="font-medium mb-2">Result / Response</h4>
          <pre className="bg-gray-100 p-3 rounded max-h-64 overflow-auto text-xs">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
}
