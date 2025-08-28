import { useState } from "react";
import Link from "next/link";

export default function SignInPage() {
  const [showPw, setShowPw] = useState(false);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-lg p-8">
        {/* Brand */}
        <div className="text-center">
          <h1 className="text-3xl font-semibold">OptimAI</h1>
          <p className="text-sm text-slate-500 mt-1">AI-powered marketing optimization</p>
        </div>

        {/* Tabs */}
        <div className="mt-6 grid grid-cols-2 rounded-xl bg-slate-100 p-1 text-sm font-medium">
          <div className="rounded-lg bg-white py-2 text-center shadow">Sign In</div>
          <Link href="/auth/signup" className="rounded-lg py-2 text-center text-slate-600 hover:text-slate-900">
            Sign Up
          </Link>
        </div>

        {/* Form */}
        <form
          className="mt-6 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            // wire up later with Firebase
          }}
        >
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-700">
              Email
            </label>
            <div className="mt-1 relative">
              <input
                id="email"
                type="email"
                required
                placeholder="Enter your email"
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 outline-none ring-0 focus:border-slate-400"
              />
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400">📧</span>
            </div>
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-700">
              Password
            </label>
            <div className="mt-1 relative">
              <input
                id="password"
                type={showPw ? "text" : "password"}
                required
                placeholder="Enter your password"
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 pr-11 outline-none focus:border-slate-400"
              />
              <button
                type="button"
                aria-label={showPw ? "Hide password" : "Show password"}
                onClick={() => setShowPw((s) => !s)}
                className="absolute inset-y-0 right-2 flex items-center px-2 text-slate-500 hover:text-slate-700"
              >
                {showPw ? "🙈" : "👁️"}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-white font-medium hover:bg-blue-700 active:bg-blue-800"
          >
            Sign In
          </button>
        </form>

        {/* Divider */}
        <div className="my-6 flex items-center gap-3 text-xs text-slate-400">
          <div className="h-px flex-1 bg-slate-200" />
          <span>OR CONTINUE WITH</span>
          <div className="h-px flex-1 bg-slate-200" />
        </div>

        {/* Google button (UI only) */}
        <button
          type="button"
          className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 font-medium hover:bg-slate-50"
        >
          <span className="mr-2">🟢</span> Continue with Google
        </button>

        {/* Terms */}
        <p className="mt-6 text-center text-xs text-slate-500">
          By continuing, you agree to our Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>
  );
}
