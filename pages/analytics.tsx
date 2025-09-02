// pages/analytics.tsx
import Link from "next/link";
import { AlertCircle, Eye, MousePointer, TrendingUp, DollarSign, BarChart3 } from "lucide-react";
import Sidebar from '../app/web/src/components/Sidebar';
export default function Analytics() {
  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <main className="flex-1 p-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-slate-800">AI Insights</h2>
          <div className="flex items-center gap-3">
            <button className="px-3 py-2 text-sm rounded-lg border border-slate-300 hover:bg-slate-100">
              Filters
            </button>
            <button className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700">
              Generate Report
            </button>
          </div>
        </div>

        {/* This Week's Performance */}
        <h3 className="text-lg font-semibold text-slate-700 mb-3">This Week’s Performance</h3>
        <div className="grid grid-cols-5 gap-4 mb-8">
          <div className="p-4 bg-white rounded-xl shadow flex flex-col">
            <span className="text-sm text-slate-500">Total Spend</span>
            <span className="text-xl font-bold text-slate-800">₹8,450</span>
            <span className="text-green-600 text-xs mt-1">+12.5%</span>
          </div>
          <div className="p-4 bg-white rounded-xl shadow flex flex-col">
            <span className="text-sm text-slate-500">Total Reach</span>
            <span className="text-xl font-bold text-slate-800">89.2k</span>
            <span className="text-green-600 text-xs mt-1">+24.1%</span>
          </div>
          <div className="p-4 bg-white rounded-xl shadow flex flex-col">
            <span className="text-sm text-slate-500">Avg CTR</span>
            <span className="text-xl font-bold text-slate-800">2.4%</span>
            <span className="text-green-600 text-xs mt-1">+0.3%</span>
          </div>
          <div className="p-4 bg-white rounded-xl shadow flex flex-col">
            <span className="text-sm text-slate-500">Conversions</span>
            <span className="text-xl font-bold text-slate-800">127</span>
            <span className="text-red-600 text-xs mt-1">-5.2%</span>
          </div>
          <div className="p-4 bg-white rounded-xl shadow flex flex-col">
            <span className="text-sm text-slate-500">ROAS</span>
            <span className="text-xl font-bold text-slate-800">3.2x</span>
            <span className="text-green-600 text-xs mt-1">+0.4x</span>
          </div>
        </div>

        {/* Smart Recommendations */}
        <h3 className="text-lg font-semibold text-slate-700 mb-3">Smart Recommendations</h3>
        <div className="space-y-4">
          {/* Card 1 */}
          <div className="p-5 bg-white rounded-xl shadow border-l-4 border-blue-500">
            <div className="flex justify-between items-start">
              <div>
                <h4 className="font-semibold text-slate-800 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-blue-500" />
                  Boost Instagram Performance
                </h4>
                <p className="text-sm text-slate-600 mt-1">
                  Your Instagram ads show 30% higher engagement. Consider reallocating ₹2,000 from Facebook for better ROI.
                </p>
                <div className="flex gap-3 mt-3">
                  <button className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200">Adjust Budget</button>
                  <button className="px-3 py-1 text-sm border rounded-lg hover:bg-slate-100">Learn More</button>
                </div>
              </div>
              <span className="text-xs font-medium text-white bg-red-500 px-2 py-1 rounded">High Impact</span>
            </div>
          </div>

          {/* Card 2 */}
          <div className="p-5 bg-white rounded-xl shadow border-l-4 border-purple-500">
            <div className="flex justify-between items-start">
              <div>
                <h4 className="font-semibold text-slate-800 flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-purple-500" />
                  Festival Season Opportunity
                </h4>
                <p className="text-sm text-slate-600 mt-1">
                  Analysis suggests 40% budget increase next week could push ROAS to 3.8x during Diwali season.
                </p>
                <div className="flex gap-3 mt-3">
                  <button className="px-3 py-1 text-sm bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200">Plan Campaign</button>
                  <button className="px-3 py-1 text-sm border rounded-lg hover:bg-slate-100">Learn More</button>
                </div>
              </div>
              <span className="text-xs font-medium text-white bg-orange-400 px-2 py-1 rounded">Medium Impact</span>
            </div>
          </div>

          {/* Card 3 */}
          <div className="p-5 bg-white rounded-xl shadow border-l-4 border-indigo-500">
            <div className="flex justify-between items-start">
              <div>
                <h4 className="font-semibold text-slate-800 flex items-center gap-2">
                  <MousePointer className="w-5 h-5 text-indigo-500" />
                  Creative Refresh Needed
                </h4>
                <p className="text-sm text-slate-600 mt-1">
                  Summer Sale campaign CTR declined 15% over 3 days. Fresh creatives may restore performance.
                </p>
                <div className="flex gap-3 mt-3">
                  <button className="px-3 py-1 text-sm bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200">Update Creative</button>
                  <button className="px-3 py-1 text-sm border rounded-lg hover:bg-slate-100">Learn More</button>
                </div>
              </div>
              <span className="text-xs font-medium text-white bg-red-500 px-2 py-1 rounded">High Impact</span>
            </div>
          </div>

          {/* Card 4 */}
          <div className="p-5 bg-white rounded-xl shadow border-l-4 border-teal-500">
            <div className="flex justify-between items-start">
              <div>
                <h4 className="font-semibold text-slate-800 flex items-center gap-2">
                  <Eye className="w-5 h-5 text-teal-500" />
                  Optimal Posting Time
                </h4>
                <p className="text-sm text-slate-600 mt-1">
                  Your audience is most active at 7–9 PM. Schedule posts during this window for better reach.
                </p>
                <div className="flex gap-3 mt-3">
                  <button className="px-3 py-1 text-sm bg-teal-100 text-teal-700 rounded-lg hover:bg-teal-200">Schedule Posts</button>
                  <button className="px-3 py-1 text-sm border rounded-lg hover:bg-slate-100">Learn More</button>
                </div>
              </div>
              <span className="text-xs font-medium text-white bg-gray-500 px-2 py-1 rounded">Low Impact</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
