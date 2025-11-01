// pages/library.tsx
import { useEffect, useState } from "react";
import Sidebar from "../app/web/src/components/Sidebar";
import { supabase } from "../lib/supabaseClient";

interface Campaign {
  id: string;
  name: string;
  campaign_type: string | null;
  image_url: any; // support string | string[] | null
  is_published: boolean;
  created_at?: string;
}

export default function Library() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  // Post modal state
  const [showPostModal, setShowPostModal] = useState(false);
  const [activeCampaign, setActiveCampaign] = useState<Campaign | null>(null);
  const [caption, setCaption] = useState("");
  const [alsoPostToFacebook, setAlsoPostToFacebook] = useState(false);
  const [posting, setPosting] = useState(false);
  const [postResult, setPostResult] = useState<any | null>(null);

  useEffect(() => {
    fetchCampaigns();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchCampaigns = async () => {
    setLoading(true);

    try {
      // Optionally check user if you want per-user filter:
      // const { data: { user }, error: userError } = await supabase.auth.getUser();
      // if (userError || !user) { ... }

      const { data, error } = await supabase
        .from("campaigns")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching campaigns:", error);
        setCampaigns([]);
      } else {
        setCampaigns((data as Campaign[]) || []);
      }
    } catch (err) {
      console.error("Fetch error:", err);
      setCampaigns([]);
    } finally {
      setLoading(false);
    }
  };

  // Helper: get first image url from campaign record (handles array or string)
  const getCampaignImageUrl = (c: Campaign) => {
    if (!c?.image_url) return null;
    if (Array.isArray(c.image_url)) return c.image_url.length ? c.image_url[0] : null;
    return String(c.image_url);
  };

  const openPostFor = (c: Campaign) => {
    setActiveCampaign(c);
    setCaption(""); // reset caption — or pre-fill if you'd like
    setAlsoPostToFacebook(false);
    setPostResult(null);
    setShowPostModal(true);
  };

  const closePostModal = () => {
    setShowPostModal(false);
    setActiveCampaign(null);
    setPosting(false);
    setPostResult(null);
  };

  // POST to your existing Next API route
  const handlePost = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setPostResult(null);

    const imageUrl = activeCampaign ? getCampaignImageUrl(activeCampaign) : null;
    if (!imageUrl) {
      setPostResult({ error: "No image URL found for this campaign." });
      return;
    }

    try {
      setPosting(true);
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
      setPostResult(j);

      if (r.ok) {
        // small delay to allow your backend to finish any async ops if needed
        setTimeout(() => {
          fetchCampaigns();
        }, 1000);
      }
    } catch (err: any) {
      setPostResult({ error: String(err) });
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-slate-50">
      <Sidebar />

      <main className="flex-1 p-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-slate-800">Campaign Library</h2>
          <button className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700">
            + New Campaign
          </button>
        </div>

        {loading ? (
          <p>Loading campaigns...</p>
        ) : campaigns.length === 0 ? (
          <p>No campaigns yet. Create one to get started!</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {campaigns.map((c) => {
              const img = getCampaignImageUrl(c);
              return (
                <div key={c.id} className="p-5 rounded-xl border bg-white shadow-sm">
                  <h3 className="text-lg font-semibold text-slate-800">{c.name}</h3>
                  <p className="text-sm text-slate-500 mt-1">{c.campaign_type || "General"}</p>

                  {img ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={img}
                      alt={c.name}
                      className="mt-2 w-full h-40 object-cover rounded-lg"
                    />
                  ) : (
                    <div className="mt-2 w-full h-40 rounded-lg bg-slate-100 flex items-center justify-center text-sm text-slate-400">
                      No image
                    </div>
                  )}

                  <div className="flex items-center justify-between mt-4">
                    <span className={`text-sm font-medium ${c.is_published ? "text-green-600" : "text-gray-400"}`}>
                      {c.is_published ? "Active" : "Draft"}
                    </span>

                    <div className="flex items-center gap-2">
                      <button className="px-3 py-1 text-sm border rounded-lg hover:bg-slate-100">
                        View
                      </button>
                      <button
                        onClick={() => openPostFor(c)}
                        className="px-3 py-1 text-sm border rounded-lg hover:bg-slate-100"
                      >
                        Post
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Post Modal */}
        {showPostModal && activeCampaign && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="w-full max-w-2xl bg-white rounded-xl shadow-lg p-6 mx-4">
              <div className="flex items-start justify-between gap-4">
                <h3 className="text-lg font-semibold">Post "{activeCampaign.name}"</h3>
                <button
                  onClick={closePostModal}
                  className="text-slate-500 hover:text-slate-700"
                >
                  ✕
                </button>
              </div>

              <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-1">
                  {getCampaignImageUrl(activeCampaign) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={getCampaignImageUrl(activeCampaign) || ""}
                      alt={activeCampaign.name}
                      className="w-full h-48 object-cover rounded-lg"
                    />
                  ) : (
                    <div className="w-full h-48 rounded-lg bg-slate-100 flex items-center justify-center text-sm text-slate-400">
                      No image
                    </div>
                  )}
                </div>

                <form className="md:col-span-2" onSubmit={handlePost}>
                  <label className="text-sm font-medium">Caption</label>
                  <textarea
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    rows={4}
                    className="w-full mt-2 p-3 rounded border focus:outline-none focus:ring"
                    placeholder="Write the Instagram caption..."
                  />

                  <label className="mt-3 flex items-center gap-2 text-sm cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={alsoPostToFacebook}
                      onChange={(e) => setAlsoPostToFacebook(e.target.checked)}
                    />
                    <span>Also post to Facebook</span>
                  </label>

                  <div className="mt-4 flex items-center gap-3">
                    <button
                      type="submit"
                      disabled={posting}
                      className={`px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 ${posting ? "opacity-60 cursor-not-allowed" : ""}`}
                    >
                      {posting ? "Posting…" : "Post to Instagram"}
                    </button>

                    <button
                      type="button"
                      onClick={closePostModal}
                      className="px-4 py-2 rounded-lg border hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                  </div>

                  {postResult && (
                    <div className="mt-4">
                      {postResult.error ? (
                        <div className="text-red-600 text-sm">
                          Error: {String(postResult.error)}
                        </div>
                      ) : (
                        <div className="text-green-600 text-sm">
                          Posted successfully. Response: <pre className="mt-2 whitespace-pre-wrap text-xs bg-slate-100 p-2 rounded">{JSON.stringify(postResult, null, 2)}</pre>
                        </div>
                      )}
                    </div>
                  )}
                </form>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
