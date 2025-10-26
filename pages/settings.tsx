// pages/settings.tsx
import React, { useEffect, useRef, useState } from 'react';
import Sidebar from "../app/web/src/components/Sidebar";
import { supabase } from "../lib/supabaseClient";
import { initFirebaseApp, getFirebaseAuth } from '../lib/firebaseClient';
import type { ConfirmationResult } from 'firebase/auth';
import { useRouter } from 'next/router';

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

const FONT_LIST = ['Inter','Roboto','Poppins','Montserrat','Lato','Open Sans','Source Sans Pro'];

export default function SettingsPage() {
  const router = useRouter();
  const recaptchaContainerRef = useRef<HTMLDivElement | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<'profile'|'business'|'security'|'ai'>('profile');

  // profile state (editable)
  const [profile, setProfile] = useState<ProfilePayload | null>(null);

  // phone verification states (personal)
  const [phoneInput, setPhoneInput] = useState('');
  const [phoneConfirmResult, setPhoneConfirmResult] = useState<ConfirmationResult | null>(null);
  const [phoneCode, setPhoneCode] = useState('');
  const [sendingPhone, setSendingPhone] = useState(false);
  const [verifyingPhone, setVerifyingPhone] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false);

  // business phone verification
  const [businessPhoneInput, setBusinessPhoneInput] = useState('');
  const [businessConfirmResult, setBusinessConfirmResult] = useState<ConfirmationResult | null>(null);
  const [businessCode, setBusinessCode] = useState('');
  const [sendingBusiness, setSendingBusiness] = useState(false);
  const [verifyingBusiness, setVerifyingBusiness] = useState(false);
  const [businessVerified, setBusinessVerified] = useState(false);

  // AI customization local file states
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
          router.push('/auth/signin');
          return;
        }

        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (!error && data) {
          setProfile(data as ProfilePayload);
          setPhoneInput(data.phone || '');
          setPhoneVerified(Boolean(data.phone_verified));
          setBusinessPhoneInput(data.business_mobile || '');
          setBusinessVerified(Boolean(data.business_mobile_verified));
          // Load public URLs for stored logo + refs if present
          if (data.logo_path) {
            const url = await getPublicUrlSafe(data.logo_path);
            setExistingLogoUrl(url);
            setLogoPreview(url);
          }
          if (Array.isArray(data.ref_images) && data.ref_images.length) {
            const urls = await Promise.all(data.ref_images.map((p: string) => getPublicUrlSafe(p)));
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
        if (typeof window !== 'undefined') {
          try {
            initFirebaseApp();
          } catch (e) {
            console.warn('Firebase init error', e);
          }
        }
      } catch (e: any) {
        console.error('fetch profile error', e);
        setError(String(e?.message || e));
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  // --- utils for Supabase storage public url (handle different SDK shapes) ---
  async function getPublicUrlSafe(path: string | null | undefined) {
    if (!path) return null;
    try {
      // v2 returns { data: { publicUrl } } or { data: { publicUrl: '...' } }, v1 had publicURL
      const res: any = await supabase.storage.from('user-uploads').getPublicUrl(path);
      // try common shapes:
      if (res?.data?.publicUrl) return res.data.publicUrl;
      if (res?.publicURL) return res.publicURL;
      if (res?.data?.publicUrl) return res.data.publicUrl;
      // fallback: construct from supabase url if available
      const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
      if (base) {
        return `${base.replace(/\/$/, '')}/storage/v1/object/public/user-uploads/${encodeURIComponent(path)}`;
      }
      return null;
    } catch (e) {
      console.warn('getPublicUrlSafe error', e);
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
      const urls = refFiles.map(f => URL.createObjectURL(f));
      setRefPreviews(urls);
      return () => urls.forEach(u => URL.revokeObjectURL(u));
    }
  }, [refFiles]);

  // --- helper to upload a file to supabase storage ---
  async function uploadFile(file: File, path: string) {
    const { error } = await supabase.storage.from('user-uploads').upload(path, file, { cacheControl: '3600', upsert: true });
    if (error) throw error;
    return path;
  }

  // --- Recaptcha helper for firebase ---
  async function createRecaptchaVerifier() {
    if (typeof window === 'undefined') throw new Error('client-only');
    if (!recaptchaContainerRef.current) throw new Error('recaptcha container not mounted');

    const auth = getFirebaseAuth();
    (auth as any).settings = (auth as any).settings ?? {};

    if (process.env.NEXT_PUBLIC_FIREBASE_DISABLE_APP_VERIFICATION_FOR_TESTING === 'true') {
      try {
        (auth as any).settings.appVerificationDisabledForTesting = true;
      } catch (e) {
        console.warn('Could not set appVerificationDisabledForTesting', e);
      }
    }

    const win = window as any;
    if (win.__recaptchaVerifier) return win.__recaptchaVerifier;

    const mod = await import('firebase/auth');
    const RecaptchaVerifier = (mod as any).RecaptchaVerifier;
    if (!RecaptchaVerifier) throw new Error('RecaptchaVerifier not available in firebase/auth');

    // try both constructor signatures
    let verifier: any;
    try {
      verifier = new RecaptchaVerifier(recaptchaContainerRef.current, { size: 'invisible' }, auth);
    } catch (e) {
      verifier = new RecaptchaVerifier(auth, recaptchaContainerRef.current, { size: 'invisible' });
    }

    if (typeof verifier.render === 'function') {
      try { await (verifier as any).render(); } catch (_) {}
    }
    win.__recaptchaVerifier = verifier;
    return verifier;
  }

  // --- send SMS for personal/business ---
  const sendPhoneSms = async (target: 'personal'|'business') => {
    setError(null);
    const phoneToUse = target === 'personal' ? phoneInput : businessPhoneInput;
    if (!phoneToUse || !phoneToUse.startsWith('+')) {
      setError('Phone must be in E.164 format, e.g. +9198...');
      return;
    }
    try {
      if (target === 'personal') setSendingPhone(true); else setSendingBusiness(true);
      const verifier = await createRecaptchaVerifier();
      if (!verifier) throw new Error('Recaptcha creation failed');

      const mod = await import('firebase/auth');
      const { signInWithPhoneNumber } = mod as any;
      if (!signInWithPhoneNumber) throw new Error('signInWithPhoneNumber not found');

      const auth = getFirebaseAuth();
      const confirmation = await signInWithPhoneNumber(auth, phoneToUse, verifier);

      if (target === 'personal') {
        setPhoneConfirmResult(confirmation);
        setInfoMessage('SMS sent to personal number. Enter the code to verify.');
      } else {
        setBusinessConfirmResult(confirmation);
        setInfoMessage('SMS sent to business number. Enter the code to verify.');
      }
    } catch (err: any) {
      console.error('sendPhoneSms error', err);
      setError(err?.message || String(err));
      try {
        const win = window as any;
        if (win.__recaptchaVerifier && typeof win.__recaptchaVerifier.clear === 'function') {
          win.__recaptchaVerifier.clear();
          win.__recaptchaVerifier = null;
        }
      } catch (_) {}
    } finally {
      if (target === 'personal') setSendingPhone(false); else setSendingBusiness(false);
    }
  };

  // confirm code handler
  const confirmPhoneCode = async (target: 'personal'|'business') => {
    setError(null);
    const confirmation = target === 'personal' ? phoneConfirmResult : businessConfirmResult;
    const code = target === 'personal' ? phoneCode.trim() : businessCode.trim();
    if (!confirmation) { setError('Send SMS first'); return; }
    if (!code) { setError('Please enter the code'); return; }

    try {
      if (target === 'personal') setVerifyingPhone(true); else setVerifyingBusiness(true);
      const userCred = await confirmation.confirm(code);
      const idToken = await userCred.user.getIdToken();

      const session = await supabase.auth.getSession();
      const accessToken = session.data?.session?.access_token;

      const resp = await fetch('/api/verify-firebase-phone', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify({ idToken, target: (target === 'personal' ? 'phone' : 'business') })
      });
      const j = await resp.json();
      if (!resp.ok) throw new Error(j?.error || 'Server verification failed');

      const { data, error: pErr } = await supabase.from('profiles').select('*').eq('id', profile?.id).single();
      if (!pErr && data) {
        setProfile(data as ProfilePayload);
        setPhoneVerified(Boolean((data as any).phone_verified));
        setBusinessVerified(Boolean((data as any).business_mobile_verified));
        setInfoMessage('Phone verified and saved.');
        // update previews if server returned new paths
        if (data.logo_path) {
          const url = await getPublicUrlSafe(data.logo_path);
          setExistingLogoUrl(url);
          if (!logoPreview) setLogoPreview(url);
        }
        if (Array.isArray(data.ref_images)) {
          const urls = await Promise.all(data.ref_images.map((p: string) => getPublicUrlSafe(p)));
          setExistingRefUrls(urls.filter(Boolean) as string[]);
          if (!refPreviews.length) setRefPreviews(urls.filter(Boolean) as string[]);
        }
      } else {
        if (target === 'personal') setPhoneVerified(true); else setBusinessVerified(true);
        setInfoMessage('Phone verified locally — refresh to confirm server state.');
      }
      if (target === 'personal') {
        setPhoneCode('');
        setPhoneConfirmResult(null);
      } else {
        setBusinessCode('');
        setBusinessConfirmResult(null);
      }
    } catch (err: any) {
      console.error('confirmPhoneCode error', err);
      setError(err?.message || String(err));
    } finally {
      if (target === 'personal') setVerifyingPhone(false); else setVerifyingBusiness(false);
      try {
        const win = window as any;
        if (win.__recaptchaVerifier && typeof win.__recaptchaVerifier.clear === 'function') {
          win.__recaptchaVerifier.clear();
          win.__recaptchaVerifier = null;
        }
      } catch (_) {}
    }
  };

  // Save profile & business fields (also used by AI tab)
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
        setInfoMessage('Auth email updated; verification may be required.');
      }

      // Upload logo and ref files first (if any)
      const uploadedRefPaths: string[] = [];
      let logo_path: string | null = profile.logo_path || null;

      if (logoFile) {
        const safeName = `${Date.now()}_${logoFile.name.replace(/\s+/g,'_')}`;
        const path = `${profile.id}/logos/${safeName}`;
        await uploadFile(logoFile, path);
        logo_path = path;
      }

      if (refFiles.length > 0) {
        for (const f of refFiles) {
          const safeName = `${Date.now()}_${f.name.replace(/\s+/g,'_')}`;
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
        color_primary: profile.color_primary || '#0ea5e9',
        color_secondary: profile.color_secondary || '#0b74ff',
        font: profile.font || FONT_LIST[0],
        logo_path: logo_path || null,
        ref_images: (Array.isArray(profile.ref_images) ? profile.ref_images : []).concat(uploadedRefPaths).length
          ? (Array.isArray(profile.ref_images) ? profile.ref_images : []).concat(uploadedRefPaths)
          : null,
        heard_from: profile.heard_from || null,
        heard_from_other: profile.heard_from_other || null,
      };

      const { error: upErr } = await supabase.from('profiles').upsert(payload, { onConflict: 'id' });
      if (upErr) throw upErr;

      // refresh local profile and public urls
      const { data: refreshed, error: refErr } = await supabase.from('profiles').select('*').eq('id', profile.id).single();
      if (!refErr && refreshed) {
        setProfile(refreshed as ProfilePayload);
        if (refreshed.logo_path) {
          const url = await getPublicUrlSafe(refreshed.logo_path);
          setExistingLogoUrl(url);
          setLogoPreview(url);
        }
        if (Array.isArray(refreshed.ref_images)) {
          const urls = await Promise.all(refreshed.ref_images.map((p: string) => getPublicUrlSafe(p)));
          setExistingRefUrls(urls.filter(Boolean) as string[]);
          setRefPreviews(urls.filter(Boolean) as string[]);
        }
      }

      setInfoMessage('Saved to Supabase.');
    } catch (err: any) {
      console.error('saveProfileAndAi error', err);
      setError(err?.message || String(err));
    } finally {
      setSaving(false);
    }
  }

  // UI loading guard
  if (loading) return <div className="p-8">Loading profile…</div>;

  return (
    <div className="min-h-screen flex bg-slate-50">
      <Sidebar />

      <main className="flex-1 p-8">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-slate-800 mb-6">Settings</h2>

          {/* Tabs */}
          <div className="border-b mb-6">
            <nav className="flex space-x-6 text-sm font-medium">
              <button
                onClick={() => setTab('profile')}
                className={`px-3 py-2 ${tab === 'profile' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-600'}`}
              >Profile</button>
              <button
                onClick={() => setTab('business')}
                className={`px-3 py-2 ${tab === 'business' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-600'}`}
              >Business</button>
              <button
                onClick={() => setTab('security')}
                className={`px-3 py-2 ${tab === 'security' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-600'}`}
              >Security</button>
              <button
                onClick={() => setTab('ai')}
                className={`px-3 py-2 ${tab === 'ai' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-600'}`}
              >AI Customization</button>
            </nav>
          </div>

          <div className="p-6 bg-white rounded-xl border shadow-sm w-full">
            {tab === 'profile' && (
              <form className="space-y-4" onSubmit={async (e) => { e.preventDefault(); await saveProfileAndAi(); }}>
                <h3 className="text-lg font-semibold">Personal</h3>

                <div>
                  <label className="block text-sm font-medium text-slate-700">Full name</label>
                  <input
                    type="text"
                    value={profile?.full_name || ''}
                    onChange={(e) => setProfile({ ...(profile as ProfilePayload), full_name: e.target.value })}
                    className="mt-1 block w-full rounded-lg border px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700">Email</label>
                  <div className="flex gap-2 items-center">
                    <input
                      type="email"
                      value={profile?.email || ''}
                      onChange={(e) => setProfile({ ...(profile as ProfilePayload), email: e.target.value })}
                      className="mt-1 block w-full rounded-lg border px-3 py-2"
                    />
                    <div>
                      {profile?.email ? <span title="Email in auth" className="text-sm text-slate-600">✉️</span> : null}
                    </div>
                  </div>
                  <div className="mt-1 text-xs text-slate-500">Updating email updates your Supabase auth email (verification may be required).</div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700">Phone (personal)</label>
                  <div className="flex gap-2 items-center">
                    <input
                      type="text"
                      placeholder="+919XXXXXXXXX"
                      value={phoneInput}
                      onChange={(e) => setPhoneInput(e.target.value)}
                      className="mt-1 block w-full rounded-lg border px-3 py-2"
                    />
                    <div>{phoneVerified ? <span title="Verified">✅</span> : <span title="Not verified">⚠️</span>}</div>
                  </div>

                  <div className="mt-2 flex gap-2 items-center">
                    <button
                      type="button"
                      disabled={sendingPhone}
                      onClick={() => sendPhoneSms('personal')}
                      className="px-3 py-1 rounded bg-slate-100"
                    >
                      {sendingPhone ? 'Sending…' : 'Send SMS'}
                    </button>

                    {phoneConfirmResult && (
                      <>
                        <input
                          value={phoneCode}
                          onChange={(e) => setPhoneCode(e.target.value)}
                          placeholder="Enter code"
                          className="rounded border px-3 py-1"
                        />
                        <button
                          type="button"
                          disabled={verifyingPhone}
                          onClick={() => confirmPhoneCode('personal')}
                          className="px-3 py-1 rounded bg-green-600 text-white"
                        >
                          {verifyingPhone ? 'Verifying…' : 'Verify'}
                        </button>
                      </>
                    )}
                  </div>

                  <div className="pt-4">
                    <button
                      type="button"
                      onClick={saveProfileAndAi}
                      disabled={saving}
                      className="px-4 py-2 rounded bg-blue-600 text-white"
                    >
                      {saving ? 'Saving…' : 'Save changes'}
                    </button>
                  </div>
                </div>
              </form>
            )}

            {tab === 'business' && (
              <form className="space-y-4" onSubmit={async (e) => { e.preventDefault(); await saveProfileAndAi(); }}>
                <h3 className="text-lg font-semibold">Business</h3>

                <div>
                  <label className="block text-sm font-medium text-slate-700">Business Name</label>
                  <input
                    type="text"
                    value={profile?.business_name || ''}
                    onChange={(e) => setProfile({ ...(profile as ProfilePayload), business_name: e.target.value })}
                    className="mt-1 block w-full rounded-lg border px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700">Business Mobile</label>
                  <div className="flex gap-2 items-center">
                    <input
                      type="text"
                      placeholder="+919XXXXXXXXX"
                      value={businessPhoneInput}
                      onChange={(e) => setBusinessPhoneInput(e.target.value)}
                      className="mt-1 block w-full rounded-lg border px-3 py-2"
                    />
                    <div>{businessVerified ? <span title="Verified">✅</span> : <span title="Not verified">⚠️</span>}</div>
                  </div>

                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      disabled={sendingBusiness}
                      onClick={() => sendPhoneSms('business')}
                      className="px-3 py-1 rounded bg-slate-100"
                    >
                      {sendingBusiness ? 'Sending…' : 'Send SMS'}
                    </button>

                    {businessConfirmResult && (
                      <>
                        <input
                          value={businessCode}
                          onChange={(e) => setBusinessCode(e.target.value)}
                          placeholder="Enter code"
                          className="rounded border px-3 py-1"
                        />
                        <button
                          type="button"
                          disabled={verifyingBusiness}
                          onClick={() => confirmPhoneCode('business')}
                          className="px-3 py-1 rounded bg-green-600 text-white"
                        >
                          {verifyingBusiness ? 'Verifying…' : 'Verify'}
                        </button>
                      </>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700">Location</label>
                  <input
                    type="text"
                    value={profile?.location || ''}
                    onChange={(e) => setProfile({ ...(profile as ProfilePayload), location: e.target.value })}
                    className="mt-1 block w-full rounded-lg border px-3 py-2"
                  />
                </div>

                <div className="pt-4">
                  <button
                    type="button"
                    onClick={saveProfileAndAi}
                    disabled={saving}
                    className="px-4 py-2 rounded bg-blue-600 text-white"
                  >
                    {saving ? 'Saving…' : 'Save business'}
                  </button>
                </div>
              </form>
            )}

            {tab === 'security' && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Security & Verification</h3>

                <div>
                  <label className="block text-sm font-medium text-slate-700">Email verification</label>
                  <p className="text-sm text-slate-600 mt-1">Change email in the Profile tab and Supabase will send verification if required.</p>
                  <div className="mt-2">
                    <button
                      type="button"
                      onClick={async () => {
                        if (!profile?.email) { setError('No email to verify'); return; }
                        setError(null);
                        setInfoMessage('Requesting email verification from Supabase…');
                        const res = await supabase.auth.updateUser({ email: profile.email });
                        if (res.error) {
                          setError(res.error.message || String(res.error));
                          setInfoMessage(null);
                        } else {
                          setInfoMessage('Verification request sent (check your inbox).');
                        }
                      }}
                      className="px-3 py-1 rounded bg-slate-100"
                    >
                      Send verification email
                    </button>
                  </div>
                </div>

                <div className="pt-4">
                  <label className="block text-sm font-medium text-slate-700">Social / Google verification (optional)</label>
                  <p className="text-sm text-slate-600 mt-1">Signing in via Google can be used as an identity verification step.</p>
                  <div className="mt-2">
                    <button
                      type="button"
                      onClick={async () => {
                        setError(null);
                        setInfoMessage('Opening Google sign-in…');
                        await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.href } });
                      }}
                      className="px-3 py-1 rounded bg-slate-100"
                    >
                      Verify with Google
                    </button>
                  </div>
                </div>
              </div>
            )}

            {tab === 'ai' && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">AI Customization</h3>

                <div>
                  <label className="block text-sm font-medium text-slate-700">Primary color</label>
                  <input
                    type="color"
                    value={profile?.color_primary || '#0ea5e9'}
                    onChange={(e) => setProfile({ ...(profile as ProfilePayload), color_primary: e.target.value })}
                    className="mt-1 h-10 w-20 p-0 border rounded"
                  />
                  <div className="mt-2 text-sm text-slate-600">Selected: <span className="font-medium">{profile?.color_primary || '#0ea5e9'}</span></div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700">Secondary color</label>
                  <input
                    type="color"
                    value={profile?.color_secondary || '#0b74ff'}
                    onChange={(e) => setProfile({ ...(profile as ProfilePayload), color_secondary: e.target.value })}
                    className="mt-1 h-10 w-20 p-0 border rounded"
                  />
                  <div className="mt-2 text-sm text-slate-600">Selected: <span className="font-medium">{profile?.color_secondary || '#0b74ff'}</span></div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700">Font</label>
                  <select
                    value={profile?.font || FONT_LIST[0]}
                    onChange={(e) => setProfile({ ...(profile as ProfilePayload), font: e.target.value })}
                    className="mt-1 w-full rounded border px-3 py-2"
                  >
                    {FONT_LIST.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                  <div className="mt-1 text-xs text-slate-500">We store the font name; map to actual fonts in the renderer.</div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700">Company Logo (upload)</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setLogoFile(e.target.files ? e.target.files[0] : null)}
                    className="mt-2"
                  />
                  <div className="mt-2 flex items-center gap-4">
                    {logoPreview && <img src={logoPreview} alt="logo-preview" className="h-24 object-contain rounded" />}
                    {!logoPreview && existingLogoUrl && <img src={existingLogoUrl} alt="logo-existing" className="h-24 object-contain rounded" />}
                    {!logoPreview && !existingLogoUrl && <div className="text-sm text-slate-500">No logo uploaded</div>}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700">Reference images (multiple)</label>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => {
                      const files = e.target.files ? Array.from(e.target.files) : [];
                      setRefFiles(files);
                    }}
                    className="mt-2"
                  />
                  <div className="mt-2 flex gap-2 flex-wrap">
                    {refPreviews.map((p,i) => <img key={`new-${i}`} src={p} alt={`ref-new-${i}`} className="h-20 object-cover rounded" />)}
                    {!refPreviews.length && existingRefUrls.length ? existingRefUrls.map((p,i) => <img key={`exist-${i}`} src={p} alt={`ref-ex-${i}`} className="h-20 object-cover rounded" />) : null}
                    {!refPreviews.length && !existingRefUrls.length && <div className="text-sm text-slate-500">No reference images</div>}
                  </div>
                </div>

                <div className="pt-4">
                  <button
                    type="button"
                    onClick={saveProfileAndAi}
                    disabled={saving}
                    className="px-4 py-2 rounded bg-blue-600 text-white"
                  >
                    {saving ? 'Saving…' : 'Save AI Customization'}
                  </button>
                </div>
              </div>
            )}

            {/* recaptcha container for firebase phone */}
            <div className="mt-6">
              <div ref={recaptchaContainerRef} id="recaptcha-container" />
            </div>

            {infoMessage && <div className="mt-4 text-sm text-green-600">{infoMessage}</div>}
            {error && <div className="mt-4 text-sm text-red-600">{error}</div>}
          </div>
        </div>
      </main>
    </div>
  );
}
