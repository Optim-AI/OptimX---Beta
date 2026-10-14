/**
 * Browser client for /api/creative-studio/poster/carousel/*.
 * Sends only ids, slide count and user edit text — never strategy/story/specs/credits.
 */

import { authFetch, safeResponseJson } from "@/lib/utils";
import type {
  PublicCarouselCampaign,
  PublicCarouselSlide,
} from "@/lib/creative-studio/poster-generation/carousel/serialize";

export type { PublicCarouselCampaign, PublicCarouselSlide };

export const CAROUSEL_MIN_SLIDES = 2;
export const CAROUSEL_MAX_SLIDES = 10;

export type CreativeFormat = "single" | "carousel";

export class CarouselClientError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number
  ) {
    super(message);
    this.name = "CarouselClientError";
  }
}

const BASE = "/api/creative-studio/poster/carousel";

async function call<T>(url: string, init: RequestInit = {}): Promise<T> {
  const res = await authFetch(url, init);
  const data = await safeResponseJson<any>(res);
  if (!res.ok || data?.ok === false) {
    const err = data?.error;
    const message =
      (typeof err === "string" ? err : err?.message) || "Something went wrong. Please try again.";
    throw new CarouselClientError(message, (typeof err === "object" && err?.code) || "INTERNAL", res.status);
  }
  return data as T;
}

export function newCarouselRequestId(): string {
  const rnd =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replace(/-/g, "")
      : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
  return `r${rnd.slice(0, 24)}`;
}

export async function planCarousel(input: {
  sessionId: string;
  slideCount: number;
  conceptId?: string | null;
  regenerate?: boolean;
}): Promise<{ campaign: PublicCarouselCampaign; reused: boolean }> {
  return call(`${BASE}/plan`, {
    method: "POST",
    body: JSON.stringify({
      sessionId: input.sessionId,
      slideCount: input.slideCount,
      conceptId: input.conceptId || undefined,
      regenerate: input.regenerate === true,
    }),
  });
}

export type CarouselGenerateResponse = {
  campaign: PublicCarouselCampaign;
  creditsCharged: number;
  attemptedSlides: number;
  remainingSlides: number;
  inFlightSlides: number;
  done: boolean;
};

export async function generateCarousel(campaignId: string): Promise<CarouselGenerateResponse> {
  return call(`${BASE}/generate`, { method: "POST", body: JSON.stringify({ campaignId }) });
}

export async function getCarousel(campaignId: string): Promise<PublicCarouselCampaign> {
  const data = await call<{ campaign: PublicCarouselCampaign }>(`${BASE}/${encodeURIComponent(campaignId)}`);
  return data.campaign;
}

export async function getLatestCarousel(sessionId: string): Promise<PublicCarouselCampaign | null> {
  const data = await call<{ campaign: PublicCarouselCampaign | null }>(
    `${BASE}?sessionId=${encodeURIComponent(sessionId)}`
  );
  return data.campaign;
}

export async function retryCarouselSlide(campaignId: string, slideId: string, requestId: string) {
  return call<{ campaign: PublicCarouselCampaign; slide: PublicCarouselSlide; creditsCharged: number; replayed: boolean }>(
    `${BASE}/${encodeURIComponent(campaignId)}/slides/${encodeURIComponent(slideId)}/retry`,
    { method: "POST", body: JSON.stringify({ requestId }) }
  );
}

export async function iterateCarouselSlide(campaignId: string, slideId: string, request: string, requestId: string) {
  return call<{ campaign: PublicCarouselCampaign; slide: PublicCarouselSlide; creditsCharged: number; replayed: boolean; summary: string }>(
    `${BASE}/${encodeURIComponent(campaignId)}/slides/${encodeURIComponent(slideId)}/iterate`,
    { method: "POST", body: JSON.stringify({ request, requestId }) }
  );
}

export function slideImagePath(campaignId: string, slide: Pick<PublicCarouselSlide, "slideId" | "imageVersion">): string {
  return `${BASE}/${encodeURIComponent(campaignId)}/slides/${encodeURIComponent(slide.slideId)}/image?v=${encodeURIComponent(slide.imageVersion || "")}`;
}

/** Authenticated fetch → Blob (images are never served from public URLs to the UI) */
export async function fetchCarouselBlob(url: string): Promise<{ blob: Blob; fileName: string | null; headers: Headers }> {
  const res = await authFetch(url, { headers: { accept: "*/*" } });
  if (!res.ok) {
    const data = await safeResponseJson<any>(res).catch(() => null);
    const err = data?.error;
    throw new CarouselClientError(
      (typeof err === "string" ? err : err?.message) || "Download failed. Please try again.",
      err?.code || "INTERNAL",
      res.status
    );
  }
  const cd = res.headers.get("content-disposition") || "";
  const match = cd.match(/filename="([^"]+)"/);
  return { blob: await res.blob(), fileName: match?.[1] ?? null, headers: res.headers };
}

export function saveBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export async function downloadCarouselSlide(campaignId: string, slide: PublicCarouselSlide): Promise<void> {
  const { blob, fileName } = await fetchCarouselBlob(`${slideImagePath(campaignId, slide)}&download=1`);
  saveBlob(blob, fileName || `slide-${String(slide.slideNumber).padStart(2, "0")}.png`);
}

export async function downloadCarouselZip(campaignId: string): Promise<{ complete: boolean; included: number; total: number }> {
  const { blob, fileName, headers } = await fetchCarouselBlob(`${BASE}/${encodeURIComponent(campaignId)}/export`);
  saveBlob(blob, fileName || "carousel.zip");
  return {
    complete: headers.get("x-carousel-complete") === "true",
    included: Number(headers.get("x-carousel-included") || 0),
    total: Number(headers.get("x-carousel-total") || 0),
  };
}

// UI preference only — the server is the source of truth for campaign state.
const PREF_KEY = (studioSessionId: string) => `skalx_poster_carousel:${studioSessionId}`;

export type CarouselPreference = { format: CreativeFormat; slideCount: number };

export function loadCarouselPreference(studioSessionId: string): CarouselPreference | null {
  try {
    const raw = localStorage.getItem(PREF_KEY(studioSessionId));
    if (!raw) return null;
    const v = JSON.parse(raw);
    const format: CreativeFormat = v?.format === "carousel" ? "carousel" : "single";
    const n = Number(v?.slideCount);
    const slideCount = Number.isInteger(n) && n >= CAROUSEL_MIN_SLIDES && n <= CAROUSEL_MAX_SLIDES ? n : 5;
    return { format, slideCount };
  } catch {
    return null;
  }
}

export function saveCarouselPreference(studioSessionId: string, pref: CarouselPreference): void {
  try {
    localStorage.setItem(PREF_KEY(studioSessionId), JSON.stringify(pref));
  } catch {
    // storage unavailable — preference is best-effort
  }
}
