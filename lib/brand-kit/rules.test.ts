import assert from "node:assert/strict";
import { formatBrandRulesForCopy, formatBrandRulesForImage, hasBrandRules, printedTextFromRule, requiredPrintedText } from "./rules";

assert.deepEqual(printedTextFromRule("Logo in the top-left corner"), []);
assert.deepEqual(printedTextFromRule("@fuelco handle in the footer"), ["@fuelco"]);
assert.deepEqual(printedTextFromRule('Tagline "Made fresh daily" under the headline'), ["Made fresh daily"]);
assert.deepEqual(printedTextFromRule("Website sweetspot.in at the bottom"), ["sweetspot.in"]);
assert.deepEqual(printedTextFromRule("Call us on +91 98765 43210"), ["+91 98765 43210"]);
assert.deepEqual(printedTextFromRule("Always add #EatLocal"), ["#EatLocal"]);
assert.deepEqual(requiredPrintedText({ mustInclude: ["@a_b handle", "@a_b again", "Logo top-left"] }), ["@a_b"]);

assert.equal(hasBrandRules({ mustInclude: [" "], dos: [], donts: [] }), false);
assert.equal(formatBrandRulesForCopy(null), "");
const copy = formatBrandRulesForCopy({ mustInclude: [], dos: ["Warm tone"], donts: ["Never say cheap"] });
assert.ok(copy.includes("- Don't: Never say cheap") && copy.includes("the Don't wins"));
const img = formatBrandRulesForImage({ mustInclude: ["Logo top-left"], dos: [], donts: ["Gradients"] });
assert.ok(img.includes("- Must include: Logo top-left") && img.includes("- Never: Gradients"));

console.log("rules.test.ts: PASS");
