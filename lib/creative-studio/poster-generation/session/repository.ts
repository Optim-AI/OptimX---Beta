/**
 * Poster Generation Session repository contract + Drizzle implementation.
 */

import { and, desc, eq } from "drizzle-orm";
import { db } from "@/database/client";
import { posterGenerationSessions } from "@/database/schema";
import type { PosterGenerationSession } from "../types";
import { PosterGenerationSessionError } from "./errors";
import {
  rowToSession,
  sessionToRowPayload,
  type PosterGenerationSessionRow,
} from "./serialize";

export interface PosterGenerationSessionRepository {
  insert(session: PosterGenerationSession): Promise<PosterGenerationSession>;
  findById(id: string): Promise<PosterGenerationSession | null>;
  findByIdAndUserId(
    id: string,
    userId: string
  ): Promise<PosterGenerationSession | null>;
  findByStudioSessionId(
    studioSessionId: string,
    userId: string
  ): Promise<PosterGenerationSession | null>;
  /**
   * Optimistic concurrency: updates only when row.version === expectedVersion.
   * On success, persists session.version + 1 (caller should already have incremented
   * or repository increments — repository increments from expectedVersion).
   */
  updateOptimistic(
    session: PosterGenerationSession,
    expectedVersion: number
  ): Promise<PosterGenerationSession>;
}

function mapDbRow(row: typeof posterGenerationSessions.$inferSelect): PosterGenerationSessionRow {
  return {
    id: row.id,
    userId: row.userId,
    studioSessionId: row.studioSessionId ?? null,
    brandId: row.brandId ?? null,
    productId: row.productId ?? null,
    status: row.status,
    version: row.version,
    brief: row.brief,
    strategy: row.strategy,
    concepts: row.concepts,
    selectedConceptIds: row.selectedConceptIds,
    dnaByConceptId: row.dnaByConceptId,
    specifications: row.specifications,
    assets: row.assets,
    iterations: row.iterations,
    trace: row.trace,
    error: row.error,
    createdAt: row.createdAt!,
    updatedAt: row.updatedAt!,
  };
}

export class DrizzlePosterGenerationSessionRepository
  implements PosterGenerationSessionRepository
{
  async insert(session: PosterGenerationSession): Promise<PosterGenerationSession> {
    const payload = sessionToRowPayload(session);
    const [row] = await db
      .insert(posterGenerationSessions)
      .values({
        id: session.id,
        userId: session.userId,
        studioSessionId: payload.studioSessionId,
        brandId: payload.brandId,
        productId: payload.productId,
        status: payload.status,
        version: payload.version,
        brief: payload.brief,
        strategy: payload.strategy,
        concepts: payload.concepts,
        selectedConceptIds: payload.selectedConceptIds,
        dnaByConceptId: payload.dnaByConceptId,
        specifications: payload.specifications,
        assets: payload.assets,
        iterations: payload.iterations,
        trace: payload.trace,
        error: payload.error,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
      })
      .returning();
    return rowToSession(mapDbRow(row));
  }

  async findById(id: string): Promise<PosterGenerationSession | null> {
    const rows = await db
      .select()
      .from(posterGenerationSessions)
      .where(eq(posterGenerationSessions.id, id))
      .limit(1);
    if (!rows[0]) return null;
    return rowToSession(mapDbRow(rows[0]));
  }

  async findByIdAndUserId(
    id: string,
    userId: string
  ): Promise<PosterGenerationSession | null> {
    const rows = await db
      .select()
      .from(posterGenerationSessions)
      .where(
        and(
          eq(posterGenerationSessions.id, id),
          eq(posterGenerationSessions.userId, userId)
        )
      )
      .limit(1);
    if (!rows[0]) return null;
    return rowToSession(mapDbRow(rows[0]));
  }

  async findByStudioSessionId(
    studioSessionId: string,
    userId: string
  ): Promise<PosterGenerationSession | null> {
    const rows = await db
      .select()
      .from(posterGenerationSessions)
      .where(
        and(
          eq(posterGenerationSessions.studioSessionId, studioSessionId),
          eq(posterGenerationSessions.userId, userId)
        )
      )
      .orderBy(desc(posterGenerationSessions.updatedAt))
      .limit(1);
    if (!rows[0]) return null;
    return rowToSession(mapDbRow(rows[0]));
  }

  async updateOptimistic(
    session: PosterGenerationSession,
    expectedVersion: number
  ): Promise<PosterGenerationSession> {
    const now = new Date().toISOString();
    const nextVersion = expectedVersion + 1;
    const payload = sessionToRowPayload({
      ...session,
      version: nextVersion,
      updatedAt: now,
    });

    const rows = await db
      .update(posterGenerationSessions)
      .set({
        studioSessionId: payload.studioSessionId,
        brandId: payload.brandId,
        productId: payload.productId,
        status: payload.status,
        version: payload.version,
        brief: payload.brief,
        strategy: payload.strategy,
        concepts: payload.concepts,
        selectedConceptIds: payload.selectedConceptIds,
        dnaByConceptId: payload.dnaByConceptId,
        specifications: payload.specifications,
        assets: payload.assets,
        iterations: payload.iterations,
        trace: payload.trace,
        error: payload.error,
        updatedAt: now,
      })
      .where(
        and(
          eq(posterGenerationSessions.id, session.id),
          eq(posterGenerationSessions.version, expectedVersion)
        )
      )
      .returning();

    if (!rows[0]) {
      throw new PosterGenerationSessionError({
        code: "CONFLICT",
        stage: "repository.updateOptimistic",
        message:
          "Session was updated concurrently. Reload and retry.",
        retryable: true,
      });
    }

    return rowToSession(mapDbRow(rows[0]));
  }
}
