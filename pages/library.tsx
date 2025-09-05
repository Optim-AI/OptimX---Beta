// pages/library.tsx
import Link from "next/link";
import Sidebar from "../app/web/src/components/Sidebar";

export default function Library() {
  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Sidebar */}
      <Sidebar />

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
