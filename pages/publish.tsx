// pages/publish.tsx
import Link from "next/link";

export default function Publish() {
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
            className="block px-3 py-2 rounded-lg bg-blue-50 text-blue-700 font-medium"
          >
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
          <h2 className="text-2xl font-bold text-slate-800">Publish Campaign</h2>
          <button className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700">
            Finalize & Publish
          </button>
        </div>

        {/* Campaign Review Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Campaign Details */}
          <div className="lg:col-span-2 space-y-6">
            <div className="p-5 rounded-xl border bg-white shadow-sm">
              <h3 className="text-lg font-semibold text-slate-800">Campaign Summary</h3>
              <p className="text-sm text-slate-500 mt-1">
                Review your campaign details before publishing.
              </p>

              <div className="mt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-slate-700">Name:</span>
                  <span className="text-slate-600">Summer Sale 2025</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-slate-700">Platforms:</span>
                  <span className="text-slate-600">Facebook • Google Ads</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-slate-700">Budget:</span>
                  <span className="text-slate-600">$1,200</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-slate-700">Duration:</span>
                  <span className="text-slate-600">1 Jun 2025 → 30 Jun 2025</span>
                </div>
              </div>
            </div>

            {/* Preview Section */}
            <div className="p-5 rounded-xl border bg-white shadow-sm">
              <h3 className="text-lg font-semibold text-slate-800">Ad Preview</h3>
              <div className="mt-4 h-40 flex items-center justify-center bg-slate-100 rounded-lg text-slate-500">
                [Ad Creative Placeholder]
              </div>
            </div>
          </div>

          {/* Checklist */}
          <div className="space-y-6">
            <div className="p-5 rounded-xl border bg-white shadow-sm">
              <h3 className="text-lg font-semibold text-slate-800">Publishing Checklist</h3>
              <ul className="mt-4 space-y-3 text-sm">
                <li className="flex items-center">
                  ✅ <span className="ml-2">Campaign details completed</span>
                </li>
                <li className="flex items-center">
                  ✅ <span className="ml-2">Budget set</span>
                </li>
                <li className="flex items-center">
                  ⚠️ <span className="ml-2">Creative not finalized</span>
                </li>
              </ul>
            </div>

            <div className="p-5 rounded-xl border bg-white shadow-sm">
              <h3 className="text-lg font-semibold text-slate-800">Next Steps</h3>
              <p className="text-sm text-slate-600 mt-2">
                Once you publish, your campaign will go live on the selected platforms.
              </p>
              <button className="mt-4 w-full rounded-lg bg-blue-600 px-4 py-2 text-white font-medium hover:bg-blue-700">
                Publish Now
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
