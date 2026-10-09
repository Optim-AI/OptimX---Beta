"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import colors from "@/lib/ui/colors";
import {
  accountOptions,
  filterActivity,
  itemsOnDay,
  monthGrid,
  shiftAnchor,
  weekDays,
  type ActivityFilters,
  type ActivityItem,
  type ActivityStatus,
  type CalendarView,
} from "@/lib/dashboard/activity";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const STATUS_LABEL: Record<ActivityStatus, string> = {
  draft: "Draft",
  publishing: "Publishing",
  published: "Published",
  failed: "Failed",
  unpublished: "Unpublished",
};

const STATUS_COLOR: Record<ActivityStatus, string> = {
  draft: colors.mutedForeground,
  publishing: colors.primary,
  published: colors.green600,
  failed: colors.destructive,
  unpublished: colors.accentForeground,
};

type ContentCalendarProps = {
  items: ActivityItem[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
};

function formatTime(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function ActivityCard({ item, compact = false }: { item: ActivityItem; compact?: boolean }) {
  const inner = (
    <>
      {item.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.imageUrl} alt="" className="h-10 w-full rounded-md object-cover" />
      ) : null}
      <div className="min-w-0">
        <div className="flex items-center gap-1 text-[10px]" style={{ color: colors.mutedForeground }}>
          <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: STATUS_COLOR[item.status] }} />
          <span>{formatTime(item.occurredAt)}</span>
          {!compact ? <span>· {STATUS_LABEL[item.status]}</span> : null}
        </div>
        <p className={`mt-0.5 text-[11px] leading-snug ${compact ? "line-clamp-2" : "line-clamp-3"}`} style={{ color: colors.foreground }}>
          {item.title}
        </p>
      </div>
    </>
  );

  const className = "skx-focus flex flex-col gap-1 rounded-lg p-1.5 text-left transition-colors";
  const style = { background: colors.secondary, border: `1px solid ${colors.border}` };

  if (item.external) {
    return (
      <a href={item.href} target="_blank" rel="noopener noreferrer" className={className} style={style}>
        {inner}
      </a>
    );
  }

  return (
    <Link href={item.href} className={className} style={style}>
      {inner}
    </Link>
  );
}

export function ContentCalendar({ items, loading, error, onRetry }: ContentCalendarProps) {
  const [view, setView] = useState<CalendarView>("month");
  const [anchor, setAnchor] = useState(() => new Date());
  const [filters, setFilters] = useState<ActivityFilters>({
    status: "all",
    platform: "all",
    account: "all",
  });

  const accounts = useMemo(() => accountOptions(items), [items]);
  const visible = useMemo(() => filterActivity(items, filters), [items, filters]);
  const days = view === "month" ? monthGrid(anchor) : view === "week" ? weekDays(anchor) : [new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate())];

  const heading =
    view === "day"
      ? anchor.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" })
      : anchor.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  const selectStyle = {
    background: colors.background,
    color: colors.foreground,
    border: `1px solid ${colors.border}`,
  };

  return (
    <section
      className="min-w-0 rounded-2xl p-4"
      style={{
        background: colors.gradientCard,
        border: `1px solid ${colors.border}`,
        boxShadow: colors.shadowSoft,
      }}
      aria-labelledby="calendar-heading"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 id="calendar-heading" className="text-sm font-semibold" style={{ color: colors.foreground }}>
            Publishing activity
          </h2>
          <p className="mt-0.5 text-xs" style={{ color: colors.mutedForeground }}>
            Facebook posts and generated creatives, using your local timezone.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="skx-focus rounded-lg px-2.5 py-1.5 text-xs"
            style={selectStyle}
            onClick={() => setAnchor(shiftAnchor(anchor, view, -1))}
            aria-label="Previous period"
          >
            ‹
          </button>
          <button
            type="button"
            className="skx-focus rounded-lg px-2.5 py-1.5 text-xs font-medium"
            style={selectStyle}
            onClick={() => setAnchor(new Date())}
          >
            Today
          </button>
          <button
            type="button"
            className="skx-focus rounded-lg px-2.5 py-1.5 text-xs"
            style={selectStyle}
            onClick={() => setAnchor(shiftAnchor(anchor, view, 1))}
            aria-label="Next period"
          >
            ›
          </button>
          <div className="flex overflow-hidden rounded-lg" style={{ border: `1px solid ${colors.border}` }} role="group" aria-label="Calendar view">
            {(["month", "week", "day"] as CalendarView[]).map((option) => {
              const active = view === option;
              return (
                <button
                  key={option}
                  type="button"
                  aria-pressed={active}
                  className="skx-focus px-2.5 py-1.5 text-xs capitalize"
                  style={{
                    background: active ? colors.primary : colors.background,
                    color: active ? colors.primaryForeground : colors.foreground,
                  }}
                  onClick={() => setView(option)}
                >
                  {option}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <p className="mt-3 text-sm font-medium" style={{ color: colors.foreground }}>
        {heading}
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <label className="sr-only" htmlFor="calendar-status">Status</label>
        <select
          id="calendar-status"
          className="skx-focus rounded-lg px-2 py-1.5 text-xs"
          style={selectStyle}
          value={filters.status}
          onChange={(event) =>
            setFilters((current) => ({ ...current, status: event.target.value as ActivityFilters["status"] }))
          }
        >
          <option value="all">All statuses</option>
          {(Object.keys(STATUS_LABEL) as ActivityStatus[]).map((status) => (
            <option key={status} value={status}>{STATUS_LABEL[status]}</option>
          ))}
        </select>
        <label className="sr-only" htmlFor="calendar-platform">Platform</label>
        <select
          id="calendar-platform"
          className="skx-focus rounded-lg px-2 py-1.5 text-xs"
          style={selectStyle}
          value={filters.platform}
          onChange={(event) =>
            setFilters((current) => ({ ...current, platform: event.target.value as ActivityFilters["platform"] }))
          }
        >
          <option value="all">All platforms</option>
          <option value="facebook">Facebook</option>
          <option value="workspace">Workspace creatives</option>
        </select>
        {accounts.length > 0 ? (
          <>
            <label className="sr-only" htmlFor="calendar-account">Account</label>
            <select
              id="calendar-account"
              className="skx-focus max-w-[12rem] rounded-lg px-2 py-1.5 text-xs"
              style={selectStyle}
              value={filters.account}
              onChange={(event) => setFilters((current) => ({ ...current, account: event.target.value }))}
            >
              <option value="all">All accounts</option>
              {accounts.map((account) => (
                <option key={account} value={account}>{account}</option>
              ))}
            </select>
          </>
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap gap-3 text-[11px]" style={{ color: colors.mutedForeground }}>
        {(Object.keys(STATUS_LABEL) as ActivityStatus[]).map((status) => (
          <span key={status} className="inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: STATUS_COLOR[status] }} />
            {STATUS_LABEL[status]}
          </span>
        ))}
      </div>

      {!loading && !error && visible.length === 0 ? (
        <div className="mt-4 rounded-xl px-4 py-3 text-sm" style={{ background: colors.background, color: colors.mutedForeground }}>
          No posts or creatives match these filters.{" "}
          <Link href="/generated-contents" className="skx-focus font-medium" style={{ color: colors.primary }}>
            Open Generated Contents
          </Link>{" "}
          to publish, or{" "}
          <Link href="/create-campaign" className="skx-focus font-medium" style={{ color: colors.primary }}>
            create a campaign
          </Link>
          .
        </div>
      ) : null}

      {loading ? (
        <p className="py-16 text-center text-sm" style={{ color: colors.mutedForeground }}>Loading publishing activity…</p>
      ) : error ? (
        <div className="py-16 text-center" role="alert">
          <p className="text-sm" style={{ color: colors.destructive }}>{error}</p>
          <button type="button" className="skx-focus mt-3 text-sm font-medium" style={{ color: colors.primary }} onClick={onRetry}>
            Try again
          </button>
        </div>
      ) : view === "day" ? (
        <DayList day={days[0]} items={itemsOnDay(visible, days[0])} />
      ) : (
        <div className="mt-3 min-w-0">
          <div className="grid grid-cols-7 gap-1">
            {WEEKDAYS.map((label) => (
              <div key={label} className="px-1 py-1 text-center text-[10px] uppercase tracking-wide" style={{ color: colors.mutedForeground }}>
                {label}
              </div>
            ))}
          </div>
          <div className={`grid grid-cols-7 gap-1 ${view === "week" ? "min-h-[280px]" : ""}`}>
            {days.map((day) => {
              const inMonth = day.getMonth() === anchor.getMonth();
              const today = localToday(day);
              const dayItems = itemsOnDay(visible, day);
              const shown = view === "week" ? dayItems : dayItems.slice(0, 2);
              const extra = dayItems.length - shown.length;
              return (
                <div
                  key={`${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`}
                  className={`min-w-0 rounded-lg p-1 ${view === "week" ? "min-h-[240px]" : "min-h-[92px] sm:min-h-[112px]"}`}
                  style={{
                    background: today ? colors.accent : colors.background,
                    border: `1px solid ${today ? colors.primary : colors.border}`,
                    opacity: view === "month" && !inMonth ? 0.45 : 1,
                  }}
                >
                  <button
                    type="button"
                    className="skx-focus mb-1 rounded px-1 text-[11px] font-medium"
                    style={{ color: today ? colors.primary : colors.foreground }}
                    onClick={() => {
                      setAnchor(day);
                      setView("day");
                    }}
                  >
                    {day.getDate()}
                  </button>
                  <div className="space-y-1">
                    {shown.map((item) => (
                      <ActivityCard key={item.id} item={item} compact={view === "month"} />
                    ))}
                    {extra > 0 ? (
                      <button
                        type="button"
                        className="skx-focus px-1 text-[10px]"
                        style={{ color: colors.primary }}
                        onClick={() => {
                          setAnchor(day);
                          setView("day");
                        }}
                      >
                        +{extra} more
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}

function localToday(day: Date) {
  const now = new Date();
  return day.getFullYear() === now.getFullYear() && day.getMonth() === now.getMonth() && day.getDate() === now.getDate();
}

function DayList({ day, items }: { day: Date; items: ActivityItem[] }) {
  if (items.length === 0) {
    return (
      <div className="py-14 text-center">
        <p className="text-sm" style={{ color: colors.foreground }}>
          Nothing on {day.toLocaleDateString(undefined, { month: "long", day: "numeric" })}.
        </p>
        <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed" style={{ color: colors.mutedForeground }}>
          Generated creatives appear on the day they were saved. Facebook posts appear on their published time, or the time they were created if they have not published.
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
          <Link href="/generated-contents" className="skx-focus text-sm font-medium" style={{ color: colors.primary }}>
            Open Generated Contents
          </Link>
          <Link href="/create-campaign" className="skx-focus text-sm font-medium" style={{ color: colors.mutedForeground }}>
            Create a campaign
          </Link>
        </div>
      </div>
    );
  }

  return (
    <ul className="mt-4 space-y-2">
      {items.map((item) => (
        <li key={item.id}>
          <ActivityCard item={item} />
        </li>
      ))}
    </ul>
  );
}
