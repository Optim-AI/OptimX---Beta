import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import dynamic from "next/dynamic";
import { showError } from "@/app/web/src/components/ui/alert-modal-api";

type PageOption = {
  id: string;
  name: string;
  category?: string;
  hasPageToken?: boolean;
};

function SelectPublishPageComponent() {
  const router = useRouter();
  const sessionId = router.isReady
    ? Array.isArray(router.query.sessionId)
      ? router.query.sessionId[0]
      : (router.query.sessionId as string | undefined)
    : undefined;

  const [pages, setPages] = useState<PageOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);

  useEffect(() => {
    if (!router.isReady) return;

    if (!sessionId) {
      setLoading(false);
      setError("Missing session. Please reconnect Facebook Page publishing.");
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
            platform: "meta-publish",
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
      `/api/social/facebook/oauth/session?sessionId=${encodeURIComponent(sessionId)}`
    )
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (data.error) {
          setError(data.message || "Session not found or expired");
          setPages([]);
          return;
        }
        if (data.errorType === "NO_PAGES" || !data.pages?.length) {
          setError(
            "No Facebook Pages were returned. Ensure you manage at least one Page and granted pages_show_list."
          );
          setPages([]);
          return;
        }
        setPages(data.pages);
        if (data.pages.length === 1) {
          setSelectedPageId(data.pages[0].id);
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e?.message || "Failed to load pages");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [router.isReady, sessionId]);

  const handleConfirm = async () => {
    if (!sessionId || !selectedPageId) {
      showError("Select a Facebook Page to continue.");
      return;
    }

    setSubmitting(true);
    try {
      const resp = await fetch("/api/social/facebook/oauth/finalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, pageId: selectedPageId }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        const parts = [
          data.message || data.error || "Finalize failed",
        ];
        if (Array.isArray(data.missing) && data.missing.length > 0) {
          parts.push(`Missing: ${data.missing.join(", ")}`);
        }
        if (Array.isArray(data.granted) && data.granted.length > 0) {
          parts.push(`Granted: ${[...data.granted].sort().join(", ")}`);
        }
        const diag = data.diagnostics;
        if (diag?.requiredDetected) {
          parts.push(
            `Detected pages_show_list=${Boolean(diag.requiredDetected.pages_show_list)}, ` +
              `pages_manage_posts=${Boolean(diag.requiredDetected.pages_manage_posts)}`
          );
        }
        throw new Error(parts.join(" — "));
      }

      try {
        if (window.opener && !window.opener.closed) {
          window.opener.postMessage(
            {
              type: "oauth_completed",
              platform: "meta-publish",
              status: "success",
              pageId: data.pageId,
              pageName: data.pageName,
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
        router.push("/generated-contents?publishConnected=1");
      }
    } catch (e: any) {
      showError(e?.message || "Failed to save publishing connection");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--background,#0b0b0c)] text-[var(--foreground,#f5f5f5)] flex items-center justify-center p-6">
      <div className="w-full max-w-lg space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Choose a Page to publish
          </h1>
          <p className="mt-2 text-sm text-neutral-400">
            This authorizes organic Facebook Page posts only. Your Meta Ads
            connection is unchanged.
          </p>
        </div>

        {loading && (
          <p className="text-sm text-neutral-400">Loading Pages…</p>
        )}

        {error && (
          <div className="rounded-md border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        )}

        {!loading && !error && (
          <ul className="space-y-2">
            {pages.map((page) => (
              <li key={page.id}>
                <button
                  type="button"
                  onClick={() => setSelectedPageId(page.id)}
                  className={`w-full text-left rounded-md border px-4 py-3 transition ${
                    selectedPageId === page.id
                      ? "border-sky-500 bg-sky-500/10"
                      : "border-neutral-700 hover:border-neutral-500"
                  }`}
                >
                  <div className="font-medium">{page.name}</div>
                  {page.category && (
                    <div className="text-xs text-neutral-400 mt-0.5">
                      {page.category}
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
            disabled={!selectedPageId || submitting || !!error}
            onClick={handleConfirm}
            className="flex-1 rounded-md bg-sky-600 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-40 hover:bg-sky-500"
          >
            {submitting ? "Saving…" : "Connect Page"}
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

export default dynamic(() => Promise.resolve(SelectPublishPageComponent), {
  ssr: false,
});
