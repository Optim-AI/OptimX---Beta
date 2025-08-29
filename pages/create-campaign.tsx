// pages/create-campaign.tsx
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function CreateCampaign() {
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
            🔔 Notifications
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
        <h2 className="text-2xl font-bold mb-1">Create AI Campaign</h2>
        <p className="text-slate-500 mb-6">
          Describe what you want and let AI create your perfect campaign content.
        </p>

        {/* Progress */}
        <div className="w-full bg-slate-200 h-2 rounded mb-8">
          <div className="bg-blue-600 h-2 w-1/3 rounded" />
        </div>

        <div className="space-y-8 max-w-3xl">
          {/* Campaign Information */}
          <div className="bg-white rounded-xl shadow p-6 space-y-4">
            <h3 className="font-semibold flex items-center gap-2">
              📑 Campaign Information
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <input
                placeholder="Campaign Name *"
                className="border rounded-lg px-3 py-2"
              />
              <input
                placeholder="Target Audience"
                className="border rounded-lg px-3 py-2"
              />
            </div>
            <div>
              <p className="text-sm font-medium mb-2">Campaign Type *</p>
              <div className="grid grid-cols-2 gap-2">
                {["Flash Sale", "Product Launch", "Festival Promotion", "Brand Awareness"].map((t) => (
                  <button
                    key={t}
                    className="px-3 py-2 border rounded-lg hover:bg-blue-50"
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-sm font-medium mb-2">Brand Voice</p>
              <div className="flex gap-2 flex-wrap">
                {["Professional", "Friendly", "Energetic", "Luxury"].map((v, i) => (
                  <button
                    key={i}
                    className="px-3 py-1 border rounded-lg hover:bg-blue-50"
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Content Type */}
          <div className="bg-white rounded-xl shadow p-6 space-y-4">
            <h3 className="font-semibold">🖼️ Content Type *</h3>
            <div className="grid grid-cols-2 gap-4">
              {[
                { title: "Social Media Poster", desc: "Eye-catching visual content" },
                { title: "Video Content", desc: "Dynamic video advertisements" },
                { title: "Caption & Copy", desc: "Compelling text and hashtags" },
                { title: "Email Campaign", desc: "Professional email templates" },
              ].map((item) => (
                <button
                  key={item.title}
                  className="border rounded-lg p-4 text-left hover:bg-blue-50"
                >
                  <p className="font-medium">{item.title}</p>
                  <p className="text-xs text-slate-500">{item.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Describe Vision */}
          <div className="bg-white rounded-xl shadow p-6 space-y-4">
            <h3 className="font-semibold">✨ Describe Your Vision *</h3>
            <textarea
              rows={4}
              placeholder="What do you want to create?"
              className="w-full border rounded-lg px-3 py-2"
            />
            <textarea
              rows={2}
              placeholder="Additional Requirements (Optional)"
              className="w-full border rounded-lg px-3 py-2"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-between">
            <Link
              href="/dashboard"
              className="px-4 py-2 rounded-lg border text-slate-600 hover:bg-slate-100"
            >
              Cancel
            </Link>
            <button onClick={() => router.push("/create-campaign-preview")} className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700">
              Generate Content →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
