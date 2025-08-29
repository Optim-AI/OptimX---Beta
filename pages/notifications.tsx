// pages/notifications.tsx
import Link from "next/link";

export default function Notifications() {
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
          <Link
            href="/publish"
            className="block px-3 py-2 rounded-lg hover:bg-slate-100"
          >
            📤 Publishing
          </Link>
          <Link href="/integrations" className="block px-3 py-2 rounded-lg hover:bg-slate-100">
            🔗 Integrations
          </Link>
          <Link
            href="/notifications"
            className="block px-3 py-2 rounded-lg bg-blue-50 text-blue-700 font-medium"
          >
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
          <h2 className="text-2xl font-bold text-slate-800">Notifications</h2>
          <button className="px-4 py-2 text-sm rounded-lg bg-slate-200 text-slate-700 hover:bg-slate-300">
            Mark All Read
          </button>
        </div>

        {/* Notifications List */}
        <div className="space-y-4">
          {/* Campaign Performance Drop */}
          <div className="p-5 rounded-xl border bg-white shadow-sm flex items-start">
            <span className="text-red-500 text-lg mr-3">⚠️</span>
            <div className="flex-1">
              <h3 className="font-semibold text-slate-800">
                Campaign performance drop
              </h3>
              <p className="text-sm text-slate-600">
                Your 'Summer Sale' campaign CTR dropped by 15%
              </p>
              <p className="text-xs text-slate-400 mt-1">2 hours ago</p>
            </div>
          </div>

          {/* Budget Threshold Reached */}
          <div className="p-5 rounded-xl border bg-white shadow-sm flex items-start">
            <span className="text-green-500 text-lg mr-3">✅</span>
            <div className="flex-1">
              <h3 className="font-semibold text-slate-800">
                Budget threshold reached <span className="ml-1 text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded">NEW</span>
              </h3>
              <p className="text-sm text-slate-600">
                Campaign 'New Collection' has used 80% of allocated budget
              </p>
              <p className="text-xs text-slate-400 mt-1">4 hours ago</p>
            </div>
          </div>

          {/* Weekly Report Ready */}
          <div className="p-5 rounded-xl border bg-white shadow-sm flex items-start">
            <span className="text-blue-500 text-lg mr-3">ℹ️</span>
            <div className="flex-1">
              <h3 className="font-semibold text-slate-800">
                Weekly report ready
              </h3>
              <p className="text-sm text-slate-600">
                Your weekly performance report is now available
              </p>
              <p className="text-xs text-slate-400 mt-1">1 day ago</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
