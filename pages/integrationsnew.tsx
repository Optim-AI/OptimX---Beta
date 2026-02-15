// pages/integrationsnew.tsx
import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from '@/auth/supabase/client';
import type { JSX } from "react";
import { apiFetch } from '@/api/fetch';

/**
 * IntegrationsNew - single-purpose page to connect Facebook (Meta).
 *
 * Flow unchanged, but now user-specific:
 * - requires signed-in user (redirect to /auth/signin)
 * - all server calls include userId as query param
 * - popup flow includes userId
 * - localStorage keys are namespaced by userId
 */

const OAUTH_PATH = "/api/auth/instagram/start";
const STATUS_API = "/api/integrations/status";
const PLATFORM_KEY = "meta";

const colors = {
  background: "hsl(212 55% 96%)",
  primary: "hsl(213 90% 56%)",
  primaryGlow: "hsl(205 95% 60%)",
  gradientMesh:
    "radial-gradient(closest-side at 20% 10%, rgba(99,102,241,0.08), transparent 20%), radial-gradient(closest-side at 80% 90%, rgba(14,165,233,0.06), transparent 18%)",
};

function withAlpha(token: string, alpha: number) {
  const hslMatch = token.match(/hsl\(\s*([\d.]+)\s+([\d.]+)%\s+([\d.]+)%\s*\)/i);
  if (hslMatch) {
    const [, h, s, l] = hslMatch;
    return `hsla(${h}, ${s}%, ${l}%, ${alpha})`;
  }
  if (/rgba?\(|hsla?\(/i.test(token)) return token;
  return token;
}

export default function IntegrationsNew(): JSX.Element {
  const router = useRouter();
  const popupRef = useRef<Window | null>(null);
  const pollRef = useRef<number | null>(null);
  const crossOriginSeen = useRef<Record<string, boolean>>({});

  const [userId, setUserId] = useState<string | null>(null);
  const [connected, setConnected] = useState<boolean>(false);
  const [loadingStatus, setLoadingStatus] = useState<boolean>(true);
  const [message, setMessage] = useState<string | null>(null);

  // namespaced localStorage keys
  const PENDING_KEY = (uid: string | null) => `pending_connect:${uid ?? "anon"}`;
  const LS_KEY_FOR = (uid: string | null) => `integrations_status_v1:${uid ?? "anon"}`;

  // open centered popup
  const openPopup = (url: string, name = "oauth_popup") => {
    const w = 900;
    const h = 700;
    const left = window.screenX + (window.innerWidth - w) / 2;
    const top = window.screenY + (window.innerHeight - h) / 2;
    const opts = `width=${w},height=${h},left=${left},top=${top},resizable=yes,scrollbars=yes,status=yes`;
    const absolute = new URL(url, window.location.origin).toString();
    const p = window.open(absolute, name, opts);
    if (p) try { p.focus(); } catch {}
    return p;
  };

  const isPopupClosed = (popup: Window | null) => {
    try {
      return !popup || popup.closed;
    } catch {
      return true;
    }
  };

  // get supabase access token (optional) to include in popup URL
  const getSupabaseAccessToken = async (): Promise<string | null> => {
    try {
      const { data } = await supabase.auth.getSession();
      return (data as any)?.session?.access_token ?? null;
    } catch {
      return null;
    }
  };

  /* ---------- Fetch integration status (user-scoped) ---------- */
  const fetchStatuses = async (uid: string | null) => {
    setLoadingStatus(true);
    if (!uid) {
      setConnected(false);
      setLoadingStatus(false);
      return false;
    }

    // 1) Prefer server API (user-scoped)
    try {
      const sep = STATUS_API.includes("?") ? "&" : "?";
      const url = `${STATUS_API}${sep}userId=${encodeURIComponent(uid)}`;
      const res = await apiFetch(url);
      if (res.ok) {
        const data = await res.json();
        const val = !!(data && data[PLATFORM_KEY]);
        setConnected(val);
        try {
          localStorage.setItem(LS_KEY_FOR(uid), JSON.stringify({ [PLATFORM_KEY]: !!val }));
        } catch {}
        setLoadingStatus(false);
        return val;
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
        const parsed = JSON.parse(raw);
        const val = !!(parsed && parsed[PLATFORM_KEY]);
        setConnected(val);
        setLoadingStatus(false);
        return val;
      }
    } catch (err) {
      console.debug("localStorage read failed:", err);
    }

    // 3) Default: disconnected (safe)
    setConnected(false);
    try {
      localStorage.setItem(LS_KEY_FOR(uid), JSON.stringify({ [PLATFORM_KEY]: false }));
    } catch {}
    setLoadingStatus(false);
    return false;
  };

  /* ---------- Polling popup & server for status ---------- */
  const pollStatusFor = (platformId: string, uid: string | null, timeoutMs = 60000) => {
    const start = Date.now();
    crossOriginSeen.current[platformId] = false;

    if (pollRef.current) clearInterval(pollRef.current);

    pollRef.current = window.setInterval(async () => {
      try {
        if (isPopupClosed(popupRef.current)) {
          // popup closed — check if cross-origin handshake happened
          if (crossOriginSeen.current[platformId]) {
            setConnected(true);
            try { if (uid) localStorage.setItem(LS_KEY_FOR(uid), JSON.stringify({ [platformId]: true })); } catch {}
            localStorage.removeItem(PENDING_KEY(uid));
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
              setConnected(true);
              try { if (uid) localStorage.setItem(LS_KEY_FOR(uid), JSON.stringify({ [platformId]: true })); } catch {}
              popupRef.current.close();
              popupRef.current = null;
              localStorage.removeItem(PENDING_KEY(uid));
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
          const res = await apiFetch(`${STATUS_API}${uidSuffix}`);
          if (res.ok) {
            const data = await res.json();
            if (data[platformId]) {
              setConnected(true);
              try { if (uid) localStorage.setItem(LS_KEY_FOR(uid), JSON.stringify({ [platformId]: true })); } catch {}
              localStorage.removeItem(PENDING_KEY(uid));
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
        localStorage.removeItem(PENDING_KEY(uid));
        clearInterval(pollRef.current!);
        pollRef.current = null;
        popupRef.current = null;
        setTimeout(() => setMessage(null), 2000);
      }
    }, 1200);
  };

  /* ---------- Connect (popup) ---------- */
  const handleConnect = async () => {
    setMessage(null);
    if (!userId) {
      setMessage("Please sign in first");
      setTimeout(() => setMessage(null), 1800);
      return;
    }

    try {
      let url = OAUTH_PATH;
      const token = await getSupabaseAccessToken();

      try {
        const u = new URL(OAUTH_PATH, window.location.origin);
        if (token) u.searchParams.set("sb", token);
        // mark user in popup flow (server should respect current session or userId)
        u.searchParams.set("userId", userId);
        url = u.toString();
      } catch {}

      const popup = openPopup(url, `oauth_${PLATFORM_KEY}`);
      popupRef.current = popup;
      try { localStorage.setItem(PENDING_KEY(userId), PLATFORM_KEY); } catch {}
      pollStatusFor(PLATFORM_KEY, userId);
    } catch {
      setMessage("Failed to open popup. Allow popups for this site.");
      setTimeout(() => setMessage(null), 2200);
    }
  };

  /* ---------- Disconnect (user scoped) ---------- */
  const handleDisconnect = async () => {
    if (!userId) {
      setMessage("Please sign in first");
      setTimeout(() => setMessage(null), 1800);
      return;
    }

    try {
      const res = await apiFetch("/api/integrations/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform: PLATFORM_KEY, userId }),
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

  // mount: check current user and status; handle messages from popup
  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        const { data, error } = await supabase.auth.getUser();
        if (error) {
          console.error("supabase.auth.getUser error:", error);
        }
        const u = (data as any)?.user ?? null;
        if (!u) {
          // redirect to signin if not signed in
          router.push("/auth/signin");
          return;
        }
        if (!mounted) return;
        setUserId(u.id);
        await fetchStatuses(u.id);

        // if a pending connect exists for this user, resume polling
        try {
          const pending = localStorage.getItem(PENDING_KEY(u.id));
          if (pending === PLATFORM_KEY) pollStatusFor(PLATFORM_KEY, u.id);
        } catch {}
      } catch (err) {
        console.error("init error:", err);
      }
    };

    init();

    const onMessage = (e: MessageEvent) => {
      try {
        const data = e.data;
        if (data?.type === "oauth_connected" && data.platform === PLATFORM_KEY) {
          // only accept messages that match current user
          if (userId && data.userId && data.userId !== userId) return;

          setConnected(true);
          if (popupRef.current && !popupRef.current.closed) try { popupRef.current.close(); } catch {}
          popupRef.current = null;
          try { if (userId) localStorage.removeItem(PENDING_KEY(userId)); } catch {}
          setMessage(`${PLATFORM_KEY} connected`);
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
      if (popupRef.current && !popupRef.current.closed) try { popupRef.current.close(); } catch {}
      popupRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // Continue / Skip
  const handleContinue = () => router.push("/dashboard");
  const handleSkip = () => router.push("/dashboard");

  return (
    <div
      style={{
        minHeight: "100vh",
        position: "relative",
        overflow: "hidden",
        fontFamily: "'Poppins', Inter, system-ui, -apple-system, 'Segoe UI', Roboto"
      }}
    >
      {/* BACKGROUND LAYERS — unchanged */}
      <div aria-hidden style={{
        position: "absolute",
        inset: 0,
        zIndex: -20,
        backgroundImage: `linear-gradient(135deg, ${colors.background} 0%, ${withAlpha(colors.primary, 0.12)} 35%, ${withAlpha(colors.primaryGlow ?? colors.primary, 0.06)} 60%, ${colors.background} 100%)`,
      }} />

      <div aria-hidden style={{
        position: "absolute",
        inset: 0,
        zIndex: -19,
        background: colors.gradientMesh,
        opacity: 0.9,
      }} />

      <div aria-hidden style={{
        position: "absolute",
        top: 40,
        left: 40,
        width: 380,
        height: 380,
        borderRadius: "50%",
        filter: "blur(36px)",
        zIndex: -18,
        backgroundColor: withAlpha(colors.primary, 0.28),
        animation: "floatSlow 12s ease-in-out infinite",
        boxShadow: `0 0 120px ${withAlpha(colors.primary, 0.18)}`,
      }} />

      <div aria-hidden style={{
        position: "absolute",
        right: 40,
        bottom: 48,
        width: 420,
        height: 420,
        borderRadius: "50%",
        filter: "blur(36px)",
        zIndex: -18,
        backgroundColor: withAlpha(colors.primary, 0.22),
        animation: "floatSlow 10s ease-in-out infinite",
        animationDelay: "1.8s",
        boxShadow: `0 0 120px ${withAlpha(colors.primaryGlow ?? colors.primary, 0.14)}`,
      }} />

      <div aria-hidden style={{
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: "translate(-50%,-50%)",
        width: 760,
        height: 760,
        borderRadius: "50%",
        filter: "blur(48px)",
        zIndex: -21,
        backgroundImage: `linear-gradient(90deg, ${withAlpha(colors.primary, 0.12)} 0%, ${withAlpha(colors.primaryGlow ?? colors.primary, 0.08)} 100%)`,
        animation: "floatVerySlow 20s linear infinite",
        opacity: 0.85,
        mixBlendMode: "screen",
      }} />

      {/* CARD */}
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 28 }}>
        <div style={{ width: "100%", maxWidth: 760, padding: 20 }}>
          <div style={{
            position: "relative",
            borderRadius: 16,
            padding: 28,
            overflow: "hidden",
            background: "linear-gradient(180deg, rgba(255,255,255,0.96), rgba(255,255,255,0.88))",
            boxShadow: "0 18px 60px rgba(8,32,80,0.06)",
            border: "1px solid rgba(13,27,58,0.03)"
          }}>

            {/* SKIP BUTTON */}
            <div style={{ position: "absolute", top: 12, right: 14, zIndex: 4 }}>
              <button
                onClick={handleSkip}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#6b7280",
                  fontWeight: 600,
                  cursor: "pointer",
                  padding: "8px 12px",
                  borderRadius: 8,
                }}
              >
                Skip
              </button>
            </div>

            {/* INNER BACKGROUND */}
            <div aria-hidden style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0 }}>
              <div style={{
                position: "absolute",
                inset: 0,
                backgroundImage: `linear-gradient(135deg, ${withAlpha(colors.primary, 0.05)} 0%, ${withAlpha(colors.primaryGlow ?? colors.primary, 0.03)} 60%, transparent 100%)`,
                mixBlendMode: "overlay"
              }} />
              <div style={{
                position: "absolute",
                inset: 0,
                opacity: 0.55,
                mixBlendMode: "screen",
                background: colors.gradientMesh
              }} />
              <div style={{
                position: "absolute",
                top: -24,
                left: -24,
                width: 160,
                height: 160,
                borderRadius: "50%",
                filter: "blur(28px)",
                backgroundColor: withAlpha(colors.primary, 0.32),
                animation: "float 7s ease-in-out infinite",
              }} />
              <div style={{
                position: "absolute",
                bottom: -36,
                right: -16,
                width: 260,
                height: 260,
                borderRadius: "50%",
                filter: "blur(30px)",
                backgroundColor: withAlpha(colors.primaryGlow ?? colors.primary, 0.24),
                animation: "float 8s ease-in-out infinite",
                animationDelay: "1.2s",
              }} />
            </div>

            {/* CONTENT */}
            <div style={{ position: "relative", zIndex: 2, textAlign: "center" }}>

              {/* LOGO + TITLE */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginBottom: 8 }}>
                <div style={{
                  width: 64,
                  height: 64,
                  borderRadius: 12,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "linear-gradient(180deg, rgba(11,116,255,0.12), rgba(11,116,255,0.06))",
                  boxShadow: "0 8px 30px rgba(11,116,255,0.06)",
                  margin: "0 auto"
                }}>
                  <img src="/images/Oli_AI_Logo.svg" alt="SkalX AI Logo" className="h-10 w-auto" />
                </div>
              </div>

              <h1 style={{ fontSize: 22, fontWeight: 800, margin: "6px 0", color: "#111827" }}>
                SkalX AI
              </h1>

              <p style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>
                Connect your marketing & social accounts
              </p>
              <p style={{ fontSize: 13, color: "#6b7280" }}>
                It helps us bring your data, content, and insights together all in one place.
              </p>

              {/* DISCLAIMER ADDED */}
              <div style={{
                marginTop: 16,
                padding: "10px 16px",
                borderRadius: 10,
                background: "rgba(11,116,255,0.08)",
                color: "#0b5fcc",
                fontSize: 13,
                fontWeight: 600,
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                gap: 8,
                backdropFilter: "blur(3px)"
              }}>
                <span style={{ fontSize: 16 }}>⚠️</span>
                <span>
                  This application is under review. For running ads or campaigns, contact us at
                  <span style={{ color: "#0b74ff" }}> info@optimx.app</span>.
                </span>
              </div>

              {/* BUTTONS SECTION */}
              <div style={{ marginTop: 28, display: "flex", flexDirection: "column", gap: 12, alignItems: "center" }}>
                <button
                  onClick={connected ? undefined : handleConnect}
                  aria-pressed={connected}
                  style={{
                    width: "60%",
                    minWidth: 260,
                    borderRadius: 8,
                    padding: "12px 18px",
                    fontSize: 14,
                    fontWeight: 600,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    transition: "all 240ms ease",
                    background: connected ? "rgba(11,116,255,0.04)" : "white",
                    border: connected ? "2px solid #0b74ff" : "1px solid rgba(0,0,0,0.08)",
                    color: connected ? "#0b74ff" : "#111827",
                    boxShadow: connected ? "0 8px 24px rgba(11,116,255,0.08)" : "none",
                    cursor: connected ? "default" : "pointer",
                  }}
                >
                  {connected ? "Facebook Connected" : "Connect Facebook"}
                </button>

                <button
                  onClick={handleContinue}
                  disabled={!connected}
                  style={{
                    background: "#0b74ff",
                    color: "white",
                    border: "none",
                    borderRadius: 10,
                    padding: "12px 36px",
                    fontSize: 14,
                    fontWeight: 700,
                    boxShadow: connected ? "0 8px 20px rgba(11,116,255,0.14)" : "none",
                    transition: "transform 180ms ease, box-shadow 180ms ease",
                    opacity: connected ? 1 : 0.5,
                    cursor: connected ? "pointer" : "not-allowed",
                  }}
                >
                  Continue to dashboard
                </button>

                <div style={{ fontSize: 12, color: "#6b7280", marginTop: 8 }}>
                  By proceeding, you consent to our{" "}
                  <a href="/terms-and-conditions" style={{ color: "#0b74ff" }}>
                    Terms & Conditions
                  </a>
                </div>

                {message && <div style={{ marginTop: 10, color: "#0b74ff", fontWeight: 600 }}>{message}</div>}
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* Animations */}
      <style jsx>{`
        @keyframes float {
          0% { transform: translateY(0) translateX(0); }
          25% { transform: translateY(-10px) translateX(-6px); }
          50% { transform: translateY(0) translateX(0); }
          75% { transform: translateY(10px) translateX(6px); }
          100% { transform: translateY(0) translateX(0); }
        }
        @keyframes floatSlow {
          0% { transform: translateY(0) translateX(0); }
          50% { transform: translateY(-22px) translateX(10px); }
          100% { transform: translateY(0) translateX(0); }
        }
        @keyframes floatVerySlow {
          0% { transform: translateY(0) translateX(0); }
          50% { transform: translateY(-30px) translateX(20px); }
          100% { transform: translateY(0) translateX(0); }
        }
      `}</style>

    </div>
  );
}
