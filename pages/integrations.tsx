// pages/integrations.tsx
"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";

import Sidebar from "../app/web/src/components/Sidebar";
import { Card, CardContent } from "../app/web/src/components/ui/card";
import { Button } from "../app/web/src/components/ui/button";
import { Check, X, Facebook } from "lucide-react";

import { supabase } from "../lib/supabaseClient";
import { apiFetch } from "../lib/apiFetch";

// exact path you provided — do NOT change
import colors from "../lib/colors";

/* ---------- Platforms (UI names + backend authPaths) ---------- */
type Platform = {
  id: string;
  name: string;
  icon: React.ReactNode;
  authPath?: string;
  desc?: string;
};

const PLATFORMS: Platform[] = [
  {
    id: "meta",
    name: "Meta Ads",
    icon: <Facebook className="w-10 h-10 text-[#0866FF]" />, // ✔ Meta icon
    authPath: "/api/auth/instagram/start",
    desc: "Facebook & Instagram ads",
  },
];

/* ---------- color tokens from your file (graceful fallback) ---------- */
const {
  green100,
  green600,
  green900,
  muted,
  mutedForeground,
  gradientPrimary,
} = (colors as any) || {};

export default function IntegrationsPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);

  // statuses are per-user now; key is platform -> boolean
  const [statuses, setStatuses] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const popupRef = useRef<Window | null>(null);
  const pollRef = useRef<number | null>(null);
  const crossOriginSeen = useRef<Record<string, boolean>>({});

  const isPopupClosed = (popup: Window | null) => {
    try {
      return !popup || popup.closed;
    } catch {
      return true;
    }
  };

  // Namespaced LS key per user to avoid cross-user leakage
  const LS_KEY_FOR = (uid: string | null) => `integrations_status_v1:${uid ?? "anon"}`;

  /* ---------- get signed-in user ---------- */
  const ensureUser = async (): Promise<string | null> => {
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error) {
        console.error("supabase.auth.getUser error:", error);
        return null;
      }
      const u = (data as any)?.user ?? null;
      if (!u) return null;
      return u.id as string;
    } catch (err) {
      console.error("getUser failed:", err);
      return null;
    }
  };

  /* ---------- Fetch integration status (user scoped) ---------- */
  const fetchStatuses = async (uid: string | null) => {
    setLoading(true);
    if (!uid) {
      setStatuses({});
      setLoading(false);
      return;
    }

    const userScopedApi = (path: string) => {
      // append userId to ensure server reads user-scoped data
      const sep = path.includes("?") ? "&" : "?";
      return `${path}${sep}userId=${encodeURIComponent(uid)}`;
    };

    // 1) Prefer server API (user-scoped)
    try {
      const res = await apiFetch(userScopedApi("/api/integrations/status"));
      if (res.ok) {
        const data = await res.json();
        const next: Record<string, boolean> = {};
        PLATFORMS.forEach((p) => (next[p.id] = !!data[p.id]));
        setStatuses(next);
        try {
          localStorage.setItem(LS_KEY_FOR(uid), JSON.stringify(next));
        } catch {}
        setLoading(false);
        return;
      } else {
        console.warn("user-scoped /api/integrations/status returned non-ok", res.status);
      }
    } catch (err) {
      console.debug("user-scoped status fetch failed, falling back to local cache", err);
    }

    // 2) LocalStorage fallback (user-scoped)
    try {
      const raw = localStorage.getItem(LS_KEY_FOR(uid));
      if (raw) {
        setStatuses(JSON.parse(raw));
        setLoading(false);
        return;
      }
    } catch (err) {
      console.debug("localStorage read failed:", err);
    }

    // 3) Default: mark all false for safety
    const initial: Record<string, boolean> = {};
    PLATFORMS.forEach((p) => (initial[p.id] = false));
    setStatuses(initial);
    try {
      localStorage.setItem(LS_KEY_FOR(uid), JSON.stringify(initial));
    } catch {}
    setLoading(false);
  };

  /* ---------- Popup + OAuth polling (user scoped) ---------- */
  const openPopup = (url: string, name = "oauth_popup") => {
    const w = 900,
      h = 700;
    const left = window.screenX + (window.innerWidth - w) / 2;
    const top = window.screenY + (window.innerHeight - h) / 2;
    const opts = `width=${w},height=${h},left=${left},top=${top},resizable=yes,scrollbars=yes,status=yes`;
    const absolute = new URL(url, window.location.origin).toString();
    const popup = window.open(absolute, name, opts);
    if (popup) try { popup.focus(); } catch {}
    return popup;
  };

  const pollStatusFor = (platformId: string, uid: string | null, timeoutMs = 60000) => {
    const start = Date.now();
    crossOriginSeen.current[platformId] = false;

    if (pollRef.current) clearInterval(pollRef.current);

    pollRef.current = window.setInterval(async () => {
      try {
        if (isPopupClosed(popupRef.current)) {
          // popup closed — check if cross-origin handshake happened
          if (crossOriginSeen.current[platformId]) {
            setStatuses((s) => {
              const next = { ...s, [platformId]: true };
              try { if (uid) localStorage.setItem(LS_KEY_FOR(uid), JSON.stringify(next)); } catch {}
              return next;
            });
            localStorage.removeItem("pending_connect");
            setMessage(`${platformId} connected`);
            setTimeout(() => setMessage(null), 2000);
          } else {
            // try fetching server-side user-scoped statuses once more
            await fetchStatuses(uid);
          }

          clearInterval(pollRef.current!);
          pollRef.current = null;
          popupRef.current = null;
          return;
        }

        try {
          // try to inspect popup's location for success query param (if same-origin)
          if (popupRef.current?.location?.href) {
            const u = new URL(popupRef.current.location.href);
            const q = u.searchParams.get("connected");
            if (q === platformId) {
              setStatuses((s) => {
                const next = { ...s, [platformId]: true };
                try { if (uid) localStorage.setItem(LS_KEY_FOR(uid), JSON.stringify(next)); } catch {}
                return next;
              });
              popupRef.current.close();
              popupRef.current = null;
              localStorage.removeItem("pending_connect");
              setMessage(`${platformId} connected`);
              setTimeout(() => setMessage(null), 2000);
              clearInterval(pollRef.current!);
              pollRef.current = null;
              return;
            }
          }
        } catch {
          // cross-origin — mark that we've seen cross-origin and rely on server-side flags
          crossOriginSeen.current[platformId] = true;
        }

        // Query user-scoped status API
        try {
          const uidSuffix = uid ? `?userId=${encodeURIComponent(uid)}` : "";
          const res = await apiFetch(`/api/integrations/status${uidSuffix}`);
          if (res.ok) {
            const data = await res.json();
            if (data[platformId]) {
              setStatuses((s) => {
                const next = { ...s, [platformId]: true };
                try { if (uid) localStorage.setItem(LS_KEY_FOR(uid), JSON.stringify(next)); } catch {}
                return next;
              });
              localStorage.removeItem("pending_connect");
              popupRef.current?.close?.();
              setMessage(`${platformId} connected`);
              setTimeout(() => setMessage(null), 2000);
              clearInterval(pollRef.current!);
              pollRef.current = null;
              return;
            }
          }
        } catch {}
      } catch {}

      if (Date.now() - start > timeoutMs) {
        setMessage("Sign-in timed out");
        popupRef.current?.close?.();
        localStorage.removeItem("pending_connect");
        clearInterval(pollRef.current!);
        pollRef.current = null;
        popupRef.current = null;
        setTimeout(() => setMessage(null), 2000);
      }
    }, 1200);
  };

  /* ---------- Supabase token (used for popup query param) ---------- */
  const getSupabaseAccessToken = async (): Promise<string | null> => {
    try {
      const { data } = await supabase.auth.getSession();
      return (data as any)?.session?.access_token ?? null;
    } catch {
      return null;
    }
  };

  /* ---------- Connect (popup) ---------- */
  const handleConnect = async (platform: Platform) => {
    if (!platform.authPath) return;
    if (!userId) {
      setMessage("Please sign in first");
      setTimeout(() => setMessage(null), 2000);
      return;
    }

    try {
      let url = platform.authPath;
      const token = await getSupabaseAccessToken();

      try {
        const u = new URL(platform.authPath, window.location.origin);
        if (token) u.searchParams.set("sb", token);
        // mark user in popup flow (server should respect current session or userId)
        u.searchParams.set("userId", userId);
        url = u.toString();
      } catch {}

      const popup = openPopup(url, `oauth_${platform.id}`);
      popupRef.current = popup;
      localStorage.setItem("pending_connect", platform.id);
      pollStatusFor(platform.id, userId);
    } catch {
      setMessage("Popup blocked — allow popups");
      setTimeout(() => setMessage(null), 2500);
    }
  };

  /* ---------- Disconnect (user scoped) ---------- */
  const handleDisconnect = async (platformId: string) => {
    if (!userId) {
      setMessage("Please sign in first");
      setTimeout(() => setMessage(null), 2000);
      return;
    }

    try {
      const res = await apiFetch("/api/integrations/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform: platformId, userId }),
      });

      if (!res.ok) throw new Error("disconnect failed");
      await fetchStatuses(userId);
      setMessage("Disconnected");
      setTimeout(() => setMessage(null), 2000);
    } catch (err) {
      console.error("disconnect error:", err);
      setMessage("Failed to disconnect");
      setTimeout(() => setMessage(null), 2000);
    }
  };

  /* ---------- Effects ---------- */
  useEffect(() => {
    (async () => {
      const uid = await ensureUser();
      if (!uid) {
        // redirect to signin if not authenticated
        router.push("/auth/signin");
        return;
      }
      setUserId(uid);
      await fetchStatuses(uid);
    })();

    const onMessage = (e: MessageEvent) => {
      try {
        const data = e.data;
        if (data?.type === "oauth_connected" && data.platform && data.userId) {
          // only accept messages that match current user
          if (userId && data.userId !== userId) return;

          const p = data.platform;
          setStatuses((s) => {
            const next = { ...s, [p]: true };
            try { if (userId) localStorage.setItem(LS_KEY_FOR(userId), JSON.stringify(next)); } catch {}
            return next;
          });
          popupRef.current?.close?.();
          popupRef.current = null;
          localStorage.removeItem("pending_connect");
          setMessage(`${p} connected`);
          setTimeout(() => setMessage(null), 2000);
          if (data.redirect) router.push(data.redirect);
        }
      } catch {}
    };

    window.addEventListener("message", onMessage);

    return () => {
      window.removeEventListener("message", onMessage);
      if (pollRef.current) clearInterval(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  /* ---------- UI ---------- */
  return (
    <div className="min-h-screen flex bg-slate-50">
      <Sidebar />

      <main className="flex-1 p-8">
        <div className="p-6 space-y-6">
          <div>
            <h1 className="text-3xl font-bold mb-2">Integrations</h1>
            <p
              className={!mutedForeground ? "text-muted-foreground" : ""}
              style={mutedForeground ? { color: mutedForeground } : undefined}
            >
              Connect your advertising platforms and tools
            </p>
          </div>

          {/* Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {PLATFORMS.map((platform, i) => {
              const connected = !!statuses[platform.id];

              const statusBg = connected ? green100 : muted;
              const statusIconColor = connected ? green600 : mutedForeground;

              const connectBtnStyle =
                !connected && gradientPrimary
                  ? { background: gradientPrimary, border: "none" }
                  : undefined;

              return (
                <Card
                  key={i}
                  className="glass-card hover:shadow-2xl transition-all"
                  style={{
                    boxShadow: "0 8px 32px rgba(0,0,0,0.22)", // ✔ deeper shadow you wanted
                  }}
                >
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between mb-4">
                      <div>{platform.icon}</div>

                      <div
                        className="p-2 rounded-full"
                        style={{
                          backgroundColor: statusBg || undefined,
                        }}
                      >
                        {connected ? (
                          <Check
                            className="w-4 h-4"
                            style={{ color: statusIconColor || undefined }}
                          />
                        ) : (
                          <X
                            className="w-4 h-4"
                            style={{ color: statusIconColor || undefined }}
                          />
                        )}
                      </div>
                    </div>

                    <h3 className="text-xl font-bold mb-2">{platform.name}</h3>

                    <p
                      className={`text-sm mb-4 ${
                        !mutedForeground ? "text-muted-foreground" : ""
                      }`}
                      style={mutedForeground ? { color: mutedForeground } : {}}
                    >
                      {platform.desc}
                    </p>

                    <Button
                      variant={connected ? "outline" : "default"}
                      className="w-full"
                      style={!connected ? connectBtnStyle : undefined}
                      onClick={() =>
                        connected
                          ? handleDisconnect(platform.id)
                          : handleConnect(platform)
                      }
                    >
                      {connected ? "Disconnect" : "Connect"}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        <div className="mt-4 text-sm text-slate-500">
          {loading ? "Checking integration status..." : "Status synced."}
          {message && (
            <div className="mt-2 text-sm text-green-700">{message}</div>
          )}
        </div>
      </main>
    </div>
  );
}
