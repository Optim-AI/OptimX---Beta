import Link from "next/link";
import { useRouter } from "next/navigation";
export default function CreateCampaignFinalize() {
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
          <Link href="/create-campaign-finalize" className="block px-3 py-2 rounded-lg hover:bg-slate-100">
            ✅ Finalize Campaign
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
        <h2 className="text-2xl font-bold mb-1">Finalize Campaign</h2>
        <p className="text-slate-500 mb-6">
          Review everything and finalize your campaign for publishing.
        </p>

        {/* Progress */}
        <div className="w-full bg-slate-200 h-2 rounded mb-8">
          <div className="bg-blue-600 h-2 w-full rounded" />
        </div>

        <div className="space-y-8 max-w-3xl">
          {/* Confirmation Summary */}
          <div className="bg-white rounded-xl shadow p-6 space-y-4">
            <h3 className="font-semibold flex items-center gap-2">
              ✅ Final Campaign Summary
            </h3>
            <p className="text-slate-700">
              Your campaign is ready! Please confirm the details below before publishing.
            </p>
            <ul className="list-disc pl-5 space-y-1 text-slate-600 text-sm">
              <li>Campaign: <span className="font-medium">Summer Flash Sale</span></li>
              <li>Audience: <span className="font-medium">Young Professionals</span></li>
              <li>Content: <span className="font-medium">Posters + Captions</span></li>
              <li>Vision: <span className="font-medium">Bold, Energetic, Fun</span></li>
            </ul>
          </div>

          {/* Actions */}
          <div className="flex justify-between">
            <Link
              href="/create-campaign-preview"
              className="px-4 py-2 rounded-lg border text-slate-600 hover:bg-slate-100"
            >
              Back
            </Link>
            <button onClick={() => router.push("/dashboard")} className="px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700">
              🚀 Publish Campaign
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
