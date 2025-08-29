// pages/integrations.tsx
import Link from "next/link";

export default function Integrations() {
  const platforms = [
    { name: "Facebook", icon: "📘", status: "Disconnected" },
    { name: "Instagram", icon: "📸", status: "Disconnected" },
    { name: "Google Ads", icon: "🔍", status: "Disconnected" },
    { name: "WhatsApp Business", icon: "💬", status: "Disconnected" },
    { name: "LinkedIn", icon: "💼", status: "Disconnected" },
    { name: "Twitter", icon: "🐦", status: "Disconnected" },
  ];

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white shadow-lg flex flex-col">
        <div className="px-6 py-4 border-b">
          <h1 className="text-xl font-bold text-slate-800">OptimAI</h1>
          <p className="text-xs text-slate-500">Campaign Manager</p>
        </div>

        <nav className="flex-1 p-4 space-y-2 text-slate-700">
          <Link href="/dashboard" className="block px-3 py-2 rounded-lg hover:bg-slate-100">
            📊 Dashboard
          </Link>
          <Link href="/create-campaign" className="block px-3 py-2 rounded-lg hover:bg-slate-100">
            ➕ Create Campaign
          </Link>
          <Link href="/insights" className="block px-3 py-2 rounded-lg hover:bg-slate-100">
            🤖 AI Insights
          </Link>
          <Link href="/analytics" className="block px-3 py-2 rounded-lg hover:bg-slate-100">
            📈 Analytics
          </Link>
          <Link href="/library" className="block px-3 py-2 rounded-lg hover:bg-slate-100">
            📚 Campaign Library
          </Link>
          <Link href="/publish" className="block px-3 py-2 rounded-lg hover:bg-slate-100">
            📤 Publishing
          </Link>
          <Link
            href="/integrations"
            className="block px-3 py-2 rounded-lg bg-blue-50 text-blue-700 font-medium"
          >
            🔗 Integrations
          </Link>
          <Link href="/notifications" className="block px-3 py-2 rounded-lg hover:bg-slate-100">
            🔔 Notifications
          </Link>
          <Link href="/settings" className="block px-3 py-2 rounded-lg hover:bg-slate-100">
            ⚙️ Settings
          </Link>
        </nav>

        {/* Quick Create */}
        <div className="p-4 border-t">
          <Link
            href="/create-campaign"
            className="w-full block text-center rounded-lg bg-blue-600 px-4 py-2 text-white font-medium hover:bg-blue-700"
          >
            Start Campaign
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-slate-800">Integrations</h2>
          <p className="text-sm text-slate-500">
            Connect your marketing platforms securely with encrypted tokens
          </p>
        </div>

        {/* Integrations Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {platforms.map((platform, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between p-5 rounded-xl border bg-white shadow-sm"
            >
              {/* Platform Info */}
              <div className="flex items-center space-x-4">
                <span className="text-2xl">{platform.icon}</span>
                <div>
                  <h3 className="text-md font-semibold text-slate-800">{platform.name}</h3>
                  <span className="text-xs text-red-600 bg-red-100 px-2 py-0.5 rounded-full">
                    {platform.status}
                  </span>
                </div>
              </div>

              {/* Connect Button */}
              <button className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700">
                + Connect
              </button>
            </div>
          ))}
        </div>

        {/* Security Notice */}
        <div className="mt-8 p-5 rounded-xl border bg-blue-50 text-slate-700 shadow-sm">
          <h3 className="font-semibold">🔒 Security Notice</h3>
          <p className="text-sm mt-2">
            All API tokens are encrypted at rest and never exposed in the frontend. Your integration
            credentials are protected with industry-standard encryption.
          </p>
        </div>
      </main>
    </div>
  );
}
