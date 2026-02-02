"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";

import Sidebar from "../app/web/src/components/Sidebar";
import { supabase } from "../lib/supabaseClient";
import colors from "../lib/colors";

type BetaInsertPayload = {
  user_id: string;
  instagram_username: string | null;
  facebook_username: string | null;
  email: string | null;
  mobile_number: string | null;
  business_page_id?: string | null;
};

export default function IntegrationsBetaPage(): React.ReactElement {
  const router = useRouter();

  const [loading, setLoading] = useState(true);

  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [firstName, setFirstName] = useState<string>("there");

  const [instagramUsername, setInstagramUsername] = useState("");
  const [facebookUsername, setFacebookUsername] = useState("");
  const [email, setEmail] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [businessPageId, setBusinessPageId] = useState("");

  const [step, setStep] = useState<1 | 2>(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // pull some tokens
  const mutedForeground = (colors as any)?.mutedForeground ?? "#6b7280";
  const primaryColor = (colors as any)?.primary ?? "#0ea5e9";

  // ---- Load user, prefill email + name ----
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data } = await supabase.auth.getUser();
        const user = data?.user ?? null;
        if (!user) {
          router.push("/auth/signin");
          return;
        }

        setUserId(user.id);
        setUserEmail(user.email ?? null);
        if (user.email) setEmail(user.email);

        const meta = (user.user_metadata ?? {}) as any;
        const candidates = [
          meta.full_name ??
            meta.name ??
            meta.fullName ??
            meta.first_name ??
            meta.given_name,
          user.email ? user.email.split("@")[0] : undefined,
        ];
        let name = "there";
        for (const c of candidates) {
          if (c && String(c).trim().length > 0) {
            name = String(c).trim().split(" ")[0];
            break;
          }
        }
        setFirstName(name);
      } catch (e) {
        console.warn("integrationsbeta getUser error", e);
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  // ---- Submit: directly insert into Supabase table (no email, no API route) ----
  const handleSubmit = async () => {
    if (!userId) return;
    setSubmitting(true);
    setError(null);

    try {
      const payload: BetaInsertPayload = {
        user_id: userId,
        instagram_username: instagramUsername || null,
        facebook_username: facebookUsername || null,
        email: email || userEmail || null,
        mobile_number: mobileNumber || null,
        business_page_id: businessPageId || null,
      };

      const { error: insertErr } = await supabase
        .from("integrationsbeta")
        .insert(payload as any);

      if (insertErr) {
        console.error("integrationsbeta insert error:", insertErr);
        throw insertErr;
      }

      // ✅ Save done – now show confirmation (do NOT auto-redirect)
      setStep(2);
    } catch (e: any) {
      setError(e?.message ?? "Failed to submit. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // Form validation: all fields mandatory per your request
  const isFormValid =
    String(instagramUsername).trim().length > 0 &&
    String(facebookUsername).trim().length > 0 &&
    String(email).trim().length > 0 &&
    String(mobileNumber).trim().length > 0 &&
    String(businessPageId).trim().length > 0;

  return (
    <div className="min-h-screen flex relative overflow-hidden">
      {/* Background layers (same theme vibe) */}
      <div
        className="absolute inset-0 -z-20"
        style={{
          backgroundImage: `linear-gradient(135deg, ${(colors as any)?.background ?? "#eff6ff"} 0%, ${(colors as any)?.primary ?? "hsl(213 90% 56%)"}1f 45%, ${(colors as any)?.background ?? "#ffffff"} 100%)`,
        }}
      />
      <div
        className="absolute inset-0 -z-10"
        style={{
          background:
            (colors as any)?.gradientMesh ??
            "radial-gradient(circle at 20% 10%, rgba(99,102,241,0.08), transparent 35%), radial-gradient(circle at 80% 90%, rgba(14,165,233,0.08), transparent 30%)",
          opacity: 0.9,
        }}
      />
      {/* Orbs */}
      <div
        className="absolute -top-16 -left-8 -z-10 blur-3xl"
        style={{
          width: 260,
          height: 260,
          borderRadius: "50%",
          backgroundColor: `${primaryColor}30`,
        }}
      />
      <div
        className="absolute -bottom-20 -right-10 -z-10 blur-3xl"
        style={{
          width: 320,
          height: 320,
          borderRadius: "50%",
          backgroundColor: `${primaryColor}26`,
        }}
      />

      {/* Sidebar (if you want it, uncomment) */}
      {/* <Sidebar /> */}

      <main className="flex-1 px-6 py-8 md:px-10 md:py-10">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Logo + OptimX brand */}
          <header className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <img
                src="/images/OptimX_Logo.svg"
                alt="OptimX logo"
                className="w-10 h-10 md:w-12 md:h-12 object-contain"
              />
              <div className="text-2xl font-extrabold tracking-tight">
                <span>Optim</span>
                <span style={{ color: primaryColor }}>X</span>
              </div>
            </div>

            {/* Skip text (go to dashboard) */}
            <div>
              <button
                type="button"
                onClick={() => router.push("/dashboard")}
                className="text-sm underline-offset-2 hover:underline"
                style={{
                  color: mutedForeground,
                  background: "transparent",
                  border: "none",
                }}
              >
                Skip
              </button>
            </div>
          </header>

          {/* Page header */}
          <div>
            <h1 className="text-3xl md:text-4xl font-bold mb-2 text-slate-900">
              Account Integration (Beta Mode)
            </h1>
            <p
              style={{ color: mutedForeground }}
              className="max-w-2xl text-sm md:text-base"
            >
              We&apos;re rolling out integrations in phases to make sure everything
              works perfectly for your business. During beta, our team manually
              activates your connections to Facebook and Instagram for you.
            </p>
          </div>

          {/* Friendly sub-header with their name */}
          <div className="text-lg font-medium text-slate-900">
            Hello{" "}
            <span className="font-bold" style={{ color: primaryColor }}>
              {firstName}
            </span>
            , let&apos;s get you ready for beta access.
          </div>

          {/* Step 1: Form */}
          {step === 1 && (
            <section
              className="bg-white rounded-2xl shadow-lg p-8 border border-slate-100"
              style={{
                boxShadow: "0 18px 45px rgba(15,23,42,0.12)",
                background:
                  "linear-gradient(180deg, rgba(255,255,255,0.98), rgba(255,255,255,0.94))",
              }}
            >
              {loading ? (
                <div className="text-sm text-slate-500">
                  Loading your details…
                </div>
              ) : (
                <>
                  <h2 className="text-xl font-semibold mb-4 text-slate-900">
                    Share your account details
                  </h2>

                  <p className="text-sm text-slate-500 mb-6">
                    We&apos;ll use this to link your Facebook and Instagram accounts
                    behind the scenes while everything is in beta.
                  </p>

                  <div className="space-y-4">
                    <label className="block">
                      <div className="text-sm font-medium mb-1 text-slate-800">
                        Instagram username
                      </div>
                      <input
                        value={instagramUsername}
                        onChange={(e) => setInstagramUsername(e.target.value)}
                        placeholder="your_instagram_handle"
                        className="w-full rounded-lg border border-slate-200 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 bg-white/80"
                      />
                    </label>

                    <label className="block">
                      <div className="text-sm font-medium mb-1 text-slate-800">
                        Facebook username
                      </div>
                      <input
                        value={facebookUsername}
                        onChange={(e) => setFacebookUsername(e.target.value)}
                        placeholder="your.facebook.profile"
                        className="w-full rounded-lg border border-slate-200 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 bg-white/80"
                      />
                    </label>

                    <label className="block">
                      <div className="text-sm font-medium mb-1 text-slate-800">
                        Business Page ID
                      </div>
                      <input
                        value={businessPageId}
                        onChange={(e) => setBusinessPageId(e.target.value)}
                        placeholder="123456789012345"
                        className="w-full rounded-lg border border-slate-200 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 bg-white/80"
                      />
                    </label>

                    <label className="block">
                      <div className="text-sm font-medium mb-1 text-slate-800">
                        Email
                      </div>
                      <input
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@company.com"
                        className="w-full rounded-lg border border-slate-200 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 bg-white/80"
                      />
                    </label>

                    <label className="block">
                      <div className="text-sm font-medium mb-1 text-slate-800">
                        Mobile number
                      </div>
                      <input
                        value={mobileNumber}
                        onChange={(e) => setMobileNumber(e.target.value)}
                        placeholder="+91 99999 99999"
                        className="w-full rounded-lg border border-slate-200 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 bg-white/80"
                      />
                    </label>

                    {error && (
                      <div className="text-sm text-red-600 mt-1">{error}</div>
                    )}

                    <div className="flex items-center justify-between mt-6 flex-wrap gap-3">
                      <div className="text-xs text-slate-500 max-w-xs">
                        During beta, our activation team uses these details to set up
                        your test access inside OptimX. You don&apos;t have to do
                        anything else.
                      </div>

                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={handleSubmit}
                          disabled={
                            submitting || loading || !userId || !isFormValid
                          }
                          className="px-5 py-3 rounded-lg text-white text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed transition-transform shadow-md"
                          style={{
                            backgroundColor: primaryColor,
                          }}
                        >
                          {submitting ? "Submitting…" : "Verify & Activate"}
                        </button>

                        <button
                          type="button"
                          onClick={() => router.push("/dashboard")}
                          className="text-sm underline-offset-2 hover:underline"
                          style={{
                            color: mutedForeground,
                            background: "transparent",
                            border: "none",
                          }}
                        >
                          Skip
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </section>
          )}

          {/* Step 2: Confirmation */}
          {step === 2 && (
            <section
              className="bg-white rounded-2xl shadow-lg p-8 border border-slate-100"
              style={{
                boxShadow: "0 18px 45px rgba(15,23,42,0.12)",
                background:
                  "linear-gradient(180deg, rgba(255,255,255,0.98), rgba(255,255,255,0.94))",
              }}
            >
              <h2 className="text-2xl font-bold mb-2 text-slate-900">
                We&apos;re on it 🚀
              </h2>

              <p className="text-slate-800 mb-3">
                We&apos;ve received your details. Our activation team will set up your
                integrations and notify you once it&apos;s ready to use.
              </p>

              <p className="text-sm text-slate-500 mb-6">
                This usually takes less than 24 hours during beta.
              </p>

              <div className="bg-slate-50 rounded-xl p-4 text-sm space-y-1 border border-slate-200">
                <div>
                  <span className="font-medium">Instagram:</span>{" "}
                  {instagramUsername || "—"}
                </div>
                <div>
                  <span className="font-medium">Facebook:</span>{" "}
                  {facebookUsername || "—"}
                </div>
                <div>
                  <span className="font-medium">Business Page ID:</span>{" "}
                  {businessPageId || "—"}
                </div>
                <div>
                  <span className="font-medium">Email:</span>{" "}
                  {email || userEmail || "—"}
                </div>
                <div>
                  <span className="font-medium">Mobile:</span>{" "}
                  {mobileNumber || "—"}
                </div>
              </div>

              <div className="mt-6 flex gap-3 flex-wrap">
                <button
                  type="button"
                  onClick={() => router.push("/dashboard")}
                  className="px-4 py-2 rounded-lg text-sm font-medium shadow-sm"
                  style={{
                    backgroundColor: primaryColor,
                    color: "#ffffff",
                  }}
                >
                  Go to dashboard
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStep(1);
                    setInstagramUsername("");
                    setFacebookUsername("");
                    setMobileNumber("");
                    setBusinessPageId("");
                  }}
                  className="px-4 py-2 rounded-lg text-sm font-medium border border-slate-300 bg-white/80 hover:bg-slate-50"
                >
                  Submit another
                </button>
              </div>
            </section>
          )}
        </div>

        <div className="mt-4 text-sm text-slate-500 px-6">
          {loading ? "Checking your profile…" : "Beta integration request ready."}
        </div>
      </main>
    </div>
  );
}
