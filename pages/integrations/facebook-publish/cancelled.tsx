import { useRouter } from "next/router";

export default function FacebookPublishCancelled() {
  const router = useRouter();
  const reason = Array.isArray(router.query.reason)
    ? router.query.reason[0]
    : router.query.reason;

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[var(--background,#0b0b0c)] text-[var(--foreground,#f5f5f5)]">
      <div className="max-w-md space-y-4 text-center">
        <h1 className="text-xl font-semibold">Authorization cancelled</h1>
        <p className="text-sm text-neutral-400">
          Facebook Page publishing was not connected.
          {reason ? ` (${reason})` : ""}
        </p>
        <button
          type="button"
          className="rounded-md bg-sky-600 px-4 py-2 text-sm text-white"
          onClick={() => {
            if (window.opener) window.close();
            else router.push("/generated-contents");
          }}
        >
          Close
        </button>
      </div>
    </div>
  );
}
