export type ActivityStatus =
  | "draft"
  | "publishing"
  | "published"
  | "failed"
  | "unpublished";

export type ActivityPlatform = "facebook" | "workspace";

export type CalendarView = "month" | "week" | "day";

export type ActivityItem = {
  id: string;
  kind: "post" | "creative";
  title: string;
  caption: string | null;
  imageUrl: string | null;
  occurredAt: string;
  status: ActivityStatus;
  platform: ActivityPlatform;
  account: string | null;
  href: string;
  external: boolean;
};

export type ActivityFilters = {
  status: "all" | ActivityStatus;
  platform: "all" | ActivityPlatform;
  account: string;
};

const KNOWN_STATUSES: ActivityStatus[] = [
  "draft",
  "publishing",
  "published",
  "failed",
  "unpublished",
];

export type SocialActivityInput = {
  id: string;
  status?: string | null;
  caption?: string | null;
  sourceImageUrl?: string | null;
  destinationPageName?: string | null;
  permalink?: string | null;
  publishedAt?: string | null;
  createdAt?: string | null;
};

export type CreativeActivityInput = {
  id: string;
  mediaUrl?: string | null;
  label?: string | null;
  createdAt?: string | null;
  publish?: { status?: string | null; socialPostId?: string | null } | null;
};

function normalizeStatus(status?: string | null): ActivityStatus {
  if (status && (KNOWN_STATUSES as string[]).includes(status)) {
    return status as ActivityStatus;
  }
  return "draft";
}

function titleFromCaption(caption: string | null | undefined, fallback: string) {
  const text = (caption || "").replace(/\s+/g, " ").trim();
  if (!text) return fallback;
  return text.length > 80 ? `${text.slice(0, 77)}…` : text;
}

export function buildActivity(
  posts: SocialActivityInput[],
  creatives: CreativeActivityInput[]
): ActivityItem[] {
  const items: ActivityItem[] = [];

  for (const post of posts) {
    const occurredAt = post.publishedAt || post.createdAt;
    if (!occurredAt) continue;
    const permalink = post.permalink?.trim() || "";
    items.push({
      id: `post:${post.id}`,
      kind: "post",
      title: titleFromCaption(post.caption, "Facebook post"),
      caption: post.caption ?? null,
      imageUrl: post.sourceImageUrl ?? null,
      occurredAt,
      status: normalizeStatus(post.status),
      platform: "facebook",
      account: post.destinationPageName?.trim() || null,
      href: permalink || "/generated-contents",
      external: Boolean(permalink),
    });
  }

  for (const creative of creatives) {
    if (creative.publish?.socialPostId) continue;
    if (!creative.createdAt) continue;
    const publishStatus = creative.publish?.status;
    const hasPublishRecord = Boolean(publishStatus && publishStatus !== "unpublished");
    items.push({
      id: `creative:${creative.id}`,
      kind: "creative",
      title: titleFromCaption(creative.label, "Generated creative"),
      caption: creative.label ?? null,
      imageUrl: creative.mediaUrl ?? null,
      occurredAt: creative.createdAt,
      status: hasPublishRecord ? normalizeStatus(publishStatus) : "unpublished",
      platform: hasPublishRecord ? "facebook" : "workspace",
      account: null,
      href: "/generated-contents",
      external: false,
    });
  }

  return items.sort(
    (a, b) => +new Date(b.occurredAt) - +new Date(a.occurredAt)
  );
}

export function filterActivity(items: ActivityItem[], filters: ActivityFilters) {
  return items.filter((item) => {
    if (filters.status !== "all" && item.status !== filters.status) return false;
    if (filters.platform !== "all" && item.platform !== filters.platform) return false;
    if (filters.account !== "all" && (item.account || "") !== filters.account) {
      return false;
    }
    return true;
  });
}

export function accountOptions(items: ActivityItem[]) {
  const names = new Set<string>();
  for (const item of items) {
    if (item.account) names.add(item.account);
  }
  return [...names].sort((a, b) => a.localeCompare(b));
}

export function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function localDayKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

export function activityDayKey(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return localDayKey(date);
}

export function monthGrid(anchor: Date) {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });
}

export function weekDays(anchor: Date) {
  const start = startOfLocalDay(anchor);
  start.setDate(start.getDate() - start.getDay());
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });
}

export function shiftAnchor(anchor: Date, view: CalendarView, direction: -1 | 1) {
  const next = new Date(anchor);
  if (view === "month") next.setMonth(next.getMonth() + direction);
  else if (view === "week") next.setDate(next.getDate() + 7 * direction);
  else next.setDate(next.getDate() + direction);
  return next;
}

export function itemsOnDay(items: ActivityItem[], day: Date) {
  const key = localDayKey(day);
  return items.filter((item) => activityDayKey(item.occurredAt) === key);
}

export type PipelineCounts = {
  unpublished: number;
  drafts: number;
  publishing: number;
  published: number;
  failed: number;
  campaignDrafts: number;
  campaignPublished: number;
};

export function pipelineCounts(
  items: ActivityItem[],
  campaigns: Array<{ is_published?: boolean }>
): PipelineCounts {
  const count = (status: ActivityStatus) =>
    items.filter((item) => item.status === status).length;
  return {
    unpublished: count("unpublished"),
    drafts: count("draft"),
    publishing: count("publishing"),
    published: count("published"),
    failed: count("failed"),
    campaignDrafts: campaigns.filter((c) => !c.is_published).length,
    campaignPublished: campaigns.filter((c) => !!c.is_published).length,
  };
}
