// pages/onboarding-info.tsx
'use client';

import React, { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from '@/auth/supabase/client';
import { profileClient } from '@/database/client-helpers';
import { storageClient } from '@/lib/storage/client';
import designColors from '@/lib/ui/colors';
import type { JSX } from "react"; 

type ProfileRow = {
  id: string;
  email?: string | null;
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
  organisation_name?: string | null;
  gst_number?: string | null;
};

const BUSINESS_TYPES = [
  "Food & Beverage (Restaurant, Cafes)",
  "Fashion & Apparel",
  "Beauty & Personal Care",
  "Health, Fitness & Wellness",
  "Education & E-learning",
  "Real Estate & Property",
  "Travel & Hospitality",
  "Automotive & Dealerships",
  "Finance, Banking & Insurance",
  "Technology & SaaS",
  "Home & Lifestyle",
  "Entertainment & Events",
  "Media & Advertising",
  "Logistics & Transportation",
  "Manufacturing & Industrial",
  "Professional Services (Agencies, Consultants, Freelancers)",
  "Non-Profit",
  "Agriculture & Farming",
  "Other"
];

const BUSINESS_SIZES = [
  "Solo / Individual",
  "Small (1-10)",
  "Medium (11-50)",
  "Large (51-200)",
  "Enterprise (200+)"
];

const USE_CASE_OPTIONS = [
  "Run Ads & Promotions",
  "Increase Brand Awareness",
  "Drive Store Visits / Foot Traffic",
  "Generate Leads or Signups",
  "Boost Online Sales",
  "Engage Existing Customers",
  "Launch New Products / Offers",
  "Analyze Marketing Performance",
  "Automate Campaigns with AI",
  "Other"
];

const HEARD_FROM_OPTIONS = [
  "Google / Search",
  "Friend / Referral",
  "Social Media",
  "Paid Ad",
  "Email",
  "Event / Conference",
  "Partner",
  "Other"
];

const colors = {
  background: designColors.background,
  primary: designColors.primary,
  primaryGlow: designColors.primaryGlow ?? designColors.primary,
  gradientMesh: designColors.gradientMesh,
  card: designColors.card,
  foreground: designColors.foreground,
  muted: designColors.muted,
  mutedForeground: designColors.mutedForeground,
  border: designColors.border,
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

/** Capitalize first letter (same idea as welcome.tsx) */
function capitalize(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/** Extract display name from user metadata/email (same logic style as welcome.tsx) */
function extractName(user: any) {
  if (!user) return null;
  const meta = user.user_metadata ?? {};
  const candidates = [
    meta.full_name ?? meta.name ?? meta.fullName ?? meta.first_name ?? meta.given_name,
    user.email ? user.email.split("@")[0] : undefined,
  ];
  for (const c of candidates) {
    if (c && String(c).trim().length > 0) return String(c).trim();
  }
  return null;
}

export default function OnboardingInfoPage(): JSX.Element {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(1);
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Partial<ProfileRow>>({});

  // NEW: store email + full display name so we can both greet and save them
  const [email, setEmail] = useState<string | null>(null);
  const [fullName, setFullName] = useState<string | null>(null);

  const [businessName, setBusinessName] = useState("");
  const [location, setLocation] = useState("");
  const [tagline, setTagline] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [heardFrom, setHeardFrom] = useState(HEARD_FROM_OPTIONS[0]);
  const [heardFromOther, setHeardFromOther] = useState("");
  const [organisationName, setOrganisationName] = useState("");
  const [gstNumber, setGstNumber] = useState("");

  const [businessType, setBusinessType] = useState(BUSINESS_TYPES[0]);
  const [useCase, setUseCase] = useState<string[]>([]);
  const [businessSize, setBusinessSize] = useState(BUSINESS_SIZES[0]);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [validationError, setValidationError] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const orbOuterRef = useRef<HTMLDivElement | null>(null);
  const orbInnerRef = useRef<HTMLDivElement | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);

  // Load user + profile
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const getUserRes = await supabase.auth.getUser();
        const user = getUserRes?.data?.user ?? null;
        if (!user) {
          router.push("/auth/signin");
          return;
        }
        setUserId(user.id);

        // NEW: derive display name & email using same style as welcome.tsx
        const extracted = extractName(user);
        if (extracted) {
          setFullName(capitalize(extracted));
        }
        setEmail(user.email ?? null);

        const result = await profileClient.get();
        const data = result.success ? result.data : null;

        if (result.success && data) {
          setProfile(data as Partial<ProfileRow>);
          setBusinessName(data.business_name || "");
          setLocation(data.location || "");
          setTagline(data.tagline || "");
          setBusinessType(data.business_type || BUSINESS_TYPES[0]);
          setBusinessSize(data.business_size || BUSINESS_SIZES[0]);
          if (Array.isArray(data.use_case)) setUseCase(data.use_case);
          setHeardFrom(data.heard_from || HEARD_FROM_OPTIONS[0]);
          setHeardFromOther(data.heard_from_other || "");
          setOrganisationName(data.organisation_name || "");
          setGstNumber(data.gst_number || "");

          if (data.logo_path) {
            const publicUrl = storageClient.getPublicUrl("user-uploads", data.logo_path);
            setLogoPreview(publicUrl || null);
          }

          // If profile already has full_name/email but we didn't set from auth, keep them as fallback
          if (!fullName && data.full_name) {
            setFullName(String(data.full_name));
          }
          if (!email && data.email) {
            setEmail(String(data.email));
          }
        } else if (!result.success) {
          // not fatal — may be first time user
          // console.warn("profile fetch:", result.error);
        }
      } catch (e: any) {
        setError(e?.message ?? String(e));
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  useEffect(() => {
    if (logoFile) {
      const url = URL.createObjectURL(logoFile);
      setLogoPreview(url);
      return () => URL.revokeObjectURL(url);
    }
    // if logoFile removed, keep previously loaded preview (from storage) intact
  }, [logoFile]);

  // UPDATED: greeting uses same idea as welcome.tsx (name from auth, fallback to profile/email)
  const firstName = (() => {
    const nameFromState = (fullName || "")?.trim();
    if (nameFromState) return nameFromState.split(" ")[0];

    const nameFromProfile = (profile.full_name || "")?.trim();
    if (nameFromProfile) return nameFromProfile.split(" ")[0];

    const emailFromState = (email || "")?.trim();
    if (emailFromState) return emailFromState.split("@")[0];

    if (profile.email) return (profile.email as string).split("@")[0];

    return "there";
  })();

  const progressPercent = ((step - 1) / 3) * 100;

  async function uploadFile(file: File, path: string) {
    const { error } = await storageClient.upload("user-uploads", path, file, {
      upsert: true,
    });
    if (error) throw error;
    return path;
  }

  const GST_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

  const handleNext = () => {
    setFieldErrors({});
    setValidationError(null);

    if (step === 1) {
      const errors: Record<string, string> = {};
      if (!businessName.trim()) errors.businessName = "Business name is required.";
      if (!location.trim()) errors.location = "Location is required.";
      if (!tagline.trim()) errors.tagline = "Tagline is required.";
      if (!organisationName.trim()) errors.organisationName = "Organisation name is required.";
      if (!gstNumber.trim()) {
        errors.gstNumber = "GST number is required.";
      } else if (!GST_REGEX.test(gstNumber.trim().toUpperCase())) {
        errors.gstNumber = "Invalid GST number. Expected format: 22AAAAA0000A1Z5";
      }
      if (!logoFile && !logoPreview) errors.logo = "Logo is required.";
      if (heardFrom === "Other" && !heardFromOther.trim()) errors.heardFromOther = "Please specify how you heard about us.";

      if (Object.keys(errors).length > 0) {
        setFieldErrors(errors);
        return;
      }
    }

    if (step === 3 && useCase.length === 0) {
      setValidationError("Please select at least one use case.");
      return;
    }

    setStep((s) => Math.min(4, s + 1));
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
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
        // NEW: make sure email + full_name are saved in profiles
        email: email || profile.email || null,
        full_name: fullName || profile.full_name || null,
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
        organisation_name: organisationName || null,
        gst_number: gstNumber || null,
      };

      const result = await profileClient.upsert(payload);
      if (!result.success) throw new Error(result.error || "Profile update failed");
      router.push("/creative-studio");
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setSaving(false);
    }
  };

  // Parallax & gentle tilt based on mouse position for subtle motion
  useEffect(() => {
    // Guard early if the container never mounts
    if (!containerRef) return;

    function handleMove(e: MouseEvent) {
      const containerEl = containerRef.current;
      if (!containerEl) return; // <--- explicit runtime & TS-safe check

      const rect = containerEl.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = (e.clientX - cx) / rect.width; // -0.5..0.5
      const dy = (e.clientY - cy) / rect.height;

      if (orbOuterRef.current) {
        orbOuterRef.current.style.transform = `translate3d(${dx * 30}px, ${dy * 20}px, 0)`;
      }
      if (orbInnerRef.current) {
        orbInnerRef.current.style.transform = `translate3d(${dx * 16}px, ${dy * 10}px, 0)`;
      }
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

    const el = containerRef.current;
    // If element isn't mounted yet, no event listeners to attach.
    if (!el) return;

    el.addEventListener("mousemove", handleMove);
    el.addEventListener("mouseleave", handleLeave);

    return () => {
      el.removeEventListener("mousemove", handleMove);
      el.removeEventListener("mouseleave", handleLeave);
    };
  }, []); // refs are stable, empty deps are fine


  if (loading) return <div className="app-page" style={{ padding: 24, minHeight: '100vh', color: colors.foreground, background: colors.background }}>Loading…</div>;

  return (
    <div
      ref={containerRef}
      className="app-page"
      style={{ minHeight: "100vh", position: "relative", overflow: "hidden" }}
    >
      {/* Background Layers */}
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

      {/* Card */}
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
            boxShadow: "0 1px 2px hsl(0 0% 0% / 0.04), 0 4px 12px hsl(0 0% 0% / 0.04), 0 12px 40px hsl(0 0% 0% / 0.06)",
            overflow: "hidden",
            background: `linear-gradient(135deg, ${withAlpha(colors.card, 0.9)} 0%, ${withAlpha(colors.card, 0.95)} 100%)`,
            border: `1px solid ${colors.border}`,
            backdropFilter: "blur(20px)",
            position: "relative",
            zIndex: 2,
            transform: "translateZ(0)",
            animation: "cardEntrance 700ms cubic-bezier(.2,.9,.3,1) both",
          }}
        >
          {/* Back button placed on the container (card) top-left */}
          <button
            aria-label="Go back"
            onClick={() => router.back()}
            style={{
              position: "absolute",
              top: 14,
              left: 14,
              zIndex: 6,
              height: 36,
              width: 36,
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.1)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: colors.muted,
              boxShadow: "0 4px 12px hsl(0 0% 0% / 0.2)",
              cursor: "pointer",
              padding: 6,
              transition: "background 0.2s ease",
            }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.1)")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)")}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M15 19l-7-7 7-7" stroke={colors.foreground} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>

          {/* Inner layered background */}
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
            <div
              style={{
                position: "absolute",
                inset: 0,
                backgroundImage: `linear-gradient(135deg, ${withAlpha(
                  colors.primary,
                  0.06
                )} 0%, ${withAlpha(colors.primaryGlow ?? colors.primary, 0.03)} 60%, transparent 100%)`,
                mixBlendMode: "overlay",
                opacity: 1,
                transition: "opacity 0.6s ease",
              }}
            />

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

          {/* Content */}
          <div style={{ position: "relative", zIndex: 2 }}>
            <div
              style={{
                width: "80%",
                maxWidth: 720,
                height: 12,
                margin: "0 auto 16px",
                background: colors.muted,
                borderRadius: 12,
                overflow: "hidden",
                position: "relative",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${progressPercent}%`,
                  background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.primaryGlow} 100%)`,
                  borderRadius: 12,
                  transition: "width 0.4s ease",
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                <div className="shimmer" style={{ position: "absolute", inset: 0 }} />
              </div>
            </div>

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
                animation: "headerIn 520ms cubic-bezier(.2,.9,.3,1) both",
              }}
            >
              <img
                src="/images/Oli_AI_Logo.svg"
                alt="SkalX AI logo"
                style={{ width: 56, height: 56, objectFit: "contain", display: "block" }}
              />

              {/* SkalX AI brand title */}
              <div style={{ fontSize: 24, fontWeight: 800, color: colors.foreground, lineHeight: 1 }}>
                <span>SkalX AI</span>
              </div>

              {/* This line now uses firstName derived like welcome.tsx */}
              <div style={{ fontSize: 18, color: "hsl(0 0% 85%)", fontWeight: 600 }}>
                Hello <span style={{ color: colors.primary }}>{firstName}</span> — Let's get to know your business
              </div>
            </div>

            <div key={step} className="step-animate" style={{ willChange: "transform, opacity" }}>
              {/* Step 1 */}
              {step === 1 && (
                <div style={{ textAlign: "center" }}>
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
                      style={fieldErrors.businessName ? { ...inputStyle, borderColor: "#ef4444" } : inputStyle}
                    />
                    {fieldErrors.businessName && <div style={fieldErrorStyle}>{fieldErrors.businessName}</div>}
                    <input
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="Location"
                      style={fieldErrors.location ? { ...inputStyle, borderColor: "#ef4444" } : inputStyle}
                    />
                    {fieldErrors.location && <div style={fieldErrorStyle}>{fieldErrors.location}</div>}
                    <input
                      value={tagline}
                      onChange={(e) => setTagline(e.target.value)}
                      placeholder="Tagline (e.g., Empowering Growth with AI)"
                      style={fieldErrors.tagline ? { ...inputStyle, borderColor: "#ef4444" } : inputStyle}
                    />
                    {fieldErrors.tagline && <div style={fieldErrorStyle}>{fieldErrors.tagline}</div>}
                    <input
                      value={organisationName}
                      onChange={(e) => setOrganisationName(e.target.value)}
                      placeholder="Organisation Name"
                      style={fieldErrors.organisationName ? { ...inputStyle, borderColor: "#ef4444" } : inputStyle}
                    />
                    {fieldErrors.organisationName && <div style={fieldErrorStyle}>{fieldErrors.organisationName}</div>}
                    <input
                      value={gstNumber}
                      onChange={(e) => setGstNumber(e.target.value)}
                      placeholder="GST Number (e.g., 22AAAAA0000A1Z5)"
                      style={fieldErrors.gstNumber ? { ...inputStyle, borderColor: "#ef4444" } : inputStyle}
                    />
                    {fieldErrors.gstNumber && <div style={fieldErrorStyle}>{fieldErrors.gstNumber}</div>}

                    <div
                      style={{
                        width: "80%",
                        border: fieldErrors.logo ? "2px dashed #ef4444" : `2px dashed ${colors.border}`,
                        borderRadius: 16,
                        padding: 24,
                        textAlign: "center",
                        background: colors.muted,
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
                        <div style={{ color: colors.mutedForeground, marginBottom: 12 }}>
                          Upload your logo
                        </div>
                      )}
                      <label
                        style={{
                          display: "inline-block",
                          background: colors.primary,
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
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            setLogoFile(e.target.files ? e.target.files[0] : null)
                          }
                        />
                      </label>
                    </div>
                    {fieldErrors.logo && <div style={fieldErrorStyle}>{fieldErrors.logo}</div>}

                    <div style={{ width: "80%", textAlign: "left" }}>
                      <label style={{ display: "block", marginBottom: 8, fontSize: 14, fontWeight: 500, color: colors.foreground }}>
                        How did you find us?
                      </label>
                      <select
                        value={heardFrom}
                        onChange={(e) => setHeardFrom(e.target.value)}
                        style={{ ...inputStyle, width: "100%" }}
                      >
                        {HEARD_FROM_OPTIONS.map((h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                    </div>
                    {heardFrom === "Other" && (
                      <input
                        value={heardFromOther}
                        onChange={(e) => setHeardFromOther(e.target.value)}
                        placeholder="Please specify"
                        style={fieldErrors.heardFromOther ? { ...inputStyle, borderColor: "#ef4444" } : inputStyle}
                      />
                    )}
                    {fieldErrors.heardFromOther && <div style={fieldErrorStyle}>{fieldErrors.heardFromOther}</div>}

                    <button onClick={handleNext} style={buttonStyle} className="btn-cta">
                      Next
                    </button>
                  </div>
                </div>
              )}

              {/* Step 2 */}
              {step === 2 && (
                <div>
                  <h2 style={{ textAlign: "center", fontWeight: 600, marginBottom: 24, fontSize: 20, color: colors.foreground }}>
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
                              ? `2px solid ${colors.primary}`
                              : `1px solid ${colors.border}`,
                          background:
                            businessType === bt ? withAlpha(colors.primary, 0.12) : colors.card,
                          color: colors.foreground,
                          cursor: "pointer",
                          fontWeight: 500,
                          transition: "transform 160ms ease, box-shadow 160ms ease",
                          boxShadow: businessType === bt ? "0 6px 30px rgba(0,136,255,0.2)" : "none",
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
                  <h2 style={{ textAlign: "center", fontWeight: 600, marginBottom: 24, fontSize: 20, color: colors.foreground }}>
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
                            ? `2px solid ${colors.primary}`
                            : `1px solid ${colors.border}`,
                          background: useCase.includes(opt)
                            ? withAlpha(colors.primary, 0.12)
                            : colors.card,
                          cursor: "pointer",
                          color: colors.foreground,
                          transition: "transform 140ms ease",
                          transform: useCase.includes(opt) ? "translateY(-4px)" : "",
                        }}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                  <div style={{ textAlign: "center", marginTop: 24 }}>
                    {validationError && step === 3 && (
                      <div style={{ color: "#ef4444", fontSize: 14, marginBottom: 12 }}>
                        {validationError}
                      </div>
                    )}
                    <button onClick={handleNext} style={buttonStyle} className="btn-cta">
                      Next
                    </button>
                  </div>
                </div>
              )}

              {/* Step 4 */}
              {step === 4 && (
                <div>
                  <h2 style={{ textAlign: "center", fontWeight: 600, marginBottom: 24, fontSize: 20, color: colors.foreground }}>
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
                              ? `2px solid ${colors.primary}`
                              : `1px solid ${colors.border}`,
                          background:
                            businessSize === sz ? withAlpha(colors.primary, 0.12) : colors.card,
                          cursor: "pointer",
                          color: colors.foreground,
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
                <div style={{ color: "#ef4444", marginTop: 16, textAlign: "center" }}>
                  {error}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

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
        @keyframes cardEntrance {
          from { opacity: 0; transform: translateY(18px) scale(0.995); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes headerIn {
          from { opacity: 0; transform: translateY(8px) scale(0.995); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .step-animate {
          animation: stepIn 420ms cubic-bezier(.22,.9,.35,1);
        }
        @keyframes stepIn {
          from { opacity: 0; transform: translateY(8px) scale(0.997); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
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
  border: `1px solid ${colors.border}`,
  background: colors.card,
  color: colors.foreground,
  padding: "0 16px",
  outline: "none",
  transition: "box-shadow 160ms ease, transform 120ms ease, border-color 160ms ease",
  boxShadow: "inset 0 0 0 rgba(0,0,0,0)",
};
const buttonStyle: React.CSSProperties = {
  marginTop: 28,
  background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.primaryGlow} 100%)`,
  color: "white",
  border: "none",
  borderRadius: 12,
  padding: "16px 80px",
  fontSize: 16,
  fontWeight: 600,
  cursor: "pointer",
  boxShadow: "0 10px 30px rgba(0, 136, 255, 0.3)",
  transition: "transform 160ms ease, box-shadow 160ms ease",
};
const fieldErrorStyle: React.CSSProperties = {
  color: "#ef4444",
  fontSize: 13,
  marginTop: -10,
  width: "80%",
  textAlign: "left",
};
