import { useEffect, useState } from "react";
import Cookies from "js-cookie";
import { parse } from 'cookie';
interface MediaItem {
  id: string;
  media_url: string;
  caption?: string;
  permalink: string;
}

interface UserInfo {
  username: string;
  accountId: string;
}

export default function InstagramMediaPage() {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [newPost, setNewPost] = useState({ image_url: "", caption: "" });
  const [comment, setComment] = useState<{ [key: string]: string }>({});
  const [posting, setPosting] = useState(false);
  const [commenting, setCommenting] = useState<{ [key: string]: boolean }>({});

  // Fetch user info from cookies
  useEffect(() => {
    const username = Cookies.get("ig_username");
    const accountId = Cookies.get("ig_acctid");
    if (username && accountId) {
      setUser({ username, accountId });
    }
  }, []);

  // Fetch media from API
  useEffect(() => {
    const fetchMedia = async () => {
      try {
        const res = await fetch("/api/auth/instagram/media");
        const json = await res.json();
        if (!res.ok) {
          setError(json.error || "Failed to fetch media");
        } else {
          setMedia(json.data || []);
        }
      } catch (err) {
        console.error(err);
        setError("Failed to fetch media");
      }
    };
    fetchMedia();
  }, []);

  // Handle creating a new post
  const handlePost = async () => {
    if (!newPost.image_url) return alert("Image URL required");
    setPosting(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/instagram/post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newPost),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to post");
      }
      // On success, maybe refresh media or prepend
      if (data.post_id) {
        // Option: fetch media again to get latest
        setMedia(prev => [{ id: data.post_id, media_url: newPost.image_url, caption: newPost.caption, permalink: "" }, ...prev]);
      }
      setNewPost({ image_url: "", caption: "" });
    } catch (err: any) {
      console.error(err);
      setError(err.message);
    } finally {
      setPosting(false);
    }
  };

  // Handle posting a comment
  const handleComment = async (mediaId: string) => {
    if (!comment[mediaId]) return alert("Comment required");
    commenting[mediaId] = true;
    setCommenting({ ...commenting });
    setError(null);
    try {
      const res = await fetch("/api/auth/instagram/comment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ media_id: mediaId, message: comment[mediaId] }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to comment");
      }
      // Success
      alert("Comment posted!");
      setComment(prev => ({ ...prev, [mediaId]: "" }));
    } catch (err: any) {
      console.error(err);
      setError(err.message);
    } finally {
      commenting[mediaId] = false;
      setCommenting({ ...commenting });
    }
  };

  return (
    <div className="container mx-auto p-8">
      <h1 className="text-2xl font-bold mb-4">Instagram Media</h1>
      {error && <p className="text-red-600 mb-4">{error}</p>}

      {user && (
        <div className="mb-6 p-4 border rounded-md bg-gray-50">
          <p><strong>Username:</strong> {user.username}</p>
          <p><strong>Account ID:</strong> {user.accountId}</p>
        </div>
      )}

      {/* New Post Form */}
      <div className="mb-6 p-4 border rounded-md bg-gray-50">
        <h2 className="font-semibold mb-2">Create New Post</h2>
        <input
          type="text"
          placeholder="Image URL"
          value={newPost.image_url}
          onChange={(e) => setNewPost({ ...newPost, image_url: e.target.value })}
          className="border p-2 w-full mb-2"
        />
        <input
          type="text"
          placeholder="Caption"
          value={newPost.caption}
          onChange={(e) => setNewPost({ ...newPost, caption: e.target.value })}
          className="border p-2 w-full mb-2"
        />
        <button
          onClick={handlePost}
          disabled={posting}
          className={`px-4 py-2 rounded-md text-white ${posting ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'}`}
        >
          {posting ? 'Posting...' : 'Post'}
        </button>
      </div>

      {/* Media Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {media.map((post) => (
          <div key={post.id} className="border rounded-md overflow-hidden p-2">
            <a href={post.permalink} target="_blank" rel="noopener noreferrer">
              {post.media_url ? (
                <img
                  src={post.media_url}
                  alt={post.caption || "media"}
                  className="w-full h-auto"
                />
              ) : (
                <p>No media url</p>
              )}
            </a>
            {post.caption && <p className="text-sm mt-1">{post.caption}</p>}

            {/* Comment Input */}
            <div className="mt-2">
              <input
                type="text"
                placeholder="Add a comment..."
                value={comment[post.id] || ""}
                onChange={(e) => setComment({ ...comment, [post.id]: e.target.value })}
                className="border p-1 w-full mb-1"
              />
              <button
                onClick={() => handleComment(post.id)}
                disabled={commenting[post.id]}
                className={`px-2 py-1 rounded-md text-white ${commenting[post.id] ? 'bg-gray-400' : 'bg-green-600 hover:bg-green-700'}`}
              >
                {commenting[post.id] ? 'Commenting...' : 'Comment'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}