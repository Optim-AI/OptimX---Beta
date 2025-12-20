// pages/publish.tsx
import Link from "next/link";
import Sidebar from "../app/web/src/components/Sidebar";

export default function Publish() {
  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Sidebar */}
      <Sidebar />

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
