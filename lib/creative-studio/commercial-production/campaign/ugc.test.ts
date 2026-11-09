/**
 * UGC Studio tests — creator, formats, delivery routing, references, re-voice,
 * photo checks and Telugu. Mocked, no network.
 *
 * Run: npx tsx lib/creative-studio/commercial-production/campaign/ugc.test.ts
 */

import assert from "node:assert/strict";
import { makeValidBrief } from "../commercial-director/fixtures";
import { buildDirectorUserPrompt } from "../commercial-director/prompts";
import { buildCampaignPrompt } from "../campaign-compiler/prompt-builder";
import { compileCampaignGeneration } from "../campaign-compiler/compiler";
import { make15sCompileInput } from "../campaign-compiler/fixtures";
import { mergeProductAssets } from "../campaign-executor/produce";
import { voiceoverAdContext } from "../audio/attach-gemini-voiceover";
import { usesGeminiTts, VOICEOVER_LANGUAGES } from "../audio/voiceover-languages";
import { planVoiceoverFit } from "../audio/voiceover-fit";
import { mapStudioFormToCampaignBrief } from "../studio-mapper";
import { buildConceptsPrompt, buildStoryboardPrompt } from "../concepts/generate-concepts";
import { parseCreatorPhotoCheck, buildCreatorPortraitPrompt } from "../ugc/creator";
import { isOwnStorageUrl, revoiceUgcVideo } from "../ugc/revoice";
import { UGC_CREATOR_PRESETS } from "./ugc-presets";
import {
  normalizeUgc,
  ugcSpeechFor,
  UGC_PRESENTER_GREETING,
  withPresenterGreeting,
  ugcToPromptBlock,
  ugcVoiceFor,
  usesExternalVoiceover,
  type CampaignUgcInput,
} from "./ugc";

let passed = 0;
let failed = 0;

async function test(name: string, fn: () => void | Promise<void>): Promise<void> {
  try {
    await fn();
    passed += 1;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    failed += 1;
    console.error(`  ✗ ${name}`);
    console.error(err);
  }
}

const creatorImg = { id: "ugc-creator", kind: "creative_reference" as const, url: "data:image/jpeg;base64,AAAA", mimeType: "image/jpeg" };
const ugc = (over: Partial<CampaignUgcInput> = {}): CampaignUgcInput => ({
  creator: { kind: "person", name: "Meera", description: "Tamil woman, 35", image: creatorImg, voiceGender: "female" },
  format: "review",
  delivery: "voiceover",
  speech: "voiceover",
  ...over,
});

async function main() {
  console.log("\nUGC Studio tests\n");

  await test("Telugu is a supported voice-over language using Gemini TTS", () => {
    assert.ok((VOICEOVER_LANGUAGES as readonly string[]).includes("telugu"));
    assert.equal(usesGeminiTts("telugu"), true);
    assert.equal(planVoiceoverFit({ speechSeconds: 10, videoSeconds: 15, language: "telugu" } as never).action, "fits");
  });

  await test("talking: English speaks on camera; other languages use the presenter style", () => {
    assert.equal(ugcSpeechFor("talk_to_camera", "english"), "native");
    assert.equal(ugcSpeechFor("talk_to_camera", "tamil"), "presenter");
    assert.equal(ugcSpeechFor("talk_to_camera", "telugu"), "presenter");
    assert.equal(ugcSpeechFor("voiceover", "english"), "voiceover");
  });

  await test("normalise keeps known values and needs a photo or a description", () => {
    const n = normalizeUgc({ creator: { kind: "alien", name: " Bruno " }, format: "nope", delivery: "talk_to_camera" }, "hindi", creatorImg);
    assert.equal(n?.creator.kind, "person");
    assert.equal(n?.creator.name, "Bruno");
    assert.equal(n?.format, "review");
    assert.equal(n?.delivery, "talk_to_camera");
    assert.equal(n?.speech, "presenter");
    assert.equal(normalizeUgc({ creator: { kind: "animal" } }, "english", null), undefined);
  });

  await test("external voice: everything except English on-camera speech", () => {
    assert.equal(usesExternalVoiceover({ voiceover: { language: "english" } }), false);
    assert.equal(usesExternalVoiceover({ voiceover: { language: "tamil" } }), true);
    assert.equal(usesExternalVoiceover({ voiceover: { language: "english" }, ugc: ugc() }), true);
    assert.equal(usesExternalVoiceover({ voiceover: { language: "english" }, ugc: ugc({ delivery: "talk_to_camera", speech: "native" }) }), false);
    assert.equal(usesExternalVoiceover({ voiceover: { language: "tamil" }, ugc: ugc({ delivery: "talk_to_camera", speech: "presenter" }) }), true);
  });

  await test("presenter: says the English hello on camera, then silent acting; voice opens with the same hello", () => {
    const presenter = ugc({ delivery: "talk_to_camera", speech: "presenter" });
    const block = ugcToPromptBlock(presenter);
    assert.ok(block.includes(`say ONLY "${UGC_PRESENTER_GREETING}" in English`));
    assert.ok(block.includes("do NOT speak"));
    const { campaignPrompt, negativePrompt } = buildCampaignPrompt({ ...make15sCompileInput(), suppressSpokenVoiceover: true, ugc: presenter });
    assert.ok(campaignPrompt.includes("like a vlogger"));
    assert.ok(campaignPrompt.includes(`Only the short English hello "${UGC_PRESENTER_GREETING}"`));
    assert.ok(!campaignPrompt.includes("Never frame a character addressing or talking to the camera"));
    assert.ok(negativePrompt.includes("speech after the opening hello"));
    const director = buildDirectorUserPrompt(makeValidBrief({ ugc: presenter, voiceover: { language: "tamil" } }));
    assert.ok(director.includes(`say ONLY "${UGC_PRESENTER_GREETING}"`));
    assert.ok(!director.includes("No character may speak on camera in any beat"));
    assert.equal(withPresenterGreeting("வணக்கம் நண்பர்களே", presenter), `${UGC_PRESENTER_GREETING} வணக்கம் நண்பர்களே`);
    assert.equal(withPresenterGreeting("Hey friends! இது சூப்பர்", presenter), "Hey friends! இது சூப்பர்");
    assert.equal(withPresenterGreeting("வணக்கம்", ugc()), "வணக்கம்");
    assert.ok((voiceoverAdContext(makeValidBrief({ ugc: presenter })) || "").includes("everyday English words"));
  });

  await test("voice suits the creator", () => {
    assert.equal(ugcVoiceFor({ kind: "person", voiceGender: "male" }), "Charon");
    assert.equal(ugcVoiceFor({ kind: "animal" }), "Puck");
    assert.equal(ugcVoiceFor({ kind: "person" }), undefined);
  });

  await test("prompt block: talking speaks to the lens, voice-over keeps lips still, reference order stated", () => {
    const talk = ugcToPromptBlock(ugc({ delivery: "talk_to_camera", speech: "native" }), { hasProductPhotos: true });
    assert.ok(talk.includes("SPEAKS the lines"));
    // People are described in words (Runway refuses real faces as references)…
    assert.ok(!talk.includes("creator reference image"));
    assert.ok(talk.includes("always the same Tamil woman, 35"));
    // …animals and mascots still send their photo, after the products.
    const dog = ugcToPromptBlock(ugc({ creator: { kind: "animal", description: "beagle", image: creatorImg } }), { hasProductPhotos: true });
    assert.ok(dog.includes("comes after the product reference image"));
    const vo = ugcToPromptBlock(ugc());
    assert.ok(vo.includes("does NOT speak"));
    assert.ok(ugcToPromptBlock(ugc({ creator: { kind: "animal", description: "golden retriever" } })).includes("lovable character"));
    assert.equal(ugcToPromptBlock(undefined), "");
  });

  await test("studio mapper builds the UGC brief: creator reference, ugc look, creator voice", () => {
    const brief = mapStudioFormToCampaignBrief({
      campaignId: "u1",
      product: { product_name: "Oorgaa Pickle" },
      adSetup: { duration: 15, aspect_ratio: "9:16", creativeFormat: "commercial" },
      voiceover: { language: "telugu" },
      ugc: { creator: { kind: "person", name: "Ravi", image: "data:image/jpeg;base64,BBBB", voiceGender: "male" }, format: "unboxing", delivery: "talk_to_camera" },
    });
    assert.equal(brief.creativeStyle, "ugc");
    assert.equal(brief.ugc?.delivery, "talk_to_camera");
    assert.equal(brief.ugc?.speech, "presenter");
    assert.equal(brief.ugc?.format, "unboxing");
    assert.equal(brief.ugc?.creator.image?.kind, "creative_reference");
    assert.equal(brief.voiceover?.voice, "Charon");
    const plain = mapStudioFormToCampaignBrief({ campaignId: "u2", product: { product_name: "X" }, adSetup: { duration: 15, aspect_ratio: "9:16" } });
    assert.equal(plain.ugc, undefined);
    assert.equal(plain.voiceover?.voice, undefined);
  });

  await test("realistic people never go to Runway as a reference; animal photos join after the products", () => {
    const person = mergeProductAssets(makeValidBrief({ ugc: ugc() }), {
      productImages: [{ id: "p1", kind: "product_image", url: "https://example.com/p.png", mimeType: "image/png" }],
    });
    assert.equal(person.characterReferences, undefined);
    const brief = makeValidBrief({ ugc: ugc({ creator: { kind: "animal", description: "beagle", image: creatorImg } }) });
    const merged = mergeProductAssets(brief, { productImages: [{ id: "p1", kind: "product_image", url: "https://example.com/p.png", mimeType: "image/png" }] });
    assert.deepEqual(merged.characterReferences?.map((c) => c.id), ["ugc-creator"]);
    const input = make15sCompileInput();
    const spec = compileCampaignGeneration({ ...input, availableAssets: { ...input.availableAssets, ...merged }, ugc: ugc({ creator: { kind: "animal", image: creatorImg } }) });
    const order = spec.referenceAssets.map((r) => r.purpose);
    assert.ok(order.indexOf("product") < order.indexOf("character"));
    assert.ok(spec.campaignPrompt.includes("UGC CREATOR VIDEO"));
    assert.equal(mergeProductAssets(makeValidBrief(), undefined).characterReferences, undefined);
  });

  await test("director, video prompt, ideas, storyboards and voice script all know it is UGC", () => {
    const brief = makeValidBrief({ ugc: ugc(), voiceover: { language: "english" } });
    const director = buildDirectorUserPrompt(brief);
    assert.ok(director.includes("UGC CREATOR VIDEO"));
    assert.ok(director.includes("VOICEOVER ROUTING (CRITICAL)"));
    assert.ok(buildCampaignPrompt({ ...make15sCompileInput(), ugc: ugc() }).campaignPrompt.includes("honest customer review"));
    assert.ok(buildConceptsPrompt(brief).includes("UGC CREATOR VIDEO"));
    assert.ok(buildStoryboardPrompt(brief, {}).includes("creator photo"));
    assert.ok((voiceoverAdContext(brief) || "").includes("first person"));
  });

  await test("re-voice: voice-over only, own storage only, new language without the old script", async () => {
    const supa = "http://localhost:54321";
    process.env.NEXT_PUBLIC_SUPABASE_URL = supa;
    const base = `${supa}/storage/v1/object/public/videos/a.mp4`;
    assert.equal(isOwnStorageUrl(base, supa), true);
    assert.equal(isOwnStorageUrl("https://evil.example.com/storage/v1/object/a.mp4", supa), false);

    const brief = makeValidBrief({ ugc: ugc(), voiceover: { language: "tamil", script: "old tamil script" } });
    await assert.rejects(revoiceUgcVideo({ brief: { ...brief, ugc: undefined }, baseVideoUrl: base }), /Only UGC/);
    let presenterSpeech: string | undefined;
    await revoiceUgcVideo({
      brief: { ...brief, ugc: ugc({ delivery: "talk_to_camera", speech: "native" }), voiceover: { language: "english" } },
      baseVideoUrl: base,
      voiceAttacher: async (b, final) => {
        presenterSpeech = b.ugc?.speech;
        return { final, script: "x", language: "english", voice: "Kore", model: "tts" };
      },
      endCardAttacher: async () => null,
    });
    assert.equal(presenterSpeech, "presenter");
    await assert.rejects(revoiceUgcVideo({ brief, baseVideoUrl: "https://evil.example.com/x.mp4" }), /not allowed/);

    let seenScript: string | undefined = "unset";
    let seenUrl = "";
    const out = await revoiceUgcVideo({
      brief: { ...brief, voiceover: { language: "hindi", script: "old tamil script" } },
      baseVideoUrl: base,
      voiceAttacher: async (b, final) => {
        seenScript = b.voiceover?.script;
        seenUrl = final.videoUrl;
        return { final: { ...final, videoUrl: `${supa}/storage/v1/object/public/videos/hi.mp4` }, script: "नया", language: "hindi", voice: "Kore", model: "tts" };
      },
      endCardAttacher: async () => null,
    });
    assert.equal(seenScript, undefined);
    assert.equal(seenUrl, base);
    assert.equal(out.language, "hindi");
    assert.ok(out.videoUrl.endsWith("hi.mp4"));
  });

  await test("uploaded photo check blocks famous people, children and unclear photos", () => {
    assert.deepEqual(parseCreatorPhotoCheck('{"subject":"person","famous":false,"child":false,"clear":true}'), { ok: true, kind: "person", description: undefined });
    assert.equal(
      parseCreatorPhotoCheck('{"subject":"person","famous":false,"child":false,"clear":true,"description":" Woman in her 30s, curly hair "}').description,
      "Woman in her 30s, curly hair"
    );
    assert.equal(parseCreatorPhotoCheck('{"subject":"person","famous":true,"child":false,"clear":true}').ok, false);
    assert.equal(parseCreatorPhotoCheck('{"subject":"person","famous":false,"child":true,"clear":true}').ok, false);
    assert.equal(parseCreatorPhotoCheck('{"subject":"animal","famous":false,"child":false,"clear":false}').ok, false);
    assert.equal(parseCreatorPhotoCheck('{"subject":"none"}').ok, false);
    assert.equal(parseCreatorPhotoCheck("garbage").ok, false);
  });

  await test("preset library: unique ids, many regions, animals and mascots; portraits say fictional", () => {
    const ids = UGC_CREATOR_PRESETS.map((p) => p.id);
    assert.equal(new Set(ids).size, ids.length);
    const groups = new Set(UGC_CREATOR_PRESETS.map((p) => p.group));
    for (const g of ["india", "asia", "africa", "europe", "americas", "middle_east_oceania", "animals", "mascots"]) assert.ok(groups.has(g as never), g);
    assert.ok(UGC_CREATOR_PRESETS.filter((p) => p.kind === "person").every((p) => p.voiceGender));
    assert.ok(buildCreatorPortraitPrompt("person", "Tamil woman").includes("fictional person"));
  });

  console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
