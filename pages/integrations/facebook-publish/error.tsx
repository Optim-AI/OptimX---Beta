import { useRouter } from "next/router";

export default function FacebookPublishError() {
  const router = useRouter();
  const type = Array.isArray(router.query.type)
    ? router.query.type[0]
    : router.query.type;
  const stage = Array.isArray(router.query.stage)
    ? router.query.stage[0]
    : router.query.stage;

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[var(--background,#0b0b0c)] text-[var(--foreground,#f5f5f5)]">
      <div className="max-w-md space-y-4 text-center">
        <h1 className="text-xl font-semibold">Publishing connection failed</h1>
        <p className="text-sm text-neutral-400">
          {type === "pages_fetch_failed"
            ? "Could not load your Facebook Pages. Check app permissions and try again."
            : "Something went wrong during Facebook publishing authorization."}
          {stage ? ` (stage: ${stage})` : ""}
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
