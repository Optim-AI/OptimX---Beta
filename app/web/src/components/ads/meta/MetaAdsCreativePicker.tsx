"use client";

import * as React from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/app/web/src/components/ui/button";
import colors from "@/lib/ui/colors";
import { authFetch } from "@/lib/utils";
import { isPublicHttpsUrl } from "@/lib/ads/meta/draft-contract";

export type MetaAdsCreativePick = {
  id: string;
  mediaUrl: string;
  label?: string | null;
};

type LibraryItem = {
  id: string;
  mediaUrl: string;
  mediaType: "image" | "video";
  label?: string | null;
};

export function MetaAdsCreativePicker(props: {
  selectedId: string | null;
  onSelect: (item: MetaAdsCreativePick | null) => void;
}) {
  const [items, setItems] = React.useState<LibraryItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch(
        "/api/generated-contents/list?mediaType=image&limit=48&offset=0"
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Failed to load creatives");
      setItems((json.items || []) as LibraryItem[]);
    } catch (e: any) {
      setError(e?.message || "Failed to load Generated Contents");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const selected = items.find((i) => i.id === props.selectedId) || null;
  const httpsOk = selected ? isPublicHttpsUrl(selected.mediaUrl) : true;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm" style={{ color: colors.mutedForeground }}>
          Choose an image from Generated Contents. Assets are not uploaded to
          Meta in this step.
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void load()}
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
        </Button>
      </div>

      {error ? (
        <div
          className="rounded-lg border px-3 py-2 text-sm"
          style={{ borderColor: colors.destructive, color: colors.destructive }}
        >
          {error}{" "}
          <button type="button" className="underline" onClick={() => void load()}>
            Retry
          </button>
        </div>
      ) : null}

      {loading && items.length === 0 ? (
        <div className="flex items-center gap-2 text-sm" style={{ color: colors.mutedForeground }}>
          <Loader2 className="h-4 w-4 animate-spin" /> Loading images…
        </div>
      ) : null}

      {!loading && items.length === 0 && !error ? (
        <p className="text-sm" style={{ color: colors.mutedForeground }}>
          No images yet. Generate a poster in Brand Studio, then return here.
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {items.map((item) => {
          const active = item.id === props.selectedId;
          const eligible = isPublicHttpsUrl(item.mediaUrl);
          return (
            <button
              key={item.id}
              type="button"
              className="skx-focus overflow-hidden rounded-lg border text-left transition"
              style={{
                borderColor: active ? colors.primary : colors.border,
                boxShadow: active ? colors.shadowGlow : undefined,
                opacity: eligible ? 1 : 0.75,
              }}
              onClick={() =>
                props.onSelect({
                  id: item.id,
                  mediaUrl: item.mediaUrl,
                  label: item.label,
                })
              }
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.mediaUrl}
                alt={item.label || "Creative"}
                className="aspect-square w-full object-cover"
              />
              {!eligible ? (
                <div
                  className="px-2 py-1 text-[10px] font-medium"
                  style={{ background: "rgba(245,158,11,0.2)", color: "#f59e0b" }}
                >
                  Not HTTPS — Meta create later will need a public URL
                </div>
              ) : null}
            </button>
          );
        })}
      </div>

      {selected && !httpsOk ? (
        <p className="text-sm" style={{ color: "#f59e0b" }} data-testid="creative-https-warning">
          This image’s stored library URL is not a public https:// address (often
          localhost in development). The server will stamp the library URL on
          save — a browser-visible URL alone does not make the asset Meta-ready.
          Create-on-Meta will need a Meta-fetchable URL or byte upload later.
        </p>
      ) : null}
      {selected && httpsOk ? (
        <p className="text-xs" style={{ color: colors.mutedForeground }}>
          Ownership and the canonical URL are verified on the server when you
          save. A preview URL in the browser is not proof of Meta accessibility.
        </p>
      ) : null}
    </div>
  );
}
