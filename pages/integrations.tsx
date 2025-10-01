// pages/integrations.tsx
import React from "react";

export default function Integrations() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="max-w-xl w-full bg-white shadow-md rounded-2xl p-8">
        <h1 className="text-2xl font-semibold mb-4">Integrations</h1>
        <p className="mb-6 text-sm text-gray-600">
          Sign in with Google Ads to connect your manager and child accounts (test mode).
        </p>
        <a
          href="/api/auth/google-ads/start"
          className="inline-block w-full text-center py-3 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Sign in with Google Ads
        </a>
        <p className="mt-4 text-xs text-gray-500">
          Make sure the redirect URI <code>{"https://f21a706b4441.ngrok-free.app" + "/api/auth/google-ads/callback"}</code> is added in your Google Cloud OAuth consent settings.
        </p>
      </div>
    </div>
  );
}
