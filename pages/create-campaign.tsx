import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Sidebar from '../app/web/src/components/Sidebar';

export default function CreateCampaign() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [audience, setAudience] = useState("");
  const [campaignType, setCampaignType] = useState("");
  const [brandVoice, setBrandVoice] = useState("");
  const [contentTypes, setContentTypes] = useState<string[]>([]);
  const [vision, setVision] = useState("");
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false); // for AI helper

  const toggleContentType = (t: string) => {
    setContentTypes(prev =>
      prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]
    );
  };

  const handleGenerate = async () => {
    if (!name || !vision || contentTypes.length === 0) {
      alert("Please fill in Campaign Name, Vision, and pick at least one content type.");
      return;
    }
    setLoading(true);
    try {
      const payload = { name, audience, campaignType, brandVoice, contentTypes, vision };
      const resp = await fetch("/api/generate-campaign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await resp.json();
      if (!data.ok) throw new Error(data.error || "API failed");

      sessionStorage.setItem(
        "preview",
        JSON.stringify({ inputs: payload, output: data.copy, image: data.image })
      );
      router.push("/create-campaign-preview");
    } catch (err: any) {
      alert("Generation failed: " + (err.message || err));
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // ✅ New AI helper function
  const handleAiAssist = async () => {
    if (!vision) {
      alert("Please type something first for AI assistance.");
      return;
    }
    setAiLoading(true);
    try {
      const resp = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer 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"
        },
        body: JSON.stringify({
          model: "gpt-3.5-turbo", // or gpt-4
          messages: [
            {
              role: "system",
              content: "You are an assistant helping users describe a campaign image clearly and creatively."
            },
            {
              role: "user",
              content: vision
            }
          ],
          temperature: 0.7,
          max_tokens: 150
        })
      });

      const data = await resp.json();
      if (data?.choices?.[0]?.message?.content) {
        setVision(data.choices[0].message.content);
      } else {
        alert("AI assistance failed. Try again.");
      }
    } catch (err: any) {
      console.error(err);
      alert("AI assistance error: " + (err.message || err));
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-slate-50">
      <Sidebar />

      <div className="flex-1 p-8">
        <h2 className="text-2xl font-bold mb-1">Create AI Campaign</h2>
        <p className="text-slate-500 mb-6">
          Describe your vision and let the free Pollinations image service generate a visual.
        </p>

        <div className="w-full bg-slate-200 h-2 rounded mb-8">
          <div className="bg-blue-600 h-2 w-1/3 rounded" />
        </div>

        <div className="space-y-8 max-w-3xl">
          {/* Campaign Info */}
          <div className="bg-white rounded-xl shadow p-6 space-y-4">
            <h3 className="font-semibold flex items-center gap-2">📑 Campaign Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <input
                placeholder="Campaign Name *"
                value={name}
                onChange={e => setName(e.target.value)}
                className="border rounded-lg px-3 py-2"
              />
              <input
                placeholder="Target Audience"
                value={audience}
                onChange={e => setAudience(e.target.value)}
                className="border rounded-lg px-3 py-2"
              />
            </div>
            <div>
              <p className="text-sm font-medium mb-2">Campaign Type *</p>
              <div className="grid grid-cols-2 gap-2">
                {["Flash Sale", "Product Launch", "Festival Promotion", "Brand Awareness"].map(t => (
                  <button
                    key={t}
                    onClick={() => setCampaignType(t)}
                    className={`px-3 py-2 border rounded-lg ${campaignType === t ? "bg-blue-50" : ""}`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-sm font-medium mb-2">Brand Voice</p>
              <div className="flex gap-2 flex-wrap">
                {["Professional", "Friendly", "Energetic", "Luxury"].map(v => (
                  <button
                    key={v}
                    onClick={() => setBrandVoice(v)}
                    className={`px-3 py-1 border rounded-lg ${brandVoice === v ? "bg-blue-50" : ""}`}
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
                { title: "Video Content", desc: "Dynamic video ads" },
                { title: "Caption & Copy", desc: "Compelling text and hashtags" },
                { title: "Email Campaign", desc: "Professional email templates" },
              ].map(item => (
                <button
                  key={item.title}
                  onClick={() => toggleContentType(item.title)}
                  className={`border rounded-lg p-4 text-left ${contentTypes.includes(item.title) ? "bg-blue-50" : ""}`}
                >
                  <p className="font-medium">{item.title}</p>
                  <p className="text-xs text-slate-500">{item.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Vision */}
          <div className="bg-white rounded-xl shadow p-6 space-y-4">
            <h3 className="font-semibold">✨ Describe Your Vision *</h3>
            <textarea
              rows={4}
              placeholder="What do you want to create?"
              className="w-full border rounded-lg px-3 py-2"
              value={vision}
              onChange={e => setVision(e.target.value)}
            />
            <button
              onClick={handleAiAssist}
              disabled={aiLoading}
              className="px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700"
            >
              {aiLoading ? "Generating..." : "AI Assist Description"}
            </button>
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
            <button
              onClick={handleGenerate}
              disabled={loading}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
            >
              {loading ? "Generating..." : "Generate Content →"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
