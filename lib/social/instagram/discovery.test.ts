/**
 * Run: npx --yes tsx lib/social/instagram/discovery.test.ts
 */
import assert from "assert";
import {
  IG_USER_LOOKUP_FIELDS,
  discoverInstagramAccountsFromPages,
  sanitizeAccountForClient,
} from "@/lib/social/instagram/discovery";

assert.ok(
  !(IG_USER_LOOKUP_FIELDS as readonly string[]).includes("account_type"),
  "Facebook Login IG User lookup must not request account_type"
);
assert.ok((IG_USER_LOOKUP_FIELDS as readonly string[]).includes("username"));
assert.ok((IG_USER_LOOKUP_FIELDS as readonly string[]).includes("id"));

async function main() {
  const requestedUrls: string[] = [];

  const result = await discoverInstagramAccountsFromPages({
    pages: [
      {
        id: "page_skalx",
        name: "SkalX",
        access_token: "page_tok",
        tasks: ["CREATE_CONTENT", "MANAGE"],
        instagram_business_account: { id: "ig_178414" },
      },
      {
        id: "page_no_ig",
        name: "No IG Page",
        access_token: "page_tok",
      },
      {
        id: "page_bad",
        name: "Broken",
        access_token: "page_tok",
        tasks: ["CREATE_CONTENT"],
        instagram_business_account: { id: "ig_missing" },
      },
      {
        id: "same_id",
        name: "Confused",
        access_token: "page_tok",
        tasks: ["MANAGE"],
        // Invalid: IG id equals Page id
        instagram_business_account: { id: "same_id" },
      },
    ],
    fetchFn: (async (url: any) => {
      const u = String(url);
      requestedUrls.push(u);
      assert.ok(
        !u.includes("account_type"),
        "Graph request must not include account_type"
      );
      assert.ok(u.includes("fields="));
      assert.ok(
        decodeURIComponent(u).includes("id,username,profile_picture_url") ||
          u.includes(encodeURIComponent("id,username,profile_picture_url"))
      );

      if (u.includes("/ig_178414")) {
        return new Response(
          JSON.stringify({
            id: "ig_178414",
            username: "skalx_official",
            profile_picture_url: "https://cdn.example/pic.jpg",
          }),
          { status: 200 }
        );
      }
      if (u.includes("/ig_missing")) {
        return new Response(
          JSON.stringify({
            error: { message: "Unsupported get request", code: 100 },
          }),
          { status: 400 }
        );
      }
      return new Response(JSON.stringify({ error: { message: "unexpected" } }), {
        status: 400,
      });
    }) as any,
  });

  assert.strictEqual(result.pagesWithoutIg.length, 1);
  assert.strictEqual(result.pagesWithoutIg[0].pageId, "page_no_ig");
  assert.strictEqual(result.accounts.length, 3);

  const ok = result.accounts.find((a) => a.igUserId === "ig_178414");
  assert.ok(ok);
  assert.strictEqual(ok!.eligible, true);
  assert.strictEqual(ok!.igUsername, "skalx_official");
  assert.strictEqual(ok!.pageId, "page_skalx");
  assert.strictEqual(ok!.pageName, "SkalX");
  assert.strictEqual(ok!.accountType, null);
  assert.strictEqual(
    ok!.eligibilitySource,
    "page_instagram_business_account"
  );
  // Critical: IG id !== Page id
  assert.notStrictEqual(ok!.igUserId, ok!.pageId);

  const missing = result.accounts.find((a) => a.igUserId === "ig_missing");
  assert.ok(missing && !missing.eligible);
  assert.ok(missing!.ineligibilityReason);

  const confused = result.accounts.find((a) => a.pageId === "same_id");
  assert.ok(confused && !confused.eligible);

  const safe = sanitizeAccountForClient(ok!);
  assert.ok(!("pageAccessToken" in safe));
  assert.strictEqual(safe.igUserId, "ig_178414");
  assert.strictEqual(safe.linkedFacebookPageId, "page_skalx");
  assert.strictEqual(safe.hasPageToken, true);

  // Explicit selection persistence shape
  const selectedIgUserId = safe.igUserId;
  assert.strictEqual(selectedIgUserId, "ig_178414");
  assert.notStrictEqual(selectedIgUserId, "page_skalx");

  console.log("instagram discovery.test: PASS");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
