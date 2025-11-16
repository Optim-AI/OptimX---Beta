// pages/onboarding-info.tsx
'use client';

import React, { useEffect, useState, useRef } from "react";
import { useRouter } from "next/router";
import { supabase } from "../lib/supabaseClient";

type ProfileRow = {
  id: string;
  full_name?: string | null;
  business_name?: string | null;
  location?: string | null;
  business_type?: string | null;
  business_size?: string | null;
  use_case?: string[] | null;
  tagline?: string | null;
  logo_path?: string | null;
  heard_from?: string | null;
  heard_from_other?: string | null;
};

const BUSINESS_TYPES = [
  "Food & Beverage (Resaturant, Cafes)","Fashion & Apparel","Beauty & Personal Care","Health, Fitness & Welness","Education & E-learning",
  "Real Estate & Property","Travel & Hospitality","Automative & Dealerships","Finance, Banking & Insurance","Automotive & Dealerships",
  "Finance, Banking & Insurance","Technology & SaaS","Home & Lifestyle","Entertainment & Events","Media & Advertising",
  "Logistics & Transportation","Manufacturing & Industiral","Professional Services (Agencies, Consultants, Freelancers)","Non-Profit","Agriculture & Farming","Other"
];

const BUSINESS_SIZES = [
  "Solo / Individual","Small (1-10)","Medium (11-50)","Large (51-200)","Enterprise (200+)"
];

const USE_CASE_OPTIONS = [
  "Run Ads & Promotions","Increase Brand Awareness",
  "Drive Store Visits / Foot Traffic","Generate Leads or Signups",
  "Boost Online Sales","Engage Existing Customers",
  "Launch New Products / Offers","Analyze Marketing Performance","Automate Campaigns with AI","Other"
];

const HEARD_FROM_OPTIONS = [
  "Google / Search","Friend / Referral","Social Media","Paid Ad",
  "Email","Event / Conference","Partner","Other"
];

/* ---------- Color tokens used by the background/orbs ---------- */
/* Tweak these to match your design system */
const colors = {
  background: "hsl(212 55% 96%)", // soft paper
  primary: "hsl(213 90% 56%)", // blue
  primaryGlow: "hsl(205 95% 60%)", // glow tint
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

/* ---------- Page component ---------- */

export default function OnboardingInfoPage(): JSX.Element {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(1);
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Partial<ProfileRow>>({});

  const [businessName, setBusinessName] = useState("");
  const [location, setLocation] = useState("");
  const [tagline, setTagline] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [heardFrom, setHeardFrom] = useState(HEARD_FROM_OPTIONS[0]);
  const [heardFromOther, setHeardFromOther] = useState("");

  const [businessType, setBusinessType] = useState(BUSINESS_TYPES[0]);
  const [useCase, setUseCase] = useState<string[]>([]);
  const [businessSize, setBusinessSize] = useState(BUSINESS_SIZES[0]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const orbOuterRef = useRef<HTMLDivElement | null>(null);
  const orbInnerRef = useRef<HTMLDivElement | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);

  const BLACK = "#000000";
  const COLOR_A = "#3b82f6";
  const COLOR_B = "#0ea5e9";

  // Load user profile
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data: userData } = await supabase.auth.getUser();
        const user = userData?.user;
        if (!user) {
          router.push("/auth/signin");
          return;
        }
        setUserId(user.id);

        const { data, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single();
        if (!error && data) {
          setProfile(data);
          setBusinessName(data.business_name || "");
          setLocation(data.location || "");
          setTagline(data.tagline || "");
          setBusinessType(data.business_type || BUSINESS_TYPES[0]);
          setBusinessSize(data.business_size || BUSINESS_SIZES[0]);
          if (Array.isArray(data.use_case)) setUseCase(data.use_case);
          setHeardFrom(data.heard_from || HEARD_FROM_OPTIONS[0]);
          setHeardFromOther(data.heard_from_other || "");
          if (data.logo_path) {
            const { data: url } = supabase.storage
              .from("user-uploads")
              .getPublicUrl(data.logo_path);
            setLogoPreview(url?.publicUrl || null);
          }
        }
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  useEffect(() => {
    if (logoFile) {
      const url = URL.createObjectURL(logoFile);
      setLogoPreview(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [logoFile]);

  const firstName = (() => {
    const name = profile.full_name?.trim();
    if (name) return name.split(" ")[0];
    if (profile.email) return profile.email.split("@")[0];
    return "there";
  })();

  const progressPercent = ((step - 1) / 3) * 100;

  async function uploadFile(file: File, path: string) {
    const { error } = await supabase.storage
      .from("user-uploads")
      .upload(path, file, { upsert: true });
    if (error) throw error;
    return path;
  }

  const handleNext = () => {
    // animate step change (key-driven entrance handled by JSX)
    setStep((s) => Math.min(4, s + 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleFinish = async () => {
    if (!userId) return;
    setSaving(true);
    try {
      let logo_path: string | null = profile.logo_path || null;
      if (logoFile) {
        const safeName = `${Date.now()}_${logoFile.name.replace(/\s+/g, "_")}`;
        const path = `${userId}/logo/${safeName}`;
        await uploadFile(logoFile, path);
        logo_path = path;
      }

      const payload = {
        id: userId,
        business_name: businessName || null,
        location: location || null,
        tagline: tagline || null,
        logo_path,
        business_type: businessType || null,
        business_size: businessSize || null,
        use_case: useCase.length ? useCase : null,
        heard_from: heardFrom || null,
        heard_from_other:
          heardFrom === "Other" ? heardFromOther || null : null,
      };

      const { error: upErr } = await supabase
        .from("profiles")
        .upsert(payload, { onConflict: "id" });
      if (upErr) throw upErr;
      router.push("/integrationsnew");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  // Parallax & gentle tilt based on mouse position for subtle motion
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    function handleMove(e: MouseEvent) {
      const rect = container.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = (e.clientX - cx) / rect.width; // -0.5..0.5
      const dy = (e.clientY - cy) / rect.height;
      // move outer orbs a bit
      if (orbOuterRef.current) {
        orbOuterRef.current.style.transform = `translate3d(${dx * 30}px, ${dy * 20}px, 0)`;
      }
      // inner orb moves slightly less for layered depth
      if (orbInnerRef.current) {
        orbInnerRef.current.style.transform = `translate3d(${dx * 16}px, ${dy * 10}px, 0)`;
      }
      // card tilt
      if (cardRef.current) {
        const tiltX = dy * 6; // degrees
        const tiltY = dx * -6;
        cardRef.current.style.transform = `perspective(1000px) rotateX(${tiltX}deg) rotateY(${tiltY}deg) translateZ(0)`;
      }
    }

    function handleLeave() {
      if (orbOuterRef.current) orbOuterRef.current.style.transform = "";
      if (orbInnerRef.current) orbInnerRef.current.style.transform = "";
      if (cardRef.current) cardRef.current.style.transform = "";
    }

    container.addEventListener("mousemove", handleMove);
    container.addEventListener("mouseleave", handleLeave);

    return () => {
      container.removeEventListener("mousemove", handleMove);
      container.removeEventListener("mouseleave", handleLeave);
    };
  }, []);

  if (loading) return <div style={{ padding: 24 }}>Loading…</div>;

  return (
    <div
      ref={containerRef}
      style={{ minHeight: "100vh", position: "relative", overflow: "hidden" }}
    >
      {/* =========================
          Background Layers (outside the card)
         ========================= */}
      <div
        aria-hidden
        className="bg-outer-gradient"
        style={{
          position: "absolute",
          inset: 0,
          zIndex: -20,
          backgroundImage: `linear-gradient(135deg, ${colors.background} 0%, ${withAlpha(
            colors.primary,
            0.12
          )} 35%, ${withAlpha(colors.primaryGlow ?? colors.primary, 0.06)} 60%, ${
            colors.background
          } 100%)`,
          transition: "background 0.6s ease",
        }}
      />

      <div
        aria-hidden
        className="mesh-gradient"
        style={{
          position: "absolute",
          inset: 0,
          zIndex: -19,
          background: colors.gradientMesh,
          opacity: 0.9,
        }}
      />

      {/* Stronger animated orbs outside the card */}
      <div
        ref={orbOuterRef}
        aria-hidden
        className="orb orb-outer"
        style={{
          position: "absolute",
          top: "3rem",
          left: "2rem",
          width: 384,
          height: 384,
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
        className="orb orb-outer-2"
        style={{
          position: "absolute",
          bottom: "2.2rem",
          right: "1.2rem",
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
        className="orb orb-giant"
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
          backgroundImage: `linear-gradient(90deg, ${withAlpha(
            colors.primary,
            0.12
          )} 0%, ${withAlpha(colors.primaryGlow ?? colors.primary, 0.08)} 100%)`,
          animation: "floatVerySlow 20s linear infinite",
          opacity: 0.85,
          mixBlendMode: "screen",
        }}
      />

      {/* Centered card (contains an inner stronger layered background) */}
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 40,
          fontFamily:
            "'Poppins', Inter, system-ui, -apple-system, 'Segoe UI', Roboto",
        }}
      >
        <div
          ref={cardRef}
          className="card"
          style={{
            width: "100%",
            maxWidth: 980,
            borderRadius: 24,
            padding: 36,
            boxShadow: "0 28px 90px rgba(8,32,80,0.12)",
            overflow: "hidden",
            background: "linear-gradient(180deg, rgba(255,255,255,0.92), rgba(255,255,255,0.80))",
            backdropFilter: "saturate(140%) blur(10px)",
            position: "relative",
            zIndex: 2,
            transform: "translateZ(0)",
            animation: "cardEntrance 700ms cubic-bezier(.2,.9,.3,1) both",
          }}
        >
          {/* ---------- Inner layered background inside the card ---------- */}
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: 20,
              pointerEvents: "none",
              zIndex: 0,
            }}
          >
            {/* subtle gradient stronger */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                backgroundImage: `linear-gradient(135deg, ${withAlpha(
                  colors.primary,
                  0.06
                )} 0%, ${withAlpha(
                  colors.primaryGlow ?? colors.primary,
                  0.03
                )} 60%, transparent 100%)`,
                mixBlendMode: "overlay",
                opacity: 1,
                transition: "opacity 0.6s ease",
              }}
            />

            {/* mesh */}
            <div
              className="mesh-gradient"
              style={{
                position: "absolute",
                inset: 0,
                opacity: 0.55,
                pointerEvents: "none",
                mixBlendMode: "screen",
              }}
            />

            {/* orbs inside the card (stronger and a bit closer) */}
            <div
              ref={orbInnerRef}
              className="inner-orb inner-orb-1"
              style={{
                position: "absolute",
                top: -28,
                left: -28,
                width: 192,
                height: 192,
                borderRadius: "50%",
                filter: "blur(28px)",
                backgroundColor: withAlpha(colors.primary, 0.34),
                opacity: 1,
                animation: "float 7s ease-in-out infinite",
                zIndex: 0,
                boxShadow: `0 0 80px ${withAlpha(colors.primary, 0.16)}`,
              }}
            />
            <div
              className="inner-orb inner-orb-2"
              style={{
                position: "absolute",
                bottom: -40,
                right: -20,
                width: 288,
                height: 288,
                borderRadius: "50%",
                filter: "blur(30px)",
                backgroundColor: withAlpha(colors.primaryGlow ?? colors.primary, 0.26),
                animation: "float 8s ease-in-out infinite",
                animationDelay: "1.2s",
                zIndex: 0,
                boxShadow: `0 0 80px ${withAlpha(colors.primaryGlow ?? colors.primary, 0.12)}`,
              }}
            />
            <div
              className="inner-orb inner-orb-giant"
              style={{
                position: "absolute",
                top: "30%",
                left: "50%",
                transform: "translateX(-50%)",
                width: 420,
                height: 420,
                borderRadius: "50%",
                filter: "blur(24px)",
                backgroundImage: `linear-gradient(90deg, ${withAlpha(colors.primary, 0.08)} 0%, ${withAlpha(colors.primaryGlow ?? colors.primary, 0.06)} 100%)`,
                animation: "floatSlow 13s ease-in-out infinite",
                animationDelay: "3s",
                zIndex: 0,
                opacity: 0.95,
              }}
            />
          </div>

          {/* Content (zIndex above background). Progress bar first */}
          <div style={{ position: "relative", zIndex: 2 }}>
            {/* Progress bar with shimmer */}
            <div
              style={{
                width: "80%",
                maxWidth: 720,
                height: 12,
                margin: "0 auto 16px",
                background: "#f1f5f9",
                borderRadius: 12,
                overflow: "hidden",
                position: "relative",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${progressPercent}%`,
                  background: `linear-gradient(90deg,${COLOR_A},${COLOR_B})`,
                  borderRadius: 12,
                  transition: "width 0.4s ease",
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                <div className="shimmer" style={{ position: "absolute", inset: 0 }} />
              </div>
            </div>

            {/* --- CENTERED VERTICAL HEADER (logo, brand, greeting) BELOW PROGRESS BAR --- */}
            <div
              className="centered-header"
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                marginBottom: 20,
                textAlign: "center",
                zIndex: 3,
                // animation on appear
                animation: "headerIn 520ms cubic-bezier(.2,.9,.3,1) both",
              }}
            >
              {/* Logo image: put the file into /public/images/optimx-logo.png */}
              <img
                src="/images/optimx-logo.png"
                alt="OptimX logo"
                style={{ width: 56, height: 56, objectFit: "contain", display: "block" }}
              />

              {/* Brand name: Optim + X (X in blue) */}
              <div style={{ fontSize: 24, fontWeight: 800, color: "#0f172a", lineHeight: 1 }}>
                <span>Optim</span>
                <span style={{ color: colors.primary, marginLeft: 6 }}>X</span>
              </div>

              {/* Greeting single-line */}
              <div style={{ fontSize: 18, color: "#111827", fontWeight: 600 }}>
                Hello <span style={{ color: COLOR_B }}>{firstName}</span> — Let’s get to know your business
              </div>
            </div>

            {/* Step content keyed by step for re-mount animation */}
            <div key={step} className="step-animate" style={{ willChange: "transform, opacity" }}>
              {/* Step 1 */}
              {step === 1 && (
                <div style={{ textAlign: "center" }}>
                  {/* Removed the duplicated greeting from here per your request */}
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 18,
                      alignItems: "center",
                    }}
                  >
                    <input
                      value={businessName}
                      onChange={(e) => setBusinessName(e.target.value)}
                      placeholder="Business name"
                      style={inputStyle}
                    />
                    <input
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="Location"
                      style={inputStyle}
                    />
                    <input
                      value={tagline}
                      onChange={(e) => setTagline(e.target.value)}
                      placeholder="Tagline (e.g., Empowering Growth with AI)"
                      style={inputStyle}
                    />

                    {/* Upload Logo Card */}
                    <div
                      style={{
                        width: "80%",
                        border: "2px dashed rgba(229,231,235,0.9)",
                        borderRadius: 16,
                        padding: 24,
                        textAlign: "center",
                        background: "linear-gradient(180deg, rgba(250,250,250,0.7), rgba(255,255,255,0.45))",
                        transition: "transform 180ms ease",
                      }}
                    >
                      {logoPreview ? (
                        <img
                          src={logoPreview}
                          alt="Logo"
                          style={{
                            height: 80,
                            margin: "0 auto 8px",
                            objectFit: "contain",
                          }}
                        />
                      ) : (
                        <div style={{ color: "#6b7280", marginBottom: 12 }}>
                          Upload your logo
                        </div>
                      )}
                      <label
                        style={{
                          display: "inline-block",
                          background: BLACK,
                          color: "white",
                          borderRadius: 8,
                          padding: "10px 22px",
                          fontSize: 14,
                          fontWeight: 500,
                          cursor: "pointer",
                          transition: "transform 120ms ease",
                        }}
                        onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.transform = "translateY(-3px)")}
                        onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.transform = "")}
                      >
                        Upload Logo
                        <input
                          type="file"
                          accept="image/*"
                          style={{ display: "none" }}
                          onChange={(e) =>
                            setLogoFile(e.target.files ? e.target.files[0] : null)
                          }
                        />
                      </label>
                    </div>

                    {/* Heard From */}
                    <select
                      value={heardFrom}
                      onChange={(e) => setHeardFrom(e.target.value)}
                      style={inputStyle}
                    >
                      {HEARD_FROM_OPTIONS.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                    {heardFrom === "Other" && (
                      <input
                        value={heardFromOther}
                        onChange={(e) => setHeardFromOther(e.target.value)}
                        placeholder="Please specify"
                        style={inputStyle}
                      />
                    )}

                    <button onClick={handleNext} style={buttonStyle} className="btn-cta">
                      Next
                    </button>
                  </div>
                </div>
              )}

              {/* Step 2 */}
              {step === 2 && (
                <div>
                  <h2 style={{ textAlign: "center", fontWeight: 600, marginBottom: 24, fontSize: 20 }}>
                    Choose your Industry
                  </h2>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))",
                      gap: 12,
                    }}
                  >
                    {BUSINESS_TYPES.map((bt) => (
                      <button
                        key={bt}
                        onClick={() => setBusinessType(bt)}
                        style={{
                          padding: "16px 10px",
                          borderRadius: 12,
                          border:
                            businessType === bt
                              ? `2px solid ${BLACK}`
                              : "1px solid #e5e7eb",
                          background:
                            businessType === bt ? "rgba(0,0,0,0.03)" : "white",
                          cursor: "pointer",
                          fontWeight: 500,
                          transition: "transform 160ms ease, box-shadow 160ms ease",
                          boxShadow: businessType === bt ? "0 6px 30px rgba(16,24,40,0.06)" : "none",
                        }}
                      >
                        {bt}
                      </button>
                    ))}
                  </div>
                  <div style={{ textAlign: "center", marginTop: 24 }}>
                    <button onClick={handleNext} style={buttonStyle} className="btn-cta">
                      Next
                    </button>
                  </div>
                </div>
              )}

              {/* Step 3 */}
              {step === 3 && (
                <div>
                  <h2 style={{ textAlign: "center", fontWeight: 600, marginBottom: 24, fontSize: 20 }}>
                    What is your core use case?
                  </h2>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
                      gap: 10,
                    }}
                  >
                    {USE_CASE_OPTIONS.map((opt) => (
                      <button
                        key={opt}
                        onClick={() =>
                          setUseCase((prev) =>
                            prev.includes(opt)
                              ? prev.filter((p) => p !== opt)
                              : [...prev, opt]
                          )
                        }
                        style={{
                          borderRadius: 10,
                          padding: 12,
                          height: 64,
                          border: useCase.includes(opt)
                            ? `2px solid ${BLACK}`
                            : "1px solid #e5e7eb",
                          background: useCase.includes(opt)
                            ? "rgba(0,0,0,0.03)"
                            : "white",
                          cursor: "pointer",
                          transition: "transform 140ms ease",
                          transform: useCase.includes(opt) ? "translateY(-4px)" : "",
                        }}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                  <div style={{ textAlign: "center", marginTop: 24 }}>
                    <button onClick={handleNext} style={buttonStyle} className="btn-cta">
                      Next
                    </button>
                  </div>
                </div>
              )}

              {/* Step 4 */}
              {step === 4 && (
                <div>
                  <h2 style={{ textAlign: "center", fontWeight: 600, marginBottom: 24, fontSize: 20 }}>
                    Choose the size of your business
                  </h2>
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      justifyContent: "center",
                      gap: 12,
                    }}
                  >
                    {BUSINESS_SIZES.map((sz) => (
                      <button
                        key={sz}
                        onClick={() => setBusinessSize(sz)}
                        style={{
                          padding: "14px 18px",
                          borderRadius: 12,
                          border:
                            businessSize === sz
                              ? `2px solid ${BLACK}`
                              : "1px solid #e5e7eb",
                          background:
                            businessSize === sz ? "rgba(0,0,0,0.03)" : "white",
                          cursor: "pointer",
                          transition: "transform 140ms ease",
                          transform: businessSize === sz ? "translateY(-4px)" : "",
                        }}
                      >
                        {sz}
                      </button>
                    ))}
                  </div>
                  <div style={{ textAlign: "center", marginTop: 32 }}>
                    <button
                      onClick={handleFinish}
                      disabled={saving}
                      style={{
                        ...buttonStyle,
                        opacity: saving ? 0.7 : 1,
                        cursor: saving ? "not-allowed" : "pointer",
                      }}
                      className="btn-cta"
                    >
                      {saving ? "Saving…" : "Finish & Continue"}
                    </button>
                  </div>
                </div>
              )}

              {error && (
                <div style={{ color: "red", marginTop: 16, textAlign: "center" }}>
                  {error}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Local css for float animation, shimmer, entrances, header & step transition */}
      <style jsx>{`
        /* float animations */
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

        /* Card entrance */
        @keyframes cardEntrance {
          from { opacity: 0; transform: translateY(18px) scale(0.995); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        /* Header entrance */
        @keyframes headerIn {
          from { opacity: 0; transform: translateY(8px) scale(0.995); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        /* Step entrance animation triggered on key change */
        .step-animate {
          animation: stepIn 420ms cubic-bezier(.22,.9,.35,1);
        }
        @keyframes stepIn {
          from { opacity: 0; transform: translateY(8px) scale(0.997); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }

        /* shimmer overlay for progress */
        .shimmer {
          background: linear-gradient(120deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.18) 50%, rgba(255,255,255,0.06) 100%);
          transform: translateX(-120%);
          animation: shimmerMove 2.2s linear infinite;
          mix-blend-mode: overlay;
        }
        @keyframes shimmerMove {
          0% { transform: translateX(-120%); }
          100% { transform: translateX(120%); }
        }

        /* CTA button hover */
        .btn-cta {
          transition: transform 180ms cubic-bezier(.22,.9,.35,1), box-shadow 180ms ease;
        }
        .btn-cta:hover {
          transform: translateY(-6px) scale(1.01);
          box-shadow: 0 12px 40px rgba(14,165,233,0.12);
        }
        .btn-cta:active {
          transform: translateY(-1px) scale(0.998);
        }

        /* Respect reduced motion preference */
        @media (prefers-reduced-motion: reduce) {
          .orb, .orb-outer-2, .orb-giant, .inner-orb, .inner-orb-2, .inner-orb-giant {
            animation: none !important;
            transition: none !important;
          }
          .card { animation: none !important; transform: none !important; }
          .shimmer { animation: none !important; }
          .step-animate { animation: none !important; }
          .centered-header { animation: none !important; }
        }

        /* small responsive tweaks */
        @media (max-width: 640px) {
          .centered-header img { width: 48px; height: 48px; }
          .centered-header div[style] { font-size: 16px !important; }
        }
      `}</style>
    </div>
  );
}

/* ---- Styles ---- */
const inputStyle: React.CSSProperties = {
  height: 48,
  width: "80%",
  borderRadius: 12,
  border: "1px solid #e5e7eb",
  padding: "0 16px",
  outline: "none",
  transition: "box-shadow 160ms ease, transform 120ms ease",
  boxShadow: "inset 0 0 0 rgba(0,0,0,0)",
};
const buttonStyle: React.CSSProperties = {
  marginTop: 28,
  background: "#000000",
  color: "white",
  border: "none",
  borderRadius: 12,
  padding: "16px 80px",
  fontSize: 16,
  fontWeight: 600,
  cursor: "pointer",
  transition: "transform 160ms ease, box-shadow 160ms ease",
};
