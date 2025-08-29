// pages/auth/signup.tsx
import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabaseClient';

export default function SignUpPage() {
  const [showPw, setShowPw] = useState(false);
  const [showPw2, setShowPw2] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    const form = new FormData(e.currentTarget);
    const email = form.get('email') as string;
    const password = form.get('password') as string;
    const confirm = form.get('confirm') as string;

    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }

    const { error: err } = await supabase.auth.signUp({ email, password });
    if (err) setError(err.message);
    else router.push('/dashboard');
  };

  const handleGoogleSignup = async () => {
    const { data, error: err } = await supabase.auth.signInWithOAuth({ provider: 'google',options: {
      redirectTo: 'http://localhost:3000/dashboard',
    }, });
    if (err) alert(err.message);
    else if (data?.url) window.location.href = data.url;
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-lg p-8">
        <div className="text-center">
          <h1 className="text-3xl font-semibold">OptimAI</h1>
          <p className="text-sm text-slate-500 mt-1">AI-powered marketing optimization</p>
        </div>
        <div className="mt-6 grid grid-cols-2 rounded-xl bg-slate-100 p-1 text-sm font-medium">
          <Link href="/auth/signin" className="rounded-lg py-2 text-center text-slate-600 hover:text-slate-900">Sign In</Link>
          <div className="rounded-lg bg-white py-2 text-center shadow">Sign Up</div>
        </div>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          {/* Full Name */}
          <div>
            <label className="block text-sm font-medium text-slate-700">Full Name</label>
            <input name="name" type="text" required className="mt-1 w-full rounded-lg border px-4 py-2.5" />
          </div>
          {/* Business Name */}
          <div>
            <label className="block text-sm font-medium text-slate-700">Business Name</label>
            <input name="biz" type="text" required className="mt-1 w-full rounded-lg border px-4 py-2.5" />
          </div>
          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-slate-700">Email</label>
            <input name="email" type="email" required className="mt-1 w-full rounded-lg border px-4 py-2.5" />
          </div>
          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-slate-700">Password</label>
            <div className="relative">
              <input name="password" type={showPw ? 'text' : 'password'} required className="w-full rounded-lg border px-4 py-2.5 pr-11" />
              <button type="button" onClick={() => setShowPw(s => !s)} className="absolute inset-y-0 right-2">{showPw ? '🙈' : '👁️'}</button>
            </div>
          </div>
          {/* Confirm Password */}
          <div>
            <label className="block text-sm font-medium text-slate-700">Confirm Password</label>
            <div className="relative">
              <input name="confirm" type={showPw2 ? 'text' : 'password'} required className="w-full rounded-lg border px-4 py-2.5 pr-11" />
              <button type="button" onClick={() => setShowPw2(s => !s)} className="absolute inset-y-0 right-2">{showPw2 ? '🙈' : '👁️'}</button>
            </div>
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button type="submit" className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-white">Create Account</button>
        </form>
        <div className="my-6 flex items-center gap-3 text-xs text-slate-400">
          <div className="h-px flex-1 bg-slate-200" /><span>OR CONTINUE WITH</span><div className="h-px flex-1 bg-slate-200" />
        </div>
        <button onClick={handleGoogleSignup} className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 font-medium hover:bg-slate-50">
          <span className="mr-2">🟢</span> Continue with Google
        </button>
        <p className="mt-6 text-center text-xs text-slate-500">By continuing, you agree to our Terms of Service and Privacy Policy.</p>
      </div>
    </div>
  );
}
