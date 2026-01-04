// pages/integrations/meta/error.tsx
import { useRouter } from "next/router";
import dynamic from "next/dynamic";

const OAuthResultPage = dynamic(
  () => import("../../../components/OAuthResultPage"),
  { ssr: false }
);

const ERROR_MESSAGES: Record<string, { title: string; description: string; action?: string }> = {
  pages_fetch_failed: {
    title: "Failed to Fetch Pages",
    description: "We couldn't retrieve your Facebook Pages. This might be a temporary issue with Facebook's API.",
    action: "Please try connecting again in a few moments.",
  },
  session_storage_failed: {
    title: "Session Storage Error",
    description: "Failed to store OAuth session data. This might be a database connectivity issue.",
    action: "Please try again or contact support if the issue persists.",
  },
  callback_error: {
    title: "OAuth Callback Error",
    description: "An unexpected error occurred during the OAuth process.",
    action: "Please try connecting again. If the problem continues, contact support.",
  },
  session_expired: {
    title: "Session Expired",
    description: "Your OAuth session has expired (sessions last 10 minutes).",
    action: "Please start the connection process again.",
  },
  token_exchange_failed: {
    title: "Token Exchange Failed",
    description: "Failed to exchange authorization code for access token. The code may have expired or been used already.",
    action: "Please try authenticating again.",
  },
};

export default function MetaError() {
  const router = useRouter();
  const { type, stage } = router.query;

  const errorType = (type as string) || "unknown";
  const errorInfo = ERROR_MESSAGES[errorType] || {
    title: "Connection Error",
    description: "An unexpected error occurred while connecting your Meta account.",
    action: "Please try again.",
  };

  return (
    <OAuthResultPage
      title={errorInfo.title}
      icon={<div className="text-red-500 text-6xl">⚠️</div>}
      redirectUrl="/integrations"
      autoCloseSeconds={15}
      status="error"
    >
      <div className="space-y-4">
        <p className="text-center text-gray-700">{errorInfo.description}</p>

        {errorInfo.action && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800 text-center">
            {errorInfo.action}
          </div>
        )}

        {stage && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs text-gray-600 text-center">
            <strong>Debug Info:</strong> Error occurred at stage "{stage}"
          </div>
        )}

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <h3 className="font-semibold text-amber-900 mb-2 text-center">
            Troubleshooting Tips
          </h3>
          <ul className="space-y-1 text-sm text-amber-800 list-disc list-inside">
            <li>Make sure you have a stable internet connection</li>
            <li>Try clearing your browser cache and cookies</li>
            <li>Ensure your Facebook account is in good standing</li>
            <li>Check if you have at least one Facebook Page</li>
            <li>Verify you granted all requested permissions</li>
          </ul>
        </div>

        <div className="flex gap-3 justify-center pt-2">
          <a
            href="/api/meta/oauth/start"
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Try Again
          </a>
          <a
            href="/integrations"
            className="px-6 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors font-medium"
          >
            Back to Integrations
          </a>
        </div>

        <div className="text-center pt-2 space-y-1">
          <a
            href="/docs/meta-setup"
            className="block text-sm text-blue-600 hover:underline"
          >
            📚 View setup guide
          </a>
          <a
            href="mailto:tech.optimx@gmail.com"
            className="block text-sm text-blue-600 hover:underline"
          >
            📧 Contact support
          </a>
        </div>

        {errorType && (
          <div className="text-center text-xs text-gray-400 pt-2">
            Error Code: {errorType}
          </div>
        )}
      </div>
    </OAuthResultPage>
  );
}
