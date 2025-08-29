// pages/library.tsx
import Link from "next/link";

export default function Library() {
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
          <Link
            href="/library"
            className="block px-3 py-2 rounded-lg bg-blue-50 text-blue-700 font-medium"
          >
            📚 Campaign Library
          </Link>
          <Link href="/publishing" className="block px-3 py-2 rounded-lg hover:bg-slate-100">
            📤 Publishing
          </Link>
          <Link href="/integrations" className="block px-3 py-2 rounded-lg hover:bg-slate-100">
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
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-slate-800">Campaign Library</h2>
          <button className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700">
            + New Campaign
          </button>
        </div>

        {/* Campaign List Placeholder */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Example campaign card */}
          <div className="p-5 rounded-xl border bg-white shadow-sm">
            <h3 className="text-lg font-semibold text-slate-800">Summer Sale 2025</h3>
            <p className="text-sm text-slate-500 mt-1">Facebook • Google Ads</p>
            <div className="flex items-center justify-between mt-4">
              <span className="text-sm text-green-600 font-medium">Active</span>
              <button className="px-3 py-1 text-sm border rounded-lg hover:bg-slate-100">
                View
              </button>
            </div>
          </div>

          {/* Add more campaign cards dynamically later */}
        </div>
      </main>
    </div>
  );
}
