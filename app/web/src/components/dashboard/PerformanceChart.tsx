"use client";

import Link from "next/link";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import colors from "@/lib/ui/colors";

export type PerformancePoint = {
  date: string;
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  ctr: number | null;
  conversions: number;
};

type PerformanceChartProps = {
  points: PerformancePoint[];
  loading: boolean;
  connected: boolean;
  error: string | null;
  rangeLabel: string;
};

function parseMetricDate(value: string) {
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return value;
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function PerformanceChart({
  points,
  loading,
  connected,
  error,
  rangeLabel,
}: PerformanceChartProps) {
  const data = points.map((point) => ({
    ...point,
    label: parseMetricDate(point.date),
  }));

  return (
    <section
      className="flex min-h-[280px] flex-col rounded-2xl p-4"
      style={{
        background: colors.gradientCard,
        border: `1px solid ${colors.border}`,
        boxShadow: colors.shadowSoft,
      }}
      aria-labelledby="performance-heading"
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h2 id="performance-heading" className="text-sm font-semibold" style={{ color: colors.foreground }}>
            Content performance
          </h2>
          <p className="mt-0.5 text-xs" style={{ color: colors.mutedForeground }}>
            {connected ? `Meta ads · ${rangeLabel}` : "Meta ads"}
          </p>
        </div>
        <Link
          href="/analytics"
          className="skx-focus rounded-md px-2 py-1 text-xs font-medium"
          style={{ color: colors.primary }}
        >
          Analytics
        </Link>
      </div>

      {loading ? (
        <div className="flex flex-1 items-center justify-center text-sm" style={{ color: colors.mutedForeground }}>
          Loading performance…
        </div>
      ) : error ? (
        <div className="flex flex-1 items-center text-sm" style={{ color: colors.destructive }} role="alert">
          {error}
        </div>
      ) : !connected ? (
        <div className="flex flex-1 flex-col justify-center gap-3">
          <p className="text-sm leading-relaxed" style={{ color: colors.mutedForeground }}>
            Connect a Meta ad account to see reach, clicks, and spend for this workspace.
          </p>
          <Link
            href="/integrations"
            className="skx-focus inline-flex w-fit rounded-lg px-3 py-2 text-sm font-medium"
            style={{ background: colors.primary, color: colors.primaryForeground }}
          >
            Connect Meta
          </Link>
        </div>
      ) : data.length === 0 ? (
        <div className="flex flex-1 flex-col justify-center gap-2">
          <p className="text-sm leading-relaxed" style={{ color: colors.mutedForeground }}>
            No daily performance is stored for {rangeLabel.toLowerCase()}. Totals above still use the synced account aggregate when it exists.
          </p>
          <Link href="/analytics" className="skx-focus text-sm font-medium" style={{ color: colors.primary }}>
            Open analytics
          </Link>
        </div>
      ) : (
        <div className="h-52 w-full min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={colors.border} vertical={false} />
              <XAxis dataKey="label" tick={{ fill: colors.mutedForeground, fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="impressions" hide />
              <YAxis yAxisId="clicks" orientation="right" hide />
              <Tooltip
                contentStyle={{
                  background: colors.popover,
                  border: `1px solid ${colors.border}`,
                  borderRadius: 12,
                  color: colors.foreground,
                  fontSize: 12,
                }}
                formatter={(value, name) => {
                  const numeric = typeof value === "number" ? value : Number(value ?? 0);
                  if (name === "impressions") return [numeric.toLocaleString(), "Impressions"];
                  if (name === "clicks") return [numeric.toLocaleString(), "Clicks"];
                  return [numeric, String(name)];
                }}
              />
              <Area
                yAxisId="impressions"
                type="monotone"
                dataKey="impressions"
                stroke={colors.primary}
                fill={colors.primary}
                fillOpacity={0.18}
                strokeWidth={2}
              />
              <Line
                yAxisId="clicks"
                type="monotone"
                dataKey="clicks"
                stroke={colors.primaryGlow}
                strokeWidth={2}
                dot={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
          <div className="mt-2 flex gap-4 text-[11px]" style={{ color: colors.mutedForeground }}>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: colors.primary }} />
              Impressions
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: colors.primaryGlow }} />
              Clicks
            </span>
          </div>
        </div>
      )}
    </section>
  );
}
