// pages/integrationsnew.tsx
import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "../lib/supabaseClient";

/**
 * IntegrationsNew - single-purpose page to connect Facebook (Meta).
 *
 * Behavior:
 * - Shows "Connect Facebook" when not connected.
 * - On click: opens OAuth popup (adds sb=access_token if present).
 * - Listens for postMessage from popup: { type: 'oauth_connected', platform: 'meta', redirect?: '/...' }
 * - Also polls /api/integrations/status to detect connection state (fallback).
 * - When connected, button text + outline color changes to the blue style and "Continue to dashboard" becomes enabled.
 * - Continue redirects to /dashboard.
 */

const OAUTH_PATH = "/api/auth/instagram/start"; // adjust if your server uses a different path for meta/facebook
const STATUS_API = "/api/integrations/status";
const PLATFORM_KEY = "meta";

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
      // ignore, fallback to leaving state unchanged
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

  // UI - faithful to your sample: single card, soft blue large background blobs
  return (
    <div style={styles.page}>
      <div style={styles.cardWrap}>
        <div style={styles.card}>
          <div style={{ textAlign: "center" }}>
            <div style={styles.brandHex}>{/* hex/mini-logo circle */} 
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M12 2.5l3.9 2.25v4.5L12 13.5 8.1 9.25v-4.5L12 2.5z" fill="#0b74ff" />
              </svg>
            </div>

            <h1 style={styles.title}>Optim<span style={{ color: "#0b74ff" }}>X</span></h1>
            <p style={styles.subtitle}>Connect your marketing & social accounts</p>
            <p style={styles.small}>It helps us bring your data, content, and insights together all in one place.</p>
          </div>

          <div style={{ marginTop: 28, display: "flex", flexDirection: "column", gap: 12, alignItems: "center" }}>
            {/* Single Connect Facebook button */}
            <button
              onClick={connected ? undefined : handleConnect}
              aria-pressed={connected}
              style={{
                ...styles.connectBtn,
                ...(connected
                  ? styles.connectBtnConnected
                  : styles.connectBtnDefault),
              }}
            >
              {connected ? "Facebook Connected" : "Connect Facebook"}
            </button>

            {/* Continue to dashboard (enabled only when connected) */}
            <button
              onClick={handleContinue}
              disabled={!connected}
              style={{
                ...styles.primaryBtn,
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
  );
}

/* -- styles in JS for ease of copy/paste -- */
const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    // visible pleasant gradient with soft blobs via background image + color stops
    background:
      "radial-gradient(700px 400px at 8% 20%, rgba(11,116,255,0.08), transparent 8%)," +
      "radial-gradient(600px 300px at 90% 75%, rgba(11,116,255,0.06), transparent 8%)," +
      "linear-gradient(180deg,#fbfdff 0%, #f8fbff 50%, #ffffff 100%)",
    padding: 32,
    fontFamily: "'Poppins', Inter, system-ui, -apple-system, 'Segoe UI', Roboto",
  },
  cardWrap: {
    width: "100%",
    maxWidth: 760,
    padding: 24,
  },
  card: {
    background: "rgba(255,255,255,1)",
    borderRadius: 16,
    padding: 32,
    boxShadow: "0 18px 60px rgba(8,32,80,0.06)",
    border: "1px solid rgba(13, 27, 58, 0.03)",
  },
  brandHex: {
    width: 64,
    height: 64,
    margin: "0 auto 10px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    background: "linear-gradient(180deg, rgba(11,116,255,0.12), rgba(11,116,255,0.06))",
    boxShadow: "0 8px 30px rgba(11,116,255,0.06)",
  },
  title: {
    fontSize: 20,
    fontWeight: 700,
    marginTop: 6,
    marginBottom: 6,
    color: "#111827",
  },
  subtitle: {
    fontSize: 14,
    fontWeight: 600,
    color: "#111827",
    marginBottom: 6,
  },
  small: {
    fontSize: 13,
    color: "#6b7280",
    marginTop: 0,
  },
  connectBtn: {
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
    background: "white",
  },
  connectBtnDefault: {
    border: "1px solid rgba(0,0,0,0.08)",
    color: "#111827",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.6)",
  },
  connectBtnConnected: {
    border: "2px solid #0b74ff",
    color: "#0b74ff",
    background: "linear-gradient(180deg, rgba(11,116,255,0.04), rgba(11,116,255,0.02))",
  },
  primaryBtn: {
    marginTop: 12,
    background: "#0b74ff",
    color: "white",
    border: "none",
    borderRadius: 10,
    padding: "12px 40px",
    fontSize: 14,
    fontWeight: 700,
    boxShadow: "0 8px 20px rgba(11,116,255,0.14)",
    transition: "transform 180ms ease, box-shadow 180ms ease",
  },
};
