// pages/settings.tsx
import { useEffect, useState } from "react";
import Sidebar from "../app/web/src/components/Sidebar";
import { supabase } from "../lib/supabaseClient";

interface Profile {
  id: string;
  full_name: string | null;
  business_name: string | null;
  email: string | null;
}

export default function Settings() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      setLoading(true);

      // Get logged-in user
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        console.error("User not logged in:", userError);
        setLoading(false);
        return;
      }

      // Fetch profile for this user
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single(); // only one row

      if (error) {
        console.error("Error fetching profile:", error.message);
        setProfile(null);
      } else {
        setProfile(data as Profile);
      }

      setLoading(false);
    };

    fetchProfile();
  }, []);

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!profile) return;

    setSaving(true);

    const { data, error } = await supabase
      .from("profiles")
      .update({
        full_name: profile.full_name,
        email: profile.email,
        business_name: profile.business_name,
      })
      .eq("id", profile.id)
      .select()
      .single();

    if (error) {
      console.error("Error saving profile:", error.message);
      alert("Failed to save profile.");
    } else {
      setProfile(data as Profile);
      alert("Profile saved successfully!");
    }

    setSaving(false);
  };

  if (loading) return <p className="p-8">Loading profile...</p>;

  return (
    <div className="min-h-screen flex bg-slate-50">
      <Sidebar />

      <main className="flex-1 p-8">
        <h2 className="text-2xl font-bold text-slate-800 mb-6">Settings</h2>

        {/* Tabs */}
        <div className="border-b mb-6">
          <nav className="flex space-x-6 text-sm font-medium">
            <button className="px-3 py-2 text-blue-600 border-b-2 border-blue-600">
              Profile
            </button>
            <button className="px-3 py-2 text-slate-600 hover:text-slate-800">
              Business
            </button>
            <button className="px-3 py-2 text-slate-600 hover:text-slate-800">
              Billing
            </button>
            <button className="px-3 py-2 text-slate-600 hover:text-slate-800">
              Team
            </button>
            <button className="px-3 py-2 text-slate-600 hover:text-slate-800">
              Notifications
            </button>
          </nav>
        </div>

        {/* Profile Form */}
        <div className="p-6 bg-white rounded-xl border shadow-sm w-full max-w-xl">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Profile Information</h3>

          <form className="space-y-4" onSubmit={handleSave}>
            <div>
              <label className="block text-sm font-medium text-slate-700">Full Name</label>
              <input
                type="text"
                value={profile?.full_name || ""}
                onChange={(e) => setProfile({ ...profile!, full_name: e.target.value })}
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-blue-500 focus:ring focus:ring-blue-200"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">Email</label>
              <input
                type="email"
                value={profile?.email || ""}
                onChange={(e) => setProfile({ ...profile!, email: e.target.value })}
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-blue-500 focus:ring focus:ring-blue-200"
              />
            </div>

            <button
              type="submit"
              className="mt-2 px-4 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700"
              disabled={saving}
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
