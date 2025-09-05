import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Sidebar from '../app/web/src/components/Sidebar';
export default function CreateCampaignPreview() {
  const router = useRouter();
  const [preview, setPreview] = useState<{
    inputs: any;
    output: any;
    image: string;
  } | null>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem("preview");
    if (!raw) {
      router.push("/create-campaign");
      return;
    }
    setPreview(JSON.parse(raw));
  }, [router]);

  if (!preview) return <div className="min-h-screen flex items-center justify-center">Loading…</div>;

  const { inputs, output, image } = preview;

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Sidebar */}
      <Sidebar />

      {/* Main */}
      <div className="flex-1 p-8">
        <h2 className="text-2xl font-bold mb-1">Campaign Preview</h2>
        <p className="text-slate-500 mb-6">Review your campaign before confirming.</p>

        {/* Progress */}
        <div className="w-full bg-slate-200 h-2 rounded mb-8">
          <div className="bg-blue-600 h-2 w-2/3 rounded" />
        </div>

        <div className="space-y-8 max-w-3xl">
          <div className="bg-white rounded-xl shadow p-6 space-y-4">
            <h3 className="font-semibold flex items-center gap-2">📑 Campaign Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-slate-500">Campaign Name</p>
                <p className="font-medium">{inputs.name}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Target Audience</p>
                <p className="font-medium">{inputs.audience}</p>
              </div>
            </div>
            <div>
              <p className="text-xs text-slate-500">Campaign Type</p>
              <p className="font-medium">{inputs.campaignType}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Brand Voice</p>
              <p className="font-medium">{inputs.brandVoice}</p>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow p-6 space-y-4">
            <h3 className="font-semibold">🖼️ Content Type</h3>
            <div className="grid grid-cols-2 gap-4">
              {inputs.contentTypes.map((ct: string) => (
                <div key={ct} className="border rounded-lg p-4">
                  <p className="font-medium">{ct}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow p-6 space-y-4">
            <h3 className="font-semibold">✨ Vision</h3>
            <p className="text-slate-700">{inputs.vision}</p>
          </div>

          <div className="bg-white rounded-xl shadow p-6 space-y-4">
            <h3 className="font-semibold">Generated Visual</h3>
            <img src={image} alt="Generated Campaign Visual" className="w-full max-w-md rounded" />
          </div>

          <div className="bg-white rounded-xl shadow p-6 space-y-4">
            <h3 className="font-semibold">Caption & Copy</h3>
            <pre className="whitespace-pre-wrap bg-slate-100 p-4 rounded">
              {JSON.stringify(output, null, 2)}
            </pre>
          </div>

          <div className="flex justify-between">
            <Link
              href="/create-campaign"
              className="px-4 py-2 rounded-lg border text-slate-600 hover:bg-slate-100"
            >
              Back
            </Link>
            <button
              onClick={() => router.push("/create-campaign-finalize")}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
            >
              Finalize Campaign →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
