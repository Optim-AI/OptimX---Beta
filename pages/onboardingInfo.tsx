import React, { useEffect, useState } from "react";
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
  "Retail","E-commerce","Food & Beverage","Fashion & Apparel","Education & E-learning",
  "Real Estate & Property","Healthcare","SaaS","Local Services","Hospitality",
  "Manufacturing","Fintech","Automotive","Travel & Tourism","Professional Services",
  "Media & Entertainment","Telecom","Logistics & Shipping","Non-Profit","Other",
];

const BUSINESS_SIZES = [
  "Solo / Individual","Small (1-10)","Medium (11-50)","Large (51-200)","Enterprise (200+)"
];

const USE_CASE_OPTIONS = [
  "Increase ROI on ad spend","Improve ad creatives (images/videos)",
  "Audience targeting & segmentation","Automated A/B testing",
  "Landing page optimization","Scale campaigns efficiently",
  "Reduce CAC","Improve LTV","Generate qualified leads","Other (consultation)"
];

const HEARD_FROM_OPTIONS = [
  "Google / Search","Friend / Referral","Social Media","Paid Ad",
  "Email","Event / Conference","Partner","Other"
];

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

  if (loading) return <div style={{ padding: 24 }}>Loading…</div>;

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background:
          "linear-gradient(135deg, #dbeafe 0%, #e0f2fe 40%, #f5f3ff 100%)",
        padding: 40,
        fontFamily:
          "'Poppins', Inter, system-ui, -apple-system, 'Segoe UI', Roboto",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 960,
          background: "white",
          borderRadius: 20,
          padding: 36,
          boxShadow: "0 18px 60px rgba(8,32,80,0.06)",
          position: "relative",
        }}
      >
        {/* Progress bar */}
        <div
          style={{
            width: "80%",
            maxWidth: 720,
            height: 12,
            margin: "0 auto 24px",
            background: "#f1f5f9",
            borderRadius: 12,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${progressPercent}%`,
              background: `linear-gradient(90deg,${COLOR_A},${COLOR_B})`,
              borderRadius: 12,
              transition: "width 0.4s ease",
            }}
          />
        </div>

        {/* Step 1 */}
        {step === 1 && (
          <div style={{ textAlign: "center" }}>
            <h2 style={{ fontWeight: 600, marginBottom: 8 }}>
              Hi <span style={{ color: COLOR_B }}>{firstName}</span> 👋
            </h2>
            <p style={{ color: "#374151", marginBottom: 24 }}>
              Let’s get to know your business
            </p>

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
                  border: "2px dashed #e5e7eb",
                  borderRadius: 16,
                  padding: 24,
                  textAlign: "center",
                  background: "#fafafa",
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
                  }}
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

              <button onClick={handleNext} style={buttonStyle}>
                Next
              </button>
            </div>
          </div>
        )}

        {/* Step 2 */}
        {step === 2 && (
          <div>
            <h2 style={{ textAlign: "center", fontWeight: 600, marginBottom: 24 }}>
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
                      businessType === bt ? "#f4f4f5" : "white",
                    cursor: "pointer",
                    fontWeight: 500,
                  }}
                >
                  {bt}
                </button>
              ))}
            </div>
            <div style={{ textAlign: "center", marginTop: 24 }}>
              <button onClick={handleNext} style={buttonStyle}>
                Next
              </button>
            </div>
          </div>
        )}

        {/* Step 3 */}
        {step === 3 && (
          <div>
            <h2 style={{ textAlign: "center", fontWeight: 600, marginBottom: 24 }}>
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
                      ? "#f4f4f5"
                      : "white",
                    cursor: "pointer",
                  }}
                >
                  {opt}
                </button>
              ))}
            </div>
            <div style={{ textAlign: "center", marginTop: 24 }}>
              <button onClick={handleNext} style={buttonStyle}>
                Next
              </button>
            </div>
          </div>
        )}

        {/* Step 4 */}
        {step === 4 && (
          <div>
            <h2 style={{ textAlign: "center", fontWeight: 600, marginBottom: 24 }}>
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
                      businessSize === sz ? "#f4f4f5" : "white",
                    cursor: "pointer",
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
  );
}

/* ---- Styles ---- */
const inputStyle: React.CSSProperties = {
  height: 48,
  width: "80%",
  borderRadius: 12,
  border: "1px solid #e5e7eb",
  padding: "0 16px",
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
};
