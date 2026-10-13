/**
 * Discover Instagram professional accounts linked to Facebook Pages.
 *
 * Uses Instagram API with Facebook Login (graph.facebook.com).
 * Do not request Instagram Login-only fields such as `account_type`
 * (those belong on graph.instagram.com /me and cause (#100) nonexistent field).
 *
 * Eligibility: an IG User returned via Page.instagram_business_account is already
 * a professional (Business/Creator) account linked to that Page per Meta docs.
 */

const VERSION = process.env.FACEBOOK_API_VERSION || "23.0";

/**
 * Fields supported on GET /{ig-user-id} for Facebook Login IG User nodes.
 * Keep this list conservative — unsupported fields fail the whole request.
 */
export const IG_USER_LOOKUP_FIELDS = [
  "id",
  "username",
  "profile_picture_url",
] as const;

export type InstagramEligibleAccount = {
  /** Facebook Page id */
  pageId: string;
  pageName: string;
  pageCategory?: string;
  pageAccessToken: string;
  pageTasks?: string[];
  /** Instagram professional account (IG User) id — NOT the Page id */
  igUserId: string;
  igUsername: string | null;
  igName: string | null;
  igProfilePictureUrl: string | null;
  /**
   * Always null for Facebook Login discovery — account_type is not available
   * on this API. Professional status is inferred from Page linkage.
   */
  accountType: string | null;
  /** How professional eligibility was determined */
  eligibilitySource: "page_instagram_business_account" | "unverifiable";
  eligible: boolean;
  ineligibilityReason?: string;
};

export type DiscoverInstagramAccountsResult = {
  accounts: InstagramEligibleAccount[];
  pagesWithoutIg: Array<{ pageId: string; pageName: string }>;
  error?: string;
};

function pageAllowsContentTasks(tasks?: string[]): boolean {
  const normalized = (tasks || []).map((t) => String(t).toUpperCase());
  // Empty tasks array from Graph is common for some tokens — do not hard-fail.
  if (normalized.length === 0) return true;
  return (
    normalized.includes("CREATE_CONTENT") ||
    normalized.includes("MANAGE") ||
    normalized.includes("MODERATE")
  );
}

/**
 * Enrich pages that have instagram_business_account with IG profile fields.
 * Does not auto-select an account.
 */
export async function discoverInstagramAccountsFromPages(opts: {
  pages: Array<{
    id: string;
    name: string;
    category?: string;
    access_token?: string;
    tasks?: string[];
    instagram_business_account?: { id: string };
  }>;
  /** User token as fallback when page token missing for IG lookup */
  userAccessToken?: string | null;
  /** Injectable for tests */
  fetchFn?: typeof fetch;
}): Promise<DiscoverInstagramAccountsResult> {
  const fetchFn = opts.fetchFn ?? fetch;
  const accounts: InstagramEligibleAccount[] = [];
  const pagesWithoutIg: Array<{ pageId: string; pageName: string }> = [];

  for (const page of opts.pages) {
    const igId = page.instagram_business_account?.id;
    if (!igId) {
      pagesWithoutIg.push({ pageId: page.id, pageName: page.name });
      continue;
    }

    // Never confuse Page id with IG User id
    if (String(igId) === String(page.id)) {
      accounts.push({
        pageId: page.id,
        pageName: page.name,
        pageCategory: page.category,
        pageAccessToken: page.access_token || "",
        pageTasks: page.tasks,
        igUserId: String(igId),
        igUsername: null,
        igName: null,
        igProfilePictureUrl: null,
        accountType: null,
        eligibilitySource: "unverifiable",
        eligible: false,
        ineligibilityReason:
          "Instagram account id matched the Facebook Page id — link looks invalid. Re-link the Instagram professional account to the Page in Meta Business Suite.",
      });
      continue;
    }

    const token = page.access_token || opts.userAccessToken;
    if (!token) {
      accounts.push({
        pageId: page.id,
        pageName: page.name,
        pageCategory: page.category,
        pageAccessToken: "",
        pageTasks: page.tasks,
        igUserId: String(igId),
        igUsername: null,
        igName: null,
        igProfilePictureUrl: null,
        accountType: null,
        eligibilitySource: "unverifiable",
        eligible: false,
        ineligibilityReason: "Missing Page access token for Instagram lookup",
      });
      continue;
    }

    try {
      const fields = IG_USER_LOOKUP_FIELDS.join(",");
      const url =
        `https://graph.facebook.com/v${VERSION}/${encodeURIComponent(igId)}` +
        `?fields=${encodeURIComponent(fields)}` +
        `&access_token=${encodeURIComponent(token)}`;
      const resp = await fetchFn(url);
      const json = await resp.json();

      if (json?.error) {
        accounts.push({
          pageId: page.id,
          pageName: page.name,
          pageCategory: page.category,
          pageAccessToken: page.access_token || "",
          pageTasks: page.tasks,
          igUserId: String(igId),
          igUsername: null,
          igName: null,
          igProfilePictureUrl: null,
          accountType: null,
          eligibilitySource: "unverifiable",
          eligible: false,
          ineligibilityReason:
            json.error.message || "Failed to load Instagram account details",
        });
        continue;
      }

      const resolvedIgId = String(json.id || igId);
      const canCreate = pageAllowsContentTasks(page.tasks);
      let eligible = Boolean(page.access_token && canCreate && resolvedIgId);
      let ineligibilityReason: string | undefined;

      if (!page.access_token) {
        eligible = false;
        ineligibilityReason = "Page access token missing";
      } else if (!canCreate) {
        eligible = false;
        ineligibilityReason =
          "Your Facebook user needs CREATE_CONTENT or MANAGE on the linked Page";
      } else if (!json.username && !resolvedIgId) {
        eligible = false;
        ineligibilityReason =
          "Instagram account details were incomplete. Reconnect and ensure instagram_basic was granted.";
      }

      accounts.push({
        pageId: page.id,
        pageName: page.name,
        pageCategory: page.category,
        pageAccessToken: page.access_token || "",
        pageTasks: page.tasks,
        igUserId: resolvedIgId,
        igUsername: json.username ? String(json.username) : null,
        igName: null,
        igProfilePictureUrl: json.profile_picture_url
          ? String(json.profile_picture_url)
          : null,
        accountType: null,
        eligibilitySource: "page_instagram_business_account",
        eligible,
        ineligibilityReason,
      });
    } catch (e: any) {
      accounts.push({
        pageId: page.id,
        pageName: page.name,
        pageCategory: page.category,
        pageAccessToken: page.access_token || "",
        pageTasks: page.tasks,
        igUserId: String(igId),
        igUsername: null,
        igName: null,
        igProfilePictureUrl: null,
        accountType: null,
        eligibilitySource: "unverifiable",
        eligible: false,
        ineligibilityReason: e?.message || "Instagram discovery failed",
      });
    }
  }

  return { accounts, pagesWithoutIg };
}

export function sanitizeAccountForClient(account: InstagramEligibleAccount) {
  return {
    pageId: account.pageId,
    pageName: account.pageName,
    pageCategory: account.pageCategory,
    igUserId: account.igUserId,
    igUsername: account.igUsername,
    igName: account.igName,
    igProfilePictureUrl: account.igProfilePictureUrl,
    accountType: account.accountType,
    eligibilitySource:
      account.eligibilitySource ?? "unverifiable",
    eligible: account.eligible,
    ineligibilityReason: account.ineligibilityReason,
    hasPageToken: Boolean(account.pageAccessToken),
    /** Explicit labels so UI never treats Page id as IG id */
    linkedFacebookPageId: account.pageId,
  };
}
