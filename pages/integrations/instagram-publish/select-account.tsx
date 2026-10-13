import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import dynamic from "next/dynamic";
import { showError } from "@/app/web/src/components/ui/alert-modal-api";

type AccountOption = {
  pageId: string;
  pageName: string;
  igUserId: string;
  igUsername: string | null;
  igName: string | null;
  accountType: string | null;
  eligibilitySource?: string | null;
  eligible: boolean;
  ineligibilityReason?: string;
};

function SelectInstagramAccountComponent() {
  const router = useRouter();
  const sessionId = router.isReady
    ? Array.isArray(router.query.sessionId)
      ? router.query.sessionId[0]
      : (router.query.sessionId as string | undefined)
    : undefined;

  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [selectedIgUserId, setSelectedIgUserId] = useState<string | null>(null);

  useEffect(() => {
    if (!router.isReady) return;
    if (!sessionId) {
      setLoading(false);
      setError("Missing session. Please reconnect Instagram.");
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    try {
      if (window.opener && !window.opener.closed) {
        window.opener.postMessage(
          {
            type: "oauth_completed",
            platform: "meta-instagram",
            status: "pending_selection",
            sessionId,
          },
          "*"
        );
      }
    } catch {
      // ignore
    }

    fetch(
      `/api/social/instagram/oauth/session?sessionId=${encodeURIComponent(sessionId)}`
    )
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (data.error) {
          setError(data.message || "Session not found or expired");
          setAccounts([]);
          return;
        }
        if (data.errorType === "NO_INSTAGRAM" || !data.accounts?.length) {
          setError(
            "No Instagram Business/Creator accounts were found linked to your Facebook Pages. Link an Instagram professional account to a Page in Meta Business Suite, then reconnect."
          );
          setAccounts([]);
          return;
        }
        setAccounts(data.accounts);
        const eligible = data.accounts.filter((a: AccountOption) => a.eligible);
        if (eligible.length === 1) {
          setSelectedIgUserId(eligible[0].igUserId);
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e?.message || "Failed to load accounts");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [router.isReady, sessionId]);

  const handleConfirm = async () => {
    if (!sessionId || !selectedIgUserId) {
      showError("Select an Instagram account to continue.");
      return;
    }
    const chosen = accounts.find((a) => a.igUserId === selectedIgUserId);
    if (!chosen?.eligible) {
      showError(chosen?.ineligibilityReason || "Account is not eligible.");
      return;
    }

    setSubmitting(true);
    try {
      const resp = await fetch("/api/social/instagram/oauth/finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, igUserId: selectedIgUserId }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        const parts = [data.message || data.error || "Finalize failed"];
        if (Array.isArray(data.missing) && data.missing.length) {
          parts.push(`Missing: ${data.missing.join(", ")}`);
        }
        throw new Error(parts.join(" — "));
      }

      try {
        if (window.opener && !window.opener.closed) {
          window.opener.postMessage(
            {
              type: "oauth_completed",
              platform: "meta-instagram",
              status: "success",
              igUserId: data.igUserId,
              igUsername: data.igUsername,
            },
            "*"
          );
        }
      } catch {
        // ignore
      }

      if (window.opener) {
        window.close();
      } else {
        router.push("/generated-contents?instagramConnected=1");
      }
    } catch (e: any) {
      showError(e?.message || "Failed to save Instagram connection");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--background,#0b0b0c)] text-[var(--foreground,#f5f5f5)] flex items-center justify-center p-6">
      <div className="w-full max-w-lg space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Choose an Instagram account
          </h1>
          <p className="mt-2 text-sm text-neutral-400">
            Select the Instagram Business or Creator account linked to a
            Facebook Page. Your Meta Ads and Facebook Page publishing
            connections are unchanged.
          </p>
        </div>

        {loading && <p className="text-sm text-neutral-400">Loading accounts…</p>}

        {error && (
          <div className="rounded-md border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        )}

        {!loading && !error && (
          <ul className="space-y-2">
            {accounts.map((account) => (
              <li key={account.igUserId}>
                <button
                  type="button"
                  disabled={!account.eligible}
                  onClick={() => setSelectedIgUserId(account.igUserId)}
                  className={`w-full text-left rounded-md border px-4 py-3 transition ${
                    selectedIgUserId === account.igUserId
                      ? "border-sky-500 bg-sky-500/10"
                      : "border-neutral-700 hover:border-neutral-500"
                  } ${!account.eligible ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  <div className="font-medium">
                    {account.igUsername
                      ? `@${account.igUsername}`
                      : `Instagram ID ${account.igUserId}`}
                  </div>
                  <div className="text-xs text-neutral-400 mt-0.5">
                    Linked Facebook Page: {account.pageName}
                    {account.eligibilitySource ===
                    "page_instagram_business_account"
                      ? " · Professional (Page-linked)"
                      : ""}
                  </div>
                  <div className="text-[10px] text-neutral-500 mt-0.5 font-mono">
                    IG {account.igUserId}
                    {account.pageId !== account.igUserId
                      ? ` · Page ${account.pageId}`
                      : ""}
                  </div>
                  {!account.eligible && account.ineligibilityReason && (
                    <div className="text-xs text-amber-300 mt-1">
                      {account.ineligibilityReason}
                    </div>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            disabled={!selectedIgUserId || submitting || !!error}
            onClick={handleConfirm}
            className="flex-1 rounded-md bg-sky-600 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-40 hover:bg-sky-500"
          >
            {submitting ? "Saving…" : "Connect Instagram"}
          </button>
          <button
            type="button"
            onClick={() => {
              if (window.opener) window.close();
              else router.push("/generated-contents");
            }}
            className="rounded-md border border-neutral-700 px-4 py-2.5 text-sm text-neutral-300 hover:border-neutral-500"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export default dynamic(() => Promise.resolve(SelectInstagramAccountComponent), {
  ssr: false,
});
