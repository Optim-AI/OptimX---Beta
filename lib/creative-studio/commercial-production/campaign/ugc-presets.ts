/**
 * Ready-made UGC creators: faces from many regions, plus animals and mascots.
 * Every person here is AI-generated (no real person). Pictures live in
 * public/images/ugc-creators/<id>.jpg — regenerate with scripts/generate-ugc-creators.ts.
 */

import type { UgcCreatorKind, UgcVoiceGender } from "./ugc";

export type UgcPresetGroup = "india" | "asia" | "africa" | "europe" | "americas" | "middle_east_oceania" | "animals" | "mascots";

export interface UgcCreatorPreset {
  id: string;
  name: string;
  kind: UgcCreatorKind;
  group: UgcPresetGroup;
  /** Short label under the face, e.g. "South Indian". */
  label: string;
  /** How they look — sent to the video model and used to draw the picture. */
  description: string;
  voiceGender?: UgcVoiceGender;
}

export const UGC_PRESET_GROUPS: Array<{ id: UgcPresetGroup; label: string }> = [
  { id: "india", label: "India" },
  { id: "asia", label: "East Asia" },
  { id: "africa", label: "Africa" },
  { id: "europe", label: "Europe" },
  { id: "americas", label: "Americas" },
  { id: "middle_east_oceania", label: "Middle East & Oceania" },
  { id: "animals", label: "Animals" },
  { id: "mascots", label: "Mascots" },
];

const person = (
  id: string,
  name: string,
  group: UgcPresetGroup,
  label: string,
  description: string,
  voiceGender: UgcVoiceGender
): UgcCreatorPreset => ({ id, name, kind: "person", group, label, description, voiceGender });

export const UGC_CREATOR_PRESETS: UgcCreatorPreset[] = [
  // India
  person("meera", "Meera", "india", "South Indian · Tamil", "Tamil woman, about 35, warm brown skin, long black hair in a braid, small bindi, cotton saree", "female"),
  person("arjun", "Arjun", "india", "South Indian · Kerala", "Malayali man, about 30, brown skin, short black hair, neat beard, casual shirt", "male"),
  person("lakshmi", "Lakshmi Amma", "india", "South Indian · Telugu", "Telugu grandmother, about 62, brown skin, grey hair in a bun, silk saree, gentle smile", "female"),
  person("ravi", "Ravi", "india", "South Indian · Kannada", "Kannadiga man, about 45, brown skin, salt-and-pepper moustache, half-sleeve shirt", "male"),
  person("priya", "Priya", "india", "North Indian · Punjabi", "Punjabi woman, about 28, fair-wheatish skin, wavy dark hair, salwar kameez with dupatta", "female"),
  person("rohit", "Rohit", "india", "North Indian · Delhi", "North Indian man, about 32, wheatish skin, styled black hair, light stubble, casual t-shirt", "male"),
  person("sunita", "Sunita", "india", "North Indian · Rajasthan", "Rajasthani woman, about 50, wheatish skin, centre-parted hair, colourful bandhani saree", "female"),
  person("ananya", "Ananya", "india", "East Indian · Bengali", "Bengali woman, about 26, light brown skin, curly dark hair, small round glasses, cotton kurta", "female"),
  person("tenzin", "Tenzin", "india", "Northeast Indian", "Northeast Indian man, about 27, East Asian features, straight black hair, hoodie", "male"),
  person("kavya", "Kavya", "india", "West Indian · Gujarati", "Gujarati woman, about 40, wheatish skin, hair tied back, printed kurti", "female"),
  person("vikram", "Vikram", "india", "West Indian · Marathi", "Marathi man, about 58, brown skin, grey hair, glasses, kurta", "male"),

  // East Asia
  person("yuki", "Yuki", "asia", "Japanese", "Japanese woman, about 29, straight black bob haircut, light makeup, knit sweater", "female"),
  person("haruto", "Haruto", "asia", "Japanese", "Japanese man, about 38, short black hair, clean-shaven, casual jacket", "male"),
  person("jiwoo", "Ji-woo", "asia", "Korean", "Korean woman, about 24, long dark brown hair, dewy skin, pastel cardigan", "female"),
  person("minjun", "Min-jun", "asia", "Korean", "Korean man, about 30, textured black hair, clean-shaven, white t-shirt", "male"),
  person("mei", "Mei", "asia", "Chinese", "Chinese woman, about 45, shoulder-length black hair, warm smile, blouse", "female"),
  person("wei", "Wei", "asia", "Chinese", "Chinese man, about 26, short black hair, glasses, sweatshirt", "male"),

  // Africa
  person("amara", "Amara", "africa", "West African · Nigerian", "Nigerian woman, about 32, deep brown skin, braided hair, bright ankara print top", "female"),
  person("kwame", "Kwame", "africa", "West African · Ghanaian", "Ghanaian man, about 40, dark skin, short hair, trimmed beard, polo shirt", "male"),
  person("zawadi", "Zawadi", "africa", "East African · Kenyan", "Kenyan woman, about 27, dark skin, short natural hair, gold hoop earrings", "female"),
  person("thabo", "Thabo", "africa", "South African", "South African man, about 55, dark skin, grey beard, warm smile, collared shirt", "male"),

  // Europe
  person("emma", "Emma", "europe", "British", "British woman, about 34, fair skin, light brown hair, freckles, striped top", "female"),
  person("luca", "Luca", "europe", "Italian", "Italian man, about 36, olive skin, dark wavy hair, short beard, linen shirt", "male"),
  person("sofia", "Sofia", "europe", "Spanish", "Spanish woman, about 48, olive skin, dark hair in a low bun, elegant blouse", "female"),
  person("erik", "Erik", "europe", "Scandinavian", "Swedish man, about 28, very fair skin, blond hair, light stubble, knit sweater", "male"),
  person("anya", "Anya", "europe", "Eastern European", "Polish woman, about 25, fair skin, long straight light-brown hair, denim jacket", "female"),

  // Americas
  person("jordan", "Jordan", "americas", "Black American", "African American man, about 30, dark brown skin, short fade haircut, hoodie", "male"),
  person("keisha", "Keisha", "americas", "Black American", "African American woman, about 42, brown skin, natural curly hair, casual blazer", "female"),
  person("madison", "Madison", "americas", "American", "White American woman, about 27, fair skin, blonde ponytail, athleisure top", "female"),
  person("mike", "Mike", "americas", "American", "White American man, about 52, fair skin, greying hair, flannel shirt", "male"),
  person("camila", "Camila", "americas", "Latina", "Mexican-American woman, about 31, tan skin, long dark hair, colourful top", "female"),
  person("mateo", "Mateo", "americas", "Latino · Brazilian", "Brazilian man, about 29, tan skin, curly dark hair, open-collar shirt", "male"),

  // Middle East & Oceania
  person("layla", "Layla", "middle_east_oceania", "Middle Eastern", "Arab woman, about 33, olive skin, wearing a soft beige hijab, warm smile", "female"),
  person("omar", "Omar", "middle_east_oceania", "Middle Eastern", "Arab man, about 44, olive skin, neat dark beard, crisp white shirt", "male"),
  person("chloe", "Chloe", "middle_east_oceania", "Australian", "Australian woman, about 30, sun-kissed fair skin, beachy light-brown hair, linen top", "female"),
  person("jack", "Jack", "middle_east_oceania", "Australian", "Australian man, about 35, tanned skin, sandy hair, relaxed t-shirt", "male"),

  // Animals
  { id: "bruno", name: "Bruno", kind: "animal", group: "animals", label: "Golden retriever", description: "friendly golden retriever dog with a fluffy golden coat and expressive eyes" },
  { id: "luna", name: "Luna", kind: "animal", group: "animals", label: "Cat", description: "curious grey tabby cat with green eyes" },
  { id: "raja", name: "Raja", kind: "animal", group: "animals", label: "Lion", description: "majestic young lion with a golden mane, friendly expression" },
  { id: "chikki", name: "Chikki", kind: "animal", group: "animals", label: "Rat", description: "cute brown-and-white pet rat with whiskers and pink ears" },
  { id: "mithu", name: "Mithu", kind: "animal", group: "animals", label: "Parrot", description: "bright green Indian parrot with a red beak" },
  { id: "momo", name: "Momo", kind: "animal", group: "animals", label: "Panda", description: "playful baby panda with soft black-and-white fur" },

  // Mascots
  { id: "pip", name: "Pip", kind: "mascot", group: "mascots", label: "Cartoon robot", description: "friendly round white cartoon robot with big blue glowing eyes, 3D animated style" },
  { id: "chotu", name: "Chotu", kind: "mascot", group: "mascots", label: "Cartoon boy", description: "cheerful 3D animated Indian boy character with big eyes and a cap" },
  { id: "dolly", name: "Dolly", kind: "mascot", group: "mascots", label: "Cartoon cow", description: "cute 3D animated cartoon cow with a bell, big friendly eyes" },
];

export const UGC_PRESET_IMAGE_DIR = "/images/ugc-creators";

export function ugcPresetImagePath(id: string): string {
  return `${UGC_PRESET_IMAGE_DIR}/${id}.jpg`;
}

export function getUgcPreset(id: string | undefined): UgcCreatorPreset | undefined {
  return id ? UGC_CREATOR_PRESETS.find((p) => p.id === id) : undefined;
}
