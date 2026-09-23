/**
 * Theme recipe unit checks — no network.
 *
 * Run: npx tsx lib/creative-studio/poster-generation/theme-recipes.test.ts
 */

import {
  formatThemeRecipeForDirector,
  formatThemeRecipeForGeneration,
  resolveThemeRecipe,
} from "./theme-recipes";
import { POSTER_VISUAL_DIRECTIONS } from "./types";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`FAIL: ${msg}`);
}

for (const id of POSTER_VISUAL_DIRECTIONS) {
  const recipe = resolveThemeRecipe(id);
  assert(recipe.id === id, `${id} resolves`);
  assert(recipe.must.length >= 2, `${id} has musts`);
  assert(recipe.avoid.length >= 2, `${id} has avoids`);
  const forDir = formatThemeRecipeForDirector(recipe);
  assert(forDir.includes("THEME LOCK"), `${id} director block`);
  assert(forDir.includes(recipe.label.toUpperCase()), `${id} label in director`);
  const forGen = formatThemeRecipeForGeneration(recipe);
  assert(forGen.includes("THEME LOCK"), `${id} generation block`);
  assert(forGen.includes(recipe.summary), `${id} summary in generation`);
}

assert(resolveThemeRecipe(null).id === "commercial", "null → commercial");
assert(resolveThemeRecipe("Festive").id === "festive", "case-insensitive");
assert(resolveThemeRecipe("nope").id === "commercial", "unknown → commercial");

const festive = resolveThemeRecipe("festive");
assert(/celebrat/i.test(festive.summary + festive.mood), "festive celebratory");
const minimal = resolveThemeRecipe("minimal");
assert(/sparse|negative space|empty/i.test(minimal.summary + minimal.density), "minimal sparse");

console.log("theme-recipes.test.ts: PASS");
