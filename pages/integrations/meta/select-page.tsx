// pages/integrations/meta/select-page.tsx
import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import dynamic from "next/dynamic";
import type { FacebookPage } from '@/integrations/meta/oauth-session';

function SelectFacebookPageComponent() {
  const router = useRouter();
  const sessionId = router.query.sessionId as string | undefined;

  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) return;

    // Fetch OAuth session
    fetch(`/api/meta/oauth/session?sessionId=${sessionId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setError(data.message || "Session not found or expired");
        } else {
          setSession(data);
        }
      })
      .catch((err) => {
        console.error("Failed to load session:", err);
        setError("Failed to load session data");
      })
      .finally(() => setLoading(false));
  }, [sessionId]);

  const handleSelectPage = async (pageId: string) => {
    setSelecting(true);
    setSelectedPageId(pageId);

    try {
      const res = await fetch(`/api/meta/oauth/finalize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, pageId }),
      });

      const data = await res.json();

      if (data.success) {
        // Success! Redirect to integrations with success message
        router.push(`/integrations?connected=meta&status=success&page=${encodeURIComponent(data.integration.pageName)}`);
      } else {
        throw new Error(data.message || "Failed to finalize integration");
      }
    } catch (err: any) {
      console.error("Failed to finalize:", err);
      alert(`Failed to connect page: ${err.message}. Please try again.`);
      setSelecting(false);
      setSelectedPageId(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600">Loading your Facebook Pages...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <div className="text-red-500 text-5xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold mb-4 text-gray-900">Session Error</h1>
          <p className="text-gray-700 mb-6">{error}</p>
          <button
            onClick={() => router.push("/integrations")}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Back to Integrations
          </button>
        </div>
      </div>
    );
  }

  if (!session?.pages?.length) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <div className="text-amber-500 text-5xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold mb-4 text-gray-900">No Pages Found</h1>
          <p className="text-gray-700 mb-6">
            No Facebook Pages were found in this session.
          </p>
          <button
            onClick={() => router.push("/integrations")}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Back to Integrations
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Select Facebook Page
          </h1>
          <p className="text-gray-600">
            Choose which Facebook Page to connect to OptimX
          </p>
          <p className="text-sm text-gray-500 mt-2">
            Found {session.pages.length} page{session.pages.length !== 1 ? "s" : ""}
          </p>
        </div>

        {/* Page Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-2 mb-8">
          {session.pages.map((page: FacebookPage) => (
            <PageCard
              key={page.id}
              page={page}
              onSelect={handleSelectPage}
              disabled={selecting}
              isSelected={selectedPageId === page.id}
            />
          ))}
        </div>

        {/* Footer */}
        <div className="text-center">
          <button
            onClick={() => router.push("/integrations")}
            className="text-gray-600 hover:text-gray-800 underline"
            disabled={selecting}
          >
            Cancel and return to integrations
          </button>
        </div>
      </div>
    </div>
  );
}

interface PageCardProps {
  page: FacebookPage;
  onSelect: (pageId: string) => void;
  disabled: boolean;
  isSelected: boolean;
}

function PageCard({ page, onSelect, disabled, isSelected }: PageCardProps) {
  const hasInstagram = !!page.instagram_business_account;
  const canManage = page.tasks?.includes("MANAGE") ?? true;

  return (
    <div
      className={`bg-white border rounded-lg p-6 transition-all ${
        isSelected
          ? "border-blue-500 ring-2 ring-blue-200"
          : "border-gray-200 hover:shadow-lg"
      }`}
    >
      {/* Header with avatar and name */}
      <div className="flex items-start gap-4 mb-4">
        <img
          src={`https://graph.facebook.com/${page.id}/picture?type=large`}
          alt={page.name}
          className="w-16 h-16 rounded-full border-2 border-gray-200"
          onError={(e) => {
            // Fallback to default avatar on error
            e.currentTarget.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='64' height='64'%3E%3Crect fill='%23ddd' width='64' height='64'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-size='24' fill='%23999'%3E?%3C/text%3E%3C/svg%3E";
          }}
        />
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-lg text-gray-900 truncate">
            {page.name}
          </h3>
          {page.category && (
            <p className="text-sm text-gray-600">{page.category}</p>
          )}
        </div>
      </div>

      {/* Status indicators */}
      <div className="space-y-2 mb-4">
        <StatusBadge
          icon={hasInstagram ? "✓" : "✗"}
          label="Instagram Connected"
          variant={hasInstagram ? "success" : "warning"}
        />
        <StatusBadge
          icon={canManage ? "✓" : "✗"}
          label="Can Publish Posts"
          variant={canManage ? "success" : "error"}
        />
      </div>

      {/* Warnings */}
      {!canManage && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-800">
          ⚠️ You don't have publishing permissions for this page
        </div>
      )}

      {!hasInstagram && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded text-sm text-blue-800">
          ℹ️ Instagram features will be unavailable until you connect an Instagram
          Business account to this page
        </div>
      )}

      {/* Select button */}
      <button
        onClick={() => onSelect(page.id)}
        disabled={disabled || !canManage || isSelected}
        className={`w-full py-3 px-4 rounded-lg font-medium transition-colors ${
          isSelected
            ? "bg-green-600 text-white cursor-default"
            : disabled || !canManage
            ? "bg-gray-300 text-gray-500 cursor-not-allowed"
            : "bg-blue-600 text-white hover:bg-blue-700"
        }`}
      >
        {isSelected ? "✓ Connecting..." : "Select This Page"}
      </button>
    </div>
  );
}

interface StatusBadgeProps {
  icon: string;
  label: string;
  variant: "success" | "warning" | "error";
}

function StatusBadge({ icon, label, variant }: StatusBadgeProps) {
  const colors = {
    success: "text-green-700 bg-green-50",
    warning: "text-amber-700 bg-amber-50",
    error: "text-red-700 bg-red-50",
  };

  return (
    <div className={`flex items-center gap-2 text-sm px-3 py-2 rounded ${colors[variant]}`}>
      <span className="font-medium">{icon}</span>
      <span>{label}</span>
    </div>
  );
}

// Disable SSR for this page since it's a client-only OAuth flow page
export default dynamic(() => Promise.resolve(SelectFacebookPageComponent), {
  ssr: false,
});
