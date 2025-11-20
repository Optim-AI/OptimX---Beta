// pages/settings.tsx
"use client";

import React, { useEffect, useRef, useState } from "react";
import Sidebar from "../app/web/src/components/Sidebar";
import { supabase } from "../lib/supabaseClient";
import { initFirebaseApp } from "../lib/firebaseClient";
import { useRouter } from "next/router";
import type { JSX } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../app/web/src/components/ui/card";
import { Button } from "../app/web/src/components/ui/button";
import { Input } from "../app/web/src/components/ui/input";
import { Label } from "../app/web/src/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../app/web/src/components/ui/tabs";

type ProfilePayload = {
  id: string;
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
  phone_verified?: boolean | null;
  business_name?: string | null;
  business_mobile?: string | null;
  business_mobile_verified?: boolean | null;
  location?: string | null;
  business_type?: string | null;
  business_size?: string | null;
  use_case?: string[] | null;
  color_primary?: string | null;
  color_secondary?: string | null;
  font?: string | null;
  logo_path?: string | null;
  ref_images?: string[] | null;
  tagline?: string | null;
  heard_from?: string | null;
  heard_from_other?: string | null;
};

const FONT_LIST = ["Inter", "Roboto", "Poppins", "Montserrat", "Lato", "Open Sans", "Source Sans Pro"];

// Onboarding-derived constants
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

// Use your color tokens if available
import colors from "../lib/colors";
const { primary, mutedForeground } = (colors as any) || {};
const primaryColor = typeof primary === "string" ? primary : undefined;
const mutedFg = typeof mutedForeground === "string" ? mutedForeground : undefined;

export default function SettingsPage(): JSX.Element {
  const router = useRouter();
  const recaptchaContainerRef = useRef<HTMLDivElement | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // keep only two sections: profile & business
  const [tab, setTab] = useState<"profile" | "business">("profile");

  // profile state (editable)
  const [profile, setProfile] = useState<ProfilePayload | null>(null);

  // Removed mobile inputs from UI; keep flags for compatibility
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [businessVerified, setBusinessVerified] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  // Onboarding-like fields local copies for business tab
  const [businessName, setBusinessName] = useState("");
  const [location, setLocation] = useState("");
  const [tagline, setTagline] = useState("");
  const [businessType, setBusinessType] = useState<string | null>(BUSINESS_TYPES[0]);
  const [businessSize, setBusinessSize] = useState<string | null>(BUSINESS_SIZES[0]);
  const [useCase, setUseCase] = useState<string[]>([]);
  const [heardFrom, setHeardFrom] = useState<string | null>(HEARD_FROM_OPTIONS[0]);
  const [heardFromOther, setHeardFromOther] = useState<string>("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data: { user }, error: userErr } = await supabase.auth.getUser();
        if (userErr || !user) {
          router.push("/auth/signin");
          return;
        }

        const { data, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single();

        if (!error && data) {
          setProfile(data as ProfilePayload);

          // hydrate onboarding fields
          setBusinessName(data.business_name ?? "");
          setLocation(data.location ?? "");
          setTagline(data.tagline ?? "");
          setBusinessType(data.business_type ?? BUSINESS_TYPES[0]);
          setBusinessSize(data.business_size ?? BUSINESS_SIZES[0]);
          if (Array.isArray(data.use_case)) setUseCase(data.use_case);
          setHeardFrom(data.heard_from ?? HEARD_FROM_OPTIONS[0]);
          setHeardFromOther(data.heard_from_other ?? "");

          setPhoneVerified(Boolean((data as any).phone_verified));
          setBusinessVerified(Boolean((data as any).business_mobile_verified));
        } else {
          // fallback profile skeleton
          setProfile({
            id: user.id,
            full_name: user.user_metadata?.full_name || null,
            email: user.email || null,
          });
        }

        // init firebase client in browser (kept)
        if (typeof window !== "undefined") {
          try {
            initFirebaseApp();
          } catch (e) {
            console.warn("Firebase init error", e);
          }
        }
      } catch (e: any) {
        console.error("fetch profile error", e);
        setError(String(e?.message || e));
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- helper: getPublicUrlSafe (kept for compatibility though not used for logo here) ---
  async function getPublicUrlSafe(path: string | null | undefined) {
    if (!path) return null;
    try {
      const res: any = await supabase.storage.from("user-uploads").getPublicUrl(path);
      if (res?.data?.publicUrl) return res.data.publicUrl;
      if (res?.publicURL) return res.publicURL;
      const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
      if (base) {
        return `${base.replace(/\/$/, "")}/storage/v1/object/public/user-uploads/${encodeURIComponent(path)}`;
      }
      return null;
    } catch (e) {
      console.warn("getPublicUrlSafe error", e);
      return null;
    }
  }

  // Save profile & business fields (no logo/ref uploads because removed)
  async function saveProfileAndAi() {
    if (!profile) return;
    setSaving(true);
    setError(null);
    setInfoMessage(null);

    try {
      // if email changed vs auth, update auth email
      const currentAuth = await supabase.auth.getUser();
      const authEmail = currentAuth?.data?.user?.email || null;
      if (profile.email && profile.email !== authEmail) {
        const res = await supabase.auth.updateUser({ email: profile.email });
        if (res.error) throw res.error;
        setInfoMessage("Auth email updated; verification may be required.");
      }

      // Build payload: prefer local business fields from onboarding section
      const payload: any = {
        id: profile.id,
        full_name: profile.full_name || null,
        email: profile.email || null,
        // keep phone fields untouched since UI removed phone inputs
        phone: profile.phone ?? null,
        phone_verified: profile.phone_verified ?? null,
        business_name: businessName || profile.business_name || null,
        business_mobile: profile.business_mobile ?? null,
        business_mobile_verified: profile.business_mobile_verified ?? null,
        location: location || profile.location || null,
        business_type: businessType || profile.business_type || null,
        business_size: businessSize || profile.business_size || null,
        use_case: (useCase && useCase.length) ? useCase : (Array.isArray(profile.use_case) ? profile.use_case : null),
        color_primary: profile.color_primary || "#0ea5e9",
        color_secondary: profile.color_secondary || "#0b74ff",
        font: profile.font || FONT_LIST[0],
        // preserve existing logo_path / ref_images values (do not modify)
        logo_path: profile.logo_path ?? null,
        ref_images: Array.isArray(profile.ref_images) && profile.ref_images.length ? profile.ref_images : null,
        tagline: tagline || profile.tagline || null,
        heard_from: heardFrom || profile.heard_from || null,
        heard_from_other: heardFrom === "Other" ? (heardFromOther || profile.heard_from_other || null) : profile.heard_from_other || null,
      };

      const { error: upErr } = await supabase.from("profiles").upsert(payload, { onConflict: "id" });
      if (upErr) throw upErr;

      // refresh local profile
      const { data: refreshed, error: refErr } = await supabase.from("profiles").select("*").eq("id", profile.id).single();
      if (!refErr && refreshed) {
        setProfile(refreshed as ProfilePayload);
      }

      setInfoMessage("Saved to Supabase.");
    } catch (err: any) {
      console.error("saveProfileAndAi error", err);
      setError(err?.message || String(err));
    } finally {
      setSaving(false);
    }
  }

  // Keep firebase recaptcha container in DOM (behavior preserved)
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        initFirebaseApp();
      } catch (e) {
        // ignore
      }
    }
  }, []);

  if (loading) return <div className="p-8">Loading profile…</div>;

  return (
    <div className="min-h-screen flex bg-slate-50">
      <Sidebar />

      <main className="flex-1 p-8">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-slate-800 mb-6">Settings</h2>

          {/* Tabs — simplified to two: Profile & Business */}
          <Tabs defaultValue={tab} onValueChange={(v) => setTab(v as "profile" | "business")}>
            <TabsList className="flex gap-4 mb-6 bg-transparent p-1 rounded-lg">
              <TabsTrigger value="profile" className={`px-4 py-2 ${tab === "profile" ? "bg-white shadow-xl rounded-lg" : "text-slate-600"}`}>
                Profile
              </TabsTrigger>
              <TabsTrigger value="business" className={`px-4 py-2 ${tab === "business" ? "bg-white shadow-xl rounded-lg" : "text-slate-600"}`}>
                Business
              </TabsTrigger>
            </TabsList>

            <div style={{ boxShadow: "0 40px 80px rgba(2,6,23,0.12)" }}>
              <TabsContent value="profile" className="p-6 bg-white rounded-xl">
                <Card className="!shadow-none border-0">
                  <CardHeader>
                    <CardTitle>Personal</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <form className="space-y-4" onSubmit={async (e) => { e.preventDefault(); await saveProfileAndAi(); }}>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="full_name">Full name</Label>
                          <Input
                            id="full_name"
                            value={profile?.full_name ?? ""}
                            onChange={(e) => setProfile({ ...(profile as ProfilePayload), full_name: e.target.value })}
                            className="mt-1"
                          />
                        </div>

                        <div>
                          <Label htmlFor="email">Email</Label>
                          <div className="flex items-center gap-2">
                            <Input
                              id="email"
                              type="email"
                              value={profile?.email ?? ""}
                              onChange={(e) => setProfile({ ...(profile as ProfilePayload), email: e.target.value })}
                              className="mt-1"
                            />
                            {profile?.email ? <div className="text-sm text-slate-600">✉️</div> : null}
                          </div>
                          <div className="text-xs text-slate-500 mt-1">Updating email updates your Supabase auth email (verification may be required).</div>
                        </div>

                        <div>
                          <div className="mt-4">
                            <Button onClick={saveProfileAndAi} disabled={saving}>
                              {saving ? "Saving…" : "Save changes"}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="business" className="p-6 bg-white rounded-xl">
                <Card className="!shadow-none border-0">
                  <CardHeader>
                    <CardTitle>Business</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <form className="space-y-6" onSubmit={async (e) => { e.preventDefault(); await saveProfileAndAi(); }}>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="business_name">Business Name</Label>
                          <Input
                            id="business_name"
                            value={businessName}
                            onChange={(e) => setBusinessName(e.target.value)}
                            className="mt-1"
                          />
                        </div>

                        <div>
                          <Label htmlFor="location">Location</Label>
                          <Input
                            id="location"
                            value={location}
                            onChange={(e) => setLocation(e.target.value)}
                            className="mt-1"
                          />
                        </div>

                        <div className="md:col-span-2">
                          <Label htmlFor="tagline">Tagline</Label>
                          <Input
                            id="tagline"
                            value={tagline}
                            onChange={(e) => setTagline(e.target.value)}
                            className="mt-1"
                          />
                        </div>

                        <div>
                          <Label>Business type</Label>
                          <div className="mt-2 grid grid-cols-1 gap-2">
                            <select value={businessType ?? ""} onChange={(e) => setBusinessType(e.target.value)} className="p-2 border rounded w-full">
                              {BUSINESS_TYPES.map((b) => <option key={b} value={b}>{b}</option>)}
                            </select>
                          </div>
                        </div>

                        <div>
                          <Label>Business size</Label>
                          <div className="mt-2">
                            <select value={businessSize ?? ""} onChange={(e) => setBusinessSize(e.target.value)} className="p-2 border rounded w-full">
                              {BUSINESS_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
                            </select>
                          </div>
                        </div>

                        <div className="md:col-span-2">
                          <Label>Core use cases</Label>
                          <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {USE_CASE_OPTIONS.map((opt) => (
                              <button
                                key={opt}
                                type="button"
                                onClick={() =>
                                  setUseCase((prev) =>
                                    prev.includes(opt) ? prev.filter((p) => p !== opt) : [...prev, opt]
                                  )
                                }
                                className={`text-left p-3 rounded ${useCase.includes(opt) ? "border-2 border-black bg-slate-50" : "border border-slate-200"}`}
                              >
                                {opt}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <Label>How did you hear about us?</Label>
                          <div className="mt-2">
                            <select value={heardFrom ?? ""} onChange={(e) => setHeardFrom(e.target.value)} className="p-2 border rounded w-full">
                              {HEARD_FROM_OPTIONS.map((h) => <option key={h} value={h}>{h}</option>)}
                            </select>
                          </div>
                        </div>

                        {heardFrom === "Other" && (
                          <div>
                            <Label>Heard from (other)</Label>
                            <Input value={heardFromOther} onChange={(e) => setHeardFromOther(e.target.value)} className="mt-1" />
                          </div>
                        )}
                      </div>

                      <div className="pt-4 flex items-center gap-3">
                        <Button onClick={saveProfileAndAi} disabled={saving}>
                          {saving ? "Saving…" : "Save business"}
                        </Button>

                        <Button onClick={() => router.push("/integrationsnew")} variant="ghost">
                          Continue to Integrations
                        </Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              </TabsContent>
            </div>
          </Tabs>

          {/* recaptcha container (invisible) - preserved for behavior parity */}
          <div className="sr-only">
            <div ref={recaptchaContainerRef} id="recaptcha-container" />
          </div>

          {infoMessage && <div className="mt-4 text-sm text-green-600">{infoMessage}</div>}
          {error && <div className="mt-4 text-sm text-red-600">{error}</div>}
        </div>
      </main>
    </div>
  );
}
