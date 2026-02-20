import * as React from "react";
import { Skeleton } from "./skeleton";
import { cn } from "../../../../../lib/utils";

/* ------------------------------------------------------------------ */
/*  SkeletonInline – small inline text placeholder (navbar, etc.)      */
/* ------------------------------------------------------------------ */
export function SkeletonInline({
  width = "80px",
  className,
}: {
  width?: string;
  className?: string;
}) {
  return (
    <Skeleton
      className={cn("h-4 rounded inline-block align-middle", className)}
      style={{ width }}
    />
  );
}

/* ------------------------------------------------------------------ */
/*  SkeletonNavItem – sidebar nav item placeholder                     */
/* ------------------------------------------------------------------ */
export function SkeletonNavItem({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-3 px-3 py-2", className)}>
      <Skeleton className="h-[18px] w-[18px] rounded" />
      <Skeleton className="h-4 w-28 rounded" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  SkeletonMetricCard – single metric card (label + value + trend)    */
/* ------------------------------------------------------------------ */
export function SkeletonMetricCard({ className }: { className?: string }) {
  return (
    <div
      className={cn("p-4 rounded-xl space-y-3", className)}
      style={{ border: "1px solid var(--border, #e5e7eb)" }}
    >
      <Skeleton className="h-3 w-20 rounded" />
      <Skeleton className="h-6 w-24 rounded" />
      <Skeleton className="h-3 w-14 rounded" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  SkeletonMetricGrid – grid of N SkeletonMetricCards                 */
/* ------------------------------------------------------------------ */
export function SkeletonMetricGrid({
  columns = 6,
  className,
}: {
  columns?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(`grid gap-4`, className)}
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {Array.from({ length: columns }).map((_, i) => (
        <SkeletonMetricCard key={i} />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  SkeletonCard – general card with N text lines                      */
/* ------------------------------------------------------------------ */
export function SkeletonCard({
  lines = 3,
  className,
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div
      className={cn("p-6 rounded-xl space-y-3", className)}
      style={{ border: "1px solid var(--border, #e5e7eb)" }}
    >
      <Skeleton className="h-5 w-3/5 rounded" />
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn("h-3 rounded", i === lines - 1 ? "w-2/5" : "w-full")}
        />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  SkeletonCampaignRow – campaign row: thumbnail + name + status      */
/* ------------------------------------------------------------------ */
export function SkeletonCampaignRow({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex items-center justify-between p-3 rounded-lg",
        className
      )}
    >
      <div className="flex items-center gap-3">
        <Skeleton className="w-16 h-12 rounded" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-32 rounded" />
          <Skeleton className="h-3 w-20 rounded" />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Skeleton className="h-5 w-14 rounded-full" />
        <Skeleton className="h-7 w-14 rounded-lg" />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  SkeletonImageGrid – grid of image-sized rectangles                 */
/* ------------------------------------------------------------------ */
export function SkeletonImageGrid({
  count = 12,
  className,
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3",
        className
      )}
    >
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="w-full h-40 rounded" />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  SkeletonVideoGrid – grid of video-sized (aspect-video) rectangles  */
/* ------------------------------------------------------------------ */
export function SkeletonVideoGrid({
  count = 8,
  className,
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3",
        className
      )}
    >
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="w-full aspect-video rounded" />
          <Skeleton className="h-3 w-24 rounded" />
          <Skeleton className="h-3 w-16 rounded" />
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  SkeletonNotificationCard – notification row: icon + title + desc   */
/* ------------------------------------------------------------------ */
export function SkeletonNotificationCard({
  className,
}: {
  className?: string;
}) {
  return (
    <div
      className={cn(
        "p-5 rounded-xl border flex items-start gap-3",
        className
      )}
      style={{ border: "1px solid var(--border, #e5e7eb)" }}
    >
      <Skeleton className="w-8 h-8 rounded-full flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-3/4 rounded" />
        <Skeleton className="h-3 w-1/2 rounded" />
      </div>
      <Skeleton className="h-3 w-10 rounded" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  SkeletonRecommendationCard – title + bullets + impact badge        */
/* ------------------------------------------------------------------ */
export function SkeletonRecommendationCard({
  className,
}: {
  className?: string;
}) {
  return (
    <div
      className={cn("rounded-lg p-5 space-y-3", className)}
      style={{ border: "1px solid var(--border, #e5e7eb)" }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-3/4 rounded" />
          <Skeleton className="h-3 w-full rounded" />
        </div>
        <Skeleton className="h-5 w-14 rounded flex-shrink-0" />
      </div>
      <div className="space-y-2 ml-4">
        <Skeleton className="h-3 w-5/6 rounded" />
        <Skeleton className="h-3 w-4/6 rounded" />
        <Skeleton className="h-3 w-3/6 rounded" />
      </div>
      <Skeleton className="h-3 w-1/3 rounded" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  SkeletonPageLoader – full-page skeleton with variant prop          */
/* ------------------------------------------------------------------ */
export function SkeletonPageLoader({
  variant = "dashboard",
  className,
}: {
  variant?: "dashboard" | "analytics" | "buy-credits" | "form";
  className?: string;
}) {
  if (variant === "analytics") {
    return (
      <div className={cn("space-y-6 w-full max-w-6xl mx-auto", className)}>
        {/* Header */}
        <div className="space-y-2">
          <Skeleton className="h-7 w-40 rounded" />
          <Skeleton className="h-4 w-64 rounded" />
        </div>
        {/* Metric grid */}
        <SkeletonMetricGrid columns={6} />
        {/* Charts placeholder */}
        <div className="grid grid-cols-2 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-64 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (variant === "buy-credits") {
    return (
      <div className={cn("space-y-6 w-full max-w-4xl mx-auto", className)}>
        <Skeleton className="h-7 w-48 rounded" />
        <Skeleton className="h-4 w-72 rounded" />
        <div className="grid grid-cols-2 gap-4">
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
        </div>
        <div className="grid grid-cols-[1fr_360px] gap-8">
          <div className="space-y-4">
            <Skeleton className="h-12 rounded-lg" />
            <Skeleton className="h-12 rounded-lg" />
            <Skeleton className="h-12 rounded-lg" />
          </div>
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </div>
    );
  }

  if (variant === "form") {
    return (
      <div className={cn("space-y-4 w-full max-w-2xl mx-auto", className)}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-28 rounded" />
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>
        ))}
        <Skeleton className="h-10 w-40 rounded-lg" />
      </div>
    );
  }

  // default: dashboard
  return (
    <div className={cn("space-y-6 w-full max-w-6xl mx-auto", className)}>
      {/* Header */}
      <div className="space-y-2">
        <Skeleton className="h-8 w-44 rounded" />
        <Skeleton className="h-4 w-72 rounded" />
      </div>
      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonMetricCard key={i} />
        ))}
      </div>
      {/* Recommendations placeholder */}
      <Skeleton className="h-48 rounded-xl" />
      {/* Campaigns placeholder */}
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <SkeletonCampaignRow key={i} />
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  PulseSpinner – three animated dots for minimal loading indicator   */
/* ------------------------------------------------------------------ */
export function PulseSpinner({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center justify-center gap-1.5", className)}>
      <span
        className="inline-block w-2.5 h-2.5 rounded-full animate-pulse"
        style={{ backgroundColor: "currentColor", animationDelay: "0ms" }}
      />
      <span
        className="inline-block w-2.5 h-2.5 rounded-full animate-pulse"
        style={{ backgroundColor: "currentColor", animationDelay: "150ms" }}
      />
      <span
        className="inline-block w-2.5 h-2.5 rounded-full animate-pulse"
        style={{ backgroundColor: "currentColor", animationDelay: "300ms" }}
      />
    </div>
  );
}
