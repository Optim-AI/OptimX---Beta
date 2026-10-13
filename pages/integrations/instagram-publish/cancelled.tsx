import { useRouter } from "next/router";
import dynamic from "next/dynamic";

function InstagramPublishCancelled() {
  const router = useRouter();
  const reason = router.query.reason;

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[var(--background,#0b0b0c)] text-[var(--foreground,#f5f5f5)]">
      <div className="max-w-md space-y-4 text-center">
        <h1 className="text-xl font-semibold">Instagram connection cancelled</h1>
        {reason && (
          <p className="text-sm text-neutral-400">{String(reason)}</p>
        )}
        <button
          type="button"
          className="rounded-md bg-sky-600 px-4 py-2 text-sm"
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

export default dynamic(() => Promise.resolve(InstagramPublishCancelled), {
  ssr: false,
});
