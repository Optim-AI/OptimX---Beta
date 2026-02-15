// pages/integrations/meta/cancelled.tsx
import { useRouter } from "next/router";
import dynamic from "next/dynamic";

const OAuthResultPage = dynamic(
  () => import("../../../components/OAuthResultPage"),
  { ssr: false }
);

export default function OAuthCancelled() {
  const router = useRouter();
  const { reason } = router.query;

  return (
    <OAuthResultPage
      title="Connection Cancelled"
      icon={<div className="text-gray-500 text-6xl">✗</div>}
      redirectUrl="/integrations"
      autoCloseSeconds={15}
      status="cancelled"
    >
      <div className="space-y-4">
        <p className="text-center text-gray-700">
          You cancelled the Facebook connection process.
        </p>

        {reason && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm text-gray-600 text-center">
            Reason: {reason}
          </div>
        )}

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h2 className="font-semibold text-blue-900 mb-3 text-center">
            Why SkalX AI needs these permissions
          </h2>
          <ul className="space-y-2 text-sm text-blue-800">
            <li className="flex gap-2">
              <span className="font-bold">📄</span>
              <span>
                <strong>Manage Pages:</strong> To publish posts to your Facebook
                Page on your behalf
              </span>
            </li>
            <li className="flex gap-2">
              <span className="font-bold">📸</span>
              <span>
                <strong>Instagram:</strong> To create and manage your Instagram
                content
              </span>
            </li>
            <li className="flex gap-2">
              <span className="font-bold">📊</span>
              <span>
                <strong>Ads:</strong> To view campaign performance and insights
              </span>
            </li>
            <li className="flex gap-2">
              <span className="font-bold">💬</span>
              <span>
                <strong>Comments:</strong> To manage engagement and respond to
                comments
              </span>
            </li>
          </ul>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-800">
          <strong>Privacy Note:</strong> SkalX AI only accesses your own Facebook
          Pages and Instagram accounts. We never access content from other users.
        </div>

        <div className="flex gap-3 justify-center pt-2">
          <a
            href="/api/meta/oauth/start"
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Try Again
          </a>
        </div>

        <div className="text-center pt-2">
          <a
            href="/docs/meta-permissions"
            className="text-sm text-blue-600 hover:underline"
          >
            📚 Learn more about permissions →
          </a>
        </div>
      </div>
    </OAuthResultPage>
  );
}
