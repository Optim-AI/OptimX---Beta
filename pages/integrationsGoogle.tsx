// pages/integrationsGoogle.tsx
import React, { useEffect, useState } from "react";

type Profile = { name?: string; email?: string; picture?: string };
type ChildAcct = { resourceName: string; descriptiveName: string };
type Campaign = { id: number | string; name: string; status?: string; impressions?: number; clicks?: number; cost_micros?: number };

export default function IntegrationsGoogle() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [managers, setManagers] = useState<string[]>([]);
  const [selectedManager, setSelectedManager] = useState<string>("");
  const [childAccounts, setChildAccounts] = useState<ChildAcct[]>([]);
  const [selectedChild, setSelectedChild] = useState<string>("");
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [msg, setMsg] = useState<string>("");

  // Form state
  const [campaignName, setCampaignName] = useState<string>("API Test Campaign");
  const [budgetAmount, setBudgetAmount] = useState<number>(5); // in currency (e.g., 5 = 5.00 units)
  const [finalUrl, setFinalUrl] = useState<string>("https://www.example.com");
  const [headlinesText, setHeadlinesText] = useState<string>("Buy now,Best deals,Limited time");
  const [descriptionsText, setDescriptionsText] = useState<string>("Great product,Don’t miss out");

  async function loadProfile() {
    try {
      const res = await fetch("/api/auth/google-ads/profile", { credentials: "include" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error?.message || JSON.stringify(body));
      setProfile(body.profile);
      // accessible_customers.resourceNames -> ["customers/123","customers/456"]
      const mgrs: string[] = body.accessible_customers?.resourceNames || [];
      setManagers(mgrs);
      if (mgrs.length > 0) setSelectedManager(mgrs[0]);
    } catch (err: any) {
      setMsg("Profile load error: " + (err?.message || String(err)));
    }
  }

  async function loadChildAccounts(manager?: string) {
    try {
      const mgr = manager || selectedManager;
      if (!mgr) return setMsg("Select a manager first");
      // call our server endpoint and pass manager
      const url = `/api/auth/google-ads/clientAccounts?manager=${encodeURIComponent(mgr)}`;
      const res = await fetch(url);
      const j = await res.json();
      if (!res.ok) throw new Error(j.error?.message || JSON.stringify(j));
      setChildAccounts(j.accounts || []);
      if (j.accounts && j.accounts.length > 0) setSelectedChild(j.accounts[0].resourceName);
    } catch (e: any) {
      console.error("loadChildAccounts error:", e);
      setMsg("loadChildAccounts error: " + (e?.message || String(e)));
    }
  }

  async function loadCampaignsForChild(childResourceName?: string) {
    try {
      const child = childResourceName || selectedChild;
      const mgr = selectedManager;
      if (!child) return setMsg("Select a child account");
      if (!mgr) return setMsg("Select a manager first");
      const url = `/api/auth/google-ads/clientAccounts?customer=${encodeURIComponent(child)}&manager=${encodeURIComponent(mgr)}`;
      const res = await fetch(url);
      const j = await res.json();
      if (!res.ok) throw new Error(j.error?.message || JSON.stringify(j));
      setCampaigns(j.campaigns || []);
    } catch (e: any) {
      console.error("loadCampaigns error:", e);
      setMsg("loadCampaigns error: " + (e?.message || String(e)));
    }
  }

  useEffect(() => {
    loadProfile();
  }, []);

  useEffect(() => {
    if (selectedManager) {
      loadChildAccounts(selectedManager);
    }
  }, [selectedManager]);

  useEffect(() => {
    if (selectedChild) loadCampaignsForChild(selectedChild);
  }, [selectedChild]);

  function parseList(input: string) {
    return input
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  async function runCampaignOnSelected() {
    if (!selectedChild) return setMsg("Select a child account first");
    if (!selectedManager) return setMsg("Select a manager (MCC) first");
    setMsg("Running campaign...");
    try {
      const payload = {
        childAccount: selectedChild,
        managerId: selectedManager, // IMPORTANT: pass the chosen manager
        campaignName,
        budgetAmount: Math.round(budgetAmount * 1_000_000), // convert to micros
        finalUrls: [finalUrl],
        headlines: parseList(headlinesText),
        descriptions: parseList(descriptionsText),
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
      // refresh campaigns for the child
      await loadCampaignsForChild(selectedChild);
    } catch (e: any) {
      setMsg("Error running campaign: " + (e?.message || String(e)));
    }
  }

  // small helper to build a link to Google Ads for the account
  function googleAdsAccountLink(customerResourceName: string) {
    // customerResourceName is "customers/1234567890"
    const id = customerResourceName.startsWith("customers/") ? customerResourceName.split("/")[1] : customerResourceName;
    // deep link form commonly used: https://ads.google.com/aw/campaigns?__c=<customerId>
    return `https://ads.google.com/aw/campaigns?__c=${encodeURIComponent(id)}`;
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

        <div className="mb-4">
          <h3 className="mb-2">Choose manager (MCC)</h3>
          <select className="p-2 border rounded w-full" value={selectedManager} onChange={(e) => setSelectedManager(e.target.value)}>
            <option value="">-- choose manager account --</option>
            {managers.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <div className="text-xs text-gray-500 mt-1">
            Choose the manager (MCC) that will be used when creating campaigns (this controls the login-customer-id header).
          </div>
        </div>

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
          <div className="mt-2">
            {selectedChild && (
              <a href={googleAdsAccountLink(selectedChild)} target="_blank" rel="noreferrer" className="text-blue-600 text-sm">
                Open in Google Ads
              </a>
            )}
          </div>
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

          <div className="mt-4 flex gap-2">
            <button onClick={runCampaignOnSelected} className="px-4 py-2 bg-green-600 text-white rounded">
              Run campaign in selected child account
            </button>
            <button onClick={() => loadCampaignsForChild()} className="px-4 py-2 bg-blue-600 text-white rounded">
              Refresh campaigns
            </button>
          </div>

          <div className="mt-4 text-xs text-gray-600">
            <strong>Note:</strong> This UI is for testing only. In production make sure your EU political-ad self-declaration is correct.
          </div>
        </div>

        <div className="mt-6 border p-4 bg-gray-50 rounded">
          <strong>Status / message:</strong>
          <pre className="whitespace-pre-wrap mt-2">{msg}</pre>
        </div>

        <div className="mt-6 border p-4 bg-gray-50 rounded">
          <h3 className="font-medium mb-2">Campaigns (for selected child)</h3>
          {campaigns.length === 0 ? (
            <div className="text-sm text-gray-500">No campaigns found for selected child.</div>
          ) : (
            <div>
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="text-left">ID</th>
                    <th className="text-left">Name</th>
                    <th className="text-left">Impr.</th>
                    <th className="text-left">Clicks</th>
                    <th className="text-left">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {campaigns.map((c) => (
                    <tr key={String(c.id)}>
                      <td>{c.id}</td>
                      <td>{c.name}</td>
                      <td>{c.impressions ?? 0}</td>
                      <td>{c.clicks ?? 0}</td>
                      <td>{c.cost_micros ? (Number(c.cost_micros) / 1_000_000).toFixed(2) : "0.00"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
