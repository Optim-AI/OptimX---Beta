// pages/workspace.tsx
// Entry into the app after sign-in, onboarding or checkout. A user without a Brand Kit
// starts by setting one up (everything they create uses it); everyone else goes to Ad Studio.
// Query params (e.g. ?credits=pending from checkout) are passed through.

import { useEffect, useRef } from "react";
import type { JSX } from "react";
import { useRouter } from "next/router";
import { ArcSpinner } from "@/app/web/src/components/ui/loaders";
import colors from "@/lib/ui/colors";
import { authFetch } from "@/lib/utils";

const APP_HOME = "/content-studio";
const BRAND_KIT_SETUP = "/brand-kit";

export default function WorkspaceEntry(): JSX.Element {
  const router = useRouter();

  const started = useRef(false);

  useEffect(() => {
    // Run once: the router object changes during navigation, which must not cancel the redirect.
    if (!router.isReady || started.current) return;
    started.current = true;
    (async () => {
      let hasKit = true; // On any error, don't trap an existing user in setup.
      try {
        const res = await authFetch("/api/brand-kits");
        if (res.status === 401) {
          void router.replace("/auth/signin");
          return;
        }
        if (res.ok) hasKit = ((await res.json())?.kits || []).length > 0;
      } catch {
        /* fall through to the app */
      }
      const query = { ...router.query };
      if (hasKit) void router.replace({ pathname: APP_HOME, query });
      else void router.replace({ pathname: BRAND_KIT_SETUP, query: { ...query, welcome: "1" } });
    })();
  }, [router, router.isReady]);

  return (
    <div className="flex min-h-screen items-center justify-center" style={{ background: colors.background }}>
      <ArcSpinner className="h-6 w-6 animate-spin" style={{ color: colors.primary }} aria-label="Opening your workspace" />
    </div>
  );
}
