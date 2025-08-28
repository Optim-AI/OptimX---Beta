import { useState, FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/router";

export default function SignUpPage() {
  const [showPw, setShowPw] = useState(false);
  const [showPw2, setShowPw2] = useState(false);
  const router = useRouter();

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    router.push("/dashboard");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-lg p-8">
        {/* Brand */}
        <div className="text-center">
          <h1 className="text-3xl font-semibold">OptimAI</h1>
          <p className="text-sm text-slate-500 mt-1">
            AI-powered marketing optimization
          </p>
        </div>

        {/* Tabs */}
        <div className="mt-6 grid grid-cols-2 rounded-xl bg-slate-100 p-1 text-sm font-medium">
          <Link
            href="/auth/signin"
            className="rounded-lg py-2 text-center text-slate-600 hover:text-slate-900"
          >
            Sign In
          </Link>
          <div className="rounded-lg bg-white py-2 text-center shadow">
            Sign Up
          </div>
        </div>

        {/* Form */}
        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <div>
            <label
              htmlFor="name"
              className="block text-sm font-medium text-slate-700"
            >
              Full Name
            </label>
            <input
              id="name"
              type="text"
              required
              placeholder="Enter your full name"
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 outline-none focus:border-slate-400"
            />
          </div>

          <div>
            <label
              htmlFor="biz"
              className="block text-sm font-medium text-slate-700"
            >
              Business Name
            </label>
            <input
              id="biz"
              type="text"
              required
              placeholder="Enter your business name"
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 outline-none focus:border-slate-400"
            />
          </div>

          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-slate-700"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              placeholder="Enter your email"
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 outline-none focus:border-slate-400"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-slate-700"
            >
              Password
            </label>
            <div className="mt-1 relative">
              <input
                id="password"
                type={showPw ? "text" : "password"}
                required
                placeholder="Create a password"
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

          <div>
            <label
              htmlFor="confirm"
              className="block text-sm font-medium text-slate-700"
            >
              Confirm Password
            </label>
            <div className="mt-1 relative">
              <input
                id="confirm"
                type={showPw2 ? "text" : "password"}
                required
                placeholder="Confirm your password"
                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 pr-11 outline-none focus:border-slate-400"
              />
              <button
                type="button"
                aria-label={showPw2 ? "Hide password" : "Show password"}
                onClick={() => setShowPw2((s) => !s)}
                className="absolute inset-y-0 right-2 flex items-center px-2 text-slate-500 hover:text-slate-700"
              >
                {showPw2 ? "🙈" : "👁️"}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-white font-medium hover:bg-blue-700 active:bg-blue-800"
          >
            Create Account
          </button>
        </form>

        {/* Divider */}
        <div className="my-6 flex items-center gap-3 text-xs text-slate-400">
          <div className="h-px flex-1 bg-slate-200" />
          <span>OR CONTINUE WITH</span>
          <div className="h-px flex-1 bg-slate-200" />
        </div>

        {/* Google button */}
        <button
          type="button"
          onClick={() => router.push("/dashboard")}
          className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 font-medium hover:bg-slate-50"
        >
          <span className="mr-2">🟢</span> Continue with Google
        </button>

        <p className="mt-6 text-center text-xs text-slate-500">
          By continuing, you agree to our Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>
  );
}
