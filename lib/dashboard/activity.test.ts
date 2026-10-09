/**
 * Dashboard publishing-activity helpers.
 * Run: npx --yes tsx lib/dashboard/activity.test.ts
 */
import assert from "assert";
import {
  accountOptions,
  buildActivity,
  filterActivity,
  itemsOnDay,
  monthGrid,
  pipelineCounts,
  shiftAnchor,
  weekDays,
} from "@/lib/dashboard/activity";

{
  const items = buildActivity(
    [
      {
        id: "p1",
        status: "published",
        caption: "Launch day",
        sourceImageUrl: "https://cdn.example/a.jpg",
        destinationPageName: "SkalX",
        permalink: "https://facebook.com/posts/1",
        publishedAt: "2026-05-21T08:30:00.000Z",
        createdAt: "2026-05-20T08:30:00.000Z",
      },
      {
        id: "p2",
        status: "failed",
        caption: "",
        createdAt: "2026-05-19T08:30:00.000Z",
      },
    ],
    [
      {
        id: "c1",
        label: "Poster",
        mediaUrl: "https://cdn.example/c.jpg",
        createdAt: "2026-05-18T08:30:00.000Z",
        publish: { status: "unpublished" },
      },
      {
        id: "c2",
        label: "Already posted",
        createdAt: "2026-05-17T08:30:00.000Z",
        publish: { status: "published", socialPostId: "p1" },
      },
    ]
  );

  assert.strictEqual(items.length, 3);
  assert.strictEqual(items[0].id, "post:p1");
  assert.strictEqual(items[0].status, "published");
  assert.strictEqual(items[0].platform, "facebook");
  assert.strictEqual(items[0].external, true);
  assert.strictEqual(items[0].occurredAt, "2026-05-21T08:30:00.000Z");
  assert.strictEqual(items.find((item) => item.id === "post:p2")?.title, "Facebook post");
  assert.strictEqual(items.find((item) => item.id === "creative:c1")?.status, "unpublished");
  assert.strictEqual(items.some((item) => item.id === "creative:c2"), false);
}

{
  const items = buildActivity(
    [
      {
        id: "p1",
        status: "published",
        destinationPageName: "Page A",
        createdAt: "2026-05-21T10:00:00.000Z",
      },
      {
        id: "p2",
        status: "draft",
        destinationPageName: "Page A",
        createdAt: "2026-05-21T11:00:00.000Z",
      },
    ],
    []
  );
  assert.deepStrictEqual(accountOptions(items), ["Page A"]);
  assert.strictEqual(
    filterActivity(items, { status: "draft", platform: "all", account: "all" }).length,
    1
  );
  assert.strictEqual(
    filterActivity(items, { status: "all", platform: "workspace", account: "all" }).length,
    0
  );
  assert.strictEqual(
    filterActivity(items, { status: "all", platform: "all", account: "Page A" }).length,
    2
  );
}

{
  const anchor = new Date(2026, 4, 21);
  const grid = monthGrid(anchor);
  assert.strictEqual(grid.length, 42);
  assert.strictEqual(grid[0].getDay(), 0);
  assert.ok(grid.some((day) => day.getFullYear() === 2026 && day.getMonth() === 4 && day.getDate() === 1));
  const week = weekDays(anchor);
  assert.strictEqual(week.length, 7);
  assert.strictEqual(week[0].getDay(), 0);
  assert.strictEqual(week[6].getDay(), 6);
  const nextMonth = shiftAnchor(anchor, "month", 1);
  assert.strictEqual(nextMonth.getMonth(), 5);
  const prevDay = shiftAnchor(anchor, "day", -1);
  assert.strictEqual(prevDay.getDate(), 20);
}

{
  const day = new Date(2026, 4, 21, 15, 0, 0);
  const iso = new Date(2026, 4, 21, 9, 15, 0).toISOString();
  const items = buildActivity(
    [{ id: "p1", status: "published", createdAt: iso, caption: "Today" }],
    []
  );
  assert.strictEqual(itemsOnDay(items, day).length, 1);
  assert.strictEqual(itemsOnDay(items, new Date(2026, 4, 22)).length, 0);
}

{
  const items = buildActivity(
    [
      { id: "a", status: "published", createdAt: "2026-01-01T00:00:00.000Z" },
      { id: "b", status: "failed", createdAt: "2026-01-02T00:00:00.000Z" },
      { id: "c", status: "draft", createdAt: "2026-01-03T00:00:00.000Z" },
    ],
    [{ id: "d", createdAt: "2026-01-04T00:00:00.000Z", publish: { status: "unpublished" } }]
  );
  const counts = pipelineCounts(items, [{ is_published: true }, { is_published: false }]);
  assert.strictEqual(counts.published, 1);
  assert.strictEqual(counts.failed, 1);
  assert.strictEqual(counts.drafts, 1);
  assert.strictEqual(counts.unpublished, 1);
  assert.strictEqual(counts.campaignPublished, 1);
  assert.strictEqual(counts.campaignDrafts, 1);
}

console.log("dashboard activity tests passed");
