// pages/settings.tsx
"use client";

import React, { useEffect, useRef, useState } from "react";
import Sidebar from "../app/web/src/components/Sidebar";
import { supabase } from "../lib/supabaseClient";
import { initFirebaseApp, getFirebaseAuth } from "../lib/firebaseClient";
import type { ConfirmationResult } from "firebase/auth";
import { useRouter } from "next/router";

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
  heard_from?: string | null;
  heard_from_other?: string | null;
};

const FONT_LIST = ["Inter", "Roboto", "Poppins", "Montserrat", "Lato", "Open Sans", "Source Sans Pro"];

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

  // phone verification states (personal)
  const [phoneInput, setPhoneInput] = useState("");
  const [phoneConfirmResult, setPhoneConfirmResult] = useState<ConfirmationResult | null>(null);
  const [phoneCode, setPhoneCode] = useState("");
  const [sendingPhone, setSendingPhone] = useState(false);
  const [verifyingPhone, setVerifyingPhone] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false);

  // business phone verification
  const [businessPhoneInput, setBusinessPhoneInput] = useState("");
  const [businessConfirmResult, setBusinessConfirmResult] = useState<ConfirmationResult | null>(null);
  const [businessCode, setBusinessCode] = useState("");
  const [sendingBusiness, setSendingBusiness] = useState(false);
  const [verifyingBusiness, setVerifyingBusiness] = useState(false);
  const [businessVerified, setBusinessVerified] = useState(false);

  // AI customization local file states (we keep these for logo preview/upload)
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [refFiles, setRefFiles] = useState<File[]>([]);
  const [refPreviews, setRefPreviews] = useState<string[]>([]);
  const [existingLogoUrl, setExistingLogoUrl] = useState<string | null>(null);
  const [existingRefUrls, setExistingRefUrls] = useState<string[]>([]);

  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

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
          setPhoneInput((data as any).phone ?? "");
          setPhoneVerified(Boolean((data as any).phone_verified));
          setBusinessPhoneInput((data as any).business_mobile ?? "");
          setBusinessVerified(Boolean((data as any).business_mobile_verified));

          if ((data as any).logo_path) {
            const url = await getPublicUrlSafe((data as any).logo_path);
            setExistingLogoUrl(url);
            setLogoPreview(url);
          }
          if (Array.isArray((data as any).ref_images) && (data as any).ref_images.length) {
            const urls = await Promise.all((data as any).ref_images.map((p: string) => getPublicUrlSafe(p)));
            setExistingRefUrls(urls.filter(Boolean) as string[]);
            setRefPreviews(urls.filter(Boolean) as string[]);
          }
        } else {
          setProfile({
            id: user.id,
            full_name: user.user_metadata?.full_name || null,
            email: user.email || null,
          });
        }

        // init firebase client in browser
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

  // --- utils for Supabase storage public url (handle different SDK shapes) ---
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

  // --- preview handling for file inputs ---
  useEffect(() => {
    if (logoFile) {
      const url = URL.createObjectURL(logoFile);
      setLogoPreview(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [logoFile]);

  useEffect(() => {
    if (refFiles.length > 0) {
      const urls = refFiles.map((f) => URL.createObjectURL(f));
      setRefPreviews(urls);
      return () => urls.forEach((u) => URL.revokeObjectURL(u));
    }
  }, [refFiles]);

  // --- helper to upload a file to supabase storage ---
  async function uploadFile(file: File, path: string) {
    const { error } = await supabase.storage.from("user-uploads").upload(path, file, { cacheControl: "3600", upsert: true });
    if (error) throw error;
    return path;
  }

  // --- Recaptcha helper for firebase ---
  async function createRecaptchaVerifier() {
    if (typeof window === "undefined") throw new Error("client-only");
    if (!recaptchaContainerRef.current) throw new Error("recaptcha container not mounted");

    const auth = getFirebaseAuth();
    (auth as any).settings = (auth as any).settings ?? {};

    if (process.env.NEXT_PUBLIC_FIREBASE_DISABLE_APP_VERIFICATION_FOR_TESTING === "true") {
      try {
        (auth as any).settings.appVerificationDisabledForTesting = true;
      } catch (e) {
        console.warn("Could not set appVerificationDisabledForTesting", e);
      }
    }

    const win = window as any;
    if (win.__recaptchaVerifier) return win.__recaptchaVerifier;

    const mod = await import("firebase/auth");
    const RecaptchaVerifier = (mod as any).RecaptchaVerifier;
    if (!RecaptchaVerifier) throw new Error("RecaptchaVerifier not available in firebase/auth");

    let verifier: any;
    try {
      verifier = new RecaptchaVerifier(recaptchaContainerRef.current, { size: "invisible" }, auth);
    } catch (e) {
      verifier = new RecaptchaVerifier(auth, recaptchaContainerRef.current, { size: "invisible" });
    }

    if (typeof verifier.render === "function") {
      try {
        await (verifier as any).render();
      } catch (_) {}
    }
    win.__recaptchaVerifier = verifier;
    return verifier;
  }

  // --- send SMS for personal/business ---
  const sendPhoneSms = async (target: "personal" | "business") => {
    setError(null);
    const phoneToUse = target === "personal" ? phoneInput : businessPhoneInput;
    if (!phoneToUse || !phoneToUse.startsWith("+")) {
      setError("Phone must be in E.164 format, e.g. +9198...");
      return;
    }
    try {
      if (target === "personal") setSendingPhone(true);
      else setSendingBusiness(true);

      const verifier = await createRecaptchaVerifier();
      if (!verifier) throw new Error("Recaptcha creation failed");

      const mod = await import("firebase/auth");
      const { signInWithPhoneNumber } = mod as any;
      if (!signInWithPhoneNumber) throw new Error("signInWithPhoneNumber not found");

      const auth = getFirebaseAuth();
      const confirmation = await signInWithPhoneNumber(auth, phoneToUse, verifier);

      if (target === "personal") {
        setPhoneConfirmResult(confirmation);
        setInfoMessage("SMS sent to personal number. Enter the code to verify.");
      } else {
        setBusinessConfirmResult(confirmation);
        setInfoMessage("SMS sent to business number. Enter the code to verify.");
      }
    } catch (err: any) {
      console.error("sendPhoneSms error", err);
      setError(err?.message || String(err));
      try {
        const win = window as any;
        if (win.__recaptchaVerifier && typeof win.__recaptchaVerifier.clear === "function") {
          win.__recaptchaVerifier.clear();
          win.__recaptchaVerifier = null;
        }
      } catch (_) {}
    } finally {
      if (target === "personal") setSendingPhone(false);
      else setSendingBusiness(false);
    }
  };

  // confirm code handler
  const confirmPhoneCode = async (target: "personal" | "business") => {
    setError(null);
    const confirmation = target === "personal" ? phoneConfirmResult : businessConfirmResult;
    const code = target === "personal" ? phoneCode.trim() : businessCode.trim();
    if (!confirmation) {
      setError("Send SMS first");
      return;
    }
    if (!code) {
      setError("Please enter the code");
      return;
    }

    try {
      if (target === "personal") setVerifyingPhone(true);
      else setVerifyingBusiness(true);

      const userCred = await confirmation.confirm(code);
      const idToken = await userCred.user.getIdToken();

      const session = await supabase.auth.getSession();
      const accessToken = session.data?.session?.access_token;

      const resp = await fetch("/api/verify-firebase-phone", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ idToken, target: target === "personal" ? "phone" : "business" }),
      });
      const j = await resp.json();
      if (!resp.ok) throw new Error(j?.error || "Server verification failed");

      const { data, error: pErr } = await supabase.from("profiles").select("*").eq("id", profile?.id).single();
      if (!pErr && data) {
        setProfile(data as ProfilePayload);
        setPhoneVerified(Boolean((data as any).phone_verified));
        setBusinessVerified(Boolean((data as any).business_mobile_verified));
        setInfoMessage("Phone verified and saved.");
        // refresh previews
        if ((data as any).logo_path) {
          const url = await getPublicUrlSafe((data as any).logo_path);
          setExistingLogoUrl(url);
          if (!logoPreview) setLogoPreview(url);
        }
        if (Array.isArray((data as any).ref_images)) {
          const urls = await Promise.all((data as any).ref_images.map((p: string) => getPublicUrlSafe(p)));
          setExistingRefUrls(urls.filter(Boolean) as string[]);
          if (!refPreviews.length) setRefPreviews(urls.filter(Boolean) as string[]);
        }
      } else {
        if (target === "personal") setPhoneVerified(true);
        else setBusinessVerified(true);
        setInfoMessage("Phone verified locally — refresh to confirm server state.");
      }

      if (target === "personal") {
        setPhoneCode("");
        setPhoneConfirmResult(null);
      } else {
        setBusinessCode("");
        setBusinessConfirmResult(null);
      }
    } catch (err: any) {
      console.error("confirmPhoneCode error", err);
      setError(err?.message || String(err));
    } finally {
      if (target === "personal") setVerifyingPhone(false);
      else setVerifyingBusiness(false);
      try {
        const win = window as any;
        if (win.__recaptchaVerifier && typeof win.__recaptchaVerifier.clear === "function") {
          win.__recaptchaVerifier.clear();
          win.__recaptchaVerifier = null;
        }
      } catch (_) {}
    }
  };

  // Save profile & business fields (also used by AI tab previously)
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

      // Upload logo and ref files first (if any)
      const uploadedRefPaths: string[] = [];
      let logo_path: string | null = profile.logo_path || null;

      if (logoFile) {
        const safeName = `${Date.now()}_${logoFile.name.replace(/\s+/g, "_")}`;
        const path = `${profile.id}/logos/${safeName}`;
        await uploadFile(logoFile, path);
        logo_path = path;
      }

      if (refFiles.length > 0) {
        for (const f of refFiles) {
          const safeName = `${Date.now()}_${f.name.replace(/\s+/g, "_")}`;
          const path = `${profile.id}/refs/${safeName}`;
          await uploadFile(f, path);
          uploadedRefPaths.push(path);
        }
      }

      // Build payload: prefer existing values from profile state
      const payload: any = {
        id: profile.id,
        full_name: profile.full_name || null,
        email: profile.email || null,
        phone: profile.phone || phoneInput || null,
        phone_verified: profile.phone_verified ?? null,
        business_name: profile.business_name || null,
        business_mobile: profile.business_mobile || businessPhoneInput || null,
        business_mobile_verified: profile.business_mobile_verified ?? null,
        location: profile.location || null,
        business_type: profile.business_type || null,
        business_size: profile.business_size || null,
        use_case: profile.use_case && profile.use_case.length ? profile.use_case : null,
        color_primary: profile.color_primary || "#0ea5e9",
        color_secondary: profile.color_secondary || "#0b74ff",
        font: profile.font || FONT_LIST[0],
        logo_path: logo_path || null,
        ref_images:
          (Array.isArray(profile.ref_images) ? profile.ref_images : []).concat(uploadedRefPaths).length
            ? (Array.isArray(profile.ref_images) ? profile.ref_images : []).concat(uploadedRefPaths)
            : null,
        heard_from: profile.heard_from || null,
        heard_from_other: profile.heard_from_other || null,
      };

      const { error: upErr } = await supabase.from("profiles").upsert(payload, { onConflict: "id" });
      if (upErr) throw upErr;

      // refresh local profile and public urls
      const { data: refreshed, error: refErr } = await supabase.from("profiles").select("*").eq("id", profile.id).single();
      if (!refErr && refreshed) {
        setProfile(refreshed as ProfilePayload);
        if ((refreshed as any).logo_path) {
          const url = await getPublicUrlSafe((refreshed as any).logo_path);
          setExistingLogoUrl(url);
          setLogoPreview(url);
        }
        if (Array.isArray((refreshed as any).ref_images)) {
          const urls = await Promise.all((refreshed as any).ref_images.map((p: string) => getPublicUrlSafe(p)));
          setExistingRefUrls(urls.filter(Boolean) as string[]);
          setRefPreviews(urls.filter(Boolean) as string[]);
        }
      }

      setInfoMessage("Saved to Supabase.");
    } catch (err: any) {
      console.error("saveProfileAndAi error", err);
      setError(err?.message || String(err));
    } finally {
      setSaving(false);
    }
  }

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
                          <Label htmlFor="phone">Phone (personal)</Label>
                          <div className="flex items-center gap-2">
                            <Input
                              id="phone"
                              placeholder="+919XXXXXXXXX"
                              value={phoneInput}
                              onChange={(e) => setPhoneInput(e.target.value)}
                              className="mt-1"
                            />
                            <div>{phoneVerified ? <span title="Verified">✅</span> : <span title="Not verified">⚠️</span>}</div>
                          </div>

                          <div className="flex items-center gap-2 mt-2">
                            <Button onClick={() => sendPhoneSms("personal")} disabled={sendingPhone} variant="ghost">
                              {sendingPhone ? "Sending…" : "Send SMS"}
                            </Button>

                            {phoneConfirmResult && (
                              <>
                                <Input value={phoneCode} onChange={(e) => setPhoneCode(e.target.value)} placeholder="Enter code" />
                                <Button onClick={() => confirmPhoneCode("personal")} disabled={verifyingPhone}>
                                  {verifyingPhone ? "Verifying…" : "Verify"}
                                </Button>
                              </>
                            )}
                          </div>
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
                    <form className="space-y-4" onSubmit={async (e) => { e.preventDefault(); await saveProfileAndAi(); }}>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="business_name">Business Name</Label>
                          <Input
                            id="business_name"
                            value={profile?.business_name ?? ""}
                            onChange={(e) => setProfile({ ...(profile as ProfilePayload), business_name: e.target.value })}
                            className="mt-1"
                          />
                        </div>

                        <div>
                          <Label htmlFor="business_mobile">Business Mobile</Label>
                          <div className="flex items-center gap-2">
                            <Input
                              id="business_mobile"
                              placeholder="+919XXXXXXXXX"
                              value={businessPhoneInput}
                              onChange={(e) => setBusinessPhoneInput(e.target.value)}
                              className="mt-1"
                            />
                            <div>{businessVerified ? <span title="Verified">✅</span> : <span title="Not verified">⚠️</span>}</div>
                          </div>

                          <div className="flex items-center gap-2 mt-2">
                            <Button onClick={() => sendPhoneSms("business")} disabled={sendingBusiness} variant="ghost">
                              {sendingBusiness ? "Sending…" : "Send SMS"}
                            </Button>

                            {businessConfirmResult && (
                              <>
                                <Input value={businessCode} onChange={(e) => setBusinessCode(e.target.value)} placeholder="Enter code" />
                                <Button onClick={() => confirmPhoneCode("business")} disabled={verifyingBusiness}>
                                  {verifyingBusiness ? "Verifying…" : "Verify"}
                                </Button>
                              </>
                            )}
                          </div>
                        </div>

                        <div>
                          <Label htmlFor="location">Location</Label>
                          <Input
                            id="location"
                            value={profile?.location ?? ""}
                            onChange={(e) => setProfile({ ...(profile as ProfilePayload), location: e.target.value })}
                            className="mt-1"
                          />
                        </div>

                        <div>
                          <Label htmlFor="business_type">Business type</Label>
                          <Input
                            id="business_type"
                            value={profile?.business_type ?? ""}
                            onChange={(e) => setProfile({ ...(profile as ProfilePayload), business_type: e.target.value })}
                            className="mt-1"
                          />
                        </div>
                      </div>

                      <div className="pt-4">
                        <Button onClick={saveProfileAndAi} disabled={saving}>
                          {saving ? "Saving…" : "Save business"}
                        </Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              </TabsContent>
            </div>
          </Tabs>

          {/* recaptcha container (invisible) */}
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
