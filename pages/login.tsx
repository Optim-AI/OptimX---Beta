// pages/login.tsx
import React, { useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';

export default function LoginPage() {
  const [email, setEmail] = useState('shaamaws@gmail.com');
  const router = useRouter();

  const signIn = () => {
    // Set cookie so server API routes can resolve userId
    document.cookie = `userId=${encodeURIComponent(email)}; path=/;`;
    // optional: also set a short-lived localStorage flag
    localStorage.setItem('userId', email);
    router.push('/integrations');
  };

  return (
    <>
      <Head><title>Test Login</title></Head>
      <main className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="w-full max-w-md bg-white rounded-xl shadow p-6">
          <h1 className="text-xl font-semibold mb-4">Test sign-in</h1>
          <p className="text-sm text-gray-600 mb-4">
            Use this page to simulate signing in with your test Google account. No OAuth required.
          </p>

          <label className="block text-sm font-medium mb-1">Test account email</label>
          <input value={email} onChange={(e) => setEmail(e.target.value)} className="w-full border rounded p-2 mb-4" />

          <div className="flex gap-3">
            <button onClick={signIn} className="px-4 py-2 bg-blue-600 text-white rounded">Sign in as test account</button>
            <button onClick={() => { setEmail('shaamaws@gmail.com'); }} className="px-4 py-2 bg-gray-100 rounded">Use default</button>
          </div>

          <p className="mt-4 text-xs text-gray-500">This sets a cookie `userId` which the test API uses to identify you.</p>
        </div>
      </main>
    </>
  );
}
