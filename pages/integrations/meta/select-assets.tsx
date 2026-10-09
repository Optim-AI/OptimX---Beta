// pages/integrations/meta/select-assets.tsx
import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import dynamic from "next/dynamic";
import { showError } from "@/app/web/src/components/ui/alert-modal-api";

type PageOption = {
  id: string;
  name: string;
  category?: string;
  igUserId?: string | null;
};

type AdAccountOption = {
  id: string;
  name?: string | null;
  currency?: string | null;
  timezone?: string | null;
  status?: string | null;
};

function SelectMetaAssetsComponent() {
  const router = useRouter();
  const sessionId = router.isReady
    ? (Array.isArray(router.query.sessionId)
        ? router.query.sessionId[0]
        : (router.query.sessionId as string | undefined))
    : undefined;

  const [pages, setPages] = useState<PageOption[]>([]);
  const [adAccounts, setAdAccounts] = useState<AdAccountOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [selectedAdAccountId, setSelectedAdAccountId] = useState<string | null>(
    null
  );

  useEffect(() => {
    // Wait for Pages Router query hydration — otherwise OAuth redirects load
    // with sessionId undefined and never fetch assets.
    if (!router.isReady) return;

    if (!sessionId) {
      setLoading(false);
      setError("Missing session. Please reconnect Meta Ads.");
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    // Notify parent popup opener that OAuth succeeded but selection is required
    try {
      if (window.opener && !window.opener.closed) {
        window.opener.postMessage(
          {
            type: "oauth_completed",
            platform: "meta",
            status: "pending_selection",
            sessionId,
          },
          "*"
        );
      }
    } catch {
      // ignore
    }

    fetch(`/api/meta/oauth/session?sessionId=${encodeURIComponent(sessionId)}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (data.error) {
          setError(data.message || "Session not found or expired");
          setPages([]);
          setAdAccounts([]);
          return;
        }
        // Dedicated empty-page flow (do not render select-assets empty lists)
        if (data.errorType === "NO_PAGES" || !(data.pages || []).length) {
          router.replace(
            `/integrations/meta/no-pages?sessionId=${encodeURIComponent(sessionId)}`
          );
          return;
        }
        setPages(data.pages || []);
        setAdAccounts(data.adAccounts || []);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error(err);
        setError("Failed to load session data");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // Intentionally omit `router` object identity — it changes often and was
    // cancelling the session fetch before assets could render.
  }, [router.isReady, sessionId]);

  const canSubmit =
    !!selectedPageId && !!selectedAdAccountId && !submitting && !!sessionId;

  const handleConnect = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/meta/oauth/finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          pageId: selectedPageId,
          adAccountId: selectedAdAccountId,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || data.error || "Failed to connect");
      }

      const successPath =
        `/integrations?connected=meta&status=success` +
        `&page=${encodeURIComponent(data.integration.pageName || "")}` +
        `&adAccount=${encodeURIComponent(data.integration.adAccountId || "")}`;

      try {
        if (window.opener && !window.opener.closed) {
          window.opener.postMessage(
            {
              type: "oauth_completed",
              platform: "meta",
              status: "success",
              redirect: successPath,
              integration: {
                pageName: data.integration.pageName || null,
                adAccountId: data.integration.adAccountId || null,
              },
              syncOk: data.sync?.ok === true,
            },
            "*"
          );
          window.close();
          return;
        }
      } catch {
        // fall through to same-window redirect
      }

      router.push(successPath);
    } catch (err: any) {
      showError(`Failed to connect: ${err.message}`);
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-slate-600">Loading your Meta assets…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow p-8 text-center">
          <h1 className="text-xl font-semibold mb-3">Session error</h1>
          <p className="text-slate-600 mb-6">{error}</p>
          <button
            className="px-4 py-2 bg-blue-600 text-white rounded-lg"
            onClick={() => router.push("/integrations")}
          >
            Back to Integrations
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4">
      <div className="max-w-3xl mx-auto space-y-8">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-slate-900">
            Select Meta assets
          </h1>
          <p className="text-slate-600 mt-2">
            Choose a Facebook Page and an Ad Account. Nothing is selected
            automatically.
          </p>
        </div>

        <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="font-semibold text-slate-900 mb-1">Facebook Page</h2>
          <p className="text-sm text-slate-500 mb-4">
            Required for publishing and Page-linked assets.
          </p>
          {!pages.length ? (
            <p className="text-amber-700 text-sm">
              No Pages found. Create a Page in Meta Business Suite, then
              reconnect. Some permissions may still be pending review.
            </p>
          ) : (
            <div className="space-y-2">
              {pages.map((p) => (
                <label
                  key={p.id}
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer ${
                    selectedPageId === p.id
                      ? "border-blue-600 bg-blue-50"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <input
                    type="radio"
                    name="page"
                    checked={selectedPageId === p.id}
                    onChange={() => setSelectedPageId(p.id)}
                    className="mt-1"
                  />
                  <div>
                    <div className="font-medium text-slate-900">{p.name}</div>
                    <div className="text-xs text-slate-500">
                      ID {p.id}
                      {p.category ? ` · ${p.category}` : ""}
                      {p.igUserId ? " · Instagram linked" : ""}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          )}
        </section>

        <section className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="font-semibold text-slate-900 mb-1">Ad Account</h2>
          <p className="text-sm text-slate-500 mb-4">
            Required for campaign performance sync. You must pick one explicitly.
          </p>
          {!adAccounts.length ? (
            <div className="text-sm text-amber-800 space-y-2">
              <p>No Ad Accounts were returned for this login.</p>
              <ul className="list-disc pl-5 space-y-1">
                <li>
                  Confirm your user is assigned to an Ad Account in Business
                  Manager.
                </li>
                <li>
                  <code className="text-xs">ads_read</code> /{" "}
                  <code className="text-xs">ads_management</code> may still be
                  in development mode or pending App Review.
                </li>
                <li>
                  Add your account as a tester in the Meta developer app while
                  advanced access is pending.
                </li>
              </ul>
            </div>
          ) : (
            <div className="space-y-2">
              {adAccounts.map((a) => (
                <label
                  key={a.id}
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer ${
                    selectedAdAccountId === a.id
                      ? "border-blue-600 bg-blue-50"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <input
                    type="radio"
                    name="adAccount"
                    checked={selectedAdAccountId === a.id}
                    onChange={() => setSelectedAdAccountId(a.id)}
                    className="mt-1"
                  />
                  <div>
                    <div className="font-medium text-slate-900">
                      {a.name || `Ad Account ${a.id}`}
                    </div>
                    <div className="text-xs text-slate-500">
                      act_{a.id}
                      {a.currency ? ` · ${a.currency}` : ""}
                      {a.timezone ? ` · ${a.timezone}` : ""}
                      {a.status != null ? ` · status ${a.status}` : ""}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          )}
        </section>

        <div className="flex items-center justify-between gap-4">
          <button
            type="button"
            className="text-slate-600 underline"
            onClick={() => router.push("/integrations")}
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={handleConnect}
            className="px-5 py-2.5 rounded-lg bg-blue-600 text-white font-medium disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting ? "Connecting…" : "Connect selected assets"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default dynamic(() => Promise.resolve(SelectMetaAssetsComponent), {
  ssr: false,
});
