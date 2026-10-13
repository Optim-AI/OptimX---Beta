/**
 * Meta Graph multipart upload client (metaGraphUpload) + metaGraphPost regression.
 * Run: npx --yes tsx lib/ads/providers/meta/client.upload.test.ts
 *
 * No live Meta requests.
 */
import assert from "assert";
import {
  MetaGraphError,
  metaGraphPost,
  metaGraphUpload,
  metaGraphVersion,
  redactMetaSecrets,
} from "@/lib/ads/providers/meta/client";

const SECRET = "EAABsbCS1iHgTOKEN_FOR_UPLOAD_TESTS_ONLY_abcdefghijklmnopqrstuvwxyz";

function mockResponse(body: unknown, init: { status?: number } = {}): Response {
  const status = init.status ?? 200;
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

async function main() {
  // Successful multipart — FormData body, token not in URL, no Content-Type override, no retry
  {
    let calls = 0;
    const jpeg = Buffer.from([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0xff,
      0xd9,
    ]);
    const fetchImpl: typeof fetch = async (input, init) => {
      calls += 1;
      assert.strictEqual(init?.method, "POST");
      const url = String(input);
      assert.ok(url.includes(`graph.facebook.com/v${metaGraphVersion()}/`));
      assert.ok(url.includes("act_999/adimages"));
      assert.ok(!url.includes(SECRET), "token must not appear in URL");
      assert.ok(
        !(init?.headers as any)?.["Content-Type"] &&
          !(init?.headers as any)?.["content-type"],
        "multipart must not set Content-Type manually"
      );
      assert.ok(init?.body instanceof FormData, "body must be FormData");
      const form = init!.body as FormData;
      assert.ok(form.has("access_token"));
      assert.ok(form.has("filename"));
      // Token present in form but we never stringify it into assertions that leak to logs
      assert.strictEqual(form.get("access_token"), SECRET);
      return mockResponse({
        images: {
          "photo.jpg": { hash: "abc123hash", width: 100, height: 80 },
        },
      });
    };

    const json = await metaGraphUpload<{
      images: Record<string, { hash: string }>;
    }>("act_999/adimages", SECRET, {
      file: {
        fieldName: "filename",
        buffer: jpeg,
        filename: "photo.jpg",
        contentType: "image/jpeg",
      },
      fetchImpl,
    });
    assert.strictEqual(json.images["photo.jpg"].hash, "abc123hash");
    assert.strictEqual(calls, 1, "must not retry upload");
  }

  // Reserved field in fields rejected — no fetch
  {
    let calls = 0;
    const fetchImpl: typeof fetch = async () => {
      calls += 1;
      return mockResponse({});
    };
    let caught: unknown;
    try {
      await metaGraphUpload("act_1/adimages", SECRET, {
        file: {
          fieldName: "filename",
          buffer: Buffer.from([1, 2, 3]),
          filename: "x.jpg",
          contentType: "image/jpeg",
        },
        fields: { access_token: "EAAAttackerTokenShouldNeverBeSent_xxxxxxxxxxxx" },
        fetchImpl,
      });
    } catch (e) {
      caught = e;
    }
    assert.ok(caught instanceof MetaGraphError);
    assert.strictEqual(calls, 0);
  }

  // Reserved file field name rejected
  {
    let caught: unknown;
    try {
      await metaGraphUpload("act_1/adimages", SECRET, {
        file: {
          fieldName: "access_token",
          buffer: Buffer.from([1, 2, 3]),
          filename: "x.jpg",
          contentType: "image/jpeg",
        },
        fetchImpl: async () => mockResponse({}),
      });
    } catch (e) {
      caught = e;
    }
    assert.ok(caught instanceof MetaGraphError);
    assert.ok((caught as MetaGraphError).message.includes("access_token"));
  }

  // Empty file rejected
  {
    let caught: unknown;
    try {
      await metaGraphUpload("act_1/adimages", SECRET, {
        file: {
          fieldName: "filename",
          buffer: Buffer.alloc(0),
          filename: "x.jpg",
          contentType: "image/jpeg",
        },
      });
    } catch (e) {
      caught = e;
    }
    assert.ok(caught instanceof MetaGraphError);
    assert.ok((caught as MetaGraphError).message.includes("empty"));
  }

  // Graph permission-style error
  {
    const fetchImpl: typeof fetch = async () =>
      mockResponse(
        {
          error: {
            message: `(#200) Permissions error access_token=${SECRET}`,
            type: "OAuthException",
            code: 200,
            fbtrace_id: "UP1",
          },
        },
        { status: 403 }
      );
    let caught: unknown;
    try {
      await metaGraphUpload("act_1/adimages", SECRET, {
        file: {
          fieldName: "filename",
          buffer: Buffer.from([1, 2, 3, 4]),
          filename: "x.jpg",
          contentType: "image/jpeg",
        },
        fetchImpl,
      });
    } catch (e) {
      caught = e;
    }
    assert.ok(caught instanceof MetaGraphError);
    assert.strictEqual((caught as MetaGraphError).code, 200);
    assert.ok(!(caught as MetaGraphError).message.includes(SECRET));
  }

  // Rate limit code
  {
    const fetchImpl: typeof fetch = async () =>
      mockResponse(
        {
          error: {
            message: "Application request limit reached",
            type: "OAuthException",
            code: 4,
            fbtrace_id: "RL1",
          },
        },
        { status: 400 }
      );
    let caught: unknown;
    try {
      await metaGraphUpload("act_1/adimages", SECRET, {
        file: {
          fieldName: "filename",
          buffer: Buffer.from([1, 2, 3, 4]),
          filename: "x.jpg",
          contentType: "image/jpeg",
        },
        fetchImpl,
      });
    } catch (e) {
      caught = e;
    }
    assert.ok(caught instanceof MetaGraphError);
    assert.strictEqual((caught as MetaGraphError).code, 4);
  }

  // Timeout — no retry
  {
    let calls = 0;
    const fetchImpl: typeof fetch = async (_input, init) => {
      calls += 1;
      const signal = init?.signal;
      return await new Promise<Response>((_resolve, reject) => {
        signal?.addEventListener("abort", () => {
          reject(Object.assign(new Error("Aborted"), { name: "AbortError" }));
        });
      });
    };
    let caught: unknown;
    try {
      await metaGraphUpload("act_1/adimages", SECRET, {
        file: {
          fieldName: "filename",
          buffer: Buffer.from([1, 2, 3, 4]),
          filename: "x.jpg",
          contentType: "image/jpeg",
        },
        fetchImpl,
        timeoutMs: 15,
      });
    } catch (e) {
      caught = e;
    }
    assert.ok(caught instanceof MetaGraphError);
    assert.strictEqual((caught as MetaGraphError).kind, "timeout");
    assert.strictEqual(calls, 1, "timeout must not auto-retry");
  }

  // Non-JSON success body
  {
    const fetchImpl: typeof fetch = async () =>
      ({
        ok: true,
        status: 200,
        json: async () => {
          throw new SyntaxError("Unexpected token <");
        },
      }) as unknown as Response;
    let caught: unknown;
    try {
      await metaGraphUpload("act_1/adimages", SECRET, {
        file: {
          fieldName: "filename",
          buffer: Buffer.from([1, 2, 3, 4]),
          filename: "x.jpg",
          contentType: "image/jpeg",
        },
        fetchImpl,
      });
    } catch (e) {
      caught = e;
    }
    assert.ok(caught instanceof MetaGraphError);
    assert.strictEqual((caught as MetaGraphError).kind, "parse");
  }

  // redactMetaSecrets still works
  {
    const red = redactMetaSecrets(`access_token=${SECRET}`);
    assert.ok(!red.includes(SECRET));
  }

  // metaGraphPost regression — still form-urlencoded, unchanged behavior
  {
    let calls = 0;
    const fetchImpl: typeof fetch = async (_input, init) => {
      calls += 1;
      assert.strictEqual(
        (init?.headers as any)?.["Content-Type"],
        "application/x-www-form-urlencoded"
      );
      assert.ok(!(init?.body instanceof FormData));
      return mockResponse({ id: "camp_reg" });
    };
    const json = await metaGraphPost<{ id: string }>(
      "act_1/campaigns",
      SECRET,
      { name: "x", status: "PAUSED" },
      { fetchImpl }
    );
    assert.strictEqual(json.id, "camp_reg");
    assert.strictEqual(calls, 1);
  }

  console.log("client.upload.test.ts: ok");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
