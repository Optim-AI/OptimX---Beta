// pages/library.tsx
import { useEffect, useState } from "react";
import Sidebar from "../app/web/src/components/Sidebar";
import { supabase } from "../lib/supabaseClient";

interface Campaign {
  id: string;
  name: string;
  campaign_type: string | null;
  image_url: string | null;
  is_published: boolean;
}

export default function Library() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCampaigns = async () => {
      setLoading(true);

      // Get logged-in user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        console.error("User not logged in:", userError);
        setCampaigns([]);
        setLoading(false);
        return;
      }

      // Fetch campaigns for this user
      const { data, error } = await supabase
        .from("campaigns") // Table name as string
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching campaigns:", error.message);
        setCampaigns([]);
      } else {
        setCampaigns(data as Campaign[]);
      }

      setLoading(false);
    };

    fetchCampaigns();
  }, []);

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
            {campaigns.map((c) => (
              <div key={c.id} className="p-5 rounded-xl border bg-white shadow-sm">
                <h3 className="text-lg font-semibold text-slate-800">{c.name}</h3>
                <p className="text-sm text-slate-500 mt-1">{c.campaign_type || "General"}</p>
                {c.image_url && (
                  <img
                    src={c.image_url}
                    alt={c.name}
                    className="mt-2 w-full h-40 object-cover rounded-lg"
                  />
                )}
                <div className="flex items-center justify-between mt-4">
                  <span className={`text-sm font-medium ${c.is_published ? "text-green-600" : "text-gray-400"}`}>
                    {c.is_published ? "Active" : "Draft"}
                  </span>
                  <button className="px-3 py-1 text-sm border rounded-lg hover:bg-slate-100">
                    View
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
