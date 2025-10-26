// pages/onboardingInfo.tsx
import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabaseClient';
import { initFirebaseApp, getFirebaseAuth } from '../lib/firebaseClient';
import type { ConfirmationResult } from 'firebase/auth';

type ProfileRow = {
  id: string;
  full_name?: string | null;
  business_name?: string | null;
  email?: string | null;
  phone?: string | null;
  phone_verified?: boolean | null;
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

const BUSINESS_TYPES = ['E-commerce','Local Services','SaaS','Retail','Agency','Healthcare','Education','Hospitality','Manufacturing','Other'];
const BUSINESS_SIZES = ['Solo','1-10','11-50','51-200','201-1000','1000+'];
const FONT_LIST = ['Inter','Roboto','Poppins','Montserrat','Lato','Open Sans','Source Sans Pro'];
const USE_CASE_OPTIONS = [
  'Increase ROI on ad spend','Improve ad creatives (images/videos)','Audience targeting & segmentation',
  'Automated A/B testing','Landing page optimization','Scale campaigns efficiently',
  'Reduce customer acquisition cost (CAC)','Improve lifetime value (LTV)','Generate more qualified leads','Other (consultation)'
];
const HEARD_FROM_OPTIONS = ['Google / Search','Friend / Referral','Social Media','Paid Ad','Email','Event / Conference','Partner','Other'];

export default function OnboardingInfoPage() {
  const router = useRouter();
  const recaptchaContainerRef = useRef<HTMLDivElement | null>(null);

  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(1);
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Partial<ProfileRow>>({});

  // step 1
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [phoneConfirmResult, setPhoneConfirmResult] = useState<ConfirmationResult | null>(null);
  const [phoneCode, setPhoneCode] = useState('');
  const [sendingPhone, setSendingPhone] = useState(false);
  const [verifyingPhone, setVerifyingPhone] = useState(false);
  const [heardFrom, setHeardFrom] = useState(HEARD_FROM_OPTIONS[0]);
  const [heardFromOther, setHeardFromOther] = useState('');

  // step 2
  const [businessName, setBusinessName] = useState('');
  const [location, setLocation] = useState('');
  const [businessMobile, setBusinessMobile] = useState('');
  const [businessVerified, setBusinessVerified] = useState(false);
  const [businessConfirmResult, setBusinessConfirmResult] = useState<ConfirmationResult | null>(null);
  const [businessCode, setBusinessCode] = useState('');
  const [sendingBusiness, setSendingBusiness] = useState(false);
  const [verifyingBusiness, setVerifyingBusiness] = useState(false);
  const [businessType, setBusinessType] = useState(BUSINESS_TYPES[0]);
  const [businessSize, setBusinessSize] = useState(BUSINESS_SIZES[0]);
  const [useCase, setUseCase] = useState<string[]>([]);

  // step 3
  const [colorPrimary, setColorPrimary] = useState('#0ea5e9');
  const [colorSecondary, setColorSecondary] = useState('#0b74ff');
  const [font, setFont] = useState(FONT_LIST[0]);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [refFiles, setRefFiles] = useState<File[]>([]);
  const [refPreviews, setRefPreviews] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState<string | null>(null);

  // Initialize user/profile + client-side Firebase App
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data: userData } = await supabase.auth.getUser();
        const user = userData?.user;
        if (!user) {
          router.push('/auth/signin');
          return;
        }
        setUserId(user.id);

        const { data, error } = await supabase.from('profiles').select('*').eq('id', user.id).single();
        if (!error && data) {
          setProfile(data);
          setFullName(data.full_name || user.user_metadata?.full_name || '');
          setEmail(data.email || user.email || '');
          setPhone(data.phone || '');
          setPhoneVerified(Boolean(data.phone_verified));
          setBusinessName(data.business_name || '');
          setLocation(data.location || '');
          setBusinessMobile(data.business_mobile || '');
          setBusinessVerified(Boolean(data.business_mobile_verified));
          if (Array.isArray(data.use_case)) setUseCase(data.use_case);
          else if (typeof data.use_case === 'string' && data.use_case.length) setUseCase([data.use_case]);
          setColorPrimary(data.color_primary || '#0ea5e9');
          setColorSecondary(data.color_secondary || '#0b74ff');
          setFont(data.font || FONT_LIST[0]);
          setHeardFrom(data.heard_from || HEARD_FROM_OPTIONS[0]);
          setHeardFromOther(data.heard_from_other || '');
        } else {
          setFullName(user.user_metadata?.full_name || '');
          setEmail(user.email || '');
        }

        // init firebase app in browser (client-side)
        if (typeof window !== 'undefined') {
          try {
            initFirebaseApp();
          } catch (e) {
            console.warn('Firebase init app error', e);
          }
        }
      } catch (e: any) {
        console.error('init error', e);
        setError(String(e?.message || e));
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  // file previews
  useEffect(() => {
    if (logoFile) {
      const url = URL.createObjectURL(logoFile);
      setLogoPreview(url);
      return () => URL.revokeObjectURL(url);
    } else setLogoPreview(null);
  }, [logoFile]);

  useEffect(() => {
    if (refFiles.length > 0) {
      const urls = refFiles.map((f) => URL.createObjectURL(f));
      setRefPreviews(urls);
      return () => urls.forEach((u) => URL.revokeObjectURL(u));
    } else setRefPreviews([]);
  }, [refFiles]);

  const toggleUseCase = (opt: string) => {
    setUseCase(prev => prev.includes(opt) ? prev.filter(p => p !== opt) : [...prev, opt]);
  };

  // Create and return a rendered RecaptchaVerifier instance (or throw)
  async function createRecaptchaVerifier() {
    if (typeof window === 'undefined') throw new Error('client-only');

    if (!recaptchaContainerRef.current) throw new Error('Recaptcha container not mounted');

    // get cached auth (initializes app first)
    const auth = getFirebaseAuth();

    // defensive: ensure settings object exists before Firebase internals read it
    // Use nullish check so null is handled too.
    (auth as any).settings = (auth as any).settings ?? {};

    // optional: for local tests only, you can disable app verification by setting env var
    // DO NOT enable in production!
    if (process.env.NEXT_PUBLIC_FIREBASE_DISABLE_APP_VERIFICATION_FOR_TESTING === 'true') {
      // safe: settings exists above
      (auth as any).settings.appVerificationDisabledForTesting = true;
    }

    const win = window as any;
    if (win.__recaptchaVerifier) {
      return win.__recaptchaVerifier;
    }

    // dynamic import RecaptchaVerifier class
    const mod = await import('firebase/auth');
    const RecaptchaVerifier = (mod as any).RecaptchaVerifier;
    if (!RecaptchaVerifier) throw new Error('RecaptchaVerifier not available in firebase/auth');

    // pass auth (works across firebase versions)
    const verifier = new RecaptchaVerifier(auth, recaptchaContainerRef.current, { size: 'invisible' });

    // render to ensure it's ready (some firebase versions return a promise, some don't)
    if (typeof verifier.render === 'function') {
      // intentionally await in case it returns a promise in this runtime
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (verifier as any).render();
    }

    win.__recaptchaVerifier = verifier;
    return verifier;
  }

  // send sms (phone or business)
  const sendSms = async (target: 'phone' | 'business') => {
    setError(null);
    const phoneToUse = target === 'phone' ? phone : businessMobile;
    if (!phoneToUse || !phoneToUse.startsWith('+')) {
      setError('Phone must be in E.164 format (e.g. +9198...)');
      return;
    }
    try {
      if (target === 'phone') setSendingPhone(true);
      else setSendingBusiness(true);

      const verifier = await createRecaptchaVerifier();
      if (!verifier) throw new Error('Recaptcha creation failed');

      const mod = await import('firebase/auth');
      const { signInWithPhoneNumber } = mod as any;
      const auth = getFirebaseAuth();

      // defensive ensure settings exists (again) - harmless if already set
      (auth as any).settings = (auth as any).settings ?? {};

      const confirmation = await signInWithPhoneNumber(auth, phoneToUse, verifier);
      if (target === 'phone') setPhoneConfirmResult(confirmation);
      else setBusinessConfirmResult(confirmation);
    } catch (err: any) {
      console.error('sendSms error', err);
      setError(err?.message || String(err));
      // If recaptcha verifier exists but is in a broken state, try clearing it so user can re-request.
      try {
        const win = window as any;
        if (win.__recaptchaVerifier && typeof win.__recaptchaVerifier.clear === 'function') {
          win.__recaptchaVerifier.clear();
          win.__recaptchaVerifier = null;
        }
      } catch (_) {}
    } finally {
      if (target === 'phone') setSendingPhone(false);
      else setSendingBusiness(false);
    }
  };

  // confirm code
  const confirmCode = async (target: 'phone' | 'business') => {
    setError(null);
    const confirmation = target === 'phone' ? phoneConfirmResult : businessConfirmResult;
    const code = target === 'phone' ? phoneCode.trim() : businessCode.trim();
    if (!confirmation) return setError('Send SMS first');
    if (!code) return setError('Please enter the code');
    try {
      if (target === 'phone') setVerifyingPhone(true);
      else setVerifyingBusiness(true);

      const userCred = await confirmation.confirm(code);
      const idToken = await userCred.user.getIdToken();

      // get current supabase session access token to authorize the server API
      const session = await supabase.auth.getSession();
      const accessToken = session.data?.session?.access_token;

      const resp = await fetch('/api/verify-firebase-phone', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify({ idToken, target })
      });
      const j = await resp.json();
      if (!resp.ok) throw new Error(j?.error || 'Verification failed');

      // refresh profile from supabase (defensive)
      const { data: profileData, error: pErr } = await supabase.from('profiles').select('*').eq('id', userId).single();
      if (!pErr && profileData) {
        setProfile(profileData);
        setPhoneVerified(Boolean((profileData as any).phone_verified));
        setBusinessVerified(Boolean((profileData as any).business_mobile_verified));
      } else {
        // fallback local update
        if (target === 'phone') setPhoneVerified(true);
        else setBusinessVerified(true);
      }

      if (target === 'phone') setPhoneCode(''); else setBusinessCode('');
    } catch (err: any) {
      console.error('confirmCode error', err);
      setError(err?.message || String(err));
    } finally {
      if (target === 'phone') setVerifyingPhone(false);
      else setVerifyingBusiness(false);
      // cleanup recaptcha (best-effort) - keep it robust across firebase versions
      try {
        const win = window as any;
        if (win.__recaptchaVerifier && typeof win.__recaptchaVerifier.clear === 'function') {
          win.__recaptchaVerifier.clear();
          win.__recaptchaVerifier = null;
        }
      } catch (_) {}
    }
  };

  // upload helper used by Finish
  async function uploadFile(file: File, path: string) {
    const { supabase } = await import('../lib/supabaseClient');
    const { error } = await supabase.storage.from('user-uploads').upload(path, file, { cacheControl: '3600', upsert: true });
    if (error) throw error;
    return path;
  }

  const handleNext = () => setStep(s => Math.min(3, s+1));
  const handleBack = () => setStep(s => Math.max(1, s-1));

  const handleFinish = async () => {
    setError(null);
    if (!userId) return setError('User not found');
    setSaving(true);
    try {
      const uploadedPaths: string[] = [];

      let logo_path: string | null = null;
      if (logoFile) {
        const safeName = `${Date.now()}_${logoFile.name.replace(/\s+/g,'_')}`;
        const path = `${userId}/logos/${safeName}`;
        await uploadFile(logoFile, path);
        logo_path = path;
      }

      if (refFiles.length > 0) {
        for (const f of refFiles) {
          const safeName = `${Date.now()}_${f.name.replace(/\s+/g,'_')}`;
          const path = `${userId}/refs/${safeName}`;
          await uploadFile(f, path);
          uploadedPaths.push(path);
        }
      }

      const payload: any = {
        id: userId,
        full_name: fullName || null,
        email: email || null,
        phone: phone || null,
        phone_verified: phoneVerified || null,
        business_mobile: businessMobile || null,
        business_mobile_verified: businessVerified || null,
        heard_from: heardFrom || null,
        heard_from_other: heardFrom === 'Other' ? (heardFromOther || null) : null,

        business_name: businessName || null,
        location: location || null,
        business_type: businessType || null,
        business_size: businessSize || null,
        use_case: useCase.length ? useCase : null,

        color_primary: colorPrimary || null,
        color_secondary: colorSecondary || null,
        font: font || null,
        logo_path,
        ref_images: uploadedPaths.length ? uploadedPaths : null,
      };

      const { error: upErr } = await supabase.from('profiles').upsert(payload, { onConflict: 'id' });
      if (upErr) throw upErr;

      router.push('/dashboard');
    } catch (e: any) {
      console.error(e);
      setError(e.message || JSON.stringify(e));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-8">Loading…</div>;

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div ref={recaptchaContainerRef} id="recaptcha-container" />
      <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow p-6">
        <h2 className="text-2xl font-semibold">Onboarding — Step {step} of 3</h2>

        <div className="mt-4 flex gap-3">
          <button className={`px-3 py-1 rounded ${step === 1 ? 'bg-blue-600 text-white' : 'bg-slate-100'}`} onClick={() => setStep(1)}>1. User Details</button>
          <button className={`px-3 py-1 rounded ${step === 2 ? 'bg-blue-600 text-white' : 'bg-slate-100'}`} onClick={() => setStep(2)}>2. Business Details</button>
          <button className={`px-3 py-1 rounded ${step === 3 ? 'bg-blue-600 text-white' : 'bg-slate-100'}`} onClick={() => setStep(3)}>3. Customize AI</button>
        </div>

        <div className="mt-6">
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">Full name</label>
                <input value={fullName} onChange={e=>setFullName(e.target.value)} className="mt-1 w-full rounded border px-3 py-2" />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">Email</label>
                <input value={email} onChange={e=>setEmail(e.target.value)} className="mt-1 w-full rounded border px-3 py-2" />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">Phone number (optional)</label>
                <div className="flex gap-2 items-center">
                  <input value={phone} onChange={e=>setPhone(e.target.value)} placeholder="+919XXXXXXXXX" className="mt-1 w-full rounded border px-3 py-2" />
                  <div>{phoneVerified ? <span title="Verified">✅</span> : <span title="Not verified">⚠️</span>}</div>
                </div>

                <div className="mt-2 flex gap-2">
                  <button disabled={sendingPhone} onClick={()=>sendSms('phone')} className="px-3 py-1 rounded bg-slate-100">{sendingPhone ? 'Sending…' : 'Send SMS'}</button>
                  {phoneConfirmResult && (
                    <>
                      <input value={phoneCode} onChange={e=>setPhoneCode(e.target.value)} placeholder="Enter code" className="rounded border px-3 py-1" />
                      <button disabled={verifyingPhone} onClick={()=>confirmCode('phone')} className="px-3 py-1 rounded bg-green-600 text-white">{verifyingPhone ? 'Verifying…' : 'Verify'}</button>
                    </>
                  )}
                </div>
                <div className="mt-1 text-xs text-slate-500">Optional — verified numbers show a ✅.</div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">Where did you hear from us?</label>
                <select value={heardFrom} onChange={e=>setHeardFrom(e.target.value)} className="mt-1 w-full rounded border px-3 py-2">
                  {HEARD_FROM_OPTIONS.map(h=> <option key={h} value={h}>{h}</option>)}
                </select>
                {heardFrom === 'Other' && <input value={heardFromOther} onChange={e=>setHeardFromOther(e.target.value)} placeholder="Please specify" className="mt-2 w-full rounded border px-3 py-2" />}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">Business Name</label>
                <input value={businessName} onChange={e=>setBusinessName(e.target.value)} className="mt-1 w-full rounded border px-3 py-2" />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">Location</label>
                <input value={location} onChange={e=>setLocation(e.target.value)} className="mt-1 w-full rounded border px-3 py-2" />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">Business Mobile Number (optional)</label>
                <div className="flex gap-2 items-center">
                  <input value={businessMobile} onChange={e=>setBusinessMobile(e.target.value)} placeholder="+919XXXXXXXXX" className="mt-1 w-full rounded border px-3 py-2" />
                  <div>{businessVerified ? <span title="Verified">✅</span> : <span title="Not verified">⚠️</span>}</div>
                </div>

                <div className="mt-2 flex gap-2">
                  <button disabled={sendingBusiness} onClick={()=>sendSms('business')} className="px-3 py-1 rounded bg-slate-100">{sendingBusiness ? 'Sending…' : 'Send SMS'}</button>
                  {businessConfirmResult && (
                    <>
                      <input value={businessCode} onChange={e=>setBusinessCode(e.target.value)} placeholder="Enter code" className="rounded border px-3 py-1" />
                      <button disabled={verifyingBusiness} onClick={()=>confirmCode('business')} className="px-3 py-1 rounded bg-green-600 text-white">{verifyingBusiness ? 'Verifying…' : 'Verify'}</button>
                    </>
                  )}
                </div>
                <div className="mt-1 text-xs text-slate-500">Optional — verify business number for extra trust.</div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">Primary contact email</label>
                <input value={email} onChange={e=>setEmail(e.target.value)} className="mt-1 w-full rounded border px-3 py-2" />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">Type of business</label>
                <select value={businessType} onChange={e=>setBusinessType(e.target.value)} className="mt-1 w-full rounded border px-3 py-2">
                  {BUSINESS_TYPES.map(bt => <option key={bt} value={bt}>{bt}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">Size of business</label>
                <select value={businessSize} onChange={e=>setBusinessSize(e.target.value)} className="mt-1 w-full rounded border px-3 py-2">
                  {BUSINESS_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">Use case (pick any that apply)</label>
                <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {USE_CASE_OPTIONS.map(opt => (
                    <label key={opt} className={`cursor-pointer border rounded p-3 flex items-center gap-3 ${useCase.includes(opt) ? 'border-blue-600 bg-blue-50' : 'bg-white'}`}>
                      <input type="checkbox" checked={useCase.includes(opt)} onChange={() => toggleUseCase(opt)} className="h-4 w-4" />
                      <span className="text-sm">{opt}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">Company Logo (upload)</label>
                <input type="file" accept="image/*" onChange={e => setLogoFile(e.target.files ? e.target.files[0] : null)} />
                {logoPreview && <img src={logoPreview} alt="logo" className="mt-2 h-24 object-contain" />}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">Reference images (multiple)</label>
                <input type="file" accept="image/*" multiple onChange={e => {
                  const files = e.target.files ? Array.from(e.target.files) : [];
                  setRefFiles(files);
                }} />
                <div className="mt-2 flex gap-2 flex-wrap">
                  {refPreviews.map((p,i) => <img key={i} src={p} alt={`ref-${i}`} className="h-20 object-cover rounded" />)}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">Primary color</label>
                <input type="color" value={colorPrimary} onChange={e=>setColorPrimary(e.target.value)} className="mt-1 h-10 w-20 p-0 border rounded" />
                <div className="mt-2 text-sm text-slate-600">Selected: <span className="font-medium">{colorPrimary}</span></div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">Secondary color</label>
                <input type="color" value={colorSecondary} onChange={e=>setColorSecondary(e.target.value)} className="mt-1 h-10 w-20 p-0 border rounded" />
                <div className="mt-2 text-sm text-slate-600">Selected: <span className="font-medium">{colorSecondary}</span></div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">Font</label>
                <select value={font} onChange={e=>setFont(e.target.value)} className="mt-1 w-full rounded border px-3 py-2">
                  {FONT_LIST.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
                <div className="mt-1 text-xs text-slate-500">We save the font name; map it to actual fonts in your renderer later.</div>
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 flex items-center justify-between">
          <div>{step > 1 && <button onClick={handleBack} className="px-4 py-2 rounded bg-slate-100">Back</button>}</div>
          <div className="flex items-center gap-3">
            {step < 3 && <button onClick={handleNext} className="px-4 py-2 rounded bg-blue-600 text-white">Next</button>}
            {step === 3 && <button onClick={handleFinish} disabled={saving} className="px-4 py-2 rounded bg-green-600 text-white">{saving ? 'Saving…':'Finish and Go to Dashboard'}</button>}
          </div>
        </div>

        {error && <div className="mt-4 text-red-500">{error}</div>}
      </div>
    </div>
  );
}
