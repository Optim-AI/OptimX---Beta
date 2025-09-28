// pages/integrationsInstagram.tsx

import { useEffect, useState } from "react";

interface MeData {
  connected: boolean;
  pageId?: string;
  igUserId?: string;
  createdAt?: string;
}

export default function IntegrationsInstagram() {
  const [me, setMe] = useState<MeData | null>(null);

  const [imageUrl, setImageUrl] = useState("");
  const [caption, setCaption] = useState("");
  const [alsoPostToFacebook, setAlsoPostToFacebook] = useState(false);

  const [mediaIdForComment, setMediaIdForComment] = useState("");
  const [comment, setComment] = useState("");

  const [campaignName, setCampaignName] = useState("");
  const [dailyBudget, setDailyBudget] = useState("");
  const [adSetName, setAdSetName] = useState("");
  const [creativeImageUrl, setCreativeImageUrl] = useState("");
  const [creativeCaption, setCreativeCaption] = useState("");

  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    fetch("/api/auth/instagram/me")
      .then(r => r.json())
      .then(setMe);
  }, []);

  async function handlePost(e: React.FormEvent) {
    e.preventDefault();
    setResult(null);
    const r = await fetch("/api/auth/instagram/post", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        image_url: imageUrl,
        caption,
        alsoPostToFacebook,
      }),
    });
    const j = await r.json();
    setResult(j);
  }

  async function handleComment(e: React.FormEvent) {
    e.preventDefault();
    setResult(null);
    const r = await fetch("/api/auth/instagram/comment", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        mediaId: mediaIdForComment,
        message: comment,
      }),
    });
    const j = await r.json();
    setResult(j);
  }

  async function handleRunAd(e: React.FormEvent) {
    e.preventDefault();
    setResult(null);
    const r = await fetch("/api/auth/facebook/ads", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        campaignName,
        budget: Number(dailyBudget),
        adSetName,
        targeting: {}, // you may refine this later or allow user input
        creativeImageUrl,
        creativeCaption,
      }),
    });
    const j = await r.json();
    setResult(j);
  }

  return (
    <div className="min-h-screen p-6 bg-gray-50">
      <div className="max-w-3xl mx-auto bg-white p-6 rounded-xl shadow">
        <h2 className="text-2xl font-semibold mb-4">Instagram / Facebook Integration</h2>

        <div className="mb-6">
          {me?.connected ? (
            <div>
              <p className="text-sm">
                Connected to Page ID: <strong>{me.pageId}</strong>
              </p>
              <p className="text-sm">
                IG User ID: <strong>{me.igUserId}</strong>
              </p>
            </div>
          ) : (
            <div>
              <p className="text-sm">Not connected. Go to your Integrations page to connect.</p>
            </div>
          )}
        </div>

        <form onSubmit={handlePost} className="mb-6">
          <h3 className="font-medium mb-2">Create a Post (Image URL)</h3>
          <input
            value={imageUrl}
            onChange={e => setImageUrl(e.target.value)}
            placeholder="https://..."
            className="w-full p-2 border rounded mb-2"
          />
          <textarea
            value={caption}
            onChange={e => setCaption(e.target.value)}
            placeholder="Caption"
            className="w-full p-2 border rounded mb-2"
          />
          <label className="flex items-center mb-2">
            <input
              type="checkbox"
              checked={alsoPostToFacebook}
              onChange={e => setAlsoPostToFacebook(e.target.checked)}
              className="mr-2"
            />
            Also post to Facebook Page
          </label>
          <button className="px-4 py-2 bg-blue-600 text-white rounded">Post Image</button>
        </form>

        <form onSubmit={handleComment} className="mb-6">
          <h3 className="font-medium mb-2">Create a Comment</h3>
          <input
            value={mediaIdForComment}
            onChange={e => setMediaIdForComment(e.target.value)}
            placeholder="IG media ID (e.g. 179...)"
            className="w-full p-2 border rounded mb-2"
          />
          <input
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder="Comment text"
            className="w-full p-2 border rounded mb-2"
          />
          <button className="px-4 py-2 bg-green-600 text-white rounded">Post Comment</button>
        </form>

        <div className="mb-6">
          <h3 className="font-medium mb-2">Run an Ad</h3>
          <form onSubmit={handleRunAd}>
            <input
              value={campaignName}
              onChange={e => setCampaignName(e.target.value)}
              placeholder="Campaign Name"
              className="w-full p-2 border rounded mb-2"
            />
            <input
              value={dailyBudget}
              onChange={e => setDailyBudget(e.target.value)}
              placeholder="Daily Budget"
              type="number"
              className="w-full p-2 border rounded mb-2"
            />
            <input
              value={adSetName}
              onChange={e => setAdSetName(e.target.value)}
              placeholder="Ad Set Name"
              className="w-full p-2 border rounded mb-2"
            />
            <input
              value={creativeImageUrl}
              onChange={e => setCreativeImageUrl(e.target.value)}
              placeholder="Creative Image URL"
              className="w-full p-2 border rounded mb-2"
            />
            <textarea
              value={creativeCaption}
              onChange={e => setCreativeCaption(e.target.value)}
              placeholder="Creative Caption / Message"
              className="w-full p-2 border rounded mb-2"
            />
            <button className="px-4 py-2 bg-purple-600 text-white rounded">Create Ad</button>
          </form>
        </div>

        <div>
          <h4 className="font-medium mb-2">Result / Response</h4>
          <pre className="bg-gray-100 p-3 rounded max-h-64 overflow-auto text-xs">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
}
