/**
 * Carousel persistence. Every slide mutation runs under a row lock; when a
 * mutation carries a credit charge, the deduction and the slide write commit in
 * the same transaction (no generated-but-unaccounted or charged-but-unrecorded state).
 */

import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/database/client";
import { CreditsDAO } from "@/database/models/Credits.dao";
import { posterCarouselCampaigns, posterCarouselSlides } from "@/database/schema";
import { PosterCarouselError } from "./errors";
import { assertCarouselCampaignShape, assertCarouselSlideShape } from "./guards";
import type {
  CarouselCampaign,
  CarouselCampaignWithSlides,
  CarouselSlide,
} from "./types";

export type SlideMutation = {
  next: CarouselSlide;
  charge?: {
    amount: number;
    /** State to persist instead when the wallet cannot cover the charge */
    ifInsufficient: CarouselSlide;
    metadata: Record<string, unknown>;
  };
};

export type SlideMutationResult = {
  applied: boolean;
  charged: number;
  slide: CarouselSlide | null;
};

export type CampaignMetaPatch = Partial<
  Pick<CarouselCampaign, "status" | "campaignChecks" | "lastExport" | "generationStartedAt">
>;

export interface CarouselRepository {
  createCampaign(data: CarouselCampaignWithSlides): Promise<CarouselCampaignWithSlides>;
  /** Replace story + slides of a campaign that has not started generating. */
  replacePlan(input: {
    userId: string;
    expectedVersion: number;
    campaign: CarouselCampaign;
    slides: CarouselSlide[];
  }): Promise<CarouselCampaignWithSlides>;
  findCampaign(campaignId: string, userId: string): Promise<CarouselCampaignWithSlides | null>;
  findLatestForSession(sessionId: string, userId: string): Promise<CarouselCampaignWithSlides | null>;
  updateCampaignMeta(
    campaignId: string,
    userId: string,
    patch: CampaignMetaPatch
  ): Promise<CarouselCampaign | null>;
  mutateSlide(input: {
    campaignId: string;
    slideId: string;
    userId: string;
    mutate: (slide: CarouselSlide) => SlideMutation | null;
  }): Promise<SlideMutationResult>;
}

export const CAROUSEL_CREDIT_SOURCE = "poster_carousel_slide";

function malformed(what: string): PosterCarouselError {
  return new PosterCarouselError({
    code: "MALFORMED_PERSISTED_DATA",
    message: `Persisted carousel ${what} failed validation`,
    stage: "repository",
  });
}

type CampaignRow = typeof posterCarouselCampaigns.$inferSelect;
type SlideRow = typeof posterCarouselSlides.$inferSelect;

function rowToCampaign(row: CampaignRow): CarouselCampaign {
  const campaign = {
    id: row.id,
    sessionId: row.sessionId,
    userId: row.userId,
    status: row.status,
    version: row.version,
    slideCount: row.slideCount,
    aspectRatio: row.aspectRatio,
    briefId: row.briefId,
    strategyId: row.strategyId,
    story: row.story,
    sharedDNA: row.sharedDna,
    campaignChecks: row.campaignChecks,
    lastExport: row.lastExport ?? null,
    generationStartedAt: row.generationStartedAt ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
  if (!assertCarouselCampaignShape(campaign)) throw malformed("campaign");
  return campaign;
}

function rowToSlide(row: SlideRow): CarouselSlide {
  const slide = row.data as CarouselSlide;
  if (
    !assertCarouselSlideShape(slide) ||
    slide.slideId !== row.id ||
    slide.campaignId !== row.campaignId ||
    slide.index !== row.slideIndex
  ) {
    throw malformed("slide");
  }
  return slide;
}

function slideColumns(slide: CarouselSlide) {
  return {
    status: slide.status,
    generationId: slide.generationId,
    leaseToken: slide.lease?.token ?? null,
    leaseExpiresAt: slide.lease?.expiresAt ?? null,
    creditsCharged: slide.creditsCharged,
    data: slide,
    updatedAt: slide.updatedAt,
  };
}

function campaignValues(c: CarouselCampaign) {
  return {
    id: c.id,
    userId: c.userId,
    sessionId: c.sessionId,
    status: c.status,
    version: c.version,
    slideCount: c.slideCount,
    aspectRatio: c.aspectRatio,
    briefId: c.briefId,
    strategyId: c.strategyId,
    story: c.story,
    sharedDna: c.sharedDNA,
    campaignChecks: c.campaignChecks,
    lastExport: c.lastExport,
    generationStartedAt: c.generationStartedAt,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
}

export class DrizzleCarouselRepository implements CarouselRepository {
  async createCampaign(data: CarouselCampaignWithSlides): Promise<CarouselCampaignWithSlides> {
    await db.transaction(async (tx) => {
      await tx.insert(posterCarouselCampaigns).values(campaignValues(data.campaign));
      await tx.insert(posterCarouselSlides).values(
        data.slides.map((s) => ({
          id: s.slideId,
          campaignId: s.campaignId,
          userId: data.campaign.userId,
          slideIndex: s.index,
          createdAt: s.createdAt,
          ...slideColumns(s),
        }))
      );
    });
    const created = await this.findCampaign(data.campaign.id, data.campaign.userId);
    if (!created) throw malformed("campaign");
    return created;
  }

  async replacePlan(input: {
    userId: string;
    expectedVersion: number;
    campaign: CarouselCampaign;
    slides: CarouselSlide[];
  }): Promise<CarouselCampaignWithSlides> {
    const { campaign, userId } = input;
    await db.transaction(async (tx) => {
      const locked = await tx.execute(
        sql`SELECT version, status FROM poster_carousel_campaigns WHERE id = ${campaign.id} AND user_id = ${userId} FOR UPDATE`
      );
      const rows = ((locked as any).rows ?? locked) as Array<{ version: number; status: string }>;
      const row = rows[0];
      const started = await tx.execute(
        sql`SELECT count(*)::int AS n FROM poster_carousel_slides WHERE campaign_id = ${campaign.id} AND status <> 'planned'`
      );
      const startedRows = ((started as any).rows ?? started) as Array<{ n: number }>;
      if (
        !row ||
        Number(row.version) !== input.expectedVersion ||
        !["planning", "ready"].includes(row.status) ||
        Number(startedRows[0]?.n ?? 0) > 0
      ) {
        throw new PosterCarouselError({
          code: "CONFLICT",
          message: "This carousel already started generating or was updated elsewhere.",
          stage: "replacePlan",
          retryable: true,
        });
      }
      await tx.delete(posterCarouselSlides).where(eq(posterCarouselSlides.campaignId, campaign.id));
      const { id: _id, createdAt: _c, ...rest } = campaignValues(campaign);
      await tx
        .update(posterCarouselCampaigns)
        .set({ ...rest, version: input.expectedVersion + 1 })
        .where(eq(posterCarouselCampaigns.id, campaign.id));
      await tx.insert(posterCarouselSlides).values(
        input.slides.map((s) => ({
          id: s.slideId,
          campaignId: s.campaignId,
          userId,
          slideIndex: s.index,
          createdAt: s.createdAt,
          ...slideColumns(s),
        }))
      );
    });
    const updated = await this.findCampaign(campaign.id, userId);
    if (!updated) throw malformed("campaign");
    return updated;
  }

  async findCampaign(campaignId: string, userId: string): Promise<CarouselCampaignWithSlides | null> {
    const rows = await db
      .select()
      .from(posterCarouselCampaigns)
      .where(and(eq(posterCarouselCampaigns.id, campaignId), eq(posterCarouselCampaigns.userId, userId)))
      .limit(1);
    if (!rows[0]) return null;
    const slides = await db
      .select()
      .from(posterCarouselSlides)
      .where(and(eq(posterCarouselSlides.campaignId, campaignId), eq(posterCarouselSlides.userId, userId)))
      .orderBy(posterCarouselSlides.slideIndex);
    return { campaign: rowToCampaign(rows[0]), slides: slides.map(rowToSlide) };
  }

  async findLatestForSession(sessionId: string, userId: string): Promise<CarouselCampaignWithSlides | null> {
    const rows = await db
      .select({ id: posterCarouselCampaigns.id })
      .from(posterCarouselCampaigns)
      .where(and(eq(posterCarouselCampaigns.sessionId, sessionId), eq(posterCarouselCampaigns.userId, userId)))
      .orderBy(desc(posterCarouselCampaigns.createdAt))
      .limit(1);
    return rows[0] ? this.findCampaign(rows[0].id, userId) : null;
  }

  async updateCampaignMeta(
    campaignId: string,
    userId: string,
    patch: CampaignMetaPatch
  ): Promise<CarouselCampaign | null> {
    const rows = await db
      .update(posterCarouselCampaigns)
      .set({
        ...(patch.status ? { status: patch.status } : {}),
        ...(patch.campaignChecks ? { campaignChecks: patch.campaignChecks } : {}),
        ...(patch.lastExport !== undefined ? { lastExport: patch.lastExport } : {}),
        ...(patch.generationStartedAt !== undefined
          ? { generationStartedAt: patch.generationStartedAt }
          : {}),
        version: sql`${posterCarouselCampaigns.version} + 1`,
        updatedAt: new Date().toISOString(),
      })
      .where(and(eq(posterCarouselCampaigns.id, campaignId), eq(posterCarouselCampaigns.userId, userId)))
      .returning();
    return rows[0] ? rowToCampaign(rows[0]) : null;
  }

  async mutateSlide(input: {
    campaignId: string;
    slideId: string;
    userId: string;
    mutate: (slide: CarouselSlide) => SlideMutation | null;
  }): Promise<SlideMutationResult> {
    return db.transaction(async (tx) => {
      const locked = await tx.execute(
        sql`SELECT * FROM poster_carousel_slides WHERE id = ${input.slideId} AND campaign_id = ${input.campaignId} AND user_id = ${input.userId} FOR UPDATE`
      );
      const rows = ((locked as any).rows ?? locked) as Array<Record<string, any>>;
      const raw = rows[0];
      if (!raw) return { applied: false, charged: 0, slide: null };
      const current = rowToSlide({
        id: raw.id,
        campaignId: raw.campaign_id,
        userId: raw.user_id,
        slideIndex: raw.slide_index,
        status: raw.status,
        generationId: raw.generation_id,
        leaseToken: raw.lease_token,
        leaseExpiresAt: raw.lease_expires_at,
        creditsCharged: raw.credits_charged,
        data: raw.data,
        createdAt: raw.created_at,
        updatedAt: raw.updated_at,
      });
      const mutation = input.mutate(current);
      if (!mutation) return { applied: false, charged: 0, slide: current };

      let next = mutation.next;
      let charged = 0;
      if (mutation.charge && mutation.charge.amount > 0) {
        const result = await CreditsDAO.deductImageCreditsInTransaction(tx, {
          userId: input.userId,
          amount: mutation.charge.amount,
          source: CAROUSEL_CREDIT_SOURCE,
          metadata: mutation.charge.metadata,
        });
        if (result.success) {
          charged = mutation.charge.amount;
        } else {
          next = mutation.charge.ifInsufficient;
        }
      }
      if (!assertCarouselSlideShape(next)) throw malformed("slide update");
      await tx
        .update(posterCarouselSlides)
        .set(slideColumns(next))
        .where(eq(posterCarouselSlides.id, input.slideId));
      return { applied: true, charged, slide: next };
    });
  }
}

/**
 * In-memory repository for tests and local smoke runs. Mutations are synchronous
 * between awaits, which gives the same atomicity guarantees as the row lock.
 */
export class InMemoryCarouselRepository implements CarouselRepository {
  campaigns = new Map<string, CarouselCampaign>();
  slides = new Map<string, CarouselSlide[]>();
  wallet: {
    balances: Map<string, number>;
    ledger: Array<{ userId: string; amount: number; metadata: Record<string, unknown> }>;
  };
  /** Test hook: throw inside the next charged commit (simulates a DB failure) */
  failNextChargedCommit = false;

  constructor(balances: Record<string, number> = {}) {
    this.wallet = { balances: new Map(Object.entries(balances)), ledger: [] };
  }

  private clone<T>(v: T): T {
    return structuredClone(v);
  }

  async createCampaign(data: CarouselCampaignWithSlides): Promise<CarouselCampaignWithSlides> {
    this.campaigns.set(data.campaign.id, this.clone(data.campaign));
    this.slides.set(data.campaign.id, this.clone(data.slides));
    return this.clone(data);
  }

  async replacePlan(input: {
    userId: string;
    expectedVersion: number;
    campaign: CarouselCampaign;
    slides: CarouselSlide[];
  }): Promise<CarouselCampaignWithSlides> {
    const cur = this.campaigns.get(input.campaign.id);
    const started = (this.slides.get(input.campaign.id) || []).some((s) => s.status !== "planned");
    if (
      !cur ||
      cur.userId !== input.userId ||
      cur.version !== input.expectedVersion ||
      !["planning", "ready"].includes(cur.status) ||
      started
    ) {
      throw new PosterCarouselError({
        code: "CONFLICT",
        message: "This carousel already started generating or was updated elsewhere.",
        stage: "replacePlan",
        retryable: true,
      });
    }
    const campaign = { ...this.clone(input.campaign), version: input.expectedVersion + 1 };
    this.campaigns.set(campaign.id, campaign);
    this.slides.set(campaign.id, this.clone(input.slides));
    return { campaign: this.clone(campaign), slides: this.clone(input.slides) };
  }

  async findCampaign(campaignId: string, userId: string): Promise<CarouselCampaignWithSlides | null> {
    const c = this.campaigns.get(campaignId);
    if (!c || c.userId !== userId) return null;
    const slides = [...(this.slides.get(campaignId) || [])].sort((a, b) => a.index - b.index);
    return { campaign: this.clone(c), slides: this.clone(slides) };
  }

  async findLatestForSession(sessionId: string, userId: string): Promise<CarouselCampaignWithSlides | null> {
    const list = [...this.campaigns.values()]
      .filter((c) => c.sessionId === sessionId && c.userId === userId)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    return list[0] ? this.findCampaign(list[0].id, userId) : null;
  }

  async updateCampaignMeta(
    campaignId: string,
    userId: string,
    patch: CampaignMetaPatch
  ): Promise<CarouselCampaign | null> {
    const c = this.campaigns.get(campaignId);
    if (!c || c.userId !== userId) return null;
    const next: CarouselCampaign = {
      ...c,
      ...(patch.status ? { status: patch.status } : {}),
      ...(patch.campaignChecks ? { campaignChecks: patch.campaignChecks } : {}),
      ...(patch.lastExport !== undefined ? { lastExport: patch.lastExport } : {}),
      ...(patch.generationStartedAt !== undefined ? { generationStartedAt: patch.generationStartedAt } : {}),
      version: c.version + 1,
      updatedAt: new Date().toISOString(),
    };
    this.campaigns.set(campaignId, next);
    return this.clone(next);
  }

  async mutateSlide(input: {
    campaignId: string;
    slideId: string;
    userId: string;
    mutate: (slide: CarouselSlide) => SlideMutation | null;
  }): Promise<SlideMutationResult> {
    const c = this.campaigns.get(input.campaignId);
    const list = this.slides.get(input.campaignId);
    if (!c || c.userId !== input.userId || !list) return { applied: false, charged: 0, slide: null };
    const idx = list.findIndex((s) => s.slideId === input.slideId);
    if (idx < 0) return { applied: false, charged: 0, slide: null };
    const current = this.clone(list[idx]);
    const mutation = input.mutate(current);
    if (!mutation) return { applied: false, charged: 0, slide: current };
    let next = mutation.next;
    let charged = 0;
    if (mutation.charge && mutation.charge.amount > 0) {
      if (this.failNextChargedCommit) {
        this.failNextChargedCommit = false;
        throw new Error("simulated database failure during charged commit");
      }
      const bal = this.wallet.balances.get(input.userId) ?? 0;
      if (bal >= mutation.charge.amount) {
        this.wallet.balances.set(input.userId, bal - mutation.charge.amount);
        this.wallet.ledger.push({
          userId: input.userId,
          amount: -mutation.charge.amount,
          metadata: mutation.charge.metadata,
        });
        charged = mutation.charge.amount;
      } else {
        next = mutation.charge.ifInsufficient;
      }
    }
    if (!assertCarouselSlideShape(next)) throw malformed("slide update");
    list[idx] = this.clone(next);
    return { applied: true, charged, slide: this.clone(next) };
  }

  balanceOf(userId: string): number {
    return this.wallet.balances.get(userId) ?? 0;
  }
}
