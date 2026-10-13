/**
 * Trusted Meta Ads write-context loader (PR W1.3 / W2.3B).
 * Run: npx --yes tsx lib/ads/providers/meta/load-write-context.test.ts
 *
 * Mocked DB + token reveal only — no live Meta Graph calls.
 */
import assert from "assert";
import {
  loadMetaAdsWriteContext,
  MetaAdsWriteAuthError,
  type LoadMetaAdsWriteContextDeps,
} from "@/lib/ads/providers/meta/load-write-context";
import { assertMetaAdsPageBoundForCreative } from "@/lib/ads/providers/meta/write-context";
import { mapMetaAdsStoredTokens } from "@/lib/ads/providers/meta/token-contract";

const USER = "user-aaa";
const OTHER = "user-bbb";
const INTEG = "integ-meta-1";
const ACCT_ROW = "adacct-row-1";
const EXT_ACCT = "123456789";
const PAGE_ID = "page-999";
/** User Ads token — stored in integrations.refresh_token for provider=meta */
const USER_TOKEN = "EAABsbCS1iHg_USER_ADS_TOKEN_abcdefghijklmnop";
/** Page token — stored in integrations.access_token for provider=meta */
const PAGE_TOKEN = "EAABsbCS1iHg_PAGE_TOKEN_zyxwvutsrqponmlkjihg";

function integration(overrides: Record<string, unknown> = {}) {
  return {
    id: INTEG,
    userId: USER,
    provider: "meta",
    accessToken: "enc:v1:page",
    refreshToken: "enc:v1:user",
    pageId: PAGE_ID,
    healthStatus: "healthy",
    adAccountId: "should-never-be-used-as-fallback",
    ...overrides,
  } as any;
}

function selectedAccount(overrides: Record<string, unknown> = {}) {
  return {
    id: ACCT_ROW,
    integrationId: INTEG,
    accountId: EXT_ACCT,
    provider: "meta",
    currency: "INR",
    isSelected: true,
    name: "Test Act",
    ...overrides,
  } as any;
}

function expectCode(
  p: Promise<unknown>,
  code: MetaAdsWriteAuthError["code"]
): Promise<void> {
  return p.then(
    () => {
      throw new Error(`expected failure ${code}`);
    },
    (e) => {
      assert.ok(e instanceof MetaAdsWriteAuthError, String(e));
      assert.strictEqual(e.code, code);
      assert.ok(!String(e.message).includes(USER_TOKEN));
      assert.ok(!String(e.message).includes(PAGE_TOKEN));
    }
  );
}

function deps(
  partial: Partial<LoadMetaAdsWriteContextDeps> & {
    integration?: any | null;
    account?: any | null;
    reveal?: LoadMetaAdsWriteContextDeps["revealTokens"];
    listCalled?: { n: number };
  } = {}
): LoadMetaAdsWriteContextDeps {
  const listCalled = partial.listCalled || { n: 0 };
  return {
    findIntegrationByUserAndProvider: async (userId, provider) => {
      assert.strictEqual(provider, "meta");
      if (partial.findIntegrationByUserAndProvider) {
        return partial.findIntegrationByUserAndProvider(userId, provider);
      }
      if (partial.integration === null) return null;
      const row = partial.integration ?? integration();
      // Simulate DAO filter: only return when user matches
      if (String(row.userId) !== userId) return null;
      if (String(row.provider) !== "meta") return null;
      return row;
    },
    findSelectedAdAccount: async (integrationId) => {
      listCalled.n += 1;
      if (partial.findSelectedAdAccount) {
        return partial.findSelectedAdAccount(integrationId);
      }
      if (partial.account === null) return null;
      const row = partial.account ?? selectedAccount();
      if (String(row.integrationId) !== integrationId) return null;
      if (!row.isSelected) return null;
      return row;
    },
    revealTokens:
      partial.reveal ||
      partial.revealTokens ||
      (() => ({
        // Column mapping: access_token = Page, refresh_token = User
        accessToken: PAGE_TOKEN,
        refreshToken: USER_TOKEN,
      })),
  };
}

async function main() {
  // Column mapper never swaps types
  {
    const m = mapMetaAdsStoredTokens({
      accessToken: PAGE_TOKEN,
      refreshToken: USER_TOKEN,
    });
    assert.strictEqual(m.pageAccessToken, PAGE_TOKEN);
    assert.strictEqual(m.userAccessToken, USER_TOKEN);
  }

  // Valid path — user token for act_*, page id + page token separate
  {
    const ctx = await loadMetaAdsWriteContext(USER, deps());
    assert.strictEqual(ctx.provider, "meta");
    assert.strictEqual(ctx.userId, USER);
    assert.strictEqual(ctx.integrationId, INTEG);
    assert.strictEqual(ctx.adAccountRowId, ACCT_ROW);
    assert.strictEqual(ctx.accountExternalId, EXT_ACCT);
    assert.strictEqual(ctx.actId, `act_${EXT_ACCT}`);
    assert.strictEqual(ctx.currency, "INR");
    assert.strictEqual(ctx.userAccessToken, USER_TOKEN);
    assert.strictEqual(ctx.accessToken, USER_TOKEN);
    assert.notStrictEqual(ctx.accessToken, PAGE_TOKEN);
    assert.strictEqual(ctx.pageId, PAGE_ID);
    assert.strictEqual(ctx.pageAccessToken, PAGE_TOKEN);
    assertMetaAdsPageBoundForCreative(ctx);
  }

  // Unauthenticated
  await expectCode(loadMetaAdsWriteContext(null, deps()), "unauthenticated");
  await expectCode(loadMetaAdsWriteContext("", deps()), "unauthenticated");
  await expectCode(loadMetaAdsWriteContext("  ", deps()), "unauthenticated");

  // No Meta Ads integration
  await expectCode(
    loadMetaAdsWriteContext(USER, deps({ integration: null })),
    "no_integration"
  );

  // Integration belonging to another user (DAO returns null for wrong user)
  await expectCode(
    loadMetaAdsWriteContext(OTHER, deps({ integration: integration() })),
    "no_integration"
  );

  // Owner mismatch if a buggy DAO returns another user's row
  await expectCode(
    loadMetaAdsWriteContext(
      USER,
      deps({
        findIntegrationByUserAndProvider: async () =>
          integration({ userId: OTHER }),
      })
    ),
    "integration_owner_mismatch"
  );

  // Missing / unselected account — no first-account fallback
  {
    const listCalled = { n: 0 };
    await expectCode(
      loadMetaAdsWriteContext(
        USER,
        deps({ account: null, listCalled })
      ),
      "no_selected_account"
    );
    assert.strictEqual(listCalled.n, 1, "only findSelected consulted");
  }

  // Account belonging to another integration
  await expectCode(
    loadMetaAdsWriteContext(
      USER,
      deps({
        findSelectedAdAccount: async () =>
          selectedAccount({ integrationId: "other-integ" }),
      })
    ),
    "account_integration_mismatch"
  );

  // Account not explicitly selected
  await expectCode(
    loadMetaAdsWriteContext(
      USER,
      deps({
        findSelectedAdAccount: async () =>
          selectedAccount({ isSelected: false }),
      })
    ),
    "account_not_selected"
  );

  // Currency missing on selected account
  await expectCode(
    loadMetaAdsWriteContext(
      USER,
      deps({
        account: selectedAccount({ currency: null }),
      })
    ),
    "missing_currency"
  );

  // Currency comes from stored account (USD), not assumed INR
  {
    const ctx = await loadMetaAdsWriteContext(
      USER,
      deps({ account: selectedAccount({ currency: "usd" }) })
    );
    assert.strictEqual(ctx.currency, "USD");
  }

  // Unverified currency on stored account (not in Meta offset table)
  await expectCode(
    loadMetaAdsWriteContext(
      USER,
      deps({ account: selectedAccount({ currency: "XXX" }) })
    ),
    "unverified_currency"
  );
  await expectCode(
    loadMetaAdsWriteContext(
      USER,
      deps({ account: selectedAccount({ currency: "KWD" }) })
    ),
    "unverified_currency"
  );

  // Verified Meta offset-1 currency from selected account
  {
    const ctx = await loadMetaAdsWriteContext(
      USER,
      deps({ account: selectedAccount({ currency: "IDR" }) })
    );
    assert.strictEqual(ctx.currency, "IDR");
    assert.strictEqual(ctx.currencyOffset, 1);
  }

  // Wrong provider on integration row
  await expectCode(
    loadMetaAdsWriteContext(
      USER,
      deps({
        findIntegrationByUserAndProvider: async () =>
          integration({ provider: "google-ads" }),
      })
    ),
    "wrong_provider"
  );

  // Organic publishing credentials must never be used
  for (const organic of ["meta-publish", "meta-instagram"] as const) {
    await expectCode(
      loadMetaAdsWriteContext(
        USER,
        deps({
          findIntegrationByUserAndProvider: async () =>
            integration({ provider: organic }),
        })
      ),
      "organic_provider"
    );
  }

  // Organic provider stamped on ad account
  await expectCode(
    loadMetaAdsWriteContext(
      USER,
      deps({
        account: selectedAccount({ provider: "meta-instagram" }),
      })
    ),
    "organic_provider"
  );

  // Disconnected / revoked integration
  await expectCode(
    loadMetaAdsWriteContext(
      USER,
      deps({ integration: integration({ healthStatus: "revoked" }) })
    ),
    "integration_disconnected"
  );

  // Missing **user** token (only Page token present) blocks account writes
  await expectCode(
    loadMetaAdsWriteContext(
      USER,
      deps({
        revealTokens: () => ({
          accessToken: PAGE_TOKEN,
          refreshToken: null,
        }),
      })
    ),
    "missing_user_access_token"
  );

  // Must not treat Page token as user token when refresh_token empty
  await expectCode(
    loadMetaAdsWriteContext(
      USER,
      deps({
        revealTokens: () => ({
          accessToken: PAGE_TOKEN,
          refreshToken: "",
        }),
      })
    ),
    "missing_user_access_token"
  );

  // Page token may be missing; account writes still OK if user token present
  {
    const ctx = await loadMetaAdsWriteContext(
      USER,
      deps({
        revealTokens: () => ({
          accessToken: null,
          refreshToken: USER_TOKEN,
        }),
      })
    );
    assert.strictEqual(ctx.userAccessToken, USER_TOKEN);
    assert.strictEqual(ctx.pageAccessToken, null);
    assert.strictEqual(ctx.pageId, PAGE_ID);
  }

  // Missing Page binding: load succeeds; creative guard fails
  {
    const ctx = await loadMetaAdsWriteContext(
      USER,
      deps({ integration: integration({ pageId: null }) })
    );
    assert.strictEqual(ctx.pageId, null);
    assert.strictEqual(ctx.userAccessToken, USER_TOKEN);
    let threw = false;
    try {
      assertMetaAdsPageBoundForCreative(ctx);
    } catch (e: any) {
      threw = true;
      assert.strictEqual(e.code, "missing_page_binding");
    }
    assert.ok(threw);
  }

  // Undecryptable token
  await expectCode(
    loadMetaAdsWriteContext(
      USER,
      deps({
        revealTokens: () => {
          throw new Error("Cannot decrypt integration token: bad key");
        },
      })
    ),
    "token_decrypt_failed"
  );

  // integration.adAccountId must never substitute for is_selected
  {
    let selectedCalls = 0;
    await expectCode(
      loadMetaAdsWriteContext(
        USER,
        deps({
          integration: integration({ adAccountId: EXT_ACCT }),
          findSelectedAdAccount: async () => {
            selectedCalls += 1;
            return null;
          },
        })
      ),
      "no_selected_account"
    );
    assert.strictEqual(selectedCalls, 1);
  }

  console.log("load-write-context.test.ts: ok");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
