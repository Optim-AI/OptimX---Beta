// pages/settings.tsx
import Link from "next/link";
import Sidebar from '../app/web/src/components/Sidebar';
export default function Settings() {
  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Sidebar */}
      <Sidebar />

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
