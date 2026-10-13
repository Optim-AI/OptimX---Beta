/**
 * Meta Ads trusted ad-image upload service (PR W2.4).
 * Run: npx --yes tsx lib/ads/meta/upload-ad-image.test.ts
 *
 * Mocked storage + Graph. No live Meta calls.
 */
import assert from "assert";
import { MetaGraphError } from "@/lib/ads/providers/meta/client";
import type { ResolvedMetaAdsWriteContext } from "@/lib/ads/providers/meta/write-context";
import type { MetaAdsResolvedCreative } from "@/lib/ads/meta/resolve-creative-asset";
import { MetaAdsDraftValidationError } from "@/lib/ads/meta/draft-validation";
import {
  META_ADS_ADIMAGE_MAX_BYTES,
  META_ADIMAGES_FILE_FIELD,
  MetaAdsAdImageUploadError,
  parseMetaAdImagesUploadResponse,
  uploadMetaAdsAdImage,
  validateMetaAdsAdImageBuffer,
} from "@/lib/ads/meta/upload-ad-image";

const USER = "11111111-1111-4111-8111-111111111111";
const IMAGE_ID = "22222222-2222-4222-8222-222222222222";
const SECRET = "EAAUserAdsTokenForUploadServiceTests_abcdefghijklmnopqrstuvwxyz";

const JPEG = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0xff,
  0xd9,
]);

function creative(
  overrides: Partial<MetaAdsResolvedCreative> = {}
): MetaAdsResolvedCreative {
  return {
    sourceImageId: IMAGE_ID,
    sourceImageUrl:
      "https://proj.supabase.co/storage/v1/object/public/campaign-assets/poster-generation/u/g.jpg",
    storagePath: "poster-generation/u/g.jpg",
    mediaType: "image",
    metaFetchableViaUrl: true,
    metaUrlStrategy: "meta_url",
    warnings: [],
    metadataCreative: {},
    ...overrides,
  };
}

function writeCtx(
  overrides: Partial<ResolvedMetaAdsWriteContext> = {}
): ResolvedMetaAdsWriteContext {
  return {
    provider: "meta",
    userId: USER,
    integrationId: "int-1",
    userAccessToken: SECRET,
    accessToken: SECRET,
    pageId: "page-1",
    pageAccessToken: "EAAPageTokenNotUsedForAdImages_xxxxxxxxxxxxxxxxxxxx",
    adAccountRowId: "acct-row-1",
    accountExternalId: "999888777",
    actId: "act_999888777",
    currency: "USD",
    currencyOffset: 100,
    currencyExponent: 2,
    ...overrides,
  };
}

async function main() {
  // parseMetaAdImagesUploadResponse — happy path + malformed
  {
    const ok = parseMetaAdImagesUploadResponse(
      {
        images: {
          "a.jpg": { hash: "hash_a", width: 10, height: 20 },
        },
      },
      "a.jpg"
    );
    assert.strictEqual(ok.imageHash, "hash_a");
    assert.strictEqual(ok.width, 10);

    assert.throws(
      () => parseMetaAdImagesUploadResponse({ images: {} }),
      (e: unknown) =>
        e instanceof MetaAdsAdImageUploadError &&
        e.code === "malformed_upload_response"
    );
    assert.throws(
      () =>
        parseMetaAdImagesUploadResponse({
          images: { "a.jpg": { hash: "   " } },
        }),
      (e: unknown) =>
        e instanceof MetaAdsAdImageUploadError &&
        e.code === "malformed_upload_response"
    );
  }

  // validate buffer — empty / too large / bad magic
  {
    assert.throws(
      () => validateMetaAdsAdImageBuffer(Buffer.alloc(0)),
      (e: unknown) =>
        e instanceof MetaAdsAdImageUploadError && e.code === "empty_image"
    );
    assert.throws(
      () =>
        validateMetaAdsAdImageBuffer(
          Buffer.alloc(META_ADS_ADIMAGE_MAX_BYTES + 1, 0xff)
        ),
      (e: unknown) =>
        e instanceof MetaAdsAdImageUploadError && e.code === "image_too_large"
    );
    assert.throws(
      () => validateMetaAdsAdImageBuffer(Buffer.from("not-image")),
      (e: unknown) =>
        e instanceof MetaAdsAdImageUploadError && e.code === "invalid_image"
    );
    const v = validateMetaAdsAdImageBuffer(JPEG);
    assert.strictEqual(v.mimeType, "image/jpeg");
    assert.ok(v.contentSha256.length === 64);
  }

  // Success — ownership resolve + storage download + selected account token
  {
    let downloadedBucket = "";
    let downloadedPath = "";
    let uploadPath = "";
    let uploadToken = "";
    let uploadField = "";
    let uploadCalls = 0;

    const result = await uploadMetaAdsAdImage({
      authenticatedUserId: USER,
      sourceImageId: IMAGE_ID,
      deps: {
        resolveCreative: async () => creative(),
        loadWriteContext: async () => writeCtx(),
        downloadStorageObject: async (bucket, path) => {
          downloadedBucket = bucket;
          downloadedPath = path;
          return { ok: true, buffer: JPEG };
        },
        uploadToGraph: (async (path: string, token: string, opts: any) => {
          uploadCalls += 1;
          uploadPath = path;
          uploadToken = token;
          uploadField = opts.file.fieldName;
          assert.strictEqual(opts.file.contentType, "image/jpeg");
          assert.ok(Buffer.isBuffer(opts.file.buffer) || opts.file.buffer);
          assert.ok(
            String(opts.file.filename).includes(IMAGE_ID.slice(0, 8)),
            "deterministic filename should embed asset id prefix"
          );
          return {
            images: {
              [opts.file.filename]: {
                hash: "meta_image_hash_1",
                width: 1080,
                height: 1080,
              },
            },
          };
        }) as any,
      },
    });

    assert.strictEqual(downloadedBucket, "campaign-assets");
    assert.strictEqual(downloadedPath, "poster-generation/u/g.jpg");
    assert.strictEqual(uploadPath, "act_999888777/adimages");
    assert.strictEqual(uploadToken, SECRET);
    assert.strictEqual(uploadField, META_ADIMAGES_FILE_FIELD);
    assert.strictEqual(uploadCalls, 1);
    assert.strictEqual(result.imageHash, "meta_image_hash_1");
    assert.strictEqual(result.sourceImageId, IMAGE_ID);
    assert.strictEqual(result.actId, "act_999888777");
    assert.ok(!JSON.stringify(result).includes(SECRET));
  }

  // Reject client-controlled credentials / URLs / paths as authoritative
  {
    await assert.rejects(
      () =>
        uploadMetaAdsAdImage({
          authenticatedUserId: USER,
          sourceImageId: IMAGE_ID,
          accessToken: "EAAClientTokenMustBeRejected_xxxxxxxxxxxxxxxxxxxx",
          deps: {
            resolveCreative: async () => creative(),
            loadWriteContext: async () => writeCtx(),
            downloadStorageObject: async () => ({ ok: true, buffer: JPEG }),
            uploadToGraph: async () => {
              throw new Error("must not upload");
            },
          },
        }),
      (e: unknown) =>
        e instanceof MetaAdsAdImageUploadError &&
        e.code === "write_context_unavailable"
    );

    await assert.rejects(
      () =>
        uploadMetaAdsAdImage({
          authenticatedUserId: USER,
          sourceImageId: IMAGE_ID,
          adAccountId: "act_attacker",
          deps: {
            resolveCreative: async () => creative(),
            loadWriteContext: async () => writeCtx(),
            downloadStorageObject: async () => ({ ok: true, buffer: JPEG }),
            uploadToGraph: async () => {
              throw new Error("must not upload");
            },
          },
        }),
      (e: unknown) =>
        e instanceof MetaAdsAdImageUploadError &&
        e.code === "no_selected_account"
    );

    await assert.rejects(
      () =>
        uploadMetaAdsAdImage({
          authenticatedUserId: USER,
          sourceImageId: IMAGE_ID,
          clientStoragePath: "evil/path.jpg",
          deps: {
            resolveCreative: async () => creative(),
            loadWriteContext: async () => writeCtx(),
            downloadStorageObject: async () => ({ ok: true, buffer: JPEG }),
            uploadToGraph: async () => {
              throw new Error("must not upload");
            },
          },
        }),
      (e: unknown) =>
        e instanceof MetaAdsAdImageUploadError && e.code === "missing_storage"
    );
  }

  // Ownership enforcement
  {
    await assert.rejects(
      () =>
        uploadMetaAdsAdImage({
          authenticatedUserId: USER,
          sourceImageId: IMAGE_ID,
          deps: {
            resolveCreative: async () => {
              throw new MetaAdsDraftValidationError(
                "creative_not_found",
                "Creative asset was not found or is not owned by the authenticated user."
              );
            },
            loadWriteContext: async () => writeCtx(),
            downloadStorageObject: async () => ({ ok: true, buffer: JPEG }),
            uploadToGraph: async () => {
              throw new Error("must not upload");
            },
          },
        }),
      (e: unknown) =>
        e instanceof MetaAdsAdImageUploadError &&
        e.code === "creative_not_found"
    );
  }

  // Missing storage object
  {
    await assert.rejects(
      () =>
        uploadMetaAdsAdImage({
          authenticatedUserId: USER,
          sourceImageId: IMAGE_ID,
          deps: {
            resolveCreative: async () => creative(),
            loadWriteContext: async () => writeCtx(),
            downloadStorageObject: async () => ({
              ok: false,
              error: "not_found",
            }),
            uploadToGraph: async () => {
              throw new Error("must not upload");
            },
          },
        }),
      (e: unknown) =>
        e instanceof MetaAdsAdImageUploadError &&
        e.code === "storage_not_found"
    );
  }

  // Malformed Meta success payload
  {
    await assert.rejects(
      () =>
        uploadMetaAdsAdImage({
          authenticatedUserId: USER,
          sourceImageId: IMAGE_ID,
          deps: {
            resolveCreative: async () => creative(),
            loadWriteContext: async () => writeCtx(),
            downloadStorageObject: async () => ({ ok: true, buffer: JPEG }),
            uploadToGraph: (async () => ({
              images: { "x.jpg": {} },
            })) as any,
          },
        }),
      (e: unknown) =>
        e instanceof MetaAdsAdImageUploadError &&
        e.code === "malformed_upload_response"
    );
  }

  // Permission + rate limit mapping
  {
    await assert.rejects(
      () =>
        uploadMetaAdsAdImage({
          authenticatedUserId: USER,
          sourceImageId: IMAGE_ID,
          deps: {
            resolveCreative: async () => creative(),
            loadWriteContext: async () => writeCtx(),
            downloadStorageObject: async () => ({ ok: true, buffer: JPEG }),
            uploadToGraph: async () => {
              throw new MetaGraphError("Permissions error", {
                code: 200,
                type: "OAuthException",
                kind: "graph",
                httpStatus: 403,
              });
            },
          },
        }),
      (e: unknown) =>
        e instanceof MetaAdsAdImageUploadError && e.code === "meta_permission"
    );

    await assert.rejects(
      () =>
        uploadMetaAdsAdImage({
          authenticatedUserId: USER,
          sourceImageId: IMAGE_ID,
          deps: {
            resolveCreative: async () => creative(),
            loadWriteContext: async () => writeCtx(),
            downloadStorageObject: async () => ({ ok: true, buffer: JPEG }),
            uploadToGraph: async () => {
              throw new MetaGraphError("rate limited", {
                code: 4,
                kind: "graph",
                httpStatus: 400,
              });
            },
          },
        }),
      (e: unknown) =>
        e instanceof MetaAdsAdImageUploadError &&
        e.code === "meta_rate_limited"
    );
  }

  // Timeout — uncertain, no automatic retry (single uploadToGraph call)
  {
    let calls = 0;
    await assert.rejects(
      () =>
        uploadMetaAdsAdImage({
          authenticatedUserId: USER,
          sourceImageId: IMAGE_ID,
          deps: {
            resolveCreative: async () => creative(),
            loadWriteContext: async () => writeCtx(),
            downloadStorageObject: async () => ({ ok: true, buffer: JPEG }),
            uploadToGraph: async () => {
              calls += 1;
              throw new MetaGraphError("timed out after 30ms", {
                kind: "timeout",
              });
            },
          },
        }),
      (e: unknown) =>
        e instanceof MetaAdsAdImageUploadError &&
        e.code === "upload_outcome_uncertain" &&
        e.outcomeUncertain === true
    );
    assert.strictEqual(calls, 1);
  }

  // Token must not appear in error messages from graph mapping
  {
    try {
      await uploadMetaAdsAdImage({
        authenticatedUserId: USER,
        sourceImageId: IMAGE_ID,
        deps: {
          resolveCreative: async () => creative(),
          loadWriteContext: async () => writeCtx(),
          downloadStorageObject: async () => ({ ok: true, buffer: JPEG }),
          uploadToGraph: async () => {
            throw new MetaGraphError(
              `fail access_token=${SECRET} and ${SECRET}`,
              { code: 100, kind: "graph" }
            );
          },
        },
      });
      assert.fail("expected throw");
    } catch (e) {
      assert.ok(e instanceof MetaAdsAdImageUploadError);
      assert.ok(!e.message.includes(SECRET));
    }
  }

  console.log("upload-ad-image.test.ts: ok");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
