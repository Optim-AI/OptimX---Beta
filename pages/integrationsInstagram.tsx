// pages/integrationsInstagram.tsx
import { useEffect, useState } from "react";

export default function IntegrationsInstagram() {
  const [me, setMe] = useState<any>(null);
  const [imageUrl, setImageUrl] = useState("");
  const [caption, setCaption] = useState("");
  const [mediaIdForComment, setMediaIdForComment] = useState("");
  const [comment, setComment] = useState("");
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
      body: JSON.stringify({ image_url: imageUrl, caption })
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
      body: JSON.stringify({ mediaId: mediaIdForComment, message: comment })
    });
    const j = await r.json();
    setResult(j);
  }

  return (
    <div className="min-h-screen p-6 bg-gray-50">
      <div className="max-w-3xl mx-auto bg-white p-6 rounded-xl shadow">
        <h2 className="text-2xl font-semibold mb-4">Instagram Integration</h2>

        <div className="mb-6">
          {me?.connected ? (
            <div>
              <p className="text-sm">Connected to Page ID: <strong>{me.pageId}</strong></p>
              <p className="text-sm">IG User ID: <strong>{me.igUserId}</strong></p>
            </div>
          ) : (
            <div>
              <p className="text-sm">Not connected. Click connect on Integrations page.</p>
            </div>
          )}
        </div>

        <form onSubmit={handlePost} className="mb-6">
          <h3 className="font-medium mb-2">Create a Post (image URL)</h3>
          <input value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder="https://..." className="w-full p-2 border rounded mb-2"/>
          <textarea value={caption} onChange={e => setCaption(e.target.value)} placeholder="Caption" className="w-full p-2 border rounded mb-2"/>
          <button className="px-4 py-2 bg-blue-600 text-white rounded">Post Image</button>
        </form>

        <form onSubmit={handleComment} className="mb-6">
          <h3 className="font-medium mb-2">Create a Comment</h3>
          <input value={mediaIdForComment} onChange={e => setMediaIdForComment(e.target.value)} placeholder="IG media id (e.g. 179...)" className="w-full p-2 border rounded mb-2"/>
          <input value={comment} onChange={e => setComment(e.target.value)} placeholder="Comment text" className="w-full p-2 border rounded mb-2"/>
          <button className="px-4 py-2 bg-green-600 text-white rounded">Post Comment</button>
        </form>

        <div>
          <h4 className="font-medium mb-2">Result</h4>
          <pre className="bg-gray-100 p-3 rounded max-h-64 overflow-auto text-xs">{JSON.stringify(result, null, 2)}</pre>
        </div>
      </div>
    </div>
  );
}
