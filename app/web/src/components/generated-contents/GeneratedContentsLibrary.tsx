"use client";

import * as React from "react";
import Link from "next/link";
import {
  Image as ImageIcon,
  Video,
  Search,
  Loader2,
  RefreshCw,
  UploadCloud,
  Sparkles,
} from "lucide-react";
import Sidebar from "@/app/web/src/components/Sidebar";
import { Button } from "@/app/web/src/components/ui/button";
import { Input } from "@/app/web/src/components/ui/input";
import colors from "@/lib/ui/colors";
import { authFetch } from "@/lib/utils";
import {
  PublishComposer,
  type PublishableCreative,
} from "@/app/web/src/components/generated-contents/PublishComposer";

type MediaFilter = "all" | "image" | "video";

type LibraryItem = {
  id: string;
  mediaUrl: string;
  storagePath?: string | null;
  mediaType: "image" | "video";
  source?: string | null;
  createdAt?: string | null;
  label?: string | null;
  association?: { type: string; id: string } | null;
  publish?: {
    status: string;
    destinationPageName?: string | null;
    permalink?: string | null;
    publishedAt?: string | null;
    errorMessage?: string | null;
    socialPostId?: string | null;
  };
};

function publishBadge(status?: string) {
  switch (status) {
    case "published":
      return { label: "Published", color: "#22c55e" };
    case "draft":
      return { label: "Draft", color: "#94a3b8" };
    case "publishing":
      return { label: "Publishing", color: "#3b82f6" };
    case "failed":
      return { label: "Failed", color: "#ef4444" };
    default:
      return { label: "Unpublished", color: "#64748b" };
  }
}

export function GeneratedContentsLibrary() {
  const [filter, setFilter] = React.useState<MediaFilter>("all");
  const [search, setSearch] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");
  const [items, setItems] = React.useState<LibraryItem[]>([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [selected, setSelected] = React.useState<LibraryItem | null>(null);
  const [composerOpen, setComposerOpen] = React.useState(false);
  const [composerCreative, setComposerCreative] =
    React.useState<PublishableCreative | null>(null);

  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = React.useCallback(
    async (opts?: { append?: boolean; offset?: number }) => {
      const append = Boolean(opts?.append);
      const offset = opts?.offset ?? 0;
      if (append) setLoadingMore(true);
      else {
        setLoading(true);
        setError(null);
      }
      try {
        const params = new URLSearchParams({
          mediaType: filter,
          limit: "48",
          offset: String(offset),
        });
        if (debouncedSearch) params.set("q", debouncedSearch);
        const resp = await authFetch(
          `/api/generated-contents/list?${params.toString()}`
        );
        const json = await resp.json().catch(() => ({}));
        if (!resp.ok) {
          throw new Error(json.error || "Failed to load library");
        }
        const next = (json.items || []) as LibraryItem[];
        setTotal(json.total || 0);
        setItems((prev) => (append ? [...prev, ...next] : next));
      } catch (e: any) {
        setError(e?.message || "Failed to load Generated Contents");
        if (!append) setItems([]);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [filter, debouncedSearch]
  );

  React.useEffect(() => {
    void load({ offset: 0 });
  }, [load]);

  const openPublish = (item: LibraryItem) => {
    setComposerCreative({
      id: item.id,
      mediaUrl: item.mediaUrl,
      mediaType: item.mediaType,
      storagePath: item.storagePath,
      label: item.label,
    });
    setComposerOpen(true);
  };

  return (
    <div className="min-h-screen flex app-page">
      <Sidebar logoUrl="/brand/logo.png" onLogoClick={() => {}} />

      <div className="flex-1 min-w-0">
        <main className="max-w-6xl mx-auto p-6 pb-24">
          <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">
                Generated Contents
              </h1>
              <p className="text-sm mt-1" style={{ color: colors.mutedForeground }}>
                Every poster and video you generate, ready to publish.
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link href="/brand-studio">
                  <Sparkles className="w-4 h-4 mr-1.5" />
                  Create
                </Link>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void load({ offset: 0 })}
                disabled={loading}
              >
                <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-5">
            <div
              className="inline-flex rounded-lg p-1 gap-0"
              style={{ background: colors.muted, border: `1px solid ${colors.border}` }}
            >
              {(
                [
                  { id: "all", label: "All", Icon: UploadCloud },
                  { id: "image", label: "Images", Icon: ImageIcon },
                  { id: "video", label: "Videos", Icon: Video },
                ] as const
              ).map(({ id, label, Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setFilter(id)}
                  className="flex items-center gap-2 px-3.5 py-2 rounded-md text-sm font-medium transition-colors"
                  style={{
                    background: filter === id ? colors.primary : "transparent",
                    color:
                      filter === id
                        ? colors.primaryForeground
                        : colors.mutedForeground,
                  }}
                >
                  <Icon size={16} />
                  {label}
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-72">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2"
                style={{ color: colors.mutedForeground }}
              />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search creatives…"
                className="pl-9"
              />
            </div>
          </div>

          {loading && (
            <div className="flex items-center justify-center py-24 gap-2" style={{ color: colors.mutedForeground }}>
              <Loader2 className="animate-spin" size={18} />
              Loading your library…
            </div>
          )}

          {!loading && error && (
            <div className="rounded-xl border p-6 text-center" style={{ borderColor: colors.border }}>
              <p className="text-red-400 mb-3">{error}</p>
              <Button onClick={() => void load({ offset: 0 })}>Retry</Button>
            </div>
          )}

          {!loading && !error && items.length === 0 && (
            <div
              className="rounded-2xl border border-dashed px-6 py-16 text-center"
              style={{ borderColor: colors.border, background: colors.card }}
            >
              <UploadCloud
                className="mx-auto mb-4 opacity-60"
                size={36}
                style={{ color: colors.mutedForeground }}
              />
              <h2 className="text-lg font-medium">No creatives yet</h2>
              <p className="mt-2 text-sm max-w-md mx-auto" style={{ color: colors.mutedForeground }}>
                Generate a poster in Brand Studio or a video in Ad Studio — they
                appear here automatically after a successful save.
              </p>
              <div className="mt-5 flex justify-center gap-2">
                <Button asChild style={{ background: colors.gradientPrimary, color: colors.primaryForeground }}>
                  <Link href="/brand-studio/poster">Create poster</Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link href="/content-studio">Open Ad Studio</Link>
                </Button>
              </div>
            </div>
          )}

          {!loading && !error && items.length > 0 && (
            <>
              <p className="text-xs mb-3" style={{ color: colors.mutedForeground }}>
                Showing {items.length} of {total}
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {items.map((item) => {
                  const badge = publishBadge(item.publish?.status);
                  return (
                    <div
                      key={item.id}
                      className="group rounded-xl overflow-hidden border transition hover:border-sky-500/40"
                      style={{ borderColor: colors.border, background: colors.card }}
                    >
                      <button
                        type="button"
                        className="block w-full aspect-square bg-black/40 relative"
                        onClick={() => setSelected(item)}
                      >
                        {item.mediaType === "video" ? (
                          <video
                            src={item.mediaUrl}
                            className="w-full h-full object-cover"
                            muted
                            playsInline
                          />
                        ) : (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={item.mediaUrl}
                            alt={item.label || "Generated creative"}
                            className="w-full h-full object-cover"
                          />
                        )}
                        <span
                          className="absolute left-2 top-2 rounded-md px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide"
                          style={{ background: "rgba(0,0,0,0.65)", color: "#fff" }}
                        >
                          {item.mediaType === "video" ? "Video" : "Image"}
                        </span>
                        <span
                          className="absolute right-2 top-2 rounded-md px-1.5 py-0.5 text-[10px] font-medium"
                          style={{ background: "rgba(0,0,0,0.65)", color: badge.color }}
                        >
                          {badge.label}
                        </span>
                      </button>
                      <div className="p-3 space-y-2">
                        <p className="text-xs truncate" style={{ color: colors.mutedForeground }}>
                          {item.createdAt
                            ? new Date(item.createdAt).toLocaleString()
                            : "—"}
                        </p>
                        {item.label && (
                          <p className="text-sm truncate">{item.label}</p>
                        )}
                        {item.publish?.status === "published" &&
                          item.publish.destinationPageName && (
                            <p className="text-[11px] truncate text-green-500">
                              {item.publish.destinationPageName}
                              {item.publish.publishedAt
                                ? ` · ${new Date(item.publish.publishedAt).toLocaleDateString()}`
                                : ""}
                            </p>
                          )}
                        <Button
                          size="sm"
                          className="w-full"
                          onClick={() => openPublish(item)}
                          style={{
                            background: colors.gradientPrimary,
                            color: colors.primaryForeground,
                          }}
                        >
                          Publish
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {items.length < total && (
                <div className="mt-8 flex justify-center">
                  <Button
                    variant="outline"
                    disabled={loadingMore}
                    onClick={() =>
                      void load({ append: true, offset: items.length })
                    }
                  >
                    {loadingMore ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Loading…
                      </>
                    ) : (
                      "Load more"
                    )}
                  </Button>
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {selected && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center p-4"
          style={{ background: `${colors.background}dd`, backdropFilter: "blur(6px)" }}
          onClick={() => setSelected(null)}
        >
          <div
            className="w-full max-w-3xl rounded-2xl border overflow-hidden"
            style={{ background: colors.card, borderColor: colors.border }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 flex items-start justify-between gap-3 border-b" style={{ borderColor: colors.border }}>
              <div>
                <h3 className="font-semibold">
                  {selected.mediaType === "video" ? "Video" : "Poster"} detail
                </h3>
                <p className="text-xs mt-1" style={{ color: colors.mutedForeground }}>
                  {selected.createdAt
                    ? new Date(selected.createdAt).toLocaleString()
                    : ""}
                </p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setSelected(null)}>
                Close
              </Button>
            </div>
            <div className="bg-black/50 flex items-center justify-center max-h-[60vh]">
              {selected.mediaType === "video" ? (
                <video src={selected.mediaUrl} controls className="max-h-[60vh] w-full" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={selected.mediaUrl}
                  alt=""
                  className="max-h-[60vh] object-contain"
                />
              )}
            </div>
            <div className="p-4 flex flex-wrap gap-2">
              <Button
                onClick={() => {
                  openPublish(selected);
                }}
                style={{
                  background: colors.gradientPrimary,
                  color: colors.primaryForeground,
                }}
              >
                Publish
              </Button>
              {selected.publish?.permalink && (
                <Button variant="outline" asChild>
                  <a href={selected.publish.permalink} target="_blank" rel="noreferrer">
                    View post
                  </a>
                </Button>
              )}
              {selected.publish?.status === "failed" && (
                <p className="w-full text-sm text-red-400">
                  {selected.publish.errorMessage || "Previous publish failed. You can retry safely if the result was not ambiguous."}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      <PublishComposer
        open={composerOpen}
        creative={composerCreative}
        onClose={() => setComposerOpen(false)}
        onPublished={() => {
          void load({ offset: 0 });
        }}
      />
    </div>
  );
}

export default GeneratedContentsLibrary;
