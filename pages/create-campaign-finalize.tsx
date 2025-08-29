import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function CreateCampaignFinalize() {
  const router = useRouter();
  const [preview, setPreview] = useState<any | null>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem("preview");
    if (!raw) {
      router.push("/create-campaign");
      return;
    }
    setPreview(JSON.parse(raw));
  }, [router]);

  if (!preview) {
    return <div className="min-h-screen flex items-center justify-center">Loading…</div>;
  }

  const { inputs, output, image } = preview;

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
          <Link href="/create-campaign-preview" className="block px-3 py-2 rounded-lg hover:bg-slate-100">👀 Preview Campaign</Link>
          <Link href="/create-campaign-finalize" className="block px-3 py-2 rounded-lg hover:bg-slate-100">✅ Finalize Campaign</Link>
        </nav>
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
        <p className="text-slate-500 mb-6">Last chance—review and confirm your campaign before publishing.</p>

        {/* Progress */}
        <div className="w-full bg-slate-200 h-2 rounded mb-8">
          <div className="bg-blue-600 h-2 w-full rounded" />
        </div>

        <div className="space-y-8 max-w-3xl">
          {/* Final Summary */}
          <div className="bg-white rounded-xl shadow p-6 space-y-4">
            <h3 className="font-semibold flex items-center gap-2">✅ Final Campaign Summary</h3>
            <ul className="list-disc pl-5 text-slate-600 text-sm">
              <li>Campaign: <span className="font-medium">{inputs.name}</span></li>
              <li>Audience: <span className="font-medium">{inputs.audience}</span></li>
              <li>Type: <span className="font-medium">{inputs.campaignType}</span></li>
              <li>Brand Voice: <span className="font-medium">{inputs.brandVoice}</span></li>
              <li>Content Types: <span className="font-medium">{inputs.contentTypes.join(", ")}</span></li>
              <li>Vision: <span className="font-medium">{inputs.vision}</span></li>
            </ul>
          </div>

          {/* Generated Visual */}
          <div className="bg-white rounded-xl shadow p-6 space-y-4">
            <h3 className="font-semibold">Generated Visual</h3>
            {image ? (
              <img src={image} alt="Generated Campaign Visual" className="w-full max-w-md rounded" />
            ) : (
              <p>No image available</p>
            )}
          </div>

          {/* Generated Copy */}
          <div className="bg-white rounded-xl shadow p-6 space-y-4">
            <h3 className="font-semibold">Generated Copy</h3>
            <pre className="whitespace-pre-wrap bg-slate-100 p-4 rounded">
              {JSON.stringify(output, null, 2)}
            </pre>
          </div>

          {/* Actions */}
          <div className="flex justify-between">
            <Link
              href="/create-campaign-preview"
              className="px-4 py-2 rounded-lg border text-slate-600 hover:bg-slate-100"
            >
              Back
            </Link>
            <button
              onClick={() => router.push("/dashboard")}
              className="px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700"
            >
              🚀 Publish Campaign
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
