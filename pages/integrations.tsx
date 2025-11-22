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

const LS_KEY = "integrations_status_v1";

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
  const [statuses, setStatuses] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const popupRef = useRef<Window | null>(null);
  const pollRef = useRef<number | null>(null);
  const crossOriginSeen = useRef<Record<string, boolean>>({});

  function isPopupClosed(popup: Window | null) {
    try {
      return !popup || popup.closed;
    } catch {
      return true;
    }
  }

  /* ---------- Fetch integration status (now user-specific) ---------- */
  const fetchStatuses = async () => {
    setLoading(true);

    // 1) User-specific API (relies on current auth/session)
    try {
      const res = await apiFetch("/api/integrations/status");
      if (!res.ok) throw new Error();
      const data = await res.json();

      const next: Record<string, boolean> = {};
      PLATFORMS.forEach((p) => (next[p.id] = !!data[p.id]));

      setStatuses(next);
      try {
        localStorage.setItem(LS_KEY, JSON.stringify(next));
      } catch {}
      setLoading(false);
      return;
    } catch {
      // fall through to localStorage
    }

    // 2) LocalStorage fallback (per-browser, but still only values this user got from API earlier)
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        setStatuses(JSON.parse(raw));
        setLoading(false);
        return;
      }
    } catch {}

    // 3) Default false per platform
    const initial: Record<string, boolean> = {};
    PLATFORMS.forEach((p) => (initial[p.id] = false));
    setStatuses(initial);
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(initial));
    } catch {}
    setLoading(false);
  };

  /* ---------- Popup + OAuth polling ---------- */
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

  const pollStatusFor = (platformId: string, timeoutMs = 60000) => {
    const start = Date.now();
    crossOriginSeen.current[platformId] = false;

    if (pollRef.current) clearInterval(pollRef.current);

    pollRef.current = window.setInterval(async () => {
      try {
        if (isPopupClosed(popupRef.current)) {
          if (crossOriginSeen.current[platformId]) {
            setStatuses((s) => {
              const next = { ...s, [platformId]: true };
              try {
                localStorage.setItem(LS_KEY, JSON.stringify(next));
              } catch {}
              return next;
            });
            localStorage.removeItem("pending_connect");
            setMessage(`${platformId} connected`);
            setTimeout(() => setMessage(null), 2000);
          } else {
            await fetchStatuses();
          }

          clearInterval(pollRef.current!);
          pollRef.current = null;
          popupRef.current = null;
          return;
        }

        try {
          if (popupRef.current?.location?.href) {
            const u = new URL(popupRef.current.location.href);
            const q = u.searchParams.get("connected");
            if (q === platformId) {
              setStatuses((s) => {
                const next = { ...s, [platformId]: true };
                try {
                  localStorage.setItem(LS_KEY, JSON.stringify(next));
                } catch {}
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
          crossOriginSeen.current[platformId] = true;
        }

        const res = await apiFetch("/api/integrations/status");
        if (res.ok) {
          const data = await res.json();
          if (data[platformId]) {
            setStatuses((s) => {
              const next = { ...s, [platformId]: true };
              try {
                localStorage.setItem(LS_KEY, JSON.stringify(next));
              } catch {}
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

  /* ---------- Supabase token ---------- */
  const getSupabaseAccessToken = async (): Promise<string | null> => {
    try {
      const { data } = await supabase.auth.getSession();
      return (data as any)?.session?.access_token ?? null;
    } catch {
      return null;
    }
  };

  /* ---------- Connect ---------- */
  const handleConnect = async (platform: Platform) => {
    if (!platform.authPath) return;

    try {
      let url = platform.authPath;
      const token = await getSupabaseAccessToken();

      try {
        const u = new URL(platform.authPath, window.location.origin);
        if (token) u.searchParams.set("sb", token);
        url = u.toString();
      } catch {}

      const popup = openPopup(url, `oauth_${platform.id}`);
      popupRef.current = popup;
      localStorage.setItem("pending_connect", platform.id);
      pollStatusFor(platform.id);
    } catch {
      setMessage("Popup blocked — allow popups");
      setTimeout(() => setMessage(null), 2500);
    }
  };

  /* ---------- Disconnect ---------- */
  const handleDisconnect = async (platformId: string) => {
    try {
      await apiFetch("/api/integrations/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform: platformId }),
      });

      await fetchStatuses();
      setMessage("Disconnected");
      setTimeout(() => setMessage(null), 2000);
    } catch {
      setMessage("Failed to disconnect");
      setTimeout(() => setMessage(null), 2000);
    }
  };

  /* ---------- Effects ---------- */
  useEffect(() => {
    fetchStatuses();

    const onMessage = (e: MessageEvent) => {
      try {
        const data = e.data;
        if (data?.type === "oauth_connected" && data.platform) {
          const p = data.platform;
          setStatuses((s) => {
            const next = { ...s, [p]: true };
            try {
              localStorage.setItem(LS_KEY, JSON.stringify(next));
            } catch {}
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
  }, []);

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
