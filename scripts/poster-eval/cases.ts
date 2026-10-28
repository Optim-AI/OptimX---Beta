/**
 * Poster eval cases — a spread of real ad jobs (objective × category × format).
 * Each case is run through the live strategist → concept director → generator.
 * Add cases here when a new kind of ad matters to customers.
 */

import { EMPTY_IDENTITY, type BrandKit } from "@/lib/brand-kit/types";
import type { PosterAspectRatio, PosterVisualDirection } from "@/lib/creative-studio/poster-generation/types";

export type EvalCase = {
  id: string;
  /** What kind of ad this tests (shown in the report) */
  scenario: string;
  brandName: string;
  brandColors: string[];
  product: {
    name: string;
    category: string;
    description: string;
    shortBenefit: string;
    benefits: string[];
    factualClaims: string[];
  };
  /** Prompt for a studio packshot that stands in for the user's product upload; null = no product photo */
  packshotPrompt: string | null;
  userInstruction: string;
  objectiveHint?: string;
  offerHint?: string;
  visualDirection: PosterVisualDirection;
  aspectRatio: PosterAspectRatio;
  brandKit?: BrandKit | null;
};

function kit(partial: Pick<BrandKit, "name" | "colors" | "fonts"> & Partial<BrandKit>): BrandKit {
  return {
    id: `kit_${partial.name.toLowerCase().replace(/\W+/g, "_")}`,
    websiteUrl: null,
    isDefault: true,
    logo: null,
    guidelines: { mustInclude: [], dos: [], donts: [] },
    identity: { ...EMPTY_IDENTITY },
    createdAt: "",
    updatedAt: "",
    ...partial,
  };
}

export const EVAL_CASES: EvalCase[] = [
  {
    id: "launch-oats",
    scenario: "Product launch · food · brand kit",
    brandName: "FuelCo",
    brandColors: ["#e8a33d", "#1b2a4a"],
    product: {
      name: "Dark Chocolate Protein Oats",
      category: "Breakfast / food",
      description: "Instant oats with whey protein and dark cocoa. Ready in 3 minutes.",
      shortBenefit: "26g protein per bowl",
      benefits: ["26g protein per bowl", "Ready in 3 minutes"],
      factualClaims: ["26g protein per bowl", "Ready in 3 minutes", "No added sugar"],
    },
    packshotPrompt:
      "Studio e-commerce packshot on a seamless light grey background: a matte deep-navy stand-up pouch of breakfast oats, brand 'FuelCo' at the top, 'Dark Chocolate Protein Oats', a bold '26g PROTEIN' callout on a cream label panel. Front-facing, soft even light, realistic packaging, no props.",
    userInstruction: "Launch poster for our new Dark Chocolate Protein Oats. Make it feel like a premium breakfast.",
    objectiveHint: "product_launch",
    visualDirection: "premium",
    aspectRatio: "4:5",
    brandKit: kit({
      name: "FuelCo",
      colors: [
        { hex: "#e8a33d", role: "primary" },
        { hex: "#fbf3e6", role: "background" },
        { hex: "#1b2a4a", role: "text" },
        { hex: "#c2410c", role: "accent" },
      ],
      fonts: { heading: { family: "Playfair Display", source: "google" }, body: { family: "Inter", source: "google" } },
      guidelines: { mustInclude: [], dos: ["Warm, sunlit morning feel"], donts: ["Gradients"] },
    }),
  },
  {
    id: "sale-serum",
    scenario: "Sale / limited-time offer · skincare",
    brandName: "GlowLab",
    brandColors: ["#f97316", "#fff7ed"],
    product: {
      name: "Vitamin C Brightening Serum 30ml",
      category: "Skincare",
      description: "15% vitamin C serum with hyaluronic acid for daily use.",
      shortBenefit: "15% vitamin C",
      benefits: ["15% vitamin C", "With hyaluronic acid"],
      factualClaims: ["15% vitamin C", "With hyaluronic acid", "Dermatologically tested"],
    },
    packshotPrompt:
      "Studio packshot on a seamless off-white background: an amber glass dropper bottle 30ml, white label reading 'GlowLab' and 'Vitamin C Brightening Serum 15%', orange accent stripe. Front-facing, soft light, realistic, no props.",
    userInstruction: "Weekend sale poster: flat 30% off our Vitamin C serum, this weekend only. It must sell.",
    objectiveHint: "limited_time_offer",
    offerHint: "Flat 30% off · this weekend only",
    visualDirection: "bold",
    aspectRatio: "4:5",
  },
  {
    id: "feature-earbuds",
    scenario: "Product feature · electronics · square",
    brandName: "Pulse",
    brandColors: ["#7c3aed", "#0b0b0f"],
    product: {
      name: "Pulse Buds X",
      category: "Audio / wireless earbuds",
      description: "True wireless earbuds with active noise cancellation and up to 40 hours total battery with the case.",
      shortBenefit: "40-hour battery",
      benefits: ["Up to 40 hours battery with case", "Active noise cancellation"],
      factualClaims: ["Up to 40 hours battery with case", "Active noise cancellation", "IPX5 water resistance"],
    },
    packshotPrompt:
      "Studio packshot on a seamless dark charcoal background: matte black true-wireless earbuds beside their open pill-shaped charging case, small violet LED, 'Pulse' wordmark on the case lid. Three-quarter angle, crisp rim light, realistic, no props.",
    userInstruction: "Feature ad highlighting the 40 hour battery life for commuters.",
    objectiveHint: "product_feature",
    visualDirection: "dynamic",
    aspectRatio: "1:1",
  },
  {
    id: "beforeafter-hairoil",
    scenario: "Before / after · haircare · story 9:16",
    brandName: "Kesh",
    brandColors: ["#166534", "#fef9c3"],
    product: {
      name: "Kesh Amla & Argan Hair Oil 200ml",
      category: "Haircare",
      description: "Lightweight amla and argan oil blend for frizz control.",
      shortBenefit: "Visibly reduces frizz",
      benefits: ["Visibly reduces frizz", "Non-sticky formula"],
      factualClaims: ["Visibly reduces frizz in 1 use (consumer test, 50 women)", "Non-sticky", "With amla and argan oil"],
    },
    packshotPrompt:
      "Studio packshot on a seamless cream background: a tall clear glass bottle of golden hair oil 200ml with green cap, label 'Kesh' and 'Amla & Argan Hair Oil', small amla fruit illustration. Front-facing, soft light, realistic, no props.",
    userInstruction: "Before and after style story ad: frizzy hair to smooth hair after one use.",
    objectiveHint: "product_benefit",
    visualDirection: "professional",
    aspectRatio: "9:16",
  },
  {
    id: "festive-giftbox",
    scenario: "Festive / seasonal · gifting",
    brandName: "Brew & Co",
    brandColors: ["#7c2d12", "#fde68a"],
    product: {
      name: "Diwali Cold Brew Gift Box",
      category: "Coffee / gifting",
      description: "Gift box with 4 cold brew bottles and a glass tumbler.",
      shortBenefit: "4 cold brews + tumbler",
      benefits: ["4 cold brew bottles", "Glass tumbler included"],
      factualClaims: ["4 cold brew bottles", "Glass tumbler included", "Order by 30 October for Diwali delivery"],
    },
    packshotPrompt:
      "Studio packshot on a seamless warm beige background: an open kraft gift box with four small amber cold-brew bottles labelled 'Brew & Co' and a clear glass tumbler, maroon ribbon. Three-quarter angle, soft light, realistic.",
    userInstruction: "Diwali gifting poster for our cold brew gift box. Order by 30 October for Diwali delivery.",
    objectiveHint: "seasonal_campaign",
    visualDirection: "festive",
    aspectRatio: "4:5",
  },
  {
    id: "awareness-shoes",
    scenario: "Brand awareness · footwear · story 9:16",
    brandName: "Stride",
    brandColors: ["#e11d48", "#111827"],
    product: {
      name: "Stride Run 2",
      category: "Running shoes",
      description: "Lightweight daily running shoe, 220g, with recycled mesh upper.",
      shortBenefit: "220g lightweight",
      benefits: ["220g lightweight", "Recycled mesh upper"],
      factualClaims: ["220g (UK 8)", "Recycled mesh upper"],
    },
    packshotPrompt:
      "Studio packshot on a seamless light grey background: a single lightweight running shoe in red and black with a white sole, small 'Stride' logo on the side. Side profile, crisp light, realistic, no props.",
    userInstruction: "Awareness story ad for Stride Run 2 aimed at new runners. Energetic, made for Instagram stories.",
    objectiveHint: "brand_awareness",
    visualDirection: "trendy",
    aspectRatio: "9:16",
  },
  {
    id: "service-no-product",
    scenario: "Service / SaaS · no product photo · brand kit",
    brandName: "SkalX AI",
    brandColors: ["#269af2", "#121212"],
    product: {
      name: "SkalX AI",
      category: "Marketing software",
      description: "AI marketing platform that creates on-brand posters and video ads from your website.",
      shortBenefit: "On-brand ads from your website",
      benefits: ["Creates posters and video ads", "Learns your brand from your website"],
      factualClaims: ["Free marketing audit", "Creates posters and video ads"],
    },
    packshotPrompt: null,
    userInstruction: "Awareness ad for small D2C founders: get a free AI marketing audit of your brand.",
    objectiveHint: "awareness",
    offerHint: "Free marketing audit",
    visualDirection: "minimal",
    aspectRatio: "1:1",
    brandKit: kit({
      name: "SkalX AI",
      colors: [
        { hex: "#269af2", role: "primary" },
        { hex: "#121212", role: "background" },
        { hex: "#f5f5f5", role: "text" },
        { hex: "#ffd236", role: "accent" },
      ],
      fonts: { heading: { family: "Inter", source: "google" }, body: { family: "Inter", source: "google" } },
    }),
  },
  {
    id: "socialproof-honey",
    scenario: "Social proof / reviews · food",
    brandName: "Wild Hive",
    brandColors: ["#b45309", "#fffbeb"],
    product: {
      name: "Wild Hive Raw Forest Honey 500g",
      category: "Food / honey",
      description: "Raw, unprocessed forest honey from the Nilgiris.",
      shortBenefit: "Raw forest honey",
      benefits: ["Raw and unprocessed", "From the Nilgiris"],
      factualClaims: ["Rated 4.8/5 by 12,000+ customers", "Raw and unprocessed", "Sourced from the Nilgiris"],
    },
    packshotPrompt:
      "Studio packshot on a seamless cream background: a hexagonal glass jar of dark amber honey 500g with a wooden lid and kraft label 'Wild Hive Raw Forest Honey'. Front-facing, warm soft light, realistic, no props.",
    userInstruction: "Social proof poster using our 4.8 rating from 12,000+ customers.",
    objectiveHint: "product_promotion",
    visualDirection: "commercial",
    aspectRatio: "4:5",
  },
];
