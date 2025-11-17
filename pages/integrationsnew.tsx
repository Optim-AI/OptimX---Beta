// pages/integrationsnew.tsx
import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "../lib/supabaseClient";
import type { JSX } from "react"; 
/**
 * IntegrationsNew - single-purpose page to connect Facebook (Meta).
 *
 * Behavior: (unchanged)
 * - Shows "Connect Facebook" when not connected.
 * - On click: opens OAuth popup (adds sb=access_token if present).
 * - Listens for postMessage from popup: { type: 'oauth_connected', platform: 'meta', redirect?: '/...' }
 * - Also polls /api/integrations/status to detect connection state (fallback).
 * - When connected, button text + outline color changes to the blue style and "Continue to dashboard" becomes enabled.
 * - Continue redirects to /dashboard.
 *
 * Minor additions (as requested):
 * - Background/orb layering outside the card and inside the card (purely visual).
 * - A "Skip" text that immediately routes to /dashboard when clicked.
 *
 * NOTE: Flow / OAuth logic is preserved exactly as in your original file.
 */

const OAUTH_PATH = "/api/auth/instagram/start"; // adjust if your server uses a different path for meta/facebook
const STATUS_API = "/api/integrations/status";
const PLATFORM_KEY = "meta";

/* visual tokens used for the background/orbs */
const colors = {
  background: "hsl(212 55% 96%)",
  primary: "hsl(213 90% 56%)",
  primaryGlow: "hsl(205 95% 60%)",
  gradientMesh:
    "radial-gradient(closest-side at 20% 10%, rgba(99,102,241,0.08), transparent 20%), radial-gradient(closest-side at 80% 90%, rgba(14,165,233,0.06), transparent 18%)",
};

function withAlpha(token: string, alpha: number) {
  const hslMatch = token.match(
    /hsl\(\s*([\d.]+)\s+([\d.]+)%\s+([\d.]+)%\s*\)/i
  );
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

  const [connected, setConnected] = useState<boolean>(false);
  const [loadingStatus, setLoadingStatus] = useState<boolean>(true);
  const [message, setMessage] = useState<string | null>(null);

  // helper: center popup
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

  // fetch integration status via server API (fallback)
  const fetchStatusFlag = async () => {
    try {
      setLoadingStatus(true);
      const res = await fetch(STATUS_API, { credentials: "same-origin" });
      if (!res.ok) throw new Error("status fetch failed");
      const data = await res.json();
      // data should contain platform-level keys, e.g. { meta: true }
      const val = !!(data && data[PLATFORM_KEY]);
      setConnected(val);
      return val;
    } catch (err) {
      return false;
    } finally {
      setLoadingStatus(false);
    }
  };

  // poll status while popup is open
  const pollStatus = (platformId: string) => {
    const start = Date.now();
    if (pollRef.current) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
    pollRef.current = window.setInterval(async () => {
      // stop if popup closed
      if (!popupRef.current || popupRef.current.closed) {
        // final check once
        await fetchStatusFlag();
        if (pollRef.current) { window.clearInterval(pollRef.current); pollRef.current = null; }
        popupRef.current = null;
        return;
      }

      // otherwise, poll API for status
      try {
        const ok = await fetchStatusFlag();
        if (ok) {
          if (popupRef.current && !popupRef.current.closed) try { popupRef.current.close(); } catch {}
          if (pollRef.current) { window.clearInterval(pollRef.current); pollRef.current = null; }
          popupRef.current = null;
          setMessage("Facebook connected");
          setTimeout(() => setMessage(null), 2200);
        }
      } catch (_) {}
      // timeout after 60s
      if (Date.now() - start > 60_000) {
        if (pollRef.current) { window.clearInterval(pollRef.current); pollRef.current = null; }
        if (popupRef.current && !popupRef.current.closed) try { popupRef.current.close(); } catch {}
        popupRef.current = null;
        setMessage("Connection timed out — try again");
        setTimeout(() => setMessage(null), 2500);
      }
    }, 1400);
  };

  // open OAuth flow for Meta (Facebook)
  const handleConnect = async () => {
    setMessage(null);
    try {
      // try to attach supabase access token as query (so server side can validate user)
      let url = OAUTH_PATH;
      try {
        const { data } = await supabase.auth.getSession();
        const token = (data as any)?.session?.access_token;
        const u = new URL(OAUTH_PATH, window.location.origin);
        if (token) u.searchParams.set("sb", token);
        url = u.toString();
      } catch (_) {
        url = new URL(OAUTH_PATH, window.location.origin).toString();
      }

      const popup = openPopup(url, `oauth_${PLATFORM_KEY}`);
      popupRef.current = popup;
      // remember pending
      if (typeof window !== "undefined") localStorage.setItem("pending_connect", PLATFORM_KEY);
      pollStatus(PLATFORM_KEY);
    } catch (err) {
      setMessage("Failed to open popup. Allow popups for this site.");
      setTimeout(() => setMessage(null), 2200);
    }
  };

  // receive postMessage from popup (preferred)
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      try {
        const data = e.data;
        if (!data || typeof data !== "object") return;
        if (data.type === "oauth_connected" && data.platform === PLATFORM_KEY) {
          setConnected(true);
          if (popupRef.current && !popupRef.current.closed) try { popupRef.current.close(); } catch {}
          popupRef.current = null;
          localStorage.removeItem("pending_connect");
          setMessage("Facebook connected");
          setTimeout(() => setMessage(null), 2200);
          if (data.redirect) {
            // optionally redirect to provided path
            router.push(data.redirect);
          }
        }
      } catch (_) { /* ignore */ }
    };
    window.addEventListener("message", onMessage, false);

    return () => {
      window.removeEventListener("message", onMessage);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // initialize statuses and handle pending popup from other tab
  useEffect(() => {
    (async () => {
      await fetchStatusFlag();
      if (typeof window !== "undefined") {
        const pending = localStorage.getItem("pending_connect");
        if (pending === PLATFORM_KEY) {
          // try to re-run polling in case popup was opened in different tab
          pollStatus(PLATFORM_KEY);
        }
      }
    })();

    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleContinue = () => {
    router.push("/dashboard");
  };

  const handleSkip = () => {
    router.push("/dashboard");
  };

  return (
    <div style={{ minHeight: "100vh", position: "relative", overflow: "hidden", fontFamily: "'Poppins', Inter, system-ui, -apple-system, 'Segoe UI', Roboto" }}>
      {/* Outer background layers */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          zIndex: -20,
          backgroundImage: `linear-gradient(135deg, ${colors.background} 0%, ${withAlpha(colors.primary, 0.12)} 35%, ${withAlpha(colors.primaryGlow ?? colors.primary, 0.06)} 60%, ${colors.background} 100%)`,
        }}
      />
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          zIndex: -19,
          background: colors.gradientMesh,
          opacity: 0.9,
        }}
      />
      {/* Outer orbs */}
      <div
        aria-hidden
        style={{
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
        }}
      />
      <div
        aria-hidden
        style={{
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
        }}
      />
      <div
        aria-hidden
        style={{
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
        }}
      />

      {/* Center card */}
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
            {/* Skip text (top-right) */}
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
                aria-label="Skip and go to dashboard"
              >
                Skip
              </button>
            </div>

            {/* Inner background (card-level) */}
            <div aria-hidden style={{ position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none" }}>
              <div style={{
                position: "absolute",
                inset: 0,
                backgroundImage: `linear-gradient(135deg, ${withAlpha(colors.primary, 0.05)} 0%, ${withAlpha(colors.primaryGlow ?? colors.primary, 0.03)} 60%, transparent 100%)`,
                mixBlendMode: "overlay",
                opacity: 1,
              }} />
              <div style={{ position: "absolute", inset: 0, opacity: 0.55, mixBlendMode: "screen", background: colors.gradientMesh }} />
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
                boxShadow: `0 0 80px ${withAlpha(colors.primary, 0.14)}`,
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
                boxShadow: `0 0 80px ${withAlpha(colors.primaryGlow ?? colors.primary, 0.12)}`,
              }} />
            </div>

            {/* Content (keeps original layout & behavior) */}
            <div style={{ position: "relative", zIndex: 2, textAlign: "center" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginBottom: 8 }}>
                {/* hex mini-logo */}
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
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path d="M12 2.5l3.9 2.25v4.5L12 13.5 8.1 9.25v-4.5L12 2.5z" fill="#0b74ff" />
                  </svg>
                </div>
              </div>

              <h1 style={{ fontSize: 20, fontWeight: 800, margin: "6px 0", color: "#111827" }}>
                Optim<span style={{ color: "#0b74ff", marginLeft: 6 }}>X</span>
              </h1>
              <p style={{ fontSize: 14, fontWeight: 600, color: "#111827", margin: "6px 0 8px" }}>
                Connect your marketing & social accounts
              </p>
              <p style={{ fontSize: 13, color: "#6b7280", marginTop: 0 }}>
                It helps us bring your data, content, and insights together all in one place.
              </p>

              <div style={{ marginTop: 28, display: "flex", flexDirection: "column", gap: 12, alignItems: "center" }}>
                {/* Single Connect Facebook button */}
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
                    background: connected ? "linear-gradient(180deg, rgba(11,116,255,0.04), rgba(11,116,255,0.02))" : "white",
                    border: connected ? "2px solid #0b74ff" : "1px solid rgba(0,0,0,0.08)",
                    color: connected ? "#0b74ff" : "#111827",
                    boxShadow: connected ? "0 8px 24px rgba(11,116,255,0.08)" : "inset 0 1px 0 rgba(255,255,255,0.6)",
                    cursor: connected ? "default" : "pointer",
                  }}
                >
                  {connected ? "Facebook Connected" : "Connect Facebook"}
                </button>

                {/* Continue to dashboard (enabled only when connected) */}
                <button
                  onClick={handleContinue}
                  disabled={!connected}
                  style={{
                    marginTop: 6,
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
                  By proceeding, you consent to our <a href="/terms" style={{ color: "#0b74ff" }}>Terms & Conditions</a>
                </div>

                {message && <div style={{ marginTop: 10, color: "#0b74ff", fontWeight: 600 }}>{message}</div>}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* local styles for animations */}
      <style jsx>{`
        @keyframes float {
          0% { transform: translateY(0) translateX(0) scale(1); }
          25% { transform: translateY(-10px) translateX(-6px) scale(1.01); }
          50% { transform: translateY(0) translateX(0) scale(1); }
          75% { transform: translateY(10px) translateX(6px) scale(0.99); }
          100% { transform: translateY(0) translateX(0) scale(1); }
        }
        @keyframes floatSlow {
          0% { transform: translateY(0) translateX(0) scale(1); }
          50% { transform: translateY(-22px) translateX(10px) scale(1.01); }
          100% { transform: translateY(0) translateX(0) scale(1); }
        }
        @keyframes floatVerySlow {
          0% { transform: translateY(0) translateX(0) scale(1); }
          50% { transform: translateY(-30px) translateX(20px) scale(1.02); }
          100% { transform: translateY(0) translateX(0) scale(1); }
        }

        @media (prefers-reduced-motion: reduce) {
          * { animation: none !important; transition: none !important; }
        }
      `}</style>
    </div>
  );
}
