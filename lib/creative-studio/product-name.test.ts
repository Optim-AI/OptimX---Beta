/**
 * Run: npx tsx lib/creative-studio/product-name.test.ts
 */
import assert from "node:assert/strict";
import { cleanProductName, productNameFromHtml } from "./product-name";

const cases: Array<[string, string | undefined, string]> = [
  ["Beef Pickle Online | Homemade Beef Pickle | oorgaa", "Oorgaa", "Beef Pickle"],
  ["Classic Pickle Bundle – Pack of 6 - oorgaa - classic pickle combo", "oorgaa", "Classic Pickle Bundle – Pack of 6"],
  ["Spicy Chilli Fried Anchovies Snacks", "oorgaa", "Spicy Chilli Fried Anchovies Snacks"],
  ["Peri Peri Fried Anchovies - oorgaa - snacks", "oorgaa", "Peri Peri Fried Anchovies"],
  ["Buy Mango Pickle Online", undefined, "Mango Pickle"],
  ["Shop", undefined, "Shop"],
  ["Ghee &amp; Jaggery Combo", undefined, "Ghee & Jaggery Combo"],
];
for (const [raw, brand, want] of cases) assert.equal(cleanProductName(raw, brand), want, raw);

const html = `<title>Beef Pickle Online | oorgaa</title><script type="application/ld+json">{"@context":"https://schema.org","@type":"Product","name":"Beef Pickle"}</script><h1>Something else</h1>`;
assert.equal(productNameFromHtml(html), "Beef Pickle");
assert.equal(productNameFromHtml("<title>T | site</title><h1> Prawn Pickle </h1>"), "Prawn Pickle");
console.log(`product-name: all ${cases.length + 2} tests passed`);
