// pages/create-campaign-preview.tsx
import Link from "next/link";
import { useRouter } from "next/navigation";
export default function CreateCampaignPreview() {
    const router = useRouter();
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
          <Link href="/create-campaign-preview" className="block px-3 py-2 rounded-lg hover:bg-slate-100">
            👀 Preview Campaign
          </Link>
          <Link href="#" className="block px-3 py-2 rounded-lg hover:bg-slate-100">
            🤖 AI Insights
          </Link>
          <Link href="#" className="block px-3 py-2 rounded-lg hover:bg-slate-100">
            📈 Analytics
          </Link>
          <Link href="#" className="block px-3 py-2 rounded-lg hover:bg-slate-100">
            📚 Campaign Library
          </Link>
          <Link href="#" className="block px-3 py-2 rounded-lg hover:bg-slate-100">
            📤 Publishing
          </Link>
          <Link href="#" className="block px-3 py-2 rounded-lg hover:bg-slate-100">
            🔗 Integrations
          </Link>
          <Link href="#" className="block px-3 py-2 rounded-lg hover:bg-slate-100">
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
      <div className="flex-1 p-8">
        <h2 className="text-2xl font-bold mb-1">Campaign Preview</h2>
        <p className="text-slate-500 mb-6">
          Review your campaign details before generating content.
        </p>

        {/* Progress */}
        <div className="w-full bg-slate-200 h-2 rounded mb-8">
          <div className="bg-blue-600 h-2 w-2/3 rounded" />
        </div>

        <div className="space-y-8 max-w-3xl">
          {/* Campaign Information */}
          <div className="bg-white rounded-xl shadow p-6 space-y-4">
            <h3 className="font-semibold flex items-center gap-2">
              📑 Campaign Information
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-slate-500">Campaign Name</p>
                <p className="font-medium">Summer Flash Sale</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Target Audience</p>
                <p className="font-medium">Young Professionals</p>
              </div>
            </div>
            <div>
              <p className="text-xs text-slate-500">Campaign Type</p>
              <p className="font-medium">Flash Sale</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Brand Voice</p>
              <p className="font-medium">Energetic</p>
            </div>
          </div>

          {/* Content Type */}
          <div className="bg-white rounded-xl shadow p-6 space-y-4">
            <h3 className="font-semibold">🖼️ Content Type</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="border rounded-lg p-4">
                <p className="font-medium">Social Media Poster</p>
                <p className="text-xs text-slate-500">
                  Eye-catching visual content
                </p>
              </div>
              <div className="border rounded-lg p-4">
                <p className="font-medium">Caption & Copy</p>
                <p className="text-xs text-slate-500">
                  Compelling text and hashtags
                </p>
              </div>
            </div>
          </div>

          {/* Vision */}
          <div className="bg-white rounded-xl shadow p-6 space-y-4">
            <h3 className="font-semibold">✨ Vision</h3>
            <p className="text-slate-700">
              Promote our summer collection with a high-energy flash sale
              campaign. Highlight discounts, limited-time offers, and exclusive
              bundles. Visuals should be bright, bold, and fun.
            </p>
            <p className="text-slate-500 text-sm">
              Additional: Focus on Instagram + TikTok audience.
            </p>
          </div>

          {/* Actions */}
          <div className="flex justify-between">
            <Link
              href="/create-campaign"
              className="px-4 py-2 rounded-lg border text-slate-600 hover:bg-slate-100"
            >
              Back
            </Link>
            <button onClick={() => router.push("/create-campaign-finalize")} className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700">
              Confirm & Generate →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
