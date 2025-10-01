// pages/integrationsGoogle.tsx
import React, { useEffect, useState } from "react";

type Profile = { name?: string; email?: string; picture?: string };
type ChildAcct = { resourceName: string; descriptiveName: string };

export default function IntegrationsGoogle() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [managers, setManagers] = useState<string[]>([]);
  const [childAccounts, setChildAccounts] = useState<ChildAcct[]>([]);
  const [selectedChild, setSelectedChild] = useState<string>("");
  const [msg, setMsg] = useState<string>("");

  async function loadProfile() {
    try {
      const res = await fetch("/api/auth/google-ads/profile");
      const body = await res.json();
      console.log("profile response:", res.status, body);
      if (!res.ok) throw new Error(body.error?.message || JSON.stringify(body));
      setProfile(body.profile);
      const mgrs: string[] =
        body.accessible_customers?.resourceNames || body.accessible_customers?.customerIds || [];
      setManagers(mgrs);
    } catch (err: any) {
      setMsg("Profile load error: " + err.message);
    }
  }

  async function loadChildAccounts() {
    try {
      const res = await fetch("/api/auth/google-ads/clientAccounts");
      const j = await res.json();
      console.log("clientAccounts:", res.status, j);
      if (!res.ok) throw new Error(j.error?.message || JSON.stringify(j));
      setChildAccounts(j.accounts || []);
      if (j.accounts && j.accounts.length > 0) setSelectedChild(j.accounts[0].resourceName);
    } catch (e: any) {
      console.error("loadChildAccounts error:", e);
    }
  }

  useEffect(() => {
    loadProfile();
  }, []);

  useEffect(() => {
    // once profile/managers present, load child accounts (server handles using manager)
    if (managers.length > 0) {
      loadChildAccounts();
    }
  }, [managers]);

  async function runCampaignOnSelected() {
    if (!selectedChild) return setMsg("Select a child account first");
    setMsg("Running campaign...");
    try {
      const res = await fetch("/api/auth/google-ads/runCampaign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ childAccount: selectedChild, campaignName: "API Test Campaign" }),
      });
      const j = await res.json();
      console.log("runCampaign result:", res.status, j);
      if (!res.ok) throw new Error(j.error?.message || JSON.stringify(j));
      setMsg("Campaign created: " + JSON.stringify(j.data, null, 2));
    } catch (e: any) {
      setMsg("Error running campaign: " + e.message);
    }
  }

  return (
    <div className="min-h-screen p-8 bg-slate-50">
      <div className="max-w-3xl mx-auto bg-white shadow rounded p-6">
        <h2 className="text-xl font-semibold mb-4">Connected Google Ads</h2>

        {profile ? (
          <div className="flex items-center gap-3 mb-4">
            {profile.picture && <img src={profile.picture} alt="avatar" className="w-12 h-12 rounded-full" />}
            <div>
              <div className="font-medium">{profile.name}</div>
              <div className="text-sm text-gray-500">{profile.email}</div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-red-600">Not signed in — {msg}</p>
        )}

        <div>
          <h3 className="mb-2">Child (client) accounts</h3>
          <select
            className="p-2 border rounded w-full"
            value={selectedChild}
            onChange={(e) => setSelectedChild(e.target.value)}
          >
            <option value="">-- select child account --</option>
            {childAccounts.map((c) => (
              <option key={c.resourceName} value={c.resourceName}>
                {c.descriptiveName} ({c.resourceName})
              </option>
            ))}
          </select>
        </div>

        <div className="mt-4">
          <button onClick={runCampaignOnSelected} className="px-4 py-2 bg-green-600 text-white rounded">
            Run campaign in selected child account
          </button>
        </div>

        <div className="mt-6 border p-4 bg-gray-50 rounded">
          <strong>Status / message:</strong>
          <pre className="whitespace-pre-wrap mt-2">{msg}</pre>
        </div>
      </div>
    </div>
  );
}
