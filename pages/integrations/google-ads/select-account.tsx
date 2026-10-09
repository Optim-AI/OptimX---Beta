import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import dynamic from "next/dynamic";
import { supabase } from "@/auth/supabase/client";
import { showError } from "@/app/web/src/components/ui/alert-modal-api";

type Account = {
  accountId: string;
  name?: string;
  currency?: string | null;
  timezone?: string | null;
  status?: string | null;
  isManager?: boolean;
  managerId?: string | null;
};

function SelectGoogleAdsAccount() {
  const router = useRouter();
  const sessionId = router.query.sessionId as string | undefined;
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [discoverError, setDiscoverError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [managerId, setManagerId] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!sessionId) return;
    (async () => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        setDiscoverError("Not signed in");
        setLoading(false);
        return;
      }
      const res = await fetch(
        `/api/ads/google/oauth/session?sessionId=${encodeURIComponent(sessionId)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const json = await res.json();
      if (!res.ok) {
        setDiscoverError(json.message || json.error || "Failed to load");
      } else {
        setAccounts(json.accounts || []);
        setDiscoverError(json.discoverError || null);
        const mgr = (json.accounts || []).find((a: Account) => a.isManager);
        if (mgr) setManagerId(mgr.accountId);
      }
      setLoading(false);
    })();
  }, [sessionId]);

  const handleSubmit = async () => {
    if (!selected || !sessionId) return;
    setSubmitting(true);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      const res = await fetch("/api/ads/google/oauth/finalize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          sessionId,
          customerId: selected,
          managerCustomerId: managerId || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || json.error || "Finalize failed");
      }
      router.push(
        `/integrations?connected=google-ads&status=success&customer=${encodeURIComponent(
          selected
        )}`
      );
    } catch (e: any) {
      showError(e.message);
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-slate-600">Loading Google Ads accounts…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold">Select Google Ads customer</h1>
          <p className="text-slate-600 mt-2">
            Choose the customer account to sync. Manager (MCC) accounts are labeled.
            Nothing is selected automatically.
          </p>
        </div>

        {discoverError && (
          <div className="bg-amber-50 border border-amber-200 text-amber-900 text-sm rounded-lg p-4">
            Account discovery warning: {discoverError}. You may still select an
            account if listed, or check developer-token access / test account
            restrictions.
          </div>
        )}

        {!accounts.length ? (
          <div className="bg-white border rounded-xl p-6 text-sm text-slate-700">
            No accessible customers were returned. Verify your Google Ads API
            developer token access level and that this Google user can access at
            least one Ads account.
          </div>
        ) : (
          <div className="bg-white border rounded-xl p-4 space-y-2">
            {accounts.map((a) => (
              <label
                key={a.accountId}
                className={`flex gap-3 p-3 rounded-lg border cursor-pointer ${
                  selected === a.accountId
                    ? "border-blue-600 bg-blue-50"
                    : "border-slate-200"
                }`}
              >
                <input
                  type="radio"
                  name="customer"
                  checked={selected === a.accountId}
                  onChange={() => {
                    setSelected(a.accountId);
                    if (a.managerId) setManagerId(a.managerId);
                  }}
                />
                <div>
                  <div className="font-medium">
                    {a.name || a.accountId}
                    {a.isManager ? (
                      <span className="ml-2 text-xs text-violet-700 bg-violet-100 px-1.5 py-0.5 rounded">
                        MCC
                      </span>
                    ) : null}
                  </div>
                  <div className="text-xs text-slate-500">
                    {a.accountId}
                    {a.currency ? ` · ${a.currency}` : ""}
                    {a.status ? ` · ${a.status}` : ""}
                  </div>
                </div>
              </label>
            ))}
          </div>
        )}

        <div className="bg-white border rounded-xl p-4">
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Manager (login-customer-id) — optional
          </label>
          <input
            className="w-full border rounded-lg px-3 py-2 text-sm"
            value={managerId}
            onChange={(e) => setManagerId(e.target.value.replace(/-/g, ""))}
            placeholder="MCC customer ID if accessing a client account"
          />
        </div>

        <div className="flex justify-between">
          <button
            className="underline text-slate-600"
            onClick={() => router.push("/integrations")}
          >
            Cancel
          </button>
          <button
            disabled={!selected || submitting}
            onClick={handleSubmit}
            className="px-5 py-2.5 bg-blue-600 text-white rounded-lg disabled:opacity-40"
          >
            {submitting ? "Saving…" : "Connect customer"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default dynamic(() => Promise.resolve(SelectGoogleAdsAccount), {
  ssr: false,
});
