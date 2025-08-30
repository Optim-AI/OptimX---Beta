// pages/dashboard.tsx
import { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabaseClient';

export default function Dashboard() {
  const router = useRouter();

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser(); // fetch current user :contentReference[oaicite:0]{index=0}
      if (!user) {
        router.replace('/auth/signin');
        return;
      }

      const { data: profile, error: profileErr } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .single();

      if (profileErr && (profileErr as any).code !== 'PGRST116') {
        console.error('Error fetching profile:', profileErr.message);
      }

      if (!profile) {
        const metaName = (user.user_metadata as any)?.full_name
          || (user.user_metadata as any)?.name
          || '';
        const metaBiz = (user.user_metadata as any)?.business_name || '';

        await supabase.from('profiles').insert([{
          id: user.id,
          full_name: metaName,
          business_name: metaBiz,
          email: user.email,
        }]).select(); // appends .select() to return data if needed :contentReference[oaicite:1]{index=1}
      }
    })();
  }, [router]);

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Sidebar */}
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

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        <header className="flex items-center justify-between bg-white shadow px-6 py-4">
          <h2 className="text-lg font-medium">Welcome to OptimAI, ssn! 👋</h2>
          <div className="flex items-center gap-6">
            <div className="text-right">
              <p className="text-blue-600 font-medium">₹12.4k</p>
              <p className="text-xs text-slate-500">This Month</p>
            </div>
            <div className="text-right">
              <p className="text-green-600 font-medium">2.4x</p>
              <p className="text-xs text-slate-500">Avg ROAS</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-slate-200 flex items-center justify-center">👤</div>
              <span className="text-slate-700 text-sm">Ssn</span>
              <button className="ml-3 text-xs text-red-600 hover:underline">Logout</button>
            </div>
          </div>
        </header>

        <main className="flex-1 p-6 space-y-6">
          <div className="rounded-xl bg-white p-6 shadow">
            <h3 className="text-lg font-semibold">Ready to create your first campaign?</h3>
            <p className="text-slate-500 mt-1">
              Our AI will help you create professional marketing content in minutes.
            </p>
            <div className="flex gap-4 mt-4">
              <span className="text-sm text-slate-600">⚡ AI-powered content</span>
              <span className="text-sm text-slate-600">📱 Multi-platform publishing</span>
              <span className="text-sm text-slate-600">📊 Real-time analytics</span>
            </div>
            <button
              onClick={() => router.push('/create-campaign')}
              className="mt-6 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
            >
              Create Your First Campaign
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 rounded-xl bg-white p-6 shadow">
              <h3 className="font-medium text-lg mb-3">Getting Started Guide</h3>
              <ol className="space-y-2 text-slate-700">
                <li>1️⃣ Create your first campaign with AI</li>
                <li>2️⃣ Connect your social media accounts</li>
                <li>3️⃣ Launch and monitor your campaigns</li>
              </ol>
            </div>
            <div className="space-y-6">
              <div className="rounded-xl bg-white p-6 shadow">
                <h4 className="font-medium text-sm">Complete your profile</h4>
                <p className="text-xs text-slate-500 mt-1">
                  Add your business details to get personalized campaign recommendations.
                </p>
                <button className="mt-3 text-xs text-blue-600 hover:underline">
                  Update Profile →
                </button>
              </div>
              <div className="rounded-xl bg-white p-6 shadow">
                <h4 className="font-medium text-sm">Connect social accounts</h4>
                <p className="text-xs text-slate-500 mt-1">
                  Link Instagram and Facebook to start publishing campaigns.
                </p>
                <button className="mt-3 text-xs text-blue-600 hover:underline">
                  Connect Accounts →
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-xl bg-white p-6 shadow">
            <h3 className="font-medium text-lg">Your Campaigns</h3>
            <p className="text-slate-500 mt-2">
              No campaigns yet. Start by creating one below.
            </p>
            <button
              onClick={() => router.push('/create-campaign')}
              className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
            >
              + Create Campaign
            </button>
          </div>
        </main>
      </div>
    </div>
  );
}
