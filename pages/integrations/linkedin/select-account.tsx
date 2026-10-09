import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import dynamic from "next/dynamic";
import { supabase } from "@/auth/supabase/client";
import { showError } from "@/app/web/src/components/ui/alert-modal-api";

function SelectLinkedInAccount() {
  const router = useRouter();
  const sessionId = router.query.sessionId as string | undefined;
  const [accounts, setAccounts] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!sessionId) return;
    (async () => {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      const res = await fetch(
        `/api/ads/linkedin/oauth/session?sessionId=${encodeURIComponent(sessionId)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const json = await res.json();
      if (!res.ok) setError(json.message || json.error);
      else {
        setAccounts(json.accounts || []);
        if (json.discoverError) setError(json.discoverError);
      }
      setLoading(false);
    })();
  }, [sessionId]);

  const submit = async () => {
    if (!selected || !sessionId) return;
    setSubmitting(true);
    try {
      const { data } = await supabase.auth.getSession();
      const res = await fetch("/api/ads/linkedin/oauth/finalize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${data.session?.access_token}`,
        },
        body: JSON.stringify({ sessionId, adAccountId: selected }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || json.error);
      router.push(`/integrations?connected=linkedin&status=success`);
    } catch (e: any) {
      showError(e.message);
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        Loading LinkedIn ad accounts…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="text-2xl font-semibold text-center">
          Select LinkedIn Ad Account
        </h1>
        <p className="text-center text-slate-600 text-sm">
          Explicit selection required — no automatic first-account default.
        </p>
        {error && (
          <div className="bg-amber-50 border border-amber-200 text-amber-900 text-sm p-4 rounded-lg">
            {error}
          </div>
        )}
        <div className="bg-white border rounded-xl p-4 space-y-2">
          {!accounts.length && (
            <p className="text-sm text-slate-600">
              No ad accounts returned. Confirm LinkedIn Marketing Developer app
              access and advertising account permissions.
            </p>
          )}
          {accounts.map((a) => (
            <label
              key={a.accountId}
              className={`flex gap-3 p-3 border rounded-lg cursor-pointer ${
                selected === a.accountId ? "border-blue-600 bg-blue-50" : ""
              }`}
            >
              <input
                type="radio"
                checked={selected === a.accountId}
                onChange={() => setSelected(a.accountId)}
              />
              <div>
                <div className="font-medium">{a.name || a.accountId}</div>
                <div className="text-xs text-slate-500">{a.accountId}</div>
              </div>
            </label>
          ))}
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
            onClick={submit}
            className="px-5 py-2.5 bg-blue-600 text-white rounded-lg disabled:opacity-40"
          >
            {submitting ? "Connecting…" : "Connect account"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default dynamic(() => Promise.resolve(SelectLinkedInAccount), {
  ssr: false,
});
