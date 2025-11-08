// pages/welcome.tsx
import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "../lib/supabaseClient";

/**
 * Welcome page
 * - Shows user's first name (if available from Supabase user object)
 * - Get Started -> /onboardingInfo
 * - Do it later -> /dashboard
 * - No auto-redirect to signin (so you can preview)
 */

export default function Welcome(): React.ReactElement {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // extract best display name from Supabase user object
  function extractName(user: any) {
    if (!user) return null;
    const meta = user.user_metadata ?? {};
    const candidates: Array<string | undefined> = [
      meta.full_name ?? meta.name ?? meta.fullName ?? meta.first_name ?? meta.given_name,
      user.user_metadata?.full_name,
      user.user_metadata?.name,
      user.user_metadata?.given_name,
      // fallback to email local part
      user.email ? user.email.split("@")[0] : undefined,
    ];
    for (const c of candidates) {
      if (typeof c === "string" && c.trim().length > 0) return c.trim();
    }
    return null;
  }

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const { data } = await supabase.auth.getUser();
        const user = data?.user ?? null;

        if (!mounted) return;

        if (user) {
          const name = extractName(user);
          if (name) setUserName(name.split(" ")[0]);
          else setUserName(null);
        } else {
          // No user — keep generic greeting (no redirect)
          setUserName(null);
        }
      } catch (err: any) {
        console.error("Failed to load user", err);
        setError("Failed to load user information.");
        setUserName(null);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#fff" }}>
        <div style={{ fontFamily: "Poppins, Inter, sans-serif", color: "#0f172a" }}>Loading…</div>
      </div>
    );
  }

  const firstName = userName ?? "";

  return (
    <>
      <style jsx>{`
        .page {
          min-height: 100vh;
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          overflow: hidden;
          font-family: Poppins, Inter, system-ui, -apple-system, "Segoe UI", Roboto, Arial;
          background: linear-gradient(180deg, #ffffff 0%, #fbfeff 100%);
        }

        /* strong soft-blue gradient using #0088FF */
        .bg-left,
        .bg-right {
          position: absolute;
          border-radius: 9999px;
          filter: blur(110px);
          pointer-events: none;
          z-index: 0;
        }
        .bg-left {
          width: 480px;
          height: 480px;
          left: -160px;
          top: -120px;
          background: radial-gradient(circle at 30% 30%, rgba(0,136,255,0.18), rgba(0,136,255,0.02));
        }
        .bg-right {
          width: 560px;
          height: 560px;
          right: -160px;
          bottom: -120px;
          background: radial-gradient(circle at 70% 70%, rgba(0,136,255,0.14), rgba(116,190,255,0.02));
        }

        .card {
          position: relative;
          z-index: 3;
          width: 760px;
          max-width: calc(100% - 48px);
          border-radius: 12px;
          padding: 64px 80px;
          text-align: center;
          background: rgba(255,255,255,0.94);
          box-shadow: 0 20px 80px rgba(2,6,23,0.08);
        }

        .logo { width: 84px; height: 84px; margin: 0 auto; }
        .title {
          margin-top: 18px;
          font-size: 28px;
          font-weight: 700;
          color: #0f172a;
        }
        .title .name { color: #0088FF; }
        .subtitle {
          margin-top: 14px;
          color: #6f6f6f;
          font-size: 15px;
          max-width: 640px;
          margin-left: auto;
          margin-right: auto;
        }

        .cta {
          margin-top: 40px;
          width: 240px;
          height: 44px;
          border-radius: 8px;
          background: linear-gradient(180deg,#0088FF,#0073E6);
          color: white;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          cursor: pointer;
          border: none;
          box-shadow: 0 8px 28px rgba(0,136,255,0.16);
        }
        .cta:active { transform: translateY(1px); }
        .do-later {
          margin-top: 18px;
          display: block;
          color: #6f6f6f;
          text-decoration: underline;
          cursor: pointer;
          font-size: 13px;
        }

        @media (max-width: 860px) {
          .card { padding: 36px 28px; width: calc(100% - 40px); }
          .title { font-size: 22px; }
          .cta { width: 200px; }
        }
      `}</style>

      <div className="page" role="main" aria-label="Welcome page">
        <div className="bg-left" />
        <div className="bg-right" />

        <section className="card" aria-labelledby="welcome-heading">
          <div className="logo" aria-hidden>
            <svg width="84" height="84" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: "block", margin: "0 auto" }}>
              <path d="M12 2 L20 7 v10 l-8 5 l-8 -5 V7 Z" fill="#0088FF" opacity="0.95"/>
              <circle cx="12" cy="11.5" r="2.3" fill="white"/>
            </svg>
          </div>

          <h1 id="welcome-heading" className="title">
            Hello{firstName ? ` ${firstName}` : ""}, Happy to welcome you onboard.
          </h1>

          <p className="subtitle">
            Set up your brand — so AI can personalise everything just for you.
          </p>

          {error && <p style={{ color: "#c0392b", marginTop: 14 }}>{error}</p>}

          <button
            className="cta"
            onClick={() => router.push("/onboardingInfo")}
            aria-label="Get started"
            type="button"
          >
            Get Started
          </button>

          <a
            className="do-later"
            onClick={(e) => {
              e.preventDefault();
              router.push("/dashboard");
            }}
            href="#"
          >
            Do it later
          </a>
        </section>
      </div>
    </>
  );
}
