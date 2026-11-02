/**
 * "Help me write it" + owner's direction tests — mocked writer, no network.
 *
 * Run: npx tsx lib/creative-studio/commercial-production/concepts/write-direction.test.ts
 */

import assert from "node:assert/strict";
import { makeValidBrief } from "../commercial-director/fixtures";
import { buildDirectorUserPrompt } from "../commercial-director/prompts";
import { buildCampaignPrompt } from "../campaign-compiler/prompt-builder";
import { make15sCompileInput } from "../campaign-executor/fixtures";
import { voiceoverAdContext } from "../audio/attach-gemini-voiceover";
import { mapStudioFormToCampaignBrief } from "../studio-mapper";
import { castLine, normalizeAdDirection, type AdDirection } from "../campaign/ad-direction";
import { buildConceptsPrompt, buildStoryboardPrompt } from "./generate-concepts";
import { buildWriteDirectionPrompt, sanitizeDirectionText, writeAdDirection } from "./write-direction";

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

const direction: AdDirection = {
  viewerAction: "call_whatsapp",
  mood: "warm_family",
  castRegion: "south_indian",
  castAges: ["parents", "grandparents"],
  setting: "home_kitchen",
  mustInclude: "No preservatives",
};

async function main() {
  console.log("\nHelp me write it + owner's direction tests\n");

  await test("normalise keeps known answers, drops unknown, empty is undefined", () => {
    const d = normalizeAdDirection({
      viewerAction: "call_whatsapp",
      mood: "nonsense",
      castAges: ["parents", "parents", "aliens"],
      mustInclude: "  ",
    });
    assert.deepEqual(d, { viewerAction: "call_whatsapp", castAges: ["parents"] } as AdDirection);
    assert.equal(normalizeAdDirection({}), undefined);
    assert.equal(normalizeAdDirection("x"), undefined);
  });

  await test("cast line names the region and ages; no-people overrides ages", () => {
    assert.ok(castLine(direction)?.includes("South Indian"));
    assert.ok(castLine(direction)?.includes("parents, grandparents"));
    assert.ok(castLine({ castRegion: "no_people", castAges: ["children"] })?.startsWith("NO people"));
    assert.equal(castLine({ mood: "fun" }), undefined);
  });

  await test("studio mapper keeps the direction and uses the action as a default spoken CTA", () => {
    const base = {
      campaignId: "c1",
      product: { product_name: "Oorgaa Pickle" },
      adSetup: { duration: 15 as const, aspect_ratio: "9:16" },
    };
    const brief = mapStudioFormToCampaignBrief({ ...base, adDirection: direction });
    assert.equal(brief.adDirection?.castRegion, "south_indian");
    assert.equal(brief.voiceover?.cta, "Call or WhatsApp us");
    const own = mapStudioFormToCampaignBrief({ ...base, adDirection: direction, voiceoverCta: "Order on Swiggy" });
    assert.equal(own.voiceover?.cta, "Order on Swiggy");
    assert.equal(mapStudioFormToCampaignBrief(base).adDirection, undefined);
  });

  const brief = makeValidBrief({ adDirection: direction });

  await test("ideas, storyboards, director, video and voiceover all follow the direction", () => {
    assert.ok(buildConceptsPrompt(brief).includes("OWNER'S DIRECTION (CRITICAL"));
    assert.ok(buildStoryboardPrompt(brief, { storyboardPanels: ["a", "b", "c"] }).includes("People: South Indian"));
    const director = buildDirectorUserPrompt(brief);
    assert.ok(director.includes("Who is on screen (MUST follow): South Indian"));
    assert.ok(director.includes("call or WhatsApp"));
    const { campaignPrompt } = buildCampaignPrompt({ ...make15sCompileInput(), adDirection: direction });
    assert.ok(campaignPrompt.includes("South Indian"));
    assert.ok(campaignPrompt.includes("home kitchen"));
    const vo = voiceoverAdContext(brief) || "";
    assert.ok(vo.includes("warm, homely") && vo.includes("WhatsApp") && vo.includes("No preservatives"));
  });

  await test("without a direction nothing extra is added", () => {
    const plain = makeValidBrief();
    assert.ok(!buildConceptsPrompt(plain).includes("OWNER'S DIRECTION"));
    assert.ok(!buildDirectorUserPrompt(plain).includes("OWNER'S DIRECTION"));
    assert.ok(!buildStoryboardPrompt(plain, {}).includes("People:"));
  });

  await test("write prompt keeps the owner's words, follows choices, bans jargon", () => {
    const p = buildWriteDirectionPrompt(makeValidBrief({ adDirection: direction, userConcept: "அம்மா கை ருசி" }));
    assert.ok(p.includes("அம்மா கை ருசி"));
    assert.ok(p.includes("South Indian"));
    assert.ok(p.includes('no "hook"'));
    assert.ok(buildWriteDirectionPrompt(makeValidBrief()).includes("nothing yet"));
  });

  await test("written text is cleaned; too-short output fails with a plain message", async () => {
    assert.equal(sanitizeDirectionText('"A warm family breakfast where grandma opens the jar."'), "A warm family breakfast where grandma opens the jar.");
    assert.equal(sanitizeDirectionText("ok"), null);
    assert.equal(
      sanitizeDirectionText("A family sits down for lunch at home. Grandmother opens the jar of Oorgaa"),
      "A family sits down for lunch at home."
    );
    let sent = "";
    const text = await writeAdDirection(brief, {
      writer: async ({ prompt }) => {
        sent = prompt;
        return "```\nA South Indian family shares lunch at home, and grandmother smiles at the first taste.\n```";
      },
    });
    assert.ok(text.startsWith("A South Indian family"));
    assert.ok(sent.includes("OWNER'S DIRECTION"));
    await assert.rejects(writeAdDirection(brief, { writer: async () => "" }), /couldn't write that/);
  });

  console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
