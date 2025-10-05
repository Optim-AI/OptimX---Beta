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

  // Form state
  const [campaignName, setCampaignName] = useState<string>("API Test Campaign");
  const [budgetAmount, setBudgetAmount] = useState<number>(5); // in currency (e.g., 5 = 5.00 units)
  const [finalUrl, setFinalUrl] = useState<string>("https://www.example.com");
  const [headlinesText, setHeadlinesText] = useState<string>("Buy now,Best deals,Limited time");
  const [descriptionsText, setDescriptionsText] = useState<string>("Great product,Don’t miss out");

  async function loadProfile() {
    try {
      const res = await fetch("/api/auth/google-ads/profile");
      const body = await res.json();
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
    if (managers.length > 0) {
      loadChildAccounts();
    }
  }, [managers]);

  function parseList(input: string) {
    return input
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  async function runCampaignOnSelected() {
    if (!selectedChild) return setMsg("Select a child account first");
    setMsg("Running campaign...");
    try {
      const payload = {
        childAccount: selectedChild,
        campaignName,
        budgetAmount: Math.round(budgetAmount * 1_000_000), // convert to micros
        finalUrls: [finalUrl],
        headlines: parseList(headlinesText),
        descriptions: parseList(descriptionsText),
        // SELF-DECLARATION: for testing default to DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING.
        // In production you must set this correctly per Google rules.
        containsEuPoliticalAdvertising: "DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING",
      };

      const res = await fetch("/api/auth/google-ads/runCampaign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const j = await res.json();
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

        <div className="mt-6 border p-4 bg-gray-50 rounded">
          <h3 className="font-medium mb-2">Campaign inputs (for testing)</h3>

          <label className="block mb-2">
            Campaign name
            <input value={campaignName} onChange={(e) => setCampaignName(e.target.value)} className="w-full p-2 border rounded mt-1" />
          </label>

          <label className="block mb-2">
            Budget (currency units, e.g. 5 = 5.00)
            <input type="number" step="0.01" value={budgetAmount} onChange={(e) => setBudgetAmount(Number(e.target.value))} className="w-full p-2 border rounded mt-1" />
          </label>

          <label className="block mb-2">
            Final URL
            <input value={finalUrl} onChange={(e) => setFinalUrl(e.target.value)} className="w-full p-2 border rounded mt-1" />
          </label>

          <label className="block mb-2">
            Headlines (comma-separated)
            <textarea value={headlinesText} onChange={(e) => setHeadlinesText(e.target.value)} className="w-full p-2 border rounded mt-1" />
          </label>

          <label className="block mb-2">
            Descriptions (comma-separated)
            <textarea value={descriptionsText} onChange={(e) => setDescriptionsText(e.target.value)} className="w-full p-2 border rounded mt-1" />
          </label>

          <div className="mt-4">
            <button onClick={runCampaignOnSelected} className="px-4 py-2 bg-green-600 text-white rounded">
              Run campaign in selected child account
            </button>
          </div>

          <div className="mt-4 text-xs text-gray-600">
            <strong>Note:</strong> This UI is for testing only and sends the values you enter to the server. The EU political-ad self-declaration is defaulted to DOES_NOT_CONTAIN_EU_POLITICAL_ADVERTISING for testing — change as appropriate.
          </div>
        </div>

        <div className="mt-6 border p-4 bg-gray-50 rounded">
          <strong>Status / message:</strong>
          <pre className="whitespace-pre-wrap mt-2">{msg}</pre>
        </div>
      </div>
    </div>
  );
}
