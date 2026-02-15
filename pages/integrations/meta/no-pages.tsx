// pages/integrations/meta/no-pages.tsx
import dynamic from "next/dynamic";

const OAuthResultPage = dynamic(
  () => import("../../../components/OAuthResultPage"),
  { ssr: false }
);

export default function NoFacebookPages() {
  return (
    <OAuthResultPage
      title="No Facebook Pages Found"
      icon={<div className="text-amber-500 text-6xl">⚠️</div>}
      redirectUrl="/integrations"
      autoCloseSeconds={15}
      status="no_pages"
    >
      <div className="space-y-4">
        <p className="text-center text-gray-700">
          SkalX AI needs a Facebook Page to publish content and manage your
          Instagram Business account.
        </p>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h2 className="font-semibold text-blue-900 mb-3">
            How to create a Facebook Page:
          </h2>
          <ol className="space-y-2 text-sm text-blue-800 list-decimal list-inside">
            <li>
              Visit{" "}
              <a
                href="https://www.facebook.com/pages/create"
                target="_blank"
                rel="noopener noreferrer"
                className="underline font-medium hover:text-blue-600"
              >
                facebook.com/pages/create
              </a>
            </li>
            <li>Choose a page category (Business, Brand, Community, etc.)</li>
            <li>Enter your page name and description</li>
            <li>Complete the setup wizard</li>
            <li>Return here and click "Retry Connection" below</li>
          </ol>
        </div>

        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm text-gray-700">
          <h3 className="font-semibold mb-2">Why do I need a Facebook Page?</h3>
          <ul className="space-y-1 list-disc list-inside">
            <li>Required by Meta to connect Instagram Business accounts</li>
            <li>Enables publishing to both Facebook and Instagram</li>
            <li>Provides access to Meta ads and insights</li>
          </ul>
        </div>

        <div className="flex gap-3 justify-center pt-2">
          <a
            href="/api/meta/oauth/start"
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Retry Connection
          </a>
          <a
            href="https://www.facebook.com/pages/create"
            target="_blank"
            rel="noopener noreferrer"
            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
          >
            Create Page Now
          </a>
        </div>

        <div className="text-center pt-2">
          <a
            href="/docs/meta-setup"
            className="text-sm text-blue-600 hover:underline"
          >
            📚 View detailed setup guide →
          </a>
        </div>
      </div>
    </OAuthResultPage>
  );
}
