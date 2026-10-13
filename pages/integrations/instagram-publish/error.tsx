import { useRouter } from "next/router";
import dynamic from "next/dynamic";

function InstagramPublishError() {
  const router = useRouter();
  const type = router.query.type || "unknown";
  const stage = router.query.stage;

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[var(--background,#0b0b0c)] text-[var(--foreground,#f5f5f5)]">
      <div className="max-w-md space-y-4 text-center">
        <h1 className="text-xl font-semibold">Instagram connection failed</h1>
        <p className="text-sm text-neutral-400">
          {String(type)}
          {stage ? ` (stage: ${String(stage)})` : ""}
        </p>
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

export default dynamic(() => Promise.resolve(InstagramPublishError), {
  ssr: false,
});
