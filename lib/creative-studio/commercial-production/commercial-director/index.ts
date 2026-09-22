/**
 * Commercial Director module — Phase 2 campaign creative intelligence.
 *
 * Relationship to lib/creative-studio/film-engine:
 * - film-engine CreativeDirector is a deterministic style/pacing planner for the
 *   legacy Veo prompt pipeline (film styles, scene graph, veo-renderer).
 * - This Commercial Director is LLM-backed campaign creative direction for the
 *   new Commercial Production Engine (blueprint → Phase 3 shots → Runway/Seedance).
 * - Reuse: product-intelligence classifyProduct helpers only.
 * - Do NOT route this blueprint through veo-renderer or resolveVeoPrompt.
 */

export * from "./types";
export * from "./blueprint";
export * from "./validate";
export * from "./llm";
export * from "./gemini-structured";
export * from "./assemble";
export * from "./director";
export {
  buildDirectorSystemPrompt,
  buildDirectorUserPrompt,
  buildRepairUserPrompt,
} from "./prompts";
