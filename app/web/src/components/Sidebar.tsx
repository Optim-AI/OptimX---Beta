// components/Sidebar.tsx
import Link from "next/link";
import { useRouter } from "next/router";

export default function Sidebar() {
  const router = useRouter();

  return (
    <aside className="w-64 bg-white shadow-lg flex flex-col">
      <div className="px-6 py-4 border-b">
        <h1 className="text-xl font-bold text-slate-800">OptimAI</h1>
        <p className="text-xs text-slate-500">Campaign Manager</p>
      </div>
      <nav className="flex-1 p-4 space-y-2 text-slate-700">
        <Link href="/dashboard" className="block px-3 py-2 rounded-lg hover:bg-slate-100">📊 Dashboard</Link>
        <Link href="/create-campaign" className="block px-3 py-2 rounded-lg hover:bg-slate-100">➕ Create Campaign</Link>
        <Link href="/insights" className="block px-3 py-2 rounded-lg hover:bg-slate-100">🤖 AI Insights</Link>
        <Link href="/analytics" className="block px-3 py-2 rounded-lg hover:bg-slate-100">📈 Analytics</Link>
        <Link href="/library" className="block px-3 py-2 rounded-lg hover:bg-slate-100">📚 Campaign Library</Link>
        <Link href="/publish" className="block px-3 py-2 rounded-lg hover:bg-slate-100">📤 Publishing</Link>
        <Link href="/integrations" className="block px-3 py-2 rounded-lg hover:bg-slate-100">🔗 Integrations</Link>
        <Link href="/notifications" className="block px-3 py-2 rounded-lg hover:bg-slate-100">🔔 Notifications</Link>
        <Link href="/settings" className="block px-3 py-2 rounded-lg hover:bg-slate-100">⚙️ Settings</Link>
      </nav>
      <div className="p-4 border-t">
        <button
          onClick={() => router.push('/create-campaign')}
          className="w-full rounded-lg bg-blue-600 px-4 py-2 text-white font-medium hover:bg-blue-700"
        >
          Start Campaign
        </button>
      </div>
    </aside>
  );
}
