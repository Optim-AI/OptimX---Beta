// pages/insights.tsx
import Link from "next/link";
import { BarChart3, Clock, TrendingUp, Zap } from "lucide-react";

export default function Insights() {
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
          <Link
            href="/insights"
            className="block px-3 py-2 rounded-lg bg-blue-50 text-blue-700 font-medium"
          >
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
            className="w-full block text-center rounded-lg bg-blue-600 px-4 py-2 text-white font-medium hover:bg-blue-700 transition"
          >
            Start Campaign
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 p-8">
        <h2 className="text-2xl font-bold mb-1">AI Insights</h2>
        <p className="text-slate-500 mb-6">
          Get intelligent recommendations and performance predictions for your campaigns.
        </p>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow p-4 flex items-center gap-4">
            <Zap className="w-10 h-10 text-blue-600" />
            <div>
              <p className="text-sm text-slate-500">Predicted Engagement</p>
              <h3 className="text-lg font-semibold text-slate-800">+18%</h3>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow p-4 flex items-center gap-4">
            <Clock className="w-10 h-10 text-green-600" />
            <div>
              <p className="text-sm text-slate-500">Best Posting Window</p>
              <h3 className="text-lg font-semibold text-slate-800">6–9 PM</h3>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow p-4 flex items-center gap-4">
            <TrendingUp className="w-10 h-10 text-purple-600" />
            <div>
              <p className="text-sm text-slate-500">ROI Forecast</p>
              <h3 className="text-lg font-semibold text-slate-800">+25%</h3>
            </div>
          </div>
        </div>

        {/* Insight Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Engagement Boost */}
          <div className="bg-white rounded-xl shadow p-6 hover:shadow-lg transition">
            <h3 className="font-semibold mb-2 flex items-center gap-2">
              <Zap className="w-5 h-5 text-blue-600" /> Engagement Boost
            </h3>
            <p className="text-slate-600 text-sm mb-4">
              Posts with bold colors and clear CTAs can increase engagement by{" "}
              <span className="font-medium text-green-600">+18%</span>.
            </p>
            <button className="text-sm px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 transition">
              Apply Suggestion
            </button>
          </div>

          {/* Audience Timing */}
          <div className="bg-white rounded-xl shadow p-6 hover:shadow-lg transition">
            <h3 className="font-semibold mb-2 flex items-center gap-2">
              <Clock className="w-5 h-5 text-green-600" /> Best Posting Times
            </h3>
            <p className="text-slate-600 text-sm mb-4">
              Your audience is most active between{" "}
              <span className="font-medium">6–9 PM</span> on weekdays.
            </p>
            <button className="text-sm px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 transition">
              Schedule Posts
            </button>
          </div>

          {/* Trend Detection */}
          <div className="bg-white rounded-xl shadow p-6 hover:shadow-lg transition">
            <h3 className="font-semibold mb-2 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-purple-600" /> Trending Content
            </h3>
            <p className="text-slate-600 text-sm mb-4">
              Short-form videos with captions are trending in your niche. Adding
              them could boost reach by{" "}
              <span className="font-medium text-green-600">+25%</span>.
            </p>
            <button className="text-sm px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 transition">
              Add to Campaign
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
