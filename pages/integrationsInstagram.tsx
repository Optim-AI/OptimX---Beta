// pages/integrationsInstagram.tsx

import { useEffect, useState } from "react";

interface MeData {
  connected: boolean;
  pageId?: string;
  igUserId?: string;
  createdAt?: string;
}

type Lead = {
  lead_id: string;
  full_name?: string;
  email?: string;
  phone?: string;
  status?: string;
  created_time?: string;
};

export default function IntegrationsInstagram() {
  const [me, setMe] = useState<MeData | null>(null);

  const [imageUrl, setImageUrl] = useState("");
  const [caption, setCaption] = useState("");
  const [alsoPostToFacebook, setAlsoPostToFacebook] = useState(false);

  const [mediaIdForComment, setMediaIdForComment] = useState("");
  const [comment, setComment] = useState("");

  const [campaignName, setCampaignName] = useState("");
  const [dailyBudget, setDailyBudget] = useState("");
  const [adSetName, setAdSetName] = useState("");
  const [creativeImageUrl, setCreativeImageUrl] = useState("");
  const [creativeCaption, setCreativeCaption] = useState("");

  const [result, setResult] = useState<any>(null);

  // --- Leads states (minimal changes, separate block) ---
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [filter, setFilter] = useState<"all" | "new" | "contacted" | "converted">(
    "all"
  );

  useEffect(() => {
    fetch("/api/auth/instagram/me")
      .then((r) => r.json())
      .then(setMe);
  }, []);

  async function handlePost(e: React.FormEvent) {
    e.preventDefault();
    setResult(null);
    const r = await fetch("/api/auth/instagram/post", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        image_url: imageUrl,
        caption,
        alsoPostToFacebook,
      }),
    });
    const j = await r.json();
    setResult(j);
  }

  async function handleComment(e: React.FormEvent) {
    e.preventDefault();
    setResult(null);
    const r = await fetch("/api/auth/instagram/comment", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        mediaId: mediaIdForComment,
        message: comment,
      }),
    });
    const j = await r.json();
    setResult(j);
  }

  async function handleRunAd(e: React.FormEvent) {
    e.preventDefault();
    setResult(null);
    const r = await fetch("/api/auth/facebook/ads", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        campaignName,
        budget: Number(dailyBudget),
        adSetName,
        targeting: {}, // you may refine this later or allow user input
        creativeImageUrl,
        creativeCaption,
      }),
    });
    const j = await r.json();
    setResult(j);
  }

  // ------- LEADS MANAGEMENT functions (minimal, non-intrusive) -------

  async function fetchLeads() {
    setLoadingLeads(true);
    setResult(null);
    try {
      // default endpoint name is /api/auth/instagram/getLeads (see earlier provided API)
      // If your endpoint is different (e.g. getLeadsFromDb or leads), adjust the URL accordingly.
      const url =
        filter === "all"
          ? "/api/auth/instagram/getLeads"
          : `/api/auth/instagram/getLeads?status=${filter}`;

      const res = await fetch(url);
      const json = await res.json();

      // Support various response shapes: { data: [...] } or { leads: [...] } or { success: true, leads: [...] }
      const raw = json.data ?? json.leads ?? json.leadsData ?? [];

      // Normalize various lead shapes to UI-friendly Lead[]
      const normalized: Lead[] = (raw as any[]).map((item: any) => {
        // item might be:
        // - a db row with lead_id, full_name, email, phone, status, created_time/created_at
        // - a FB lead object (field_data array)
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
      const j = await r.json();
      setResult(j);
      // Refresh list
      fetchLeads();
    } catch (err: any) {
      setResult({ error: err.message || String(err) });
    }
  }

  // auto-fetch leads once when page loads (optional); comment out if you prefer manual fetch
  useEffect(() => {
    // don't fetch automatically if you prefer a manual "Fetch Leads" button
    // fetchLeads();
    // leaving commented to avoid surprise API calls — user can click "Fetch Leads"
  }, []);

  // --------------------------------------------------------------------

  return (
    <div className="min-h-screen p-6 bg-gray-50">
      <div className="max-w-3xl mx-auto bg-white p-6 rounded-xl shadow">
        <h2 className="text-2xl font-semibold mb-4">Instagram / Facebook Integration</h2>

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

        <form onSubmit={handleComment} className="mb-6">
          <h3 className="font-medium mb-2">Create a Comment</h3>
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

        {/* ------------------ Leads Management (inserted inline, minimal change) ------------------ */}
        <div className="mb-6">
          <h3 className="font-medium mb-2">Manage Leads</h3>

          <div className="flex items-center gap-3 mb-3">
            <div className="flex gap-2">
              {["all", "new", "contacted", "converted"].map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f as any)}
                  className={`px-3 py-1 rounded ${
                    filter === f
                      ? "bg-blue-600 text-white"
                      : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                  }`}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>

            <button
              onClick={fetchLeads}
              className="ml-auto px-4 py-2 bg-indigo-600 text-white rounded"
            >
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
        {/* ---------------------------------------------------------------------------------------- */}

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
