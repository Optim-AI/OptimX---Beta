// pages/settings.tsx
import Link from "next/link";

export default function Settings() {
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
          <Link href="/integrations" className="block px-3 py-2 rounded-lg hover:bg-slate-100">
            🔗 Integrations
          </Link>
          <Link href="/notifications" className="block px-3 py-2 rounded-lg hover:bg-slate-100">
            🔔 Notifications
          </Link>
          <Link
            href="/settings"
            className="block px-3 py-2 rounded-lg bg-blue-50 text-blue-700 font-medium"
          >
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
        <h2 className="text-2xl font-bold text-slate-800 mb-6">Settings</h2>

        {/* Tabs */}
        <div className="border-b mb-6">
          <nav className="flex space-x-6 text-sm font-medium">
            <button className="px-3 py-2 text-blue-600 border-b-2 border-blue-600">
              Profile
            </button>
            <button className="px-3 py-2 text-slate-600 hover:text-slate-800">
              Business
            </button>
            <button className="px-3 py-2 text-slate-600 hover:text-slate-800">
              Billing
            </button>
            <button className="px-3 py-2 text-slate-600 hover:text-slate-800">
              Team
            </button>
            <button className="px-3 py-2 text-slate-600 hover:text-slate-800">
              Notifications
            </button>
          </nav>
        </div>

        {/* Profile Information */}
        <div className="p-6 bg-white rounded-xl border shadow-sm w-full max-w-xl">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Profile Information</h3>

          <form className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700">Full Name</label>
              <input
                type="text"
                defaultValue="Sarah Chen"
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-blue-500 focus:ring focus:ring-blue-200"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">Email</label>
              <input
                type="email"
                defaultValue="sarah@company.com"
                className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-blue-500 focus:ring focus:ring-blue-200"
              />
            </div>

            <button
              type="submit"
              className="mt-2 px-4 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700"
            >
              Save Changes
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}
