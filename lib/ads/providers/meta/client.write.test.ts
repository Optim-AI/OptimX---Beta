/**
 * Meta Graph write client (metaGraphPost) + GET regression + secret redaction.
 * Run: npx --yes tsx lib/ads/providers/meta/client.write.test.ts
 *
 * No real Meta campaign-write requests.
 */
import assert from "assert";
import {
  MetaGraphError,
  metaGraphGet,
  metaGraphPost,
  metaGraphVersion,
  normalizeMetaGraphError,
  redactMetaSecrets,
} from "@/lib/ads/providers/meta/client";

const SECRET = "EAABsbCS1iHgTOKEN_FOR_TESTS_ONLY_abcdefghijklmnopqrstuvwxyz";

function mockResponse(body: unknown, init: { status?: number } = {}): Response {
  const status = init.status ?? 200;
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

async function main() {
  // Version helper still works
  assert.ok(typeof metaGraphVersion() === "string" && metaGraphVersion().length > 0);

  // Successful POST — parses JSON, sends form body with token, no auto-retry
  {
    let calls = 0;
    const fetchImpl: typeof fetch = async (input, init) => {
      calls += 1;
      assert.strictEqual(init?.method, "POST");
      const url = String(input);
      assert.ok(url.includes(`graph.facebook.com/v${metaGraphVersion()}/`));
      assert.ok(url.includes("act_123/campaigns"));
      assert.ok(!url.includes(SECRET), "token must not appear in URL");
      const body = String(init?.body || "");
      assert.ok(body.includes(`access_token=${encodeURIComponent(SECRET)}`) || body.includes(SECRET));
      assert.ok(body.includes("name=Test+Campaign") || body.includes("name=Test Campaign"));
      return mockResponse({ id: "camp_1", success: true });
    };

    const json = await metaGraphPost<{ id: string }>(
      "act_123/campaigns",
      SECRET,
      { name: "Test Campaign", status: "PAUSED", objective: "OUTCOME_AWARENESS" },
      { fetchImpl }
    );
    assert.strictEqual(json.id, "camp_1");
    assert.strictEqual(calls, 1, "must not retry POST");
  }

  // Graph error normalization — safe message, code/type/fbtrace_id/http
  {
    const fetchImpl: typeof fetch = async () =>
      mockResponse(
        {
          error: {
            message: `Invalid parameter access_token=${SECRET}`,
            type: "OAuthException",
            code: 100,
            fbtrace_id: "TRACE123",
            error_user_msg: "Check the campaign name.",
          },
        },
        { status: 400 }
      );

    let caught: unknown;
    try {
      await metaGraphPost("act_1/campaigns", SECRET, { name: "x" }, { fetchImpl });
    } catch (e) {
      caught = e;
    }
    assert.ok(caught instanceof MetaGraphError);
    const err = caught as MetaGraphError;
    assert.strictEqual(err.code, 100);
    assert.strictEqual(err.type, "OAuthException");
    assert.strictEqual(err.fbtrace_id, "TRACE123");
    assert.strictEqual(err.httpStatus, 400);
    assert.ok(err.message.includes("Check the campaign name."));
    assert.ok(!err.message.includes(SECRET), "token must not leak in error message");
    assert.ok(err.message.includes("code=100"));
  }

  // normalizeMetaGraphError helper
  {
    const err = normalizeMetaGraphError(
      { message: `tok ${SECRET}`, code: 190, type: "OAuthException", fbtrace_id: "x" },
      401
    );
    assert.ok(!err.message.includes(SECRET));
    assert.strictEqual(err.httpStatus, 401);
  }

  // HTTP failure without Graph error body
  {
    const fetchImpl: typeof fetch = async () =>
      mockResponse({ ok: false }, { status: 503 });
    let caught: unknown;
    try {
      await metaGraphPost("act_1/campaigns", SECRET, {}, { fetchImpl });
    } catch (e) {
      caught = e;
    }
    assert.ok(caught instanceof MetaGraphError);
    assert.strictEqual((caught as MetaGraphError).kind, "http");
    assert.strictEqual((caught as MetaGraphError).httpStatus, 503);
  }

  // Network failure
  {
    const fetchImpl: typeof fetch = async () => {
      throw new Error("ECONNRESET");
    };
    let caught: unknown;
    try {
      await metaGraphPost("act_1/campaigns", SECRET, {}, { fetchImpl });
    } catch (e) {
      caught = e;
    }
    assert.ok(caught instanceof MetaGraphError);
    assert.strictEqual((caught as MetaGraphError).kind, "network");
  }

  // Timeout via AbortError — message reflects custom timeoutMs
  {
    const fetchImpl: typeof fetch = async (_input, init) => {
      const signal = init?.signal;
      return await new Promise<Response>((_resolve, reject) => {
        if (signal?.aborted) {
          reject(Object.assign(new Error("Aborted"), { name: "AbortError" }));
          return;
        }
        signal?.addEventListener("abort", () => {
          reject(Object.assign(new Error("Aborted"), { name: "AbortError" }));
        });
      });
    };
    let caught: unknown;
    try {
      await metaGraphPost("act_1/campaigns", SECRET, {}, {
        fetchImpl,
        timeoutMs: 20,
      });
    } catch (e) {
      caught = e;
    }
    assert.ok(caught instanceof MetaGraphError);
    assert.strictEqual((caught as MetaGraphError).kind, "timeout");
    assert.ok(
      (caught as MetaGraphError).message.includes("20ms"),
      "timeout message must use configured timeoutMs"
    );
    assert.ok(!(caught as MetaGraphError).message.includes("30000"));
  }

  // params.access_token cannot override server token (rejected)
  {
    let calls = 0;
    const ATTACKER = "EAAAttackerTokenShouldNeverBeSent_xxxxxxxxxxxxxxxxxxxx";
    const fetchImpl: typeof fetch = async () => {
      calls += 1;
      return mockResponse({ id: "should_not_happen" });
    };
    let caught: unknown;
    try {
      await metaGraphPost(
        "act_1/campaigns",
        SECRET,
        { name: "x", access_token: ATTACKER } as any,
        { fetchImpl }
      );
    } catch (e) {
      caught = e;
    }
    assert.ok(caught instanceof MetaGraphError);
    assert.strictEqual(calls, 0, "must not fetch when reserved param present");
    assert.ok(!(caught as MetaGraphError).message.includes(SECRET));
    assert.ok(!(caught as MetaGraphError).message.includes(ATTACKER));
  }

  // appsecret_proof also reserved
  {
    let caught: unknown;
    try {
      await metaGraphPost(
        "act_1/campaigns",
        SECRET,
        { appsecret_proof: "evil" } as any,
        { fetchImpl: async () => mockResponse({}) }
      );
    } catch (e) {
      caught = e;
    }
    assert.ok(caught instanceof MetaGraphError);
    assert.ok((caught as MetaGraphError).message.includes("appsecret_proof"));
  }

  // HTTP 200 with non-JSON body → parse error, no raw body in message
  {
    const fetchImpl: typeof fetch = async () =>
      ({
        ok: true,
        status: 200,
        json: async () => {
          throw new SyntaxError("Unexpected token < in JSON");
        },
      }) as unknown as Response;
    let caught: unknown;
    try {
      await metaGraphPost("act_1/campaigns", SECRET, { name: "x" }, { fetchImpl });
    } catch (e) {
      caught = e;
    }
    assert.ok(caught instanceof MetaGraphError);
    assert.strictEqual((caught as MetaGraphError).kind, "parse");
    assert.strictEqual((caught as MetaGraphError).httpStatus, 200);
    assert.ok(!(caught as MetaGraphError).message.includes("<html"));
    assert.ok(!(caught as MetaGraphError).message.includes(SECRET));
  }

  // Missing token
  {
    let caught: unknown;
    try {
      await metaGraphPost("act_1/campaigns", "  ", {});
    } catch (e) {
      caught = e;
    }
    assert.ok(caught instanceof MetaGraphError);
  }

  // redactMetaSecrets
  {
    const raw = `fail access_token=${SECRET} and ${SECRET}`;
    const red = redactMetaSecrets(raw);
    assert.ok(!red.includes(SECRET));
    assert.ok(red.includes("[REDACTED]"));
  }

  // GET regression — success + graph error fields (mocked)
  {
    const orig = globalThis.fetch;
    globalThis.fetch = (async () =>
      mockResponse({ data: [{ id: "1" }] })) as typeof fetch;
    try {
      const json = await metaGraphGet<{ data: { id: string }[] }>(
        "me/adaccounts",
        SECRET,
        { fields: "id" }
      );
      assert.strictEqual(json.data[0].id, "1");
    } finally {
      globalThis.fetch = orig;
    }
  }

  {
    const orig = globalThis.fetch;
    globalThis.fetch = (async () =>
      mockResponse(
        {
          error: {
            message: "(#100) bad",
            code: 100,
            type: "GraphMethodException",
            fbtrace_id: "g1",
          },
        },
        { status: 400 }
      )) as typeof fetch;
    try {
      let caught: unknown;
      try {
        await metaGraphGet("me", SECRET);
      } catch (e) {
        caught = e;
      }
      assert.ok(caught instanceof MetaGraphError);
      assert.strictEqual((caught as MetaGraphError).code, 100);
      assert.strictEqual((caught as MetaGraphError).type, "GraphMethodException");
      assert.strictEqual((caught as MetaGraphError).fbtrace_id, "g1");
    } finally {
      globalThis.fetch = orig;
    }
  }

  console.log("client.write.test.ts: ok");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
