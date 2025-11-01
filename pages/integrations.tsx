// pages/integrations.tsx
import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import Sidebar from "../app/web/src/components/Sidebar";

type Platform = {
  id: string;
  name: string;
  icon: string;
  authPath?: string;
};

const PLATFORMS: Platform[] = [
  { id: "meta", name: "Meta (Instagram/Facebook)", icon: "📘", authPath: "/api/auth/instagram/start" },
  { id: "google-ads", name: "Google Ads", icon: "🔍", authPath: "/api/auth/google-ads/start" },
  { id: "whatsapp", name: "WhatsApp Business", icon: "💬", authPath: "/api/auth/whatsapp/start" },
  { id: "linkedin", name: "LinkedIn", icon: "💼", authPath: "/api/auth/linkedin/start" },
  { id: "twitter", name: "Twitter", icon: "🐦", authPath: "/api/auth/twitter/start" },
];

export default function IntegrationsPage() {
  const router = useRouter();
  const [statuses, setStatuses] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const popupRef = useRef<Window | null>(null);
  const pollRef = useRef<number | null>(null);
  const LS_KEY = "integrations_status_v1";

  // Tracks if we've observed the popup go cross-origin for a given platform
  const crossOriginSeen = useRef<Record<string, boolean>>({});

  function isPopupClosed(popup: Window | null) {
    try {
      return !popup || popup.closed;
    } catch (e) {
      // Access may throw because of COOP/COEP; in that case treat as closed for safety
      return true;
    }
  }

  const fetchStatuses = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/integrations/status", { credentials: "include" });
      if (!res.ok) throw new Error("status endpoint returned " + res.status);
      const data = await res.json();
      setStatuses(data || {});
      if (typeof window !== "undefined") localStorage.setItem(LS_KEY, JSON.stringify(data || {}));
    } catch (err) {
      // fallback to localStorage if server unreachable or cookies missing
      if (typeof window !== "undefined") {
        const raw = localStorage.getItem(LS_KEY);
        if (raw) {
          try {
            setStatuses(JSON.parse(raw));
          } catch {
            initStatusesFallback();
          }
        } else initStatusesFallback();
      } else {
        initStatusesFallback();
      }
    } finally {
      setLoading(false);
    }
  };

  const initStatusesFallback = () => {
    const initial: Record<string, boolean> = {};
    PLATFORMS.forEach((p) => (initial[p.id] = false));
    setStatuses(initial);
    if (typeof window !== "undefined") localStorage.setItem(LS_KEY, JSON.stringify(initial));
  };

  useEffect(() => {
    fetchStatuses();

    // postMessage listener (if a callback sends a message)
    const onMessage = (e: MessageEvent) => {
      try {
        const data = e.data;
        if (!data) return;
        if (data.type === "oauth_connected" && data.platform) {
          const platformId = data.platform as string;
          setStatuses((s) => {
            const next = { ...s, [platformId]: true };
            localStorage.setItem(LS_KEY, JSON.stringify(next));
            return next;
          });

          if (popupRef.current && !popupRef.current.closed) {
            try {
              popupRef.current.close();
            } catch {}
            popupRef.current = null;
          }
          localStorage.removeItem("pending_connect");
          setMessage(`${platformId} connected`);
          setTimeout(() => setMessage(null), 2500);
          if (data.redirect) {
            try {
              router.push(data.redirect);
            } catch (err) {
              console.warn("redirect failed", err);
            }
          }
        }
      } catch (err) {
        console.warn("Ignored message", err);
      }
    };
    window.addEventListener("message", onMessage);

    // fallback: if URL contains ?connected=platform-id on page load
    if (router.isReady) {
      const q = router.query.connected as string | undefined;
      if (q) {
        setStatuses((s) => {
          const next = { ...s, [q]: true };
          if (typeof window !== "undefined") localStorage.setItem(LS_KEY, JSON.stringify(next));
          return next;
        });
        const { connected, ...rest } = router.query;
        router.replace({ pathname: router.pathname, query: rest }, undefined, { shallow: true });
        setMessage(`${q} connected successfully`);
        setTimeout(() => setMessage(null), 3000);
      }
    }

    // resume polling if a pending connect was saved (page reload while popup open)
    if (typeof window !== "undefined") {
      const pending = localStorage.getItem("pending_connect");
      if (pending) pollStatusFor(pending);
    }

    return () => {
      window.removeEventListener("message", onMessage);
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady]);

  const openPopup = (url: string, name = "oauth_popup") => {
    const w = 900;
    const h = 700;
    const left = window.screenX + (window.innerWidth - w) / 2;
    const top = window.screenY + (window.innerHeight - h) / 2;
    const opts = `width=${w},height=${h},left=${left},top=${top},resizable=yes,scrollbars=yes,status=yes`;
    const absolute = new URL(url, window.location.origin).toString();
    const popup = window.open(absolute, name, opts);
    if (popup) {
      try {
        popup.focus();
      } catch {}
    }
    return popup;
  };

  // Polling with cross-origin detection and optimistic fallback for test accounts
  const pollStatusFor = (platformId: string, timeoutMs = 60_000) => {
    const start = Date.now();
    if (pollRef.current) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
    // reset cross-origin hint for this run
    crossOriginSeen.current[platformId] = false;

    pollRef.current = window.setInterval(async () => {
      try {
        // If popup is closed: handle fallback logic
        if (isPopupClosed(popupRef.current)) {
          // If we saw cross-origin navigation before, assume flow completed — optimistic update
          if (crossOriginSeen.current[platformId]) {
            setStatuses((s) => {
              const next = { ...s, [platformId]: true };
              if (typeof window !== "undefined") localStorage.setItem(LS_KEY, JSON.stringify(next));
              return next;
            });
            localStorage.removeItem("pending_connect");
            setMessage(`${platformId} connected`);
            setTimeout(() => setMessage(null), 2500);
          } else {
            // otherwise try to fetch server statuses
            await fetchStatuses();
          }

          window.clearInterval(pollRef.current!);
          pollRef.current = null;
          popupRef.current = null;
          return;
        }

        // Try to read popup.location.href (works if same-origin). This allows immediate detection
        // of the redirect to /integrationsGoogle or ?connected=... without needing postMessage.
        try {
          if (popupRef.current) {
            const href = popupRef.current.location.href;
            if (href) {
              try {
                const u = new URL(href);
                // if a popup navigated to '/integrationsGoogle' path we can assume success
                if (u.pathname && u.pathname.includes("/integrationsGoogle")) {
                  setStatuses((s) => {
                    const next = { ...s, [platformId]: true };
                    if (typeof window !== "undefined") localStorage.setItem(LS_KEY, JSON.stringify(next));
                    return next;
                  });
                  if (popupRef.current && !popupRef.current.closed) {
                    try {
                      popupRef.current.close();
                    } catch {}
                    popupRef.current = null;
                  }
                  localStorage.removeItem("pending_connect");
                  setMessage(`${platformId} connected`);
                  setTimeout(() => setMessage(null), 2500);
                  window.clearInterval(pollRef.current!);
                  pollRef.current = null;
                  return;
                }
                // also support explicit ?connected=platform fallback
                const q = u.searchParams.get("connected");
                if (q === platformId) {
                  setStatuses((s) => {
                    const next = { ...s, [platformId]: true };
                    if (typeof window !== "undefined") localStorage.setItem(LS_KEY, JSON.stringify(next));
                    return next;
                  });
                  if (popupRef.current && !popupRef.current.closed) {
                    try {
                      popupRef.current.close();
                    } catch {}
                    popupRef.current = null;
                  }
                  localStorage.removeItem("pending_connect");
                  setMessage(`${platformId} connected`);
                  setTimeout(() => setMessage(null), 2500);
                  window.clearInterval(pollRef.current!);
                  pollRef.current = null;
                  return;
                }
              } catch {
                // ignore URL parse errors
              }
            }
          }
        } catch (err) {
          // Access threw -> cross-origin navigation occurred
          crossOriginSeen.current[platformId] = true;
        }

        // Regular status check from server (credentials included)
        const res = await fetch("/api/integrations/status", { credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          setStatuses((s) => ({ ...s, ...(data || {}) }));
          if (data && data[platformId]) {
            setMessage(`${platformId} connected`);
            if (popupRef.current && !popupRef.current.closed) {
              try {
                popupRef.current.close();
              } catch {}
            }
            localStorage.removeItem("pending_connect");
            window.clearInterval(pollRef.current!);
            pollRef.current = null;
            popupRef.current = null;
            setTimeout(() => setMessage(null), 2500);
            return;
          }
        } else {
          // non-OK response (e.g., 401) — if we saw cross-origin for this platform, assume success (test account flow)
          if (crossOriginSeen.current[platformId] && isPopupClosed(popupRef.current)) {
            setStatuses((s) => {
              const next = { ...s, [platformId]: true };
              if (typeof window !== "undefined") localStorage.setItem(LS_KEY, JSON.stringify(next));
              return next;
            });
            localStorage.removeItem("pending_connect");
            setMessage(`${platformId} connected`);
            setTimeout(() => setMessage(null), 2500);
            window.clearInterval(pollRef.current!);
            pollRef.current = null;
            popupRef.current = null;
            return;
          }
        }
      } catch (err) {
        // ignore transient errors
        // console.warn('poll error', err);
      }

      if (Date.now() - start > timeoutMs) {
        setMessage("Sign-in timed out — try again");
        if (popupRef.current && !popupRef.current.closed) {
          try {
            popupRef.current.close();
          } catch {}
        }
        localStorage.removeItem("pending_connect");
        window.clearInterval(pollRef.current!);
        pollRef.current = null;
        popupRef.current = null;
        setTimeout(() => setMessage(null), 2500);
      }
    }, 1200);
  };

  const handleConnect = (platform: Platform) => {
    if (!platform.authPath) {
      setStatuses((s) => {
        const next = { ...s, [platform.id]: true };
        if (typeof window !== "undefined") localStorage.setItem(LS_KEY, JSON.stringify(next));
        return next;
      });
      setMessage(`${platform.name} connected (local demo)`);
      setTimeout(() => setMessage(null), 2000);
      return;
    }

    try {
      const popup = openPopup(platform.authPath, `oauth_${platform.id}`);
      popupRef.current = popup;
      if (typeof window !== "undefined") localStorage.setItem("pending_connect", platform.id);
      pollStatusFor(platform.id);
    } catch {
      setMessage("Failed to open OAuth popup. Please allow popups for this site.");
      setTimeout(() => setMessage(null), 3000);
    }
  };

  const handleDisconnect = async (platformId: string) => {
    try {
      await fetch("/api/integrations/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform: platformId }),
        credentials: "include",
      });
      await fetchStatuses();
      setMessage("Disconnected");
      setTimeout(() => setMessage(null), 2000);
    } catch (err) {
      console.error(err);
      setMessage("Failed to disconnect");
      setTimeout(() => setMessage(null), 2000);
    }
  };

  return (
    <div className="min-h-screen flex bg-slate-50">
      <Sidebar />

      <main className="flex-1 p-8">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-slate-800">Integrations</h2>
          <p className="text-sm text-slate-500">Connect your marketing platforms securely with encrypted tokens.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {PLATFORMS.map((platform) => {
            const connected = !!statuses[platform.id];
            return (
              <div key={platform.id} className="flex items-center justify-between p-5 rounded-xl border bg-white shadow-sm">
                <div className="flex items-center space-x-4">
                  <span className="text-2xl">{platform.icon}</span>
                  <div>
                    <h3 className="text-md font-semibold text-slate-800">{platform.name}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${connected ? "text-green-800 bg-green-100" : "text-red-600 bg-red-100"}`}>
                      {connected ? "Connected" : "Disconnected"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {!connected ? (
                    <button onClick={() => handleConnect(platform)} className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700">
                      + Connect
                    </button>
                  ) : (
                    <button onClick={() => handleDisconnect(platform.id)} className="px-4 py-2 rounded-lg bg-gray-200 text-sm font-medium hover:bg-gray-300">
                      Connected
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-8 p-5 rounded-xl border bg-blue-50 text-slate-700 shadow-sm">
          <h3 className="font-semibold">🔒 Security Notice</h3>
          <p className="text-sm mt-2">
            API tokens should be stored server-side and encrypted at rest. For production: tighten postMessage origins, use PKCE and server-side token exchange, and store refresh tokens in a DB.
          </p>
        </div>

        <div className="mt-4 text-sm text-slate-500">
          {loading ? "Checking integration status..." : "Status synced."}
          {message && <div className="mt-2 text-sm text-green-700">{message}</div>}
        </div>
      </main>
    </div>
  );
}
