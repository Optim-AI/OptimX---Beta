// pages/integrations.tsx
"use client";

import React, { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { useRouter } from "next/router";

import { Card, CardContent } from "../app/web/src/components/ui/card";
import { Button } from "../app/web/src/components/ui/button";
import { Check, X, Facebook } from "lucide-react";

import { supabase } from "../lib/supabaseClient";
import { apiFetch } from "../lib/apiFetch";

// exact path you provided — do NOT change
import colors from "../lib/colors";

/* ---------- platforms (ui names + backend authpaths) ---------- */
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
    name: "meta ads",
    icon: <Facebook className="w-10 h-10 text-[#0866FF]" />, // meta icon
    authPath: "/api/auth/instagram/start",
    desc: "facebook & instagram ads",
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

type BetaStatus = "need_to_approve" | "pending" | "completed";

export default function IntegrationsPage() {
  const router = useRouter();
  const [statuses, setStatuses] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const popupRef = useRef<Window | null>(null);
  const pollRef = useRef<number | null>(null);
  const crossOriginSeen = useRef<Record<string, boolean>>({});

  // per-user beta status computed from integrationsbeta
  const [betaStatus, setBetaStatus] = useState<BetaStatus>("need_to_approve");

  function isPopupClosed(popup: Window | null) {
    try {
      return !popup || popup.closed;
    } catch {
      return true;
    }
  }

  /* ---------- fetch integration status (user-specific) ---------- */
  const fetchStatuses = async () => {
    setLoading(true);

    // 1) user-specific api (relies on current auth/session)
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
      // fall through to localstorage
    }

    // 2) localstorage fallback (per-browser, only values this user got previously)
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        setStatuses(JSON.parse(raw));
        setLoading(false);
        return;
      }
    } catch {}

    // 3) default false per platform
    const initial: Record<string, boolean> = {};
    PLATFORMS.forEach((p) => (initial[p.id] = false));
    setStatuses(initial);
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(initial));
    } catch {}
    setLoading(false);
  };

  /* ---------- popup + oauth polling ---------- */
  const openPopup = (url: string, name = "oauth_popup") => {
    const w = 900,
      h = 700;
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
        setMessage("sign-in timed out");
        popupRef.current?.close?.();
        localStorage.removeItem("pending_connect");
        clearInterval(pollRef.current!);
        pollRef.current = null;
        popupRef.current = null;
        setTimeout(() => setMessage(null), 2000);
      }
    }, 1200);
  };

  /* ---------- supabase token ---------- */
  const getSupabaseAccessToken = async (): Promise<string | null> => {
    try {
      const { data } = await supabase.auth.getSession();
      return (data as any)?.session?.access_token ?? null;
    } catch {
      return null;
    }
  };

  /* ---------- connect ---------- */
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
      setMessage("popup blocked — allow popups");
      setTimeout(() => setMessage(null), 2500);
    }
  };

  /* ---------- disconnect ---------- */
  const handleDisconnect = async (platformId: string) => {
    try {
      await apiFetch("/api/integrations/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform: platformId }),
      });

      await fetchStatuses();
      setMessage("disconnected");
      setTimeout(() => setMessage(null), 2000);
    } catch {
      setMessage("failed to disconnect");
      setTimeout(() => setMessage(null), 2000);
    }
  };

  /* ---------- initial load: user + beta status + statuses ---------- */
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        const user = data?.user ?? null;
        if (!user) {
          router.push("/auth/signin");
          return;
        }

        // read latest beta row for this user
        const { data: betaRow, error: betaErr } = await supabase
          .from("integrationsbeta")
          .select("status, instagram_username, facebook_username, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!betaErr && betaRow) {
          const rawStatus = (betaRow as any).status ?? "";
          const s = String(rawStatus).toLowerCase();

          const ig = (betaRow as any).instagram_username as string | null;
          const fb = (betaRow as any).facebook_username as string | null;
          const hasUsernames =
            (ig && ig.trim().length > 0) || (fb && fb.trim().length > 0);

          if (s === "completed") {
            setBetaStatus("completed");
          } else if (hasUsernames) {
            // they have provided usernames -> treat as pending/verify
            setBetaStatus("pending");
          } else {
            // no usernames input -> need_to_approve
            setBetaStatus("need_to_approve");
          }
        } else {
          // no row at all -> need_to_approve
          setBetaStatus("need_to_approve");
        }

        if (!mounted) return;
        await fetchStatuses();
      } catch (e) {
        console.warn("integrations init error", e);
        if (mounted) {
          setBetaStatus("need_to_approve");
          await fetchStatuses();
        }
      }
    })();

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
      mounted = false;
      window.removeEventListener("message", onMessage);
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [router]);

  /* ---------- ui ---------- */
  return (
    <div className="min-h-screen bg-slate-50">
      <main className="p-8">
        <div className="p-6 space-y-6">
          <div>
            <h1 className="text-3xl font-bold mb-2">integrations</h1>
            <p
              className={!mutedForeground ? "text-muted-foreground" : ""}
              style={mutedForeground ? { color: mutedForeground } : undefined}
            >
              connect your advertising platforms and tools
            </p>
          </div>

          {/* grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {PLATFORMS.map((platform, i) => {
              const connected = !!statuses[platform.id];

              const statusBg = connected ? green100 : muted;
              const statusIconColor = connected ? green600 : mutedForeground;

              const connectBtnStyle =
                !connected && gradientPrimary
                  ? { background: gradientPrimary, border: "none" }
                  : undefined;

              // decide button label + behavior based on betaStatus + connected
              let buttonLabel = "connect";
              let buttonDisabled = false;
              let buttonOnClick: () => void = () => {};
              let buttonStyle: CSSProperties | undefined =
                !connected ? connectBtnStyle : undefined;
              let buttonVariant: "outline" | "default" = connected
                ? "outline"
                : "default";

              if (connected) {
                // already connected -> keep existing disconnect behavior
                buttonLabel = "disconnect";
                buttonOnClick = () => handleDisconnect(platform.id);
              } else {
                if (betaStatus === "need_to_approve") {
                  // no usernames captured -> ask them to go fill beta form
                  buttonLabel = "verify please";
                  buttonOnClick = () => router.push("/integrationsbeta");
                  buttonDisabled = false;
                } else if (betaStatus === "pending") {
                  // usernames present, waiting for manual completion
                  buttonLabel = "verify";
                  buttonOnClick = () => {};
                  buttonDisabled = true;
                  buttonStyle = undefined; // static
                } else if (betaStatus === "completed") {
                  // manual completion done -> allow normal connect flow
                  buttonLabel = "connect";
                  buttonOnClick = () => handleConnect(platform);
                } else {
                  // fallback
                  buttonLabel = "verify please";
                  buttonOnClick = () => router.push("/integrationsbeta");
                }
              }

              return (
                <Card
                  key={i}
                  className="glass-card hover:shadow-2xl transition-all"
                  style={{
                    boxShadow: "0 8px 32px rgba(0,0,0,0.22)",
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
                      variant={buttonVariant}
                      className="w-full"
                      style={buttonStyle}
                      disabled={buttonDisabled}
                      onClick={buttonOnClick}
                    >
                      {buttonLabel}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        <div className="mt-4 text-sm text-slate-500">
          {loading ? "checking integration status..." : "status synced."}
          {message && (
            <div className="mt-2 text-sm text-green-700">{message}</div>
          )}
        </div>
      </main>
    </div>
  );
}
