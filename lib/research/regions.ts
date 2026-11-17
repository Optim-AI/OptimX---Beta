/**
 * Regions a brand can focus research on: Indian states (Google Trends ISO codes)
 * and the big cities, each mapped to its state so state-level search data can
 * stand in where Google Trends has no city figure.
 */

export type ResearchRegion = {
  id: string;
  name: string;
  kind: "state" | "city";
  /** Google Trends geo code of the state (the city's state for cities) */
  stateCode: string;
  stateName: string;
  /** SerpApi location string, so searches look like they come from there */
  searchLocation: string;
  /** Main local language, for language and culture hooks */
  language: string;
};

const S = (code: string, name: string, capital: string, language: string): ResearchRegion => ({
  id: code.toLowerCase(),
  name,
  kind: "state",
  stateCode: code,
  stateName: name,
  searchLocation: `${capital}, ${name}, India`,
  language,
});

const C = (name: string, state: ResearchRegion, language = state.language): ResearchRegion => ({
  id: `city-${name.toLowerCase().replace(/[^a-z]+/g, "-")}`,
  name,
  kind: "city",
  stateCode: state.stateCode,
  stateName: state.stateName,
  searchLocation: `${name}, ${state.stateName}, India`,
  language,
});

const TN = S("IN-TN", "Tamil Nadu", "Chennai", "Tamil");
const KL = S("IN-KL", "Kerala", "Thiruvananthapuram", "Malayalam");
const KA = S("IN-KA", "Karnataka", "Bengaluru", "Kannada");
const AP = S("IN-AP", "Andhra Pradesh", "Vijayawada", "Telugu");
const TG = S("IN-TG", "Telangana", "Hyderabad", "Telugu");
const MH = S("IN-MH", "Maharashtra", "Mumbai", "Marathi");
const GJ = S("IN-GJ", "Gujarat", "Ahmedabad", "Gujarati");
const DL = S("IN-DL", "Delhi", "New Delhi", "Hindi");
const WB = S("IN-WB", "West Bengal", "Kolkata", "Bengali");
const UP = S("IN-UP", "Uttar Pradesh", "Lucknow", "Hindi");
const RJ = S("IN-RJ", "Rajasthan", "Jaipur", "Hindi");
const PB = S("IN-PB", "Punjab", "Ludhiana", "Punjabi");
const HR = S("IN-HR", "Haryana", "Gurugram", "Hindi");
const MP = S("IN-MP", "Madhya Pradesh", "Indore", "Hindi");
const BR = S("IN-BR", "Bihar", "Patna", "Hindi");
const OR = S("IN-OR", "Odisha", "Bhubaneswar", "Odia");
const AS = S("IN-AS", "Assam", "Guwahati", "Assamese");
const GA = S("IN-GA", "Goa", "Panaji", "Konkani");
const CH = S("IN-CH", "Chandigarh", "Chandigarh", "Hindi");
const PY = S("IN-PY", "Puducherry", "Puducherry", "Tamil");

export const STATES: ResearchRegion[] = [TN, KL, KA, AP, TG, MH, GJ, DL, WB, UP, RJ, PB, HR, MP, BR, OR, AS, GA, CH, PY];

export const CITIES: ResearchRegion[] = [
  C("Chennai", TN),
  C("Coimbatore", TN),
  C("Madurai", TN),
  C("Bengaluru", KA),
  C("Hyderabad", TG),
  C("Kochi", KL),
  C("Mumbai", MH, "Hindi and Marathi"),
  C("Pune", MH),
  C("Delhi NCR", DL),
  C("Kolkata", WB),
  C("Ahmedabad", GJ),
  C("Jaipur", RJ),
  C("Lucknow", UP),
];

export const ALL_REGIONS: ResearchRegion[] = [...STATES, ...CITIES];

/** Known regions for these ids, in the order given, without duplicates (max 6). */
export function resolveRegions(ids: unknown): ResearchRegion[] {
  if (!Array.isArray(ids)) return [];
  const out: ResearchRegion[] = [];
  for (const id of ids) {
    const r = ALL_REGIONS.find((x) => x.id === String(id));
    if (r && !out.includes(r)) out.push(r);
    if (out.length >= 6) break;
  }
  return out;
}
