// pages/brand-research.tsx
import React, { useCallback, useEffect, useState } from "react";
import type { JSX } from "react";
import Head from "next/head";
import Sidebar from "../app/web/src/components/Sidebar";
import colors from "@/lib/ui/colors";
import { authFetch } from "@/lib/utils";
import { friendlyError } from "@/lib/api-errors";
import { toast } from "sonner";
import { Globe, Search } from "lucide-react";
import { ArcSpinner, ShimmerTile } from "@/app/web/src/components/ui/loaders";
import BrandResearchReport, { ResearchPending } from "@/app/web/src/components/research/BrandResearchReport";
import type { BrandResearch } from "@/lib/research/brand-research";

function toFullUrl(raw: string): string {
  const t = raw.trim();
  return /^https?:\/\//i.test(t) ? t : `https://${t}`;
}

export default function BrandResearchPage(): JSX.Element {
  const [loading, setLoading] = useState(true);
  const [website, setWebsite] = useState("");
  const [research, setResearch] = useState<BrandResearch | null>(null);
  const [running, setRunning] = useState(false);
  const [checkingAds, setCheckingAds] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await authFetch("/api/brand/snapshot");
        const json = await res.json();
        const snap = json?.brandSnapshot;
        if (snap?.website_url) setWebsite(snap.website_url);
        if (snap?.research?.version === 1) setResearch(snap.research);
      } catch {
        /* empty state below */
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const run = useCallback(
    async (force: boolean) => {
      if (!website.trim()) {
        toast.error("Add your website first.");
        return;
      }
      setRunning(true);
      try {
        const res = await authFetch("/api/brand/research", {
          method: "POST",
          body: JSON.stringify({ url: toFullUrl(website), force }),
        });
        const json = await res.json();
        if (!res.ok || !json?.research) throw new Error(json?.error || "Research failed.");
        setResearch(json.research);
        if (json.reused) toast.message("Showing this week's research. Use “Run again” for a fresh one.");
      } catch (e) {
        toast.error((e as Error).message || "Research failed.");
      } finally {
        setRunning(false);
      }
    },
    [website]
  );

  const checkAds = useCallback(async () => {
    if (!research) return;
    setCheckingAds(true);
    try {
      const res = await authFetch("/api/brand/research", {
        method: "POST",
        body: JSON.stringify({ url: research.websiteUrl, adsOnly: true }),
      });
      const json = await res.json();
      if (!res.ok || !json?.research) throw new Error(json?.error || "Couldn't check competitor ads.");
      setResearch(json.research);
    } catch (e) {
      toast.error(friendlyError(e));
    } finally {
      setCheckingAds(false);
    }
  }, [research]);

  return (
    <div className="h-screen flex overflow-hidden app-page" style={{ background: colors.background }}>
      <Head>
        <title>Brand Research | SkalX AI</title>
      </Head>
      <Sidebar />
      <main className="min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
          <header>
            <h1 className="text-2xl font-semibold" style={{ color: colors.foreground }}>Brand Research</h1>
            <p className="mt-1 max-w-2xl text-sm" style={{ color: colors.mutedForeground }}>
              Your market as a strategist would brief it: positioning, real competitors and prices, what buyers say,
              and where you can win. Ad Studio and Brand Studio use this when they plan your ads.
            </p>
          </header>

          <form
            className="mt-6 flex flex-col gap-2 sm:flex-row"
            onSubmit={(e) => {
              e.preventDefault();
              void run(Boolean(research));
            }}
          >
            <label htmlFor="research-url" className="sr-only">Website</label>
            <div className="flex flex-1 items-center gap-2 rounded-lg px-3" style={{ background: colors.secondary, border: `1px solid ${colors.border}` }}>
              <Globe className="h-4 w-4 shrink-0" style={{ color: colors.mutedForeground }} />
              <input
                id="research-url"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="yourbrand.com"
                className="w-full bg-transparent py-2 text-sm outline-none"
                style={{ color: colors.foreground }}
              />
            </div>
            <button
              type="submit"
              disabled={running || !website.trim()}
              className="inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-60"
              style={{ background: colors.primary, color: colors.primaryForeground }}
            >
              {running ? <ArcSpinner className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              {running ? "Researching…" : research ? "Research again" : "Research my market"}
            </button>
          </form>

          <div className="mt-6">
            {loading ? (
              <div className="space-y-4" role="status" aria-label="Loading your research">
                <ShimmerTile className="h-28" />
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <ShimmerTile className="h-40" />
                  <ShimmerTile className="h-40" />
                </div>
              </div>
            ) : running && !research ? (
              <ResearchPending />
            ) : research ? (
              <BrandResearchReport
                research={research}
                onRefresh={() => run(true)}
                refreshing={running}
                onCheckAds={checkAds}
                checkingAds={checkingAds}
              />
            ) : (
              <div className="rounded-xl p-6" style={{ background: colors.card, border: `1px solid ${colors.border}` }}>
                <p className="text-sm" style={{ color: colors.foreground }}>No research yet.</p>
                <p className="mt-1 text-sm" style={{ color: colors.mutedForeground }}>
                  Enter your website above. It takes about a minute.
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
